import React, { useState } from "react"
import { Box, Text, useInput } from "./design-system/renderer.js"
import { useTheme } from "../utils/theme.js"

interface Props {
  title:       string
  placeholder: string | undefined
  secret:      boolean | undefined
  onSubmit:    (value: string) => void
  onCancel:    () => void
}

export function PromptInput({ title, placeholder = "", secret = false, onSubmit, onCancel }: Props) {
  const theme   = useTheme()
  const [value, setValue] = useState("")
  const [cursor, setCursorPos] = useState(0)

  useInput((input, key) => {
    if (key.escape) { onCancel(); return }

    if (key.return) {
      const trimmed = value.trim()
      if (trimmed) onSubmit(trimmed)
      return
    }

    if (key.backspace || key.delete) {
      if (cursor > 0) {
        setValue((v) => v.slice(0, cursor - 1) + v.slice(cursor))
        setCursorPos((c) => c - 1)
      }
      return
    }

    if (key.leftArrow)  { setCursorPos((c) => Math.max(0, c - 1)); return }
    if (key.rightArrow) { setCursorPos((c) => Math.min(value.length, c + 1)); return }

    if (input && !key.ctrl && !key.meta) {
      setValue((v) => v.slice(0, cursor) + input + v.slice(cursor))
      setCursorPos((c) => c + input.length)
    }
  })

  const displayed = secret ? "•".repeat(value.length) : value
  const beforeCursor = displayed.slice(0, cursor)
  const atCursor     = displayed[cursor] ?? " "
  const afterCursor  = displayed.slice(cursor + 1)

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.accent}
      paddingX={2}
      paddingY={1}
      marginX={2}
      marginY={1}
    >
      <Text color={theme.accent} bold>{title}</Text>
      <Box marginTop={1} flexDirection="row" gap={1}>
        <Text color={theme.accent}>❯</Text>
        <Box flexDirection="row">
          <Text color={theme.textPrimary}>{beforeCursor}</Text>
          <Text color={theme.accentInk ?? theme.bgHighlight} backgroundColor={theme.accent}>{atCursor}</Text>
          <Text color={theme.textPrimary}>{afterCursor}</Text>
        </Box>
      </Box>
      {!value && placeholder && (
        <Text color={theme.textDim} dimColor>{placeholder}</Text>
      )}
      <Box marginTop={1}>
        <Text color={theme.textDim} dimColor>Enter to confirm · Esc to cancel</Text>
      </Box>
    </Box>
  )
}
