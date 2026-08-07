import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { runPipeCommand } from "../src/headless/pipe.js"

let stdout = ""
let stderr = ""
let originalStdoutWrite: typeof process.stdout.write
let originalStderrWrite: typeof process.stderr.write

beforeEach(() => {
  stdout = ""
  stderr = ""
  originalStdoutWrite = process.stdout.write.bind(process.stdout)
  originalStderrWrite = process.stderr.write.bind(process.stderr)
  process.stdout.write = ((chunk: string | Uint8Array) => { stdout += chunk.toString(); return true }) as typeof process.stdout.write
  process.stderr.write = ((chunk: string | Uint8Array) => { stderr += chunk.toString(); return true }) as typeof process.stderr.write
})

afterEach(() => {
  process.stdout.write = originalStdoutWrite
  process.stderr.write = originalStderrWrite
})

describe("pipe output contract", () => {
  it("captures the selected provider and model in one successful JSON result", async () => {
    const exitCode = await runPipeCommand({
      workdir: process.cwd(),
      input: "hello",
      format: "json",
      audience: "agent",
      quiet: false,
    }, {
      runAgent: async options => {
        options.onModelSelected?.({ provider: "selected", model: "selected-model", mode: "auto" })
        return {
          text: "done",
          tokens: { input: 2, output: 1, cacheRead: 0, cacheWrite: 0, reasoning: 0 },
          runtime: { runId: "run-1", state: { phase: "completed" } },
        } as never
      },
    })

    expect(exitCode).toBe(0)
    expect(stderr).toBe("")
    expect(JSON.parse(stdout)).toMatchObject({
      schema: "aurict.pipe/v1",
      status: "completed",
      run_id: "run-1",
      provider: "selected",
      model: "selected-model",
      text: "done",
    })
  })

  it("returns non-zero and keeps JSON stdout machine-readable on infrastructure failure", async () => {
    const exitCode = await runPipeCommand({
      provider: "test",
      model: "test-model",
      workdir: process.cwd(),
      input: "hello",
      format: "json",
      audience: "agent",
      quiet: false,
    }, {
      runAgent: async () => { throw new Error("provider unavailable") },
    })

    expect(exitCode).toBe(1)
    expect(stderr).toBe("")
    expect(JSON.parse(stdout)).toEqual({
      schema: "aurict.pipe/v1",
      status: "infrastructure_error",
      provider: "test",
      model: "test-model",
      error: { message: "provider unavailable" },
    })
  })

  it("writes text failures only to stderr", async () => {
    const exitCode = await runPipeCommand({
      provider: "test",
      model: "test-model",
      workdir: process.cwd(),
      input: "hello",
      format: "text",
      audience: "human",
      quiet: false,
    }, {
      runAgent: async () => { throw new Error("provider unavailable") },
    })

    expect(exitCode).toBe(1)
    expect(stdout).toBe("")
    expect(stderr).toContain("provider unavailable")
  })
})
