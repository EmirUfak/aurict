/**
 * Keybindings — Display components
 *
 * Components used to show action → display bindings in the UI.
 * Platform-aware: ⌘ on macOS, Ctrl symbols automatically on win/linux.
 *
 * Usage:
 *   <KeyHint action="submit" context="ready" />     → "enter" (or ⏎)
 *   <KeyHintHint action="abort" />                   → "⎋"
 *   <KeyHintBar hints={[...]} />                     → a status bar line
 */

import React from "react"
import { Box, Text } from "ink"
import { detectPlatform } from "./persistence.js"
import { useKeybindings, useBindingHints } from "./context.js"
import { Kbd, KeyHint as DsKeyHint } from "../tui/design-system/index.js"
import type { Action, Context } from "./types.js"

// ── Platform detection (memoized) ────────────────────────────────────────────

let _platform: ReturnType<typeof detectPlatform> | null = null
export function platform(): ReturnType<typeof detectPlatform> {
  if (_platform === null) _platform = detectPlatform()
  return _platform
}

// ── Public: <KeyHint action="..." /> ─────────────────────────────────────────

export interface KeyHintProps {
  /** The action name */
  action:  Action
  /** The context label (e.g. "send", "abort") */
  label?:  string
  /** Look up in a specific context (default: the current context) */
  context?: Context
  /** Style (from the design-system Kbd) */
  variant?: "default" | "subtle" | "primary"
}

/**
 * Keybinding indicator for a single action.
 * Uses the design-system Kbd/KeyHint, but derives the key automatically from the action.
 */
export function KeyHint({ action, label, context, variant }: KeyHintProps) {
  const { store, currentContext } = useKeybindings()
  const ctx = context ?? currentContext
  const keys = store.display[ctx]?.[action] ?? store.display.global?.[action] ?? []
  if (keys.length === 0) return null

  const key = keys[0]!
  return (
    <DsKeyHint
      keys={key}
      action={label ?? action}
    />
  )
}

// ── Public: <KeyHintBar /> ──────────────────────────────────────────────────

export interface KeyHintBarProps {
  /** The list of actions to display */
  actions: Array<{ action: Action; label?: string; context?: Context }>
  /** Separator (default: " · ") */
  separator?: string
}

/**
 * Horizontal keybinding hints for the status bar.
 *
 * Usage:
 *   <KeyHintBar actions={[
 *     { action: "submit",  label: "send" },
 *     { action: "abort",   label: "abort" },
 *     { action: "ui.toggle-tasks", label: "tasks" },
 *   ]} />
 */
export function KeyHintBar({ actions, separator = " · " }: KeyHintBarProps) {
  const { hints } = useBindingHints({ actions })
  return (
    <>
      {hints.map((h, i) => (
        <React.Fragment key={h.action}>
          {i > 0 && <Text>{separator}</Text>}
          {h.key && <Kbd k={h.key} />}
          {h.label && <Text> {h.label}</Text>}
        </React.Fragment>
      ))}
    </>
  )
}

// ── Public: <KeybindingsHelp /> ─────────────────────────────────────────────

/**
 * Lists all current bindings grouped by context.
 * For the /keys command.
 */
export function KeybindingsHelp({ context }: { context?: Context }) {
  const { store, currentContext } = useKeybindings()
  const ctx = context ?? currentContext

  // All actions in this context that have a key
  const items: Array<{ action: Action; key: string; source: "default" | "user" }> = []
  const ctxBindings = store.display[ctx] ?? {}
  for (const action of Object.keys(ctxBindings) as Action[]) {
    const keys = ctxBindings[action] ?? []
    if (keys.length === 0) continue
    items.push({
      action,
      key: keys[0]!,
      source: store.sources[ctx]?.[action] ?? "default",
    })
  }

  return (
    <Box flexDirection="column">
      {items.map(({ action, key, source }) => (
        <Box key={action} flexDirection="row" gap={1}>
          <Kbd k={key} />
          <Text>{action}{source === "user" ? " (custom)" : ""}</Text>
        </Box>
      ))}
    </Box>
  )
}
