import type { CliCommandHandler, ParsedCliCommand } from "./types.js"

export class CliDispatcher {
  private readonly handlers = new Map<string, CliCommandHandler>()

  register(command: string, handler: CliCommandHandler): this {
    if (this.handlers.has(command)) throw new Error(`CLI handler already registered: ${command}`)
    this.handlers.set(command, handler)
    return this
  }

  async dispatch(parsed: ParsedCliCommand): Promise<number | null> {
    const handler = this.handlers.get(parsed.command.name)
    return handler ? await handler(parsed) : null
  }
}
