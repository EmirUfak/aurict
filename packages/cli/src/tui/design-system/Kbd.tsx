/**
 * Design System — Kbd
 *
 * A single-key indicator. Visually represents keyboard shortcuts.
 *
 * Styles:
 * - "boxed":  [Ctrl]  (inside a box)
 * - "key":    ⌃  (as a symbol)
 * - "plain":  Ctrl  (plain text)
 *
 * Platform-aware: ⌘/⌃/⌥ on macOS, Ctrl/Alt/Shift elsewhere.
 */

import React from "react"
import { Box, Text } from "ink"
import { useTheme } from "../../utils/theme.js"

// ── Platform detection ────────────────────────────────────────────────────────

export type Platform = "macos" | "linux" | "windows" | "unknown"

export function detectPlatform(): Platform {
  if (process.platform === "darwin") return "macos"
  if (process.platform === "win32")  return "windows"
  if (process.platform === "linux")  return "linux"
  return "unknown"
}

// ── Key symbols ───────────────────────────────────────────────────────────────

export interface KeySymbol {
  ctrl?:    boolean
  shift?:   boolean
  alt?:     boolean
  meta?:    boolean
  super?:   boolean
  key:      string
}

// macOS semboller
const MACOS_SYMBOLS: Record<string, string> = {
  ctrl:    "⌃",
  shift:   "⇧",
  alt:     "⌥",
  meta:    "⌘",
  super:   "⌘",
  enter:   "↵",
  return:  "↵",
  esc:     "⎋",
  escape:  "⎋",
  tab:     "⇥",
  space:   "␣",
  backspace: "⌫",
  delete:  "⌫",
  up:      "↑",
  down:    "↓",
  left:    "←",
  right:   "→",
  pageup:  "⇞",
  pagedown:"⇟",
  home:    "↖",
  end:     "↘",
}

const KEY_DISPLAY: Record<string, string> = {
  " ": "Space",
  "esc": "Esc",
  "escape": "Esc",
  "enter": "Enter",
  "return": "Enter",
  "tab": "Tab",
  "backspace": "⌫",
  "delete": "Del",
  "pageup": "PgUp",
  "pagedown": "PgDn",
  "up": "↑",
  "down": "↓",
  "left": "←",
  "right": "→",
  "home": "Home",
  "end": "End",
}

// ── Parse key string (e.g. "ctrl+shift+r" or "ctrl+x ctrl+k") ────────────────

export function parseKeyString(s: string): KeySymbol | null {
  const parts = s.toLowerCase().split("+").map(p => p.trim())
  if (parts.length === 0) return null

  const sym: KeySymbol = { key: "" }
  for (const p of parts) {
    if (p === "ctrl" || p === "control" || p === "c-") sym.ctrl = true
    else if (p === "shift" || p === "s-") sym.shift = true
    else if (p === "alt" || p === "option" || p === "m-") sym.alt = true
    else if (p === "meta" || p === "cmd" || p === "command") sym.meta = true
    else if (p === "super") sym.super = true
    else sym.key = p
  }
  return sym
}

// ── Format single key ─────────────────────────────────────────────────────────

export function formatKey(sym: KeySymbol, platform: Platform = detectPlatform()): string {
  if (platform === "macos") {
    const parts: string[] = []
    if (sym.ctrl)    parts.push(MACOS_SYMBOLS.ctrl!)
    if (sym.alt)     parts.push(MACOS_SYMBOLS.alt!)
    if (sym.shift)   parts.push(MACOS_SYMBOLS.shift!)
    if (sym.meta || sym.super) parts.push(MACOS_SYMBOLS.meta!)
    const k = sym.key.toLowerCase()
    parts.push(MACOS_SYMBOLS[k] ?? sym.key.toUpperCase())
    return parts.join("")
  }

  // Linux/Windows: "Ctrl+Shift+R"
  const parts: string[] = []
  if (sym.ctrl)    parts.push("Ctrl")
  if (sym.alt)     parts.push("Alt")
  if (sym.shift)   parts.push("Shift")
  if (sym.meta)    parts.push("Meta")
  if (sym.super)   parts.push("Super")
  const k = sym.key.toLowerCase()
  parts.push(KEY_DISPLAY[k] ?? sym.key.toUpperCase())
  return parts.join("+")
}

