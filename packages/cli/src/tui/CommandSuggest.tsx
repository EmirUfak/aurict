import React, { useState, useEffect, useRef } from "react"
import { useTerminalSize } from "./TerminalSizeContext.js"
import { Box, Text, useInput } from "ink"
import type { CommandDef } from "../commands/types.js"
import { useTheme } from "../utils/theme.js"
import {
  COMMAND_CATEGORY_META,
  commandCategory,
  commandIcon,
  commandSearchText,
  commandSortKey,
} from "../commands/ui-metadata.js"

const MAX_SHOW = 6
const NAME_WIDTH = 14
const CATEGORY_WIDTH = 9
const ALIAS_WIDTH = 14

function fit(text: string, width: number): string {
  if (width <= 1) return ""
  return text.length <= width ? text.padEnd(width) : text.slice(0, width - 1) + "…"
}

interface Props {
  filter:    string         // "/" sonrası yazılan metin
  commands:  CommandDef[]
  isActive:  boolean
  onExecute: (cmdName: string) => void  // Enter: komutu çalıştır
  onFill:    (cmdName: string) => void  // Tab: input'u doldur
}

// Subsequence fuzzy match: "mdl" → "model". Eşleşirse 0-1 arası yoğunluk skoru.
function fuzzySubsequence(text: string, query: string): number {
  let ti = 0; let qi = 0
  while (ti < text.length && qi < query.length) {
    if (text[ti] === query[qi]) qi++
    ti++
  }
  if (qi < query.length) return 0
  return query.length / text.length
}

function matchScore(c: CommandDef, filter: string): number {
  const f = filter.toLowerCase()
  if (!f) return 1
  const name = c.name.toLowerCase()
  const aliases = (c.aliases ?? []).map((a) => a.toLowerCase())
  if (name === f) return 100
  if (aliases.some((a) => a === f)) return 95
  if (name.startsWith(f)) return 80
  if (aliases.some((a) => a.startsWith(f))) return 75
  // Substring: tek karakterde bile isim/alias içinde ara — daha çok sonuç göster
  if (name.includes(f)) return 60
  if (aliases.some((a) => a.includes(f))) return 55
  // Açıklama/kategori/usage içinde substring (1 karakter için çok gürültülü)
  if (f.length >= 2 && commandSearchText(c).includes(f)) return 30
  // Fuzzy subsequence: "mdl" → /model, "cpt" → /checkpoints
  if (f.length >= 2) {
    const fz = fuzzySubsequence(name, f)
    if (fz > 0) return 10 + fz * 15
  }
  return 0
}

