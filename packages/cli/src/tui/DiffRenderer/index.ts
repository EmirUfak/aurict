/**
 * DiffRenderer — Index
 *
 * Advanced diff viewer. Takes a raw diff or old/new text, renders in three
 * modes (unified/side-by-side/raw). Integrated with hunk navigation and
 * mode-toggle keybindings.
 */

export {
  DiffRenderer,
  type DiffRendererProps,
} from "./DiffRenderer.js"

export {
  parseRawDiff,
  diffTexts,
  wordDiff,
  suggestDiffMode,
  type LineType,
  type DiffLine,
  type Hunk,
  type ParsedDiff,
  type DiffMode,
} from "./logic.js"
