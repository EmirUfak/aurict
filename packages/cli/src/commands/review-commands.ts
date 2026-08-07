import type { CommandDef, CommandResult } from "./types.js"
import { buildReviewManifest, resolveReviewWorkdir } from "../review/manifest.js"
import { formatReviewSession, runReview } from "../review/runner.js"
import { listReviewSessions, readReviewSession } from "../review/store.js"
import type { ReviewMode } from "../review/types.js"

function parseMode(args: string[]): ReviewMode {
  const base = args.indexOf("--base")
  const commit = args.indexOf("--commit")
  if (base >= 0 && commit >= 0) throw new Error("Use either --base or --commit, not both.")
  if (base >= 0) {
    const ref = args[base + 1]
    if (!ref) throw new Error("--base requires a git ref.")
    return { kind: "base", ref }
  }
  if (commit >= 0) {
    const ref = args[commit + 1]
    if (!ref) throw new Error("--commit requires a git ref.")
    return { kind: "commit", ref }
  }
  return { kind: "workspace" }
}

function preview(args: string[], workdir: string): CommandResult {
  const manifest = buildReviewManifest(workdir, parseMode(args))
  const lines = [
    `Review preview · ${manifest.scopeHash.slice(0, 12)}`,
    `${manifest.totals.files} files · +${manifest.totals.additions}/-${manifest.totals.deletions} · ${manifest.totals.binary} binary`,
    "",
    ...manifest.files.map((file) => `  ${file.binary ? "B" : file.untracked ? "?" : "M"} ${file.path}  +${file.additions ?? "-"}/-${file.deletions ?? "-"}  ${file.hunks.length} hunk(s)`),
    "",
    "Run with: /review run [--base <ref> | --commit <ref>]",
  ]
  return { type: "text", content: lines.join("\n") }
}

export const reviewCommands: CommandDef[] = [{
  name: "review",
  aliases: ["rv"],
  description: "Preview, run, resume, and inspect deterministic code reviews",
  usage: "/review [preview|run|list|show <id>|resume <id>] [--base <ref>|--commit <ref>]",
  handler: async (args, ctx): Promise<CommandResult> => {
    const action = (args[0] ?? "preview").toLowerCase()
    try {
      const reviewWorkdir = resolveReviewWorkdir(ctx.workdir)
      if (action === "list") {
        const sessions = listReviewSessions(reviewWorkdir)
        if (sessions.length === 0) return { type: "text", content: "No review sessions yet." }
        return { type: "text", content: sessions.map((session) => `${session.id}  ${session.status.padEnd(9)} ${session.manifest.totals.files} files  ${session.startedAt}`).join("\n") }
      }
      if (action === "show") {
        if (!args[1]) return { type: "error", message: "Usage: /review show <id>" }
        return { type: "text", content: formatReviewSession(readReviewSession(reviewWorkdir, args[1])) }
      }
      if (action === "resume") {
        if (!args[1]) return { type: "error", message: "Usage: /review resume <id>" }
        const previous = readReviewSession(reviewWorkdir, args[1])
        ctx.addSystemMsg(`Resuming review ${previous.id}…`)
        const session = await runReview({ workdir: ctx.workdir, mode: previous.manifest.mode, provider: ctx.provider, model: ctx.model, manifest: previous.manifest })
        return { type: "text", content: formatReviewSession(session) }
      }
      const optionArgs = action === "preview" || action === "run" ? args.slice(1) : args
      if (action !== "run" && action !== "preview" && args[0]) {
        if (action.startsWith("--")) return preview(args, reviewWorkdir)
        return { type: "error", message: `Unknown review action: ${action}. Use preview, run, list, show, or resume.` }
      }
      if (action === "preview") return preview(optionArgs, ctx.workdir)
      ctx.addSystemMsg("Review started with read-only tools…")
      const session = await runReview({ workdir: ctx.workdir, mode: parseMode(optionArgs), provider: ctx.provider, model: ctx.model })
      return { type: "text", content: formatReviewSession(session) }
    } catch (error) {
      return { type: "error", message: error instanceof Error ? error.message : String(error) }
    }
  },
}]
