import React, { useState, useEffect, useRef } from "react"
import { Box, Text } from "ink"
import { createHash } from "node:crypto"
import { userInfo } from "node:os"
import { useTheme } from "../utils/theme.js"
import { CompanionSprite } from "../companion/CompanionSprite.js"
import {
  loadCompanion, saveCompanion, addXP, getToolQuip, getQuip,
  type CompanionState, type Mood,
} from "../companion/index.js"

export type PetState = "idle" | "thinking" | "working" | "error"

// ── Name generator ──────────────────────────────────────────────────────────────

const NAMES = [
  "Kibo","Mochi","Sora","Nova","Pixel","Byte",
  "Ember","Rune","Lyra","Chip","Blaze","Coda",
]

function deriveName(workdir: string): string {
  const hash = createHash("md5").update(userInfo().username + workdir).digest("hex")
  return NAMES[parseInt(hash.slice(0, 4), 16) % NAMES.length]!
}

// ── Speech bubble ────────────────────────────────────────────────────────────

function Bubble({ text, color }: { text: string; color: string }) {
  return (
    <Box flexDirection="column" marginRight={1} alignItems="flex-end">
      <Box borderStyle="round" borderColor={color} paddingX={1}>
        <Text color={color}>{text}</Text>
      </Box>
      <Box marginRight={1}><Text color={color}>╰</Text></Box>
    </Box>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  state?:      PetState
  activeTool?: string
  workdir?:    string
}

function petStateToMood(state: PetState, activeTool?: string): Mood {
  if (state === "error")    return "error"
  if (state === "thinking") return "thinking"
  if (state === "working")  return "working"
  return "idle"
}

// ── Main component ───────────────────────────────────────────────────────────────

export function Buddy({ state = "idle", activeTool, workdir = "" }: Props) {
  const theme     = useTheme()
  const [companion, setCompanion] = useState<CompanionState>(() => loadCompanion())
  const [quip,      setQuip]      = useState<string | undefined>(undefined)
  const [bubble,    setBubble]    = useState(false)
  const prevState  = useRef<PetState>("idle")
  const prevTool   = useRef<string | undefined>(undefined)
  const quipTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const displayName = companion.customName ?? deriveName(workdir)
  const mood        = petStateToMood(state, activeTool)

  // XP: award 1 XP per tool call when activeTool changes to a new value
  useEffect(() => {
    if (activeTool && activeTool !== prevTool.current) {
      prevTool.current = activeTool
      const { state: newState } = addXP(companion, 2)
      setCompanion(newState)
      saveCompanion({ ...newState, totalToolCalls: newState.totalToolCalls + 1 })
    }
  }, [activeTool])

  // Quip: show on state change
  useEffect(() => {
    if (prevState.current === state) return
    prevState.current = state

    if (quipTimer.current) clearTimeout(quipTimer.current)

    let quipText: string
    if (state === "working" && activeTool) {
      const q = getToolQuip(activeTool)
      quipText = q.text
    } else {
      const category = state === "idle" ? "idle" : state === "thinking" ? "idle" : "idle"
      const q = getQuip(state === "idle" ? "idle" : "tool_generic")
      quipText = q.text
    }

    setQuip(quipText)
    setBubble(true)
    quipTimer.current = setTimeout(() => { setBubble(false); setQuip(undefined) }, 3500)
    return () => { if (quipTimer.current) clearTimeout(quipTimer.current) }
  }, [state, activeTool])

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (quipTimer.current) clearTimeout(quipTimer.current) }
  }, [])

  const color = mood === "error"    ? (theme.error   ?? "#ff6b6b")
              : mood === "working"  ? (theme.warning ?? "#f0a500")
              : mood === "thinking" ? (theme.accent  ?? "#7ab4e8")
              : (theme.buddyMain   ?? "#d77757")

  return (
    <Box flexDirection="row" alignItems="flex-end">
      {bubble && quip && <Bubble text={quip} color={color} />}
      <Box flexDirection="column" alignItems="center">
        <CompanionSprite
          speciesId={companion.speciesId}
          {...(companion.hatId !== undefined ? { hatId: companion.hatId } : {})}
          mood={mood}
        />
        <Text color={theme.textDim ?? "#71717a"} dimColor>{displayName}</Text>
      </Box>
    </Box>
  )
}

// ── XP award helper (for App.tsx to call on message send) ────────────────────

export function awardMessageXP(): void {
  try {
    const state = loadCompanion()
    const { state: newState } = addXP(state, 1)
    saveCompanion({ ...newState, totalMessages: newState.totalMessages + 1 })
  } catch { /* non-fatal */ }
}
