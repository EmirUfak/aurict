/**
 * ChatInput — User input area (Cockpit v2)
 *
 * MultilineInput + mode indicator + prompt marker inside a bordered
 * container + an (optional) queued-message indicator. A segmented hint bar
 * below. Border color changes based on disabled/paste state.
 *
 * Design system: VStack, HStack, Surface, Typo.
 */

import React, { useState } from "react"
import { Box, Text } from "ink"
import { MultilineInput } from "./MultilineInput.js"
import { useTheme } from "../utils/theme.js"
import { HStack, VStack, Surface, Typo } from "./design-system/index.js"
import { useTerminalSize } from "./TerminalSizeContext.js"

interface Props {
  value:              string
  onChange:           (v: string) => void
  onSubmit:           (v: string) => void
  disabled:           boolean
  history?:           string[]
  queued?:            string | undefined
  inlineSuggestionActive?: boolean
  onPasteTruncated?:  (originalLen: number, truncatedLen: number) => void
  onCopied?:          (charCount: number) => void
}

// Bottom hint-bar cells — chosen based on terminal width
const HINTS_WIDE: { key: string; label: string }[] = [
  { key: "/",   label: "cmd" },
  { key: "⌃P",  label: "palette" },
  { key: "⌃T",  label: "tasks" },
  { key: "⌃X",  label: "agents" },
  { key: "⌃R",  label: "history" },
  { key: "@",   label: "file" },
]
const HINTS_SHORT: { key: string; label: string }[] = [
  { key: "/",  label: "cmd" },
  { key: "⌃P", label: "palette" },
  { key: "@",  label: "file" },
]

export function ChatInput({ value, onChange, onSubmit, disabled, history = [], queued, inlineSuggestionActive = false, onPasteTruncated, onCopied }: Props) {
  const theme = useTheme()
  const [isPasting, setIsPasting] = useState(false)
  const promptChar = "❯"
  const borderColor = isPasting ? theme.warning : disabled ? theme.borderDim : theme.borderActive

  // Mod etiketi: paste / working / INSERT
  const modeLabel = isPasting ? "PASTE" : disabled ? "BUSY" : "INSERT"
  const modeColor = isPasting ? theme.warning : disabled ? theme.textDim : theme.accent

  const termCols  = useTerminalSize().columns
  const isNarrow  = termCols < 80
  const hints     = termCols >= 100 ? HINTS_WIDE : HINTS_SHORT
  const showHints = !isPasting && !isNarrow
  const charCount = value.length

  const Sep = () => <Text color={theme.borderDim}> · </Text>

  return (
    <VStack flexGrow={1} flexShrink={1}>
      {queued && (
        <HStack paddingX="md" gap="xs">
          <Typo variant="body" tone="warning" dimColor>queued</Typo>
          <Typo variant="body" tone="muted" dimColor>"{queued.slice(0, 50)}{queued.length > 50 ? "…" : ""}"</Typo>
        </HStack>
      )}

      <Surface
        variant="flat"
        tone="default"
        accentColor={borderColor}
        {...(theme.bgCard !== undefined ? { backgroundColor: theme.bgCard } : {})}
        paddingX="md"
        paddingY="none"
        flexGrow={1}
        flexShrink={1}
        header={!isNarrow ? (
          <HStack justify="space-between" paddingX="xs">
            <Text color={modeColor} bold>{modeLabel}</Text>
            <Text color={theme.textDim} dimColor>
              {disabled ? "Aurict is working" : charCount > 0 ? `${charCount.toLocaleString()} chars` : "Ask, plan, or build"}
            </Text>
          </HStack>
        ) : undefined}
      >
        {!disabled && !value && !isNarrow && (
          <HStack paddingX="xs" gap="sm">
            <Text color={theme.textDim} dimColor>Try</Text>
            <Text color={theme.textSecondary}>describe a task</Text>
            <Text color={theme.borderDim}>·</Text>
            <Text color={theme.accent}>/plan</Text>
            <Text color={theme.borderDim}>·</Text>
            <Text color={theme.accentAlt}>@file</Text>
          </HStack>
        )}
        <HStack flexGrow={1} flexShrink={1} gap="xs">
          <Typo
            variant="bodyEmphasis"
            tone={disabled ? "muted" : isPasting ? "warning" : "accentAlt"}
            bold
          >
            {promptChar}
          </Typo>
          <Box flexGrow={1} flexShrink={1}>
            <MultilineInput
              value={value}
              onChange={onChange}
              onSubmit={onSubmit}
              disabled={disabled}
              history={history}
              inlineSuggestionActive={inlineSuggestionActive}
              {...(onPasteTruncated !== undefined ? { onPasteTruncated } : {})}
              {...(onCopied !== undefined ? { onCopied } : {})}
              onPasteStart={() => setIsPasting(true)}
              onPasteEnd={() => setIsPasting(false)}
            />
          </Box>
          {disabled && !isNarrow && <Typo variant="body" tone="muted" dimColor>working…</Typo>}
          {!disabled && !isNarrow && value.trim() && (
            <Typo variant="caption" tone="accent" dimColor>Enter send</Typo>
          )}
        </HStack>
      </Surface>

      {/* ── Segmented hint bar ── */}
      {showHints && (
        <HStack paddingLeft="md" gap="none">
          {hints.map((h, i) => (
            <React.Fragment key={h.key}>
              {i > 0 && <Sep />}
              <Text color={theme.warning} bold>{h.key}</Text>
              <Text color={theme.textDim} dimColor> {h.label}</Text>
            </React.Fragment>
          ))}
          {termCols >= 100 && (
            <>
              <Sep />
              <Text color={theme.textDim} dimColor>⇧⏎ newline</Text>
            </>
          )}
        </HStack>
      )}
    </VStack>
  )
}
