/**
 * DiffRenderer — Advanced diff viewer
 *
 * Three modes:
 *  - "unified":      single column with +/- markers
 *  - "side-by-side": old/left, new/right two columns
 *  - "raw":          as-is (colored unified diff)
 *
 * Features:
 *  - Hunk navigation (with n/p)
 *  - Mode toggle (with u)
 *  - Line numbers (old/new separate)
 *  - Word-level inline diff (in side-by-side mode)
 *  - Theme-matched colors
 */

import React, { useState, useMemo } from "react"
import { Box, Text } from "ink"
import { useTheme } from "../../utils/theme.js"
import { HStack, VStack, Badge, KeyHint, Typo, Spacer } from "../design-system/index.js"
import { useBinding, useBindingHints } from "../../keybindings/index.js"
import { useTerminalSize } from "../TerminalSizeContext.js"
import { parseRawDiff, diffTexts, suggestDiffMode, wordDiff,
         wordRangesByLine, type ParsedDiff, type DiffLine, type Hunk, type DiffMode } from "./logic.js"
import { getDiffPalette } from "./palette.js"

// ── Props ────────────────────────────────────────────────────────────────────

export interface DiffRendererProps {
  /** Raw unified diff string, OR */
  rawDiff?:     string
  /** old/new text (alternative) */
  oldText?:     string
  newText?:     string
  fileName?:    string
  /** Initial mode (default: suggestDiffDiffMode) */
  initialMode?: DiffMode
  /** Number of context lines per hunk (for old/new text diffing) */
  contextLines?: number
  /** Maximum number of hunks (to show) */
  maxHunks?:    number
  /** Allow switching modes (u key) */
  enableModeToggle?: boolean
  /** Allow hunk navigation (n/p keys) */
  enableHunkNav?:    boolean
  /** Show an error (e.g. a parse error) */
  onError?:     (e: string) => void
  /** Parent rail/container width */
  width?:       number
}

// ── Main component ──────────────────────────────────────────────────────────────

export function DiffRenderer({
  rawDiff,
  oldText,
  newText,
  fileName,
  initialMode,
  contextLines = 3,
  maxHunks = 10,
  enableModeToggle = true,
  enableHunkNav = true,
  width,
}: DiffRendererProps) {
  const theme = useTheme()
  const [mode, setMode]           = useState<DiffMode>(initialMode ?? "unified")
  const [activeHunk, setActiveHunk] = useState(0)
  const terminalWidth = useTerminalSize().columns
  const renderWidth = Math.max(40, Math.min(width ?? terminalWidth - 8, terminalWidth - 4))

  // Parse: use raw diff if present, otherwise compute from old/new
  const parsed = useMemo<ParsedDiff | null>(() => {
    if (rawDiff) {
      return parseRawDiff(rawDiff)
    }
    if (oldText !== undefined && newText !== undefined) {
      return diffTexts(oldText, newText, contextLines)
    }
    return null
  }, [rawDiff, oldText, newText, contextLines])

  // Mode suggestion
  React.useEffect(() => {
    if (parsed && !initialMode) {
      setMode(suggestDiffMode(parsed))
    }
  }, [parsed, initialMode])

  // Rules of Hooks: all hook calls must come before early returns
  const hunkCount = parsed?.hunks.length ?? 0

  const { hints } = useBindingHints({
    actions: [
      ...(enableModeToggle ? [{ action: "diff.toggle-view" as const, label: "view" }] : []),
      ...(enableHunkNav && hunkCount > 1 ? [
        { action: "diff.next-hunk" as const, label: "next" },
        { action: "diff.prev-hunk" as const, label: "prev" },
      ] : []),
    ],
  })

  // Hunk nav
  useBinding({
    action: "diff.next-hunk",
    context: "modal",
    onTrigger: () => {
      if (!parsed) return
      setActiveHunk((i) => Math.min(i + 1, parsed.hunks.length - 1))
    },
  })
  useBinding({
    action: "diff.prev-hunk",
    context: "modal",
    onTrigger: () => setActiveHunk((i) => Math.max(i - 1, 0)),
  })
  useBinding({
    action: "diff.toggle-view",
    context: "modal",
    onTrigger: () => {
      if (!parsed) return
      // raw mode is only meaningful when rawDiff is present
      if (rawDiff) {
        setMode((m) => m === "unified" ? "side-by-side" : m === "side-by-side" ? "raw" : "unified")
      } else {
        setMode((m) => m === "unified" ? "side-by-side" : "unified")
      }
    },
  })

  if (!parsed) {
    return <Text color={theme.textDim} dimColor>diff: no content</Text>
  }

  if (parsed.hunks.length === 0) {
    return <Text color={theme.textDim} dimColor>diff: no changes</Text>
  }

  const shown = parsed.hunks.slice(0, maxHunks)
  const hidden = parsed.hunks.length - shown.length
  const displayFile = fileName ?? parsed.fileName ?? "code changes"

  return (
    <VStack gap="none" width={renderWidth}>
      {/* Header */}
      <HStack gap="sm" paddingX="xs" width={renderWidth}>
        <Text color={theme.borderBright}>╭─</Text>
        <Typo variant="label" tone="primary">{displayFile}</Typo>
        <Spacer />
        <Text color={theme.success} bold>{`+${parsed.additions}`}</Text>
        <Text color={theme.error} bold>{`-${parsed.deletions}`}</Text>
        <Badge tone="muted" variant="outline">{mode}</Badge>
        {hints.map((h) => (
          <KeyHint key={h.action} action={h.label} keys={h.key} style="plain" />
        ))}
      </HStack>

      {/* Body — renders differently based on mode */}
      {mode === "unified" && (
        <UnifiedView hunks={shown} activeHunk={enableHunkNav ? activeHunk : -1} width={renderWidth} />
      )}
      {mode === "side-by-side" && (
        <SideBySideView hunks={shown} activeHunk={enableHunkNav ? activeHunk : -1} width={renderWidth} />
      )}
      {mode === "raw" && (
        <RawView raw={rawDiff ?? ""} width={renderWidth} />
      )}

      {hidden > 0 && (
        <Text color={theme.textDim} dimColor>⋯ {hidden} more hunk{hidden > 1 ? "s" : ""}</Text>
      )}
    </VStack>
  )
}

