import React from "react"
import { Text } from "ink"
import type { TokenBreakdown } from "@aurict/core"
import { useTheme } from "../utils/theme.js"
import { HStack, Surface } from "./design-system/index.js"

interface Props {
  provider:          string
  model:             string
  tokens:            TokenBreakdown
  contextTokens?:    number | undefined
  workdir:           string
  skills?:           string[] | undefined
  turnSkills?:       string[] | undefined
  contextWindow?:    number | undefined
  isUndercover?:     boolean | undefined
  coordinatorMode?:  boolean | undefined
  branch?:           string | undefined
  wasCompacted?:     boolean | undefined
  activeAgent?:      string | undefined
  agentColor?:       string | undefined
  bgTaskCount?:      number | undefined
  taskCount?:        number | undefined
  taskSummary?:      { pending: number; inProgress: number; done: number; error: number } | undefined
  taskPanelOpen?:    boolean | undefined
  localServer?:      { enabled: boolean; port?: number; started: boolean; reused: boolean; reason?: string } | undefined
  sandboxBackend?:   "none" | "policy" | "docker" | undefined
  effort?:           number | undefined
  autopilotMode?:    boolean | undefined
  cols?:             number | undefined
  draftSavedAt?:     number | undefined
  activeAgentCount?: number | undefined
  hasBtwNote?:       boolean | undefined
  scrollLocked?:     boolean | undefined
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
  return String(n)
}

function shortModel(model: string): string {
  return model.replace(/^claude-/, "").replace(/-\d{8}$/, "").slice(0, 16)
}

function truncDir(dir: string, maxLen: number): string {
  if (dir.length <= maxLen) return dir
  const parts = dir.split("/").filter(Boolean)
  const last   = parts[parts.length - 1] ?? ""
  const second = parts[parts.length - 2]
  if (second) return `…/${second}/${last}`
  return `…/${last}`
}

type BP = "tiny" | "compact" | "normal" | "wide"
function bp(cols: number | undefined): BP {
  const c = cols ?? 120
  if (c < 60)  return "tiny"
  if (c < 90)  return "compact"
  if (c < 120) return "normal"
  return "wide"
}

