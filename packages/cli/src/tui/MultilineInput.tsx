import React, { useState, useEffect, useRef, useLayoutEffect } from "react"
import { Box, Text, useInput, measureElement, type DOMElement } from "ink"
import { stripVTControlCharacters } from "node:util"
import { useTheme } from "../utils/theme.js"
import { useMouseEvents } from "./mouse.js"
import { measureAbsolutePosition } from "./event-system/measure-position.js"
import { writeClipboard } from "../util/clipboard.js"

// Safe paste size: very large pastes lock up the terminal
const MAX_PASTE_CHARS = 50_000

interface Props {
  value:              string
  onChange:           (v: string) => void
  onSubmit:           (v: string) => void
  disabled:           boolean
  history:            string[]
  inlineSuggestionActive?: boolean
  onPasteTruncated?:  (originalLen: number, truncatedLen: number) => void
  onPasteStart?:      () => void
  onPasteEnd?:        () => void
  onCopied?:          (charCount: number) => void
}

export interface LocalPoint { row: number; col: number }

/** Extracts the text within the (row, col) range between two points from `lines`. */
export function extractRange(lines: string[], a: LocalPoint, b: LocalPoint): string {
  const [start, end] = a.row < b.row || (a.row === b.row && a.col <= b.col) ? [a, b] : [b, a]
  if (start.row === end.row) {
    const line = lines[start.row] ?? ""
    return line.slice(Math.min(start.col, end.col), Math.max(start.col, end.col))
  }
  const parts: string[] = []
  parts.push((lines[start.row] ?? "").slice(start.col))
  for (let r = start.row + 1; r < end.row; r++) parts.push(lines[r] ?? "")
  parts.push((lines[end.row] ?? "").slice(0, end.col))
  return parts.join("\n")
}

function splitLines(v: string): string[] {
  const ls = v.split("\n")
  return ls.length > 0 ? ls : [""]
}

function wordLeft(line: string, col: number): number {
  let i = col
  while (i > 0 && /\s/.test(line[i - 1]!)) i--
  while (i > 0 && /\S/.test(line[i - 1]!)) i--
  return i
}

function wordRight(line: string, col: number): number {
  const len = line.length
  let i = col
  while (i < len && /\S/.test(line[i]!)) i++
  while (i < len && /\s/.test(line[i]!)) i++
  return i
}

