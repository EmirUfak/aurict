import React from "react"
import { Box, Text } from "ink"
import { PermissionRequestTitle } from "./PermissionRequestTitle.js"
import { useTheme } from "../utils/theme.js"

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
  const resolvedTone = tone ?? toneForColor(color, theme)
  const borderColor = color

  const cornerTop = <Text color={borderColor}>┌</Text>
  const cornerBot = <Text color={borderColor}>└</Text>

  return (
    <Box flexDirection="column" marginY={1}>
      <Box flexDirection="row">
        {cornerTop}
        <Text color={borderColor}>{"─".repeat(2)}</Text>
        <Text color={theme.textDim}> awaiting permission </Text>
        <Text color={borderColor}>{"─".repeat(2)}</Text>
      </Box>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={borderColor}
        borderTop={false}
        borderLeft={true}
        borderRight={true}
        borderBottom={true}
      >
        <Box paddingX={2} paddingTop={1} flexDirection="column" marginBottom={1}>
          <PermissionRequestTitle title={title} subtitle={subtitle} color={color} />
        </Box>
        <Box flexDirection="column" paddingX={innerPaddingX} paddingBottom={1}>
          {children}
        </Box>
      </Box>
      <Box flexDirection="row">
        {cornerBot}
        <Text color={borderColor}>{"─".repeat(2)}</Text>
        <Text color={theme.textDim}> {resolvedTone} </Text>
      </Box>
    </Box>
  )
}
