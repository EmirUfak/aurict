export type CompactionStrategy = "aggressive" | "balanced" | "conservative"

export interface CompactionConfig {
  contextLimit: number
  maxOutput: number
  tailTurns: number
  provider: string
  model: string
  tokenizerEncoding?: string
  workdir?: string
  sessionId?: string
  strategy?: CompactionStrategy
  messageCountThreshold?: number
  utilityProvider?: string
  utilityModel?: string
  utilityMaxInputTokens?: number
  utilityMaxOutputTokens?: number
  /** Kullanıcı iptali compaction dahil bütün bekleyen çağrıları sonlandırır. */
  signal?: AbortSignal
  /** Aynı-model compaction çağrısının toplam süre üst sınırı. */
  timeoutMs?: number
  retryBaseDelayMs?: number
}

export class ContextCompactionError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = "ContextCompactionError"
  }
}
