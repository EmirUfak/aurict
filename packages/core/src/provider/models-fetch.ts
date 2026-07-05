import { join } from "path"
import { homedir } from "os"
import { statSync, readFileSync } from "fs"
import type { ModelInfo, ProviderPlugin } from "./plugin.js"
import { fetchModelMeta } from "./models-dev.js"

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 dakika

interface OpenAIModelEntry {
  id:       string
  object:   string
  owned_by: string
}
interface OpenAIModelsResponse {
  object: string
  data:   OpenAIModelEntry[]
}

function cachePath(providerId: string): string {
  return join(homedir(), ".aurict", "cache", `models-${providerId}.json`)
}

function isFresh(path: string): boolean {
  try {
    const stat = statSync(path)
    return Date.now() - stat.mtimeMs < CACHE_TTL_MS
  } catch { return false }
}

async function readCachedModels(path: string): Promise<ModelInfo[] | null> {
  try {
    const raw = await Bun.file(path).text()
    return JSON.parse(raw) as ModelInfo[]
  } catch {
    return null
  }
}

// Model ID'den capability tahmini — remote list için (models.dev'de bulunamazsa fallback)
function guessCapabilities(id: string): Pick<ModelInfo, "supportsTools" | "supportsVision"> {
  const lower = id.toLowerCase()
  // Tool desteği olmayan modeller
  const noTools = lower.includes("deepseek-r1") || lower.includes("deepseek/r1")
               || lower.includes("llava") || lower.includes("vision-only")
               || lower.includes(":1b") || lower.includes("whisper")
               || lower.includes("dall-e") || lower.includes("tts")
               || lower.includes("embedding") || lower.includes("embed")
  // Vision destekleyen modeller
  const hasVision = lower.includes("vision") || lower.includes("llava")
                 || lower.includes("gpt-4o") || lower.includes("gemini")
                 || lower.includes("claude") || lower.includes("minicpm-v")
  return { supportsTools: !noTools, supportsVision: hasVision }
}

// Model ID'den context window tahmini — models.dev'de bulunamazsa fallback.
// Açık boyut son ekleri, ardından bilinen model aileleri.
function guessContextWindow(id: string): number {
  const lower = id.toLowerCase()
  if (/(^|[-:])1m\b/.test(lower))    return 1_000_000
  if (/(^|[-:])200k\b/.test(lower))  return 200_000
  if (/(^|[-:])128k\b/.test(lower))  return 128_000
  if (/(^|[-:])64k\b/.test(lower))   return 64_000
  if (/(^|[-:])32k\b/.test(lower))   return 32_000
  if (/(^|[-:])16k\b/.test(lower))   return 16_000
  if (/(^|[-:])8k\b/.test(lower))    return 8_000
  if (lower.includes("gemini"))                                   return 1_000_000
  if (lower.includes("claude") || /\bo1\b|\bo3\b|\bo4\b/.test(lower)) return 200_000
  if (lower.includes("gpt-4o") || lower.includes("gpt-4-turbo") || lower.includes("llama-3")) return 128_000
  if (lower.includes("deepseek") || lower.includes("mixtral") || lower.includes("mistral"))    return 32_000
  if (lower.includes("gpt-3.5"))                                  return 16_000
  return 128_000  // bilinmeyen model için orta, iyimser-olmayan varsayılan
}

// Model ID'den max output tahmini — models.dev'de bulunamazsa fallback.
function guessMaxOutput(id: string): number {
  const lower = id.toLowerCase()
  if (/\bo1\b|\bo3\b|\bo4\b/.test(lower)) return 100_000
  if (lower.includes("gemini"))           return 8_192
  return 8_000
}

