import { mkdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const LEGACY_STATE_DIR_NAME = '.aurict'

export function legacyCoreStateDir(): string {
  return join(homedir(), LEGACY_STATE_DIR_NAME)
}

/**
 * Writable, process-owned state. Desktop supplies this path so its core data
 * lives under Electron userData; CLI keeps the established ~/.aurict default.
 */
export function coreStateDir(): string {
  const configured = process.env.AURICT_STATE_DIR?.trim()
  return configured ? resolve(configured) : legacyCoreStateDir()
}

/** Read-only packaged catalog/templates. AURICT_DATA_DIR remains a temporary
 * compatibility alias for already-packaged sidecars. */
export function coreAssetDir(): string | undefined {
  const configured = process.env.AURICT_ASSET_DIR?.trim() ?? process.env.AURICT_DATA_DIR?.trim()
  return configured ? resolve(configured) : undefined
}

export function coreStatePath(...segments: string[]): string {
  return join(coreStateDir(), ...segments)
}

export function ensureCoreStateDir(): string {
  const dir = coreStateDir()
  mkdirSync(dir, { recursive: true })
  if (!statSync(dir).isDirectory()) throw new Error(`Core state path is not a directory: ${dir}`)
  return dir
}
