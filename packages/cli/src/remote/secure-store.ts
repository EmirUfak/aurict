/**
 * Remote — secure local storage.
 *
 * Auth tokens and device signing keys are stored under the process-owned
 * remote state directory with 0600 file permissions. Desktop sets a dedicated
 * remote state root; CLI falls back to the canonical core state directory.
 */

import { existsSync, unlinkSync } from "fs"
import { join } from "path"
import { coreStatePath } from "@aurict/core/storage/paths"
import { readJsonFileSync, writeJsonFileAtomicSync } from "@aurict/core/storage/persisted-json"

function resolveRemoteDir(): string {
  return process.env.AURICT_REMOTE_STATE_DIR?.trim() || coreStatePath("remote")
}

export function remoteDir(): string {
  return resolveRemoteDir()
}

export function remoteFilePath(filename: string, directory = resolveRemoteDir()): string {
  return join(directory, filename)
}

export function readSecureJson<T>(filename: string, directory = resolveRemoteDir()): T | null {
  const path = remoteFilePath(filename, directory)
  return readJsonFileSync<T>(path, { optional: true, description: "secure remote state" }) ?? null
}

export function writeSecureJson(filename: string, data: unknown, directory = resolveRemoteDir()): void {
  const path = remoteFilePath(filename, directory)
  writeJsonFileAtomicSync(path, data, { mode: 0o600 })
}

export function deleteSecureFile(filename: string): void {
  const path = remoteFilePath(filename)
  if (!existsSync(path)) return
  unlinkSync(path)
}
