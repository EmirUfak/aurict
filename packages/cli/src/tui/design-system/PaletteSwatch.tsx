import React from "react"
import { Text } from "ink"
import { useTheme, THEMES, BRAND_PALETTE_IDS, type BrandPaletteId } from "../../utils/theme.js"

export interface PaletteSwatchProps {
  paletteId: BrandPaletteId
  selected?: boolean
}

export function PaletteSwatch({ paletteId, selected }: PaletteSwatchProps) {
  const theme = useTheme()
  const palette = THEMES[paletteId]
  if (!palette) return null
  const ink = palette.accentInk ?? theme.textPrimary
  const chevron = selected ? "❯" : " "
  const check = selected ? " ✓" : "  "
  return (
    <Text>
      <Text color={selected ? theme.accent : theme.textDim}>{chevron} </Text>
      <Text color={palette.accent} backgroundColor={ink}>  {palette.name}  </Text>
      <Text color={theme.textDim} dimColor>{check}</Text>
    </Text>
  )
}

export function PaletteSwatchRow({ currentId }: { currentId: string }) {
  return (
    <React.Fragment>
      {BRAND_PALETTE_IDS.map((id) => (
        <PaletteSwatch key={id} paletteId={id} selected={id === currentId} />
      ))}
    </React.Fragment>
  )
}
