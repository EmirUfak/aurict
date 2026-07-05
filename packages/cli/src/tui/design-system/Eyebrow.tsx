import React from "react"
import { Text, type TextProps } from "ink"
import { useTheme } from "../../utils/theme.js"

export interface EyebrowProps extends Omit<TextProps, "color"> {
  tone?: "default" | "accent" | "muted" | "safe" | "warning" | "danger"
}

function toneColor(tone: NonNullable<EyebrowProps["tone"]>, theme: ReturnType<typeof useTheme>): string {
  switch (tone) {
    case "accent":  return theme.accent
    case "safe":    return theme.success
    case "warning": return theme.warning
    case "danger":  return theme.error
    case "muted":   return theme.textDim
    case "default":
    default:        return theme.textLabel ?? theme.textDim
  }
}

export function Eyebrow({ tone = "default", children, ...rest }: EyebrowProps) {
  const theme = useTheme()
  const color = toneColor(tone, theme)
  const text = typeof children === "string" ? children.toUpperCase() : children
  return (
    <Text color={color} bold {...rest}>
      {text}
    </Text>
  )
}

export interface MonoStatProps {
  value:      string | number
  label:      string
  valueTone?: "default" | "accent" | "accentAlt" | "safe" | "warning" | "danger" | "muted"
  labelTone?: "default" | "muted"
}

export function MonoStat({ value, label, valueTone = "default", labelTone = "muted" }: MonoStatProps) {
  const theme = useTheme()
  const vColor = (() => {
    switch (valueTone) {
      case "accent":     return theme.accent
      case "accentAlt":  return theme.accentAlt
      case "safe":       return theme.success
      case "warning":    return theme.warning
      case "danger":     return theme.error
      case "muted":      return theme.textDim
      case "default":
      default:           return theme.textPrimary
    }
  })()
  const lColor = labelTone === "default" ? theme.textSecondary : theme.textDim
  return (
    <Text>
      <Text color={vColor} bold>{value}</Text>
      <Text color={lColor} dimColor>{" "}{label}</Text>
    </Text>
  )
}
