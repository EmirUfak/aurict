import { afterEach, describe, expect, it } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ExecutorEvents, executeTool } from "../src/tool/executor.js"
import { PermissionGate } from "../src/permission/store.js"
import { clearFilesystemGrants } from "../src/security/filesystem-grants.js"
import { readTool } from "../src/tool/built-in/read.js"
import { globTool } from "../src/tool/built-in/glob.js"
import { grepTool } from "../src/tool/built-in/grep.js"

const directories: string[] = []

afterEach(async () => {
  clearFilesystemGrants()
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe("external filesystem grants", () => {
  it("requires a direct approval, then permits the approved external directory for the session", async () => {
    const workdir = await mkdtemp(join(tmpdir(), "aurict-workspace-"))
    const outside = await mkdtemp(join(tmpdir(), "aurict-external-"))
    directories.push(workdir, outside)
    const first = join(outside, "first.txt")
    const second = join(outside, "second.txt")
    await writeFile(first, "first")
    await writeFile(second, "second")
    const unsubscribe = ExecutorEvents.on(event => PermissionGate.respond(event.request.id, "allow_directory"))
    try {
      const context = { workdir, sessionId: "grant-test", signal: new AbortController().signal }
      expect((await executeTool(readTool, { path: first }, context)).output).toContain("first")
      expect((await executeTool(readTool, { path: second }, context)).output).toContain("second")
      expect((await executeTool(globTool, { pattern: "*.txt", cwd: outside }, context)).output).toContain("first.txt")
      expect((await executeTool(grepTool, { pattern: "second", path: outside }, context)).output).toContain("second.txt")
    } finally {
      unsubscribe()
    }
  })

  it("never grants sensitive filesystem paths", async () => {
    const workdir = await mkdtemp(join(tmpdir(), "aurict-workspace-"))
    directories.push(workdir)
    const unsubscribe = ExecutorEvents.on(event => PermissionGate.respond(event.request.id, "allow"))
    try {
      const result = await executeTool(readTool, { path: "/etc/shadow" }, {
        workdir,
        sessionId: "grant-sensitive",
        signal: new AbortController().signal,
      })
      expect(result.error).toContain("Sensitive filesystem path")
    } finally {
      unsubscribe()
    }
  })
})
