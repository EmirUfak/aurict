import React, { useState, useEffect, useRef, memo } from "react"
import { Box, Text } from "./design-system/renderer.js"
import { useTheme } from "../utils/theme.js"
import { motionEnabled } from "./design-system/motion.js"

const FRAMES = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"]
const GLIMMER_MS = 60

const VERBS: Record<string, string> = {
  bash:          "Running",
  shell:         "Running",
  read:          "Reading",
  write:         "Writing",
  edit:          "Editing",
  glob:          "Searching",
  grep:          "Searching",
  webfetch:      "Fetching",
  websearch:     "Searching",
  todo:          "Checking",
  apply_patch:   "Patching",
  lsp:           "Checking",
  subagent:      "Spawning",
  task_create:   "Planning",
  task_update:   "Updating",
  task_complete: "Completing",
  plan_enter:    "Planning",
  plan_verify:   "Verifying",
  undo:          "Undoing",
  question:      "Asking",
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  return `${m}m ${Math.floor(s % 60)}s`
}

// Glimmer: a bright sweep over the given text
function GlimmerText({ text, glimmer, activeColor, dimColor }: {
  text: string
  glimmer: number
  activeColor: string
  dimColor: string
}) {
  const chars = text.split("")
  return (
    <>
      {chars.map((ch, i) => {
        const dist = Math.abs(i - glimmer)
        return (
          <Text key={i} color={dist <= 1 ? activeColor : dimColor}>
            {ch}
          </Text>
        )
      })}
    </>
  )
}

interface Props {
  activeTool?: string | undefined
}

export const Spinner = memo(function Spinner({ activeTool }: Props) {
  const theme = useTheme()

  // Single combined tick state: frame counter increments every GLIMMER_MS (the
  // shortest interval). Derived values are computed during render — no extra
  // setState calls per tick, so Ink only redraws once per tick instead of 3×.
  const [tick, setTick] = useState(0)
  const startRef        = useRef(Date.now())
  const verbLenRef      = useRef(0)

  const verbLabel = activeTool ? (VERBS[activeTool] ?? "Working") : "Thinking"
  verbLenRef.current = verbLabel.length

  // Derive per-render values from the single tick counter
  const frame   = Math.floor(tick / 2) % FRAMES.length                    // updates every ~120ms
  const glimmer = tick % (verbLenRef.current + 4)                          // updates every ~60ms
  const elapsed = Date.now() - startRef.current

  useEffect(() => {
    startRef.current = Date.now()
    setTick(0)
    const canMove = motionEnabled()
    // One timer at the finest granularity (GLIMMER_MS = 60ms).
    // Elapsed is read from Date.now() on each render — no separate 500ms timer needed.
    const timer = setInterval(() => setTick(n => n + 1), canMove ? GLIMMER_MS : 500)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool])

  const spin = FRAMES[frame]!

  return (
    <Box gap={1} paddingX={2} marginBottom={1}>
      <Text color={theme.accent}>{spin}</Text>
      <Box>
        <GlimmerText
          text={verbLabel}
          glimmer={glimmer}
          activeColor={theme.textPrimary}
          dimColor={theme.textDim}
        />
        <Text color={theme.textDim}>…</Text>
      </Box>
      <Text color={theme.borderBright} dimColor>{formatElapsed(elapsed)}</Text>
    </Box>
  )
})
