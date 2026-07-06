import React, { useState } from "react"
import { Box, Text, useInput } from "ink"
import { Markdown } from "./Markdown.js"
import { useTheme } from "../utils/theme.js"

const SPIN_FRAMES = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"]

interface Props {
  question: string
  answer:   string   // loading when empty
  loading:  boolean
  frame:    number   // spinner frame (comes from App)
  onClose:  () => void
}

export function BtwPanel({ question, answer, loading, frame, onClose }: Props) {
  const theme = useTheme()
  const lines = answer.split("\n")
  const [offset, setOffset] = useState(0)
  const PAGE = 15

  useInput((_char, key) => {
    if (key.escape || key.return) { onClose(); return }
    if (key.upArrow)   setOffset((o) => Math.max(0, o - 1))
    if (key.downArrow) setOffset((o) => Math.min(Math.max(0, lines.length - PAGE), o + 1))
  })

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.accentAlt}
         marginX={1} marginY={1} paddingX={1}>
      {/* Title */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Box gap={1}>
          <Text color={theme.accentAlt} bold>btw</Text>
          <Text color={theme.textSecondary}>{question.slice(0, 60)}{question.length > 60 ? "…" : ""}</Text>
        </Box>
        <Text color={theme.textDim}>Esc close</Text>
      </Box>

      {/* Content */}
      {loading ? (
        <Box gap={1} paddingY={1}>
          <Text color={theme.accent}>{SPIN_FRAMES[frame % SPIN_FRAMES.length]}</Text>
          <Text color={theme.textDim}>thinking...</Text>
        </Box>
      ) : answer ? (
        <Box flexDirection="column">
          <Markdown content={lines.slice(offset, offset + PAGE).join("\n")} />
          {lines.length > PAGE && (
            <Text color={theme.textDim} dimColor>
              {offset + 1}–{Math.min(offset + PAGE, lines.length)} / {lines.length}  ↑↓ scroll
            </Text>
          )}
        </Box>
      ) : (
        <Text color={theme.textDim} italic>No response received.</Text>
      )}
    </Box>
  )
}
