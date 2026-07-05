import { readdir, readFile, stat } from "node:fs/promises"
import { join } from "node:path"
import type { RunTraceEvent } from "./run-trace.js"

/**
 * Faz 6.3 — run-trace verisi (`tool_result_distilled` olayları) yazılıyor ama hiç
 * okunmuyordu. Bu modül geçmiş session'ların trace dosyalarını tarayıp "bu projede
 * hangi tool en çok hata veriyor" özetini çıkarır; sonuç attention-anchor'a
 * "known-fragile areas" olarak enjekte edilir (bkz. loop.ts, attention-anchor.ts).
 */

export interface FragileArea {
  tool: string
  errorCount: number
  totalCount: number
  errorRate: number
  sampleReason: string
}

const MAX_TRACE_FILES = 20      // perf cap — en fazla bu kadar (en yeni) session dosyasını tara
const MIN_OCCURRENCES = 3       // gürültü filtresi — en az bu kadar gözlem olmalı
const MIN_ERROR_RATE  = 0.3     // en az %30 hata oranı olmalı ki "fragile" sayılsın
const CACHE_TTL_MS = 5 * 60_000 // aynı workdir için 5 dakikada bir yeniden tara

interface CacheEntry {
  computedAt: number
  areas: FragileArea[]
}

const cache = new Map<string, CacheEntry>()

export async function summarizeFragileAreas(workdir: string, limit = 5): Promise<FragileArea[]> {
  const hit = cache.get(workdir)
  if (hit && Date.now() - hit.computedAt < CACHE_TTL_MS) return hit.areas.slice(0, limit)

  const areas = await computeFragileAreas(workdir)
  cache.set(workdir, { computedAt: Date.now(), areas })
  return areas.slice(0, limit)
}

async function computeFragileAreas(workdir: string): Promise<FragileArea[]> {
  const dir = join(workdir, ".aurict", "traces")
  let fileNames: string[]
  try {
    fileNames = (await readdir(dir)).filter(f => f.endsWith(".jsonl"))
  } catch {
    return []
  }
  if (fileNames.length === 0) return []

  const withMtime = await Promise.all(
    fileNames.map(async name => {
      try {
        const info = await stat(join(dir, name))
        return { name, mtimeMs: info.mtimeMs }
      } catch {
        return { name, mtimeMs: 0 }
      }
    }),
  )
  const recentFiles = withMtime
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, MAX_TRACE_FILES)
    .map(f => f.name)

  const stats = new Map<string, { errors: number; total: number; sampleReason: string }>()

  for (const name of recentFiles) {
    let raw: string
    try {
      raw = await readFile(join(dir, name), "utf8")
    } catch {
      continue
    }
    for (const line of raw.trim().split(/\r?\n/)) {
      if (!line) continue
      let event: RunTraceEvent
      try {
        event = JSON.parse(line) as RunTraceEvent
      } catch {
        continue
      }
      if (event.type !== "tool_result_distilled") continue
      const tool = String(event.data["tool"] ?? "")
      if (!tool) continue

      const entry = stats.get(tool) ?? { errors: 0, total: 0, sampleReason: "" }
      entry.total++
      if (event.data["status"] === "error") {
        entry.errors++
        const errors = event.data["errors"]
        if (!entry.sampleReason && Array.isArray(errors) && errors.length > 0) {
          entry.sampleReason = String(errors[0]).slice(0, 140)
        }
      }
      stats.set(tool, entry)
    }
  }

  return [...stats.entries()]
    .map(([tool, s]) => ({
      tool,
      errorCount: s.errors,
      totalCount: s.total,
      errorRate: s.total > 0 ? s.errors / s.total : 0,
      sampleReason: s.sampleReason,
    }))
    .filter(area => area.totalCount >= MIN_OCCURRENCES && area.errorRate >= MIN_ERROR_RATE)
    .sort((a, b) => b.errorRate - a.errorRate)
}

/** Test-only: cache'i temizler. */
export function clearFragileAreasCacheForTests(workdir?: string): void {
  if (workdir === undefined) cache.clear()
  else cache.delete(workdir)
}
