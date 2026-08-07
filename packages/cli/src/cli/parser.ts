import { CHAT_COMMAND, CLI_COMMANDS, findCliCommand } from "./commands.js"
import { CliUsageError, type CliCommandSpec, type CliOptionSpec, type ParsedCliCommand } from "./types.js"

const ROOT_HELP = new Set(["--help", "-h"])
const ROOT_VERSION = new Set(["--version", "-v"])

export function parseCli(argv: readonly string[]): ParsedCliCommand {
  if (argv.length === 0) return parsed(CHAT_COMMAND, [], [], false)
  const first = argv[0]!
  if (ROOT_HELP.has(first)) return parsed(CHAT_COMMAND, [], [], true)
  if (ROOT_VERSION.has(first)) return parsed(requireCommand("version"), [], [], false)

  const explicit = !first.startsWith("-") ? findCliCommand(first) : undefined
  if (!first.startsWith("-") && !explicit) {
    const suggestion = suggestCliCommand(first)
    throw new CliUsageError(
      `Unknown command: ${first}`,
      suggestion ? `Did you mean '${suggestion}'?` : "Run 'aurict --help' to list commands.",
    )
  }

  const command = explicit ?? CHAT_COMMAND
  const rawArgs = explicit ? argv.slice(1) : argv
  return parseCommand(command, rawArgs)
}

function parseCommand(command: CliCommandSpec, argv: readonly string[]): ParsedCliCommand {
  const options: Record<string, string | boolean> = {}
  const positionals: string[] = []
  let helpRequested = false

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!
    if (arg === "--") {
      positionals.push(...argv.slice(index + 1))
      break
    }
    if (ROOT_HELP.has(arg)) {
      helpRequested = true
      continue
    }
    if (!arg.startsWith("-")) {
      positionals.push(arg)
      continue
    }

    const [flag, inlineValue] = splitInlineValue(arg)
    const option = findOption(command, flag)
    if (!option) {
      const suggestion = suggestOption(command, flag)
      throw new CliUsageError(
        `Unknown option for '${command.name}': ${flag}`,
        suggestion ? `Did you mean '${suggestion}'?` : `Run 'aurict ${command.name === "chat" ? "" : `${command.name} `}--help' for usage.`,
      )
    }
    if (option.kind === "boolean") {
      if (inlineValue !== undefined) throw new CliUsageError(`Option --${option.name} does not accept a value`)
      options[option.name] = true
      continue
    }

    const value = inlineValue ?? argv[++index]
    if (!value || value.startsWith("--")) throw new CliUsageError(`Option --${option.name} requires a value`)
    if (option.choices && !option.choices.includes(value)) {
      throw new CliUsageError(`Invalid --${option.name} value '${value}'; expected ${option.choices.join(" or ")}`)
    }
    options[option.name] = value
  }

  if (!helpRequested) validateCommand(command, options, positionals)
  return parsed(command, argv, positionals, helpRequested, options)
}

function validateCommand(
  command: CliCommandSpec,
  options: Readonly<Record<string, string | boolean>>,
  positionals: readonly string[],
): void {
  const min = command.minPositionals ?? 0
  const max = command.maxPositionals ?? Number.POSITIVE_INFINITY
  if (positionals.length < min) {
    throw new CliUsageError(`${command.name} requires ${command.positionalLabel ?? "an argument"}`)
  }
  if (positionals.length > max) {
    throw new CliUsageError(`${command.name} accepts at most ${max} positional argument${max === 1 ? "" : "s"}`)
  }
  if (command.positionalChoices && positionals[0] && !command.positionalChoices.includes(positionals[0])) {
    throw new CliUsageError(
      `Invalid ${command.positionalLabel ?? "argument"} '${positionals[0]}'; expected ${command.positionalChoices.join(" or ")}`,
    )
  }
  for (const option of command.options ?? []) {
    if (options[option.name] === undefined) continue
    for (const conflict of option.conflicts ?? []) {
      if (options[conflict] !== undefined) throw new CliUsageError(`--${option.name} cannot be combined with --${conflict}`)
    }
  }
}

function findOption(command: CliCommandSpec, flag: string): CliOptionSpec | undefined {
  const long = flag.startsWith("--") ? flag.slice(2) : undefined
  const short = /^-[^-]$/.test(flag) ? flag.slice(1) : undefined
  return command.options?.find(option =>
    (long !== undefined && option.name === long)
    || (short !== undefined && option.short === short)
  )
}

function splitInlineValue(arg: string): [string, string | undefined] {
  if (!arg.startsWith("--")) return [arg, undefined]
  const index = arg.indexOf("=")
  return index === -1 ? [arg, undefined] : [arg.slice(0, index), arg.slice(index + 1)]
}

function parsed(
  command: CliCommandSpec,
  rawArgs: readonly string[],
  positionals: readonly string[],
  helpRequested: boolean,
  options: Readonly<Record<string, string | boolean>> = {},
): ParsedCliCommand {
  return { command, rawArgs, positionals, helpRequested, options }
}

function requireCommand(name: string): CliCommandSpec {
  const command = findCliCommand(name)
  if (!command) throw new Error(`CLI command '${name}' is not registered`)
  return command
}

export function suggestCliCommand(input: string): string | undefined {
  return nearest(input, CLI_COMMANDS.filter(command => command.name !== "chat").flatMap(command => [command.name, ...(command.aliases ?? [])]))
}

function suggestOption(command: CliCommandSpec, flag: string): string | undefined {
  const names = (command.options ?? []).flatMap(option => [`--${option.name}`, ...(option.short ? [`-${option.short}`] : [])])
  return nearest(flag, names)
}

function nearest(input: string, candidates: readonly string[]): string | undefined {
  const ranked = candidates
    .map(candidate => ({ candidate, distance: editDistance(input.toLowerCase(), candidate.toLowerCase()) }))
    .sort((left, right) => left.distance - right.distance || left.candidate.localeCompare(right.candidate))
  const best = ranked[0]
  if (!best) return undefined
  const limit = Math.max(2, Math.floor(input.length / 3))
  return best.distance <= limit ? best.candidate : undefined
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i++) {
    let diagonal = previous[0]!
    previous[0] = i
    for (let j = 1; j <= right.length; j++) {
      const above = previous[j]!
      previous[j] = left[i - 1] === right[j - 1]
        ? diagonal
        : Math.min(diagonal, above, previous[j - 1]!) + 1
      diagonal = above
    }
  }
  return previous[right.length]!
}
