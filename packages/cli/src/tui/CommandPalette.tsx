import React, { useState, useMemo, useEffect } from "react"
import { Box, Text, useInput } from "./design-system/renderer.js"
import { useTheme } from "../utils/theme.js"
import { Typo } from "./design-system/index.js"
import { useTerminalSize } from "./TerminalSizeContext.js"
import type { CommandDef } from "../commands/types.js"
import {
  COMMAND_CATEGORY_META,
  commandCategory,
  commandIcon,
  commandSearchText,
  commandSortKey,
} from "../commands/ui-metadata.js"
import { padDisplayEnd, truncateDisplayWidth } from "./terminal-text/display-width.js"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  commands:       CommandDef[]
  recentCommands: string[]   // ordered by most-recent-first
  onSelect:       (cmd: CommandDef, args: string, action: "fill" | "run") => void
  onClose:        () => void
}

// ── Fuzzy score ───────────────────────────────────────────────────────────────

function score(cmd: CommandDef, query: string): number {
  if (!query) return 0
  const q    = query.toLowerCase()
  const name = cmd.name.toLowerCase()
  const aliases = cmd.aliases ?? []
  const search = commandSearchText(cmd)
  if (name === q)           return 100
  if (name.startsWith(q))   return 80
  if (aliases.some(a => a === q)) return 76
  if (aliases.some(a => a.startsWith(q))) return 70
  if (name.includes(q))     return 60
  if (search.includes(q))   return 30
  // character match
  let ni = 0; let qi = 0; let hits = 0
  while (ni < name.length && qi < q.length) {
    if (name[ni] === q[qi]) { hits++; qi++ }
    ni++
  }
  return qi === q.length ? (hits / q.length) * 20 : 0
}

function clip(text: string, width: number): string {
  return truncateDisplayWidth(text, Math.max(0, width))
}

