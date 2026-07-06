/**
 * Keybindings — Type definitions
 *
 * Core types for a context-aware, rebindable keybinding system.
 *
 * Hierarchy:
 *   Context (app mode) → Action (intent) → KeyCombo (physical key)
 *
 *   Context.READY    → Action.submit   → "enter"
 *   Context.READY    → Action.cancel   → "escape"
 *   Context.PERMISSION → Action.approve → "y"
 *
 * The user can override the action→key mapping in
 * ~/.aurict/keybindings.json (e.g. `{"submit": "tab"}`).
 */

// ── Context (app mode) ───────────────────────────────────────────────────
// Indicates which mode we're in; different keybinds may be active in
// specific contexts.

export type Context =
  | "global"         // always active
  | "ready"          // chat input focused
  | "streaming"      // model is streaming a response
  | "permission"     // a permission prompt is open
  | "question"       // a question prompt is open
  | "picker"         // model/provider picker is open
  | "autocomplete"   // / command autocomplete is open
  | "history"        // history navigation with ↑/↓
  | "task-panel"     // the floating task panel is open
  | "modal"          // a modal is open (btw panel, help, etc.)

// ── Action (intent) ──────────────────────────────────────────────────────────
// The user's intent — independent of the UI. Default keybinds and overrides
// are mapped through this action.

export type Action =
  // Quit / cancel
  | "quit" | "abort" | "cancel" | "exit"
  // Submit / confirm
  | "submit" | "approve" | "deny" | "confirm"
  // Navigation
  | "nav.up" | "nav.down" | "nav.left" | "nav.right"
  | "nav.top" | "nav.bottom" | "nav.next" | "nav.prev"
  | "nav.first" | "nav.last"
  // History (chat history)
  | "history.up" | "history.down"
  // Autocomplete
  | "autocomplete.next" | "autocomplete.prev" | "autocomplete.close"
  // Editing
  | "edit.delete-word-back" | "edit.delete-word-forward"
  | "edit.delete-line" | "edit.clear" | "edit.swap"
  | "edit.cursor-start" | "edit.cursor-end"
  | "edit.cursor-prev" | "edit.cursor-next"
  // Multiline
  | "multiline.newline" | "multiline.toggle"
  // Chat
  | "chat.new" | "chat.clear" | "chat.copy" | "chat.paste" | "chat.queue-toggle"
  // TUI
  | "ui.toggle-tasks" | "ui.toggle-companion" | "ui.toggle-btw"
  | "ui.show-help" | "ui.show-keys" | "ui.show-models"
  | "ui.show-skills" | "ui.show-memory" | "ui.show-session"
  | "ui.command-palette"
  // Picker
  | "picker.next" | "picker.prev" | "picker.filter"
  // Message operations
  | "msg.expand" | "msg.collapse" | "msg.copy" | "msg.regenerate"
  | "msg.edit" | "msg.delete"
  // Scroll
  | "scroll.up" | "scroll.down" | "scroll.page-up" | "scroll.page-down"
  | "scroll.top" | "scroll.bottom"
  // Diff
  | "diff.next-hunk" | "diff.prev-hunk" | "diff.toggle-view"

// ── KeyCombo (physical key) ──────────────────────────────────────────────────

export interface KeyCombo {
  /** ctrl, alt, shift, meta modifiers */
  ctrl?:  boolean
  alt?:   boolean
  shift?: boolean
  meta?:  boolean
  /** Key name: "a", "enter", "up", "tab", "f1", "/" etc. */
  key:    string
}

// ── Binding (action → key mapping) ───────────────────────────────────────────

/** The user's override: action → key string (e.g. "ctrl+s") */
export type BindingOverride = Record<string, string>

/** Per-context binding: action → key mapping for each context */
export type ContextBindings = Record<Context, Record<Action, string[]>>

// ── Resolver result ──────────────────────────────────────────────────────────

export interface ResolvedBinding {
  /** The key combo to display (display string) */
  key:       string
  /** The actual key combo (for key-event matching) */
  combo:     KeyCombo
  /** Source: default or a user override */
  source:    "default" | "user"
  /** The bound action */
  action:    Action
  /** Which context this was looked up in */
  context:   Context
}

// ── Hook API ─────────────────────────────────────────────────────────────────

export interface UseBindingOptions {
  /** Fired when the key event happens (passed through from input/key events) */
  action:   Action
  /** Which context to look this up in (empty = "global") */
  context?: Context
  /** Trigger callback */
  onTrigger: () => void
  /** Passive — for display only */
  passive?:  boolean
}

export interface UseBindingHintsOptions {
  /** Actions to display (in order) */
  actions:  Array<{ action: Action; label?: string; context?: Context }>
}

export interface UseBindingHintsResult {
  hints: Array<{
    action:    Action
    label:     string
    key:       string
    display:   string
  }>
}

// ── Configuration file ───────────────────────────────────────────────────

export interface KeybindingsConfig {
  /** Action → key mapping (string list, first one takes priority) */
  bindings: BindingOverride
  /** Active platform override (mac/win/linux) — different symbol display */
  platform?: "mac" | "win" | "linux"
  /** Preference for showing the hint bar */
  showInStatusBar?: boolean
  /** Version (for future migrations) */
  version:  1
}

// ── Validation ───────────────────────────────────────────────────────────────

export type ValidationIssue =
  | { kind: "unknown-action"; action: string }
  | { kind: "unknown-context"; context: string }
  | { kind: "invalid-key-syntax"; key: string; reason: string }
  | { kind: "duplicate-binding"; action: string; keys: string[] }
  | { kind: "missing-binding"; action: Action; context: Context }

export interface ValidationResult {
  valid:   boolean
  issues:  ValidationIssue[]
}
