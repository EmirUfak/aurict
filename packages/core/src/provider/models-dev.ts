/**
 * models.dev entegrasyonu — model capability'leri için harici kaynak.
 * Context window, max output, tool/vision desteği, reasoning ve fiyatlandırma.
 */

interface ModelsDevLimit {
  context?: number
  output?:  number
}

interface ModelsDevCost {
  input?:       number
  output?:      number
  cache_read?:  number
  cache_write?: number
}

interface ModelsDevModel {
  id:           string
  reasoning?:   boolean
  tool_call?:   boolean
  attachment?:  boolean
  limit?:       ModelsDevLimit
  cost?:        ModelsDevCost
  modalities?:  { input?: string[]; output?: string[] }
}

interface ModelsDevEntry {
  // API şeması: models bir DİZİ değil, model id ile keyed bir OBJE'dir.
  models?: Record<string, ModelsDevModel>
}

type ModelsDevResponse = Record<string, ModelsDevEntry>

export interface ModelCostMeta {
  input:       number
  output:      number
  cacheRead?:  number
  cacheWrite?: number
}

export interface ModelMeta {
  reasoning:      boolean
  contextWindow?: number
  maxOutput?:     number
  tools?:         boolean
  vision?:        boolean
  cost?:          ModelCostMeta
}

// 24 saatlik cache — TTL
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
let cachedAt = 0
let cache: Map<string, ModelMeta> = new Map()   // modelId → tam metadata

function toModelMeta(m: ModelsDevModel): ModelMeta {
  return {
    reasoning: m.reasoning ?? false,
    ...(m.limit?.context !== undefined ? { contextWindow: m.limit.context } : {}),
    ...(m.limit?.output  !== undefined ? { maxOutput:     m.limit.output  } : {}),
    ...(m.tool_call      !== undefined ? { tools:         m.tool_call     } : {}),
    ...(m.modalities?.input ? { vision: m.modalities.input.includes("image") } : {}),
    ...(m.cost ? {
      cost: {
        input:  m.cost.input  ?? 0,
        output: m.cost.output ?? 0,
        ...(m.cost.cache_read  !== undefined ? { cacheRead:  m.cost.cache_read  } : {}),
        ...(m.cost.cache_write !== undefined ? { cacheWrite: m.cost.cache_write } : {}),
      },
    } : {}),
  }
}

async function fetchModelsDevMap(): Promise<Map<string, ModelMeta>> {
  try {
    const res  = await fetch("https://models.dev/api.json", { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return new Map()
    const data = await res.json() as ModelsDevResponse
    const map  = new Map<string, ModelMeta>()
    for (const entry of Object.values(data)) {
      // entry.models bir obje (id → model) — dizi değil, Object.values ile gez.
      for (const m of Object.values(entry.models ?? {})) {
        if (!m.id || map.has(m.id)) continue   // aynı model birden fazla provider altında listelenebilir — ilkini koru
        map.set(m.id, toModelMeta(m))
      }
    }
    return map
  } catch {
    return new Map()
  }
}

// Soğuk cache'te birden fazla model için eşzamanlı fetchModelMeta çağrısı
// (ör. bir provider'ın tüm remote model listesini zenginleştirirken Promise.all)
// aynı anda N kopya HTTP isteği atmasın diye tek bir in-flight fetch paylaşılır.
let inflightFetch: Promise<Map<string, ModelMeta>> | null = null

async function getCache(): Promise<Map<string, ModelMeta>> {
  if (Date.now() - cachedAt < CACHE_TTL_MS && cache.size > 0) return cache
  if (!inflightFetch) {
    inflightFetch = fetchModelsDevMap().finally(() => { inflightFetch = null })
  }
  const fresh = await inflightFetch
  if (fresh.size > 0) { cache = fresh; cachedAt = Date.now() }
  return cache
}

function suffixOf(modelId: string): string {
  return modelId.includes("/") ? modelId.split("/").pop()! : modelId
}

/** Test-only: modül seviyesindeki cache'i sıfırlar (testler process'i paylaştığı için gerekli). */
export function resetModelsDevCacheForTests(): void {
  cache = new Map()
  cachedAt = 0
  inflightFetch = null
}

/**
 * Verilen model ID'nin reasoning/thinking destekleyip desteklemediğini döner.
 * Hata veya bilinmeyen model → false (güvenli varsayılan).
 */
export async function supportsReasoning(modelId: string): Promise<boolean> {
  const map = await getCache()
  return (map.get(modelId) ?? map.get(suffixOf(modelId)))?.reasoning ?? false
}

/**
 * Bir model listesi için reasoning flag'lerini toplu çek.
 * Remote model listelerinde kullanılır.
 */
export async function enrichWithReasoning<T extends { id: string; supportsThinking?: boolean }>(
  models: T[]
): Promise<T[]> {
  const map = await getCache()
  if (map.size === 0) return models   // fetch başarısız → dokunma
  return models.map((m) => {
    const meta = map.get(m.id) ?? map.get(suffixOf(m.id))
    if (meta === undefined) return m
    return { ...m, supportsThinking: meta.reasoning }
  })
}

/**
 * Verilen model ID için tam metadata döner (context window, max output,
 * tool/vision desteği, reasoning, fiyatlandırma). Bilinmeyen model veya
 * fetch hatası → null (çağıran taraf kendi fallback'ini uygular).
 */
export async function fetchModelMeta(modelId: string): Promise<ModelMeta | null> {
  const map = await getCache()
  return map.get(modelId) ?? map.get(suffixOf(modelId)) ?? null
}
