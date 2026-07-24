import { generateText } from "ai"
import { readFile }     from "fs/promises"
import type { CoreMessage, LanguageModelV1 } from "ai"
import { ProviderRegistry }   from "../provider/registry.js"
import { countMessageTokens, countTokens, tokenizableMessageText } from "../provider/tokenizer.js"
import { calibratedTokenEstimate } from "../provider/token-calibration.js"
import { hooks }              from "../hook/emitter.js"
import {
  smartCompact,
  measureContextHealth,
  importanceScore,
  extractText,
  extractFilePaths,
} from "./context-compactor.js"
import { resolveWithinWorkspace } from "../security/path-boundary.js"
import { clearToolMessageResults } from "./tool-message-compaction.js"
import { addProtectedErrors, extractErrorChains } from "./compaction-errors.js"
import { buildBoundedSummaryTranscript, SUMMARY_SYSTEM_PROMPT } from "./summary-input.js"
import {
  extractProtectedContextFacts,
  formatProtectedContextFacts,
  injectProtectedFacts,
  PROTECTED_FACTS_MARKER,
} from "./protected-context.js"
export {
  extractProtectedContextFacts,
  formatProtectedContextFacts,
  PROTECTED_FACTS_MARKER,
  type ProtectedContextFacts,
} from "./protected-context.js"
export { addProtectedErrors, extractErrorChains, type ErrorChain } from "./compaction-errors.js"

// ─── Constants ────────────────────────────────────────────────────────────────
export const COMPACTION_BUFFER     = 20_000
export const TOOL_OUTPUT_MAX_CHARS =  2_000
export const DEFAULT_TAIL_TURNS    =      2
export const PRUNE_MINIMUM         = 20_000
export const PRUNE_PROTECT         = 40_000
export const DEFAULT_MSG_THRESHOLD =    100
export const TOOL_RESULT_CLEARED_MESSAGE = "[Old tool result content cleared]"
/**
 * Compaction'ın LLM özetleme çağrısı için katı toplam süre üst sınırı.
 * Kalite her zaman öncelikli olduğu için geniş tutulur (kullanıcı onayı);
 * tek işlevi sonsuza asılı kalmayı önlemek ve ESC ile iptale izin vermektir.
 */
export const COMPACTION_TOTAL_TIMEOUT_MS = 120_000
/** Compaction sırasında bir hook handler'ın asılı kalmasına izin verilen maksimum süre. */
export const COMPACTION_HOOK_TIMEOUT_MS = 5_000

// ─── Abort / timeout yardımcıları ─────────────────────────────────────────────
// İsteğe bağlı bir parent signal (kullanıcı ESC'si) ile katı bir toplam timeout'u
// tek AbortSignal'de birleştirir. Önemli: SESSION/edyto özet kalitesi düşürülmez;
// bu yalnızca sonsuz asılmayı engeller.
export interface CompactionDeadline {
  signal:   AbortSignal
  dispose:  () => void
}

export function createCompactionDeadline(
  parentSignal: AbortSignal | undefined,
  timeoutMs:    number = COMPACTION_TOTAL_TIMEOUT_MS,
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

// ─── Transient retry + özet kalite muhafızı ─────────────────────────────────
// Kalite ASLA düşürülmez: transient (429/503/timeout/network) hatalarda kısa
// backoff'la yeniden denenir, böylece circuit-breaker gerçek kesintiler dışında
// neredeyse hiç açılmaz → "compact edilemiyor" semptomu kaybolur. Circuit'e
// yalnızca NİHAÎ başarısızlık +1 yazar.
const COMPACTION_MAX_ATTEMPTS = 3
const COMPACTION_RETRYABLE =
  /429|rate.?limit|too.?many|503|502|overload|unavailable|ECONNREFUSED|ENOTFOUND|network|timeout|fetch failed|EAI_AGAIN|socket hang up/i

function parseCompactionRetryAfter(message: string): number | undefined {
  const match = message.match(/retry.{0,10}after[:\s]+(\d+)/i)
  return match ? Number(match[1]) * 1_000 : undefined
}

function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error("aborted")); return }
    const onAbort = () => { cleanup(); reject(new Error("aborted")) }
    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
    }
    const timer = setTimeout(() => { cleanup(); resolve() }, ms)
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

/**
 * Compaction özetleme çağrısını transient hatalara dayanıklı çalıştırır.
 * ESC/iptal gelirse asla retry etmeden hemen fırlatır. Circuit kaydı burada
 * YAPILMAZ — caller try/catch'inde nihai sonucu circuit'e yazar.
 */
