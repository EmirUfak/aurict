import React from "react"
import { Text } from "ink"
import type { TokenBreakdown } from "@aurict/core"
import { HStack, Surface } from "./design-system/index.js"
import { useTheme } from "../utils/theme.js"
import { AgentRadar, ContextHeatMeter, ToolFlux } from "./CockpitEffects.js"

interface Props {
  provider: string
  model: string
  workdir: string
  tokens: TokenBreakdown
  contextTokens: number
  contextWindow?: number | undefined
  branch?: string | undefined
  activeAgent?: string | undefined
  activeAgentCount?: number | undefined
  loading?: boolean | undefined
  activeTool?: string | undefined
  taskSummary?: { pending: number; inProgress: number; done: number; error: number } | undefined
  bgTaskCount?: number | undefined
  localServer?: { enabled: boolean; port?: number; started: boolean; reused: boolean; reason?: string } | undefined
  sandboxBackend?: "none" | "policy" | "docker" | undefined
  coordinatorMode?: boolean | undefined
  autopilotMode?: boolean | undefined
  cols?: number | undefined
}

function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`
}

function shortModel(model: string): string {
  return model.replace(/^claude-/, "").replace(/-\d{8}$/, "")
}

function shortDir(dir: string, maxLen: number): string {
  if (dir.length <= maxLen) return dir
  const parts = dir.split("/").filter(Boolean)
  const last = parts[parts.length - 1] ?? dir
  const parent = parts[parts.length - 2]
  return parent ? `…/${parent}/${last}` : `…/${last}`
}

export function CockpitHeader({
  provider,
  model,
  workdir,
  tokens,
  contextTokens,
  contextWindow,
  branch,
  activeAgent,
  activeAgentCount,
  loading,
  activeTool,
  taskSummary,
  bgTaskCount,
  localServer,
  sandboxBackend,
  coordinatorMode,
  autopilotMode,
  cols,
}: Props) {
  const theme = useTheme()
  const width = cols ?? 120
  const compact = width < 92
  const dir = shortDir(workdir.replace(process.env["HOME"] ?? "", "~"), compact ? 22 : 38)
  const windowSize = contextWindow ?? 200_000
  const pct = contextTokens > 0 ? Math.min(1, contextTokens / windowSize) : 0
  const pctLabel = contextTokens > 0 ? `${Math.round(pct * 100)}%` : "—"
  const ctxColor = pct >= 0.85 ? theme.error : pct >= 0.6 ? theme.warning : theme.success
  const tokenTotal = tokens.input + tokens.output
  const taskColor = taskSummary && taskSummary.error > 0
    ? theme.error
    : taskSummary && taskSummary.inProgress > 0
      ? theme.accentAlt
      : theme.textDim
  const taskText = taskSummary
    ? `${taskSummary.inProgress}▸ ${taskSummary.pending}· ${taskSummary.done}✓${taskSummary.error > 0 ? ` ${taskSummary.error}!` : ""}`
    : "idle"
  const serverUp = !!localServer?.started
  const serverText = localServer === undefined || !localServer.enabled
    ? "server off"
    : localServer.port !== undefined
      ? `${localServer.started ? "server" : "idle"}:${localServer.port}`
      : localServer.started ? "server up" : "server idle"
  const modeText = [
    sandboxBackend === "docker" ? "docker" : sandboxBackend === "none" ? "no-sbx" : "policy",
    coordinatorMode ? "coord" : undefined,
    autopilotMode ? "auto" : undefined,
  ].filter(Boolean).join(" · ")

  // ── Status pip: çalışıyorsa accentAlt, hazırsa success ──────────────────────
  const pip = loading ? theme.accentAlt : theme.success
  const Sep = () => <Text color={theme.borderDim}> │ </Text>

  if (compact) {
    return (
      <Surface width={Math.max(40, width)} variant="flat" tone="muted" accentColor={theme.borderActive} paddingX="md" paddingY="none">
        <HStack justify="space-between">
          <HStack gap="sm">
            <Text color={pip}>●</Text>
            <Text color={theme.accentAlt} bold>AURICT</Text>
          </HStack>
          <ToolFlux active={!!loading} label={activeTool ? shorten(activeTool, 14) : loading ? "working" : "ready"} />
        </HStack>
        <HStack justify="space-between">
          <Text color={theme.textSecondary}>{dir}</Text>
          <AgentRadar compact {...(activeAgent !== undefined ? { activeAgent } : {})} />
        </HStack>
        <HStack gap="sm">
          <ContextHeatMeter percent={pct} width={8} />
          <Text color={ctxColor}>{pctLabel}</Text>
        </HStack>
      </Surface>
    )
  }

  return (
    <Surface width={Math.max(40, width)} variant="flat" tone="muted" accentColor={theme.borderActive} paddingX="md" paddingY="none">
      {/* ── Üst sıra: kimlik · aktif araç ···· provider/model · ctx · token ── */}
      <HStack justify="space-between">
        <HStack gap="sm">
          <Text color={pip}>●</Text>
          <Text color={theme.accentAlt} bold>AURICT</Text>
          <Text color={theme.textDim}>multi-agent cockpit</Text>
          <Sep />
          <ToolFlux active={!!loading} label={activeTool ? shorten(activeTool, 18) : loading ? "working" : "ready"} />
        </HStack>
        <HStack gap="sm">
          <Text color={theme.accent}>{shorten(provider, 12)}/{shorten(shortModel(model), 22)}</Text>
          <Sep />
          <ContextHeatMeter percent={pct} width={10} />
          <Text color={ctxColor}>ctx {pctLabel}</Text>
          {tokenTotal > 0 && (
            <>
              <Sep />
              <Text color={theme.textDim}>{tokenTotal.toLocaleString()} tok</Text>
            </>
          )}
        </HStack>
      </HStack>
      {/* ── Alt sıra: konum · dal · agent ···· radar · görev · bg · server · mod ── */}
      <HStack justify="space-between">
        <HStack gap="sm">
          <Text color={theme.textSecondary}>{dir}</Text>
          {branch && <Text color={theme.borderBright}>⌥ {shorten(branch, 22)}</Text>}
          {activeAgent && <Text color={theme.accent}>@{shorten(activeAgent, 18)}</Text>}
          {activeAgentCount !== undefined && <Text color={theme.textDim}>{activeAgentCount} agents</Text>}
        </HStack>
        <HStack gap="sm">
          <AgentRadar {...(activeAgent !== undefined ? { activeAgent } : {})} />
          <Sep />
          <Text color={taskColor}>tasks {taskText}</Text>
          {bgTaskCount !== undefined && (
            <>
              <Sep />
              <Text color={theme.accentAlt}>bg {bgTaskCount}</Text>
            </>
          )}
          <Sep />
          <Text color={serverUp ? theme.success : theme.textDim}>{serverUp ? "● " : "○ "}{serverText}</Text>
          {modeText && (
            <>
              <Sep />
              <Text color={sandboxBackend === "none" ? theme.warning : theme.textDim}>{modeText}</Text>
            </>
          )}
        </HStack>
      </HStack>
    </Surface>
  )
}
