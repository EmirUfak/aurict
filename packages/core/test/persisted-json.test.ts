import { afterEach, describe, expect, it } from "bun:test"
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import {
  PersistedJsonError,
  readJsonFileSync,
  restoreJsonBackupSync,
  writeJsonFileAtomicSync,
} from "../src/storage/persisted-json.js"

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe("persisted JSON", () => {
  it("distinguishes a missing optional file from malformed data", () => {
    const path = tempPath()
    expect(readJsonFileSync(path, { optional: true })).toBeUndefined()
    writeFileSync(path, "{broken", "utf8")
    expect(() => readJsonFileSync(path, { optional: true })).toThrow(PersistedJsonError)
  })

  it("atomically replaces data, preserves a backup, and applies private permissions", () => {
    const path = tempPath()
    writeJsonFileAtomicSync(path, { version: 1 }, { backup: true, mode: 0o600 })
    writeJsonFileAtomicSync(path, { version: 2 }, { backup: true, mode: 0o600 })

    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ version: 2 })
    expect(JSON.parse(readFileSync(`${path}.bak`, "utf8"))).toEqual({ version: 1 })
    if (process.platform !== "win32") expect(statSync(path).mode & 0o777).toBe(0o600)
    expect(readdirSync(dirname(path)).some(entry => entry.endsWith(".tmp"))).toBe(false)
  })

  it("restores an explicit backup without silently masking corruption", () => {
    const path = tempPath()
    writeJsonFileAtomicSync(path, { value: "old" }, { backup: true })
    writeJsonFileAtomicSync(path, { value: "new" }, { backup: true })
    writeFileSync(path, "not-json", "utf8")
    expect(() => readJsonFileSync(path)).toThrow("Malformed")

    restoreJsonBackupSync(path)
    expect(readJsonFileSync(path)).toEqual({ value: "old" })
  })
})

function tempPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "aurict-persisted-json-"))
  dirs.push(dir)
  return join(dir, "state.json")
}