// ── Unified view ─────────────────────────────────────────────────────────────

function UnifiedView({ hunks, activeHunk, width }: { hunks: Hunk[]; activeHunk: number; width: number }) {
  const theme = useTheme()
  const palette = getDiffPalette(theme)

  return (
    <VStack gap="none" width={width}>
      {hunks.map((hunk, hi) => (
        <VStack key={hi} gap="none" width={width}
          {...(activeHunk === hi ? { borderStyle: "single" as const, borderColor: theme.accent } : {})}
        >
          <Text backgroundColor={palette.hunkBg}>
            <Text color={activeHunk === hi ? theme.accent : theme.borderBright}>{activeHunk === hi ? "●" : "·"}</Text>
            <Text color={theme.borderBright} dimColor>{padLine(` ${hunk.header}`, width - 1)}</Text>
          </Text>
          <UnifiedLines lines={hunk.lines} width={width} />
        </VStack>
      ))}
    </VStack>
  )
}

function UnifiedLines({ lines, width }: { lines: DiffLine[]; width: number }) {
  const wordRanges = useMemo(() => wordRangesByLine(lines), [lines])
  return <>
    {lines.map((line, index) => (
      <DiffLineView
        key={index}
        line={line}
        width={width}
        {...(wordRanges.has(index) ? { wordRanges: wordRanges.get(index)! } : {})}
      />
    ))}
  </>
}

// ── Side-by-side view ───────────────────────────────────────────────────────

function SideBySideView({ hunks, activeHunk, width }: { hunks: Hunk[]; activeHunk: number; width: number }) {
  const theme = useTheme()
  const palette = getDiffPalette(theme)

  return (
    <VStack gap="none" width={width}>
      {hunks.map((hunk, hi) => (
        <VStack key={hi} gap="none" width={width}
          {...(activeHunk === hi ? { borderStyle: "single" as const, borderColor: theme.accent } : {})}
        >
          <Text backgroundColor={palette.hunkBg} color={theme.borderBright} dimColor>
            {padLine(hunk.header, width)}
          </Text>
          {pairLines(hunk.lines).map((pair, pi) => (
            <SideBySideLine key={pi} left={pair[0]} right={pair[1]} width={width} />
          ))}
        </VStack>
      ))}
    </VStack>
  )
}

