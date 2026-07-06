/**
 * Keybindings — Validation
 *
 * Validation rules for overrides and default bindings:
 *  - Invalid action/context names
 *  - Malformed key string syntax
 *  - The same key assigned to two actions in the same context
 */

import { parseKeyString } from "./parser.js"
import { ALL_ACTIONS, ALL_CONTEXTS } from "./defaults.js"
import type {
  Action, Context, BindingOverride, ContextBindings,
  ValidationResult, ValidationIssue,
} from "./types.js"

// ── Individual checks ──────────────────────────────────────────────────────────

export function isValidAction(s: string): s is Action {
  return (ALL_ACTIONS as readonly string[]).includes(s)
}

export function isValidContext(s: string): s is Context {
  return (ALL_CONTEXTS as readonly string[]).includes(s)
}

export function isValidKeySyntax(key: string): { valid: boolean; reason?: string } {
  const parsed = parseKeyString(key)
  if (parsed === null) {
    return { valid: false, reason: "could not parse key string" }
  }
  return { valid: true }
}

// ── Top-level validation ─────────────────────────────────────────────────────

/**
 * Validates a BindingOverride object (the user's config).
 */
export function validateOverride(override: BindingOverride): ValidationResult {
  const issues: ValidationIssue[] = []

  for (const [action, key] of Object.entries(override)) {
    // Is the action unknown?
    if (!isValidAction(action)) {
      issues.push({ kind: "unknown-action", action })
      continue
    }
    // Is the key syntax valid?
    const keyCheck = isValidKeySyntax(key)
    if (!keyCheck.valid) {
      issues.push({
        kind: "invalid-key-syntax",
        key,
        reason: keyCheck.reason ?? "unknown",
      })
    }
  }

  return { valid: issues.length === 0, issues }
}

/**
 * Validates a ContextBindings object (resolved bindings).
 * Are all action/context combinations filled in? Are there duplicates?
 */
export function validateContextBindings(bindings: ContextBindings): ValidationResult {
  const issues: ValidationIssue[] = []

  for (const ctx of ALL_CONTEXTS) {
    const ctxBindings = bindings[ctx]
    if (!ctxBindings) {
      issues.push({ kind: "missing-binding", action: "quit", context: ctx })
      continue
    }

    // Is the key valid for every action?
    for (const action of ALL_ACTIONS) {
      const keys = ctxBindings[action]
      if (!Array.isArray(keys)) {
        issues.push({ kind: "missing-binding", action, context: ctx })
        continue
      }
      for (const key of keys) {
        const keyCheck = isValidKeySyntax(key)
        if (!keyCheck.valid) {
          issues.push({
            kind: "invalid-key-syntax",
            key,
            reason: `in ${ctx}.${action}: ${keyCheck.reason ?? "unknown"}`,
          })
        }
      }
    }

    // Duplicate check: is the same key assigned to two different actions?
    const keyToAction = new Map<string, Action>()
    for (const action of ALL_ACTIONS) {
      const keys = ctxBindings[action] ?? []
      for (const key of keys) {
        const existing = keyToAction.get(key)
        if (existing && existing !== action) {
          issues.push({
            kind: "duplicate-binding",
            action: String(action),
            keys: [key],
          })
        }
        keyToAction.set(key, action)
      }
    }
  }

  return { valid: issues.length === 0, issues }
}
