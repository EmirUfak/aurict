"use client"

import { useState } from "react"

type CopyCommandProps = {
  command: string
  color?: string
  className?: string
  label?: string
  copiedLabel?: string
}

export function CopyCommand({ command, color, className = "mono copy-command", label, copiedLabel = "Copied" }: CopyCommandProps) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command)
      setCopyFailed(false)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch (error) {
      console.error("Unable to copy command to the clipboard.", error)
      setCopyFailed(true)
      setTimeout(() => setCopyFailed(false), 1600)
    }
  }

  return (
    <button type="button" className={className} onClick={handleCopy} style={color ? { color } : undefined}>
      {label ? <span>{copied ? copiedLabel : label}</span> : <>
        <span className="copy-command-text">{command}</span>
        <span className="copy-command-icon" aria-hidden="true">{copied ? "✓" : "⧉"}</span>
      </>}
      <span className="sr-only" aria-live="polite">{copyFailed ? "Unable to copy" : copied ? "Copied" : `Copy ${command}`}</span>
    </button>
  )
}