export function StatusBar({
  provider, model, tokens, contextTokens, workdir, skills, turnSkills, contextWindow,
  isUndercover, coordinatorMode, branch, wasCompacted, activeAgent, agentColor,
  bgTaskCount, taskCount, taskSummary, taskPanelOpen, localServer, sandboxBackend,
  effort, autopilotMode, cols, activeAgentCount, hasBtwNote, scrollLocked,
}: Props) {
  const theme   = useTheme()
  const mode    = bp(cols)
  const dir     = workdir.replace(process.env["HOME"] ?? "", "~")
  const cw      = contextWindow ?? 200_000
  const ctxUsed = contextTokens ?? 0
  const pct     = ctxUsed > 0 ? Math.min(1, ctxUsed / cw) : 0
  const pctStr  = ctxUsed > 0 ? `${Math.round(pct * 100)}%` : null
  const ctxColor = pct >= 0.85 ? theme.error : pct >= 0.6 ? theme.warning : theme.success
  const cumTotal = tokens.input + tokens.output
  const sm       = shortModel(model)
  const providerLabel = provider.slice(0, 12)
  const serverLabel = localServer === undefined || !localServer.enabled
    ? "server off"
    : localServer.port !== undefined
      ? `server ${localServer.reused ? "reused" : localServer.started ? "up" : "idle"}:${localServer.port}`
      : `server ${localServer.started ? "up" : "idle"}`
  const sandboxLabel = sandboxBackend === "docker" ? "docker" : sandboxBackend === "none" ? "no sandbox" : "policy"
  const taskLabel = taskSummary
    ? `tasks ${taskSummary.inProgress}/${taskSummary.pending}/${taskSummary.done}${taskSummary.error > 0 ? `/${taskSummary.error}!` : ""}`
    : taskCount !== undefined ? `tasks ${taskCount}` : undefined
  const skillCount = (skills?.length ?? 0) + (turnSkills?.length ?? 0)

  // ── Hücre ayracı: instrument strip hissi için ────────────────────────────────
  const Sep = () => <Text color={theme.borderDim}>│</Text>

  if (mode === "tiny") {
    return (
      <Surface variant="flat" tone="muted" paddingX="md" paddingY="none">
        <HStack justify="space-between">
          <Text color={theme.accentAlt}>{providerLabel}/{sm}</Text>
          {pctStr && <Text color={ctxColor}>{pctStr}</Text>}
        </HStack>
      </Surface>
    )
  }

  if (mode === "compact") {
    return (
      <Surface variant="flat" tone="muted" paddingX="md" paddingY="none">
        <HStack justify="space-between">
          <Text color={theme.accent} bold>{truncDir(dir, 18)}</Text>
          <HStack gap="sm">
            {scrollLocked && <Text color={theme.warning}>⏸</Text>}
            {taskSummary && taskSummary.error > 0 && <Text color={theme.error}>{taskSummary.error}!</Text>}
            {bgTaskCount !== undefined && <Text color={theme.accentAlt}>bg {bgTaskCount}</Text>}
            <Text color={theme.accentAlt}>{sm}</Text>
            {pctStr && (
              <>
                <Sep />
                <Text color={ctxColor}>{pctStr}</Text>
              </>
            )}
          </HStack>
        </HStack>
      </Surface>
    )
  }

  const dirStr = mode === "normal" ? truncDir(dir, 28) : truncDir(dir, 40)

  return (
    <Surface variant="flat" tone="muted" paddingX="md" paddingY="none">
      <HStack justify="space-between">
        {/* ── Sol blok: konum · dal · agent · bayraklar ── */}
        <HStack gap="sm">
          <Text color={theme.accent} bold>{dirStr}</Text>
          {branch && <Text color={theme.borderBright}>⌥ {branch}</Text>}
          {isUndercover && <Text color={theme.warning} dimColor>undercover</Text>}
          {coordinatorMode && <Text color={theme.accentAlt} dimColor>coord</Text>}
          {activeAgent && (
            <>
              <Sep />
              <Text color={agentColor ?? theme.accent}>@{activeAgent}</Text>
            </>
          )}
        </HStack>
        {/* ── Sağ blok: segmentli instrument strip ── */}
        <HStack gap="sm">
          {scrollLocked  && <Text color={theme.warning}>⏸ lock</Text>}
          {wasCompacted  && <Text color={theme.warning} dimColor>cmpct</Text>}
          {hasBtwNote && <Text color={theme.accentAlt}>btw</Text>}
          {autopilotMode && <Text color={theme.warning}>auto</Text>}
          {taskPanelOpen && <Text color={theme.accent}>panel</Text>}
          {bgTaskCount !== undefined && <Text color={theme.accentAlt}>bg {bgTaskCount}</Text>}
          {taskLabel && (
            <>
              <Sep />
              <Text color={taskSummary && taskSummary.error > 0 ? theme.error : theme.textDim}>{taskLabel}</Text>
            </>
          )}
          {activeAgentCount !== undefined && <Text color={theme.textDim}>{activeAgentCount} agents</Text>}
          {skillCount > 0 && <Text color={theme.textDim}>{skillCount} skills</Text>}
          <Sep />
          <Text color={theme.accentAlt}>{providerLabel}/{sm}</Text>
          {effort !== undefined && <Text color={theme.textDim}>effort {effort}</Text>}
          <Sep />
          <Text color={sandboxBackend === "none" ? theme.warning : theme.textDim}>{sandboxLabel}</Text>
          {mode === "wide" && <Text color={localServer?.started ? theme.success : theme.textDim}>{localServer?.started ? "● " : "○ "}{serverLabel}</Text>}
          {pctStr && (
            <>
              <Sep />
              <Text color={ctxColor}>ctx {pctStr}</Text>
            </>
          )}
          {cumTotal > 0 && (
            <>
              <Sep />
              <Text color={theme.textDim}>{fmtK(cumTotal)} tok</Text>
            </>
          )}
          {mode === "wide"
            ? (
              <>
                <Sep />
                <Text color={theme.textDim} dimColor>/cmd</Text>
                <Text color={theme.textDim} dimColor>Esc</Text>
                <Text color={theme.textDim} dimColor>⌃C</Text>
              </>
            )
            : <Text color={theme.textDim} dimColor>  /cmd Esc</Text>
          }
        </HStack>
      </HStack>
    </Surface>
  )
}
