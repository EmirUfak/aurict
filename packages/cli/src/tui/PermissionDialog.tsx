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
  const { columns } = useTerminalSize()
  const resolvedTone = tone ?? toneForColor(color, theme)
  const borderColor = color
  const horizontalInset = shellHorizontalInset(columns)
  const width = Math.max(1, columns - horizontalInset * 2)
  const contentPadding = columns < 36 ? 1 : innerPaddingX

  return (
    <Box flexDirection="column" paddingLeft={horizontalInset}>
      <Box
        flexDirection="column"
        width={width}
        borderStyle={prefersAsciiGlyphs() ? "classic" : "round"}
        borderColor={borderColor}
        {...(theme.bgCard !== undefined ? { backgroundColor: theme.bgCard } : {})}
      >
        <Box paddingX={contentPadding} flexDirection="column">
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={borderColor} bold wrap="truncate-end">
              {glyph("action")} Permission {glyph("statusTiny")} {title}
              {subtitle ? ` ${glyph("statusTiny")} ${subtitle}` : ""}
            </Text>
            {columns >= 54 && <Text color={borderColor}>{resolvedTone}</Text>}
          </Box>
        </Box>
        <Box flexDirection="column" paddingX={contentPadding}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}
