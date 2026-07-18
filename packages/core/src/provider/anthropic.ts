import { createAnthropic } from "@ai-sdk/anthropic"
import type { LanguageModel } from "ai"
import { ProviderPlugin, type ModelInfo } from "./plugin.js"
import { getCachedModels, type RemoteModelDescriptor } from "./models-fetch.js"
import { providerEnv } from "./credentials.js"

function parseAnthropicModels(payload: unknown): RemoteModelDescriptor[] {
  const data = (payload as { data?: unknown }).data
  if (!Array.isArray(data)) throw new Error("Anthropic model endpoint returned an invalid response.")
  return data
    .filter((model): model is { id: string; display_name?: string } => (
      typeof model === "object" && model !== null && typeof (model as { id?: unknown }).id === "string"
    ))
    .map((model) => ({ id: model.id, ...(model.display_name ? { name: model.display_name } : {}) }))
}

export class AnthropicPlugin extends ProviderPlugin {
  readonly id      = "anthropic"
  readonly name    = "Anthropic"
  readonly sdkType = "anthropic" as const

  private get client() {
    const key = providerEnv("ANTHROPIC_API_KEY")
    return createAnthropic({ ...(key !== undefined ? { apiKey: key } : {}) })
  }

  getModel(modelId: string): LanguageModel {
    return this.client(modelId) as LanguageModel
  }

  defaultModel(): string {
    return "claude-sonnet-4-6"
  }

  listModels(): ModelInfo[] {
    return [
      { id: "claude-opus-4-8",          name: "Claude Opus 4.8",    contextWindow: 200_000, maxOutput: 32_000,  supportsTools: true, supportsVision: true, supportsThinking: true },
      { id: "claude-sonnet-4-6",        name: "Claude Sonnet 4.6",  contextWindow: 200_000, maxOutput: 64_000,  supportsTools: true, supportsVision: true, supportsThinking: true },
      { id: "claude-haiku-4-5-20251001",name: "Claude Haiku 4.5",  contextWindow: 200_000, maxOutput: 16_000, supportsTools: true, supportsVision: true, supportsThinking: false },
    ]
  }

  override async listModelsRemote(): Promise<ModelInfo[]> {
    const apiKey = providerEnv("ANTHROPIC_API_KEY") ?? ""
    return getCachedModels("anthropic", "https://api.anthropic.com/v1/models?limit=1000", apiKey, {
      authentication: "none",
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      parseModels: parseAnthropicModels,
    })
  }

  // sdkType = "anthropic" → plugin.ts default yeterli, override gerekmez
}
