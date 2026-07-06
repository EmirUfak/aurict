/**
 * McpStatusPanel — shows MCP servers in a single consolidated panel at session startup.
 *
 * Previously each MCP connection was a separate "· [mcp] name: N tool(s)" system line.
 * Now, fed by `mcpManager.list()`, it's a single bordered panel: a status dot per server
 * (connected → safe, connecting → warning+pulse, error → danger), name, and tool
 * count / error summary. Uses the brand theme colors.
 */

import React from "react"
import { Text } from "ink"
import { mcpManager } from "@aurict/core"
import { HStack, VStack, Surface, Eyebrow, StatusDot } from "./design-system/index.js"
import { useTheme } from "../utils/theme.js"

interface Props {
  /** A counter that increments on every MCP log event — triggers re-reading the list. */
  refresh?: number
  width?:   number
}

type StatusTone = "safe" | "warning" | "danger" | "muted"

function toneFor(status: string): StatusTone {
  if (status === "connected") return "safe"
  if (status === "error")     return "danger"
  if (status === "connecting") return "warning"
  return "muted"
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(1, max - 1))}…`
}

export function McpStatusPanel({ refresh, width }: Props) {
  const theme = useTheme()
  // `refresh` triggers a re-render as a prop; the list is refreshed on every render.
  void refresh
  const servers = mcpManager.list()
  if (servers.length === 0) return null

  const connected = servers.filter((s) => s.status === "connected").length
  const totalTools = servers.reduce((sum, s) => sum + s.toolCount, 0)
  const panelWidth = width !== undefined ? Math.max(24, width) : undefined
  const nameWidth = panelWidth !== undefined ? Math.max(10, Math.floor(panelWidth / 3)) : 18

  return (
    <Surface
      variant="flat"
      tone="muted"
      accentColor={theme.borderDim}
      paddingX="md"
      paddingY="none"
      {...(panelWidth !== undefined ? { width: panelWidth } : {})}
    >
      <HStack justify="space-between">
        <Eyebrow tone="muted">mcp servers</Eyebrow>
        <Text color={theme.textDim} dimColor>
          {connected}/{servers.length} up · {totalTools} tools
        </Text>
      </HStack>
      <VStack gap="none">
        {servers.map((s) => {
          const tone = toneFor(s.status)
          const detail = s.status === "error"
            ? truncate(s.error ?? "connection error", Math.max(12, (panelWidth ?? 60) - nameWidth - 10))
            : s.status === "connecting"
              ? "connecting…"
              : `${s.toolCount} tool${s.toolCount === 1 ? "" : "s"}`
          const detailColor = s.status === "error"
            ? theme.error
            : s.status === "connected"
              ? theme.textSecondary
              : theme.textDim
          return (
            <HStack key={s.name} gap="sm">
              <StatusDot tone={tone} active={s.status === "connecting"} />
              <Text color={theme.textPrimary}>{truncate(s.name, nameWidth)}</Text>
              <Text color={detailColor} dimColor={s.status !== "error"}>{detail}</Text>
            </HStack>
          )
        })}
      </VStack>
    </Surface>
  )
}
