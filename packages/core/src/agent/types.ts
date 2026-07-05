import type { CoreMessage } from "ai"
import type { Attachment } from "../util/attachments.js"
import type { ActivatedSkillInfo } from "../skill/injector.js"
import type { PromptDiagnostics } from "./prompt-diagnostics.js"
import type { PromptCacheHealthResult } from "./prompt-cache-health.js"
import type { ContinuationDecision, ContinuationTaskState } from "./continuation.js"
import type { CompletionGateDecision } from "./completion-gate.js"
import type { LongTaskContinuationDecision } from "./continuation-controller.js"
import type { TaskLedger } from "./task-ledger.js"

export interface AgentContinuationOptions {
  getTasks?: (() => ContinuationTaskState[]) | undefined
  previousContinuations?: number | undefined
  maxContinuations?: number | undefined
  maxTaskContinuations?: number | undefined
}

export interface AgentRunOptions {
  sessionId?:   string
  provider?:    string
  model?:       string
  system?:      string
  undercover?:  boolean
  /** false ise coordinator promptu bu turn'e hiç enjekte edilmez (kullanıcı /coordinator ile
   *  kapattı). true/undefined ise loop.ts kendi karmaşıklık-kapılı kararını verir
   *  (cfg.orchestration.mode — bkz. Faz 3A). */
  coordinatorMode?: boolean
  effort?:      number
  workdir?:     string
  messages:     CoreMessage[]
  signal?:      AbortSignal
  stream?:      boolean
  attachments?:    Attachment[]   // multimodal dosya ekleri
  toolsOverride?:  string[]       // set ise sadece bu tool'lar etkin (session agent kısıtlaması)
  continuation?:   AgentContinuationOptions
  onText?:        (delta: string, isReasoning?: boolean) => void
  onToolCall?:    (call: { id: string; tool: string; args: unknown }) => void
  onToolResult?:  (res:  { id: string; result: string; durationMs: number }) => void
  /** Bash tool çalışırken gelen canlı stdout/stderr chunk'ları */
  onChunk?:       (chunk: string) => void
  onStepFinish?:  () => void
  onCompaction?:  () => void
  /** Provider fallback zinciri farklı bir provider'a geçtiğinde bir kez tetiklenir. */
  onProviderFallback?: (fromProvider: string, toProvider: string) => void
  /** Bir retry/fallback denemesi başlıyor — UI önceki (başarısız) denemeden akmış
   *  kısmi stream metnini/reasoning buffer'ını sıfırlamalı. */
  onStreamRestart?: () => void
  onSkillsActivated?: (skills: ActivatedSkillInfo[]) => void
  onPromptDiagnostics?: (diagnostics: PromptDiagnostics) => void
  onPromptCacheHealth?: (result: PromptCacheHealthResult) => void
  onFinish?:      (result: AgentFinishResult) => void
}

export interface TokenBreakdown {
  input:      number  // fresh input (non-cached)
  output:     number  // completion tokens
  cacheRead:  number  // cached prompt reads  (cheap)
  cacheWrite: number  // cache creation tokens
  reasoning:  number  // extended thinking tokens
}

export interface AgentFinishResult {
  text:         string
  tokens:       TokenBreakdown
  sessionId?:   string
  newMessages:  CoreMessage[]
  finishReason?: string
  continuation?: ContinuationDecision
  completionGate?: CompletionGateDecision
  longTask?: LongTaskContinuationDecision
  taskLedger?: TaskLedger
}

export type AgentStatus = "idle" | "running" | "done" | "error" | "aborted"
