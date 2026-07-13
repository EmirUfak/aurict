/**
 * Remote — secure local storage.
 *
 * Auth tokens and device signing keys are stored under the process-owned
 * remote state directory with 0600 file permissions. Desktop sets a dedicated
 * remote state root; CLI falls back to the canonical core state directory.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, unlinkSync } from "fs"
import { join } from "path"
import { coreStatePath } from "@aurict/core/storage/paths"

function resolveRemoteDir(): string {
  return process.env.AURICT_REMOTE_STATE_DIR?.trim() || coreStatePath("remote")
}

export function remoteDir(): string {
  return resolveRemoteDir()
}

export function remoteFilePath(filename: string): string {
  return join(resolveRemoteDir(), filename)
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
  mkdirSync(remoteDir(), { recursive: true })
  const path = remoteFilePath(filename)
  writeFileSync(path, JSON.stringify(data, null, 2), "utf8")
  if (process.platform !== "win32") chmodSync(path, 0o600)
}

export function deleteSecureFile(filename: string): void {
  const path = remoteFilePath(filename)
  if (!existsSync(path)) return
  unlinkSync(path)
}
