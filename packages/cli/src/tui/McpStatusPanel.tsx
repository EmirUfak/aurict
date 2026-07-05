/**
 * McpStatusPanel — Oturum açılışında MCP sunucularını tek bir konsolide panelde gösterir.
 *
 * Eskiden her MCP bağlantısı ayrı bir "· [mcp] name: N tool(s)" sistem satırıydı.
 * Artık `mcpManager.list()` beslemesiyle tek bordered panel: her sunucu için durum
 * noktası (connected → safe, connecting → warning+pulse, error → danger), isim ve
 * araç sayısı / hata özeti. Marka tema renkleri kullanılır.
 */

import React from "react"
import { Text } from "ink"
import { mcpManager } from "@aurict/core"
import { HStack, VStack, Surface, Eyebrow, StatusDot } from "./design-system/index.js"
import { useTheme } from "../utils/theme.js"

interface Props {
  /** Her MCP log olayında artan sayaç — listeyi yeniden okumayı tetikler. */
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
  // `refresh` bir prop olarak render'ı tetikler; listeyi her render'da tazeler.
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
