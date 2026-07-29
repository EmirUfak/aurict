import type { CompactionEvent, ContextUsage } from "@aurict/core"

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })

export function formatTokenCount(value: number): string {
  return integer.format(Math.max(0, Math.round(value)))
}

export function formatCompactionEvent(event: CompactionEvent): string {
  const lines = [
    "Context checkpoint completed",
    metric("History", event.before.historyTokens, event.after.historyTokens),
    stableMetric("System", event.after.systemTokens),
    stableMetric("Tool schemas", event.after.toolSchemaTokens),
    stableMetric("Attachments", event.after.attachmentTokens),
    stableMetric("Safety margin", event.after.safetyMarginTokens),
    metric("Effective", event.before.effectiveTokens, event.after.effectiveTokens),
    `Reclaimed: ${formatTokenCount(event.reclaimedTokens)} estimated tokens`,
    `Threshold: ${formatTokenCount(event.after.compactionThreshold)} estimated tokens`,
  ]
  return lines.filter(Boolean).join("\n")
}

export function contextLimitNotice(usage: ContextUsage): string {
  return [
    "Context is above the safe request threshold.",
    `Effective: ${formatTokenCount(usage.effectiveTokens)} estimated tokens`,
    `Threshold: ${formatTokenCount(usage.compactionThreshold)} estimated tokens`,
    "Aurict will create a checkpoint before the next provider request.",
  ].join("\n")
}

function metric(label: string, before: number, after: number): string {
  return `${label}: ${formatTokenCount(before)} → ${formatTokenCount(after)}`
}

function stableMetric(label: string, value: number | undefined): string {
  return value === undefined ? "" : `${label}: ${formatTokenCount(value)}`
}
