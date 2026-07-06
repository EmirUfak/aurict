import { spawnSync } from "node:child_process"
import type { KeyStore, KeystoreCapability } from "./types.js"
import { KEYSTORE_SERVICE } from "./types.js"

/**
 * macOS Keychain — `/usr/bin/security` CLI wrap'ı.
 *
 * KeyStore arayüzü async; sync spawnSync ile implement edilir (CLI milisaniye
 * seviyesinde çalışır, event loop'u bloke etmez). Headless CI'da keychain
 * kilitli → `available()` false.
 */

const SECURITY = "/usr/bin/security"

interface SyncRun {
  ok:   boolean
  out:  string
  err:  string
}

function run(args: string[], stdin?: string): SyncRun {
  const result = spawnSync(SECURITY, args, {
    input: stdin,
    encoding: "utf8",
  })
  const status = result.status ?? 1
  return {
    ok:  status === 0,
    out: (result.stdout ?? "").trim(),
    err: (result.stderr ?? "").trim(),
  }
}

let cachedAvailable: boolean | null = null

function probe(): boolean {
  if (cachedAvailable !== null) return cachedAvailable
  cachedAvailable = run(["-v"]).ok
  return cachedAvailable
}

export const macosKeychain: KeyStore = {
  async available() {
    if (process.platform !== "darwin") return false
    return probe()
  },

  async get(key) {
    if (!probe()) return null
    const r = run(["find-generic-password", "-s", KEYSTORE_SERVICE, "-a", key, "-w"])
    return r.ok ? r.out : null
  },

  async set(key, value) {
    if (!probe()) return false
    run(["delete-generic-password", "-s", KEYSTORE_SERVICE, "-a", key])
    const r = run(
      ["add-generic-password", "-s", KEYSTORE_SERVICE, "-a", key, "-w", value],
    )
    return r.ok
  },

  async delete(key) {
    if (!probe()) return false
    run(["delete-generic-password", "-s", KEYSTORE_SERVICE, "-a", key])
    return true
  },
}

export async function macosKeystoreCapability(): Promise<KeystoreCapability> {
  const ok = process.platform === "darwin" && await macosKeychain.available().catch(() => false)
  return {
    backend:   "macos-keychain",
    label:     "macOS Keychain",
    available: ok === true,
    reason:    ok === true ? undefined : (process.platform !== "darwin" ? "platform mismatch" : "keychain locked / security CLI unavailable"),
  }
}