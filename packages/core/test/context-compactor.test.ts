import { describe, it, expect } from "bun:test"
import type { CoreMessage } from "ai"
import {
  extractText,
  classifyMessage,
  importanceScore,
  measureContextHealth,
  smartCompact,
  extractFilePaths,
} from "../src/session/context-compactor.js"
import { TOOL_OUTPUT_MAX_CHARS } from "../src/session/compaction.js"

// ─── helpers ────────────────────────────────────────────────────────────────

function userMsg(content: string): CoreMessage {
  return { role: "user", content } as CoreMessage
}

function assistantMsg(content: string): CoreMessage {
  return { role: "assistant", content } as CoreMessage
}

function systemMsg(content: string): CoreMessage {
  return { role: "system", content } as CoreMessage
}

function toolMsg(result: string): CoreMessage {
  return {
    role: "tool",
    content: [{ type: "tool-result", toolCallId: "x", result }],
  } as unknown as CoreMessage
}

function codeMsg(): CoreMessage {
  return userMsg("Look at this:\n```typescript\nconst x = 1;\nconsole.log(x);\nexport default x;\n```")
}

// ─── extractText ────────────────────────────────────────────────────────────

describe("extractText", () => {
  it("string content is returned as-is", () => {
    expect(extractText(userMsg("hello"))).toBe("hello")
  })

  it("array with text parts are joined", () => {
    const msg: CoreMessage = {
      role: "assistant",
      content: [
        { type: "text", text: "foo" } as any,
        { type: "text", text: "bar" } as any,
      ],
    } as CoreMessage
    const result = extractText(msg)
    expect(result).toContain("foo")
    expect(result).toContain("bar")
  })

  it("tool-result parts are JSON stringified", () => {
    const msg: CoreMessage = {
      role: "tool",
      content: [{ type: "tool-result", toolCallId: "x", result: { data: 42 } }],
    } as unknown as CoreMessage
    const result = extractText(msg)
    expect(result).toContain("42")
  })

  it("unknown content falls back to JSON stringify", () => {
    const msg = { role: "user", content: { nested: true } } as unknown as CoreMessage
    const result = extractText(msg)
    expect(result).toContain("nested")
  })

  it("empty string content returns empty string", () => {
    expect(extractText(userMsg(""))).toBe("")
  })
})

// ─── classifyMessage ────────────────────────────────────────────────────────

describe("classifyMessage", () => {
  it("system role → system", () => {
    expect(classifyMessage(systemMsg("instructions"))).toBe("system")
  })

  it("tool role → tool_output", () => {
    expect(classifyMessage(toolMsg("result data"))).toBe("tool_output")
  })

  it("message with long code block (≥20 chars) → code", () => {
    expect(classifyMessage(codeMsg())).toBe("code")
  })

  it("message with short code block (<20 chars) → conversation", () => {
    const msg = userMsg("try `x = 1` here")
    expect(classifyMessage(msg)).toBe("conversation")
  })

  it("plain user message → conversation", () => {
    expect(classifyMessage(userMsg("hi there"))).toBe("conversation")
  })

  it("assistant message without code → conversation", () => {
    expect(classifyMessage(assistantMsg("I'll help you"))).toBe("conversation")
  })
})

// ─── importanceScore ────────────────────────────────────────────────────────

describe("importanceScore", () => {
  it("score is always in [0, 100]", () => {
    const msgs = Array.from({ length: 10 }, () => userMsg("x"))
    for (let i = 0; i < msgs.length; i++) {
      const s = importanceScore(msgs[i], msgs, i)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(100)
    }
  })

  it("last message scores higher than first (recency bonus)", () => {
    const content = "This is a reasonable message with enough words in it"
    const msgs = Array.from({ length: 10 }, () => userMsg(content))
    const first = importanceScore(msgs[0], msgs, 0)
    const last  = importanceScore(msgs[9], msgs, 9)
    expect(last).toBeGreaterThan(first)
  })

  it("code message scores higher than plain conversation (same position)", () => {
    // code: +20 bonus; conversation: +10 but also has recency (+30 as last)
    // to compare fairly, test code at the same idx=0 of a same-length array
    const msgs2 = [codeMsg(), codeMsg()]
    const msgs3 = [userMsg("just a chat message"), userMsg("just a chat message")]
    const c1 = importanceScore(msgs2[0], msgs2, 0)
    const c2 = importanceScore(msgs3[0], msgs3, 0)
    expect(c1).toBeGreaterThan(c2)
  })

  it("tool_output scores lower than conversation (same position)", () => {
    const msgs = [toolMsg("big result"), userMsg("plain message")]
    const toolScore = importanceScore(msgs[0], msgs, 0)
    const chatScore = importanceScore(msgs[1], msgs, 0)
    expect(toolScore).toBeLessThan(chatScore)
  })

  it("system message scores higher than conversation (same position)", () => {
    const longContent = "This is a system instruction with enough content to avoid short penalty"
    const sysMsgs  = [systemMsg(longContent), systemMsg(longContent)]
    const chatMsgs = [userMsg(longContent), userMsg(longContent)]
    const sysScore  = importanceScore(sysMsgs[0], sysMsgs, 0)
    const chatScore = importanceScore(chatMsgs[0], chatMsgs, 0)
    expect(sysScore).toBeGreaterThan(chatScore)
  })
})

// ─── measureContextHealth ───────────────────────────────────────────────────

