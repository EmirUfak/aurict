import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawnSync } from "node:child_process"
import type { ReviewFile, ReviewHunk, ReviewManifest, ReviewMode } from "./types.js"

const MAX_GIT_OUTPUT = 8 * 1024 * 1024
export const MAX_REVIEW_PATCH_BYTES = 400_000

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

function diffArgs(workdir: string, mode: ReviewMode): string[] {
  if (mode.kind === "workspace") {
    const hasHead = spawnSync("git", ["-C", workdir, "rev-parse", "--verify", "HEAD"], { stdio: "ignore" }).status === 0
    return hasHead ? ["diff", "HEAD"] : ["diff", "--cached"]
  }
  if (mode.kind === "commit") return ["show", "--format=", "--no-renames", validatedRef(workdir, mode.ref)]
  const base = git(workdir, ["merge-base", validatedRef(workdir, mode.ref), "HEAD"]).trim()
  if (!base) throw new Error(`No merge base found for ${mode.ref}`)
  return ["diff", "--no-renames", base, "HEAD"]
}

function parseNumstat(raw: string): Map<string, Omit<ReviewFile, "path" | "untracked" | "hunks">> {
  const files = new Map<string, Omit<ReviewFile, "path" | "untracked" | "hunks">>()
  for (const line of raw.split("\n")) {
    if (!line) continue
    const [added, deleted, ...pathParts] = line.split("\t")
    const path = pathParts.join("\t")
    if (!path) continue
    const binary = added === "-" || deleted === "-"
    files.set(path, {
      additions: binary ? null : Number(added),
      deletions: binary ? null : Number(deleted),
      binary,
    })
  }
  return files
}

function parseHunks(patch: string): Map<string, ReviewHunk[]> {
  const result = new Map<string, ReviewHunk[]>()
  let path: string | null = null
  for (const line of patch.split("\n")) {
    if (line.startsWith("+++ ")) {
      const value = line.slice(4)
      path = value === "/dev/null" ? null : value.replace(/^b\//, "")
      if (path && !result.has(path)) result.set(path, [])
      continue
    }
    if (!path || !line.startsWith("@@")) continue
    const match = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line)
    if (!match) continue
    result.get(path)!.push({
      oldStart: Number(match[1]), oldLines: Number(match[2] ?? "1"),
      newStart: Number(match[3]), newLines: Number(match[4] ?? "1"),
    })
  }
  return result
}

function untrackedFiles(workdir: string): ReviewFile[] {
  return git(workdir, ["ls-files", "--others", "--exclude-standard", "-z"])
    .split("\0").filter(Boolean).sort().map((path) => {
      const content = readFileSync(resolve(workdir, path))
      const binary = content.includes(0)
      const text = content.toString("utf8")
      const additions = binary ? null : text.length === 0 ? 0 : text.split(/\r?\n/).length - (text.endsWith("\n") ? 1 : 0)
      return { path, additions, deletions: binary ? null : 0, binary, untracked: true, hunks: [] }
    })
}

export function buildReviewManifest(workdir: string, mode: ReviewMode): ReviewManifest {
  const root = git(workdir, ["rev-parse", "--show-toplevel"]).trim()
  const args = diffArgs(root, mode)
  const patch = git(root, [...args, "--no-ext-diff", "--unified=0", "--"])
  const stats = parseNumstat(git(root, [...args, "--no-ext-diff", "--numstat", "--"]))
  const hunks = parseHunks(patch)
  const tracked = [...stats.entries()].map(([path, stat]) => ({ path, ...stat, untracked: false, hunks: hunks.get(path) ?? [] }))
  const files = [...tracked, ...(mode.kind === "workspace" ? untrackedFiles(root) : [])].sort((a, b) => a.path.localeCompare(b.path))
  const canonical = JSON.stringify({ mode, files })
  return {
    version: 1, workdir: root, mode, createdAt: new Date().toISOString(),
    scopeHash: createHash("sha256").update(canonical).digest("hex"), files,
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

export function buildReviewPatch(manifest: ReviewManifest): string {
  const args = diffArgs(manifest.workdir, manifest.mode)
  let patch = git(manifest.workdir, [...args, "--no-ext-diff", "--unified=3", "--"])
  for (const file of manifest.files.filter((candidate) => candidate.untracked && !candidate.binary)) {
    patch += `\n--- /dev/null\n+++ b/${file.path}\n${readFileSync(resolve(manifest.workdir, file.path), "utf8")}`
  }
  if (Buffer.byteLength(patch) > MAX_REVIEW_PATCH_BYTES) {
    throw new Error(`Review patch is ${Buffer.byteLength(patch).toLocaleString()} bytes; limit is ${MAX_REVIEW_PATCH_BYTES.toLocaleString()}. Narrow the scope with --base or --commit.`)
  }
  return patch
}