function padClip(text: string, width: number): string {
  return padDisplayEnd(clip(text, width), Math.max(0, width))
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CommandPalette({ commands, recentCommands, onSelect, onClose }: Props) {
  const theme  = useTheme()
  const { columns, rows } = useTerminalSize()
  const [query, setQuery]   = useState("")
  const [cursor, setCursor] = useState(0)
  const compact = rows <= 26 || columns < 88
  const paletteWidth = Math.max(1, Math.min(88, columns - 2))
  const contentWidth = Math.max(1, paletteWidth - 4)
  const maxResults = compact ? 2 : 8

  const results = useMemo(() => {
    if (!query.trim()) {
      // No query: show recent commands first, then the rest
      const recentSet = new Set(recentCommands)
      const recent  = recentCommands
        .map(n => commands.find(c => c.name === n))
        .filter(Boolean) as CommandDef[]
      const rest    = commands.filter(c => !recentSet.has(c.name)).sort((a, b) => commandSortKey(a).localeCompare(commandSortKey(b)))
      return [
        ...recent.map(c => ({ cmd: c, isRecent: true,  sc: 0 })),
        ...rest.map(c   => ({ cmd: c, isRecent: false, sc: 0 })),
      ].slice(0, maxResults)
    }

    // With query: fuzzy filter+sort
    return commands
      .map(c => ({ cmd: c, isRecent: recentCommands.includes(c.name), sc: score(c, query.trim()) }))
      .filter(r => r.sc > 0)
      .sort((a, b) => b.sc - a.sc || commandSortKey(a.cmd).localeCompare(commandSortKey(b.cmd)))
      .slice(0, maxResults)
  }, [commands, recentCommands, query, maxResults])

  const clampedCursor = Math.min(cursor, Math.max(0, results.length - 1))

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, results.length - 1)))
  }, [results.length])

  useInput((input, key) => {
    if (key.escape) { onClose(); return }
    if (key.ctrl && input === "c") { onClose(); return }
    if (key.upArrow)   { setCursor(c => Math.max(0, c - 1)); return }
    if (key.downArrow) { setCursor(c => Math.min(Math.max(0, results.length - 1), c + 1)); return }
    if (key.return) {
      const r = results[clampedCursor]
      if (r) onSelect(r.cmd, "", key.ctrl ? "run" : "fill")
      return
    }
    if (key.backspace || key.delete) { setQuery(q => q.slice(0, -1)); setCursor(0); return }
    if (!key.ctrl && !key.meta && !key.escape && !key.return && !key.tab && input) {
      setQuery(q => q + input); setCursor(0)
    }
  })

  const showRecentHeader = !query.trim() && recentCommands.length > 0
  const selectedResult = results[clampedCursor]

  if (compact) {
    const aliasText = selectedResult?.cmd.aliases?.length ? `/${selectedResult.cmd.aliases[0]}` : ""
    const commandText = selectedResult
      ? `▶ /${selectedResult.cmd.name}${aliasText ? ` ${aliasText}` : ""} · ${selectedResult.cmd.description}`
      : `No match for /${query}`
    const prefix = query ? `Palette /${query} ` : "Palette "

    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.accent}
        paddingX={1}
        width={paletteWidth}
      >
        <Text color={selectedResult ? theme.textPrimary : theme.textDim} bold={Boolean(selectedResult)}>
          {clip(`${prefix}${commandText} · Enter fill · Esc close`, Math.max(12, contentWidth - 8))}
        </Text>
      </Box>
    )
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.accent}
      paddingX={1}
      width={paletteWidth}
    >
      {/* Header */}
      {!compact && (
        <Box justifyContent="space-between">
          <Typo variant="bodyEmphasis" tone="primary">Command Palette</Typo>
          <Typo variant="caption" tone="muted">Esc close  ↑↓ select  Enter fill  Ctrl+Enter run</Typo>
        </Box>
      )}

      {/* Search */}
      {!compact && (
        <>
          <Box>
            <Text color={theme.accent}>/ </Text>
            <Text color={theme.textPrimary}>{query || " "}</Text>
            <Text color={theme.accent}>▋</Text>
          </Box>
          <Text color={theme.borderDim}>{"─".repeat(contentWidth)}</Text>
        </>
      )}

      {/* Results */}
      {results.length === 0 && (
        <Typo variant="body" tone="muted">No commands matched.</Typo>
      )}

      {results.map((r, i) => {
        const selected = i === clampedCursor
        const showSectionHeader = !compact && showRecentHeader && !r.isRecent && (i === 0 || results[i-1]?.isRecent === true)
        const showRecentSectionHeader = !compact && showRecentHeader && r.isRecent && i === 0
        const prevCategory = i > 0 ? commandCategory(results[i - 1]!.cmd) : null
        const category = commandCategory(r.cmd)
        const showCategoryHeader = !compact && !showRecentHeader && (!prevCategory || prevCategory !== category)
        const categoryMeta = COMMAND_CATEGORY_META[category]

        const aliasText = r.cmd.aliases?.length ? r.cmd.aliases.slice(0, 2).map(a => `/${a}`).join(" ") : ""
        const nameText = `/${r.cmd.name}`
        const descText = r.cmd.description
        const nameWidth = compact ? 18 : 22
        const aliasWidth = compact ? 11 : 14
        const descWidth = Math.max(8, contentWidth - 8 - nameWidth - aliasWidth)
        const line = [
          selected ? "▶" : " ",
          commandIcon(r.cmd),
          padClip(nameText, nameWidth),
          padClip(aliasText, aliasWidth),
          clip(descText, descWidth),
        ].join(" ")

        return (
          <React.Fragment key={r.cmd.name}>
            {showRecentSectionHeader && (
              <Text color={theme.textDim} dimColor>  Recently used</Text>
            )}
            {showSectionHeader && (
              <Text color={theme.textDim} dimColor>  All commands</Text>
            )}
            {showCategoryHeader && (
              <Text color={theme.textDim} dimColor>  {categoryMeta.icon} {categoryMeta.label}</Text>
            )}
            <Text
              color={selected ? theme.textPrimary : theme.textSecondary}
              bold={selected}
            >{line}</Text>
          </React.Fragment>
        )
      })}

      {/* Usage hint for selected */}
      {results[clampedCursor]?.cmd.usage && !compact && (
        <>
          <Text color={theme.borderDim}>{"─".repeat(contentWidth)}</Text>
          <Text color={theme.textDim} dimColor>  {results[clampedCursor]!.cmd.usage}</Text>
          <Text color={theme.borderBright} dimColor>  Enter fills input. Ctrl+Enter runs the selected command.</Text>
        </>
      )}
      {compact && (
        <Text color={theme.textDim} dimColor>{clip(query ? `Palette /${query} · Esc close` : "Palette · Enter fill · Esc close · Ctrl+C close", contentWidth)}</Text>
      )}
    </Box>
  )
}