/**
 * Pairs up add/remove lines to place them side by side.
 * Context lines appear on both sides.
 */
function pairLines(lines: DiffLine[]): Array<[DiffLine | null, DiffLine | null]> {
  const pairs: Array<[DiffLine | null, DiffLine | null]> = []
  let i = 0
  while (i < lines.length) {
    const l = lines[i]!
    if (l.type === "context") {
      pairs.push([l, l])
      i++
    } else if (l.type === "remove") {
      // Put the matching add on the right side, if there is one
      const next = lines[i + 1]
      if (next && next.type === "add") {
        pairs.push([l, next])
        i += 2
      } else {
        pairs.push([l, null])
        i++
      }
    } else if (l.type === "add") {
      pairs.push([null, l])
      i++
    } else {
      i++
    }
  }
  return pairs
}

function SideBySideLine({ left, right, width }: { left: DiffLine | null; right: DiffLine | null; width: number }) {
  const theme = useTheme()
  const halfW = Math.max(18, Math.floor((width - 1) / 2))

  return (
    <Box flexDirection="row">
      {/* Left — old */}
      <SideLineCell line={left} counterpart={right} width={halfW} />
      {/* Divider */}
      <Text color={theme.borderDim}>│</Text>
      {/* Right — new */}
      <SideLineCell line={right} counterpart={left} width={halfW} />
    </Box>
  )
}

function SideLineCell({
  line, counterpart, width,
}: { line: DiffLine | null; counterpart: DiffLine | null; width: number }) {
  const theme = useTheme()
  const palette = getDiffPalette(theme)
  const contentWidth = Math.max(8, width - 7)

  if (!line) {
    return <Box width={width} flexShrink={0}>
      <Text backgroundColor={palette.baseBg} color={theme.borderDim} dimColor>{" ".repeat(width)}</Text>
    </Box>
  }

  const lineNumber = (line.oldLineNum ?? line.newLineNum)?.toString().padStart(4) ?? "    "
  const lineBg = line.type === "add" ? palette.addBg : palette.removeBg
  const marker = line.type === "add" ? "+" : line.type === "remove" ? "-" : "│"
  const markerColor = line.type === "add" ? theme.success : line.type === "remove" ? theme.error : theme.borderDim

  if (line.type === "context") {
    return <Box width={width} flexShrink={0}>
      <Text color={theme.textDim}>{lineNumber}</Text>
      <Text color={markerColor}> {marker} </Text>
      <Text color={theme.textDim} dimColor>{truncate(line.content, contentWidth)}</Text>
    </Box>
  }

  // Add/Remove: show word-level inline diff
  if (counterpart && counterpart.type !== "context" && counterpart.type !== line.type) {
    // There's a matching line, show word-based diff
    const a = line.type === "remove" ? line.content : counterpart.content
    const b = line.type === "add"    ? line.content : counterpart.content
    const { removed, added } = wordDiff(a, b)
    const ranges = line.type === "remove" ? removed : added
    const wordBg = line.type === "add" ? palette.addWordBg : palette.removeWordBg

    return (
      <Box width={width} flexShrink={0}>
        <Text backgroundColor={lineBg}>
          <Text color={markerColor}>{lineNumber} {marker} </Text>
          <Text color={theme.textPrimary}>
            {renderHighlighted(truncate(line.content, contentWidth), ranges, wordBg)}
          </Text>
          {" ".repeat(Math.max(0, width - 7 - truncate(line.content, contentWidth).length))}
        </Text>
      </Box>
    )
  }

  return (
    <Box width={width} flexShrink={0}>
      <Text backgroundColor={lineBg}>
        <Text color={markerColor}>{lineNumber} {marker} </Text>
        <Text color={theme.textPrimary}>{truncate(line.content, contentWidth)}</Text>
        {" ".repeat(Math.max(0, width - 7 - truncate(line.content, contentWidth).length))}
      </Text>
    </Box>
  )
}

