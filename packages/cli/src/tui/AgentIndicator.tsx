import React, { useState, useEffect } from "react"
import { Box, Text } from "./design-system/renderer.js"
import { useTheme } from "../utils/theme.js"
import { motionEnabled } from "./design-system/motion.js"

export type IndicatorState = "idle" | "thinking" | "working"

const IDLE_QUIPS = [
  "ready.",
  "go ahead.",
  "listening.",
  "what's next?",
  "at your command.",
  "standing by.",
]

interface Props {
  state:      IndicatorState
  activeTool?: string | undefined
}

export function AgentIndicator({ state, activeTool }: Props) {
  const theme = useTheme()
  const [quipIdx, setQuipIdx] = useState(0)

  useEffect(() => {
    if (state !== "idle" || !motionEnabled()) return
    const t = setInterval(() => setQuipIdx(i => (i + 1) % IDLE_QUIPS.length), 5000)
    return () => clearInterval(t)
  }, [state])

  const label =
    state === "thinking" ? "thinking…" :
    state === "working"  ? (activeTool ? activeTool + "…" : "working…") :
    IDLE_QUIPS[quipIdx]!

  const color =
    state === "idle"     ? theme.textDim :
    state === "thinking" ? theme.accent  :
    theme.warning

  const dot =
    state === "idle"     ? "▸" :
    state === "thinking" ? "◌" :
    "◉"

  return (
    <Box paddingRight={1} alignItems="center" flexShrink={0}>
      <Text color={color} dimColor={state === "idle"}>
        {dot} {label}{"  "}
      </Text>
    </Box>
  )
}
