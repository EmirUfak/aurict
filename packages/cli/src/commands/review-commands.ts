import type { CommandDef, CommandResult } from "./types.js"
import { buildReviewManifest, resolveReviewWorkdir } from "../review/manifest.js"
import { activeReviewIds, cancelReview, formatReviewSession, runReview } from "../review/runner.js"
import { listReviewSessions, readReviewSession, recoverInterruptedReviewSessions } from "../review/store.js"
import type { ReviewMode } from "../review/types.js"

function parseMode(args: string[]): ReviewMode {
  if (args.length === 0) return { kind: "workspace" }
  if (args.length !== 2) throw new Error("Review scope accepts exactly one of --base <ref> or --commit <ref>.")
  const [flag, ref] = args
  if (!ref) throw new Error(`${flag} requires a git ref.`)
  if (flag === "--base") return { kind: "base", ref }
  if (flag === "--commit") return { kind: "commit", ref }
  throw new Error(`Unknown review option: ${flag}`)
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
  usage: "/review [preview|run|list|show <id>|resume <id>|cancel [id]] [--base <ref>|--commit <ref>]",
  handler: async (args, ctx): Promise<CommandResult> => {
    const action = (args[0] ?? "preview").toLowerCase()
    try {
      const reviewWorkdir = resolveReviewWorkdir(ctx.workdir)
      if (action === "list") {
        if (args.length > 1) return { type: "error", message: "Usage: /review list" }
        recoverInterruptedReviewSessions(reviewWorkdir, new Set(activeReviewIds()))
        const sessions = listReviewSessions(reviewWorkdir)
        if (sessions.length === 0) return { type: "text", content: "No review sessions yet." }
        return { type: "text", content: sessions.map((session) => `${session.id}  ${session.status.padEnd(9)} ${session.manifest.totals.files} files  ${session.startedAt}`).join("\n") }
      }
      if (action === "show") {
        if (!args[1] || args.length !== 2) return { type: "error", message: "Usage: /review show <id>" }
        return { type: "text", content: formatReviewSession(readReviewSession(reviewWorkdir, args[1])) }
      }
      if (action === "resume") {
        if (!args[1] || args.length !== 2) return { type: "error", message: "Usage: /review resume <id>" }
        const previous = readReviewSession(reviewWorkdir, args[1])
        ctx.addSystemMsg(`Resuming review ${previous.id}…`)
        const session = await runReview({
          workdir: ctx.workdir, mode: previous.manifest.mode, provider: ctx.provider, model: ctx.model, manifest: previous.manifest,
          onStarted: (started) => ctx.addSystemMsg(`Review ${started.id} started with read-only tools…`),
          onProgress: (completed, total) => ctx.addSystemMsg(`Review progress: ${completed}/${total} chunk(s)`),
        })
        return { type: "text", content: formatReviewSession(session) }
      }
      if (action === "cancel") {
        if (args.length > 2) return { type: "error", message: "Usage: /review cancel [id]" }
        const id = args[1] ?? activeReviewIds().at(-1)
        if (!id) return { type: "error", message: "No active review to cancel." }
        return cancelReview(id)
          ? { type: "text", content: `Cancellation requested for ${id}.` }
          : { type: "error", message: `Active review not found: ${id}` }
      }
      const optionArgs = action === "preview" || action === "run" ? args.slice(1) : args
      if (action !== "run" && action !== "preview" && args[0]) {
        if (action.startsWith("--")) return preview(args, reviewWorkdir)
        return { type: "error", message: `Unknown review action: ${action}. Use preview, run, list, show, resume, or cancel.` }
      }
      if (action === "preview") return preview(optionArgs, ctx.workdir)
      const session = await runReview({
        workdir: ctx.workdir, mode: parseMode(optionArgs), provider: ctx.provider, model: ctx.model,
        onStarted: (started) => ctx.addSystemMsg(`Review ${started.id} started with read-only tools…`),
        onProgress: (completed, total) => ctx.addSystemMsg(`Review progress: ${completed}/${total} chunk(s)`),
      })
      return { type: "text", content: formatReviewSession(session) }
    } catch (error) {
      return { type: "error", message: error instanceof Error ? error.message : String(error) }
    }
  },
}]
