/**
 * Design System — Typography
 *
 * Consistent typography hierarchy. Each variant uses a theme-matched color and weight.
 *
 * Levels (hierarchy from top to bottom):
 * - Display: large headings (banner, onboarding)
 * - Title:   section titles
 * - Heading: subheading
 * - Body:    normal text (default)
 * - Caption: small description
 * - Mono:    code-style (path, identifier)
 * - Label:   label, badge
 */

import React from "react"
import { Text, type TextProps } from "ink"
import { useTheme } from "../../utils/theme.js"

// ── Typography variants ─────────────────────────────────────────────────────

export type TextVariant =
  | "display"
  | "title"
  | "heading"
  | "subheading"
  | "body"
  | "bodyEmphasis"
  | "caption"
  | "label"
  | "code"
  | "kbd"

export type TextTone =
  | "default"
  | "primary"
  | "secondary"
  | "muted"
  | "dim"
  | "accent"
  | "accentAlt"
  | "success"
  | "warning"
  | "error"
  | "user"
  | "assistant"

export interface TypoProps extends Omit<TextProps, "color"> {
  variant?: TextVariant
  tone?:    TextTone
  bold?:    boolean
  italic?:  boolean
  dim?:     boolean
  underline?: boolean
  strikethrough?: boolean
  inverse?: boolean
  uppercase?: boolean
  children:  React.ReactNode
}

// ── Variant → style mapping ───────────────────────────────────────────────────

interface VariantStyle {
  bold?:    boolean
  italic?:  boolean
  dim?:     boolean
}

const VARIANT_DEFAULT_STYLE: Record<TextVariant, VariantStyle> = {
  display:     { bold: true },
  title:       { bold: true },
  heading:     { bold: true },
  subheading:  {},
  body:        {},
  bodyEmphasis:{ bold: true },
  caption:     { dim: true },
  label:       { bold: true },
  code:        {},
  kbd:         { bold: true },
}

// ── Tone → color mapping ──────────────────────────────────────────────────────

function toneColor(tone: TextTone, theme: ReturnType<typeof useTheme>): string {
  switch (tone) {
    case "primary":    return theme.textPrimary
    case "secondary":  return theme.textSecondary
    case "muted":      return theme.textSecondary
    case "dim":        return theme.textDim
    case "accent":     return theme.accent
    case "accentAlt":  return theme.accentAlt
    case "success":    return theme.success
    case "warning":    return theme.warning
    case "error":      return theme.error
    case "user":       return theme.userColor
    case "assistant":  return theme.assistantDot
    case "default":
    default:           return theme.textPrimary
  }
}

// ── Main component ───────────────────────────────────────────────────────────────

export function Typo({
  variant = "body",
  tone = "default",
  bold,
  italic,
  dim,
  underline,
  strikethrough,
  inverse,
  uppercase,
  children,
  ...rest
}: TypoProps) {
  const theme = useTheme()
  const def   = VARIANT_DEFAULT_STYLE[variant]
  const finalBold    = bold ?? def.bold
  const finalItalic  = italic ?? def.italic
  const finalDim     = dim ?? def.dim

  const color = toneColor(tone, theme)

  let content: React.ReactNode = children
  if (uppercase && typeof children === "string") {
    content = children.toUpperCase()
  }

  return (
    <Text
      color={color}
      {...(finalBold ? { bold: true } : {})}
      {...(finalItalic ? { italic: true } : {})}
      {...(finalDim ? { dimColor: true } : {})}
      {...(underline ? { underline: true } : {})}
      {...(strikethrough ? { strikethrough: true } : {})}
      {...(inverse ? { inverse: true } : {})}
      {...rest}
    >
      {content}
    </Text>
  )
}

// ── Shortcut components (more semantic) ────────────────────────────────────────

export const T = Typo
export const TextDisplay     = (p: Omit<TypoProps, "variant">) => <Typo {...p} variant="display" />
export const TextTitle       = (p: Omit<TypoProps, "variant">) => <Typo {...p} variant="title" />
export const TextHeading     = (p: Omit<TypoProps, "variant">) => <Typo {...p} variant="heading" />
export const TextSubheading  = (p: Omit<TypoProps, "variant">) => <Typo {...p} variant="subheading" />
export const TextBody        = (p: Omit<TypoProps, "variant">) => <Typo {...p} variant="body" />
export const TextBodyEmphasis= (p: Omit<TypoProps, "variant">) => <Typo {...p} variant="bodyEmphasis" />
export const TextCaption     = (p: Omit<TypoProps, "variant">) => <Typo {...p} variant="caption" />
export const TextLabel       = (p: Omit<TypoProps, "variant">) => <Typo {...p} variant="label" />
export const TextCode        = (p: Omit<TypoProps, "variant">) => <Typo {...p} variant="code" />
export const TextKbd         = (p: Omit<TypoProps, "variant">) => <Typo {...p} variant="kbd" />

// ── Theme-aware tonal colors (special variants) ───────────────────────────────

export const Tone = {
  Primary:    "primary"    as TextTone,
  Secondary:  "secondary"  as TextTone,
  Muted:      "muted"      as TextTone,
  Dim:        "dim"        as TextTone,
  Accent:     "accent"     as TextTone,
  AccentAlt:  "accentAlt"  as TextTone,
  Success:    "success"    as TextTone,
  Warning:    "warning"    as TextTone,
  Error:      "error"      as TextTone,
  User:       "user"       as TextTone,
  Assistant:  "assistant"  as TextTone,
}
