import { createOpenAICompatiblePlugin } from "./openai-compatible-factory.js"
import type { ProviderPlugin } from "./plugin.js"
import { providerEnv } from "./credentials.js"

export function createZaiPlugin(): ProviderPlugin {
  return createOpenAICompatiblePlugin({
    id:           "zai",
    name:         "Z.AI (GLM)",
    baseURL:      "https://api.z.ai/api/openai/v1",
    getApiKey:    () => providerEnv("ZAI_API_KEY"),
    defaultModel: "glm-5.2",
    modelsEndpoint: "https://api.z.ai/api/openai/v1/models",
    models: [
      { id: "glm-5.2",       name: "GLM-5.2",        contextWindow: 128_000, maxOutput: 16_384, supportsTools: true, supportsVision: true,  supportsThinking: true  },
      { id: "glm-5.1",       name: "GLM-5.1",        contextWindow: 128_000, maxOutput: 16_384, supportsTools: true, supportsVision: true,  supportsThinking: true  },
      { id: "glm-4.7",       name: "GLM-4.7",        contextWindow: 128_000, maxOutput: 8_192,  supportsTools: true, supportsVision: false, supportsThinking: false },
      { id: "glm-4.7-flash", name: "GLM-4.7 Flash",  contextWindow: 128_000, maxOutput: 8_192,  supportsTools: true, supportsVision: false, supportsThinking: false },
      { id: "glm-4.5-flash", name: "GLM-4.5 Flash",  contextWindow: 128_000, maxOutput: 8_192,  supportsTools: true, supportsVision: false, supportsThinking: false },
    ],
  })
}
