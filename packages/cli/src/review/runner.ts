import { runAgent } from "@aurict/core"
import type { AgentRunOptions } from "@aurict/core"
import { buildReviewManifest, buildReviewPatch } from "./manifest.js"
import { formatReviewReport, parseReviewReport } from "./report.js"
import { writeReviewSession } from "./store.js"
import type { ReviewManifest, ReviewMode, ReviewSession } from "./types.js"

const REVIEW_SYSTEM = `You are Aurict's read-only code-review worker.
Review only the supplied manifest and diff. Inspect repository context with read/glob/grep/lsp when necessary.
Prioritize correctness, security, data loss, concurrency and broken contracts. Avoid praise, style-only noise and speculation.
Every line number must be a NEW-side line in a changed hunk. Use null when the issue is file-level.
Return exactly one JSON object with this schema and no prose:
{"summary":"short result","findings":[{"severity":"critical|high|medium|low|info","file":"manifest path","line":123,"title":"short","detail":"evidence and impact","suggestion":"specific fix","confidence":"high|medium|low"}]}`

function sessionId(manifest: ReviewManifest): string {
  return `review-${Date.now().toString(36)}-${manifest.scopeHash.slice(0, 8)}`
}

export async function runReview(options: {
  workdir: string
  mode: ReviewMode
  provider: string
  model: string
  manifest?: ReviewManifest
  executeAgent?: (options: AgentRunOptions) => Promise<{ text: string }>
}): Promise<ReviewSession> {
  const manifest = options.manifest ?? buildReviewManifest(options.workdir, options.mode)
  if (manifest.files.length === 0) throw new Error("Review scope is empty; no changed files were found.")
  const patch = buildReviewPatch(manifest)
  const session: ReviewSession = {
    version: 1, id: sessionId(manifest), status: "running", manifest,
    provider: options.provider, model: options.model, startedAt: new Date().toISOString(),
  }
  writeReviewSession(session)
  try {
    const result = await (options.executeAgent ?? runAgent)({
      sessionId: session.id,
      provider: options.provider,
      model: options.model,
      workdir: manifest.workdir,
      system: REVIEW_SYSTEM,
      messages: [{ role: "user", content: `REVIEW MANIFEST\n${JSON.stringify(manifest, null, 2)}\n\nDIFF\n${patch}` }],
      toolsOverride: ["read", "glob", "grep", "lsp"],
      coordinatorMode: false,
    })
    session.report = parseReviewReport(result.text, manifest)
    session.status = "completed"
    session.completedAt = new Date().toISOString()
    writeReviewSession(session)
    return session
  } catch (error) {
    session.status = "failed"
    session.completedAt = new Date().toISOString()
    session.error = error instanceof Error ? error.message : String(error)
    writeReviewSession(session)
    throw error
  }
}

export function formatReviewSession(session: ReviewSession): string {
  const scope = `${session.manifest.totals.files} files, +${session.manifest.totals.additions}/-${session.manifest.totals.deletions}`
  if (session.status === "completed" && session.report) return `${session.id} · ${scope}\n${formatReviewReport(session.report)}`
  if (session.status === "failed") return `${session.id} · failed · ${scope}\n${session.error ?? "Unknown failure"}`
  return `${session.id} · running · ${scope}`
}
