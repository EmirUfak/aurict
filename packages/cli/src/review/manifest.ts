import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import type { ReviewFile, ReviewHunk, ReviewManifest, ReviewMode } from "./types.js"

const MAX_GIT_OUTPUT = 8 * 1024 * 1024
export const MAX_REVIEW_PATCH_BYTES = 400_000

interface SnapshotFile extends ReviewFile { patch: string }
const INTERNAL_REVIEW_PREFIX = ".aurict/reviews/"

export class StaleReviewScopeError extends Error {
  constructor() {
    super("Review scope is stale because the selected files changed after preview. Create a new preview before resuming.")
    this.name = "StaleReviewScopeError"
  }
}

function git(workdir: string, args: string[], accepted = [0]): string {
  const result = spawnSync("git", ["-C", workdir, ...args], {
    encoding: "utf8",
    maxBuffer: MAX_GIT_OUTPUT,
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (result.error) throw new Error(`Git could not start: ${result.error.message}`)
  if (!accepted.includes(result.status ?? -1)) {
    throw new Error(result.stderr.trim() || `git ${args[0] ?? "command"} failed`)
  }
  return result.stdout
}

function validatedRef(workdir: string, ref: string): string {
  if (!ref || ref.startsWith("-") || /[\u0000-\u001f\s]/.test(ref)) throw new Error(`Invalid git ref: ${ref || "(empty)"}`)
  git(workdir, ["rev-parse", "--verify", `${ref}^{commit}`])
  return ref
}

function scopeArgs(workdir: string, mode: ReviewMode): string[] {
  if (mode.kind === "workspace") {
    const hasHead = spawnSync("git", ["-C", workdir, "rev-parse", "--verify", "HEAD"], { stdio: "ignore" }).status === 0
    return hasHead ? ["diff", "--no-renames", "HEAD"] : ["diff", "--no-renames", "--cached"]
  }
  if (mode.kind === "commit") return ["show", "--format=", "--no-renames", validatedRef(workdir, mode.ref)]
  const base = git(workdir, ["merge-base", validatedRef(workdir, mode.ref), "HEAD"]).trim()
  if (!base) throw new Error(`No merge base found for ${mode.ref}`)
  return ["diff", "--no-renames", base, "HEAD"]
}

function parseNumstat(raw: string): Map<string, Omit<ReviewFile, "path" | "untracked" | "hunks">> {
  const files = new Map<string, Omit<ReviewFile, "path" | "untracked" | "hunks">>()
  for (const record of raw.split("\0")) {
    if (!record) continue
    const first = record.indexOf("\t")
    const second = first < 0 ? -1 : record.indexOf("\t", first + 1)
    if (first < 0 || second < 0) throw new Error("Git returned malformed NUL-delimited numstat output.")
    const added = record.slice(0, first)
    const deleted = record.slice(first + 1, second)
    const path = record.slice(second + 1)
    if (!path) throw new Error("Git returned an empty path in numstat output.")
    const binary = added === "-" || deleted === "-"
    files.set(path, {
      additions: binary ? null : Number(added),
      deletions: binary ? null : Number(deleted),
      binary,
    })
  }
  return files
}

function parseHunks(patch: string): ReviewHunk[] {
  const hunks: ReviewHunk[] = []
  for (const line of patch.split("\n")) {
    if (!line.startsWith("@@")) continue
    const match = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line)
    if (!match) throw new Error(`Git returned an unsupported hunk header: ${line}`)
    hunks.push({
      oldStart: Number(match[1]), oldLines: Number(match[2] ?? "1"),
      newStart: Number(match[3]), newLines: Number(match[4] ?? "1"),
    })
  }
  return hunks
}

function quoteGitPath(path: string): string {
  return /^[A-Za-z0-9._/-]+$/.test(path) ? path : JSON.stringify(path)
}

function untrackedPatch(path: string, content: Buffer, binary: boolean): string {
  const from = quoteGitPath(`a/${path}`)
  const to = quoteGitPath(`b/${path}`)
  const header = `diff --git ${from} ${to}\nnew file mode 100644\n--- /dev/null\n+++ ${to}\n`
  if (binary) return `${header}Binary files /dev/null and ${to} differ\n`
  const text = content.toString("utf8")
  const lines = text.split(/\r?\n/)
  if (text.endsWith("\n")) lines.pop()
  if (lines.length === 0 || (lines.length === 1 && lines[0] === "")) return header
  return `${header}@@ -0,0 +1,${lines.length} @@\n${lines.map((line) => `+${line}`).join("\n")}\n`
}

function snapshotFiles(root: string, mode: ReviewMode): SnapshotFile[] {
  const args = scopeArgs(root, mode)
  const stats = parseNumstat(git(root, [...args, "--no-ext-diff", "--numstat", "-z", "--"]))
  const tracked = [...stats.entries()].filter(([path]) => !path.startsWith(INTERNAL_REVIEW_PREFIX)).map(([path, stat]): SnapshotFile => {
    const patch = git(root, [...args, "--no-ext-diff", "--binary", "--unified=3", "--", path])
    return { path, ...stat, untracked: false, hunks: parseHunks(patch), patch }
  })
  if (mode.kind !== "workspace") return tracked.sort((a, b) => a.path.localeCompare(b.path))

  const untracked = git(root, ["ls-files", "--others", "--exclude-standard", "-z"])
    .split("\0").filter((path) => Boolean(path) && !path.startsWith(INTERNAL_REVIEW_PREFIX)).map((path): SnapshotFile => {
      const content = readFileSync(resolve(root, path))
      const binary = content.includes(0)
      const text = content.toString("utf8")
      const additions = binary ? null : text.length === 0 ? 0 : text.split(/\r?\n/).length - (text.endsWith("\n") ? 1 : 0)
      return {
        path, additions, deletions: binary ? null : 0, binary, untracked: true,
        hunks: additions && additions > 0 ? [{ oldStart: 0, oldLines: 0, newStart: 1, newLines: additions }] : [],
        patch: untrackedPatch(path, content, binary),
      }
    })
  return [...tracked, ...untracked].sort((a, b) => a.path.localeCompare(b.path))
}

function joinedPatch(files: SnapshotFile[]): string {
  return files.map((file) => file.patch).filter(Boolean).join("\n")
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

export function buildReviewManifest(workdir: string, mode: ReviewMode): ReviewManifest {
  const root = git(workdir, ["rev-parse", "--show-toplevel"]).trim()
  const snapshots = snapshotFiles(root, mode)
  const patchHash = hash(joinedPatch(snapshots))
  const files = snapshots.map(({ patch: _patch, ...file }) => file)
  const canonical = JSON.stringify({ mode, patchHash, files })
  return {
    version: 1, workdir: root, mode, createdAt: new Date().toISOString(),
    scopeHash: hash(canonical), patchHash, files,
    totals: {
      files: files.length,
      additions: files.reduce((sum, file) => sum + (file.additions ?? 0), 0),
      deletions: files.reduce((sum, file) => sum + (file.deletions ?? 0), 0),
      binary: files.filter((file) => file.binary).length,
    },
  }
}

export function resolveReviewWorkdir(workdir: string): string {
  return git(workdir, ["rev-parse", "--show-toplevel"]).trim()
}

function currentSnapshots(manifest: ReviewManifest): SnapshotFile[] {
  const snapshots = snapshotFiles(manifest.workdir, manifest.mode)
  if (hash(joinedPatch(snapshots)) !== manifest.patchHash) throw new StaleReviewScopeError()
  return snapshots
}

export function buildReviewPatch(manifest: ReviewManifest): string {
  const patch = joinedPatch(currentSnapshots(manifest))
  if (Buffer.byteLength(patch) > MAX_REVIEW_PATCH_BYTES) {
    throw new Error(`Review patch is ${Buffer.byteLength(patch).toLocaleString()} bytes; use chunked review execution or narrow the scope.`)
  }
  return patch
}

export function buildReviewPatchChunks(manifest: ReviewManifest, maxBytes = MAX_REVIEW_PATCH_BYTES): string[] {
  if (!Number.isInteger(maxBytes) || maxBytes < 1) throw new Error("Review chunk size must be a positive integer.")
  const chunks: string[] = []
  let current = ""
  for (const file of currentSnapshots(manifest)) {
    const separator = current ? "\n" : ""
    const candidate = `${current}${separator}${file.patch}`
    if (Buffer.byteLength(candidate) <= maxBytes) {
      current = candidate
      continue
    }
    if (current) chunks.push(current)
    if (Buffer.byteLength(file.patch) > maxBytes) {
      throw new Error(`Review patch for '${file.path}' exceeds the ${maxBytes.toLocaleString()} byte chunk limit. Narrow the change in that file.`)
    }
    current = file.patch
  }
  if (current) chunks.push(current)
  return chunks
}
