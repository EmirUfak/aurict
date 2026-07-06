/**
 * MultilineInput — Ctrl+Backspace/Ctrl+W/Alt+Backspace word-delete variants.
 *
 * Real user data collected via `AURICT_DEBUG_KEYS=1` (2026-07-06) showed that
 * Ink converts known escape sequences into its own key/input pair BEFORE they
 * reach `useInput` — the raw bytes are NOT PRESERVED in `input`. This means
 * most of the previous 5 raw-string checks practically NEVER matched:
 *   - On the gnome-terminal family, Ctrl+Backspace/Alt+Backspace (\x1b\x7f) is
 *     reported by Ink as {delete:true, meta:true, input:""}.
 *   - Ctrl+W (\x17) is always reported by Ink as {ctrl:true, input:"w"} —
 *     \x17 never appears literally in `input`.
 *   - \x08 (Ctrl+Backspace, VTE-family) arrives only as {backspace:true} —
 *     INDISTINGUISHABLE from plain Backspace, so this is an unfixable
 *     ambiguity (information lost at the Ink/terminal level).
 *   - kitty CSI-u (\x1b[127;5u) gets split into TWO SEPARATE events, ESC and
 *     "[127;5u", and never combines into a single `input` string.
 * Only the two variants that actually work are tested here; the raw-string
 * checks in source for \x08/kitty CSI-u were left purely as a defensive
 * fallback (harmless, but currently not triggered by any real terminal/Ink 5
 * combination) and are not tested here.
 */
import React from "react"
import { describe, it, expect, afterEach } from "bun:test"
import { render, cleanup } from "ink-testing-library"
import { MultilineInput } from "../src/tui/MultilineInput.js"

afterEach(() => cleanup())

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

async function typeAndDeleteWord(deleteSeq: string): Promise<string> {
  let current = ""
  const { stdin } = render(
    <MultilineInput value="" onChange={(v) => { current = v }} onSubmit={() => {}} disabled={false} history={[]} />,
  )
  await flush()

  stdin.write("hello world")
  await flush()
  stdin.write(deleteSeq)
  await flush()

  cleanup()
  return current
}

describe("MultilineInput — word-delete variants (real Ink key parser)", () => {
  it("\\x1b\\x7f (Ctrl+Backspace on gnome-terminal family / Alt+Backspace) deletes the last word", async () => {
    expect(await typeAndDeleteWord("\x1b\x7f")).toBe("hello ")
  })

  it("\\x17 (Ctrl+W) deletes the last word", async () => {
    expect(await typeAndDeleteWord("\x17")).toBe("hello ")
  })
})
