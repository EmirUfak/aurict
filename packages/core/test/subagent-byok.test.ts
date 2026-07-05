/**
 * Faz 0.3b — subagentTool artık ctx.model verilmediğinde hedef provider'ın
 * KENDİ varsayılan modelini kullanıyor, Anthropic'e özgü hardcoded bir model
 * id'si (eskiden "claude-sonnet-4-6") değil. Bu, ollama/openrouter gibi
 * Anthropic dışı bir provider'a subagent spawn edilirken geçersiz bir model
 * id'sinin gönderilip 400/404 alınmasını önler.
 */
import { describe, it, expect, mock } from "bun:test"
import { ProviderRegistry } from "../src/provider/registry.js"
import { createMockProvider, createMockContext } from "./helpers.js"

let capturedModel: string | undefined

mock.module("../src/agent/pool.js", () => ({
  agentPool: {
    spawn: async (opts: { model: string }) => {
      capturedModel = opts.model
      return "mock subagent result"
    },
  },
  PoolFullError: class PoolFullError extends Error {},
}))

const { subagentTool } = await import("../src/tool/built-in/subagent.js")

describe("subagentTool — BYOK model fallback (Faz 0.3b)", () => {
  it("ctx.model verilmediğinde hedef provider'ın kendi defaultModel()'ini kullanır", async () => {
    ProviderRegistry.register(createMockProvider({
      id: "test-subagent-provider",
      defaultModel: "provider-specific-default-model",
    }))
    capturedModel = undefined

    const ctx = createMockContext({ provider: "test-subagent-provider" })
    // ctx.model kasıtlı olarak set edilmiyor — createMockContext varsayılanı
    // "claude-sonnet-4-6" veriyor olabilir, o yüzden açıkça undefined yapıyoruz.
    ;(ctx as { model?: string }).model = undefined

    const result = await subagentTool.execute({ type: "explore", role: "Test Worker", prompt: "hello" }, ctx)

    expect(result.error).toBeUndefined()
    expect(capturedModel).toBe("provider-specific-default-model")
  })

  it("ctx.model verilmişse onu kullanır (provider defaultModel'i override eder)", async () => {
    ProviderRegistry.register(createMockProvider({
      id: "test-subagent-provider-2",
      defaultModel: "provider-default",
    }))
    capturedModel = undefined

    const ctx = createMockContext({ provider: "test-subagent-provider-2", model: "explicit-model" })
    const result = await subagentTool.execute({ type: "explore", role: "Test Worker", prompt: "hello" }, ctx)

    expect(result.error).toBeUndefined()
    expect(capturedModel).toBe("explicit-model")
  })
})
