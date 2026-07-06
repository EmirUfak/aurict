/**
 * ChatInput — Kullanıcı giriş alanı (Cockpit v2)
 *
 * Border'lı bir container içinde MultilineInput + mod göstergesi + prompt işareti
 * + (opsiyonel) queued mesaj göstergesi. Altta segmentli ipucu barı.
 * Border rengi disabled/paste durumuna göre değişir.
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

// Alt ipucu barı hücreleri — terminal genişliğine göre seçilir
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
        paddingX="md"
        paddingY="none"
        flexGrow={1}
        flexShrink={1}
      >
        <HStack flexGrow={1} flexShrink={1} gap="xs">
          {!isNarrow && (
            <Text color={modeColor} bold>{modeLabel} </Text>
          )}
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
        </HStack>
      </Surface>

      {/* ── Segmentli ipucu barı ── */}
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
