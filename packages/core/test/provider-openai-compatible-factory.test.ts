/**
 * createOpenAICompatiblePlugin() — the shared factory backing the new
 * nvidia/zai/alibaba built-in providers as well as user-added custom
 * providers. Verifies the produced plugin behaves like a real ProviderPlugin
 * and that listModelsRemote reuses the existing getCachedModels cache path.
 */
import { describe, it, expect, afterEach } from "bun:test"
import { join } from "node:path"
import { homedir } from "node:os"
import { rmSync } from "node:fs"
import { createOpenAICompatiblePlugin } from "../src/provider/openai-compatible-factory.js"

function cachePathFor(providerId: string): string {
  return join(homedir(), ".aurict", "cache", `models-${providerId}.json`)
}

const writtenCacheFiles: string[] = []

afterEach(() => {
  for (const f of writtenCacheFiles.splice(0)) {
    try { rmSync(f, { force: true }) } catch { /* ignore */ }
  }
})

const sampleModels = [
  { id: "model-a", name: "Model A", contextWindow: 128_000, maxOutput: 8_192, supportsTools: true, supportsVision: false },
]

describe("createOpenAICompatiblePlugin — basic shape", () => {
  it("sets id/name/sdkType from options", () => {
    const plugin = createOpenAICompatiblePlugin({
      id: "test-basic", name: "Test Basic", baseURL: "https://example.com/v1",
      getApiKey: () => "key", defaultModel: "model-a", models: sampleModels,
    })
    expect(plugin.id).toBe("test-basic")
    expect(plugin.name).toBe("Test Basic")
    expect(plugin.sdkType).toBe("openai-compatible")
  })

  it("defaultModel() returns the configured default", () => {
    const plugin = createOpenAICompatiblePlugin({
      id: "test-default", name: "Test", baseURL: "https://example.com/v1",
      getApiKey: () => "key", defaultModel: "model-a", models: sampleModels,
    })
    expect(plugin.defaultModel()).toBe("model-a")
  })

  it("listModels() returns the configured static list", () => {
    const plugin = createOpenAICompatiblePlugin({
      id: "test-list", name: "Test", baseURL: "https://example.com/v1",
      getApiKey: () => "key", defaultModel: "model-a", models: sampleModels,
    })
    expect(plugin.listModels()).toEqual(sampleModels)
  })

  it("getModel() returns a usable LanguageModel without making a network call", () => {
    const plugin = createOpenAICompatiblePlugin({
      id: "test-getmodel", name: "Test", baseURL: "https://example.com/v1",
      getApiKey: () => "key", defaultModel: "model-a", models: sampleModels,
    })
    const model = plugin.getModel("model-a")
    expect(model).toBeTruthy()
  })

  it("buildThinkingOptions() returns null (reasoning format isn't standardized)", () => {
    const plugin = createOpenAICompatiblePlugin({
      id: "test-thinking", name: "Test", baseURL: "https://example.com/v1",
      getApiKey: () => "key", defaultModel: "model-a", models: sampleModels,
    })
    expect(plugin.buildThinkingOptions("model-a", 4000)).toBeNull()
  })
})

describe("createOpenAICompatiblePlugin — listModelsRemote", () => {
  it("without modelsEndpoint, resolves to the static models list", async () => {
    const plugin = createOpenAICompatiblePlugin({
      id: "test-no-endpoint", name: "Test", baseURL: "https://example.com/v1",
      getApiKey: () => "key", defaultModel: "model-a", models: sampleModels,
    })
    const remote = await plugin.listModelsRemote!()
    expect(remote).toEqual(sampleModels)
  })

  it("with modelsEndpoint, fetches via the shared getCachedModels path and reflects getApiKey() at call time", async () => {
    const providerId = `test-remote-${Date.now()}`
    let seenAuth: string | null = null
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = typeof url === "string" ? url : url.toString()
      // fetchFromEndpoint also calls models.dev's fetchModelMeta() per model —
      // only capture headers for our own /models request, not that side call.
      if (!href.includes("example.com")) {
        return new Response(JSON.stringify({}), { status: 404 })
      }
      seenAuth = (init?.headers as Record<string, string> | undefined)?.["Authorization"] ?? null
      return new Response(JSON.stringify({ object: "list", data: [{ id: "remote-model", object: "model", owned_by: "test" }] }), { status: 200 })
    }) as typeof fetch
    writtenCacheFiles.push(cachePathFor(providerId))

    let key = "key-at-call-time"
    const plugin = createOpenAICompatiblePlugin({
      id: providerId, name: "Test", baseURL: "https://example.com/v1",
      getApiKey: () => key, defaultModel: "model-a", models: sampleModels,
      modelsEndpoint: "https://example.com/v1/models",
    })
    try {
      const remote = await plugin.listModelsRemote!()
      expect(remote.map((m) => m.id)).toContain("remote-model")
      expect(seenAuth).toBe("Bearer key-at-call-time")
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
