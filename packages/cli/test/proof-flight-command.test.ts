import { afterEach, describe, expect, it } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  buildCompletionProof,
  readCompletionProof,
  recordFlightFailure,
  writeCompletionProof,
} from "@aurict/core"
import { getCommand } from "../src/commands/registry.js"
import type { CommandContext, CommandResult } from "../src/commands/types.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("proof and flight slash commands", () => {
  it("shows completion evidence and persists an explicit waiver", async () => {
    const workdir = await temporaryWorkdir()
    const context = commandContext(workdir)
    const proof = buildCompletionProof({
      sessionId: context.sessionId,
      ledger: {
        objective: "verify the change",
        phase: "verifying",
        openSteps: [],
        changedFiles: ["src/a.ts"],
        verification: { status: "none" },
        recoveryAttempts: [],
        blockers: [],
        lastProgressAt: 1,
      },
      completionGate: { status: "verification_required", shouldAutoContinue: true, reason: "missing", shadowOnly: false },
      now: 100,
    })
    await writeCompletionProof(workdir, proof)
    const command = getCommand("proof")!
    expect(text(await command.handler([], context))).toContain("verification")
    expect(text(await command.handler(["waive", "verification", "runner", "unavailable"], context))).toContain("runner unavailable")
    expect((await readCompletionProof(workdir, context.sessionId))?.status).toBe("passed")
  })

  it("lists, shows, and safely replays a recorded read failure", async () => {
    const workdir = await temporaryWorkdir()
    const context = commandContext(workdir)
    const entry = await recordFlightFailure({
      workdir,
      sessionId: context.sessionId,
      tool: "read",
      args: { path: "missing.ts" },
      output: "",
      error: "file missing",
      durationMs: 2,
      replayPolicy: "safe",
      now: 100,
    })
    const command = getCommand("flight")!
    expect(text(await command.handler([], context))).toContain(entry.id)
    expect(text(await command.handler(["show", entry.id], context))).toContain("file missing")
    expect(text(await command.handler(["replay", entry.id], context))).toContain("reproduced the failure")
  })
})

function text(result: CommandResult): string {
  return result.type === "text" ? result.content : result.type === "error" ? result.message : JSON.stringify(result)
}

function commandContext(workdir: string): CommandContext {
  return {
    sessionId: "proof-flight-test",
    provider: "openai",
    model: "test-model",
    workdir,
  } as unknown as CommandContext
}

async function temporaryWorkdir(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "aurict-proof-flight-command-"))
  temporaryDirectories.push(directory)
  return directory
}