export function getCommandMatches(filter: string, commands: CommandDef[]): CommandDef[] {
  return commands
    .map((c) => ({ cmd: c, score: matchScore(c, filter) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || commandSortKey(a.cmd).localeCompare(commandSortKey(b.cmd)))
    .map((r) => r.cmd)
}

export function CommandSuggest({ filter, commands, isActive, onExecute, onFill }: Props) {
  const theme = useTheme()
  // Seçim TÜM eşleşme listesi üzerinde gezinir; görünen pencere render'da
  // türetilir (offsetRef). State yerine functional update + ref kullanımı:
  // coalesced tuşlar aynı tick'te art arda geldiğinde closure'daki bayat
  // değerlerle adım kaybetmemek için.
  const [idx, setIdx] = useState(0)
  const idxRef    = useRef(0)   // aynı tick içinde gelen ardışık tuşlar için güncel değer
  const offsetRef = useRef(0)

  const moveSel = (compute: (current: number) => number) => {
    idxRef.current = compute(idxRef.current)
    setIdx(idxRef.current)
  }

  // Filter değişince seçimi ve pencereyi sıfırla
  useEffect(() => { idxRef.current = 0; setIdx(0); offsetRef.current = 0 }, [filter])

  const { columns: termCols, rows: termRows } = useTerminalSize()
  const maxShow = termRows <= 26 ? 4 : termRows >= 34 ? 8 : MAX_SHOW
  const allMatches = getCommandMatches(filter, commands)
  const matchCount = allMatches.length

  // Liste küçüldüyse state'i sınırlar içine çek (bayat index bug'ını önler)
  useEffect(() => {
    if (idxRef.current > matchCount - 1) {
      idxRef.current = Math.max(0, matchCount - 1)
      setIdx(idxRef.current)
    }
  }, [matchCount])

  const activeIdx = Math.min(idx, Math.max(0, matchCount - 1))

  // Pencereyi render'da türet: seçili öğe her zaman görünür kalır
  let winStart = offsetRef.current
  if (activeIdx < winStart) winStart = activeIdx
  if (activeIdx >= winStart + maxShow) winStart = activeIdx - maxShow + 1
  winStart = Math.max(0, Math.min(winStart, Math.max(0, matchCount - maxShow)))
  offsetRef.current = winStart

  const visible   = allMatches.slice(winStart, winStart + maxShow)
  const descWidth = Math.max(16, termCols - NAME_WIDTH - CATEGORY_WIDTH - ALIAS_WIDTH - 14)

  useInput((_char, key) => {
    if (!matchCount) return
    if (key.upArrow)   { moveSel((i) => Math.max(0, Math.min(i, matchCount - 1) - 1));              return }
    if (key.downArrow) { moveSel((i) => Math.min(matchCount - 1, Math.min(i, matchCount - 1) + 1)); return }
    if (key.tab)    { const c = allMatches[Math.min(idxRef.current, matchCount - 1)]; if (c) onFill(c.name);    return }
    if (key.return) { const c = allMatches[Math.min(idxRef.current, matchCount - 1)]; if (c) onExecute(c.name); return }
  }, { isActive: isActive && matchCount > 0 })

  if (!isActive || !allMatches.length) return null

  const aboveCount = winStart
  const belowCount = allMatches.length - (winStart + visible.length)

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.borderActive} paddingX={1} marginX={1}>
      <Box gap={1}>
        <Text color={theme.accent} dimColor bold>commands</Text>
        {allMatches.length > maxShow && (
          <Text color={theme.textDim} dimColor>{activeIdx + 1}/{allMatches.length}</Text>
        )}
      </Box>
      {aboveCount > 0 && (
        <Text color={theme.textDim} dimColor>  ↑ {aboveCount} more</Text>
      )}
      <Box flexDirection="column">
        {visible.map((cmd, i) => {
          const sel = winStart + i === activeIdx
          const category = COMMAND_CATEGORY_META[commandCategory(cmd)]
          return (
            <Box key={cmd.name}>
              <Box>
                <Text color={sel ? theme.accent : theme.textDim}>{sel ? "› " : "  "}</Text>
                <Text color={sel ? theme.accent : theme.textDim}>{commandIcon(cmd)}</Text>
                <Text> </Text>
                <Text color={sel ? theme.accent : theme.textPrimary} bold={sel}>
                  {fit("/" + cmd.name, NAME_WIDTH)}
                </Text>
                <Text color={theme.textDim} dimColor>{fit(category.label, CATEGORY_WIDTH)}</Text>
                <Text color={theme.textDim} dimColor>
                  {fit(cmd.aliases?.slice(0, 2).map(a => `/${a}`).join(" ") ?? "", ALIAS_WIDTH)}
                </Text>
                <Text color={sel ? theme.textPrimary : theme.textDim} dimColor={!sel} wrap="truncate-end">
                  {fit(cmd.description, descWidth)}
                </Text>
              </Box>
            </Box>
          )
        })}
      </Box>
      {belowCount > 0 && (
        <Text color={theme.textDim} dimColor>  ↓ {belowCount} more - type to narrow</Text>
      )}
      <Text color={theme.textDim} dimColor>  up/down select  tab fill  enter run  esc close</Text>
    </Box>
  )
}
