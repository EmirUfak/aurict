import { CHAT_COMMAND, CLI_COMMANDS } from "./commands.js"
import type { CliCommandSpec } from "./types.js"
import { CURRENT_VERSION } from "../version.js"

export function renderCliHelp(command: CliCommandSpec = CHAT_COMMAND): string {
  if (command.name !== "chat") return renderCommandHelp(command)
  const lines = [
    `Aurict v${CURRENT_VERSION} — Terminal AI assistant`,
    "",
    "Usage:",
    "  aurict [options]",
    "  aurict <command> [options]",
    "",
    "Commands:",
  ]
  for (const entry of CLI_COMMANDS.filter(item => item.name !== "chat" && !item.hidden)) {
    lines.push(`  ${entry.name.padEnd(12)} ${entry.description}`)
  }
  lines.push("", "Options:", ...renderOptions(command), "", "Run 'aurict <command> --help' for command-specific usage.")
  return `${lines.join("\n")}\n`
}

export function renderCommandHelp(command: CliCommandSpec): string {
  const lines = [
    command.description,
    "",
    "Usage:",
    `  ${command.usage}`,
  ]
  const options = renderOptions(command)
  if (options.length > 0) lines.push("", "Options:", ...options)
  return `${lines.join("\n")}\n`
}

function renderOptions(command: CliCommandSpec): string[] {
  const rows = (command.options ?? []).filter(option => !option.hidden).map(option => {
    const flags = [option.short ? `-${option.short},` : "   ", `--${option.name}${option.kind === "string" ? ` <${option.valueName ?? "value"}>` : ""}`].join(" ")
    return { flags, description: option.description }
  })
  rows.push({ flags: "-h, --help", description: "Show help" })
  if (command.name === "chat") rows.push({ flags: "-v, --version", description: "Show version" })
  const width = Math.max(...rows.map(row => row.flags.length), 0)
  return rows.map(row => `  ${row.flags.padEnd(width)}  ${row.description}`)
}
