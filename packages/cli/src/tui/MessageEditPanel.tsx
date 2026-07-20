import React, { useState } from "react"
import { Box, Text, useInput } from "./design-system/renderer.js"
import { useTheme } from "../utils/theme.js"
import { Typo } from "./design-system/index.js"

interface Props {
  original: string
  onSubmit: (newText: string) => void
  onCancel: () => void
}

export function MessageEditPanel({ original, onSubmit, onCancel }: Props) {
  const theme = useTheme()
  const [value, setValue] = useState(original)
  const [cursor, setCursor] = useState(original.length)

  useInput((input, key) => {
    if (key.escape)  { onCancel(); return }
    if (key.return)  { const t = value.trim(); if (t) onSubmit(t); return }

    if (key.backspace || key.delete) {
      if (cursor === 0) return
      setValue(v => v.slice(0, cursor - 1) + v.slice(cursor))
      setCursor(c => c - 1)
      return
    }
    if (key.leftArrow)  { setCursor(c => Math.max(0, c - 1)); return }
    if (key.rightArrow) { setCursor(c => Math.min(value.length, c + 1)); return }
    if (key.ctrl && input === "a") { setCursor(0); return }
    if (key.ctrl && input === "e") { setCursor(value.length); return }
    if (key.ctrl && input === "k") { setValue(v => v.slice(0, cursor)); return }
    if (key.ctrl && input === "u") { setValue(v => v.slice(cursor)); setCursor(0); return }

    if (!key.ctrl && !key.meta && input && input.length === 1) {
      setValue(v => v.slice(0, cursor) + input + v.slice(cursor))
      setCursor(c => c + 1)
    }
  })

  // Build display: value with cursor injected
  const before = value.slice(0, cursor)
  const after  = value.slice(cursor)

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.warning}
      paddingX={1}
      marginBottom={1}
    >
      <Box justifyContent="space-between" marginBottom={0}>
        <Typo variant="bodyEmphasis" tone="primary">Edit message</Typo>
        <Typo variant="caption" tone="muted">Enter confirm  Esc cancel  ^A/^E home/end  ^K/^U cut</Typo>
      </Box>
      <Text color={theme.borderDim}>{"─".repeat(60)}</Text>
      <Box>
        <Text color={theme.warning}>❯ </Text>
        <Text color={theme.textPrimary}>{before}</Text>
        <Text color={theme.accent} inverse>{after[0] ?? " "}</Text>
        <Text color={theme.textPrimary}>{after.slice(1)}</Text>
      </Box>
      <Box marginTop={0}>
        <Typo variant="caption" tone="muted">Original: </Typo>
        <Text color={theme.textDim} dimColor wrap="truncate-end">{original.slice(0, 60)}{original.length > 60 ? "…" : ""}</Text>
      </Box>
    </Box>
  )
}
