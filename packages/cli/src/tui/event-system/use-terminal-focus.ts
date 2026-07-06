import { useEffect, useState } from "react"
import { onFocusChange } from "../mouse.js"

/**
 * Terminal penceresinin odakta olup olmadığını izler (DECSET 1004: CSI I
 * odağa girildiğinde, CSI O odaktan çıkıldığında gönderilir). Odak durumu
 * bilinmeyene kadar (henüz hiçbir focus event'i gelmediyse) varsayılan
 * olarak `true` kabul edilir — terminal genelde zaten odaktayken açılır.
 */
export function useTerminalFocus(): boolean {
  const [focused, setFocused] = useState(true)
  useEffect(() => onFocusChange(setFocused), [])
  return focused
}