function renderHighlighted(text: string, ranges: Array<{ start: number; end: number }>, backgroundColor: string) {
  if (ranges.length === 0) return text
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const parts: React.ReactNode[] = []
  let cursor = 0
  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i]!
    const start = Math.min(Math.max(r.start, cursor), text.length)
    const end = Math.min(Math.max(r.end, start), text.length)
    if (start > cursor) parts.push(text.slice(cursor, start))
    if (end > start) parts.push(<Text key={i} backgroundColor={backgroundColor} bold>{text.slice(start, end)}</Text>)
    cursor = end
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s
}

function padLine(text: string, width: number): string {
  const content = truncate(text, width)
  return content + " ".repeat(Math.max(0, width - content.length))
}

// ── Raw view ─────────────────────────────────────────────────────────────────

function RawView({ raw, width }: { raw: string; width: number }) {
  const theme = useTheme()
  const palette = getDiffPalette(theme)
  if (!raw) return <Text color={theme.textDim} dimColor>(no raw diff)</Text>
  const lines = raw.split("\n")
  return (
    <VStack gap="none" paddingX="xs" width={width}>
      {lines.map((line, i) => {
        const lineWidth = Math.max(1, width - 2)
        if (line.startsWith("+++") || line.startsWith("---")) {
          return <Box key={i} width={lineWidth}><Text backgroundColor={palette.hunkBg} color={theme.accent} bold>{padLine(line, lineWidth)}</Text></Box>
        }
        if (line.startsWith("@@")) {
          return <Box key={i} width={lineWidth}><Text backgroundColor={palette.hunkBg} color={theme.warning}>{padLine(line, lineWidth)}</Text></Box>
        }
        if (line.startsWith("+")) {
          return <Box key={i} width={lineWidth}><Text backgroundColor={palette.addBg} color={theme.textPrimary}>{padLine(line, lineWidth)}</Text></Box>
        }
        if (line.startsWith("-")) {
          return <Box key={i} width={lineWidth}><Text backgroundColor={palette.removeBg} color={theme.textPrimary}>{padLine(line, lineWidth)}</Text></Box>
        }
        return <Box key={i} width={lineWidth}><Text color={theme.textDim}>{truncate(line, lineWidth)}</Text></Box>
      })}
    </VStack>
  )
}

// ── Single-line display (for unified) ────────────────────────────────────

function DiffLineView({
  line, width, wordRanges = [],
}: { line: DiffLine; width: number; wordRanges?: Array<{ start: number; end: number }> }) {
  const theme = useTheme()
  const palette = getDiffPalette(theme)
  const contentWidth = Math.max(10, width - 16)
  const oldNo = line.oldLineNum?.toString().padStart(4) ?? "    "
  const newNo = line.newLineNum?.toString().padStart(4) ?? "    "
  const content = truncate(line.content, contentWidth)
  const padding = " ".repeat(Math.max(0, width - 12 - content.length))

  if (line.type === "add") {
    return (
      <Box width={width}>
        <Text backgroundColor={palette.addBg}>
          <Text color={theme.textDim}>{oldNo}</Text>
          <Text color={theme.textDim}> </Text>
          <Text color={theme.success}>{newNo}</Text>
          <Text> </Text>
          <Text color={theme.success} bold>+</Text>
          <Text color={theme.textPrimary}> {renderHighlighted(content, wordRanges, palette.addWordBg)}</Text>
          {padding}
        </Text>
      </Box>
    )
  }
  if (line.type === "remove") {
    return (
      <Box width={width}>
        <Text backgroundColor={palette.removeBg}>
          <Text color={theme.error}>{oldNo}</Text>
          <Text color={theme.textDim}> </Text>
          <Text color={theme.textDim}>{newNo}</Text>
          <Text> </Text>
          <Text color={theme.error} bold>-</Text>
          <Text color={theme.textPrimary}> {renderHighlighted(content, wordRanges, palette.removeWordBg)}</Text>
          {padding}
        </Text>
      </Box>
    )
  }
  return (
    <Box width={width}>
      <Text color={theme.textDim}>{oldNo}</Text>
      <Text color={theme.textDim}> </Text>
      <Text color={theme.textDim}>{newNo}</Text>
      <Text color={theme.borderDim}> │</Text>
      <Text color={theme.textDim}> {truncate(line.content, contentWidth)}</Text>
    </Box>
  )
}
