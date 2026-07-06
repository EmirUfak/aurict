/**
 * Keybindings — Resolver
 *
 * Context + Action → KeyCombo resolution.
 *
 * Flow:
 *   1. First check context-specific bindings
 *   2. If not found, fall back to the global binding
 *   3. Apply the override if there is one
 *   4. Take the first key (the primary binding)
 *
 * Usage:
 *   const key = resolveKey("submit", "ready")
 *   if (inkInputMatch(event, key)) onSubmit()
 */

import { parseKeyString, inkKeyEventToCombo, keyCombosEqual } from "./parser.js"
import { DEFAULT_BINDINGS } from "./defaults.js"
import type {
  Action, Context, BindingOverride, KeyCombo, ResolvedBinding,
} from "./types.js"

// ── Resolved store ───────────────────────────────────────────────────────────

export interface ResolvedStore {
  /** Context → Action → KeyCombo[] (parsed) */
  bindings: Record<Context, Record<Action, KeyCombo[]>>
  /** Context → Action → key string[] for display */
  display:  Record<Context, Record<Action, string[]>>
  /** Which key we bound the action to (for debugging) */
  sources:  Record<Context, Record<Action, "default" | "user">>
}

// ── Build ────────────────────────────────────────────────────────────────────

/**
 * Merges the default bindings with the user's overrides and builds a
 * parsed (KeyCombo[]) store.
 */
export function buildResolvedStore(override: BindingOverride = {}): ResolvedStore {
  const bindings: Record<Context, Record<Action, KeyCombo[]>> = {} as any
  const display:  Record<Context, Record<Action, string[]>>  = {} as any
  const sources:  Record<Context, Record<Action, "default" | "user">> = {} as any

  // For each context
  for (const ctx of Object.keys(DEFAULT_BINDINGS) as Context[]) {
    bindings[ctx] = {} as any
    display[ctx]  = {} as any
    sources[ctx]  = {} as any

    const defaults = DEFAULT_BINDINGS[ctx]
    for (const action of Object.keys(defaults) as Action[]) {
      // Is there a user override?
      const overrideKey = override[action]
      let keyStrings: string[]
      let source: "default" | "user"

      if (overrideKey !== undefined) {
        keyStrings = [overrideKey]
        source = "user"
      } else {
        keyStrings = defaults[action]
        source = "default"
      }

      display[ctx][action] = keyStrings
      sources[ctx][action] = source
      bindings[ctx][action] = keyStrings
        .map(k => parseKeyString(k))
        .filter((c): c is KeyCombo => c !== null)
    }
  }

  return { bindings, display, sources }
}

// ── Single key resolve ──────────────────────────────────────────────────────

/**
 * Returns the primary key combo for a Context + Action.
 * Context-specific first, then falls back to global.
 * The override is applied if there is one.
 */
export function resolveKey(
  action: Action,
  context: Context,
  store: ResolvedStore,
): KeyCombo | null {
  // Context-specific first
  const ctxSpecific = store.bindings[context]?.[action]
  if (ctxSpecific && ctxSpecific.length > 0) return ctxSpecific[0]!

  // Fallback: global
  if (context !== "global") {
    const global = store.bindings.global?.[action]
    if (global && global.length > 0) return global[0]!
  }

  return null
}

/**
 * All keys (including alternatives) — an action may be bound to multiple keys.
 */
export function resolveKeys(
  action: Action,
  context: Context,
  store: ResolvedStore,
): KeyCombo[] {
  const ctxSpecific = store.bindings[context]?.[action] ?? []
  if (ctxSpecific.length > 0) return ctxSpecific
  if (context !== "global") {
    return store.bindings.global?.[action] ?? []
  }
  return []
}

/**
 * Returns the primary display string for an action (e.g. "ctrl+c").
 */
export function resolveDisplayKey(
  action: Action,
  context: Context,
  store: ResolvedStore,
): string | null {
  const ctxSpecific = store.display[context]?.[action]
  if (ctxSpecific && ctxSpecific.length > 0) return ctxSpecific[0]!
  if (context !== "global") {
    const global = store.display.global?.[action]
    if (global && global.length > 0) return global[0]!
  }
  return null
}

// ── Event matching ──────────────────────────────────────────────────────────

/**
 * Takes an Ink useInput event and compares it against all bindings in the
 * store. Returns the matching action (or null).
 */
export function matchInkEvent(
  event: Parameters<typeof inkKeyEventToCombo>[0],
  context: Context,
  store: ResolvedStore,
): Action | null {
  const combo = inkKeyEventToCombo(event)

  // Scan all actions — return the first match found
  // (context-specific first, then global)
  const ctxBindings = store.bindings[context] ?? {}
  for (const action of Object.keys(ctxBindings) as Action[]) {
    const combos = ctxBindings[action] ?? []
    for (const c of combos) {
      if (keyCombosEqual(c, combo)) return action
    }
  }

  if (context !== "global") {
    const globalBindings = store.bindings.global ?? {}
    for (const action of Object.keys(globalBindings) as Action[]) {
      const combos = globalBindings[action] ?? []
      for (const c of combos) {
        if (keyCombosEqual(c, combo)) return action
      }
    }
  }

  return null
}

// ── Full resolved binding (display + metadata) ──────────────────────────────────

export function resolveFull(
  action: Action,
  context: Context,
  store: ResolvedStore,
): ResolvedBinding | null {
  const combo = resolveKey(action, context, store)
  if (!combo) return null
  const display = resolveDisplayKey(action, context, store)
  const source  = store.sources[context]?.[action] ?? "default"
  return {
    key:     display ?? "",
    combo,
    source,
    action,
    context,
  }
}
