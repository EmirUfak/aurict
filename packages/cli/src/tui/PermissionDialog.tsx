import React from "react"
import { Box, Text } from "./design-system/renderer.js"
import { useTheme } from "../utils/theme.js"
import { useTerminalSize } from "./TerminalSizeContext.js"
import { glyph, prefersAsciiGlyphs } from "./terminal-glyphs.js"
import { shellHorizontalInset } from "./app-shell/layout-metrics.js"

export type PermissionTone = "safe" | "warning" | "danger" | "accent"

interface Props {
  title:          string
  subtitle?:      string | undefined
  color:          string
  tone?:          PermissionTone
  innerPaddingX?: number | undefined
  children?:      React.ReactNode
}

function toneForColor(color: string, theme: ReturnType<typeof useTheme>): PermissionTone {
  if (color === theme.error)   return "danger"
  if (color === theme.warning) return "warning"
  if (color === theme.success) return "safe"
  return "accent"
}

export function PermissionDialog({ title, subtitle, color, tone, innerPaddingX = 2, children }: Props) {
  const theme = useTheme()
  const { columns, rows } = useTerminalSize()
  const resolvedTone = tone ?? toneForColor(color, theme)
  const borderColor = color
  const horizontalInset = shellHorizontalInset(columns)
  const width = Math.max(1, Math.min(columns - horizontalInset * 2, 104))
  const contentPadding = columns < 36 ? 1 : innerPaddingX

  return (
    <Box flexDirection="row" width={columns} justifyContent="center">
      <Box
        flexDirection="column"
        marginY={rows < 28 ? 0 : 1}
        width={width}
        borderStyle={prefersAsciiGlyphs() ? "classic" : "round"}
        borderColor={borderColor}
        {...(theme.bgCard !== undefined ? { backgroundColor: theme.bgCard } : {})}
      >
        <Box paddingX={contentPadding} flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={borderColor} bold wrap="truncate-end">
              {glyph("headingMajor")} Permission required {glyph("statusTiny")} {title}
              {subtitle ? ` ${glyph("statusTiny")} ${subtitle}` : ""}
            </Text>
            <Text color={borderColor}>{resolvedTone.toUpperCase()}</Text>
          </Box>
        </Box>
        <Box flexDirection="column" paddingX={contentPadding}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}
