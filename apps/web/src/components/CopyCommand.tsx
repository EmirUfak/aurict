"use client"

import { useState } from "react"

export function CopyCommand({ command, color }: { command: string; color: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — command text is still selectable.
    }
  }

  return (
    <button type="button" className="mono copy-command" onClick={handleCopy} style={{ color }}>
      <span className="copy-command-text">{command}</span>
      <span className="copy-command-icon" aria-hidden="true">{copied ? "✓" : "⧉"}</span>
      <span className="sr-only">{copied ? "Copied" : "Copy"}</span>
    </button>
  )
}