async function fetchFromEndpoint(url: string, apiKey: string): Promise<ModelInfo[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${apiKey}`, "User-Agent": "Aurict/0.0.1" },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json() as OpenAIModelsResponse
    // models.dev'den gerçek context/output/tool/vision/reasoning metadata'sı çek;
    // bulunamazsa (bilinmeyen model, models.dev erişilemez) heuristik tahmine düş.
    // Önceden burada her modele sabit 200k/32k yazılıyordu — sessizce yanlış
    // compaction zamanlamasına yol açıyordu.
    return await Promise.all(json.data.map(async (m) => {
      const meta = await fetchModelMeta(m.id).catch(() => null)
      const guessed = guessCapabilities(m.id)
      return {
        id:             m.id,
        name:           m.id,
        contextWindow:  meta?.contextWindow ?? guessContextWindow(m.id),
        maxOutput:      meta?.maxOutput     ?? guessMaxOutput(m.id),
        supportsTools:  meta?.tools         ?? guessed.supportsTools,
        supportsVision: meta?.vision        ?? guessed.supportsVision,
        ...(meta?.reasoning !== undefined ? { supportsThinking: meta.reasoning } : {}),
      }
    }))
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Uzak listeden seçilmiş bir modelin bilgisini cache'ten senkron bul.
 * Statik listModels()'te olmayan modeller için loop.ts bunu kullanır —
 * aksi halde capability'ler bilinmez ve tool desteklemeyen modellere
 * tool gönderilip 400 Bad Request alınır.
 */
export function findCachedModelInfo(providerId: string, modelId: string): ModelInfo | undefined {
  try {
    const raw = readFileSync(cachePath(providerId), "utf8")
    const models = JSON.parse(raw) as ModelInfo[]
    return models.find((m) => m.id === modelId)
  } catch {
    return undefined
  }
}

/**
 * Bir model için ModelInfo'yu 3 katmanda çözer, her zaman dolu döner:
 *   1. Provider'ın statik listModels() kaydı (en hızlı, en güvenilir)
 *   2. Uzak /models cache'i (findCachedModelInfo — daha önce fetch edilmiş model)
 *   3. models.dev metadata'sı, o da yoksa heuristik tahmin (guessContextWindow vb.)
 * Kullanıcı statik listede olmayan bir model girdiğinde (BYOK) sessiz 200k/8k
 * varsayımı yerine gerçek veya en azından bilgiye dayalı bir tahmin döner.
 */
export async function resolveModelInfo(
  plugin:     ProviderPlugin,
  providerId: string,
  modelId:    string,
): Promise<ModelInfo> {
  const staticInfo = plugin.listModels().find((m) => m.id === modelId)
  if (staticInfo) return staticInfo

  const cachedInfo = findCachedModelInfo(providerId, modelId)
  if (cachedInfo) return cachedInfo

  const meta = await fetchModelMeta(modelId).catch(() => null)
  const guessed = guessCapabilities(modelId)
  return {
    id:             modelId,
    name:           modelId,
    contextWindow:  meta?.contextWindow ?? guessContextWindow(modelId),
    maxOutput:      meta?.maxOutput     ?? guessMaxOutput(modelId),
    supportsTools:  meta?.tools         ?? guessed.supportsTools,
    supportsVision: meta?.vision        ?? guessed.supportsVision,
    ...(meta?.reasoning !== undefined ? { supportsThinking: meta.reasoning } : {}),
  }
}

export async function getCachedModels(providerId: string, url: string, apiKey: string): Promise<ModelInfo[]> {
  const path = cachePath(providerId)
  const cachedModels = await readCachedModels(path)

  if (cachedModels && isFresh(path)) return cachedModels
  if (!apiKey && cachedModels) return cachedModels

  // Fetch + retry
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const models = await fetchFromEndpoint(url, apiKey)
      // Cache'e yaz (dizin yoksa atla)
      try {
        await Bun.write(path, JSON.stringify(models))
      } catch { /* yazılamazsa önemli değil */ }
      return models
    } catch (err) {
      lastError = err
      if (attempt === 0) await new Promise((r) => setTimeout(r, 500)) // 0.5s backoff
    }
  }
  if (cachedModels) return cachedModels
  throw lastError
}