export async function runSummaryWithRetry(
  model:     LanguageModelV1,
  system:    string,
  prompt:    string,
  maxTokens: number,
  cfg:       Pick<CompactionConfig, "signal" | "retryBaseDelayMs">,
): Promise<string> {
  const baseDelay = cfg.retryBaseDelayMs ?? 4_000
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
      const msg = error instanceof Error ? error.message : String(error)
      if (!COMPACTION_RETRYABLE.test(msg)) throw error       // transient değil: bırak
      if (attempt === COMPACTION_MAX_ATTEMPTS - 1) throw error // son deneme tükendi
      const delay = parseCompactionRetryAfter(msg) ?? (baseDelay * (attempt + 1))
      try {
        await sleepWithSignal(delay, cfg.signal)
      } catch {
        throw new ContextCompactionError("Compaction aborted by user.")
      }
    }
  }
  throw lastError
}

/** Özetin zorunlu yapısal bölümleri eksikse tek bir hedefli retry ister. */
export const SESSION_REQUIRED_SECTIONS =
  ["MODIFIED_FILES", "DECISIONS", "ERRORS", "CURRENT_STATE", "NEXT_STEPS"] as const
export const SNIP_REQUIRED_SECTIONS =
  ["MODIFIED_FILES", "COMMANDS_RUN", "ERRORS_FIXED", "CURRENT_STATE"] as const

export function missingSections(summary: string, required: readonly string[]): string[] {
  const upper = summary.toUpperCase()
  return required.filter(section => !upper.includes(section))
}

export async function ensureStructuredSummary(
  summary:    string,
  required:   readonly string[],
  model:      LanguageModelV1,
  system:     string,
  basePrompt: string,
  maxTokens:  number,
  cfg:        Pick<CompactionConfig, "signal" | "retryBaseDelayMs">,
): Promise<string> {
  const missing = missingSections(summary, required)
  if (missing.length === 0) return summary
  if (cfg.signal?.aborted) return summary
  const retryPrompt = [
    basePrompt,
    "",
    `Your previous summary omitted these required sections: ${missing.join(", ")}.`,
    `Re-summarize and include ALL of: ${required.join(", ")}.`,
    "Copy file paths and error messages VERBATIM. Do not omit any required section.",
  ].join("\n")
  try {
    return await runSummaryWithRetry(model, system, retryPrompt, maxTokens, cfg)
  } catch {
    return summary // guardian retry başarısızsa eldeki en iyi özetle devam et
  }
}

export type CompactionStrategy = "aggressive" | "balanced" | "conservative"

export interface CompactionConfig {
  contextLimit:           number
  maxOutput:              number
  tailTurns:              number
  provider:               string
  model:                  string
  tokenizerEncoding?:     string
  workdir?:               string
  sessionId?:             string
  strategy?:              CompactionStrategy
  messageCountThreshold?: number
  utilityProvider?:       string
  utilityModel?:          string
  utilityMaxInputTokens?: number
  utilityMaxOutputTokens?: number
  /** Kullanıcı iptali (ESC) — Sarkmada compaction dahil her şey iptal olsun. */
  signal?:                AbortSignal
  /** Compaction'ın LLM özetleme çağrısı için katı toplam üst sınır. */
  timeoutMs?:             number
  /** Transient hatalarda retry backoff'unun taban gecikmesi (ms). Test edilebilirlik
   *  ve ince-ayar için açılmıştır; üretimde varsayılan 4000ms'dir. */
  retryBaseDelayMs?:      number
}

export class ContextCompactionError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = "ContextCompactionError"
  }
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────
const CB_MAX_FAILURES = 3
const CB_RESET_MS     = 60_000

export type CBStatus = "closed" | "open" | "half-open"
export interface CBState { status: CBStatus; failures: number; lastFailAt: number }

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
  cfg: Pick<CompactionConfig, "provider" | "model" | "sessionId"> = { provider: "unknown", model: "unknown" },
): Readonly<CBState> {
  return { ...circuitState(cfg) }
}

function cbRecordSuccess(cfg: CompactionConfig): void {
  const cb = circuitState(cfg)
  cb.failures = 0
  cb.status = "closed"
}

function cbRecordFailure(cfg: CompactionConfig): void {
  const cb = circuitState(cfg)
  cb.failures++
  cb.lastFailAt = Date.now()
  if (cb.failures >= CB_MAX_FAILURES) cb.status = "open"
}

