import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readSecureJson, remoteFilePath, writeSecureJson } from "../src/remote/secure-store.js"

let remoteStateDir: string

beforeEach(() => {
  remoteStateDir = mkdtempSync(join(tmpdir(), "aurict-secure-store-"))
})

afterEach(() => {
  rmSync(remoteStateDir, { recursive: true, force: true })
})

describe("secure remote state", () => {
  it("distinguishes missing state and writes private atomic JSON", () => {
    expect(readSecureJson("session.json", remoteStateDir)).toBeNull()
    writeSecureJson("session.json", { accessToken: "redacted" }, remoteStateDir)
    expect(readSecureJson("session.json", remoteStateDir)).toEqual({ accessToken: "redacted" })
    if (process.platform !== "win32") {
      expect(statSync(remoteFilePath("session.json", remoteStateDir)).mode & 0o777).toBe(0o600)
    }
  })

  it("fails visibly on malformed secure state", () => {
    writeFileSync(remoteFilePath("session.json", remoteStateDir), "{broken")
    expect(() => readSecureJson("session.json", remoteStateDir)).toThrow("Malformed secure remote state")
  })
})
