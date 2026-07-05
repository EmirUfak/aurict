import React, { useState, useEffect, useRef, memo } from "react"
import { Box, Text } from "ink"
import { useTheme } from "../utils/theme.js"
import { Markdown } from "./Markdown.js"
import { useBlinkFrame } from "./design-system/motion.js"

// Streaming text'i Markdown ile render et — ### başlık, **bold**, liste vb.
// memo ile: content değişmeyenler re-render almaz.
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

// Elapsed time hook — paused=true olduğunda timer durur, zaman donar
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

// Canlı akışta yükseklik sınırı: reasoning/text bloğu terminal yüksekliğini aşarsa
// Ink kısmi çizimde satırları üst üste bindiriyor. Bu yüzden sadece son N mantıksal
// satır gösterilir; kalanı "⋯ K earlier lines" ile özetlenir. Akış bittiğinde mesaj
// normal (tam) Message olarak yeniden render edilir — hiçbir içerik kaybolmaz.
export const STREAM_REASONING_MAX = 8
export const STREAM_TEXT_MAX      = 14

interface Props {
  text:      string | null
  reasoning: string | null
  skeleton?: boolean   // artık kullanılmıyor — Spinner bileşeni devralır
  error?:    string    // show inline error (e.g. stream interrupted)
  paused?:   boolean   // scroll lock aktifken animasyonları dondurur
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

      {/* ── Reasoning akışı ── */}
      {reasoning && (() => {
        const allLines = reasoning.split("\n")
        const total    = allLines.length
        const hidden   = Math.max(0, total - STREAM_REASONING_MAX)
        const visible  = hidden > 0 ? allLines.slice(-STREAM_REASONING_MAX) : allLines
        return (
          <Box flexDirection="column" marginBottom={text ? 1 : 0}>
            {/* Başlık: "∴ thinking… (142 lines) 3.2s" */}
            <Box gap={1}>
              <Text color={theme.borderDim}>∴</Text>
              <Text color={theme.accent} italic dimColor>thinking…</Text>
              {total > 1 && (
                <Text color={theme.borderDim} dimColor>({total} lines)</Text>
              )}
              <Text color={theme.textDim} dimColor>{formatElapsed(elapsed)}</Text>
            </Box>

            {/* Son N reasoning satırı — ince ┊ sol çizgisi ile (yükseklik sınırı) */}
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
              {/* Canlı imleç */}
              <Box flexDirection="row" marginLeft={2}>
                <Text color={theme.accent} dimColor>{blink ? "▊" : " "}</Text>
              </Box>
            </Box>
          </Box>
        )
      })()}

      {/* ── Text akışı ── (son STREAM_TEXT_MAX satırla sınırlı — yükseklik koruması) */}
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

      {/* ── Hata durumu ── */}
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
