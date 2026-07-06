import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, chmodSync, accessSync, constants } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import type { KeyStore, KeystoreCapability } from "./types.js"

/**
 * Plain-file fallback — `~/.aurict/keys.json` (chmod 0600).
 *
 * Native OS depoları erişilemezse (headless CI, container, readonly HOME)
 * API key sakımı için kullanılır. Bu güvenli değil (plain-text disk) ama
 * `~/.aurict/config.json`'da düz durmasından daha iyi: ayrı dosya, 0600.
 */

const FILE_MODE = 0o600

function filepath(): string {
  return join(homedir(), ".aurict", "keys.json")
}

function ensureDir(): void {
  const dir = join(homedir(), ".aurict")
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function read(): Record<string, string> {
  const p = filepath()
  if (!existsSync(p)) return {} as Record<string, string>
  try {
    const raw = readFileSync(p, "utf8").trim()
    if (!raw) return {} as Record<string, string>
    const obj = JSON.parse(raw)
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return {} as Record<string, string>
    return obj as Record<string, string>
  } catch {
    return {} as Record<string, string>
  }
}

function write(data: Record<string, string>): boolean {
  ensureDir()
  const p = filepath()
  try {
    writeFileSync(p, JSON.stringify(data, null, 2), "utf8")
    try { chmodSync(p, FILE_MODE) } catch { /* best-effort */ }
    return true
  } catch {
    return false
  }
}

export const plainFile: KeyStore = {
  async available() { return true },

  async get(key) {
    const data = read()
    return data[key] ?? null
  },

  async set(key, value) {
    const data = read()
    data[key] = value
    return write(data)
  },

  async delete(key) {
    const data = read()
    if (!(key in data)) return true
    delete data[key]
    return write(data)
  },
}

export async function plainKeystoreCapability(): Promise<KeystoreCapability> {
  const p = filepath()
  try {
    if (existsSync(p)) {
      accessSync(p, constants.R_OK | constants.W_OK)
    } else {
      ensureDir()
    }
    return {
      backend:   "plain-file",
      label:     `Plain file fallback (${p}, mode 0600)`,
      available: true,
      reason:    undefined,
    }
  } catch (err) {
    return {
      backend:   "plain-file",
      label:     "Plain file fallback",
      available: false,
      reason:    err instanceof Error ? err.message : String(err),
    }
  }
}

export function __plainFilePathForTests(): string {
  return filepath()
}

export function __plainCleanupForTests(): void {
  const p = filepath()
  if (existsSync(p)) {
    try { unlinkSync(p) } catch { /* ignore */ }
  }
}