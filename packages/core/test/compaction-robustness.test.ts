/**
 * Faz A/B/F — Compaction robustness testleri.
 *
 * Bu dosya `ai` paketinin `generateText` çağrısını controllable bir queue ile
 * mock'lar; transient retry, iptal (abort), katı timeout ve özet kalite muhafızını
 * LLM çağrısı yapmadan hızlıca doğrular. Kalite düşürülmediğini kanıtlar:
 * transient hatalarda yeniden deneme yapılır, iptal anında fırlatılır, özet zorunlu
 * bölümleri içermiyorsa tek hedefli retry istenir.
 */
import { describe, it, expect, beforeEach, mock } from "bun:test"

// --- `ai` mock: generateText'i bir kuyruktan döndür/throwla ----------------
let generateTextQueue: Array<{ text?: string; error?: Error }> = []
let generateTextCalls = 0
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let generateTextArgs: any[] = []

mock.module("ai", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generateText: async (args: any) => {
    generateTextArgs.push(args)
    const idx = generateTextCalls
    generateTextCalls++
    const resp = generateTextQueue[idx] ?? generateTextQueue[generateTextQueue.length - 1]
    if (resp?.error) throw resp.error
    return { text: resp?.text ?? "" }
  },
}))

const {
  runSummaryWithRetry,
  ensureStructuredSummary,
  missingSections,
  createCompactionDeadline,
  SESSION_REQUIRED_SECTIONS,
  SNIP_REQUIRED_SECTIONS,
  ContextCompactionError,
} = await import("../src/session/compaction.js")

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dummyModel = {} as any

beforeEach(() => {
  generateTextQueue = []
  generateTextCalls = 0
  generateTextArgs = []
})

describe("missingSections", () => {
  it("returns empty when all required sections are present", () => {
    expect(missingSections("A: x B: y C: z", ["A", "B", "C"])).toEqual([])
  })

  it("lists the missing sections", () => {
    expect(missingSections("A: x C: z", ["A", "B", "C"])).toEqual(["B"])
  })

  it("matches case-insensitively (markdown **bold** headers)", () => {
    expect(missingSections("**modified_files**: a\n**current_state**: z",
      ["MODIFIED_FILES", "CURRENT_STATE"])).toEqual([])
  })

  it("flags every missing section for a bare/broken summary", () => {
    expect(missingSections("stuff happened", [...SESSION_REQUIRED_SECTIONS]))
      .toEqual([...SESSION_REQUIRED_SECTIONS])
  })
})

describe("createCompactionDeadline", () => {
  it("aborts the signal after the timeout elapses", async () => {
    const deadline = createCompactionDeadline(undefined, 25)
    expect(deadline.signal.aborted).toBe(false)
    await new Promise(r => setTimeout(r, 90))
    expect(deadline.signal.aborted).toBe(true)
    deadline.dispose()
  })

  it("is immediately aborted when the parent signal pre-aborted", () => {
    const parent = new AbortController()
    parent.abort()
    const deadline = createCompactionDeadline(parent.signal, 10_000)
    expect(deadline.signal.aborted).toBe(true)
    deadline.dispose()
  })

  it("clears the timer on dispose so the signal never aborts", async () => {
    const deadline = createCompactionDeadline(undefined, 40)
    deadline.dispose()
    await new Promise(r => setTimeout(r, 140))
    expect(deadline.signal.aborted).toBe(false)
  })

  it("propagates parent abort to the child mid-flight", async () => {
    const parent = new AbortController()
    const deadline = createCompactionDeadline(parent.signal, 10_000)
    expect(deadline.signal.aborted).toBe(false)
    parent.abort()
    expect(deadline.signal.aborted).toBe(true)
    deadline.dispose()
  })
})

