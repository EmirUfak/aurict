/**
 * Keybindings — React context + hooks
 *
 * Wraps useInput to provide an action-based API.
 * A context stack (push/pop) supports states like modal/permission.
 *
 * Usage:
 *   const { useBinding, useBindingHints, currentContext } = useKeybindings()
 *   useBinding("submit", "ready", () => onSubmit(value))
 *   const hints = useBindingHints([{ action: "submit", label: "send" }])
 */

import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from "react"
import { useInput } from "ink"
import { buildResolvedStore, matchInkEvent, resolveDisplayKey } from "./resolver.js"
import { loadKeybindings } from "./persistence.js"
import type {
  Action, Context, BindingOverride, UseBindingOptions,
  UseBindingHintsOptions, UseBindingHintsResult,
} from "./types.js"

// ── Store Context ────────────────────────────────────────────────────────────

interface KeybindingsContextValue {
  store:       ReturnType<typeof buildResolvedStore>
  /** The currently active context (the top of the stack) */
  currentContext: Context
  /** Push a new context (when a modal opens) */
  pushContext: (ctx: Context) => void
  /** Pop the top context (when a modal closes) */
  popContext:  () => void
  /** Set the context directly (replace) */
  setContext:  (ctx: Context) => void
  /** Returns the user's overrides (for debug/display) */
  overrides:   BindingOverride
  /** The error, if any (during load) */
  loadError?:  string | undefined
  /** Refreshes the overrides (for config reload) */
  reload:      () => void
}

const KeybindingsContext = createContext<KeybindingsContextValue | null>(null)

// ── Provider ────────────────────────────────────────────────────────────────

export interface KeybindingsProviderProps {
  /** The initial context (default: "ready") */
  initialContext?: Context
  /** Pass overrides manually (for tests) */
  overrides?:     BindingOverride
  children:       React.ReactNode
}

export function KeybindingsProvider({
  initialContext = "ready",
  overrides: propOverrides,
  children,
}: KeybindingsProviderProps) {
  const [contextStack, setContextStack] = useState<Context[]>([initialContext])
  const [loadResult, setLoadResult]     = useState(() => loadKeybindings())
  const [version, setVersion]           = useState(0)

  useEffect(() => {
    setContextStack([initialContext])
  }, [initialContext])

  // Overrides: prop > loaded from file
  const overrides = propOverrides ?? loadResult.bindings
  const store = useMemo(() => buildResolvedStore(overrides), [overrides, version])

  const currentContext = contextStack[contextStack.length - 1] ?? "global"

  const pushContext = (ctx: Context) => {
    setContextStack(prev => [...prev, ctx])
  }

  const popContext = () => {
    setContextStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev)
  }

  const setContext = (ctx: Context) => {
    setContextStack([ctx])
  }

  const reload = () => {
    setLoadResult(loadKeybindings())
    setVersion(v => v + 1)
  }

  return (
    <KeybindingsContext.Provider
      value={{
        store,
        currentContext,
        pushContext,
        popContext,
        setContext,
        overrides,
        ...(loadResult.error !== undefined ? { loadError: loadResult.error } : {}),
        reload,
      }}
    >
      {children}
    </KeybindingsContext.Provider>
  )
}

// ── useKeybindings ──────────────────────────────────────────────────────────

export function useKeybindings(): KeybindingsContextValue {
  const ctx = useContext(KeybindingsContext)
  if (!ctx) {
    throw new Error("useKeybindings must be used within <KeybindingsProvider>")
  }
  return ctx
}

// ── useBinding (per-component useInput wrapper) ─────────────────────────────

/**
 * Calls the callback when a specific action is triggered.
 * Wraps Ink's useInput hook, does action matching.
 *
 * Usage:
 *   useBinding({
 *     action: "submit",
 *     context: "ready",
 *     onTrigger: () => onSubmit(value),
 *   })
 */
export function useBinding({
  action,
  context: propContext,
  onTrigger,
  passive = false,
}: UseBindingOptions) {
  const { store, currentContext } = useKeybindings()
  const context = propContext ?? currentContext
  const handlerRef = useRef(onTrigger)
  handlerRef.current = onTrigger

  // passive: for display only, doesn't do input handling
  useInput((input, key) => {
    if (passive) return
    const matched = matchInkEvent({ input, key }, context, store)
    if (matched === action) {
      handlerRef.current()
    }
  })
}

// ── useBindingHints (for display) ──────────────────────────────────────────

/**
 * Returns display keys for the given actions (e.g. to show in the status bar).
 *
 * Usage:
 *   const hints = useBindingHints([
 *     { action: "submit", label: "send" },
 *     { action: "abort",  label: "abort" },
 *   ])
 *   // hints: [{ action: "submit", label: "send", key: "ctrl+c", display: "ctrl+c" }, ...]
 */
export function useBindingHints(
  options: UseBindingHintsOptions,
): UseBindingHintsResult {
  const { store, currentContext } = useKeybindings()

  return useMemo(() => {
    const hints = options.actions.map(({ action, label, context }) => {
      const ctx = context ?? currentContext
      const key = resolveDisplayKey(action, ctx, store) ?? ""
      return {
        action,
        label: label ?? action,
        key,
        display: key, // enriched in display.tsx for platform-aware display
      }
    })
    return { hints }
  }, [store, currentContext, options.actions])
}

// ── useBindingMeta (debug) ──────────────────────────────────────────────────

/**
 * Returns all metadata for an action (display, source, context).
 */
export function useBindingMeta(action: Action, context?: Context) {
  const { store, currentContext } = useKeybindings()
  const ctx = context ?? currentContext
  return useMemo(() => ({
    display: resolveDisplayKey(action, ctx, store),
    source:  store.sources[ctx]?.[action] ?? "default",
    context: ctx,
  }), [store, ctx, action])
}