// For pasted text: ANSI strip + \r normalization + size limit + bracketed paste cleanup
export function sanitizePaste(raw: string): string {
  return stripVTControlCharacters(raw)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\x1b\[200~/g, "")  // Bracketed paste start
    .replace(/\x1b\[201~/g, "")  // Bracketed paste end
    .replace(/\[200~/g, "")      // variant without ESC
    .replace(/\[201~/g, "")      // variant without ESC
    .slice(0, MAX_PASTE_CHARS)
}

// For normal input: strip VT escape codes, convert \r → \n, bracketed paste cleanup
function sanitizeInput(raw: string): string {
  return stripVTControlCharacters(raw)
    .replace(/\r/g, "\n")
    .replace(/\x1b\[200~/g, "")
    .replace(/\x1b\[201~/g, "")
    .replace(/\[200~/g, "")
    .replace(/\[201~/g, "")
}

export function MultilineInput({ value, onChange, onSubmit, disabled, history, inlineSuggestionActive = false, onPasteTruncated, onPasteStart, onPasteEnd, onCopied }: Props) {
  const theme = useTheme()

  const [lines, setLines]   = useState<string[]>(() => splitLines(value))
  const [cursor, setCursor] = useState<{ row: number; col: number }>({ row: 0, col: 0 })
  const [hIdx, setHIdx]     = useState(-1)
  const draftRef            = useRef<string[]>([""])
  const isPastingRef        = useRef(false)
  const pasteBufferRef      = useRef("")
  const linesRef            = useRef(lines)
  const cursorRef           = useRef(cursor)
  const boxRef              = useRef<DOMElement>(null)
  const boundsRef           = useRef({ row: 0, col: 0, width: 0, height: 0 })
  const dragStartRef        = useRef<LocalPoint | null>(null)

  // Keep refs in sync with state
  useEffect(() => { linesRef.current = lines }, [lines])
  useEffect(() => { cursorRef.current = cursor }, [cursor])

  // Update the input box's absolute on-screen bounds after every render
  // — needed so click/release events (absolute terminal coordinates from
  // mouse.ts) can be converted to a local row/col.
  useLayoutEffect(() => {
    if (!boxRef.current) return
    const pos  = measureAbsolutePosition(boxRef.current)
    const size = measureElement(boxRef.current)
    boundsRef.current = { row: pos.row, col: pos.col, width: size.width, height: size.height }
  })

  // Absolute terminal (x,y) [1-based] → local (row,col) within the box, or
  // null if out of bounds (meaning this click isn't related to the input box).
  // In a multi-line input, the line-number gutter ("N │ ") shifts the text
  // right — so the gutter width is subtracted from the column calculation.
  function toLocalPoint(x: number, y: number): LocalPoint | null {
    const b = boundsRef.current
    const localRow = y - 1 - b.row
    const rawCol   = x - 1 - b.col
    if (localRow < 0 || localRow >= b.height || rawCol < 0 || rawCol > b.width) return null
    const currentLines = linesRef.current
    const showLineNum  = currentLines.length > 1
    const gutterWidth  = showLineNum ? String(currentLines.length).length + 3 : 0
    const clampedRow   = Math.min(localRow, currentLines.length - 1)
    const lineLen      = (currentLines[clampedRow] ?? "").length
    const textCol      = Math.max(0, rawCol - gutterWidth)
    return { row: clampedRow, col: Math.min(textCol, lineLen) }
  }

  useMouseEvents((e) => {
    if (disabled) return
    if (e.type === "click") {
      dragStartRef.current = toLocalPoint(e.x, e.y)
      return
    }
    if (e.type === "release") {
      const start = dragStartRef.current
      dragStartRef.current = null
      const end = toLocalPoint(e.x, e.y)
      if (!start || !end) return
      if (start.row === end.row && start.col === end.col) {
        // No drag — a plain click: position the cursor there.
        setCursor({ row: end.row, col: end.col })
        return
      }
      const text = extractRange(linesRef.current, start, end)
      if (text) {
        writeClipboard(text)
        onCopied?.(text.length)
      }
    }
  })

  // lines → value
  useEffect(() => {
    onChange(lines.join("\n"))
  }, [lines]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync when the external value changes (e.g. after clear)
  const prevValueRef = useRef(value)
  useEffect(() => {
    const joined = lines.join("\n")
    if (value !== joined && value !== prevValueRef.current) {
      const next = splitLines(value)
      setLines(next)
      const lastRow = Math.max(0, next.length - 1)
      setCursor({ row: lastRow, col: (next[lastRow] ?? "").length })
    }
    prevValueRef.current = value
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  // Paste operation: insert the sanitized text at the cursor
  function applyPaste(raw: string) {
    const normalized  = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    const pasted      = sanitizePaste(raw)
    if (!pasted) return
    if (normalized.length > MAX_PASTE_CHARS) {
      onPasteTruncated?.(raw.length, pasted.length)
    }
    const pastedLines = pasted.split("\n")
    const currentCursor = cursorRef.current
    setLines(prev => {
      const next   = [...prev]
      const before = (next[currentCursor.row] ?? "").slice(0, currentCursor.col)
      const after  = (next[currentCursor.row] ?? "").slice(currentCursor.col)
      next[currentCursor.row] = before + pastedLines[0]!
      const rest = pastedLines.slice(1)
      if (rest.length > 0) {
        rest[rest.length - 1] = rest[rest.length - 1]! + after
        next.splice(currentCursor.row + 1, 0, ...rest)
      } else {
        next[currentCursor.row] += after
      }
      return next
    })
    const lastLine = pastedLines[pastedLines.length - 1]!
    setCursor(c => ({
      row: c.row + pastedLines.length - 1,
      col: pastedLines.length === 1 ? c.col + lastLine.length : lastLine.length,
    }))
  }

  useInput((input, key) => {
    if (disabled) return

    // ── Mouse escape sequence filter ────────────────────────────────────
    // Catch sequences here that slip past the emit-level filter.
    // When Ink consumes \x1b as an ESC keypress, the remaining "[<65;206;45M"
    // part arrives as a separate useInput event and gets written into the text.
    if (/^\[<\d+;\d+;\d+[Mm]/.test(input)) return  // SGR remainder (ESC consumed)
    if (/^\x1b\[<\d+;\d+;\d+[Mm]/.test(input)) return  // SGR full
    if (/^\[M[\s\S]/.test(input)) return  // X10 remainder

    // ── SSH/tmux DEL character (\x7f) ─────────────────────────────────────
    // Some terminal emulators produce \x7f instead of backspace
    if (!key.backspace && !key.delete && input.includes("\x7f")) {
      const count = (input.match(/\x7f/g) ?? []).length
      for (let i = 0; i < count; i++) {
        setLines(prev => {
          const next = [...prev]
          const line = next[cursor.row] ?? ""
          if (cursor.col > 0) {
            next[cursor.row] = line.slice(0, cursor.col - 1) + line.slice(cursor.col)
            setCursor(c => ({ ...c, col: Math.max(0, c.col - 1) }))
          } else if (cursor.row > 0) {
            const prevLine = next[cursor.row - 1] ?? ""
            next[cursor.row - 1] = prevLine + line
            next.splice(cursor.row, 1)
            setCursor({ row: cursor.row - 1, col: prevLine.length })
          }
          return next
        })
      }
      return
    }

    // ── Bracketed paste ────────────────────────────────────────────────
    // A full paste event's marker + content can arrive together; marker-only
    // fragments are ignored, and events with content are applied as a paste.
    if (
      input.includes("\x1b[200~") || input.includes("\x1b[201~") ||
      input.includes("[200~") || input.includes("[201~")
    ) {
      applyPaste(input)
      return
    }
    if (input === "\x1b" || input === "\x1b[") {
      return
    }

    if (inlineSuggestionActive && (key.upArrow || key.downArrow || key.tab || key.return)) {
      return
    }

    // ── Kitty CSI u: Shift+Enter = \x1b[13;2u ────────────────────────────
    if (input === "\x1b[13;2u") {
      setLines(prev => {
        const next  = [...prev]
        const line  = next[cursor.row] ?? ""
        next[cursor.row] = line.slice(0, cursor.col)
        next.splice(cursor.row + 1, 0, line.slice(cursor.col))
        return next
      })
      setCursor(c => ({ row: c.row + 1, col: 0 }))
      return
    }

    // ── Submit ────────────────────────────────────────────────────────────
    if (key.return && !key.shift && !key.ctrl && !key.meta) {
      const text = lines.join("\n").trim()
      if (!text) return
      setLines([""])
      setCursor({ row: 0, col: 0 })
      setHIdx(-1)
      draftRef.current = [""]
      onSubmit(text)
      return
    }

    // ── Shift+Enter / Ctrl+Enter: new line ──────────────────────────────
    if ((key.return && key.shift) || (key.return && key.ctrl)) {
      setLines(prev => {
        const next = [...prev]
        const line = next[cursor.row] ?? ""
        next[cursor.row] = line.slice(0, cursor.col)
        next.splice(cursor.row + 1, 0, line.slice(cursor.col))
        return next
      })
      setCursor(c => ({ row: c.row + 1, col: 0 }))
      return
    }

    // ── Escape: collapse to a single line if multi-line ───────────────────
    if (key.escape) {
      if (lines.length > 1) {
        const joined = lines.join(" ")
        setLines([joined])
        setCursor({ row: 0, col: Math.min(cursor.col, joined.length) })
      }
      return
    }

    // ── Up arrow ─────────────────────────────────────────────────────────
    if (key.upArrow) {
      if (cursor.row > 0) {
        setCursor(c => {
          const newRow = c.row - 1
          return { row: newRow, col: Math.min(c.col, (lines[newRow] ?? "").length) }
        })
        return
      }
      if (history.length === 0) return
      if (hIdx === -1) {
        draftRef.current = [...lines]
        const next = history.length - 1
        setHIdx(next)
        const ls = splitLines(history[next] ?? "")
        setLines(ls)
        setCursor({ row: ls.length - 1, col: (ls[ls.length - 1] ?? "").length })
      } else {
        const next = Math.max(0, hIdx - 1)
        setHIdx(next)
        const ls = splitLines(history[next] ?? "")
        setLines(ls)
        setCursor({ row: ls.length - 1, col: (ls[ls.length - 1] ?? "").length })
      }
      return
    }

    // ── Down arrow ──────────────────────────────────────────────────────────
    if (key.downArrow) {
      if (cursor.row < lines.length - 1) {
        setCursor(c => {
          const newRow = c.row + 1
          return { row: newRow, col: Math.min(c.col, (lines[newRow] ?? "").length) }
        })
        return
      }
      if (hIdx === -1) return
      const next = hIdx + 1
      if (next >= history.length) {
        setHIdx(-1)
        const draft = draftRef.current
        setLines(draft)
        setCursor({ row: draft.length - 1, col: (draft[draft.length - 1] ?? "").length })
      } else {
        setHIdx(next)
        const ls = splitLines(history[next] ?? "")
        setLines(ls)
        setCursor({ row: ls.length - 1, col: (ls[ls.length - 1] ?? "").length })
      }
      return
    }

    // ── Ctrl+Left / Alt+B: word left ─────────────────────────────────────
    // Depending on terminal: \x1b[1;5D (xterm), \x1b[5D (vt), \x1bb (emacs Alt+B)
    if (
      input === "\x1b[1;5D" || input === "\x1b[5D" || input === "\x1bb" ||
      input === "\x1b[1;3D" || (key.ctrl && key.leftArrow)
    ) {
      setCursor(c => {
        const line = lines[c.row] ?? ""
        const newCol = wordLeft(line, c.col)
        if (newCol === 0 && c.col === 0 && c.row > 0) {
          const prevRow = c.row - 1
          return { row: prevRow, col: (lines[prevRow] ?? "").length }
        }
        return { row: c.row, col: newCol }
      })
      return
    }

    // ── Ctrl+Right / Alt+F: word right ─────────────────────────────────────
    // Depending on terminal: \x1b[1;5C (xterm), \x1b[5C (vt), \x1bf (emacs Alt+F)
    if (
      input === "\x1b[1;5C" || input === "\x1b[5C" || input === "\x1bf" ||
      input === "\x1b[1;3C" || (key.ctrl && key.rightArrow)
    ) {
      setCursor(c => {
        const line = lines[c.row] ?? ""
        const newCol = wordRight(line, c.col)
        if (newCol === line.length && c.col === line.length && c.row < lines.length - 1) {
          return { row: c.row + 1, col: 0 }
        }
        return { row: c.row, col: newCol }
      })
      return
    }

    // ── Left arrow ────────────────────────────────────────────────────────────
    if (key.leftArrow) {
      setCursor(c => {
        if (c.col > 0) return { row: c.row, col: c.col - 1 }
        if (c.row > 0) return { row: c.row - 1, col: (lines[c.row - 1] ?? "").length }
        return c
      })
      return
    }

    // ── Right arrow ────────────────────────────────────────────────────────────
    if (key.rightArrow) {
      setCursor(c => {
        const lineLen = (lines[c.row] ?? "").length
        if (c.col < lineLen) return { row: c.row, col: c.col + 1 }
        if (c.row < lines.length - 1) return { row: c.row + 1, col: 0 }
        return c
      })
      return
    }

    // ── Ctrl+Backspace / Ctrl+W / Alt+Backspace: delete word ──────────────
    // Verified with real user data via AURICT_DEBUG_KEYS=1: Ink converts known
    // escape sequences into its own key.*/input pair BEFORE they reach
    // `useInput` — the raw bytes are NOT PRESERVED in `input`.
    // So the two checks below ACTUALLY work (verified end-to-end):
    //   - key.delete && key.meta  → Ctrl+Backspace OR Alt+Backspace in the
    //     gnome-terminal family; Ink produces this from \x1b\x7f.
    //   - key.ctrl && input==="w" → Ctrl+W; Ink always reports Ctrl+<letter>
    //     as {ctrl:true, input:"<letter>"} (\x17 never appears literally in input).
    // The raw string matches below (\x17/\x1b\x7f/\x08/\x1b[127;5u) practically
    // NEVER match in ink 5, since Ink consumes these sequences as EXPLAINED
    // ABOVE (verified via the same diagnostic process — \x08 arrives as bare
    // {backspace:true}, indistinguishable from plain backspace; kitty CSI-u
    // gets split into TWO SEPARATE events, ESC and "[127;5u").
    // Left in anyway as a harmless defensive fallback, in case some future
    // terminal/Ink version passes the raw sequence through unchanged.
    if (
      (key.backspace && key.ctrl) || (key.delete && key.meta) || (key.ctrl && input === "w") ||
      input === "\x17" || input === "\x1b\x7f" || input === "\x08" || input === "\x1b[127;5u"
    ) {
      const row = cursor.row
      const col = cursor.col
      setLines(prev => {
        const next  = [...prev]
        const line  = next[row] ?? ""
        const newCol = wordLeft(line, col)
        next[row] = line.slice(0, newCol) + line.slice(col)
        setCursor({ row, col: newCol })
        return next
      })
      return
    }

    // ── Backspace ─────────────────────────────────────────────────────────
    if (key.backspace || key.delete) {
      // Read the cursor beforehand — avoid async state inside setLines
      const row = cursor.row
      const col = cursor.col
      setLines(prev => {
        const next = [...prev]
        const line = next[row] ?? ""
        if (col > 0) {
          next[row] = line.slice(0, col - 1) + line.slice(col)
          setCursor({ row, col: col - 1 })
        } else if (row > 0) {
          const prevLine = next[row - 1] ?? ""
          next[row - 1] = prevLine + line
          next.splice(row, 1)
          setCursor({ row: row - 1, col: prevLine.length })
        }
        return next
      })
      return
    }

    // ── Printable character / non-bracketed paste ──────────────────────────
    if (input && !key.ctrl && !key.meta) {
      const clean = sanitizeInput(input)
      if (!clean) return

      // SSH coalesced Enter: arrives as "text\r" — the trailing \r means Enter
      // e.g. on slow SSH, "o" + Enter arrives combined as "o\r"
      if (clean.length > 1 && clean.endsWith("\n") && !clean.slice(0, -1).includes("\n")) {
        const textPart = clean.slice(0, -1)
        const currentLines = [...linesRef.current]
        const line = currentLines[cursor.row] ?? ""
        currentLines[cursor.row] = line.slice(0, cursor.col) + textPart + line.slice(cursor.col)
        const text = currentLines.join("\n").trim()
        if (text) {
          setLines([""])
          setCursor({ row: 0, col: 0 })
          onSubmit(text)
        }
        return
      }

      // Non-bracketed paste: if it contains \n or \r, treat it as a paste
      // (for terminals/SSH that don't support bracketed paste)
      if (clean.includes("\n")) {
        applyPaste(clean)
        return
      }

      // Normal single/multi-character insertion
      setLines(prev => {
        const next = [...prev]
        const line = next[cursor.row] ?? ""
        next[cursor.row] = line.slice(0, cursor.col) + clean + line.slice(cursor.col)
        return next
      })
      setCursor(c => ({ ...c, col: c.col + clean.length }))
    }
  }, { isActive: !disabled })

  return (
    <Box ref={boxRef} flexDirection="column" flexGrow={1} flexShrink={1}>
      {lines.map((line, i) => {
        // Show line numbers in a multi-line input
        const showLineNum = lines.length > 1
        const lineNumWidth = String(lines.length).length
        const lineNum = showLineNum ? String(i + 1).padStart(lineNumWidth, " ") : ""

        if (i !== cursor.row || disabled) {
          return (
            <Box key={i} flexDirection="row">
              {showLineNum && (
                <Text color={theme.textDim} dimColor>{lineNum} │ </Text>
              )}
              <Text wrap="wrap">{line || " "}</Text>
            </Box>
          )
        }
        // Cursor line
        // Note: nested <Text> inside <Text wrap="wrap"> creates a separate Yoga node,
        // breaking inline flow and causing stacked rendering after history navigation.
        // Instead, use three sibling <Text> components in a flexDirection="row" Box.
        const safeCol = Math.min(cursor.col, line.length)
        const before  = line.slice(0, safeCol)
        const at      = line[safeCol] ?? " "
        const after   = line.slice(safeCol + 1)
        return (
          <Box key={i} flexDirection="row">
            {showLineNum && (
              <Text color={theme.accent} dimColor>{lineNum} │ </Text>
            )}
            <Text>{before}</Text>
            <Text backgroundColor={theme.accent} color="black">{at}</Text>
            <Text>{after}</Text>
          </Box>
        )
      })}
    </Box>
  )
}
