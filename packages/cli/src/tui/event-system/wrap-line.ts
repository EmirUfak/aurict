import wrapAnsi from "wrap-ansi"

/**
 * Calls the SAME library with the SAME options Ink uses for `<Text
 * wrap="wrap">` (the default behavior) (verified by directly reading
 * `ink/build/wrap-text.js`: `wrapAnsi(text, maxWidth, { trim: false, hard:
 * true })`). This guarantees a byte-identical result instead of writing our
 * own wrap algorithm and trying to "approximate" Ink's real render output —
 * critical for finding the lines actually written to the screen in the
 * conversation transcript.
 */
export function wrapLine(text: string, width: number): string[] {
  // wrap-ansi's { trim: false } preserves TRAILING whitespace on each line
  // (to avoid incorrectly trimming mid-word spacing — Ink's own
  // wrap-text.js uses the same option), but Ink's actual terminal output
  // does not show that trailing whitespace (verified via direct render
  // comparison). Trimmed here too so the copied text matches what's
  // visually shown.
  return wrapAnsi(text, Math.max(1, width), { trim: false, hard: true })
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
}
