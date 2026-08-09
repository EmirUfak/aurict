import type { CLIFlags } from "../config/loader.js"
import type { CliOutputAudience, CliOutputFormat } from "../headless/pipe.js"
import type { ParsedCliCommand } from "./types.js"

export interface ChatCliOptions {
  flags: CLIFlags
  format: CliOutputFormat
  audience: CliOutputAudience
  quiet: boolean
}

export function chatOptionsFromParsed(parsed: ParsedCliCommand): ChatCliOptions {
  if (parsed.command.name !== "chat") throw new Error(`Expected chat command, received ${parsed.command.name}`)
  const options = parsed.options
  const stream = options["stream"] === true ? true : options["no-stream"] === true ? false : undefined
  return {
    flags: {
      ...(typeof options["provider"] === "string" ? { provider: options["provider"] } : {}),
      ...(typeof options["model"] === "string" ? { model: options["model"] } : {}),
      ...(typeof options["system"] === "string" ? { system: options["system"] } : {}),
      ...(options["undercover"] === true ? { undercover: true } : {}),
      ...(options["ipc-server"] === true ? { ipcServer: true } : {}),
      ...(stream !== undefined ? { stream } : {}),
    },
    format: options["format"] === "json" ? "json" : "text",
    audience: options["audience"] === "agent" ? "agent" : "human",
    quiet: options["quiet"] === true,
  }
}
