import { dirname, join } from "path"
import { existsSync, mkdirSync, statSync, readFileSync } from "fs"
import type { ModelInfo, ProviderPlugin } from "./plugin.js"
import { fetchModelMeta } from "./models-dev.js"
import { coreStatePath } from "../storage/paths.js"

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 dakika
let modelCacheDirectoryOverride: string | undefined

interface OpenAIModelEntry {
  id:       string
  object:   string
  owned_by: string
}
interface OpenAIModelsResponse {
  object: string
  data:   OpenAIModelEntry[]
}

export interface RemoteModelDescriptor {
  id: string
  name?: string
  contextWindow?: number
  maxOutput?: number
  supportsTools?: boolean
  supportsVision?: boolean
  supportsThinking?: boolean
}

export interface RemoteModelListOptions {
  authentication?: "bearer" | "none"
  headers?: Record<string, string>
  parseModels?: (payload: unknown) => RemoteModelDescriptor[]
}

function cachePath(providerId: string): string {
  const safeProviderId = providerId.replace(/[^a-zA-Z0-9_.-]/g, '_')
  const directory = modelCacheDirectoryOverride ?? coreStatePath('cache')
  return join(directory, `models-${safeProviderId}.json`)
}

/** Test-only cache isolation. Production cache always resolves from core state. */
export function setModelCacheDirectoryForTests(directory?: string): void {
  modelCacheDirectoryOverride = directory
}

function isFresh(path: string): boolean {
  try {
    const stat = statSync(path)
    return Date.now() - stat.mtimeMs < CACHE_TTL_MS
  } catch { return false }
}

async function readCachedModels(path: string): Promise<ModelInfo[] | null> {
  if (!existsSync(path)) return null
  try {
    const raw = await Bun.file(path).text()
    return JSON.parse(raw) as ModelInfo[]
  } catch (error) {
    console.warn(`[aurict] ignoring unreadable model cache at ${path}`, error)
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

function parseOpenAIModels(payload: unknown): RemoteModelDescriptor[] {
  const data = (payload as Partial<OpenAIModelsResponse>).data
  if (!Array.isArray(data)) throw new Error("Model endpoint returned an invalid response.")
  return data
    .filter((model): model is OpenAIModelEntry => typeof model?.id === "string" && model.id.length > 0)
    .map((model) => ({ id: model.id }))
}

async function fetchFromEndpoint(url: string, apiKey: string, options: RemoteModelListOptions): Promise<ModelInfo[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const headers = { ...options.headers }
    if ((options.authentication ?? "bearer") === "bearer") headers.Authorization = `Bearer ${apiKey}`
    const res = await fetch(url, {
      headers: { ...headers, "User-Agent": "Aurict/0.0.1" },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const descriptors = (options.parseModels ?? parseOpenAIModels)(await res.json())
    if (descriptors.length === 0) throw new Error("Model endpoint returned no models.")
    // models.dev'den gerçek context/output/tool/vision/reasoning metadata'sı çek;
    // bulunamazsa (bilinmeyen model, models.dev erişilemez) heuristik tahmine düş.
    // Önceden burada her modele sabit 200k/32k yazılıyordu — sessizce yanlış
    // compaction zamanlamasına yol açıyordu.
    return await Promise.all(descriptors.map(async (model) => {
      const meta = await fetchModelMeta(model.id).catch(() => null)
      const guessed = guessCapabilities(model.id)
      return {
        id:             model.id,
        name:           model.name ?? model.id,
        contextWindow:  meta?.contextWindow ?? model.contextWindow ?? guessContextWindow(model.id),
        maxOutput:      meta?.maxOutput     ?? model.maxOutput ?? guessMaxOutput(model.id),
        supportsTools:  meta?.tools         ?? model.supportsTools ?? guessed.supportsTools,
        supportsVision: meta?.vision        ?? model.supportsVision ?? guessed.supportsVision,
        ...(meta?.reasoning !== undefined
          ? { supportsThinking: meta.reasoning }
          : model.supportsThinking !== undefined ? { supportsThinking: model.supportsThinking } : {}),
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
  const path = cachePath(providerId)
  if (!existsSync(path)) return undefined
  try {
    const raw = readFileSync(path, "utf8")
    const models = JSON.parse(raw) as ModelInfo[]
    return models.find((m) => m.id === modelId)
  } catch (error) {
    console.warn(`[aurict] ignoring unreadable model cache at ${path}`, error)
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

export async function getCachedModels(
  providerId: string,
  url: string,
  apiKey: string,
  options: RemoteModelListOptions = {},
): Promise<ModelInfo[]> {
  const path = cachePath(providerId)
  const cachedModels = await readCachedModels(path)

  if (cachedModels && isFresh(path)) return cachedModels
  if (!apiKey && cachedModels) return cachedModels

  // Fetch + retry
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const models = await fetchFromEndpoint(url, apiKey, options)
      // Model discovery can still succeed if its optional cache cannot be
      // written, but the storage failure must remain visible.
      try {
        mkdirSync(dirname(path), { recursive: true })
        await Bun.write(path, JSON.stringify(models))
      } catch (error) {
        console.warn(`[aurict] failed to write model cache at ${path}`, error)
      }
      return models
    } catch (err) {
      lastError = err
      if (attempt === 0) await new Promise((r) => setTimeout(r, 500)) // 0.5s backoff
    }
  }
  if (cachedModels) {
    console.warn(`[aurict] live model refresh failed for ${providerId}; using cached models`, lastError)
    return cachedModels
  }
  throw lastError
}

export function mergeModelLists(base: ModelInfo[], remote: ModelInfo[]): ModelInfo[] {
  const merged = new Map<string, ModelInfo>()
  const order: string[] = []

  const put = (model: ModelInfo) => {
    const existing = merged.get(model.id)
    if (!existing) {
      order.push(model.id)
      merged.set(model.id, model)
      return
    }
    const next: ModelInfo = { ...existing, ...model, name: existing.name }
    const supportsThinking = existing.supportsThinking ?? model.supportsThinking
    if (supportsThinking !== undefined) next.supportsThinking = supportsThinking
    merged.set(model.id, next)
  }

  base.forEach(put)
  remote.forEach(put)
  return order.map((id) => merged.get(id)!)
}

export async function listAvailableModels(plugin: ProviderPlugin): Promise<ModelInfo[]> {
  const base = plugin.listModels()
  if (!plugin.listModelsRemote) return base
  return mergeModelLists(base, await plugin.listModelsRemote())
}
