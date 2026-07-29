import type { LanguageModel } from "ai"

export interface ModelInfo {
  id: string
  name: string
  contextWindow: number
  maxOutput: number
  supportsTools:    boolean
  supportsVision:   boolean
  supportsThinking?: boolean   // models.dev reasoning flag veya manuel
  /** Whether tool support came from an explicit catalog, metadata, or heuristic. */
  toolSupportSource?: "declared" | "metadata" | "inferred"
}

/**
 * Hangi AI SDK paketinin kullanıldığını belirler.
 * Thinking format'ı bu değere göre seçilir — model ID'ye değil.
 */
export type SDKType =
  | "anthropic"          // @ai-sdk/anthropic
  | "openai"             // @ai-sdk/openai (openai.com)
  | "openai-compatible"  // @ai-sdk/openai başka endpoint (openrouter, ollama, opencode...)
  | "google"             // @ai-sdk/google

/**
 * SDKType + budget → providerOptions.
 * OpenRouter gibi routing proxy'ler model ID prefix'ini override eder.
 */
export function thinkingOptionsForSDK(
  sdkType:    SDKType,
  budget:     number,
  modelId?:   string,
): Record<string, unknown> | null {
  switch (sdkType) {
    case "anthropic":
      return { anthropic: { thinking: { type: "enabled", budgetTokens: budget } } }

    case "openai": {
      // o-serisi modeller thinking destekler, diğerleri hayır
      const base = modelId?.split("/").pop() ?? modelId ?? ""
      if (!base.match(/^o\d/)) return null
      const effort = budget <= 4000 ? "low" : budget <= 16000 ? "medium" : "high"
      return { openai: { reasoningEffort: effort } }
    }

    case "google":
      return { google: { thinkingConfig: { thinkingBudget: budget } } }

    case "openai-compatible":
      // Routing proxy veya local — options gönderme, thinking stream'de gelir
      return null
  }
}

export abstract class ProviderPlugin {
  abstract readonly id: string
  abstract readonly name: string
  abstract readonly sdkType: SDKType

  abstract getModel(modelId: string): LanguageModel
  abstract listModels(): ModelInfo[]
  abstract defaultModel(): string

  readonly supportsStreaming: boolean = true

  listModelsRemote?(): Promise<ModelInfo[]>

  tokenizerEncoding(_modelId: string): string {
    return "cl100k_base"
  }

  /**
   * Verilen model + effort budget için providerOptions döner.
   * null → options gönderme (thinking built-in veya desteklenmiyor).
   * Override: routing proxy'ler (OpenRouter) model prefix'ini parse eder.
   */
  buildThinkingOptions(modelId: string, budget: number): Record<string, unknown> | null {
    return thinkingOptionsForSDK(this.sdkType, budget, modelId)
  }
}
