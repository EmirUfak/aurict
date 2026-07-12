/**
 * Faz 0.2/0.3 — resolveModelInfo'nun 3 katmanlı çözümünü doğrular:
 *   1. Provider'ın statik listModels() kaydı
 *   2. Uzak /models cache dosyası (findCachedModelInfo)
 *   3. models.dev metadata'sı, o da yoksa heuristik tahmin
 * Her katmanda "her zaman dolu ModelInfo döner" garantisini kanıtlar —
 * önceden bilinmeyen model için modelInfo undefined olup sessiz 200k/8k
 * varsayımına düşülüyordu.
 */
import { describe, it, expect, afterAll, afterEach, beforeAll } from "bun:test"
import { join, dirname } from "node:path"
import { tmpdir } from "node:os"
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { resolveModelInfo, findCachedModelInfo, setModelCacheDirectoryForTests } from "../src/provider/models-fetch.js"
import { resetModelsDevCacheForTests } from "../src/provider/models-dev.js"
import { createMockProvider } from "./helpers.js"

function cachePathFor(providerId: string): string {
  return join(cacheDir, `models-${providerId}.json`)
}

function mockFetchOnce(body: unknown, ok = true) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 })) as typeof fetch
  return () => { globalThis.fetch = originalFetch }
}

function mockFetchThrows() {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => { throw new Error("network down") }) as typeof fetch
  return () => { globalThis.fetch = originalFetch }
}

const writtenCacheFiles: string[] = []
let cacheDir = ''

beforeAll(() => {
  cacheDir = mkdtempSync(join(tmpdir(), 'aurict-model-cache-'))
  setModelCacheDirectoryForTests(cacheDir)
})

afterAll(() => {
  setModelCacheDirectoryForTests()
  rmSync(cacheDir, { recursive: true, force: true })
})

afterEach(() => {
  for (const f of writtenCacheFiles.splice(0)) {
    try { rmSync(f, { force: true }) } catch { /* ignore */ }
  }
  resetModelsDevCacheForTests()
})

describe("resolveModelInfo — 3 katmanlı çözüm", () => {
  it("katman 1: statik listModels()'te bulunursa onu döner, ağa/cache'e hiç bakmaz", async () => {
    const plugin = createMockProvider({
      id: "test-provider-static",
      models: [{
        id: "known-model", name: "Known Model", contextWindow: 128_000, maxOutput: 8_000,
        supportsTools: true, supportsVision: false, supportsThinking: false,
      }],
    })
    const restore = mockFetchThrows() // ağa hiç gitmemeli — gitse test patlar
    try {
      const info = await resolveModelInfo(plugin, "test-provider-static", "known-model")
      expect(info.contextWindow).toBe(128_000)
      expect(info.maxOutput).toBe(8_000)
    } finally {
      restore()
    }
  })

  it("katman 2: statik listede yoksa uzak /models cache dosyasından bulur", async () => {
    const providerId = `test-provider-cache-${Date.now()}`
    const path = cachePathFor(providerId)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify([
      { id: "cached-model", name: "Cached Model", contextWindow: 64_000, maxOutput: 4_000, supportsTools: false, supportsVision: true },
    ]))
    writtenCacheFiles.push(path)

    const plugin = createMockProvider({ id: providerId, models: [] }) // statik listede yok
    const restore = mockFetchThrows() // ağa hiç gitmemeli
    try {
      const info = await resolveModelInfo(plugin, providerId, "cached-model")
      expect(info.contextWindow).toBe(64_000)
      expect(info.supportsTools).toBe(false)
      expect(info.supportsVision).toBe(true)
    } finally {
      restore()
    }
  })

  it("katman 3a: ne statikte ne cache'te varsa models.dev'den gerçek metadata çeker", async () => {
    const providerId = `test-provider-remote-${Date.now()}`
    const plugin = createMockProvider({ id: providerId, models: [] })
    const restore = mockFetchOnce({
      someProvider: {
        models: {
          "some/remote-model": {
            id: "some/remote-model",
            reasoning: true,
            tool_call: true,
            modalities: { input: ["text", "image"], output: ["text"] },
            limit: { context: 500_000, output: 32_000 },
          },
        },
      },
    })
    try {
      const info = await resolveModelInfo(plugin, providerId, "some/remote-model")
      expect(info.contextWindow).toBe(500_000)
      expect(info.maxOutput).toBe(32_000)
      expect(info.supportsTools).toBe(true)
      expect(info.supportsVision).toBe(true)
      expect(info.supportsThinking).toBe(true)
    } finally {
      restore()
    }
  })

  it("katman 3b: models.dev'de de yoksa (ve fetch başarısız) heuristik tahmine düşer, ASLA undefined dönmez", async () => {
    const providerId = `test-provider-guess-${Date.now()}`
    const plugin = createMockProvider({ id: providerId, models: [] })
    const restore = mockFetchThrows()
    try {
      // "-128k" son eki guessContextWindow'un yakalaması gereken bir kalıp
      const info = await resolveModelInfo(plugin, providerId, "totally-unknown-model-128k")
      expect(info).toBeDefined()
      expect(info.contextWindow).toBe(128_000)
      expect(typeof info.maxOutput).toBe("number")
      expect(info.maxOutput).toBeGreaterThan(0)
    } finally {
      restore()
    }
  })

  it("findCachedModelInfo hâlâ eski davranışıyla senkron çalışıyor (geriye dönük uyumluluk)", () => {
    const info = findCachedModelInfo("no-such-provider-ever", "no-such-model")
    expect(info).toBeUndefined()
  })
})
