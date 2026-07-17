import { describe, expect, test } from "bun:test"
import type { CoreMessage } from "ai"
import { measureContextUsage } from "../src/agent/context-usage.js"
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
})
