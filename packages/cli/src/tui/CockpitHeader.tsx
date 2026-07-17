import React from "react";
import { Text } from "ink";
import type { TokenBreakdown } from "@aurict/core";
import { Corners, HStack, Surface, StatusDot, VStack } from "./design-system/index.js";
import { useTheme } from "../utils/theme.js";
import { useTerminalSize } from "./TerminalSizeContext.js";
import { activityLabel, type RunActivity } from "./run-status.js";

interface Props {
  provider: string;
  model: string;
  workdir: string;
  tokens: TokenBreakdown;
  contextTokens: number;
  contextWindow?: number | undefined;
  branch?: string | undefined;
  activeAgent?: string | undefined;
  activeAgentCount?: number | undefined;
  loading?: boolean | undefined;
  activeTool?: string | undefined;
  activity?: RunActivity | undefined;
  taskSummary?: { pending: number; inProgress: number; done: number; error: number } | undefined;
  bgTaskCount?: number | undefined;
  localServer?: { enabled: boolean; port?: number; started: boolean; reused: boolean; reason?: string } | undefined;
  sandboxBackend?: "none" | "policy" | "docker" | undefined;
  coordinatorMode?: boolean | undefined;
  autopilotMode?: boolean | undefined;
  cols?: number | undefined;
}

function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}…`;
}

function shortModel(model: string): string {
  return model.replace(/^claude-/, "").replace(/-\d{8}$/, "");
}

function contextColor(
  pct: number,
  theme: ReturnType<typeof useTheme>,
): string {
  if (pct >= 0.85) return theme.error;
  if (pct >= 0.6) return theme.warning;
  return theme.success;
}

export function CockpitHeader({
  provider,
  model,
  contextTokens,
  contextWindow,
  branch,
  activeAgent,
  activeAgentCount,
  loading,
  activeTool,
  activity,
  taskSummary,
  cols,
}: Props) {
  const theme = useTheme();
  const screen = useTerminalSize();
  const width = cols ?? screen.columns ?? 120;
  const compact = width < 76;
  const pct = contextTokens > 0
    ? Math.min(1, contextTokens / (contextWindow ?? 200_000))
    : 0;
  const taskError = (taskSummary?.error ?? 0) > 0;
  const taskRunning = (taskSummary?.inProgress ?? 0) > 0;
  const status = activeTool
    ? shorten(activeTool, compact ? 14 : 28)
    : loading ? activityLabel(activity) : "ready";
  const Sep = () => <Text color={theme.borderDim}>│</Text>;

  return (
    <Surface
      width={Math.max(40, width)}
      variant="flat"
      tone="muted"
      accentColor={theme.borderActive}
      paddingX="md"
      paddingY="none"
    >
      <HStack justify="space-between">
        <HStack gap="sm">
          <StatusDot tone={loading ? "accent" : "safe"} active={!!loading} />
          <Text color={theme.accent} bold>AURICT</Text>
          <Sep />
          <Text color={loading ? theme.textPrimary : theme.textSecondary}>{status}</Text>
          {!compact && activeAgent && <Text color={theme.accentAlt}>@{shorten(activeAgent, 18)}</Text>}
        </HStack>
        <HStack gap="sm">
          <Text color={theme.accent}>{shorten(provider, 12)}/{shorten(shortModel(model), compact ? 12 : 22)}</Text>
          <Sep />
          <Text color={contextColor(pct, theme)}>ctx {contextTokens > 0 ? `${Math.round(pct * 100)}%` : "—"}</Text>
          {!compact && branch && <Text color={theme.borderBright}>⌥ {shorten(branch, 18)}</Text>}
          {taskRunning && <Text color={theme.textDim}>{taskSummary?.inProgress} active</Text>}
          {taskError && <Text color={theme.error}>{taskSummary?.error} failed</Text>}
          {!compact && (activeAgentCount ?? 0) > 1 && <Text color={theme.textDim}>{activeAgentCount} agents</Text>}
        </HStack>
      </HStack>
    </Surface>
  );
}

export function HeaderCorners({ tone = "accent" }: { tone?: "accent" | "safe" | "warning" | "danger" | "default" }) {
  const theme = useTheme();
  const color = tone === "accent" ? theme.accent
    : tone === "safe" ? theme.success
    : tone === "warning" ? theme.warning
    : tone === "danger" ? theme.error
    : theme.borderBright;
  return (
    <VStack gap="none">
      <HStack justify="space-between"><Text color={color}>┌</Text><Text color={color}>┐</Text></HStack>
      <HStack justify="space-between"><Text color={color}>└</Text><Text color={color}>┘</Text></HStack>
    </VStack>
  );
}

export { Corners };
