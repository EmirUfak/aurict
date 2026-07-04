import React from "react"
import { Box, Text } from "ink"
import { PermissionRequestTitle } from "./PermissionRequestTitle.js"
import { useTheme } from "../utils/theme.js"

interface Props {
  title:          string
  subtitle?:      string | undefined
  color:          string
  innerPaddingX?: number | undefined
  children?:      React.ReactNode
}

export function PermissionDialog({ title, subtitle, color, innerPaddingX = 2, children }: Props) {
  const theme = useTheme()
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={color}
      borderTop={true}
      borderLeft={true}
      borderRight={true}
      borderBottom={true}
      marginY={1}
    >
      <Box paddingX={2} paddingTop={1} flexDirection="column" marginBottom={1}>
        <Box gap={1}>
          <Text color={color}>◆</Text>
          <Text color={theme.textDim}>PERMISSION GATE</Text>
          <Text color={theme.borderBright}>╞══════╪══════╡</Text>
        </Box>
        <PermissionRequestTitle title={title} subtitle={subtitle} color={color} />
      </Box>
      <Box flexDirection="column" paddingX={innerPaddingX} paddingBottom={1}>
        {children}
      </Box>
    </Box>
  )
}
