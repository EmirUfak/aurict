import { afterEach, describe, expect, it } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { verifyTool } from "../src/tool/built-in/verify.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("verify tool proof metadata", () => {
  it("records an explicit skip instead of a false pass when typecheck is unavailable", async () => {
    const workdir = await temporaryWorkdir()
    const result = await verifyTool.execute({ action: "typecheck" }, context(workdir))
    expect(result.metadata?.verification?.tsc?.status).toBe("skipped")
    expect(result.metadata?.verification?.tsc?.reason).toContain("tsconfig")
  })

  it("records an explicit skip when no test framework exists", async () => {
    const workdir = await temporaryWorkdir()
    const result = await verifyTool.execute({ action: "test" }, context(workdir))
    expect(result.metadata?.verification?.test?.status).toBe("skipped")
    expect(result.output).toContain("Skipped")
  })
})

function context(workdir: string) {
  return {
    sessionId: "verify-proof-test",
    workdir,
    signal: new AbortController().signal,
  }
}

async function temporaryWorkdir(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "aurict-verify-proof-"))
  temporaryDirectories.push(directory)
  return directory
}
