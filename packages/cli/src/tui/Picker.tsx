import React, { useEffect, useMemo, useRef, useState } from "react"
import { Box, Text, useInput } from "ink"
import type { PickerItem } from "../commands/types.js"
import { useTheme } from "../utils/theme.js"
import { useTerminalSize } from "./TerminalSizeContext.js"

const PAGE_SIZE = 10

function clip(text: string, width: number): string {
  if (text.length <= width) return text
  if (width <= 1) return "…"
  return `${text.slice(0, width - 1)}…`
}

function padClip(text: string, width: number): string {
  return clip(text, width).padEnd(width, " ")
}

interface Props {
  title:    string
  items:    PickerItem[]
  onSelect: (item: PickerItem) => void
  onCancel: () => void
}

export function Picker({ title, items, onSelect, onCancel }: Props) {
  const theme = useTheme()
  const { columns, rows } = useTerminalSize()
  const [idx, setIdx] = useState(0)
  const [offset, setOffset] = useState(0)
  const [query, setQuery] = useState("")
  // Aynı tick'te art arda gelen (coalesced) ok tuşları için güncel index —
  // closure'daki `idx` bayat kalır, ref her tuşta senkron güncellenir.
  const idxRef = useRef(0)
  // Panel chrome'u (2 border + başlık + filtre + pager + yardım) ≈ 6 satır;
  // input alanı + status bar için de pay bırak. Eski `rows <= 26 ? 1 : ...`
  // eşiği küçük terminalde TEK seçenek gösteriyordu.
  const pageSize = Math.max(2, Math.min(PAGE_SIZE, rows - 14))
  const panelWidth = Math.max(40, Math.min(columns - 2, 88))
  const contentWidth = Math.max(20, panelWidth - 4)
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const haystack = `${item.id} ${item.label} ${item.hint ?? ""}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [items, query])

  useEffect(() => {
    const maxIdx = Math.max(0, filteredItems.length - 1)
    if (idxRef.current > maxIdx) idxRef.current = maxIdx
    setIdx((i) => Math.min(i, maxIdx))
    setOffset((o) => Math.min(o, Math.max(0, filteredItems.length - pageSize)))
  }, [filteredItems.length, pageSize])

  useEffect(() => {
    idxRef.current = 0
    setIdx(0)
    setOffset(0)
  }, [query])

  useInput((_input, key) => {
    if (key.upArrow) {
      const next = Math.max(0, idxRef.current - 1)
      idxRef.current = next
      setIdx(next)
      setOffset((o) => (next < o ? next : o))
      return
    }
    if (key.downArrow) {
      const next = Math.min(Math.max(0, filteredItems.length - 1), idxRef.current + 1)
      idxRef.current = next
      setIdx(next)
      setOffset((o) => (next >= o + pageSize ? next - pageSize + 1 : o))
      return
    }
    if (key.return) {
      const item = filteredItems[idxRef.current]
      if (item) onSelect(item)
      return
    }
    if (key.escape) { onCancel(); return }
    if (key.backspace || key.delete) { setQuery((q) => q.slice(0, -1)); return }
    if (_input && !key.ctrl && !key.meta && !key.tab) {
      setQuery((q) => q + _input)
    }
  })

  const visible = filteredItems.slice(offset, offset + pageSize)

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.borderActive} paddingX={1} width={panelWidth}>
      <Text color={theme.accent} bold>{padClip(title, contentWidth)}</Text>
      <Text color={query ? theme.textPrimary : theme.textDim} dimColor={!query}>
        {padClip(query ? `filter ${query}` : "type to filter", contentWidth)}
      </Text>
      <Box flexDirection="column">
        {visible.length === 0 && (
          <Text color={theme.textDim} dimColor>{padClip("  No matches", contentWidth)}</Text>
        )}
        {visible.map((item, i) => {
          const selected = offset + i === idx
          const marker = selected ? "▶ " : "  "
          const hint = item.hint ? `  ${item.hint}` : ""
          // contentWidth - 1: çift hücreli glyph payı — sondaki "…" görünmesin
          const line = padClip(`${marker}${item.label}${hint}`, contentWidth - 1)
          const key = `${item.id}:${selected ? "selected" : "idle"}`
          // wrap="truncate-end": "●" gibi glyph'ler string-width'te 2 hücre
          // sayılınca padlenmiş satır sarıyor ve altta hayalet boş satır
          // bırakıyordu — sarma yerine kes.
          if (selected) {
            return <Text key={key} color={theme.accent} bold wrap="truncate-end">{line}</Text>
          }
          return <Text key={key} color={theme.textPrimary} wrap="truncate-end">{line}</Text>
        })}
        {filteredItems.length > pageSize && (
          <Text color={theme.textDim} dimColor>
            {padClip(`  ${offset + 1}-${Math.min(offset + visible.length, filteredItems.length)} / ${filteredItems.length}`, contentWidth)}
          </Text>
        )}
      </Box>
      <Text color={theme.textDim} dimColor>{padClip("↑↓ select  type filter  Enter confirm  Esc cancel", contentWidth)}</Text>
    </Box>
  )
}
