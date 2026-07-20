import {
  executeTool,
  fingerprintWorkspace,
  formatFlightFailure,
  listFlightFailures,
  readFlightFailure,
  ToolRegistry,
} from "@aurict/core"
import type { CommandDef, CommandResult } from "./types.js"

export const flightCommands: CommandDef[] = [{
  name: "flight",
  aliases: ["failures"],
  description: "Inspect and safely replay recorded tool failures",
  usage: "[show <id> | replay <id> [--confirm] [--allow-drift]]",
  handler: async (args, ctx): Promise<CommandResult> => {
    const action = args[0] ?? "list"
    if (action === "list") return listFailures(ctx.workdir, ctx.sessionId)
    const id = args[1]
    if (!id) return { type: "error", message: `Usage: /flight ${action} <id>` }
    const entry = await readFlightFailure(ctx.workdir, ctx.sessionId, id)
    if (!entry) return { type: "error", message: `Flight entry not found: ${id}` }
    if (action === "show") return { type: "text", content: formatFlightFailure(entry) }
    if (action !== "replay") return { type: "error", message: `Unknown flight action: ${action}` }
    if (entry.replayPolicy === "blocked") {
      return { type: "error", message: `Replay blocked: ${entry.replayBlockReason ?? "unsafe recorded operation"}` }
    }
    if (entry.replayPolicy === "confirm" && !args.includes("--confirm")) {
      return {
        type: "error",
        message: `This replay may change workspace state. Inspect it with /flight show ${id}, then run /flight replay ${id} --confirm.`,
      }
    }
    const currentWorkspace = await fingerprintWorkspace(ctx.workdir)
    if (currentWorkspace.digest !== entry.workspace.digest && !args.includes("--allow-drift")) {
      return {
        type: "error",
        message: `Workspace fingerprint changed since this failure. Inspect the entry, then add --allow-drift to replay intentionally.`,
      }
    }
    const tool = ToolRegistry.get(entry.tool)
    if (!tool) return { type: "error", message: `Recorded tool is not available: ${entry.tool}` }
    const result = await executeTool(tool, entry.args, {
      sessionId: ctx.sessionId,
      workdir: ctx.workdir,
      provider: ctx.provider,
      model: ctx.model,
      signal: new AbortController().signal,
    })
    if (result.error) {
      return {
        type: "error",
        message: `Replay reproduced the failure:\n${result.error}${result.output ? `\n\n${result.output}` : ""}`,
      }
    }
    return { type: "text", content: `Replay passed for ${entry.id}.\n\n${result.output}` }
  },
}]

async function listFailures(workdir: string, sessionId: string): Promise<CommandResult> {
  const entries = await listFlightFailures(workdir, sessionId, 20)
  if (entries.length === 0) return { type: "text", content: "No tool failures have been recorded for this session." }
  const lines = entries.map((entry) => {
    const time = new Date(entry.recordedAt).toLocaleTimeString()
    return `  ${entry.id}  ${time}  ${entry.tool.padEnd(16)} ${entry.replayPolicy.padEnd(7)} ${oneLine(entry.error, 80)}`
  })
  return { type: "text", content: ["── Failure Flight Recorder ─────────────────────", ...lines].join("\n") }
}

function oneLine(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}
