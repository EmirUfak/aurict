import { describe, expect, it } from "bun:test"
import { allCommands, getCommand, parseSlashCommand, suggestCommands } from "../src/commands/registry.js"

describe("slash command registry", () => {
  it("owns every command name and alias exactly once", () => {
    const owners = new Map<string, string>()
    for (const command of allCommands()) {
      for (const name of [command.name, ...(command.aliases ?? [])]) {
        expect(owners.get(name)).toBeUndefined()
        owners.set(name, command.name)
      }
    }
  })

  it("keeps help on the conventional question-mark alias", () => {
    expect(getCommand("?")?.name).toBe("help")
    expect(getCommand("BTW")?.name).toBe("btw")
  })

  it("returns defensive command lists and parses case-insensitively", () => {
    const first = allCommands()
    first.length = 0
    expect(allCommands().length).toBeGreaterThan(0)
    expect(parseSlashCommand("/STATUS  now")).toEqual({ cmd: "status", args: ["now"] })
  })

  it("parses quoted and escaped arguments without losing spaces", () => {
    expect(parseSlashCommand('/watch "src/my file.ts" "run tests"')).toEqual({
      cmd: "watch",
      args: ["src/my file.ts", "run tests"],
    })
    expect(parseSlashCommand("/template save note hello\\ world")).toEqual({
      cmd: "template",
      args: ["save", "note", "hello world"],
    })
    expect(() => parseSlashCommand('/watch "unfinished')).toThrow("Unclosed")
  })

  it("suggests nearby canonical command names", () => {
    expect(suggestCommands("docter", 1)).toEqual(["doctor"])
    expect(suggestCommands("definitely-not-a-command")).toEqual([])
  })
})
