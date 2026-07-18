import React, { useEffect, useRef } from "react"
import { Box, Text, useInput } from "ink"
import { useTheme } from "../utils/theme.js"

export interface SelectOption<T extends string = string> {
  id:     T
  label:  string
  hint?:  string
  color?: string
}

interface Props<T extends string = string> {
  options:       SelectOption<T>[]
  selectedIndex: number
  onChange:      (index: number) => void
  onSelect:      (option: SelectOption<T>, index: number) => void
  onCancel?:     () => void
  isActive?:     boolean
  compact?:      boolean
}

export function Select<T extends string = string>({
  options,
  selectedIndex,
  onChange,
  onSelect,
  onCancel,
  isActive = true,
  compact = false,
}: Props<T>) {
  const theme = useTheme()

  // For coalesced (same-tick) arrow keys, the closure's selectedIndex goes stale;
  // the ref updates synchronously on every keypress and realigns when the prop changes.
  const selRef = useRef(selectedIndex)
  useEffect(() => { selRef.current = selectedIndex }, [selectedIndex])

  useInput((_, key) => {
    const previous = compact ? key.leftArrow : key.upArrow
    const next = compact ? key.rightArrow : key.downArrow
    if (previous) { selRef.current = Math.max(0, selRef.current - 1); onChange(selRef.current); return }
    if (next)     { selRef.current = Math.min(options.length - 1, selRef.current + 1); onChange(selRef.current); return }
    if (key.return) {
      const opt = options[selRef.current]
      if (opt) onSelect(opt, selRef.current)
      return
    }
    if (key.escape && onCancel) { onCancel(); return }
  }, { isActive })

  if (compact) {
    const selected = options[selectedIndex]
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" flexWrap="wrap">
          {options.map((opt, i) => {
            const active = i === selectedIndex
            const color = active ? (opt.color ?? theme.accent) : theme.textDim
            return (
              <Box key={opt.id} marginRight={2}>
                <Text color={active ? color : theme.borderBright}>{active ? "❯ " : "  "}</Text>
                <Text color={color} bold={active}>{opt.label}</Text>
              </Box>
            )
          })}
        </Box>
        {selected?.hint && <Text color={theme.borderBright}>{selected.hint}</Text>}
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {options.map((opt, i) => {
        const selected = i === selectedIndex
        const fg = selected ? (opt.color ?? theme.accent) : theme.textDim
        return (
          <Box key={opt.id} gap={1}>
            <Text color={selected ? (opt.color ?? theme.accent) : theme.borderBright}>
              {selected ? "❯" : " "}
            </Text>
            <Text color={fg} bold={selected}>{opt.label}</Text>
            {opt.hint && (
              <Text color={theme.borderBright} dimColor>{opt.hint}</Text>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
