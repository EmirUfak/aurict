import { afterEach, describe, expect, it } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  fingerprintWorkspace,
  listFlightFailures,
  readFlightFailure,
  recordFlightFailure,
} from "../src/diagnostics/flight-recorder.js"
import { executeTool } from "../src/tool/executor.js"
import { ToolRegistry } from "../src/tool/registry.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("failure flight recorder", () => {
  it("redacts secrets and blocks replay when recorded args contain them", async () => {
    const workdir = await temporaryWorkdir()
    const entry = await recordFlightFailure({
      workdir,
      sessionId: "session-1",
      tool: "http_request",
      args: {
        authorization: "Bearer secret-value",
        command: "curl -H 'Authorization: Bearer another-secret' example.com",
      },
      output: "token=output-secret",
      error: "password=error-secret",
      durationMs: 12,
      replayPolicy: "confirm",
      now: 100,
    })
    const serialized = JSON.stringify(entry)
    expect(serialized).not.toContain("secret-value")
    expect(serialized).not.toContain("another-secret")
    expect(serialized).not.toContain("output-secret")
    expect(serialized).not.toContain("error-secret")
    expect(entry.replayPolicy).toBe("blocked")
  })

  it("lists and reads durable failure records", async () => {
    const workdir = await temporaryWorkdir()
    const entry = await recordFlightFailure({
      workdir,
      sessionId: "session-1",
      tool: "read",
      args: { path: "missing.ts" },
      output: "",
      error: "not found",
      durationMs: 3,
      replayPolicy: "safe",
      now: 200,
    })
    expect((await listFlightFailures(workdir, "session-1"))[0]?.id).toBe(entry.id)
    expect(await readFlightFailure(workdir, "session-1", entry.id)).toEqual(entry)
  })

  it("detects dependency-manifest drift", async () => {
    const workdir = await temporaryWorkdir()
    await writeFile(join(workdir, "package.json"), '{"version":"1"}', "utf8")
    const before = await fingerprintWorkspace(workdir)
    await writeFile(join(workdir, "package.json"), '{"version":"2"}', "utf8")
    const after = await fingerprintWorkspace(workdir)
    expect(before.digest).not.toBe(after.digest)
    expect(after.files).toEqual(["package.json"])
  })

  it("records a real failed tool execution automatically", async () => {
    const workdir = await temporaryWorkdir()
    const readTool = ToolRegistry.get("read")
    expect(readTool).toBeDefined()
    const result = await executeTool(readTool!, { path: "missing.ts" }, {
      sessionId: "session-1",
      workdir,
      signal: new AbortController().signal,
    })
    expect(result.error).toBeTruthy()
    const entries = await listFlightFailures(workdir, "session-1")
    expect(entries).toHaveLength(1)
    expect(entries[0]?.tool).toBe("read")
    expect(entries[0]?.replayPolicy).toBe("safe")
  })
})

async function temporaryWorkdir(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "aurict-flight-"))
  temporaryDirectories.push(directory)
  return directory
}
