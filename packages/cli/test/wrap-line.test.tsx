/**
 * wrapLine() — comparison against Ink's own `<Text wrap="wrap">` output.
 * Since we use the same library (wrap-ansi) with the same options, this isn't
 * an "approximation test" but a regression lock (if Ink ever changes its
 * wrap-ansi version/options, it gets caught here).
 */
import React from "react"
import { describe, it, expect, afterEach } from "bun:test"
import { render, cleanup } from "ink-testing-library"
import { Box, Text } from "ink"
import { wrapLine } from "../src/tui/event-system/wrap-line.js"

afterEach(() => cleanup())

// IMPORTANT: Ink's <Text> component does NOT officially accept a `width` prop
// (verified by directly reading ink/build/components/Text.js — the style object
// only contains flexGrow/flexShrink/flexDirection/textWrap, no width). In the
// real app (Markdown.tsx/Message.tsx), what actually determines the wrap width
// is NOT the `width` prop passed to Text, but the Yoga-computed width of the
// ANCESTOR `<Box width={...}>` wrapping Text (e.g. Message.tsx:432's `<Box
// width={bodyWidth}>`). So the correct comparison is to wrap Text in a
// width-bearing Box, just like the real app does.
// Since the Box has a fixed width, Ink pads line ends with spaces to fill that
// width (a visual layout artifact, not part of the actual text) — these
// trailing spaces are trimmed before comparison.
function renderedLines(content: string, width: number): string[] {
  const { lastFrame } = render(
    <Box width={width}><Text wrap="wrap">{content}</Text></Box>,
  )
  return lastFrame()!.split("\n").map((l) => l.replace(/\s+$/, ""))
}

describe("wrapLine — matches real Ink <Text wrap=\"wrap\"> output", () => {
  it("short text that fits on one line", () => {
    expect(wrapLine("hello world", 40)).toEqual(renderedLines("hello world", 40))
  })

  it("long prose wrapping across multiple lines", () => {
    const text = "The quick brown fox jumps over the lazy dog. This sentence is intentionally long enough to wrap across several terminal rows for testing."
    expect(wrapLine(text, 30)).toEqual(renderedLines(text, 30))
  })

  it("a single word longer than the width (hard break)", () => {
    const text = "supercalifragilisticexpialidocious"
    expect(wrapLine(text, 10)).toEqual(renderedLines(text, 10))
  })

  it("text with multiple internal spaces", () => {
    const text = "one   two     three"
    expect(wrapLine(text, 8)).toEqual(renderedLines(text, 8))
  })

  it("empty string", () => {
    expect(wrapLine("", 20)).toEqual(renderedLines("", 20))
  })

  it("very narrow width", () => {
    const text = "hello world"
    expect(wrapLine(text, 3)).toEqual(renderedLines(text, 3))
  })
})
