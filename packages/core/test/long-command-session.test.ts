import { afterEach, describe, expect, it } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ptyManager } from "../src/pty/manager.js"
import { bashTool } from "../src/tool/built-in/bash.js"

const directories: string[] = []

afterEach(async () => {
  ptyManager.cleanup()
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe("durable command sessions", () => {
  it("keeps completed output addressable after its in-memory session is cleaned up", async () => {
    const workdir = await mkdtemp(join(tmpdir(), "aurict-process-session-"))
    directories.push(workdir)
    const session = await ptyManager.create("sh", ["-c", "printf durable-output"], workdir)

    await ptyManager.wait(session.id, 5_000)
    ptyManager.cleanup()

    const recovered = await ptyManager.readOutput(session.id, workdir)
    expect(recovered?.status).toBe("exited")
    expect(recovered?.outputBuffer).toBe("durable-output")
    expect(recovered?.outputChars).toBe("durable-output".length)
  })

  it("does not expose a durable session to another owner session", async () => {
    const workdir = await mkdtemp(join(tmpdir(), "aurict-process-session-"))
    directories.push(workdir)
    const session = await ptyManager.create("sh", ["-c", "printf private-output"], workdir, {}, { ownerSessionId: "owner-a" })

    await ptyManager.wait(session.id, 5_000)
    ptyManager.cleanup()

    expect(await ptyManager.readOutput(session.id, workdir, "owner-b")).toBeUndefined()
    expect((await ptyManager.readOutput(session.id, workdir, "owner-a"))?.outputBuffer).toBe("private-output")
  })

  it("returns a completed background command through the bash output action", async () => {
    const workdir = await mkdtemp(join(tmpdir(), "aurict-process-session-"))
    directories.push(workdir)
    const context = { workdir, sessionId: "bash-owner", signal: new AbortController().signal }
    const started = await bashTool.execute({ action: "background", command: "printf bash-output" }, context)
    const sessionId = /Session ID: ([a-f0-9-]+)/i.exec(started.output)?.[1]
    expect(sessionId).toBeDefined()
    if (!sessionId) throw new Error("Background command did not return a session ID")

    const finished = await ptyManager.wait(sessionId, 5_000)
    expect(finished.timedOut).not.toBe(true)
    ptyManager.cleanup()
    const output = await bashTool.execute({ action: "output", sessionId }, context)
    expect(output.output).toContain("bash-output")
    expect(output.output).toContain("Command:")
  })
})
