import { spawnSync } from "node:child_process"
import type { KeyStore, KeystoreCapability } from "./types.js"
import { KEYSTORE_SERVICE } from "./types.js"

/**
 * Linux Secret Service — `secret-tool` CLI wrap'ı (libsecret-tools).
 *
 *   `secret-tool store --label='aurict' service aurict account <key>`  (stdin'den parola)
 *   `secret-tool lookup service aurict account <key>`
 *   `secret-tool clear service aurict account <key>`
 *
 * GNOME Keyring veya KDE Wallet'a gider. Headless sunucularda `secret-tool`
 * ya D-Bus oturumu olmadığında ya araç yüklü olmadığından erişilemez →
 * `available()` false. Stdin üzerinden parola — `ps` degrade etmesin diye
 * `--password=` flag kullanılmıyor.
 */

function run(args: string[], stdin?: string): { ok: boolean; out: string; err: string } {
  const r = spawnSync("secret-tool", args, { input: stdin, encoding: "utf8" })
  return {
    ok:  (r.status ?? 1) === 0,
    out: (r.stdout ?? "").trim(),
    err: (r.stderr ?? "").trim(),
  }
}

let cachedAvailable: boolean | null = null

function probe(): boolean {
  if (cachedAvailable !== null) return cachedAvailable
  cachedAvailable = run(["--version"]).ok
  return cachedAvailable
}

export const linuxSecretService: KeyStore = {
  async available() {
    if (process.platform !== "linux") return false
    return probe()
  },

  async get(key) {
    if (!probe()) return null
    const r = run(["lookup", "service", KEYSTORE_SERVICE, "account", key])
    return r.ok ? r.out : null
  },

  async set(key, value) {
    if (!probe()) return false
    const r = run(
      ["store", "--label='aurict'", "service", KEYSTORE_SERVICE, "account", key],
      value,
    )
    return r.ok
  },

  async delete(key) {
    if (!probe()) return false
    run(["clear", "service", KEYSTORE_SERVICE, "account", key])
    return true
  },
}

export async function linuxKeystoreCapability(): Promise<KeystoreCapability> {
  const ok = process.platform === "linux" && await linuxSecretService.available().catch(() => false)
  return {
    backend:   "linux-secret-service",
    label:     "Linux Secret Service (GNOME Keyring / KDE Wallet)",
    available: ok === true,
    reason:    ok === true ? undefined : (process.platform !== "linux" ? "platform mismatch" : "secret-tool unavailable or D-Bus session missing"),
  }
}