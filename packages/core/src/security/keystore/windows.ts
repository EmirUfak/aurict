import { spawnSync } from "node:child_process"
import type { KeyStore, KeystoreCapability } from "./types.js"
import { KEYSTORE_SERVICE } from "./types.js"

/**
 * Windows Credential Manager — `cmdkey` + PowerShell'den `Get-StoredCredential`.
 *
 * Target name: `aurict:<key>` (örn. `aurict:anthropic`). `cmdkey` parolayı
 * geri vermediği için okuma PowerShell'dan decode edilir. ~2560 byte değer
 * üst sınırı mevcut; API key'ler tipik olarak bu limite uygun.
 */

function runCmd(args: string[]): { ok: boolean; out: string; err: string } {
  const r = spawnSync("cmdkey", args, { encoding: "utf8" })
  return {
    ok:  (r.status ?? 1) === 0,
    out: (r.stdout ?? "").trim(),
    err: (r.stderr ?? "").trim(),
  }
}

function runPowershell(script: string): { ok: boolean; out: string; err: string } {
  const r = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8" })
  return {
    ok:  (r.status ?? 1) === 0,
    out: (r.stdout ?? "").trim(),
    err: (r.stderr ?? "").trim(),
  }
}

let cachedAvailable: boolean | null = null

function probe(): boolean {
  if (cachedAvailable !== null) return cachedAvailable
  cachedAvailable = runCmd(["/list"]).ok
  return cachedAvailable
}

const targetFor = (key: string) => `${KEYSTORE_SERVICE}:${key}`

export const windowsCredential: KeyStore = {
  async available() {
    if (process.platform !== "win32") return false
    return probe()
  },

  async get(key) {
    if (!probe()) return null
    const target = targetFor(key)
    const script =
      `$c = Get-StoredCredential -Target "${target}" ` +
      `if (-not $c) { exit 1 } ` +
      `$n = New-Object System.Net.NetworkCredential("", $c.Password) ` +
      `Write-Output -NoEnumerate $n.Password`
    const r = runPowershell(script)
    return r.ok && r.out.length > 0 ? r.out : null
  },

  async set(key, value) {
    if (!probe()) return false
    const target = targetFor(key)
    runCmd(["/delete:" + target])
    return runCmd(["/generic:" + target, "/user:" + KEYSTORE_SERVICE, "/pass:" + value]).ok
  },

  async delete(key) {
    if (!probe()) return false
    runCmd(["/delete:" + targetFor(key)])
    return true
  },
}

export async function windowsKeystoreCapability(): Promise<KeystoreCapability> {
  const ok = process.platform === "win32" && await windowsCredential.available().catch(() => false)
  return {
    backend:   "windows-credential",
    label:     "Windows Credential Manager",
    available: ok === true,
    reason:    ok === true ? undefined : (process.platform !== "win32" ? "platform mismatch" : "cmdkey unavailable"),
  }
}