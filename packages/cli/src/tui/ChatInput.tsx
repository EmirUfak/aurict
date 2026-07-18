/**
 * ChatInput — User input area (Cockpit v2)
 *
 * MultilineInput + mode indicator + prompt marker inside a bordered
 * container + an (optional) queued-message indicator. A segmented hint bar
 * below. Border color changes based on disabled/paste state.
 *
 * Design system: VStack, HStack, Surface, Typo.
 */

import React from "react"
import { Box, Text } from "ink"
import { MultilineInput } from "./MultilineInput.js"
import { useTheme } from "../utils/theme.js"
import { HStack, VStack, Surface, Typo } from "./design-system/index.js"
import { useTerminalSize } from "./TerminalSizeContext.js"
import type { ComposerQueueItem } from "./composer-queue.js"
import { glyph, terminalText } from "./terminal-glyphs.js"
import { useSemanticTheme } from "./theme/semantic-theme.js"

interface Props {
  value:              string
  onChange:           (v: string) => void
  onSubmit:           (v: string) => void
  onQueue?:           ((v: string) => void) | undefined
  disabled:           boolean
  working?:           boolean | undefined
  history?:           string[]
  queued?:            ComposerQueueItem[] | undefined
  inlineSuggestionActive?: boolean
  onInputTruncated?:  (originalLen: number, truncatedLen: number) => void
  onCopied?:          (charCount: number) => void
}

// Bottom hint-bar cells — chosen based on terminal width
const HINTS: { key: string; label: string }[] = [
  { key: "/", label: "commands" },
  { key: "@", label: "files" },
  { key: "⌃P", label: "more" },
]

export function ChatInput({ value, onChange, onSubmit, onQueue, disabled, working = false, history = [], queued, inlineSuggestionActive = false, onInputTruncated, onCopied }: Props) {
  const theme = useTheme()
  const semantic = useSemanticTheme()
  const promptChar = glyph("headingMinor")
  const borderColor = disabled ? theme.borderDim : theme.borderActive

  const termCols  = useTerminalSize().columns
  const isNarrow  = termCols < 80
  const hints     = termCols >= 100 ? HINTS : HINTS.slice(0, 2)
  const showHints = termCols >= 60
  const charCount = value.length

  const Sep = () => <Text color={theme.borderDim}> {glyph("statusTiny")} </Text>

  return (
    <VStack flexGrow={1} flexShrink={1}>
      {queued && queued.length > 0 && (
        <HStack paddingX="md" gap="xs">
          <Typo variant="body" tone="warning">{queued[0]!.kind}</Typo>
          <Typo variant="body" tone="muted" dimColor>"{queued[0]!.text.slice(0, 42)}{queued[0]!.text.length > 42 ? glyph("ellipsis") : ""}"</Typo>
          {queued.length > 1 && <Typo variant="body" tone="muted" dimColor>+{queued.length - 1}</Typo>}
        </HStack>
      )}

      <Surface
        variant="raised"
        tone="default"
        accentColor={borderColor}
        {...(theme.bgCard !== undefined ? { backgroundColor: theme.bgCard } : {})}
        paddingX="md"
        paddingY="none"
        flexGrow={1}
        flexShrink={1}
      >
        <HStack flexGrow={1} flexShrink={1} gap="xs">
          <Typo
            variant="bodyEmphasis"
            tone={disabled ? "muted" : "accentAlt"}
            bold
          >
            {promptChar}
          </Typo>
          <Box flexGrow={1} flexShrink={1}>
            <MultilineInput
              value={value}
              onChange={onChange}
              onSubmit={onSubmit}
              {...(working && onQueue ? { onQueue } : {})}
              disabled={disabled}
              history={history}
              inlineSuggestionActive={inlineSuggestionActive}
              placeholder={working ? "Steer the next step…" : "Ask Aurict to plan, explain, or build…"}
              {...(onInputTruncated !== undefined ? { onInputTruncated } : {})}
              {...(onCopied !== undefined ? { onCopied } : {})}
            />
          </Box>
          {!isNarrow && charCount > 0 && <Typo variant="caption" tone="muted" dimColor>{charCount.toLocaleString()}</Typo>}
        </HStack>
      </Surface>

      {showHints && (
        <HStack paddingX="md" justify="space-between">
          <HStack gap="none">
            {hints.map((h, i) => (
              <React.Fragment key={h.key}>
                {i > 0 && <Sep />}
                <Text color={semantic.status.info} bold>{terminalText(h.key)}</Text>
                <Text color={theme.textDim}> {h.label}</Text>
              </React.Fragment>
            ))}
          </HStack>
          <Text color={theme.textDim}>
            {working ? `Enter steer ${glyph("statusTiny")} Tab queue` : `${terminalText("⇧⏎")} newline ${glyph("statusTiny")} Enter send`}
          </Text>
        </HStack>
      )}
    </VStack>
  )
}
