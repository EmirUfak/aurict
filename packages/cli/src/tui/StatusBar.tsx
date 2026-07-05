import React from "react"
import { Text } from "ink"
import type { TokenBreakdown } from "@aurict/core"
import { useTheme } from "../utils/theme.js"
import { HStack, Surface, Eyebrow, StatusDot, MonoStat } from "./design-system/index.js"

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

function ctxTone(pct: number): "safe" | "warning" | "danger" {
  if (pct >= 0.85) return "danger"
  if (pct >= 0.6)  return "warning"
  return "safe"
}

export function StatusBar({
  provider, model, tokens, contextTokens, workdir, skills, turnSkills, contextWindow,
  isUndercover, coordinatorMode, branch, wasCompacted, activeAgent, agentColor,
  bgTaskCount, taskCount, taskSummary, taskPanelOpen, localServer, sandboxBackend,
  effort, autopilotMode, cols, activeAgentCount, hasBtwNote, scrollLocked,
}: Props) {
  const theme     = useTheme()
  const mode      = bp(cols)
  const dir       = workdir.replace(process.env["HOME"] ?? "", "~")
  const cw        = contextWindow ?? 200_000
  const ctxUsed   = contextTokens ?? 0
  const pct       = ctxUsed > 0 ? Math.min(1, ctxUsed / cw) : 0
  const pctStr    = ctxUsed > 0 ? `${Math.round(pct * 100)}%` : null
  const tone      = ctxTone(pct)
  const ctxColor  = tone === "danger" ? theme.error : tone === "warning" ? theme.warning : theme.success
  const cumTotal  = tokens.input + tokens.output
  const sm        = shortModel(model)
  const providerLabel = provider.slice(0, 12)
  const serverLabel = localServer === undefined || !localServer.enabled
    ? "off"
    : localServer.port !== undefined
      ? `${localServer.reused ? "reused" : localServer.started ? "up" : "idle"}:${localServer.port}`
      : `server ${localServer.started ? "up" : "idle"}`
  const sandboxLabel = sandboxBackend === "docker" ? "docker" : sandboxBackend === "none" ? "no sandbox" : "policy"
  const taskLabel = taskSummary
    ? `tasks ${taskSummary.inProgress}/${taskSummary.pending}/${taskSummary.done}${taskSummary.error > 0 ? `/${taskSummary.error}!` : ""}`
    : taskCount !== undefined ? `tasks ${taskCount}` : undefined
  const skillCount = (skills?.length ?? 0) + (turnSkills?.length ?? 0)

  const Sep = () => <Text color={theme.borderDim}>│</Text>
  const Field = ({ label, value, valueColor }: { label: string; value: string; valueColor: string }) => (
    <Text>
      <Text color={theme.textLabel ?? theme.textDim}>{label} </Text>
      <Text color={valueColor} bold>{value}</Text>
    </Text>
  )

  if (mode === "tiny") {
    return (
      <Surface variant="ghost" tone="muted" paddingX="md" paddingY="none">
        <HStack justify="space-between">
          <Text color={theme.accentAlt}>{providerLabel}/{sm}</Text>
          {pctStr && <Text color={ctxColor}>{pctStr}</Text>}
        </HStack>
      </Surface>
    )
  }

  if (mode === "compact") {
    return (
      <Surface variant="ghost" tone="muted" paddingX="md" paddingY="none">
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

  const dirStr = mode === "normal" ? truncDir(dir, 26) : truncDir(dir, 36)

  return (
    <Surface variant="ghost" tone="muted" paddingX="md" paddingY="none">
      <HStack justify="space-between">
        <HStack gap="sm">
          <Field label="dir" value={dirStr} valueColor={theme.accent} />
          {branch && (
            <>
              <Sep />
              <Field label="br" value={branch} valueColor={theme.borderBright ?? theme.textSecondary} />
            </>
          )}
          {isUndercover && (
            <>
              <Sep />
              <Text color={theme.warning} dimColor>undercover</Text>
            </>
          )}
          {coordinatorMode && (
            <>
              <Sep />
              <Text color={theme.accentAlt} dimColor>coord</Text>
            </>
          )}
          {activeAgent && (
            <>
              <Sep />
              <Text color={agentColor ?? theme.accent}>@{activeAgent}</Text>
            </>
          )}
        </HStack>
        <HStack gap="sm">
          {scrollLocked && (
            <>
              <StatusDot tone="warning" />
              <Sep />
            </>
          )}
          {wasCompacted && (
            <>
              <Text color={theme.warning} dimColor>cmpct</Text>
              <Sep />
            </>
          )}
          {hasBtwNote && (
            <>
              <Text color={theme.accent} dimColor>btw</Text>
              <Sep />
            </>
          )}
          {autopilotMode && (
            <>
              <StatusDot tone="warning" active />
              <Text color={theme.warning}>auto</Text>
              <Sep />
            </>
          )}
          {taskPanelOpen && (
            <>
              <Text color={theme.accent} dimColor>panel</Text>
              <Sep />
            </>
          )}
          {bgTaskCount !== undefined && bgTaskCount > 0 && (
            <>
              <Text color={theme.textDim}>bg</Text>
              <Text color={theme.accentAlt}>{bgTaskCount}</Text>
              <Sep />
            </>
          )}
          {taskLabel && (
            <>
              <Text color={taskSummary && taskSummary.error > 0 ? theme.error : theme.textDim}>{taskLabel}</Text>
              <Sep />
            </>
          )}
          {activeAgentCount !== undefined && activeAgentCount > 0 && (
            <Text color={theme.textDim}>{activeAgentCount}ag</Text>
          )}
          {skillCount > 0 && <Text color={theme.textDim}>{skillCount}sk</Text>}
          {mode === "wide" && <Sep />}
          {mode === "wide" && (
            <Text color={theme.accentAlt}>{providerLabel}/{sm}</Text>
          )}
          {mode !== "wide" && (
            <Text color={theme.accentAlt}>{sm}</Text>
          )}
          <Sep />
          <Text color={sandboxBackend === "none" ? theme.warning : theme.textDim}>{sandboxLabel}</Text>
          {mode === "wide" && (
            <>
              <Sep />
              <Text color={localServer?.started ? theme.success : theme.textDim}>{serverLabel}</Text>
            </>
          )}
          {pctStr && (
            <>
              <Sep />
              <StatusDot tone={tone} active={pct > 0} />
              <Text color={ctxColor}>ctx {pctStr}</Text>
            </>
          )}
          {cumTotal > 0 && (
            <>
              <Sep />
              <Text color={theme.textDim}>{fmtK(cumTotal)} tok</Text>
            </>
          )}
          {mode === "wide" && (
            <Text color={theme.textDim} dimColor> · /cmd · Esc</Text>
          )}
        </HStack>
      </HStack>
    </Surface>
  )
}