function cbIsOpen(cfg: CompactionConfig): boolean {
  const cb = circuitState(cfg)
  if (cb.status === "closed") return false
  if (cb.status === "open" && Date.now() - cb.lastFailAt >= CB_RESET_MS) {
    cb.status = "half-open"
    return false
  }
  return cb.status === "open"
}

export function splitTailTurns(messages: CoreMessage[], turns: number): { head: CoreMessage[]; tail: CoreMessage[] } {
  if (turns <= 0 || messages.length === 0) return { head: messages, tail: [] }
  let userTurns = 0
  let splitAt = 0
  for (let index = messages.length - 1; index >= 0; index--) {
    if (messages[index]?.role !== "user") continue
    userTurns++
    if (userTurns === turns) {
      splitAt = index
      break
    }
  }
  if (userTurns < turns) splitAt = 0
  return { head: messages.slice(0, splitAt), tail: messages.slice(splitAt) }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
export function estimateTokens(messages: CoreMessage[], modelId?: string, tokenizerEncoding?: string): number {
  return messages.reduce((sum, message) => sum + countMessageTokens(message, modelId, tokenizerEncoding), 0)
}

export interface EffectiveContextOptions {
  modelId: string
  providerId?: string
  tokenizerEncoding?: string
  systemPrompt?: string
  toolSchemaReserveTokens?: number
  attachmentReserveTokens?: number
  safetyMargin?: number
}

/**
 * Provider'a gönderilecek bağlamın korumacı tahmini. History dışında system/gitre
 * blokları ve provider'a özgü tool/ek overhead'i de karar bütçesine girer.
 */
export function estimateEffectiveContextTokens(
  messages: CoreMessage[],
  options: EffectiveContextOptions,
): number {
  const systemTokens = options.systemPrompt
    ? countTokens(options.systemPrompt, options.modelId, options.tokenizerEncoding)
    : 0
  const raw = estimateTokens(messages, options.modelId, options.tokenizerEncoding)
    + systemTokens
    + (options.toolSchemaReserveTokens ?? 0)
    + (options.attachmentReserveTokens ?? 0)
  return Math.ceil(
    calibratedTokenEstimate(options.providerId, options.modelId, raw) * (options.safetyMargin ?? 1.15),
  )
}

export function isOverflow(messages: CoreMessage[], cfg: CompactionConfig): boolean {
  const usable = cfg.contextLimit - cfg.maxOutput - COMPACTION_BUFFER
  return calibratedTokenEstimate(
    cfg.provider,
    cfg.model,
    estimateTokens(messages, cfg.model, cfg.tokenizerEncoding),
  ) >= usable
}

export function isOverflowByMessages(messages: CoreMessage[], cfg: CompactionConfig): boolean {
  return messages.length >= (cfg.messageCountThreshold ?? DEFAULT_MSG_THRESHOLD)
}

export interface ContextBreakdown {
  total:       number
  byRole:      Record<string, number>
  topMessages: Array<{ preview: string; tokens: number }>
  percentUsed: number
}

export function getContextBreakdown(messages: CoreMessage[], contextWindow: number, modelId?: string, tokenizerEncoding?: string): ContextBreakdown {
  const byRole: Record<string, number> = {}
  const withTokens: Array<{ preview: string; tokens: number; role: string }> = []

  for (const msg of messages) {
    const text   = tokenizableMessageText(msg)
    const tokens = countMessageTokens(msg, modelId, tokenizerEncoding)
    byRole[msg.role] = (byRole[msg.role] ?? 0) + tokens
    withTokens.push({ preview: text.slice(0, 60).replace(/\n/g, " "), tokens, role: msg.role })
  }

  const total = Object.values(byRole).reduce((s, n) => s + n, 0)
  const topMessages = withTokens
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 5)
    .map(({ preview, tokens }) => ({ preview, tokens }))

  return { total, byRole, topMessages, percentUsed: contextWindow > 0 ? total / contextWindow : 0 }
}

