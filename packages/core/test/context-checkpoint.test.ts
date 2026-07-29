import { afterEach, describe, expect, test } from "bun:test"
import type { CoreMessage } from "ai"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createContextCheckpoint } from "../src/session/context-checkpoint.js"
import { readToolOutputArtifact } from "../src/tool/output-artifacts.js"

let workdir: string | undefined

afterEach(async () => {
  if (workdir) await rm(workdir, { recursive: true, force: true })
  workdir = undefined
})

describe("context checkpoint", () => {
  test("archives the exact source transcript and keeps deterministic evidence", async () => {
    workdir = await mkdtemp(join(tmpdir(), "aurict-context-checkpoint-"))
    const existingHandle = `tool-output:${"a".repeat(64)}`
    const messages: CoreMessage[] = [
      { role: "user", content: "Inspect packages/core/src/agent/loop.ts." },
      {
        role: "assistant",
        content: `Typecheck passed. Full output: ${existingHandle}`,
      },
      {
        role: "assistant",
        content: [{
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "read",
          args: { path: "packages/core/src/session/context-checkpoint.ts" },
        }],
      },
    ]

    const checkpoint = await createContextCheckpoint(messages, {
      workdir,
      sessionId: "session:test",
    })

    expect(checkpoint.archiveHandle).toMatch(/^tool-output:[a-f0-9]{64}$/)
    expect(checkpoint.ledger).toContain("packages/core/src/agent/loop.ts")
    expect(checkpoint.ledger).toContain(existingHandle)
    expect(checkpoint.ledger).toContain("Typecheck passed.")

    const archive = await readToolOutputArtifact({
      workdir,
      sessionId: "session:test",
      handle: checkpoint.archiveHandle!,
    })
    expect(archive.content).toContain("[#1 user]")
    expect(archive.content).toContain("Inspect packages/core/src/agent/loop.ts.")
    expect(archive.content).toContain("[#2 assistant]")
    expect(archive.content).toContain('"toolCallId":"call-1"')
    expect(archive.content).toContain('"path":"packages/core/src/session/context-checkpoint.ts"')
  })
})
