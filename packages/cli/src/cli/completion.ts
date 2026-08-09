import { CLI_COMMANDS } from "./commands.js"

export type SupportedShell = "bash" | "zsh" | "fish" | "powershell"

export function renderCompletion(shell: string): string {
  if (!isSupportedShell(shell)) throw new Error(`Unsupported shell '${shell}'; expected bash, zsh, fish, or powershell`)
  const commands = CLI_COMMANDS.filter(command => command.name !== "chat" && !command.hidden).map(command => command.name)
  const rootOptions = ["--help", "--version", "--provider", "--model", "--system", "--undercover", "--stream", "--no-stream", "--format", "--audience", "--quiet"]
  if (shell === "bash") {
    return `_aurict_complete() {\n  local cur="${"${COMP_WORDS[COMP_CWORD]}"}"\n  COMPREPLY=( $(compgen -W '${[...commands, ...rootOptions].join(" ")}' -- "$cur") )\n}\ncomplete -F _aurict_complete aurict\n`
  }
  if (shell === "zsh") {
    return `#compdef aurict\n_arguments '1:command:(${commands.join(" ")})' '*::arg:->args'\n`
  }
  if (shell === "fish") {
    return commands.map(command => `complete -c aurict -f -a '${command}'`).join("\n") + "\n"
  }
  return `Register-ArgumentCompleter -Native -CommandName aurict -ScriptBlock {\n  param($wordToComplete)\n  '${commands.join(",")}'.Split(',') | Where-Object { $_ -like "$wordToComplete*" }\n}\n`
}

function isSupportedShell(shell: string): shell is SupportedShell {
  return shell === "bash" || shell === "zsh" || shell === "fish" || shell === "powershell"
}
