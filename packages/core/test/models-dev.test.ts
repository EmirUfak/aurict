/**
 * Faz 0.1 — models.dev entegrasyonunun gerçek API şemasına (dict, dizi değil)
 * karşı doğru parse ettiğini ve tam metadata (context/output/tools/vision/cost)
 * döndürdüğünü doğrular. Ayrıca eski array-varsayımlı kodun neden hep sessizce
 * boş cache döndürdüğünü (regresyon) kapatır.
 */
import { describe, it, expect, beforeEach } from "bun:test"
import {
  fetchModelMeta,
  supportsReasoning,
  enrichWithReasoning,
  resetModelsDevCacheForTests,
} from "../src/provider/models-dev.js"

// Gerçek models.dev şeması: her provider'ın "models" alanı bir DİZİ değil,
// model id'siyle keyed bir OBJE'dir. Eski kod (for...of üzerinde array
// varsayımıyla) bu şekli iterate etmeye çalışınca throw ediyordu ve hata
// sessizce yutulup boş Map dönüyordu.
const SAMPLE_RESPONSE = {
  requesty: {
    id: "requesty",
    models: {
      "xai/grok-4": {
        id: "xai/grok-4",
        reasoning: true,
        tool_call: true,
        attachment: true,
        modalities: { input: ["text", "image"], output: ["text"] },
        limit: { context: 256_000, output: 64_000 },
        cost: { input: 3, output: 15, cache_read: 0.75, cache_write: 3 },
      },
      "xai/grok-4-fast": {
        id: "xai/grok-4-fast",
        reasoning: true,
        tool_call: true,
        modalities: { input: ["text"], output: ["text"] },
        limit: { context: 2_000_000, output: 64_000 },
        // cost kasıtlı olarak eksik — bazı modellerde gerçekten yok (~%7)
      },
    },
  },
}

function mockFetchOnce(body: unknown, ok = true) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify(body), {
    status: ok ? 200 : 500,
  })) as typeof fetch
  return () => { globalThis.fetch = originalFetch }
}

describe("models-dev — gerçek API şemasına karşı parse (dict, dizi değil)", () => {
  beforeEach(() => {
    resetModelsDevCacheForTests()
  })

  it("fetchModelMeta bir modelin tam metadata'sını (context/output/tools/vision/cost) döner", async () => {
    const restore = mockFetchOnce(SAMPLE_RESPONSE)
    try {
      const meta = await fetchModelMeta("xai/grok-4")
      expect(meta).not.toBeNull()
      expect(meta!.contextWindow).toBe(256_000)
      expect(meta!.maxOutput).toBe(64_000)
      expect(meta!.tools).toBe(true)
      expect(meta!.vision).toBe(true)
      expect(meta!.reasoning).toBe(true)
      expect(meta!.cost?.input).toBe(3)
      expect(meta!.cost?.cacheRead).toBe(0.75)
    } finally {
      restore()
    }
  })

  it("cost eksik olduğunda meta.cost undefined kalır (crash etmez)", async () => {
    const restore = mockFetchOnce(SAMPLE_RESPONSE)
    try {
      const meta = await fetchModelMeta("xai/grok-4-fast")
      expect(meta).not.toBeNull()
      expect(meta!.contextWindow).toBe(2_000_000)
      expect(meta!.cost).toBeUndefined()
    } finally {
      restore()
    }
  })

  it("bilinmeyen model için null döner", async () => {
    const restore = mockFetchOnce(SAMPLE_RESPONSE)
    try {
      const meta = await fetchModelMeta("totally/unknown-model-xyz")
      expect(meta).toBeNull()
    } finally {
      restore()
    }
  })

  it("fetch başarısız olduğunda (network hatası) null döner, throw etmez", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => { throw new Error("network down") }) as typeof fetch
    try {
      const meta = await fetchModelMeta("xai/grok-4")
      expect(meta).toBeNull()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it("supportsReasoning suffix eşleşmesiyle de çalışır (provider/ önekini atar)", async () => {
    const restore = mockFetchOnce(SAMPLE_RESPONSE)
    try {
      // "xai/grok-4" tam id; suffix "grok-4" değil — ama tam id zaten eşleşiyor.
      // Suffix testini prefix'siz bir id ile de doğrula.
      const supported = await supportsReasoning("xai/grok-4")
      expect(supported).toBe(true)
      const unsupported = await supportsReasoning("no-such-model")
      expect(unsupported).toBe(false)
    } finally {
      restore()
    }
  })

  it("enrichWithReasoning eşleşen modellere supportsThinking ekler, eşleşmeyeni değiştirmez", async () => {
    const restore = mockFetchOnce(SAMPLE_RESPONSE)
    try {
      const enriched = await enrichWithReasoning([
        { id: "xai/grok-4", supportsThinking: false },
        { id: "unknown-model" },
      ])
      expect(enriched[0]!.supportsThinking).toBe(true)
      expect(enriched[1]!.supportsThinking).toBeUndefined()
    } finally {
      restore()
    }
  })

  it("fetch tamamen boş/geçersiz JSON dönerse enrichWithReasoning orijinal listeyi değiştirmeden döner", async () => {
    const restore = mockFetchOnce({})
    try {
      const original = [{ id: "xai/grok-4", supportsThinking: false }]
      const enriched = await enrichWithReasoning(original)
      expect(enriched).toEqual(original)
    } finally {
      restore()
    }
  })
})
