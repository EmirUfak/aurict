import React, { useState, useEffect, useRef, memo } from "react"
import { Box, Text } from "ink"
import { useTheme } from "../utils/theme.js"
import { Markdown } from "./Markdown.js"
import { useBlinkFrame } from "./design-system/motion.js"

// Render the streaming text with Markdown — ### headings, **bold**, lists, etc.
// Wrapped in memo: unchanged content doesn't re-render.
const StreamingTextBlock = memo(function StreamingTextBlock({ text, width }: { text: string; width: number }) {
  return (
    <Box flexDirection="column" width={width}>
      <Markdown content={text} width={width} />
    </Box>
  )
})

// Elapsed time formatter
function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const remaining = Math.floor(s % 60)
  return `${m}m ${remaining}s`
}

// Elapsed time hook — the timer stops and time freezes when paused=true
function useElapsedTime(paused?: boolean): number {
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())
  const pausedRef = useRef(paused)
  useEffect(() => { pausedRef.current = paused }, [paused])

  useEffect(() => {
    startRef.current = Date.now()
    setElapsed(0)
    const t = setInterval(() => {
      if (!pausedRef.current) setElapsed(Date.now() - startRef.current)
    }, 500)
    return () => clearInterval(t)
  }, [])

  return elapsed
}

import { useTerminalSize } from "./TerminalSizeContext.js"

// Height limit during live streaming: if the reasoning/text block exceeds the
// terminal height, Ink's partial redraws overlap lines on top of each other. So only
// the last N logical lines are shown; the rest are summarized as "⋯ K earlier lines".
// When streaming ends, the message is re-rendered as a normal (full) Message — no content is lost.
export const STREAM_REASONING_MAX = 8
export const STREAM_TEXT_MAX      = 14

interface Props {
  text:      string | null
  reasoning: string | null
  skeleton?: boolean   // no longer used — the Spinner component took over
  error?:    string    // show inline error (e.g. stream interrupted)
  paused?:   boolean   // freezes animations while scroll lock is active
}

function lineCount(text: string): number {
  return text.split("\n").length
}

export const StreamingView = memo(function StreamingView({ text, reasoning, skeleton, error, paused }: Props) {
  const theme = useTheme()
  const blink = useBlinkFrame()
  const elapsed = useElapsedTime(paused)
  const termCols = useTerminalSize().columns
  const bodyWidth = Math.max(20, termCols - 9)
  const railTextWidth = Math.max(10, bodyWidth - 2)

  return (
    <Box flexDirection="column" paddingX={1} marginBottom={1}>

      {/* ── Reasoning stream ── */}
      {reasoning && (() => {
        const allLines = reasoning.split("\n")
        const total    = allLines.length
        const hidden   = Math.max(0, total - STREAM_REASONING_MAX)
        const visible  = hidden > 0 ? allLines.slice(-STREAM_REASONING_MAX) : allLines
        return (
          <Box flexDirection="column" marginBottom={text ? 1 : 0}>
            {/* Header: "∴ thinking… (142 lines) 3.2s" */}
            <Box gap={1}>
              <Text color={theme.borderDim}>∴</Text>
              <Text color={theme.accent} italic dimColor>thinking…</Text>
              {total > 1 && (
                <Text color={theme.borderDim} dimColor>({total} lines)</Text>
              )}
              <Text color={theme.textDim} dimColor>{formatElapsed(elapsed)}</Text>
            </Box>

            {/* Last N reasoning lines — with a thin ┊ left line (height limit) */}
            <Box flexDirection="column" marginLeft={2}>
              {hidden > 0 && (
                <Box flexDirection="row">
                  <Text color={theme.borderDim} dimColor>┊ </Text>
                  <Text color={theme.textDim} dimColor>⋯ {hidden} earlier thinking line{hidden === 1 ? "" : "s"}</Text>
                </Box>
              )}
              {visible.map((line, i) => (
                <Box key={i} flexDirection="row" width={bodyWidth}>
                  <Text color={theme.borderDim} dimColor>┊ </Text>
                  <Box width={railTextWidth}>
                    <Text
                      color={theme.accent}
                      italic
                      dimColor
                      wrap="wrap"
                    >
                      {line || " "}
                    </Text>
                  </Box>
                </Box>
              ))}
              {/* Live cursor */}
              <Box flexDirection="row" marginLeft={2}>
                <Text color={theme.accent} dimColor>{blink ? "▊" : " "}</Text>
              </Box>
            </Box>
          </Box>
        )
      })()}

      {/* ── Text stream ── (limited to the last STREAM_TEXT_MAX lines — height protection) */}
      {text && (() => {
        const textLines  = text.split("\n")
        const hiddenText = Math.max(0, textLines.length - STREAM_TEXT_MAX)
        const shownText  = hiddenText > 0 ? textLines.slice(-STREAM_TEXT_MAX).join("\n") : text
        return (
          <Box flexDirection="row" gap={1}>
            <Box width={2} flexShrink={0}>
              <Text color={theme.assistantDot}>○</Text>
            </Box>
            <Box
              width={bodyWidth}
              borderStyle="single"
              borderTop={false} borderBottom={false} borderRight={false}
              borderColor={theme.accent}
              paddingLeft={1}
            >
              {hiddenText > 0 && (
                <Text color={theme.textDim} dimColor>⋯ {hiddenText} earlier line{hiddenText === 1 ? "" : "s"} above</Text>
              )}
              <StreamingTextBlock text={shownText} width={railTextWidth} />
              <Text color={theme.accent}>{blink ? "▊" : " "}</Text>
              <Text color={theme.textDim} dimColor> {formatElapsed(elapsed)}</Text>
            </Box>
          </Box>
        )
      })()}

      {/* ── Error state ── */}
      {error && (
        <Box flexDirection="row" gap={1} paddingLeft={1}>
          <Box width={2} flexShrink={0}>
            <Text color={theme.error}>✗</Text>
          </Box>
          <Box
            width={bodyWidth}
            borderStyle="single"
            borderTop={false} borderBottom={false} borderRight={false}
            borderColor={theme.error}
            paddingLeft={1}
          >
            <Box width={railTextWidth}>
              <Text color={theme.error} wrap="wrap">{error}</Text>
            </Box>
          </Box>
        </Box>
      )}

    </Box>
  )
})
