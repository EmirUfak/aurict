import React, { useEffect, useState } from "react"
import { Box, Text } from "ink"
import { agentPool } from "@aurict/core"
import type { AgentInfo } from "@aurict/core"
import { HStack } from "./design-system/index.js"
import { motionEnabled } from "./design-system/motion.js"
import { useTheme } from "../utils/theme.js"

const WAVE = ["▁▂▃▄▅▆▇", "▂▃▄▅▆▇█", "▃▄▅▆▇█▇", "▄▅▆▇█▇▆", "▅▆▇█▇▆▅", "▆▇█▇▆▅▄", "▇█▇▆▅▄▃", "█▇▆▅▄▃▂"]
const RADAR = ["◜", "◠", "◝", "◞", "◡", "◟"]
const SPARK = ["✦", "✧", "◆", "◇"]

function useTicker(active: boolean, interval: number): number {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!active || !motionEnabled()) return
    const t = setInterval(() => setFrame((n) => n + 1), interval)
    return () => clearInterval(t)
  }, [active, interval])
  return frame
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function ContextHeatMeter({ percent, width = 10 }: { percent: number; width?: number }) {
  const theme = useTheme()
  const pct = clamp01(percent)
  const filled = Math.round(pct * width)
  const color = pct >= 0.85 ? theme.error : pct >= 0.6 ? theme.warning : theme.accentAlt
  return (
    <Box>
      <Text color={theme.textDim}>ctx </Text>
      {Array.from({ length: width }).map((_, i) => (
        <Text key={i} color={i < filled ? color : theme.borderDim}>{i < filled ? "▓" : "░"}</Text>
      ))}
      <Text color={color}> {Math.round(pct * 100)}%</Text>
    </Box>
  )
}

export function ToolFlux({ active, label }: { active: boolean; label?: string | undefined }) {
  const theme = useTheme()
  // 200ms: her tick tam-kare Ink çizimi tetiklediği için streaming ile yarışmasın.
  const frame = useTicker(active, 200)
  const wave = active ? WAVE[frame % WAVE.length]! : "▁▁▁▁▁▁▁"
  const spark = active ? SPARK[frame % SPARK.length]! : "◇"
  return (
    <HStack gap="sm">
      <Text color={active ? theme.accentAlt : theme.borderBright}>{spark}</Text>
      <Text color={active ? theme.accentAlt : theme.borderDim}>{wave}</Text>
      <Text color={active ? theme.warning : theme.textDim}>{label ?? (active ? "working" : "idle")}</Text>
    </HStack>
  )
}

function agentColor(info: AgentInfo, theme: ReturnType<typeof useTheme>): string {
  if (info.status === "error") return theme.error
  if (info.status === "done") return theme.success
  switch (info.type) {
    case "code": return theme.accentAlt
    case "review": return theme.warning
    case "design": return "#e879f9"
    case "security":
    case "pentest": return theme.error
    case "test": return theme.accent
    default: return theme.accent
  }
}

export function AgentRadar({ compact = false, activeAgent }: { compact?: boolean; activeAgent?: string | undefined }) {
  const theme = useTheme()
  const [agents, setAgents] = useState<AgentInfo[]>(() => agentPool.active.slice())

  useEffect(() => {
    return agentPool.onChange((next) => setAgents(next.slice()))
  }, [])

  const visible = agents.slice(0, compact ? 3 : 5)
  const running = agents.filter((a) => a.status === "running").length
  const frame = useTicker(running > 0, 240)
  const radar = RADAR[frame % RADAR.length]!

  if (compact) {
    return (
      <HStack gap="sm">
        <Text color={running > 0 ? theme.accentAlt : theme.borderBright}>{radar}</Text>
        <Text color={theme.textDim}>radar</Text>
        <Text color={running > 0 ? theme.accentAlt : theme.textDim}>{running}</Text>
      </HStack>
    )
  }

  return (
    <HStack gap="sm">
      <Text color={running > 0 ? theme.accentAlt : theme.borderBright}>{radar}</Text>
      <Text color={theme.textDim}>agent radar</Text>
      {visible.length === 0
        ? <Text color={theme.textDim}>idle</Text>
        : visible.map((agent, i) => {
            const selected = activeAgent === agent.id || activeAgent === agent.sessionId
            const pulse = agent.status === "running" && (frame + i) % 3 === 0
            return (
              <Text key={agent.id} color={agentColor(agent, theme)} bold={selected || pulse}>
                {pulse ? "◉" : agent.status === "done" ? "◌" : agent.status === "error" ? "✕" : "●"} {agent.type}
              </Text>
            )
          })}
      {agents.length > visible.length && <Text color={theme.textDim}>+{agents.length - visible.length}</Text>}
    </HStack>
  )
}
