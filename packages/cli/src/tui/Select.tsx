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
}

export function Select<T extends string = string>({
  options,
  selectedIndex,
  onChange,
  onSelect,
  onCancel,
  isActive = true,
}: Props<T>) {
  const theme = useTheme()

  // Coalesced (aynı tick) ok tuşlarında closure'daki selectedIndex bayat kalır;
  // ref her tuşta senkron güncellenir, prop değişince yeniden hizalanır.
  const selRef = useRef(selectedIndex)
  useEffect(() => { selRef.current = selectedIndex }, [selectedIndex])

  useInput((_, key) => {
    if (key.upArrow)   { selRef.current = Math.max(0, selRef.current - 1); onChange(selRef.current); return }
    if (key.downArrow) { selRef.current = Math.min(options.length - 1, selRef.current + 1); onChange(selRef.current); return }
    if (key.return) {
      const opt = options[selRef.current]
      if (opt) onSelect(opt, selRef.current)
      return
    }
    if (key.escape && onCancel) { onCancel(); return }
  }, { isActive })

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
