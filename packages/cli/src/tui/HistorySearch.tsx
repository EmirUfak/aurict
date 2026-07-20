/**
 * HistorySearch — reverse command history search (Ctrl+R)
 *
 * Bash/zsh-style reverse search. Fuzzy matches against history as the
 * user types. Selected with Enter, closed with Esc.
 *
 * Features:
 * - Real-time fuzzy matching
 * - Navigate between results with ↑↓
 * - Auto-complete with Tab
 * - Highlights the matched portion
 */

import React, { useState, useEffect, useMemo, useRef } from "react"
import { Box, Text, useInput } from "./design-system/renderer.js"
import { useTheme } from "../utils/theme.js"
import { HStack, VStack, Surface, Typo } from "./design-system/index.js"

interface Props {
  history:    string[]
  onSelect:   (text: string) => void
  onClose:    () => void
}

/**
 * Fuzzy match — do all characters of the query appear in order in the target string?
 * Returns the matched positions (for highlighting).
 */
function fuzzyMatch(query: string, target: string): { score: number; positions: number[] } | null {
  if (!query) return { score: 0, positions: [] }

  const q = query.toLowerCase()
  const t = target.toLowerCase()
  const positions: number[] = []
  let qi = 0
  let score = 0
  let lastMatchIdx = -2

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      positions.push(ti)
      // Consecutive match bonus
      if (ti === lastMatchIdx + 1) score += 3
      // Start-of-string bonus
      else if (ti === 0) score += 2
      else score += 1
      lastMatchIdx = ti
      qi++
    }
  }

  // null if not all characters matched
  if (qi < q.length) return null

  // Short target + many matches = high score
  score += Math.max(0, 10 - (target.length - query.length))

  return { score, positions }
}

/**
 * Render text, highlighting the matched positions
 */
function HighlightedText({ text, positions, theme }: { text: string; positions: number[]; theme: ReturnType<typeof useTheme> }) {
  const posSet = new Set(positions)
  const parts: Array<{ char: string; highlighted: boolean }> = []

  for (let i = 0; i < text.length; i++) {
    parts.push({ char: text[i]!, highlighted: posSet.has(i) })
  }

  // Group consecutive highlighted characters
  const groups: Array<{ text: string; highlighted: boolean }> = []
  for (const part of parts) {
    const last = groups[groups.length - 1]
    if (last && last.highlighted === part.highlighted) {
      last.text += part.char
    } else {
      groups.push({ text: part.char, highlighted: part.highlighted })
    }
  }

  return (
    <Text>
      {groups.map((g, i) => (
        <Text key={i} color={g.highlighted ? theme.accent : theme.textPrimary} bold={g.highlighted}>
          {g.text}
        </Text>
      ))}
    </Text>
  )
}

export function HistorySearch({ history, onSelect, onClose }: Props) {
  const theme = useTheme()
  const [query, setQuery] = useState("")
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef(query)
  useEffect(() => { inputRef.current = query }, [query])

  // Fuzzy match results
  const matches = useMemo(() => {
    if (!query) {
      // Show the last 20 history items if there's no search term
      return history.slice(-20).reverse().map((text, i) => ({
        text,
        score: 0,
        positions: [] as number[],
        index: history.length - 1 - i,
      }))
    }

    const results: Array<{ text: string; score: number; positions: number[]; index: number }> = []
    // Search in reverse (most recently used first)
    for (let i = history.length - 1; i >= 0; i--) {
      const match = fuzzyMatch(query, history[i]!)
      if (match) {
        results.push({
          text: history[i]!,
          score: match.score,
          positions: match.positions,
          index: i,
        })
      }
    }

    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, 10)
  }, [query, history])

  // Selected index bounds check
  useEffect(() => {
    if (selectedIdx >= matches.length) {
      setSelectedIdx(Math.max(0, matches.length - 1))
    }
  }, [matches.length, selectedIdx])

  useInput((input, key) => {
    // Esc: close
    if (key.escape) {
      onClose()
      return
    }

    // Enter: take the selected item
    if (key.return) {
      const selected = matches[selectedIdx]
      if (selected) {
        onSelect(selected.text)
      }
      return
    }

    // ↑↓: navigate between results
    if (key.upArrow) {
      setSelectedIdx(i => Math.max(0, i - 1))
      return
    }
    if (key.downArrow) {
      setSelectedIdx(i => Math.min(Math.max(0, matches.length - 1), i + 1))
      return
    }

    // Tab: auto-complete with the first result
    if (key.tab) {
      const first = matches[0]
      if (first) {
        onSelect(first.text)
      }
      return
    }

    // Backspace
    if (key.backspace || key.delete) {
      setQuery(q => q.slice(0, -1))
      return
    }

    // Ctrl+C: close
    if (key.ctrl && input === "c") {
      onClose()
      return
    }

    // Append the character
    if (input && !key.ctrl && !key.meta && !key.tab) {
      setQuery(q => q + input)
      return
    }
  })

  return (
    <Surface variant="raised" tone="accent" paddingX="sm" paddingY="sm" marginX="md">
      <VStack gap="sm">
        {/* Title */}
        <HStack gap="sm">
          <Typo variant="bodyEmphasis" tone="accent">⌕</Typo>
          <Typo variant="bodyEmphasis" tone="accent">reverse search</Typo>
          <Typo variant="caption" tone="muted" dimColor>(Ctrl+R)</Typo>
        </HStack>

        {/* Search input */}
        <HStack gap="sm">
          <Typo variant="body" tone="muted">❯</Typo>
          <Text color={theme.textPrimary}>{query || <Text color={theme.textDim} dimColor>type to search...</Text>}</Text>
          <Text color={theme.accent}>▋</Text>
        </HStack>

        {/* Results */}
        {matches.length > 0 && (
          <VStack gap="none" paddingLeft="md">
            {matches.map((m, i) => (
              <Box key={m.index}>
                {i === selectedIdx && (
                  <Text color={theme.accent}>▶ </Text>
                )}
                {i !== selectedIdx && <Text color={theme.borderBright}>  </Text>}
                <HighlightedText
                  text={m.text.length > 60 ? m.text.slice(0, 57) + "…" : m.text}
                  positions={m.positions}
                  theme={theme}
                />
              </Box>
            ))}
          </VStack>
        )}

        {/* No results */}
        {query && matches.length === 0 && (
          <Typo variant="body" tone="muted" dimColor>  No matches found</Typo>
        )}

        {/* Help */}
        <HStack gap="md" paddingLeft="md">
          <Typo variant="caption" tone="muted" dimColor>↑↓ navigate</Typo>
          <Typo variant="caption" tone="muted" dimColor>Enter select</Typo>
          <Typo variant="caption" tone="muted" dimColor>Tab complete</Typo>
          <Typo variant="caption" tone="muted" dimColor>Esc close</Typo>
        </HStack>
      </VStack>
    </Surface>
  )
}
