import { describe, expect, it } from "bun:test"
import { CHAT_COMMAND, findCliCommand } from "../src/cli/commands.js"
import { CliDispatcher } from "../src/cli/dispatcher.js"
import { renderCliHelp } from "../src/cli/help.js"
import { parseCli } from "../src/cli/parser.js"
import { CliUsageError } from "../src/cli/types.js"

describe("typed root CLI", () => {
  it("keeps chat as the default command and parses typed options", () => {
    const parsed = parseCli(["--provider", "openai", "--format=json", "--no-stream"])
    expect(parsed.command).toBe(CHAT_COMMAND)
    expect(parsed.options).toEqual({ provider: "openai", format: "json", "no-stream": true })
  })

  it("fails loudly for unknown options and missing values", () => {
    try {
      parseCli(["--providre", "openai"])
      throw new Error("expected parseCli to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(CliUsageError)
      expect((error as CliUsageError).suggestion).toBe("Did you mean '--provider'?")
    }
    expect(() => parseCli(["--provider"])).toThrow("requires a value")
    expect(() => parseCli(["doctor", "--audience", "agent"])).toThrow("Unknown option")
  })

  it("suggests the nearest command", () => {
    try {
      parseCli(["docter"])
      throw new Error("expected parseCli to fail")
    } catch (error) {
      expect(error).toBeInstanceOf(CliUsageError)
      expect((error as CliUsageError).suggestion).toBe("Did you mean 'doctor'?")
    }
  })

  it("rejects conflicting flags", () => {
    expect(() => parseCli(["--stream", "--no-stream"])).toThrow("cannot be combined")
    expect(() => parseCli(["run-agent", "task", "--auto-model", "--provider", "openai"])).toThrow("cannot be combined")
  })

  it("validates positional command contracts", () => {
    expect(() => parseCli(["run"])).toThrow("requires recipe")
    expect(() => parseCli(["completion", "zsh"])).not.toThrow()
    expect(() => parseCli(["completion", "nu"])).toThrow("Invalid shell")
  })

  it("generates command help from the same definitions", () => {
    const help = renderCliHelp(findCliCommand("run-agent"))
    expect(help).toContain("aurict run-agent [instruction] [options]")
    expect(help).toContain("--max-cost-usd")
    expect(help).toContain("--events <path|->")
  })

  it("dispatches registered handlers without coupling parsing to execution", async () => {
    const dispatcher = new CliDispatcher().register("doctor", command => command.options["json"] === true ? 7 : 0)
    expect(await dispatcher.dispatch(parseCli(["doctor", "--json"]))).toBe(7)
    expect(await dispatcher.dispatch(parseCli([]))).toBeNull()
  })
})