export function microCompactOldToolResults(
  messages: CoreMessage[],
  cfg: Pick<CompactionConfig, "contextLimit"> & Partial<Pick<CompactionConfig, "model" | "tokenizerEncoding">>,
  options: { keepRecent?: number; triggerRatio?: number } = {},
): CoreMessage[] {
  const keepRecent = Math.max(1, options.keepRecent ?? 8)
  const triggerRatio = options.triggerRatio ?? 0.65
  if (estimateTokens(messages, cfg.model, cfg.tokenizerEncoding) < cfg.contextLimit * triggerRatio) return messages

  const toolIndexes = messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => message.role === "tool" && extractText(message) !== TOOL_RESULT_CLEARED_MESSAGE)
    .map(({ index }) => index)
  if (toolIndexes.length <= keepRecent) return messages

  const keep = new Set(toolIndexes.slice(-keepRecent))
  let changed = false
  const compacted = messages.map((message, index) => {
    if (message.role !== "tool" || keep.has(index)) return message
    changed = true
    return clearToolMessageResults(message, TOOL_RESULT_CLEARED_MESSAGE)
  })

  if (!changed) return messages

  const protectedFacts = formatProtectedContextFacts(extractProtectedContextFacts(messages))
  return protectedFacts ? injectProtectedFacts(compacted, protectedFacts) : compacted
}

// ─── Strategy 1: microCompact ─────────────────────────────────────────────────
// Hiç LLM çağrısı yok. Küçük taşmalar için hızlı heuristik kırpma.
function microCompact(messages: CoreMessage[], targetBudget: number, modelId?: string, tokenizerEncoding?: string): CoreMessage[] {
  const annotated = messages.map((msg, idx) => ({
    msg,
    score:  importanceScore(msg, messages, idx),
    tokens: countTokens(extractText(msg), modelId, tokenizerEncoding) + 4,
  }))

  // Önce: skor < 20 olan mesajları sil (çok düşük önem)
  const filtered = annotated.filter((a) => a.score >= 20)

  // Ardından: kalan bütçe için smartCompact ile kırp
  const budget = Math.max(PRUNE_MINIMUM, targetBudget)
  return smartCompact(filtered.map((a) => a.msg), budget)
}

// ─── Strategy 2: snipCompact ─────────────────────────────────────────────────
// Tool output ağırlıklı konuşmalar için. Bir LLM çağrısıyla araç bölümlerini özetler.
async function snipCompact(
  messages: CoreMessage[],
  cfg:      CompactionConfig,
): Promise<CoreMessage[]> {
  const tailBonus  = (cfg.strategy === "conservative" ? 2 : cfg.strategy === "aggressive" ? -1 : 0)
  const tailTurns  = Math.max(1, (cfg.tailTurns ?? DEFAULT_TAIL_TURNS) + tailBonus)
  const { head, tail } = splitTailTurns(messages, tailTurns)

  // Araç mesajlarını toplu özetle
  const toolMessages = head.filter((m) => m.role === "tool" || (m.role === "assistant" && (
    Array.isArray(m.content) && m.content.some((p: unknown) => {
      const part = p as Record<string, unknown>
      return part?.type === "tool-call"
    })
  )))

  const toolContext = toolMessages.slice(0, 30).map((m) => {
    const text = extractText(m).slice(0, 800)
    return `[${m.role}]: ${text}`
  }).join("\n\n")

  const utilityProvider = cfg.utilityProvider ?? cfg.provider
  const utilityModel = cfg.utilityModel ?? cfg.model
  const plugin = ProviderRegistry.get(utilityProvider)
  const model  = plugin.getModel(utilityModel)

  const snipPrompt =
    `These are tool operations from a coding session. Extract the following — copy file paths and error messages VERBATIM, do not paraphrase:\n\n` +
    `MODIFIED_FILES: list every file path that was read, written, or edited\n` +
    `COMMANDS_RUN: list bash commands and their outcomes (success/fail/error)\n` +
    `ERRORS_FIXED: bugs found and how they were resolved (include exact error messages)\n` +
    `CURRENT_STATE: one sentence on where the task stands now\n\n` +
    `Tool operations:\n\n${toolContext}`
  const snipMaxTokens = Math.min(cfg.utilityMaxOutputTokens ?? 1_200, 800)

  let snipSummary: string
  try {
    snipSummary = await runSummaryWithRetry(model, SUMMARY_SYSTEM_PROMPT, snipPrompt, snipMaxTokens, cfg)
    // Kalite muhafızı: zorunlu bölümler eksikse tek hedefli retry (Claude'dan daha iyi).
    snipSummary = await ensureStructuredSummary(
      snipSummary, SNIP_REQUIRED_SECTIONS,
      model, SUMMARY_SYSTEM_PROMPT, snipPrompt, snipMaxTokens, cfg,
    )
  } catch (error) {
    cbRecordFailure(cfg)
    throw new ContextCompactionError("Context compaction could not summarize tool activity.", error)
  }

  // Araç mesajlarını özetle değiştir, konuşma mesajlarını koru
  const conversation = head.filter((m) => m.role !== "tool" && !(
    m.role === "assistant" && Array.isArray(m.content) && m.content.some((p: unknown) => {
      const part = p as Record<string, unknown>
      return part?.type === "tool-call"
    })
  ))

  const compacted: CoreMessage[] = [
    ...conversation,
    { role: "user",      content: "[Tool operations summary]" },
    { role: "assistant", content: snipSummary },
    ...tail,
  ]

  cbRecordSuccess(cfg)
  return compacted
}

