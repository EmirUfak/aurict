/**
 * MultilineInput — fare ile click-drag seçim + otomatik kopyalama + tıkla-
 * konumlan testleri. `extractRange` saf mantık olarak birim test edilir;
 * gerçek click/release akışı ink-testing-library ile render edilen çerçeve
 * üzerinden gerçek SGR mouse escape sequence'ları enjekte edilerek uçtan uca
 * doğrulanır (mouse.ts'in gerçek stdin-tap patch'i üzerinden).
 *
 * NOT: `clipboard.js`'i `mock.module` ile sahtelemiyoruz — bun'da bu TÜM
 * test dosyaları için global oluyor ve gerçek `clipboard.js` kullanan
 * `clipboard-write.test.ts`'i (aynı bun test sürecinde) sessizce bozuyordu.
 * Bunun yerine kopyalama, zaten var olan `onCopied` callback prop'u
 * üzerinden gözlemleniyor — `writeClipboard`'ın gerçek implementasyonu
 * çalışır (OSC52 non-TTY'de no-op eder, native komut yoksa sessizce geçer),
 * yalnızca YAN ETKİSİ (onCopied çağrısı) doğrulanır.
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
    await flush() // useMouseEvents'in registration effect'inin (passive) commit sonrası flush olmasını bekle
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
    await flush() // setCursor'ın commit edilmesini bekle, sonraki tuş vuruşu güncel cursor'ı görsün

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
