/**
 * Keybindings — Persistence
 *
 * Stores the user's keybinding overrides in ~/.aurict/keybindings.json.
 * Silently falls back to the defaults if the file is missing or malformed.
 */

import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import type { BindingOverride, KeybindingsConfig } from "./types.js"
import { validateOverride } from "./validate.js"

// ── Paths ────────────────────────────────────────────────────────────────────

const CONFIG_DIR  = path.join(os.homedir(), ".aurict")
const CONFIG_FILE = path.join(CONFIG_DIR, "keybindings.json")

/** Returns the config file path (for tests and inspection). */
export function getKeybindingsPath(): string {
  return CONFIG_FILE
}

// ── Platform detection ───────────────────────────────────────────────────────

export function detectPlatform(): "mac" | "win" | "linux" {
  const p = process.platform
  if (p === "darwin") return "mac"
  if (p === "win32")  return "win"
  return "linux"
}

// ── Load ─────────────────────────────────────────────────────────────────────

export interface LoadResult {
  /** Overrides (action → key string) */
  bindings: BindingOverride
  /** Platform read from the config (optional) */
  platform?: "mac" | "win" | "linux" | undefined
  /** The error, if any */
  error?:   string | undefined
  /** Source file path (undefined if none) */
  source?:  string | undefined
}

/**
 * Loads the user's config file. Returns an empty override if the file
 * doesn't exist. On malformed JSON or a validation error, returns an
 * error but still tries to use the partial override.
 */
export function loadKeybindings(): LoadResult {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { bindings: {}, source: undefined }
  }

  let raw: string
  try {
    raw = fs.readFileSync(CONFIG_FILE, "utf8")
  } catch (e) {
    return {
      bindings: {},
      error: `could not read ${CONFIG_FILE}: ${(e as Error).message}`,
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    return {
      bindings: {},
      error: `invalid JSON in ${CONFIG_FILE}: ${(e as Error).message}`,
    }
  }

  if (typeof parsed !== "object" || parsed === null) {
    return {
      bindings: {},
      error: `${CONFIG_FILE} is not an object`,
    }
  }

  const cfg = parsed as Partial<KeybindingsConfig>

  // Validate
  const override = cfg.bindings ?? {}
  const validation = validateOverride(override)
  if (!validation.valid) {
    return {
      bindings: override,
      platform: cfg.platform,
      error: `validation issues: ${validation.issues.map(i => JSON.stringify(i)).join("; ")}`,
    }
  }

  return {
    bindings: override,
    platform: cfg.platform,
    source: CONFIG_FILE,
  }
}

// ── Save ─────────────────────────────────────────────────────────────────────

export interface SaveResult {
  ok:      boolean
  path?:   string | undefined
  error?:  string | undefined
}

/**
 * Writes the overrides to the file. Performs an atomic write (tmp + rename).
 * Does not corrupt the file on failure.
 */
export function saveKeybindings(
  override: BindingOverride,
  options: { platform?: "mac" | "win" | "linux" } = {},
): SaveResult {
  // Validate first
  const validation = validateOverride(override)
  if (!validation.valid) {
    return {
      ok: false,
      error: `invalid bindings: ${validation.issues.map(i => JSON.stringify(i)).join("; ")}`,
    }
  }

  // Create the directory if it doesn't exist
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }
  } catch (e) {
    return {
      ok: false,
      error: `could not create ${CONFIG_DIR}: ${(e as Error).message}`,
    }
  }

  const cfg: KeybindingsConfig = {
    version: 1,
    bindings: override,
    ...(options.platform !== undefined ? { platform: options.platform } : {}),
  }

  const json = JSON.stringify(cfg, null, 2) + "\n"
  const tmpFile = CONFIG_FILE + ".tmp"

  try {
    fs.writeFileSync(tmpFile, json, "utf8")
    fs.renameSync(tmpFile, CONFIG_FILE)
    return { ok: true, path: CONFIG_FILE }
  } catch (e) {
    // Clean up the tmp file
    let cleanupError: string | undefined
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
    } catch (error) {
      cleanupError = error instanceof Error ? error.message : String(error)
    }
    return {
      ok: false,
      error: `could not write ${CONFIG_FILE}: ${(e as Error).message}${cleanupError ? `; temporary-file cleanup also failed: ${cleanupError}` : ""}`,
    }
  }
}

// ── Reset ────────────────────────────────────────────────────────────────────

/** Deletes the config file (revert to defaults). */
export function resetKeybindings(): boolean {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      fs.unlinkSync(CONFIG_FILE)
    }
    return true
  } catch {
    return false
  }
}
