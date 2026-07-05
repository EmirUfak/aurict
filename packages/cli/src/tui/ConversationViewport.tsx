import React, { useMemo, useRef, useLayoutEffect, useReducer, useCallback, useState, useEffect } from "react"
import { Box, Text, measureElement } from "ink"
import type { DOMElement } from "ink"
import { Message, type DisplayMessage } from "./Message.js"
import { StreamingView, STREAM_REASONING_MAX, STREAM_TEXT_MAX } from "./StreamingView.js"
import { Spinner } from "./Spinner.js"
import { useTheme } from "../utils/theme.js"

// ── Height estimation (fallback before first measurement) ─────────────────────

function estimateWrappedLines(text: string, width: number): number {
  const safeWidth = Math.max(12, width)
  return text
    .split("\n")
    .reduce((sum, line) => sum + Math.max(1, Math.ceil((line.length || 1) / safeWidth)), 0)
}

// Tool çıktısı önizlemesi: Message.tsx MAX_TOOL_LINES=7 → 6 head + (varsa) 1 "hidden"
// + 1 tail; kutuda en fazla ~8 satır görünür.
const TOOL_PREVIEW_MAX = 8

// Not: viewport'a geçen `width` zaten ~termCols-9 (bodyWidth). Message içeriği ray/
// border+padding sonrası ≈ width-2'de sarılıyor; tahminin gerçek yüksekliğe yakın
// olması settle sıçramasını (scroll-freeze idle-apply) neredeyse görünmez yapar.
function estimateMessageRows(message: DisplayMessage, width: number): number {
  const contentWidth = Math.max(12, width - 3)
  if (message.role === "user")
    // 1 header (you) + sarılı içerik + 1 marginBottom
    return estimateWrappedLines(message.content, contentWidth) + 2
  if (message.role === "assistant") {
    const thinking = message.reasoningContent ? 1 : 0  // collapsed ∴ satırı
    if (message.blocks && message.blocks.length > 0) {
      let rows = 0
      for (const b of message.blocks) {
        if (b.type === "text") rows += estimateWrappedLines(b.content || "…", contentWidth) + 1
        else {
          const outLines = estimateWrappedLines(b.resultContent || "", contentWidth)
          rows += Math.min(TOOL_PREVIEW_MAX, Math.max(1, outLines)) + 2  // header + kutu + margin
        }
      }
      return Math.max(3, rows + 1 + thinking + 1)  // aurict header + thinking + marginBottom
    }
    return estimateWrappedLines(message.content || message.reasoningContent || "…", contentWidth) + 2 + thinking
  }
  if (message.role === "tool_call") {
    const output = message.resultContent || message.content || ""
    const outLines = estimateWrappedLines(output, contentWidth)
    const shown = outLines > TOOL_PREVIEW_MAX ? TOOL_PREVIEW_MAX : Math.max(1, outLines)
    // 1 header + kutu satırları + 1 marginBottom
    return 1 + shown + 1
  }
  // system / error: · prefix + sarılı içerik + marginBottom
  return estimateWrappedLines(message.content, contentWidth) + 1
}

// ── Measured wrapper ──────────────────────────────────────────────────────────

function contentKey(message: DisplayMessage, width: number): string {
  const base = message.id ?? message.content.slice(0, 16)
  let len = (message.content?.length ?? 0) + (message.resultContent?.length ?? 0) + (message.reasoningContent?.length ?? 0)
  if (message.blocks) {
    for (const b of message.blocks) {
      if (b.type === "text") len += b.content.length + (b.reasoningContent?.length ?? 0)
      else len += b.args.length + (b.resultContent?.length ?? 0)
    }
  }
  return `${base}:${len}:w${width}`
}

interface MeasuredBoxProps {
  cacheKey: string
  onMeasure: (key: string, rows: number) => void
  children: React.ReactNode
}

