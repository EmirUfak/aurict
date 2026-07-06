import { createOpenAICompatiblePlugin } from "./openai-compatible-factory.js"
import type { ProviderPlugin } from "./plugin.js"

export function createAlibabaPlugin(): ProviderPlugin {
  return createOpenAICompatiblePlugin({
    id:           "alibaba",
    name:         "Alibaba (Qwen)",
    baseURL:      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    getApiKey:    () => process.env["DASHSCOPE_API_KEY"],
    defaultModel: "qwen-plus",
    modelsEndpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models",
    models: [
      { id: "qwen-max",         name: "Qwen Max",         contextWindow: 32_768,  maxOutput: 8_192, supportsTools: true, supportsVision: false, supportsThinking: false },
      { id: "qwen-plus",        name: "Qwen Plus",        contextWindow: 131_072, maxOutput: 8_192, supportsTools: true, supportsVision: false, supportsThinking: false },
      { id: "qwen-turbo",       name: "Qwen Turbo",       contextWindow: 131_072, maxOutput: 8_192, supportsTools: true, supportsVision: false, supportsThinking: false },
      { id: "qwen3-235b-a22b",  name: "Qwen3 235B A22B",  contextWindow: 131_072, maxOutput: 16_384, supportsTools: true, supportsVision: false, supportsThinking: true  },
      { id: "qwen-vl-max",      name: "Qwen VL Max",      contextWindow: 32_768,  maxOutput: 8_192, supportsTools: true, supportsVision: true,  supportsThinking: false },
    ],
  })
}
