import type { CommandDef } from "./types.js"

export class SlashCommandSyntaxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SlashCommandSyntaxError"
  }
}

export function tokenizeSlashCommand(body: string): string[] {
  const tokens: string[] = []
  let token = ""
  let quote: "'" | '"' | null = null
  let escaping = false
  let started = false

  for (const character of body) {
    if (escaping) {
      token += character
      escaping = false
      started = true
      continue
    }
    if (character === "\\") {
      escaping = true
      started = true
      continue
    }
    if (quote) {
      if (character === quote) quote = null
      else token += character
      started = true
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      started = true
      continue
    }
    if (/\s/.test(character)) {
      if (started) {
        tokens.push(token)
        token = ""
        started = false
      }
      continue
    }
    token += character
    started = true
  }

  if (escaping) throw new SlashCommandSyntaxError("Command cannot end with an escape character.")
  if (quote) throw new SlashCommandSyntaxError(`Unclosed ${quote} quote in command.`)
  if (started) tokens.push(token)
  return tokens
}

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex]
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1]! + 1,
        previous[rightIndex]! + 1,
        previous[rightIndex - 1]! + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      )
    }
    previous.splice(0, previous.length, ...current)
  }
  return previous[right.length]!
}

export function suggestSlashCommands(input: string, commands: ReadonlyArray<CommandDef>, limit = 3): string[] {
  const query = input.toLowerCase()
  return commands
    .map((command) => {
      const names = [command.name, ...(command.aliases ?? [])]
      const distance = Math.min(...names.map((name) => editDistance(query, name.toLowerCase())))
      return { name: command.name, distance }
    })
    .filter((candidate) => candidate.distance <= Math.max(2, Math.floor(query.length / 3)))
    .sort((left, right) => left.distance - right.distance || left.name.localeCompare(right.name))
    .slice(0, Math.max(0, limit))
    .map((candidate) => candidate.name)
}
