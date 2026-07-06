import React, { useState, useEffect, useRef, memo } from "react"
import { Box, Text } from "ink"
import { useTheme } from "../utils/theme.js"
import { motionEnabled } from "./design-system/motion.js"

const FRAMES = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"]
const FRAME_MS = 120

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

  const [frame,   setFrame]   = useState(0)
  const [glimmer, setGlimmer] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  const startRef  = useRef(Date.now())
  const verbLabel = activeTool ? (VERBS[activeTool] ?? "Working") : "Thinking"

  useEffect(() => {
    startRef.current = Date.now()
    setElapsed(0)
    const canMove = motionEnabled()
    const frameTimer   = canMove ? setInterval(() => setFrame(f => (f + 1) % FRAMES.length), FRAME_MS) : null
    const glimmerTimer = canMove ? setInterval(() => setGlimmer(g => (g + 1) % (verbLabel.length + 4)), GLIMMER_MS) : null
    const elapsedTimer = setInterval(() => setElapsed(Date.now() - startRef.current), 500)
    return () => {
      if (frameTimer)   clearInterval(frameTimer)
      if (glimmerTimer) clearInterval(glimmerTimer)
      clearInterval(elapsedTimer)
    }
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
