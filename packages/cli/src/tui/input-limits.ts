import { stripVTControlCharacters } from "node:util"

// Ink lays out every draft line independently. Keep both dimensions bounded so
// a paste cannot turn the composer into thousands of Yoga nodes.
export const MAX_DRAFT_CHARS = 12_000
export const MAX_DRAFT_LINES = 200

// Leave room for terminal control sequences, but never make copies of an
// unbounded stdin chunk before it has been capped.
const MAX_RAW_INPUT_CHARS = MAX_DRAFT_CHARS + 32

function cleanInput(raw: string): string {
  return stripVTControlCharacters(raw.slice(0, MAX_RAW_INPUT_CHARS))
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\x1b\[200~/g, "")
    .replace(/\x1b\[201~/g, "")
    .replace(/\[200~/g, "")
    .replace(/\[201~/g, "")
}

function limitText(text: string, maxChars: number, maxLines: number): string {
  let end = Math.min(text.length, Math.max(0, maxChars))
  let lineCount = 1
  for (let index = 0; index < end; index++) {
    if (text[index] !== "\n") continue
    if (lineCount === maxLines) {
      end = index
      break
    }
    lineCount++
  }
  return text.slice(0, end)
}

/** Normalize terminal input without allowing an unbounded intermediate copy. */
export function sanitizeInput(raw: string): string {
  return cleanInput(raw)
}

/** Normalize and cap a standalone paste before it reaches the renderer. */
export function sanitizePaste(raw: string): string {
  return limitText(sanitizeInput(raw), MAX_DRAFT_CHARS, MAX_DRAFT_LINES)
}

/** Cap an insertion against the draft already present in the composer. */
export function limitInputInsertion(
  text: string,
  currentCharCount: number,
  currentLineCount: number,
): string {
  return limitText(
    text,
    MAX_DRAFT_CHARS - currentCharCount,
    MAX_DRAFT_LINES - currentLineCount + 1,
  )
}

export function inputWasTruncated(raw: string, cleaned: string, inserted: string): boolean {
  return raw.length > MAX_RAW_INPUT_CHARS || inserted.length < cleaned.length
}
