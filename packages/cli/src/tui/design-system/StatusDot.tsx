import React from "react"
import { Text } from "ink"
import { useTheme } from "../../utils/theme.js"
import { motionEnabled, usePulseFrame } from "./motion.js"
import { glyph as terminalGlyph } from "../terminal-glyphs.js"

export type StatusTone = "safe" | "warning" | "danger" | "accent" | "muted"

export interface StatusDotProps {
  tone?: StatusTone
  active?: boolean
  size?: "tiny" | "sm" | "md"
}

function toneColor(tone: StatusTone, theme: ReturnType<typeof useTheme>): string {
  switch (tone) {
    case "safe":    return theme.success
    case "warning": return theme.warning
    case "danger":  return theme.error
    case "accent":  return theme.accent
    case "muted":
    default:        return theme.textDim
  }
}

export function StatusDot({ tone = "muted", active = false, size = "sm" }: StatusDotProps) {
  const theme = useTheme()
  const base = toneColor(tone, theme)
  const pulse = usePulseFrame(active)
  let glyph = terminalGlyph(size === "tiny" ? "statusTiny" : "statusOn")
  let color = base
  if (active && motionEnabled()) {
    const phase = pulse % 2 === 0
    color = phase ? base : theme.textDim
  }
  if (!active && tone === "muted") {
    glyph = terminalGlyph("statusOff")
  }
  return <Text color={color}>{glyph}</Text>
}