describe("runSummaryWithRetry", () => {
  it("retries on a transient 429 and returns the next success", async () => {
    generateTextQueue = [{ error: new Error("429 Too Many Requests") }, { text: "SUMMARY_OK" }]
    const result = await runSummaryWithRetry(dummyModel, "sys", "prompt", 100, { retryBaseDelayMs: 1 })
    expect(result).toBe("SUMMARY_OK")
    expect(generateTextCalls).toBe(2)
  })

  it("does NOT retry on a non-transient 400 and rethrows the raw error", async () => {
    generateTextQueue = [{ error: new Error("400 Bad Request") }]
    await expect(runSummaryWithRetry(dummyModel, "sys", "prompt", 100, { retryBaseDelayMs: 1 }))
      .rejects.toThrow("400 Bad Request")
    expect(generateTextCalls).toBe(1)
  })

  it("throws immediately and never calls the model when the signal pre-aborted", async () => {
    const ac = new AbortController()
    ac.abort()
    await expect(runSummaryWithRetry(dummyModel, "sys", "prompt", 100,
      { signal: ac.signal, retryBaseDelayMs: 1 }))
      .rejects.toThrow("Compaction aborted by user.")
    expect(generateTextCalls).toBe(0)
  })

  it("exhausts all 3 attempts when the provider stays transiently unavailable", async () => {
    generateTextQueue = [
      { error: new Error("503 overload") },
      { error: new Error("502 bad gateway") },
      { error: new Error("timeout") },
    ]
    await expect(runSummaryWithRetry(dummyModel, "sys", "prompt", 100, { retryBaseDelayMs: 1 }))
      .rejects.toThrow()
    expect(generateTextCalls).toBe(3)
  })

  it("honours Retry-After hint when present", async () => {
    generateTextQueue = [{ error: new Error("429 — retry-after: 2") }, { text: "OK" }]
    const start = Date.now()
    const result = await runSummaryWithRetry(dummyModel, "sys", "prompt", 100, {})
    const elapsed = Date.now() - start
    expect(result).toBe("OK")
    // retry-after: 2s — waited at least ~2s (use a generous lower bound).
    expect(elapsed).toBeGreaterThan(1500)
    expect(generateTextCalls).toBe(2)
  })

  it("passes the abortSignal to generateText when provided", async () => {
    const ac = new AbortController()
    generateTextQueue = [{ text: "OK" }]
    await runSummaryWithRetry(dummyModel, "sys", "prompt", 100, { signal: ac.signal, retryBaseDelayMs: 1 })
    expect(generateTextArgs[0]).toBeDefined()
    expect(generateTextArgs[0].abortSignal).toBe(ac.signal)
  })
})

describe("ensureStructuredSummary (quality guardian)", () => {
  it("does not call the model again when the summary has all required sections", async () => {
    const complete =
      "MODIFIED_FILES: a.ts\nDECISIONS: use X\nERRORS: none\nCURRENT_STATE: ok\nNEXT_STEPS: ship"
    const out = await ensureStructuredSummary(complete, SESSION_REQUIRED_SECTIONS,
      dummyModel, "sys", "prompt", 100, { retryBaseDelayMs: 1 })
    expect(out).toBe(complete)
    expect(generateTextCalls).toBe(0)
  })

  it("requests a targeted retry when the summary is missing sections", async () => {
    const partial = "MODIFIED_FILES: a.ts\nCURRENT_STATE: ok"
    generateTextQueue = [{
      text: "MODIFIED_FILES: a.ts\nDECISIONS: use X\nERRORS: none\nCURRENT_STATE: ok\nNEXT_STEPS: ship",
    }]
    const out = await ensureStructuredSummary(partial, SESSION_REQUIRED_SECTIONS,
      dummyModel, "sys", "basePrompt", 100, { retryBaseDelayMs: 1 })
    expect(generateTextCalls).toBe(1)
    // retry prompt must name the omitted sections and the full required set
    const retryContent = String(generateTextArgs[0]?.messages?.[0]?.content ?? "")
    expect(retryContent).toContain("DECISIONS")
    expect(retryContent).toContain("ERRORS")
    expect(retryContent).toContain("NEXT_STEPS")
    expect(out).toContain("DECISIONS")
    expect(out).toContain("NEXT_STEPS")
  })

  it("falls back to the original summary if the guardian retry itself fails", async () => {
    const partial = "MODIFIED_FILES: a.ts\nCURRENT_STATE: ok"
    generateTextQueue = [{ error: new Error("503 overload") }] // guardian retry exhausts (1 attempt)
    // Pre-feed the main call already; guardian runs its own retry which fails here.
    // Note: ensureStructuredSummary calls runSummaryWithRetry only for the retry path.
    const out = await ensureStructuredSummary(partial, SESSION_REQUIRED_SECTIONS,
      dummyModel, "sys", "basePrompt", 100, { retryBaseDelayMs: 1 })
    expect(out).toBe(partial) // degrade gracefully, keep original (kalite: best-effort)
  })

  it("validates the snip section set independently", () => {
    expect(missingSections("MODIFIED_FILES: x COMMANDS_RUN: y ERRORS_FIXED: z CURRENT_STATE: w",
      [...SNIP_REQUIRED_SECTIONS])).toEqual([])
  })
})

describe("ContextCompactionError", () => {
  it("preserves its name and cause", () => {
    const cause = new Error("boom")
    const err = new ContextCompactionError("wrapper", cause)
    expect(err.name).toBe("ContextCompactionError")
    expect(err.message).toBe("wrapper")
    expect(err.cause).toBe(cause)
  })
})