function MeasuredBox({ cacheKey, onMeasure, children }: MeasuredBoxProps) {
  const ref = useRef<DOMElement>(null)
  const lastMeasured = useRef<number>(-1)

  useLayoutEffect(() => {
    if (!ref.current) return
    const { height } = measureElement(ref.current)
    if (height > 0 && height !== lastMeasured.current) {
      lastMeasured.current = height
      onMeasure(cacheKey, height)
    }
  }, [cacheKey, onMeasure])

  return <Box ref={ref}>{children}</Box>
}

// Render penceresi: çok uzun konuşmalarda fiber sayısını sınırlamak için
// yalnızca son MAX_RENDERED entry DOM'a yazılır. Scroll math tüm entry'leri
// kapsar (estimate veya ölçülmüş yükseklik), bu sayede offset'ler doğru kalır.
const MAX_RENDERED = 200

// ── Transcript types ──────────────────────────────────────────────────────────

type TranscriptEntry =
  | { kind: "message";   key: string; rows: number; message: DisplayMessage }
  | { kind: "streaming"; key: string; rows: number }
  | { kind: "spinner";   key: string; rows: number }

// ── Props ─────────────────────────────────────────────────────────────────────

export interface ConversationViewportProps {
  height:               number
  width:                number
  messages:             DisplayMessage[]
  loading:              boolean
  activeTool?:          string
  streamingText:        string | null
  streamingReason:      string | null
  streamingError:       string | null
  scrollLocked:         boolean
  offsetRowsFromBottom: number
  unseenCount?:         number
  /** En üst scroll sınırını (maxOffset) App'e raporlar — iki-uç clamp için. */
  onScrollRange?:       (maxOffset: number) => void
  /** Yukarı kaydırılmışken alta içerik eklendiğinde okuma konumunu korumak için offset kaydırır. */
  onAnchorShift?:       (deltaRows: number) => void
  onExpandTool:         (content: string, toolName: string) => void
  onExpandThinking:     (content: string) => void
}

// ── Sub-components ────────────────────────────────────────────────────────────

function formatElapsedFlash(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  return `${m}m ${Math.floor(s % 60)}s`
}

function CompletionFlash({ elapsed }: { elapsed: number }) {
  const theme = useTheme()
  return (
    <Box gap={1} paddingX={2} marginBottom={1}>
      <Text color={theme.success}>✓</Text>
      <Text color={theme.textDim} dimColor>Done</Text>
      <Text color={theme.borderBright} dimColor>{formatElapsedFlash(elapsed)}</Text>
    </Box>
  )
}

