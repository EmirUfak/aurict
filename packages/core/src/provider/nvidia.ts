import { createOpenAICompatiblePlugin } from "./openai-compatible-factory.js"
import type { ProviderPlugin } from "./plugin.js"
import { providerEnv } from "./credentials.js"

export function createNvidiaPlugin(): ProviderPlugin {
  return createOpenAICompatiblePlugin({
    id:           "nvidia",
    name:         "NVIDIA NIM",
    baseURL:      "https://integrate.api.nvidia.com/v1",
    getApiKey:    () => providerEnv("NVIDIA_API_KEY"),
    defaultModel: "meta/llama-3.3-70b-instruct",
    modelsEndpoint: "https://integrate.api.nvidia.com/v1/models",
    models: [
      { id: "meta/llama-3.3-70b-instruct",              name: "Llama 3.3 70B",       contextWindow: 131_072, maxOutput: 8_192, supportsTools: true,  supportsVision: false, supportsThinking: false },
      { id: "deepseek-ai/deepseek-r1",                  name: "DeepSeek R1",         contextWindow: 128_000, maxOutput: 8_192, supportsTools: false, supportsVision: false, supportsThinking: true  },
      { id: "qwen/qwen2.5-72b-instruct",                name: "Qwen2.5 72B",         contextWindow: 131_072, maxOutput: 8_192, supportsTools: true,  supportsVision: false, supportsThinking: false },
      { id: "mistralai/mixtral-8x22b-instruct-v0.1",    name: "Mixtral 8x22B",       contextWindow: 65_536,  maxOutput: 8_192, supportsTools: true,  supportsVision: false, supportsThinking: false },
    ],
  })
}
