/**
 * Design System — Badge
 *
 * Label/badge component. Used as a status indicator.
 * Tone × variant combinations.
 *
 * Usage:
 *   <Badge tone="success" icon="check">Saved</Badge>
 *   <Badge tone="warning" variant="outline">3 warnings</Badge>
 *   <Badge tone="error" variant="solid">Failed</Badge>
 *   <Badge tone="info" variant="dot">Running</Badge>
 */

import React from "react"
import { Text } from "ink"
import { useTheme } from "../../utils/theme.js"
import { getIcon, type IconName, type IconSet } from "./Icon.js"
import { DesignBox as Box } from "./types.js"

// ── Tipler ────────────────────────────────────────────────────────────────────

export type BadgeTone =
  | "neutral"
  | "primary"
  | "accent"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "muted"

export type BadgeVariant = "solid" | "outline" | "ghost" | "dot"

export interface BadgeProps {
  tone?:     BadgeTone
  variant?:  BadgeVariant
  icon?:     IconName
  iconSet?:  IconSet
  uppercase?: boolean
  bold?:     boolean
  children:  React.ReactNode
}

interface ToneStyle {
  fg:     string
  border: string
}

function toneStyles(tone: BadgeTone, theme: ReturnType<typeof useTheme>): ToneStyle {
  switch (tone) {
    case "success":  return { fg: theme.success, border: theme.success }
    case "warning":  return { fg: theme.warning, border: theme.warning }
    case "error":    return { fg: theme.error,   border: theme.error }
    case "info":     return { fg: theme.accent,  border: theme.accent }
    case "accent":   return { fg: theme.accent,  border: theme.accent }
    case "primary":  return { fg: theme.textPrimary, border: theme.textDim }
    case "muted":    return { fg: theme.textDim,  border: theme.borderDim }
    case "neutral":
    default:         return { fg: theme.textSecondary, border: theme.borderDim }
  }
}

// ── Main component ───────────────────────────────────────────────────────────────

export function Badge({
  tone = "neutral",
  variant = "outline",
  icon,
  iconSet,
  uppercase = false,
  bold = false,
  children,
}: BadgeProps) {
  const theme = useTheme()
  const s     = toneStyles(tone, theme)

  const text = uppercase && typeof children === "string" ? children.toUpperCase() : children
  const renderText = () => {
    if (typeof text === "string") {
      return (
        <Text color={variant === "solid" ? theme.bgHighlight : s.fg} {...(bold ? { bold: true } : {})}>
          {text}
        </Text>
      )
    }
    return <Box>{text}</Box>
  }

  // Dot variant: just ● + label (compact)
  if (variant === "dot") {
    return (
      <Box>
        <Text color={s.fg}>●</Text>
        <Text> </Text>
        {renderText()}
      </Box>
    )
  }

  // Solid: filled box, dark background, light text
  if (variant === "solid") {
    return (
      <Box paddingX={1} backgroundColor={s.fg}>
        {icon && (
          <Text color={theme.bgHighlight}>{getIcon(icon, iconSet)} </Text>
        )}
        {renderText()}
      </Box>
    )
  }

  // Ghost: just colored text + icon
  if (variant === "ghost") {
    return (
      <Box>
        {icon && (
          <>
            <Text color={s.fg}>{getIcon(icon, iconSet)}</Text>
            <Text> </Text>
          </>
        )}
        {renderText()}
      </Box>
    )
  }

  // Outline (default): border + text
  return (
    <Box
      paddingX={1}
      borderStyle="round"
      borderColor={s.border}
    >
      {icon && (
        <>
          <Text color={s.fg}>{getIcon(icon, iconSet)}</Text>
          <Text> </Text>
        </>
      )}
      {renderText()}
    </Box>
  )
}
