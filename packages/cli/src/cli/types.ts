export type CliOptionKind = "boolean" | "string"

export interface CliOptionSpec {
  name: string
  short?: string
  kind: CliOptionKind
  description: string
  valueName?: string
  choices?: readonly string[]
  conflicts?: readonly string[]
  hidden?: boolean
}

export interface CliCommandSpec {
  name: string
  aliases?: readonly string[]
  description: string
  usage: string
  options?: readonly CliOptionSpec[]
  minPositionals?: number
  maxPositionals?: number
  positionalLabel?: string
  positionalChoices?: readonly string[]
  hidden?: boolean
}

export interface ParsedCliCommand {
  command: CliCommandSpec
  options: Readonly<Record<string, string | boolean>>
  positionals: readonly string[]
  rawArgs: readonly string[]
  helpRequested: boolean
}

export type CliCommandHandler = (command: ParsedCliCommand) => number | Promise<number>

export class CliUsageError extends Error {
  readonly exitCode = 1

  constructor(message: string, readonly suggestion?: string) {
    super(message)
    this.name = "CliUsageError"
  }
}
