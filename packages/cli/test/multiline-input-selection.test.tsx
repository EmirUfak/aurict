/**
 * MultilineInput — mouse click-drag select + auto-copy + click-to-position
 * tests. `extractRange` is unit-tested as pure logic; the real click/release
 * flow is verified end-to-end by injecting real SGR mouse escape sequences
 * against the frame rendered via ink-testing-library (through mouse.ts's real
 * stdin-tap patch).
 *
 * NOTE: we don't fake `clipboard.js` with `mock.module` — in bun this becomes
 * global for ALL test files, and it was silently breaking `clipboard-write.test.ts`
 * (which uses the real `clipboard.js`) in the same bun test process.
 * Instead, copying is observed via the already-existing `onCopied` callback
 * prop — the real `writeClipboard` implementation runs (OSC52 no-ops on
 * non-TTY, silently passes if there's no native command), and only its
 * SIDE EFFECT (the onCopied call) is verified.
 */
import React from "react"
import { describe, it, expect, afterEach, mock } from "bun:test"
import { render, cleanup } from "ink-testing-library"
import { MultilineInput, extractRange } from "../src/tui/MultilineInput.js"

afterEach(() => cleanup())

describe("extractRange", () => {
  const lines = ["hello world", "second line", "third"]

  it("extracts a substring within a single row", () => {
    expect(extractRange(lines, { row: 0, col: 0 }, { row: 0, col: 5 })).toBe("hello")
  })

  it("normalizes reversed points (end before start)", () => {
    expect(extractRange(lines, { row: 0, col: 5 }, { row: 0, col: 0 })).toBe("hello")
  })

  it("joins full lines in between for a multi-row range", () => {
    expect(extractRange(lines, { row: 0, col: 6 }, { row: 2, col: 3 })).toBe(
      "world\nsecond line\nthi",
    )
  })

  it("returns empty string for a zero-width same-point range", () => {
    expect(extractRange(lines, { row: 0, col: 3 }, { row: 0, col: 3 })).toBe("")
  })
})

// ── SGR mouse sequence helpers ──────────────────────────────────────────────
function sgrClick(col: number, row: number): string {
  return `\x1b[<0;${col};${row}M`
}
function sgrRelease(col: number, row: number): string {
  return `\x1b[<0;${col};${row}m`
}
function emitMouse(seq: string) {
  process.stdin.emit("data", Buffer.from(seq, "binary"))
}

describe("MultilineInput — mouse click-drag select & copy (integration)", () => {
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

  it("reports the dragged range via onCopied on release", async () => {
    const onCopied = mock((_n: number) => {})
    const { lastFrame } = render(
      <MultilineInput value="hello world" onChange={() => {}} onSubmit={() => {}} disabled={false} history={[]} onCopied={onCopied} />,
    )
    await flush() // wait for useMouseEvents's (passive) registration effect to flush after commit
    const frameLines = lastFrame()!.split("\n")
    const textRow     = frameLines.findIndex((l) => l.includes("hello world"))
    const textCol     = frameLines[textRow]!.indexOf("hello")
    // 1-based terminal coordinates for SGR
    const startCol = textCol + 1
    const row      = textRow + 1

    emitMouse(sgrClick(startCol, row))          // mousedown at "h"
    emitMouse(sgrRelease(startCol + 5, row))    // mouseup after "hello"

    expect(onCopied).toHaveBeenCalledWith(5) // "hello".length
  })

  it("does not report a copy when click and release land on the same cell", async () => {
    const onCopied = mock((_n: number) => {})
    const { lastFrame } = render(
      <MultilineInput value="hello world" onChange={() => {}} onSubmit={() => {}} disabled={false} history={[]} onCopied={onCopied} />,
    )
    await flush()
    const frameLines = lastFrame()!.split("\n")
    const textRow     = frameLines.findIndex((l) => l.includes("hello world"))
    const textCol     = frameLines[textRow]!.indexOf("hello")
    const col = textCol + 1
    const row = textRow + 1

    emitMouse(sgrClick(col, row))
    emitMouse(sgrRelease(col, row))

    expect(onCopied).not.toHaveBeenCalled()
  })

  it("repositions the cursor on a plain click (no drag)", async () => {
    const onChange = mock((_v: string) => {})
    const { lastFrame, stdin } = render(
      <MultilineInput value="hello world" onChange={onChange} onSubmit={() => {}} disabled={false} history={[]} />,
    )
    await flush()
    const frameLines = lastFrame()!.split("\n")
    const textRow     = frameLines.findIndex((l) => l.includes("hello world"))
    const textCol     = frameLines[textRow]!.indexOf("hello")
    const row = textRow + 1
    const clickCol = textCol + 1 + 5 // right after "hello", before the space

    emitMouse(sgrClick(clickCol, row))
    emitMouse(sgrRelease(clickCol, row))
    await flush() // wait for setCursor to commit, so the next keystroke sees the current cursor

    // Cursor should now be positioned right after "hello" — typing "X" inserts it there.
    stdin.write("X")
    await flush()
    expect(onChange).toHaveBeenLastCalledWith("helloX world")
  })

  it("ignores clicks outside the input box bounds", async () => {
    const onCopied = mock((_n: number) => {})
    render(<MultilineInput value="hi" onChange={() => {}} onSubmit={() => {}} disabled={false} history={[]} onCopied={onCopied} />)
    await flush()
    emitMouse(sgrClick(1, 500))   // way outside any rendered row
    emitMouse(sgrRelease(50, 500))
    expect(onCopied).not.toHaveBeenCalled()
  })
})
