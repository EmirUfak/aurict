import { readdirSync } from "node:fs"
import { isAbsolute, join } from "node:path"
import { readJsonFileSync, writeJsonFileAtomicSync } from "@aurict/core"
import type { ReviewFinding, ReviewManifest, ReviewReport, ReviewSession } from "./types.js"

function directory(workdir: string): string {
  return join(workdir, ".aurict", "reviews")
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function isoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
}

function validFinding(value: unknown, manifest: ReviewManifest): value is ReviewFinding {
  if (!object(value)) return false
  const line = value["line"]
  const file = typeof value["file"] === "string" ? manifest.files.find((entry) => entry.path === value["file"]) : undefined
  const anchored = line === null || Boolean(file && Number.isInteger(line) && Number(line) > 0 && (
    file.untracked
      ? Number(line) <= (file.additions ?? 0)
      : file.hunks.some((hunk) => hunk.newLines > 0 && Number(line) >= hunk.newStart && Number(line) < hunk.newStart + hunk.newLines)
  ))
  return typeof value["id"] === "string"
    && ["critical", "high", "medium", "low", "info"].includes(String(value["severity"]))
    && Boolean(file) && anchored
    && ["title", "detail", "suggestion"].every((field) => typeof value[field] === "string" && Boolean(String(value[field]).trim()))
    && ["high", "medium", "low"].includes(String(value["confidence"]))
}

function validReport(value: unknown, manifest: ReviewManifest): value is ReviewReport {
  return object(value) && typeof value["summary"] === "string" && Boolean(value["summary"].trim())
    && value["summary"].length <= 1_000 && Array.isArray(value["findings"]) && value["findings"].length <= 200
    && value["findings"].every((finding) => validFinding(finding, manifest))
}

function validManifest(value: unknown): value is ReviewManifest {
  if (!object(value) || value["version"] !== 1 || !isAbsolute(String(value["workdir"] ?? ""))) return false
  if (!isoDate(value["createdAt"]) || !/^[a-f0-9]{64}$/.test(String(value["scopeHash"]))) return false
  if (!/^[a-f0-9]{64}$/.test(String(value["patchHash"]))) return false
  const mode = value["mode"]
  if (!object(mode) || !["workspace", "base", "commit"].includes(String(mode["kind"]))) return false
  if (mode["kind"] !== "workspace" && (typeof mode["ref"] !== "string" || !mode["ref"])) return false
  if (!Array.isArray(value["files"]) || !object(value["totals"])) return false
  const files = value["files"]
  if (!files.every((file) => {
    if (!object(file) || typeof file["path"] !== "string" || !file["path"] || isAbsolute(file["path"]) || file["path"].includes("\0")) return false
    if (typeof file["binary"] !== "boolean" || typeof file["untracked"] !== "boolean" || !Array.isArray(file["hunks"])) return false
    if (![file["additions"], file["deletions"]].every((count) => count === null || (Number.isInteger(count) && Number(count) >= 0))) return false
    return file["hunks"].every((hunk) => object(hunk)
      && ["oldStart", "oldLines", "newStart", "newLines"].every((field) => Number.isInteger(hunk[field]) && Number(hunk[field]) >= 0))
  })) return false
  const typedFiles = files as unknown as ReviewManifest["files"]
  const totals = value["totals"]
  return totals["files"] === typedFiles.length
    && totals["additions"] === typedFiles.reduce((sum, file) => sum + (file.additions ?? 0), 0)
    && totals["deletions"] === typedFiles.reduce((sum, file) => sum + (file.deletions ?? 0), 0)
    && totals["binary"] === typedFiles.filter((file) => file.binary).length
}

function validSession(value: unknown): value is ReviewSession {
  if (!object(value) || value["version"] !== 1 || !/^review-[a-z0-9-]+$/i.test(String(value["id"]))) return false
  const statuses = ["running", "completed", "failed", "interrupted", "stale", "cancelled"]
  if (!statuses.includes(String(value["status"])) || !validManifest(value["manifest"])) return false
  if (typeof value["provider"] !== "string" || !value["provider"] || typeof value["model"] !== "string" || !value["model"] || !isoDate(value["startedAt"])) return false
  const status = value["status"]
  if (status === "completed") return isoDate(value["completedAt"]) && validReport(value["report"], value["manifest"])
  if (status === "running") return value["completedAt"] === undefined && value["report"] === undefined
  return isoDate(value["completedAt"]) && typeof value["error"] === "string" && Boolean(value["error"])
}

function sessionNames(workdir: string): string[] {
  try {
    return readdirSync(directory(workdir)).filter((name) => /^review-.*\.json$/.test(name))
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return []
    throw error
  }
}

export function writeReviewSession(session: ReviewSession): void {
  writeJsonFileAtomicSync(join(directory(session.manifest.workdir), `${session.id}.json`), session, { backup: true, mode: 0o600 })
}

export function readReviewSession(workdir: string, id: string): ReviewSession {
  if (!/^review-[a-z0-9-]+$/i.test(id)) throw new Error(`Invalid review session id: ${id}`)
  const session = readJsonFileSync<ReviewSession>(join(directory(workdir), `${id}.json`), {
    validate: validSession,
    description: "review session",
  })
  if (!session) throw new Error(`Review session not found: ${id}`)
  return session
}

export function recoverInterruptedReviewSessions(workdir: string, activeIds: ReadonlySet<string> = new Set()): number {
  let recovered = 0
  for (const name of sessionNames(workdir)) {
    const session = readReviewSession(workdir, name.slice(0, -5))
    if (session.status !== "running" || activeIds.has(session.id)) continue
    session.status = "interrupted"
    session.completedAt = new Date().toISOString()
    session.error = "Review process ended before the session completed. Resume from a fresh scope preview."
    writeReviewSession(session)
    recovered += 1
  }
  return recovered
}

export function listReviewSessions(workdir: string): ReviewSession[] {
  return sessionNames(workdir).map((name) => readReviewSession(workdir, name.slice(0, -5)))
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
}