// ─── Strategy 3: sessionCompact ──────────────────────────────────────────────
// Tam özet. Yapısal prompt + post-compact dosya re-injection + boundary marker.
async function sessionCompact(
  messages: CoreMessage[],
  cfg:      CompactionConfig,
): Promise<CoreMessage[]> {
  const tailBonus = (cfg.strategy === "conservative" ? 2 : cfg.strategy === "aggressive" ? -1 : 0)
  const tailTurns = Math.max(1, (cfg.tailTurns ?? DEFAULT_TAIL_TURNS) + tailBonus)

  const { head, tail } = splitTailTurns(messages, tailTurns)
  const transcript = buildBoundedSummaryTranscript(
    head,
    cfg.utilityMaxInputTokens ?? 24_000,
    cfg.utilityModel ?? cfg.model,
    cfg.tokenizerEncoding,
  )

  const summaryPrompt = cfg.strategy === "aggressive"
    ? [
        "Summarize this coding session in 4-6 bullet points. For each bullet include exact file paths and specific values — do NOT paraphrase them.",
        "Focus on: what changed, what broke, what was fixed, what is next.",
      ].join("\n")
    : cfg.strategy === "conservative"
    ? [
        "Provide a structured summary of the work done so far.",
        "You MUST copy file paths, error messages, variable names, and config keys VERBATIM — never paraphrase specific values.",
        "",
        "**MODIFIED_FILES:** List every file path that was touched (exact paths)",
        "**DECISIONS:** Architectural or design choices made and why",
        "**ERRORS:** Bugs encountered and how they were resolved (include exact error messages)",
        "**CURRENT_STATE:** What is working, what is broken, what is in progress",
        "**NEXT_STEPS:** What remains to be done",
      ].join("\n")
    : [
        "Summarize this coding session. You MUST include:",
        "1. MODIFIED_FILES: exact file paths (copy verbatim — never paraphrase)",
        "2. DECISIONS: architectural/design choices and their reasons",
        "3. ERRORS: bugs found and fixes applied (include exact error text)",
        "4. CURRENT_STATE: what works, what is broken, what is in progress",
        "5. NEXT_STEPS: what still needs to be done",
        "",
        "Preserve all specific values: line numbers, error codes, variable names, config keys.",
      ].join("\n")

  const utilityProvider = cfg.utilityProvider ?? cfg.provider
  const utilityModel = cfg.utilityModel ?? cfg.model
  const plugin = ProviderRegistry.get(utilityProvider)
  const model  = plugin.getModel(utilityModel)

  const sessionPrompt = `${summaryPrompt}\n\nBounded session transcript:\n\n${transcript}`
  const sessionMaxTokens = cfg.utilityMaxOutputTokens ?? 1_200

  let summary: string
  try {
    summary = await runSummaryWithRetry(model, SUMMARY_SYSTEM_PROMPT, sessionPrompt, sessionMaxTokens, cfg)
    // Kalite muhafızı: yapısal bölümler eksikse tek hedefli retry (Claude'dan daha iyi).
    summary = await ensureStructuredSummary(
      summary, SESSION_REQUIRED_SECTIONS,
      model, SUMMARY_SYSTEM_PROMPT, sessionPrompt, sessionMaxTokens, cfg,
    )
  } catch (error) {
    cbRecordFailure(cfg)
    throw new ContextCompactionError("Context compaction could not summarize the earlier conversation.", error)
  }

  // Post-compact file re-injection: summary'de geçen kaynak dosyaları ekle
  const filePaths  = extractFilePaths(summary)
  const fileBlocks: string[] = []

  for (const filePath of filePaths.slice(0, 3)) {
    try {
      const base    = cfg.workdir ?? process.cwd()
      const abs     = await resolveWithinWorkspace(base, filePath)
      const content = await readFile(abs, "utf8")
      fileBlocks.push(`\n[Re-injected: ${filePath}]\n\`\`\`\n${content.slice(0, 4_000)}\n\`\`\``)
    } catch (error) {
      console.warn(`[aurict] compaction skipped unsafe or unreadable path '${filePath}'`, error)
    }
  }

  // Scratchpad re-injection: reasoning state'i compaction'a karşı koru
  let scratchpadSection = ""
  if (cfg.sessionId && cfg.workdir) {
    try {
      const { scratchpadStore } = await import("../scratchpad/store.js")
      const state = scratchpadStore.read(cfg.sessionId, cfg.workdir)
      if (state) scratchpadSection = scratchpadStore.toPromptSection(state)
    } catch (error) {
      console.warn(`[aurict] compaction could not restore scratchpad for ${cfg.sessionId}`, error)
    }
  }

  // ─── Faz 3: Error chain preservation ────────────────────────────────────────
  const errorChains = extractErrorChains(messages)
  const errorSection = addProtectedErrors("", errorChains)
  const protectedFacts = formatProtectedContextFacts(extractProtectedContextFacts(messages))

  // Boundary marker: compaction noktasını izlenebilir kıl
  const boundaryId = crypto.randomUUID().slice(0, 8)
  const fullSummary = (scratchpadSection ? scratchpadSection + "\n\n" : "")
    + summary + (protectedFacts ? `\n\n${protectedFacts}` : "") + fileBlocks.join("") + errorSection + `\n\n[COMPACT:${boundaryId}]`

  const compacted: CoreMessage[] = [
    { role: "user",      content: "[Summary of previous conversation]" },
    { role: "assistant", content: fullSummary },
    ...tail,
  ]

  cbRecordSuccess(cfg)
  return compacted
}

