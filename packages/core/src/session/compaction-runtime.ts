import { generateText } from "ai"
import type { LanguageModelV1 } from "ai"
import type { CompactionConfig } from "./compaction-contract.js"
import { ContextCompactionError } from "./compaction-contract.js"

export const COMPACTION_TOTAL_TIMEOUT_MS = 45_000

export interface CompactionDeadline {
  signal: AbortSignal
  dispose: () => void
}

export function createCompactionDeadline(
  parentSignal: AbortSignal | undefined,
  timeoutMs: number = COMPACTION_TOTAL_TIMEOUT_MS,
): CompactionDeadline {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const onParentAbort = () => controller.abort()

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort()
      clearTimeout(timer)
      return { signal: controller.signal, dispose: () => {} }
    }
    parentSignal.addEventListener("abort", onParentAbort, { once: true })
  }

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer)
      if (parentSignal) parentSignal.removeEventListener("abort", onParentAbort)
    },
  }
}

const COMPACTION_MAX_ATTEMPTS = 3
const COMPACTION_RETRYABLE =
  /429|rate.?limit|too.?many|503|502|overload|unavailable|ECONNREFUSED|ENOTFOUND|network|timeout|fetch failed|EAI_AGAIN|socket hang up/i

function parseCompactionRetryAfter(message: string): number | undefined {
  const match = message.match(/retry.{0,10}after[:\s]+(\d+)/i)
  return match ? Number(match[1]) * 1_000 : undefined
}

function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ContextCompactionError("Compaction aborted by user."))
      return
    }
    const onAbort = () => {
      cleanup()
      reject(new ContextCompactionError("Compaction aborted by user."))
    }
    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
    }
    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

export async function runSummaryWithRetry(
  model: LanguageModelV1,
  system: string,
  prompt: string,
  maxTokens: number,
  cfg: Pick<CompactionConfig, "signal" | "retryBaseDelayMs">,
): Promise<string> {
  const baseDelay = cfg.retryBaseDelayMs ?? 2_000
  let lastError: unknown
  for (let attempt = 0; attempt < COMPACTION_MAX_ATTEMPTS; attempt++) {
    if (cfg.signal?.aborted) throw new ContextCompactionError("Compaction aborted by user.")
    try {
      const { text } = await generateText({
        model,
        system,
        messages: [{ role: "user", content: prompt }],
        maxTokens,
        ...(cfg.signal ? { abortSignal: cfg.signal } : {}),
      })
      return text
    } catch (error) {
      lastError = error
      if (cfg.signal?.aborted) throw new ContextCompactionError("Compaction aborted by user.")
      const message = error instanceof Error ? error.message : String(error)
      if (!COMPACTION_RETRYABLE.test(message) || attempt === COMPACTION_MAX_ATTEMPTS - 1) {
        throw error
      }
      await sleepWithSignal(
        parseCompactionRetryAfter(message) ?? baseDelay * (attempt + 1),
        cfg.signal,
      )
    }
  }
  throw lastError
}

export const SESSION_REQUIRED_SECTIONS =
  ["MODIFIED_FILES", "DECISIONS", "ERRORS", "CURRENT_STATE", "NEXT_STEPS"] as const
export const SNIP_REQUIRED_SECTIONS =
  ["MODIFIED_FILES", "COMMANDS_RUN", "ERRORS_FIXED", "CURRENT_STATE"] as const

export function missingSections(summary: string, required: readonly string[]): string[] {
  const upper = summary.toUpperCase()
  return required.filter(section => !upper.includes(section))
}

export async function ensureStructuredSummary(
  summary: string,
  required: readonly string[],
  model: LanguageModelV1,
  system: string,
  basePrompt: string,
  maxTokens: number,
  cfg: Pick<CompactionConfig, "signal" | "retryBaseDelayMs">,
): Promise<string> {
  const missing = missingSections(summary, required)
  if (missing.length === 0 || cfg.signal?.aborted) return summary
  const retryPrompt = [
    basePrompt,
    "",
    `Your previous summary omitted these required sections: ${missing.join(", ")}.`,
    `Re-summarize and include ALL of: ${required.join(", ")}.`,
    "Copy file paths and error messages VERBATIM. Do not omit any required section.",
  ].join("\n")
  try {
    return await runSummaryWithRetry(model, system, retryPrompt, maxTokens, cfg)
  } catch (error) {
    if (cfg.signal?.aborted) throw error
    return summary
  }
}

const CB_MAX_FAILURES = 3
const CB_RESET_MS = 60_000

export type CBStatus = "closed" | "open" | "half-open"
export interface CBState {
  status: CBStatus
  failures: number
  lastFailAt: number
}

const circuitStates = new Map<string, CBState>()

function circuitKey(cfg: Pick<CompactionConfig, "provider" | "model" | "sessionId">): string {
  return `${cfg.provider}\0${cfg.model}\0${cfg.sessionId ?? "anonymous"}`
}

function circuitState(cfg: Pick<CompactionConfig, "provider" | "model" | "sessionId">): CBState {
  const key = circuitKey(cfg)
  const existing = circuitStates.get(key)
  if (existing) return existing
  const created: CBState = { status: "closed", failures: 0, lastFailAt: 0 }
  circuitStates.set(key, created)
  return created
}

export function getCircuitState(
  cfg: Pick<CompactionConfig, "provider" | "model" | "sessionId"> = {
    provider: "unknown",
    model: "unknown",
  },
): Readonly<CBState> {
  return { ...circuitState(cfg) }
}

export function recordCompactionSuccess(cfg: CompactionConfig): void {
  const state = circuitState(cfg)
  state.failures = 0
  state.status = "closed"
}

export function recordCompactionFailure(cfg: CompactionConfig): void {
  const state = circuitState(cfg)
  state.failures++
  state.lastFailAt = Date.now()
  if (state.failures >= CB_MAX_FAILURES) state.status = "open"
}

export function isCompactionCircuitOpen(cfg: CompactionConfig): boolean {
  const state = circuitState(cfg)
  if (state.status !== "open") return false
  if (Date.now() - state.lastFailAt < CB_RESET_MS) return true
  state.status = "half-open"
  return false
}
