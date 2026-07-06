/**
 * Keybindings — Index
 *
 * Exports the entire keybinding API from a single point.
 *
 * Usage:
 *   import { KeybindingsProvider, useBinding, KeyHint, KeyHintBar } from "./keybindings/index.js"
 */

export {
  // Types
  type Action,
  type Context,
  type KeyCombo,
  type BindingOverride,
  type ResolvedBinding,
  type UseBindingOptions,
  type UseBindingHintsOptions,
  type UseBindingHintsResult,
  type KeybindingsConfig,
  type ValidationIssue,
  type ValidationResult,
} from "./types.js"

export {
  ALL_ACTIONS,
  ALL_CONTEXTS,
  DEFAULT_BINDINGS,
  emptyBindings,
} from "./defaults.js"

export {
  parseKeyString,
  formatKeyCombo,
  inkKeyEventToCombo,
  keyCombosEqual,
} from "./parser.js"

export {
  isValidAction,
  isValidContext,
  isValidKeySyntax,
  validateOverride,
  validateContextBindings,
} from "./validate.js"

export {
  buildResolvedStore,
  resolveKey,
  resolveKeys,
  resolveDisplayKey,
  matchInkEvent,
  resolveFull,
  type ResolvedStore,
} from "./resolver.js"

export {
  loadKeybindings,
  saveKeybindings,
  resetKeybindings,
  getKeybindingsPath,
  detectPlatform,
  type LoadResult,
  type SaveResult,
} from "./persistence.js"

export {
  KeybindingsProvider,
  useKeybindings,
  useBinding,
  useBindingHints,
  useBindingMeta,
  type KeybindingsProviderProps,
} from "./context.js"

export {
  KeyHint,
  KeyHintBar,
  KeybindingsHelp,
  platform,
  type KeyHintProps,
  type KeyHintBarProps,
} from "./display.js"

export {
  formatBindingsForContext,
  formatAllBindings,
  type FormattedBinding,
} from "./format.js"