// ─── Router ───────────────────────────────────────────────────────────────────
// Taşma miktarına ve context sağlığına göre en uygun stratejiyi seç.
export async function compact(
  messages: CoreMessage[],
  cfg:      CompactionConfig,
): Promise<CoreMessage[]> {
  if (cbIsOpen(cfg)) {
    throw new ContextCompactionError(
      "Context compaction is temporarily unavailable after repeated summary failures. " +
      "The summarizer model is likely rate-limited or down. Wait a moment and retry your " +
      "message, or point the compaction utility model at a different provider. " +
      "(kalite düşürülmedi — gerçek kesintide fail-loud.)",
    )
  }

  const usable   = cfg.contextLimit - cfg.maxOutput - COMPACTION_BUFFER
  const current  = estimateTokens(messages, cfg.model, cfg.tokenizerEncoding)
  const overflow = current - usable
  const health   = measureContextHealth(messages)

  const tokensBefore = current
  const sid = cfg.sessionId ?? "unknown"
  await hooks.emit("v1.compact.before", { sessionId: sid, tokenCount: tokensBefore }, { timeoutMs: COMPACTION_HOOK_TIMEOUT_MS })

  // Parent signal (ESC) + katı toplam timeout'u tek AbortSignal'de birleştir.
  // Önemli: kalite düşürülmez — bu yalnızca sonsuz asılmayı ve iptali yönetir;
  // gerçek LLM özeti yine üretilir (120 saniyeye kadar beklenebilir).
  const deadline  = createCompactionDeadline(cfg.signal, cfg.timeoutMs)
  const boundedCfg: CompactionConfig = { ...cfg, signal: deadline.signal }

  let result: CoreMessage[] | undefined
  try {
    // Küçük taşma (<8% of context): microCompact dene, yetersizse session'a geç
    if (overflow < cfg.contextLimit * 0.08) {
      const micro = microCompact(messages, usable, cfg.model, cfg.tokenizerEncoding)
      if (estimateTokens(micro, cfg.model, cfg.tokenizerEncoding) <= usable) {
        result = micro
      } else {
      }
    }

    // Tool output ağırlıklı (>55%): snipCompact
    if (!result && health.toolOutputPct > 0.55) result = await snipCompact(messages, boundedCfg)

    // Varsayılan: tam session compaction
    if (!result) result = await sessionCompact(messages, boundedCfg)

    const tokensAfter = estimateTokens(result, cfg.model, cfg.tokenizerEncoding)

    await hooks.emit("v1.session.compact", { sessionId: sid, tokensBefore, tokensAfter }, { timeoutMs: COMPACTION_HOOK_TIMEOUT_MS })
    await hooks.emit("v1.compact.after",   { sessionId: sid, tokensBefore, tokensAfter }, { timeoutMs: COMPACTION_HOOK_TIMEOUT_MS })

    return result
  } finally {
    deadline.dispose()
  }
}