describe("measureContextHealth", () => {
  it("empty messages returns zeros", () => {
    const h = measureContextHealth([])
    expect(h.total).toBe(0)
    expect(h.toolOutputPct).toBe(0)
    expect(h.codePct).toBe(0)
    expect(h.byType.code).toBe(0)
    expect(h.byType.tool_output).toBe(0)
  })

  it("single user message → all tokens counted as conversation", () => {
    const h = measureContextHealth([userMsg("hello world")])
    expect(h.total).toBeGreaterThan(0)
    expect(h.byType.conversation).toBe(h.total)
    expect(h.byType.tool_output).toBe(0)
    expect(h.toolOutputPct).toBe(0)
  })

  it("tool output percentage reflects proportion", () => {
    // All tool messages → toolOutputPct should be 1.0
    const msgs = [toolMsg("result 1"), toolMsg("result 2")]
    const h = measureContextHealth(msgs)
    expect(h.toolOutputPct).toBeCloseTo(1.0)
  })

  it("mixed messages produce correct byType counts", () => {
    const msgs = [systemMsg("sys"), userMsg("user"), toolMsg("tool")]
    const h = measureContextHealth(msgs)
    expect(h.byType.system).toBeGreaterThan(0)
    expect(h.byType.conversation).toBeGreaterThan(0)
    expect(h.byType.tool_output).toBeGreaterThan(0)
    expect(h.total).toBe(
      h.byType.system + h.byType.conversation + h.byType.tool_output + h.byType.code
    )
  })
})

// ─── smartCompact ───────────────────────────────────────────────────────────

describe("smartCompact", () => {
  it("empty input returns empty array", () => {
    expect(smartCompact([], 1000)).toEqual([])
  })

  it("messages within budget are returned unchanged", () => {
    const msgs = [userMsg("hi"), assistantMsg("hello")]
    const result = smartCompact(msgs, 100_000)
    expect(result).toHaveLength(2)
    expect((result[0] as any).content).toBe("hi")
  })

  it("tool_output over TOOL_OUTPUT_MAX_CHARS is truncated when over budget", () => {
    const bigResult = "x".repeat(TOOL_OUTPUT_MAX_CHARS + 500)
    const msgs: CoreMessage[] = [
      // Many conversation messages to push us over budget
      ...Array.from({ length: 5 }, (_, i) => userMsg(`message ${i} `.repeat(50))),
      {
        role: "tool",
        content: [{ type: "tool-result", toolCallId: "t1", result: bigResult }],
      } as unknown as CoreMessage,
    ]
    // Use a very tight budget to force trimming
    const result = smartCompact(msgs, 10)
    // The tool message content should be truncated
    const toolMsg = result.find((m) => m.role === "tool") as any
    if (toolMsg && Array.isArray(toolMsg.content)) {
      const part = toolMsg.content[0]
      const resultStr = JSON.stringify(part.result ?? "")
      expect(resultStr.length).toBeLessThanOrEqual(TOOL_OUTPUT_MAX_CHARS + 30) // +30 for "… [truncated]"
    }
  })

  it("conversation messages are trimmed when over budget", () => {
    const longContent = "word ".repeat(200) // ~200 tokens
    const msgs = Array.from({ length: 5 }, () => userMsg(longContent))
    const result = smartCompact(msgs, 5) // impossibly tight budget
    // At least one message should have truncated content
    const anyTrimmed = result.some((m) => {
      const c = (m as any).content
      return typeof c === "string" && c.includes("[truncated]")
    })
    expect(anyTrimmed).toBe(true)
  })

  it("message count is preserved after compaction", () => {
    const msgs = Array.from({ length: 4 }, (_, i) => userMsg(`msg ${i}`))
    const result = smartCompact(msgs, 1)
    expect(result).toHaveLength(4)
  })
})

// ─── extractFilePaths ───────────────────────────────────────────────────────

describe("extractFilePaths", () => {
  it("extracts ./relative paths", () => {
    const paths = extractFilePaths("See ./src/foo.ts for details")
    expect(paths).toContain("./src/foo.ts")
  })

  it("extracts src/ prefixed paths", () => {
    const paths = extractFilePaths("Modified src/utils/helper.ts")
    expect(paths).toContain("src/utils/helper.ts")
  })

  it("extracts packages/ prefixed paths", () => {
    const paths = extractFilePaths("File packages/core/src/index.ts was updated")
    expect(paths).toContain("packages/core/src/index.ts")
  })

  it("extracts multiple paths from text", () => {
    const text = "Updated src/a.ts and lib/b.ts"
    const paths = extractFilePaths(text)
    expect(paths.length).toBeGreaterThanOrEqual(2)
    expect(paths).toContain("src/a.ts")
    expect(paths).toContain("lib/b.ts")
  })

  it("strips trailing punctuation from paths", () => {
    const paths = extractFilePaths("See ./foo.ts, then ./bar.ts.")
    for (const p of paths) {
      expect(p).not.toMatch(/[,;.)]$/)
    }
  })

  it("returns at most 8 paths", () => {
    const parts = Array.from({ length: 10 }, (_, i) => `src/file${i}.ts`)
    const text = parts.join(" ")
    const paths = extractFilePaths(text)
    expect(paths.length).toBeLessThanOrEqual(8)
  })

  it("returns empty array when no paths found", () => {
    expect(extractFilePaths("no file paths here at all")).toEqual([])
  })

  it("does not extract node_modules paths", () => {
    // node_modules starts with none of the recognized prefixes and isn't ./ or /
    const paths = extractFilePaths("from node_modules/react/index.js")
    expect(paths).not.toContain("node_modules/react/index.js")
  })

  it("handles empty string input", () => {
    expect(extractFilePaths("")).toEqual([])
  })

  it("supports all listed file extensions", () => {
    const exts = ["ts", "tsx", "js", "jsx", "py", "go", "rs", "json"]
    for (const ext of exts) {
      const paths = extractFilePaths(`src/main.${ext}`)
      expect(paths.length).toBeGreaterThan(0)
    }
  })
})
