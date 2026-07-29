import type { CoreMessage } from "ai"
import { COMPACTION_BUFFER, estimateEffectiveContextTokens, estimateTokens } from "../session/compaction.js"
import { countTokens } from "../provider/tokenizer.js"
import type { ContextUsage } from "./types.js"

export const PROACTIVE_COMPACTION_RATIO = 0.70
export const COMPACTION_TARGET_RATIO = 0.50
export const MIN_HISTORY_FOR_PROACTIVE_COMPACTION = 8_000

export interface ContextUsageInput {
  providerId?: string
  modelId: string
  tokenizerEncoding?: string
  contextWindow: number
  maxOutputTokens: number
  systemPrompt?: string
  toolSchemaReserveTokens?: number
  attachmentReserveTokens?: number
}

/**
 * Builds the one context measurement used by the compactor and every UI.
 * Provider usage is intentionally excluded: cache accounting is billable usage,
 * not a reliable snapshot of the conversation that remains in context.
 */
export function measureContextUsage(
  messages: CoreMessage[],
  input: ContextUsageInput,
): ContextUsage {
  const historyTokens = estimateTokens(messages, input.modelId, input.tokenizerEncoding)
  const systemTokens = input.systemPrompt
    ? countTokens(input.systemPrompt, input.modelId, input.tokenizerEncoding)
    : 0
  const toolSchemaTokens = input.toolSchemaReserveTokens ?? 0
  const attachmentTokens = input.attachmentReserveTokens ?? 0
  const rawTokens = historyTokens + systemTokens + toolSchemaTokens + attachmentTokens
  const effectiveTokens = estimateEffectiveContextTokens(messages, {
    modelId: input.modelId,
    ...(input.providerId !== undefined ? { providerId: input.providerId } : {}),
    ...(input.tokenizerEncoding !== undefined ? { tokenizerEncoding: input.tokenizerEncoding } : {}),
    ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt } : {}),
    ...(input.toolSchemaReserveTokens !== undefined ? { toolSchemaReserveTokens: input.toolSchemaReserveTokens } : {}),
    ...(input.attachmentReserveTokens !== undefined ? { attachmentReserveTokens: input.attachmentReserveTokens } : {}),
  })

  return {
    historyTokens,
    systemTokens,
    toolSchemaTokens,
    attachmentTokens,
    safetyMarginTokens: Math.max(0, effectiveTokens - rawTokens),
    effectiveTokens,
    contextWindow: input.contextWindow,
    maxOutputTokens: input.maxOutputTokens,
    compactionThreshold: Math.max(0, input.contextWindow - input.maxOutputTokens - COMPACTION_BUFFER),
  }
}

export function shouldProactivelyCompact(usage: ContextUsage): boolean {
  return usage.historyTokens >= MIN_HISTORY_FOR_PROACTIVE_COMPACTION
    && usage.effectiveTokens >= Math.floor(usage.compactionThreshold * PROACTIVE_COMPACTION_RATIO)
}

export function targetEffectiveTokens(usage: ContextUsage): number {
  return Math.floor(usage.compactionThreshold * COMPACTION_TARGET_RATIO)
}