// ── Format key chord (e.g. "ctrl+x ctrl+k" → "C-x C-k") ──────────────────────

export function formatChord(input: string, platform: Platform = detectPlatform()): string {
  const chords = input.split(" ").filter(s => s.length > 0)
  return chords.map(c => {
    const sym = parseKeyString(c)
    if (!sym) return c
    return formatKey(sym, platform)
  }).join(" ")
}

// ── Kbd component (single key) ───────────────────────────────────────────────────

export type KbdStyle = "boxed" | "key" | "plain"

export interface KbdProps {
  k?:       string    // shortcut string, e.g. "ctrl+r"
  sym?:     KeySymbol // a direct symbol
  style?:   KbdStyle
  platform?: Platform
  color?:   string
  uppercase?: boolean  // uppercase on Linux/Windows
}

export function Kbd({ k, sym, style = "boxed", platform, color, uppercase }: KbdProps) {
  const theme = useTheme()
  const c = color ?? theme.accent
  const pf = platform ?? detectPlatform()
  const s = sym ?? (k ? parseKeyString(k) : null)
  if (!s) return null

  // Key style: symbol only (macOS)
  if (style === "key") {
    const formatted = formatKey(s, pf)
    return (
      <Text color={c} bold>
        {formatted}
      </Text>
    )
  }

  // Plain: plain text
  if (style === "plain") {
    const formatted = formatKey(s, pf)
    return <Text color={c}>{formatted}</Text>
  }

  // Boxed: a separate box for each modifier
  const parts: React.ReactNode[] = []
  if (s.ctrl)  parts.push(<KbdBox key="ctrl"  color={c}>{pf === "macos" ? "⌃" : "Ctrl"}</KbdBox>)
  if (s.alt)   parts.push(<KbdBox key="alt"   color={c}>{pf === "macos" ? "⌥" : "Alt"}</KbdBox>)
  if (s.shift) parts.push(<KbdBox key="shift" color={c}>{pf === "macos" ? "⇧" : "Shift"}</KbdBox>)
  if (s.meta || s.super) parts.push(<KbdBox key="meta" color={c}>{pf === "macos" ? "⌘" : "Meta"}</KbdBox>)

  const keyText = (() => {
    const k = s.key.toLowerCase()
    if (KEY_DISPLAY[k]) {
      // Special key (Esc, Enter, ↑, etc.) — already has a symbol/label
      return KEY_DISPLAY[k]
    }
    if (k === "space") return "Space"
    if (k === "+") return "+"
    if (k === "-") return "-"
    return uppercase || pf !== "macos" ? s.key.toUpperCase() : s.key
  })()

  parts.push(<KbdBox key="key" color={c} primary>{keyText}</KbdBox>)

  return (
    <Box>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && pf === "macos" ? null : <Text> </Text>}
          {p}
        </React.Fragment>
      ))}
    </Box>
  )
}

function KbdBox({ color, primary, children }: { color: string; primary?: boolean; children: React.ReactNode }) {
  const theme = useTheme()
  return (
    <Box
      borderStyle="round"
      borderColor={color}
      paddingX={1}
    >
      <Text color={primary ? color : theme.textPrimary} bold={primary === true}>
        {children}
      </Text>
    </Box>
  )
}

// ── KeyHint: a shortcut indicator tied to an action ───────────────────────────────

export interface KeyHintProps {
  /** Either a shortcut string OR a key string (raw) */
  keys?:      string
  /** Optional action label, e.g. "search" */
  action?:    string
  style?:     KbdStyle
  platform?:  Platform
  format?:    "key+action" | "key-only" | "action-only"
}

export function KeyHint({ keys, action, style = "boxed", platform, format = "key+action" }: KeyHintProps) {
  const theme = useTheme()
  const pf = platform ?? detectPlatform()

  // Boxed mode: everything inline
  if (format === "key+action" && keys) {
    return (
      <Box>
        <Kbd k={keys} style={style} platform={pf} />
        {action && (
          <>
            <Text> </Text>
            <Text color={theme.textDim}>{action}</Text>
          </>
        )}
      </Box>
    )
  }

  if (format === "key-only" && keys) {
    return <Kbd k={keys} style={style} platform={pf} />
  }

  if (format === "action-only" && action) {
    return <Text color={theme.textDim}>{action}</Text>
  }

  return null
}
