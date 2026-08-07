import { readdirSync } from "node:fs"
import { join } from "node:path"
import { readJsonFileSync, writeJsonFileAtomicSync } from "@aurict/core"
import type { ReviewSession } from "./types.js"

function directory(workdir: string): string {
  return join(workdir, ".aurict", "reviews")
}

function validSession(value: unknown): value is ReviewSession {
  if (!value || typeof value !== "object") return false
  const session = value as Partial<ReviewSession>
  return session.version === 1 && typeof session.id === "string"
    && ["running", "completed", "failed"].includes(session.status ?? "")
    && Boolean(session.manifest && session.manifest.version === 1)
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

export function listReviewSessions(workdir: string): ReviewSession[] {
  let names: string[]
  try { names = readdirSync(directory(workdir)).filter((name) => /^review-.*\.json$/.test(name)) }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return []
    throw error
  }
  return names.map((name) => readReviewSession(workdir, name.slice(0, -5)))
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
}
