import { describe, expect, it } from "bun:test"
import {
  buildTranscriptLines,
  wrapTranscriptText,
} from "../src/tui/conversation/line-buffer.js"
import { wrapLine } from "../src/tui/event-system/wrap-line.js"
import type { DisplayMessage } from "../src/tui/Message.js"

describe("conversation line buffer", () => {
  it("uses Ink's exact hard-wrap algorithm for every transcript line", () => {
    const content = `start ${"x".repeat(80)}\nsecond paragraph`
    expect(wrapTranscriptText(content, 24)).toEqual([
      ...wrapLine(`start ${"x".repeat(80)}`, 24),
      ...wrapLine("second paragraph", 24),
    ])
  })

  it("removes terminal control sequences before persisting visual rows", () => {
    expect(wrapTranscriptText("\u001b[31mfailed\u001b[0m", 20)).toEqual(["failed"])
  })

  it("keeps ordered assistant text and tool output as individual visual rows", () => {
    const messages: DisplayMessage[] = [
      { id: "user", role: "user", content: "write a report" },
      {
        id: "assistant",
        role: "assistant",
        content: "",
        blocks: [
          { type: "text", content: "I will prepare it." },
          {
            type: "tool",
            id: "tool-1",
            tool: "write",
            args: "report.md",
            pending: false,
            resultContent: "saved report.md",
          },
          { type: "text", content: "The report is ready." },
        ],
      },
    ]

    const lines = buildTranscriptLines(messages, 48, null, null, null)
    expect(lines.map((line) => line.text)).toEqual(expect.arrayContaining([
      "◆ you",
      "write a report",
      "◇ aurict",
      "I will prepare it.",
      "╭─ ✦ write · complete",
      "│ create file · report.md",
      "│ saved report.md",
      "╰─ 1 output lines · Ctrl+O review latest",
      "The report is ready.",
    ]))
    expect(lines.findIndex((line) => line.text === "I will prepare it."))
      .toBeLessThan(lines.findIndex((line) => line.text === "╭─ ✦ write · complete"))
  })

  it("uses distinct identity markers and preserves message timestamps", () => {
    const lines = buildTranscriptLines(
      [
        { id: "user", role: "user", content: "Hello", timestamp: new Date(2026, 0, 1, 9, 5).getTime() },
        { id: "assistant", role: "assistant", content: "Hi", timestamp: new Date(2026, 0, 1, 9, 6).getTime() },
      ],
      80,
      null,
      null,
      null,
    )

    expect(lines.map((line) => line.text)).toEqual(expect.arrayContaining([
      "◆ you · 09:05",
      "◇ aurict · 09:06",
    ]))
  })

  it("preserves Markdown structure without delegating row height to Ink", () => {
    const lines = buildTranscriptLines(
      [
        {
          id: "markdown",
          role: "assistant",
          content: "# Plan\n- [x] Complete\n> Review this\n```ts\nconst ready = true\n```",
        },
      ],
      48,
      null,
      null,
      null,
    )

    expect(lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: "◆ Plan", tone: "heading", bold: true }),
      expect.objectContaining({ text: "● Complete", tone: "assistant" }),
      expect.objectContaining({ text: "│ Review this", tone: "quote", italic: true }),
      expect.objectContaining({ text: "┌ ts", tone: "code" }),
      expect.objectContaining({ text: "const ready = true", tone: "code" }),
    ]))
  })

  it("keeps message and block thinking summaries visible", () => {
    const lines = buildTranscriptLines(
      [
        {
          id: "reasoning",
          role: "assistant",
          content: "",
          reasoningContent: "First thought\nSecond thought",
          blocks: [
            {
              type: "text",
              content: "Answer",
              reasoningContent: "A tool-related thought",
            },
          ],
        },
      ],
      80,
      null,
      null,
      null,
    )

    expect(lines.filter((line) => line.tone === "thinking")).toEqual([
      expect.objectContaining({ text: "∴ planning · 2 lines · Ctrl+O expand" }),
      expect.objectContaining({ text: "∴ thinking · 1 line · Ctrl+O expand" }),
    ])
  })

  it("rebuilds a deterministic, bounded row list after a terminal resize", () => {
    const messages: DisplayMessage[] = [
      { id: "message", role: "assistant", content: "word ".repeat(70) },
    ]
    const narrow = buildTranscriptLines(messages, 32, null, null, null)
    const wide = buildTranscriptLines(messages, 100, null, null, null)

    expect(narrow.length).toBeGreaterThan(wide.length)
    expect(narrow.every((line) => line.id.length > 0)).toBe(true)
    expect(narrow.filter((line) => line.text !== "").every((line) => line.text.length > 0)).toBe(true)
  })
})
