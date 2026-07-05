import React from "react"
import { Text } from "ink"
import type { TokenBreakdown } from "@aurict/core"
import { HStack, VStack, Surface, Eyebrow, StatusDot, MonoStat, Corners } from "./design-system/index.js"
import { useTheme } from "../utils/theme.js"
import { AgentRadar, ContextHeatMeter, ToolFlux } from "./CockpitEffects.js"
import { useTerminalSize } from "./TerminalSizeContext.js"

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

function ctxTone(pct: number): "safe" | "warning" | "danger" {
  if (pct >= 0.85) return "danger"
  if (pct >= 0.6)  return "warning"
  return "safe"
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
  const screen = useTerminalSize()
  const width = cols ?? screen.columns ?? 120
  const compact = width < 92
  const home = process.env["HOME"] ?? ""
  const dir = shortDir(workdir.replace(home, "~"), compact ? 22 : 38)
  const windowSize = contextWindow ?? 200_000
  const pct = contextTokens > 0 ? Math.min(1, contextTokens / windowSize) : 0
  const pctLabel = contextTokens > 0 ? `${Math.round(pct * 100)}%` : "—"
  const tone = ctxTone(pct)
  const ctxColor = tone === "danger" ? theme.error : tone === "warning" ? theme.warning : theme.success
  const tokenTotal = tokens.input + tokens.output
  const taskHasError = taskSummary !== undefined && taskSummary.error > 0
  const taskHasRunning = taskSummary !== undefined && taskSummary.inProgress > 0
  const taskDot: React.ReactNode = taskHasError
    ? <StatusDot tone="danger" />
    : taskHasRunning
      ? <StatusDot tone="accent" active />
      : <StatusDot tone="muted" />
  const taskText = taskSummary
    ? `${taskSummary.inProgress}▸ ${taskSummary.pending}· ${taskSummary.done}✓${taskSummary.error > 0 ? ` ${taskSummary.error}!` : ""}`
    : "idle"
  const serverUp = !!localServer?.started
  const serverText = localServer === undefined || !localServer.enabled
    ? "off"
    : localServer.port !== undefined
      ? `${localServer.started ? "up" : "idle"}:${localServer.port}`
      : localServer.started ? "up" : "idle"
  const sandboxText = sandboxBackend === "docker" ? "docker" : sandboxBackend === "none" ? "no-sbx" : "policy"
  const sandboxTone: "safe" | "warning" | "accent" = sandboxBackend === "none" ? "warning" : sandboxBackend === "docker" ? "accent" : "safe"

  const pip = loading ? "accent" : "safe"
  const Sep = () => <Text color={theme.borderDim}>│</Text>
  const hairline = "─".repeat(Math.max(0, width - 2))

  if (compact) {
    return (
      <Surface width={Math.max(40, width)} variant="flat" tone="muted" accentColor={theme.borderActive} paddingX="md" paddingY="none">
        <HStack justify="space-between">
          <HStack gap="sm">
            <StatusDot tone={pip} active={!!loading} />
            <Text color={theme.accent} bold>AURICT</Text>
            <Sep />
            <ToolFlux active={!!loading} label={activeTool ? shorten(activeTool, 14) : loading ? "working" : "ready"} />
          </HStack>
          <Text color={theme.textDim} dimColor>{provider}</Text>
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
          <StatusDot tone={pip} active={!!loading} />
          <Text color={theme.accent} bold>AURICT</Text>
          <Eyebrow tone="muted">multi-agent cockpit</Eyebrow>
          <Sep />
          <ToolFlux active={!!loading} label={activeTool ? shorten(activeTool, 18) : loading ? "working" : "ready"} />
        </HStack>
        <HStack gap="sm">
          <Sep />
          <Eyebrow tone="muted">model</Eyebrow>
          <Text color={theme.accent}>{shorten(provider, 12)}/{shorten(shortModel(model), 22)}</Text>
          <Sep />
          <Eyebrow tone="muted">ctx</Eyebrow>
          <Text color={ctxColor}>{pctLabel}</Text>
          {tokenTotal > 0 && (
            <>
              <Sep />
              <MonoStat value={tokenTotal.toLocaleString()} label="tok" valueTone="muted" />
            </>
          )}
        </HStack>
      </HStack>

      {/* ── Hairline ayraç ── */}
      <Text color={theme.borderDim}>{hairline}</Text>

      {/* ── Alt sıra: konum · dal · agent ···· radar · görev · bg · server · mod ── */}
      <HStack justify="space-between">
        <HStack gap="sm">
          <Eyebrow tone="muted">workdir</Eyebrow>
          <Text color={theme.textSecondary}>{dir}</Text>
          {branch && (
            <>
              <Sep />
              <Eyebrow tone="muted">branch</Eyebrow>
              <Text color={theme.borderBright}>⌥ {shorten(branch, 22)}</Text>
            </>
          )}
          {activeAgent && (
            <>
              <Sep />
              <Eyebrow tone="accent">agent</Eyebrow>
              <Text color={theme.accent}>@{shorten(activeAgent, 18)}</Text>
            </>
          )}
          {activeAgentCount !== undefined && <Text color={theme.textDim}>{activeAgentCount} agents</Text>}
        </HStack>
        <HStack gap="sm">
          <AgentRadar {...(activeAgent !== undefined ? { activeAgent } : {})} />
          <Sep />
          <Eyebrow tone="muted">tasks</Eyebrow>
          {taskDot}
          <Text color={taskHasError ? theme.error : theme.textDim}>{taskText}</Text>
          {bgTaskCount !== undefined && (
            <>
              <Sep />
              <Eyebrow tone="accent">bg</Eyebrow>
              <Text color={theme.accentAlt}>{bgTaskCount}</Text>
            </>
          )}
          <Sep />
          <Eyebrow tone={serverUp ? "safe" : "muted"}>server</Eyebrow>
          <Text color={serverUp ? theme.success : theme.textDim}>{serverText}</Text>
          <Sep />
          <Eyebrow tone={sandboxTone}>sandbox</Eyebrow>
          <Text color={sandboxBackend === "none" ? theme.warning : theme.textDim}>{sandboxText}</Text>
          {(coordinatorMode || autopilotMode) && (
            <>
              <Sep />
              {coordinatorMode && <Text color={theme.accentAlt} dimColor>coord</Text>}
              {autopilotMode && <Text color={theme.warning} dimColor>auto</Text>}
            </>
          )}
        </HStack>
      </HStack>
    </Surface>
  )
}

// Re-export corner signature as a standalone header decorator
export function HeaderCorners({ tone = "accent" }: { tone?: "accent" | "safe" | "warning" | "danger" | "default" }) {
  const theme = useTheme()
  const color = tone === "accent" ? theme.accent
    : tone === "safe" ? theme.success
    : tone === "warning" ? theme.warning
    : tone === "danger" ? theme.error
    : theme.borderBright
  return (
    <VStack gap="none">
      <HStack justify="space-between"><Text color={color}>┌</Text><Text color={color}>┐</Text></HStack>
      <HStack justify="space-between"><Text color={color}>└</Text><Text color={color}>┘</Text></HStack>
    </VStack>
  )
}

export { Corners }
