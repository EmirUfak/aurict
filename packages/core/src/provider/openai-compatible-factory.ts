import { createOpenAI } from "@ai-sdk/openai"
import type { LanguageModel } from "ai"
import { ProviderPlugin, type ModelInfo } from "./plugin.js"
import { getCachedModels } from "./models-fetch.js"

export interface OpenAICompatiblePluginOptions {
  id:            string
  name:          string
  baseURL:       string
  /**
   * Resolves the API key on every call (not just once at plugin construction) —
   * mirrors how xai.ts/openrouter.ts read `process.env` inside a getter, so a
   * key set later via `/providers` (after the plugin was already registered)
   * is picked up without needing to re-register the plugin.
   */
  getApiKey:     () => string | undefined
  defaultModel:  string
  models:        ModelInfo[]
  modelsEndpoint?: string
  headers?:      Record<string, string>
}

/**
 * Builds a ProviderPlugin for any OpenAI-compatible chat completions endpoint
 * (NVIDIA NIM, z.ai, Alibaba/DashScope, user-defined custom providers, ...).
 * Reuses the same `getCachedModels` fetch+cache path the existing openrouter/
 * opencode plugins already use, so a remote model catalog is picked up for
 * free when `modelsEndpoint` is supplied.
 */
export function createOpenAICompatiblePlugin(opts: OpenAICompatiblePluginOptions): ProviderPlugin {
  return new (class extends ProviderPlugin {
    readonly id      = opts.id
    readonly name    = opts.name
    readonly sdkType = "openai-compatible" as const

    private get client() {
      const key = opts.getApiKey()
      return createOpenAI({
        ...(key !== undefined ? { apiKey: key } : {}),
        baseURL: opts.baseURL,
        ...(opts.headers ? { headers: opts.headers } : {}),
      })
    }

    getModel(modelId: string): LanguageModel {
      return this.client(modelId) as LanguageModel
    }

    defaultModel(): string {
      return opts.defaultModel
    }

    listModels(): ModelInfo[] {
      return opts.models
    }

    override listModelsRemote(): Promise<ModelInfo[]> {
      if (!opts.modelsEndpoint) return Promise.resolve(opts.models)
      return getCachedModels(opts.id, opts.modelsEndpoint, opts.getApiKey() ?? "")
    }

    // Reasoning/thinking format for OpenAI-compatible endpoints isn't
    // standardized — same choice existing openai-compatible plugins make.
    override buildThinkingOptions(_modelId: string, _budget: number): Record<string, unknown> | null {
      return null
    }
  })()
}