function UnseenDivider({ count, width }: { count: number; width: number }) {
  const theme = useTheme()
  const label = ` ${count} new message${count === 1 ? "" : "s"} ↓ `
  const dashCount = Math.max(0, Math.floor((width - label.length - 4) / 2))
  const dashes = "─".repeat(dashCount)
  return (
    <Box paddingX={2}>
      <Text color={theme.accent} dimColor>{dashes}</Text>
      <Text color={theme.accent} bold>{label}</Text>
      <Text color={theme.accent} dimColor>{dashes}</Text>
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ConversationViewport({
  height,
  width,
  messages,
  loading,
  activeTool,
  streamingText,
  streamingReason,
  streamingError,
  scrollLocked,
  offsetRowsFromBottom,
  unseenCount,
  onScrollRange,
  onAnchorShift,
  onExpandTool,
  onExpandThinking,
}: ConversationViewportProps) {
  // Completion flash: loading true→false geçişinde 1.8s göster
  const loadingStartRef = useRef<number | null>(null)
  const [completionFlash, setCompletionFlash] = useState<number | null>(null)

  useEffect(() => {
    if (loading) {
      if (loadingStartRef.current === null) loadingStartRef.current = Date.now()
    } else {
      if (loadingStartRef.current !== null) {
        const elapsed = Date.now() - loadingStartRef.current
        loadingStartRef.current = null
        setCompletionFlash(elapsed)
        const t = setTimeout(() => setCompletionFlash(null), 1800)
        return () => clearTimeout(t)
      }
    }
  }, [loading])

  const theme = useTheme()

  // Height cache: tüm mesajların gerçek yüksekliklerini tutar (scroll math için)
  const heightCacheRef = useRef<Map<string, number>>(new Map())
  const [measureRevision, forceUpdate] = useReducer((x: number) => x + 1, 0)

  // ── Scroll-freeze ──────────────────────────────────────────────────────────
  // Kullanıcı aktif kaydırırken ölçüm reflow'u içeriği gözünün altında zıplatıyor.
  // Bu yüzden jest boyunca ölçümler cache'e YAZILIR ama forceUpdate ERTELENİR;
  // ~140ms sessizlikte biriken ölçümler tek seferde uygulanır.
  const scrollingRef      = useRef(false)
  const pendingMeasureRef = useRef(false)
  const scrollIdleTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevOffsetRef     = useRef(offsetRowsFromBottom)

  useEffect(() => {
    if (offsetRowsFromBottom !== prevOffsetRef.current) {
      prevOffsetRef.current = offsetRowsFromBottom
      scrollingRef.current = true
      if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current)
      scrollIdleTimer.current = setTimeout(() => {
        scrollingRef.current = false
        if (pendingMeasureRef.current) {
          pendingMeasureRef.current = false
          forceUpdate()
        }
      }, 140)
    }
    return () => { if (scrollIdleTimer.current) clearTimeout(scrollIdleTimer.current) }
  }, [offsetRowsFromBottom])

  const handleMeasure = useCallback((key: string, rows: number) => {
    if (heightCacheRef.current.get(key) !== rows) {
      heightCacheRef.current.set(key, rows)
      if (scrollingRef.current) {
        // Jest sürerken reflow'u erteleyerek zıplamayı önle.
        pendingMeasureRef.current = true
      } else {
        forceUpdate()
      }
    }
  }, [])

  // Tüm mesajlar + canlı tail
  const entries = useMemo<TranscriptEntry[]>(() => {
    const list: TranscriptEntry[] = messages.map((message, index) => {
      const ck      = contentKey(message, width)
      const measured = heightCacheRef.current.get(ck)
      const rows    = measured ?? estimateMessageRows(message, width)
      return { kind: "message", key: message.id ?? `m-${index}`, rows, message }
    })

    if (streamingText || streamingReason || streamingError) {
      // StreamingView'in sınırlı (tail) yüksekliğiyle eşleşen tahmin — scroll
      // matematiğinin gerçek çizilen yükseklikten sapmaması için.
      const reasoningRows = streamingReason ? Math.min(STREAM_REASONING_MAX, streamingReason.split("\n").length) + 2 : 0
      const textRows      = streamingText   ? Math.min(STREAM_TEXT_MAX, streamingText.split("\n").length) + 2 : 0
      const errorRows     = streamingError  ? 2 : 0
      const streamRows    = Math.max(3, reasoningRows + textRows + errorRows)
      list.push({ kind: "streaming", key: "streaming-entry", rows: streamRows })
    } else if (loading && !activeTool) {
      list.push({ kind: "spinner", key: "spinner-entry", rows: 3 })
    }

    return list
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, width, streamingText, streamingReason, streamingError, loading, activeTool, measureRevision])

  // ── Scroll math ──────────────────────────────────────────────────────────
  const showUnseen     = (unseenCount ?? 0) > 0 && offsetRowsFromBottom > 0
  const scrollAreaRows = Math.max(4, height - (showUnseen ? 1 : 0))
  const totalRows      = entries.reduce((s, e) => s + e.rows, 0)
  const maxOffset      = Math.max(0, totalRows - scrollAreaRows)
  const clampedOffset  = Math.min(offsetRowsFromBottom, maxOffset)
  const scrollPosition = maxOffset - clampedOffset  // rows from top to start of visible area

  // Üst scroll sınırını App'e raporla (iki-uç clamp için).
  useEffect(() => { onScrollRange?.(maxOffset) }, [maxOffset, onScrollRange])

  // Konum koruma: yukarı kaydırılmışken alta yeni mesaj eklenince (streaming değil,
  // finalize mesajlar) offset'i eklenen satır kadar kaydır → görüntü sabit kalır.
  // messages.length'e bağlı olduğu için ölçüm düzeltmeleri yanlış tetiklemez.
  const prevMsgCountRef = useRef(messages.length)
  const offsetRef = useRef(offsetRowsFromBottom)
  useEffect(() => { offsetRef.current = offsetRowsFromBottom })
  useEffect(() => {
    const prev = prevMsgCountRef.current
    prevMsgCountRef.current = messages.length
    if (messages.length > prev && offsetRef.current > 0 && onAnchorShift) {
      let added = 0
      for (let i = prev; i < messages.length; i++) added += estimateMessageRows(messages[i]!, width)
      if (added > 0) onAnchorShift(added)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length])

  // ── Slice-based rendering: büyük negatif marginTop yerine sadece görünen
  // entry'ler render edilir. Bu Yoga'nın içeriği sıkıştırmasını engeller.
  // intraPad: ilk görünen entry içindeki satır offseti (küçük sayı, max ~30).
  let cum = 0
  let firstVisIdx = 0
  let intraPad = 0

  for (let i = 0; i < entries.length; i++) {
    const next = cum + entries[i]!.rows
    if (next <= scrollPosition) {
      cum = next
      firstVisIdx = i + 1
    } else {
      intraPad = scrollPosition - cum
      firstVisIdx = i
      break
    }
  }

  const windowEntries = entries.slice(firstVisIdx, firstVisIdx + MAX_RENDERED)

  // ── Alt-kırpma (taşma koruması) ────────────────────────────────────────────
  // Ink'in overflow:hidden'ı dinamik metni her zaman kırpmıyor; görünür pencereyi
  // aşan entry'ler alt alta binerek "sıkışma" yaratıyor. Bu yüzden görünür alan
  // bütçesini (scrollAreaRows) dolduran entry'lerden sonrasını hiç render etme.
  // İlk entry intraPad kadar yukarı kaydığı için sayacı -intraPad'den başlat.
  const visibleEntries: TranscriptEntry[] = []
  let acc = -intraPad
  for (const e of windowEntries) {
    visibleEntries.push(e)
    acc += e.rows
    if (acc >= scrollAreaRows) break
  }

  return (
    <Box height={height} flexShrink={1} flexDirection="column" overflow="hidden">
      {showUnseen && <UnseenDivider count={unseenCount!} width={width} />}
      <Box flexGrow={1} flexDirection="column" overflow="hidden">
        <Box flexDirection="column" marginTop={-intraPad}>
          {firstVisIdx > 0 && intraPad === 0 && (
            <Box paddingX={2}>
              <Text color={theme.textDim} dimColor>⋯ {firstVisIdx} older messages</Text>
            </Box>
          )}
          {visibleEntries.map((entry) => {
            if (entry.kind === "message") {
              const m  = entry.message
              const ck = contentKey(m, width)
              return (
                <MeasuredBox key={entry.key} cacheKey={ck} onMeasure={handleMeasure}>
                  <Message
                    message={m}
                    onExpand={
                      m.role === "tool_call" && m.resultContent && m.resultContent.split("\n").length > 3
                        ? () => onExpandTool(m.resultContent!, m.tool ?? "tool")
                        : undefined
                    }
                    onExpandTool={onExpandTool}
                    onExpandThinking={
                      m.role === "assistant" && m.reasoningContent
                        ? () => onExpandThinking(m.reasoningContent!)
                        : undefined
                    }
                  />
                </MeasuredBox>
              )
            }

            if (entry.kind === "streaming") {
              return (
                <StreamingView
                  key={entry.key}
                  text={streamingText}
                  reasoning={streamingReason}
                  skeleton={false}
                  paused={scrollLocked}
                  {...(streamingError ? { error: streamingError } : {})}
                />
              )
            }

            if (entry.kind === "spinner") {
              return <Spinner key={entry.key} activeTool={activeTool} />
            }

            return null
          })}
          {completionFlash !== null && !loading && (
            <CompletionFlash elapsed={completionFlash} />
          )}
        </Box>
      </Box>
    </Box>
  )
}
