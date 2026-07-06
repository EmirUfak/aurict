import { useEffect, useState } from "react"
import { onFocusChange } from "../mouse.js"

/**
 * Tracks whether the terminal window is focused (DECSET 1004: CSI I is sent
 * on focus-in, CSI O on focus-out). Until the focus state is known (no
 * focus event has arrived yet), it defaults to `true` — the terminal
 * usually starts out already focused.
 */
export function useTerminalFocus(): boolean {
  const [focused, setFocused] = useState(true)
  useEffect(() => onFocusChange(setFocused), [])
  return focused
}
