import { describe, expect, test } from "bun:test"
import type { CoreMessage } from "@aurict/core"
import { resolvePersistentTurnHistory } from "../src/tui/app/agent-history.js"
import { AUTO_CONTINUE_PROMPT } from "../src/tui/auto-continue.js"

describe("terminal persistent agent history", () => {
  const current: CoreMessage[] = [
    { role: "user", content: "original request" },
    { role: "assistant", content: "working" },
  ]
  const response: CoreMessage[] = [
    { role: "assistant", content: "completed response" },
  ]

  test("commits the compacted history instead of restoring the oversized input", () => {
    const submitted = [...current, { role: "user" as const, content: "new request" }]
    const compacted: CoreMessage[] = [
      { role: "user", content: "[Summary of previous conversation]" },
      { role: "assistant", content: "validated checkpoint" },
      { role: "user", content: "new request" },
    ]

    const next = resolvePersistentTurnHistory({
      currentHistory: current,
      submittedHistory: submitted,
      compactedMessages: compacted,
      newMessages: response,
      internalContinuation: false,
      submittedPrompt: "new request",
    })

    expect(next).toEqual([...compacted, ...response])
    expect(next).not.toContain(current[1])
  })

  test("keeps an automatic continuation ephemeral across compaction", () => {
    const prompt = AUTO_CONTINUE_PROMPT
    const compacted: CoreMessage[] = [
      { role: "user", content: "[Summary of previous conversation]" },
      { role: "assistant", content: "validated checkpoint" },
      { role: "user", content: prompt },
    ]

    const next = resolvePersistentTurnHistory({
      currentHistory: current,
      submittedHistory: [...current, { role: "user", content: prompt }],
      compactedMessages: compacted,
      newMessages: response,
      internalContinuation: true,
      submittedPrompt: prompt,
    })

    expect(next).toEqual([
      compacted[0],
      compacted[1],
      response[0],
    ])
    expect(next.some((message) => message.content === prompt)).toBe(false)
  })
})
