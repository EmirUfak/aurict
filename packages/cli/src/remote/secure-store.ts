/**
 * Remote — güvenli yerel depolama.
 *
 * Auth token'ları ve (ileride) cihaz imzalama anahtarları `~/.aurict/remote/`
 * altında, dosya izinleri 0600 (yalnızca sahip okur/yazar) ile saklanır.
 * config.ts'teki `~/.aurict/config.json` deseniyle aynı yaklaşım.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, unlinkSync } from "fs"
import { join } from "path"
import { homedir } from "os"

const REMOTE_DIR = join(homedir(), ".aurict", "remote")

export function remoteDir(): string {
  return REMOTE_DIR
}

export function remoteFilePath(filename: string): string {
  return join(REMOTE_DIR, filename)
}

export function readSecureJson<T>(filename: string): T | null {
  const path = remoteFilePath(filename)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T
  } catch {
    return null
  }
}

export function writeSecureJson(filename: string, data: unknown): void {
  mkdirSync(REMOTE_DIR, { recursive: true })
  const path = remoteFilePath(filename)
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8")
  try { chmodSync(path, 0o600) } catch { /* Windows: no-op */ }
}

export function deleteSecureFile(filename: string): void {
  const path = remoteFilePath(filename)
  if (!existsSync(path)) return
  try { unlinkSync(path) } catch { /* ignore */ }
}
