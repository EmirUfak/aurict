import React from "react"
import { Text } from "ink"
import { DesignBox as Box, type DesignBoxProps } from "./types.js"
import { useTheme } from "../../utils/theme.js"

export interface CornersProps extends Omit<DesignBoxProps, "children"> {
  color?: string
  children?: React.ReactNode
}

export function Corners({ color, children, ...rest }: CornersProps) {
  const theme = useTheme()
  const c = color ?? theme.borderActive
  return (
    <Box flexDirection="column" {...rest}>
      <Box flexDirection="row"><Text color={c}>┌</Text></Box>
      {children}
      <Box flexDirection="row"><Text color={c}>└</Text></Box>
    </Box>
  )
}

export type CornerTone = "default" | "accent" | "safe" | "warning" | "danger"
export function cornerColorFor(tone: CornerTone, theme: ReturnType<typeof useTheme>): string {
  switch (tone) {
    case "accent":  return theme.accent
    case "safe":    return theme.success
    case "warning": return theme.warning
    case "danger":  return theme.error
    case "default":
    default:        return theme.borderBright
  }
}
