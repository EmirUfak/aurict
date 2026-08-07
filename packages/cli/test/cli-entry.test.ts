import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const repositoryRoot = join(import.meta.dir, "../../..")
const entrypoint = join(repositoryRoot, "packages/cli/src/index.ts")
const recipeFixture = join(import.meta.dir, "fixtures/bash-recipe.json")
let stateDir: string

beforeEach(() => {
  stateDir = mkdtempSync(join(tmpdir(), "aurict-cli-entry-"))
})

afterEach(() => {
  rmSync(stateDir, { recursive: true, force: true })
})

describe("root CLI entrypoint", () => {
  it("reports version and generates completion without bootstrapping the TUI", async () => {
    const version = await runCli(["version", "--json"])
    expect(version.exitCode).toBe(0)
    expect(version.stderr).toBe("")
    expect(JSON.parse(version.stdout).version).toMatch(/^\d+\.\d+\.\d+/)

    const completion = await runCli(["completion", "zsh"])
    expect(completion.exitCode).toBe(0)
    expect(completion.stdout).toStartWith("#compdef aurict")
    expect(completion.stderr).toBe("")
  })

  it("keeps usage errors machine-readable when JSON is requested", async () => {
    const result = await runCli(["docter", "--format", "json"])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe("")
    expect(JSON.parse(result.stdout)).toMatchObject({
      schema: "aurict.cli.error/v1",
      status: "usage_error",
      error: { message: "Unknown command: docter" },
    })
  })

  it("keeps empty pipe failures machine-readable and free of bootstrap output", async () => {
    const result = await runCli(["--format", "json", "--audience", "agent"], "")
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe("")
    expect(JSON.parse(result.stdout)).toEqual({
      schema: "aurict.pipe/v1",
      status: "infrastructure_error",
      provider: "unknown",
      model: "unknown",
      error: { message: "No input received" },
    })
  })

  it("reports corrupt persisted config through the pipe JSON contract", async () => {
    writeFileSync(join(stateDir, "config.json"), "{broken")
    const result = await runCli(["--format", "json", "--audience", "agent"], "hello")
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toBe("")
    expect(JSON.parse(result.stdout)).toMatchObject({
      schema: "aurict.pipe/v1",
      status: "infrastructure_error",
      error: { message: expect.stringContaining("Malformed Aurict configuration") },
    })
  })

  it("runs a recipe with one JSON document on stdout and no TUI bootstrap", async () => {
    const result = await runCli(["run", recipeFixture, "--format", "json", "--audience", "agent"])
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe("")
    expect(JSON.parse(result.stdout)).toMatchObject({
      schema: "aurict.recipe/v1",
      status: "completed",
      recipe: { name: "CLI contract fixture" },
      steps: [{ name: "print result", output: "recipe-ok" }],
    })
  })
})

async function runCli(args: string[], input?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const processHandle = Bun.spawn({
    cmd: [process.execPath, entrypoint, ...args],
    cwd: repositoryRoot,
    env: {
      ...process.env,
      AURICT_STATE_DIR: stateDir,
      AURICT_REMOTE_STATE_DIR: join(stateDir, "remote"),
    },
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  })
  processHandle.stdin.write(input ?? "")
  processHandle.stdin.end()
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
    processHandle.exited,
  ])
  return { stdout, stderr, exitCode }
}
