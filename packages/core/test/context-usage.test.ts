import { describe, expect, test } from "bun:test"
import type { CoreMessage } from "ai"
import {
  measureContextUsage,
  shouldProactivelyCompact,
  targetEffectiveTokens,
} from "../src/agent/context-usage.js"
import { COMPACTION_BUFFER, estimateTokens } from "../src/session/compaction.js"

const messages: CoreMessage[] = [
  { role: "user", content: "Inspect the authentication flow and explain the failure." },
  { role: "assistant", content: "I found a stale token refresh path in the client." },
]

describe("measureContextUsage", () => {
  test("separates persisted history from the full prompt estimate", () => {
    const usage = measureContextUsage(messages, {
      modelId: "gpt-4o",
      contextWindow: 128_000,
      maxOutputTokens: 16_000,
      systemPrompt: "You are an implementation agent.",
      toolSchemaReserveTokens: 640,
    })

    expect(usage.historyTokens).toBe(estimateTokens(messages, "gpt-4o"))
    expect(usage.effectiveTokens).toBeGreaterThan(usage.historyTokens)
    expect(usage.systemTokens).toBeGreaterThan(0)
    expect(usage.toolSchemaTokens).toBe(640)
    expect(usage.attachmentTokens).toBe(0)
    expect(usage.safetyMarginTokens).toBeGreaterThanOrEqual(0)
    expect(usage.compactionThreshold).toBe(128_000 - 16_000 - COMPACTION_BUFFER)
  })

  test("uses the same safe threshold that the compactor uses", () => {
    const usage = measureContextUsage(messages, {
      modelId: "gpt-4o",
      contextWindow: 32_000,
      maxOutputTokens: 8_000,
    })

    expect(usage.contextWindow).toBe(32_000)
    expect(usage.maxOutputTokens).toBe(8_000)
    expect(usage.compactionThreshold).toBe(4_000)
  })

  test("triggers early and targets half of the safe request budget", () => {
    const usage = {
      historyTokens: 8_000,
      systemTokens: 1_000,
      toolSchemaTokens: 1_000,
      attachmentTokens: 0,
      safetyMarginTokens: 500,
      effectiveTokens: 10_500,
      contextWindow: 20_000,
      maxOutputTokens: 2_000,
      compactionThreshold: 14_000,
    }

    expect(shouldProactivelyCompact(usage)).toBe(true)
    expect(targetEffectiveTokens(usage)).toBe(7_000)
  })
})
