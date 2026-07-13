import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { coreStatePath } from "@aurict/core/storage/paths"
import { applyFlags, loadConfig } from "../src/config/loader.js"

let globalPath = ""
let stateDir = ""
let previousStateDir: string | undefined
let savedGlobalConfig: string | null = null
let dirs: string[] = []

beforeAll(() => {
  stateDir = mkdtempSync(join(tmpdir(), "aurict-cli-config-state-"))
  previousStateDir = process.env.AURICT_STATE_DIR
  process.env.AURICT_STATE_DIR = stateDir
  globalPath = coreStatePath("config.json")
  savedGlobalConfig = existsSync(globalPath) ? readFileSync(globalPath, "utf8") : null
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(globalPath, "{}", "utf8")
})

afterEach(() => {
  writeFileSync(globalPath, "{}", "utf8")
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

afterAll(() => {
  if (savedGlobalConfig !== null) {
    writeFileSync(globalPath, savedGlobalConfig, "utf8")
  } else if (existsSync(globalPath)) {
    unlinkSync(globalPath)
  }
  rmSync(stateDir, { recursive: true, force: true })
  if (previousStateDir === undefined) delete process.env.AURICT_STATE_DIR
  else process.env.AURICT_STATE_DIR = previousStateDir
})

describe("CLI config loader", () => {
  it("flattens canonical defaults for CLI bootstrap", () => {
    writeFileSync(globalPath, JSON.stringify({
      defaults: { provider: "anthropic", model: "claude-test" },
    }), "utf8")

    const cfg = loadConfig(projectDir())
    expect(cfg.provider).toBe("anthropic")
    expect(cfg.model).toBe("claude-test")
    expect(cfg.defaults?.provider).toBe("anthropic")
  })

  it("preserves legacy top-level provider/model over canonical defaults", () => {
    writeFileSync(globalPath, JSON.stringify({
      provider: "openai",
      model: "gpt-test",
      defaults: { provider: "anthropic", model: "claude-test" },
    }), "utf8")

    const cfg = loadConfig(projectDir())
    expect(cfg.provider).toBe("openai")
    expect(cfg.model).toBe("gpt-test")
    expect(cfg.defaults?.provider).toBe("anthropic")
  })

  it("keeps CLI-only server config while using core canonical fields", () => {
    const dir = projectDir()
    mkdirSync(join(dir, ".aurict"), { recursive: true })
    writeFileSync(join(dir, ".aurict", "config.json"), JSON.stringify({
      server: { port: 9123 },
      longTaskRuntime: { mode: "shadow" },
    }), "utf8")

    const cfg = loadConfig(dir)
    expect(cfg.server?.port).toBe(9123)
    expect(cfg.longTaskRuntime?.mode).toBe("shadow")
  })

  it("applies CLI flags last", () => {
    const cfg = applyFlags({ provider: "anthropic", model: "claude-test" }, {
      provider: "openai",
      model: "gpt-test",
      stream: false,
    })

    expect(cfg.provider).toBe("openai")
    expect(cfg.model).toBe("gpt-test")
    expect(cfg.stream).toBe(false)
  })
})

function projectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "aurict-cli-config-"))
  dirs.push(dir)
  return dir
}
