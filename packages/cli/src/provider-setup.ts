import {
  ProviderRegistry,
  createOpenAICompatiblePlugin,
  loadApiKeyFromKeystore,
  loadConfig,
} from "@aurict/core"

const PROVIDER_ENV_MAP: Record<string, string[]> = {
  anthropic: ["ANTHROPIC_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
  google: ["GOOGLE_GENERATIVE_AI_API_KEY"],
  opencode: ["OPENCODE_API_KEY"],
  xai: ["XAI_API_KEY"],
  azure: ["AZURE_OPENAI_API_KEY"],
  bedrock: ["AWS_ACCESS_KEY_ID"],
  ollama: [],
  nvidia: ["NVIDIA_API_KEY"],
  zai: ["ZAI_API_KEY"],
  alibaba: ["DASHSCOPE_API_KEY"],
}

/** Load persisted credentials and custom providers shared by CLI and desktop. */
export async function initializeConfiguredProviders(workdir: string): Promise<void> {
  const config = loadConfig(workdir)

  for (const [provider, value] of Object.entries(config.providers ?? {})) {
    if (!value.apiKey) continue
    const envVars = PROVIDER_ENV_MAP[provider] ?? [`${provider.toUpperCase()}_API_KEY`]
    for (const envVar of envVars) {
      if (!process.env[envVar]) process.env[envVar] = value.apiKey
    }
    if (provider === "azure" && value.baseUrl && !process.env["AZURE_OPENAI_ENDPOINT"]) {
      process.env["AZURE_OPENAI_ENDPOINT"] = value.baseUrl
    }
  }

  for (const [provider, envVars] of Object.entries(PROVIDER_ENV_MAP)) {
    if (envVars.length === 0 || envVars.some((envVar) => Boolean(process.env[envVar]))) continue
    const keystoreKey = await loadApiKeyFromKeystore(provider)
    if (!keystoreKey) continue
    for (const envVar of envVars) {
      if (!process.env[envVar]) process.env[envVar] = keystoreKey
    }
  }

  for (const [id, definition] of Object.entries(config.customProviders ?? {})) {
    ProviderRegistry.register(createOpenAICompatiblePlugin({
      id,
      name: definition.name,
      baseURL: definition.baseUrl,
      getApiKey: () => definition.apiKey,
      defaultModel: definition.defaultModel,
      models: [{
        id: definition.defaultModel,
        name: definition.defaultModel,
        contextWindow: 128_000,
        maxOutput: 8_000,
        supportsTools: true,
        supportsVision: false,
      }],
      modelsEndpoint: `${definition.baseUrl.replace(/\/+$/, "")}/models`,
    }))
  }
}
