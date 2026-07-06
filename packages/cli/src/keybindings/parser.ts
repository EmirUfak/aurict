/**
 * Keybindings — Parser
 *
 * Parses key strings (e.g. "ctrl+shift+up", "shift+tab") into a KeyCombo
 * object. The reverse direction (KeyCombo → display string) is also provided.
 *
 * Syntax:
 *   - "+"-separated modifiers + key name
 *   - Modifiers: ctrl, alt, shift, meta, cmd (alias for mac)
 *   - Key names: a-z, 0-9, f1-f12, enter, escape, tab, space, backspace,
 *                    delete, up, down, left, right, home, end, pageup, pagedown
 */

import type { KeyCombo } from "./types.js"

// ── Key normalization ───────────────────────────────────────────────────────

const KEY_ALIASES: Record<string, string> = {
  esc:      "escape",
  return:   "enter",
  cr:       "enter",
  bs:       "backspace",
  bs2:      "backspace",
  del:      "delete",
  ins:      "insert",
  pgup:     "pageup",
  pgdn:     "pagedown",
  page_up:  "pageup",
  page_down: "pagedown",
  spc:      "space",
  sp:       "space",
  bar:      "|",
  slash:    "/",
  question: "?",
  minus:    "-",
  plus:     "+",
  equal:    "=",
  backtick: "`",
  tilde:    "~",
  exclam:   "!",
  at:       "@",
  hash:     "#",
  dollar:   "$",
  percent:  "%",
  caret:    "^",
  amp:      "&",
  asterisk: "*",
  lparen:   "(",
  rparen:   ")",
  underscore: "_",
}

function normalizeKey(raw: string): string {
  const lower = raw.toLowerCase().trim()
  return KEY_ALIASES[lower] ?? lower
}

function normalizeModifier(mod: string): "ctrl" | "alt" | "shift" | "meta" | null {
  const m = mod.toLowerCase().trim()
  if (m === "ctrl" || m === "control" || m === "ctl") return "ctrl"
  if (m === "alt" || m === "opt" || m === "option")   return "alt"
  if (m === "shift" || m === "shft")                  return "shift"
  if (m === "meta" || m === "cmd" || m === "command" || m === "super" || m === "win") return "meta"
  return null
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Parses a string like "ctrl+shift+up" into a KeyCombo.
 * Returns `null` on failure (invalid syntax).
 */
export function parseKeyString(input: string): KeyCombo | null {
  if (!input || typeof input !== "string") return null
  const parts = input.split("+").map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) return null

  // The last part is the key name, the rest are modifiers
  const keyPart = parts[parts.length - 1]!
  const modifierParts = parts.slice(0, -1)

  // If there's only one part and it's not a modifier, it's just the key
  if (modifierParts.length === 0) {
    const k = normalizeKey(keyPart)
    if (!isValidKey(k)) return null
    return { ctrl: false, alt: false, shift: false, meta: false, key: k }
  }

  // Parse all modifiers
  const result: KeyCombo = { ctrl: false, alt: false, shift: false, meta: false, key: "" }
  for (const mp of modifierParts) {
    const mod = normalizeModifier(mp)
    if (mod === null) return null // unrecognized modifier
    result[mod] = true
  }

  const k = normalizeKey(keyPart)
  if (!isValidKey(k)) return null

  result.key = k
  return result
}

/**
 * Converts a KeyCombo to a display string (e.g. "ctrl+shift+up").
 */
export function formatKeyCombo(combo: KeyCombo): string {
  const parts: string[] = []
  if (combo.ctrl)  parts.push("ctrl")
  if (combo.alt)   parts.push("alt")
  if (combo.shift) parts.push("shift")
  if (combo.meta)  parts.push("meta")
  parts.push(combo.key)
  return parts.join("+")
}

/**
 * Converts Ink's useInput key event into a KeyCombo.
 * Ink: { input: string, key: { upArrow, downArrow, ctrl, shift, ... } }
 */
export function inkKeyEventToCombo(event: {
  input: string
  key: {
    upArrow?:    boolean
    downArrow?:  boolean
    leftArrow?:  boolean
    rightArrow?: boolean
    return?:     boolean
    escape?:     boolean
    tab?:        boolean
    backspace?:  boolean
    delete?:     boolean
    home?:       boolean
    end?:        boolean
    pageUp?:     boolean
    pageDown?:   boolean
    ctrl?:       boolean
    alt?:        boolean
    shift?:      boolean
    meta?:       boolean
  }
}): KeyCombo {
  const k = event.key
  // Special keys
  let keyName = event.input
  if (k.upArrow)     keyName = "up"
  else if (k.downArrow)  keyName = "down"
  else if (k.leftArrow)  keyName = "left"
  else if (k.rightArrow) keyName = "right"
  else if (k.return)     keyName = "enter"
  else if (k.escape)     keyName = "escape"
  else if (k.tab)        keyName = "tab"
  else if (k.backspace)  keyName = "backspace"
  else if (k.delete)     keyName = "delete"
  else if (k.home)       keyName = "home"
  else if (k.end)        keyName = "end"
  else if (k.pageUp)     keyName = "pageup"
  else if (k.pageDown)   keyName = "pagedown"
  else keyName = normalizeKey(keyName)

  return {
    ctrl:  !!k.ctrl,
    alt:   !!k.alt,
    shift: !!k.shift,
    meta:  !!k.meta,
    key:   keyName,
  }
}

/**
 * Checks whether two KeyCombos are equal.
 */
export function keyCombosEqual(a: KeyCombo, b: KeyCombo): boolean {
  return a.ctrl === b.ctrl
    && a.alt === b.alt
    && a.shift === b.shift
    && a.meta === b.meta
    && a.key.toLowerCase() === b.key.toLowerCase()
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function isValidKey(k: string): boolean {
  if (!k) return false
  // Single character: a-z, 0-9, symbols
  if (k.length === 1) return true
  // Function keys
  if (/^f([1-9]|1[0-2])$/i.test(k)) return true
  // Special names
  const validNames = new Set([
    "enter", "escape", "tab", "space", "backspace", "delete", "insert",
    "up", "down", "left", "right", "home", "end", "pageup", "pagedown",
  ])
  return validNames.has(k.toLowerCase())
}
