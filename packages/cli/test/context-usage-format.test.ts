import { describe, expect, test } from "bun:test"
import type { CompactionEvent } from "@aurict/core"
import { formatCompactionEvent, formatTokenCount } from "../src/tui/context-usage-format.js"

describe("terminal context usage formatting", () => {
  test("prints exact integers instead of rounding both sides to 94k", () => {
    const before = {
      historyTokens: 90_000,
      systemTokens: 1_500,
      toolSchemaTokens: 1_500,
      attachmentTokens: 41,
      safetyMarginTokens: 1_000,
      effectiveTokens: 94_041,
      contextWindow: 128_000,
      maxOutputTokens: 8_000,
      compactionThreshold: 100_000,
    }
    const event: CompactionEvent = {
      reason: "effective_context_limit",
      before,
      after: {
        ...before,
        historyTokens: 89_955,
        effectiveTokens: 93_996,
      },
      reclaimedTokens: 45,
    }

    const output = formatCompactionEvent(event)
    expect(output).toContain("Effective: 94,041 → 93,996")
    expect(output).toContain("Reclaimed: 45 estimated tokens")
    expect(output).not.toContain("94k")
    expect(formatTokenCount(94_041)).toBe("94,041")
  })
})
