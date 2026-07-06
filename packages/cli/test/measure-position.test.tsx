/**
 * measureAbsolutePosition() verification — since Ink's official measureElement()
 * only gives width/height, we directly verify that our absolute position
 * calculation matches the real render output (via lastFrame()'s line indices)
 * exactly. This is the foundational assumption that Phase 2 (input box
 * click/selection) and Phase 4's (chat selection) will be built on.
 */
import React, { useRef, useLayoutEffect } from "react"
import { describe, it, expect, afterEach } from "bun:test"
import { render, cleanup } from "ink-testing-library"
import { Box, Text, type DOMElement } from "ink"
import { measureAbsolutePosition } from "../src/tui/event-system/measure-position.js"

afterEach(() => cleanup())

function Probe({ onMeasured, rootHeight }: { onMeasured: (pos: { row: number; col: number }) => void; rootHeight: number }) {
  const ref = useRef<DOMElement>(null)
  useLayoutEffect(() => {
    if (ref.current) onMeasured(measureAbsolutePosition(ref.current))
  })
  return (
    <Box flexDirection="column" width="100%" height={rootHeight}>
      <Text>line 0 — header</Text>
      <Text>line 1 — header</Text>
      <Box flexDirection="column" marginLeft={3}>
        <Text>line 2 — filler</Text>
        <Box ref={ref} flexDirection="column">
          <Text>MARKER</Text>
        </Box>
      </Box>
    </Box>
  )
}

describe("measureAbsolutePosition", () => {
  it("matches the actual rendered row/col of the target box", () => {
    let measured: { row: number; col: number } | null = null
    const { lastFrame } = render(<Probe rootHeight={10} onMeasured={(pos) => { measured = pos }} />)

    const frameLines = lastFrame()!.split("\n")
    const actualRow  = frameLines.findIndex((l) => l.includes("MARKER"))
    const actualCol  = frameLines[actualRow]!.indexOf("MARKER")

    expect(measured).not.toBeNull()
    expect(measured!.row).toBe(actualRow)
    expect(measured!.col).toBe(actualCol)
  })

  it("returns {row: 0, col: 0} for the root node itself", () => {
    let measured: { row: number; col: number } | null = null
    function RootProbe() {
      const ref = useRef<DOMElement>(null)
      useLayoutEffect(() => {
        if (ref.current) measured = measureAbsolutePosition(ref.current)
      })
      return (
        <Box ref={ref} flexDirection="column" height={5}>
          <Text>root</Text>
        </Box>
      )
    }
    render(<RootProbe />)
    expect(measured).toEqual({ row: 0, col: 0 })
  })
})
