import { join } from "node:path"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import type { FailureCooldownEntry } from "./failure-cooldown.js"
import type { KnownDeadEnd } from "./attention-anchor.js"

/**
 * Faz 5.1b — Workdir-keyed kalıcı "başarısız strateji" belleği.
 *
 * `failure-cooldown.ts` session-scoped'dur (`restoreFailureCooldown`/resume-state ile
 * SADECE aynı session devam ederken hayatta kalır) — yeni bir session açılınca geçmiş
 * çıkmaz sokaklar kaybolur. Bu modül `strategyShiftRequired` olmuş (3+ kez tekrarlanmış)
 * girdileri projenin KENDİ `.aurict/` dizinine yazar (skillScoreStore ile aynı desen),
 * böylece bir sonraki session (hatta farklı bir kullanıcı) aynı çıkmaz sokağa
 * tekrar girmeden önce uyarılır.
 */

const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 gün
const MAX_ENTRIES = 40

interface StoredFailedStrategy {
  fingerprint: string
  tool: string
  path?: string
  reason: string
  count: number
  lastSeenAt: number
}

class FailedStrategiesStore {
  private cache = new Map<string, StoredFailedStrategy[]>()

  private filePath(workdir: string): string {
    return join(workdir, ".aurict", "failed-strategies.json")
  }

  private load(workdir: string): StoredFailedStrategy[] {
    const hit = this.cache.get(workdir)
    if (hit) return hit
    try {
      const data = JSON.parse(readFileSync(this.filePath(workdir), "utf8")) as StoredFailedStrategy[]
      this.cache.set(workdir, data)
      return data
    } catch {
      return []
    }
  }

  private save(workdir: string, entries: StoredFailedStrategy[]): void {
    try {
      mkdirSync(join(workdir, ".aurict"), { recursive: true })
      writeFileSync(this.filePath(workdir), JSON.stringify(entries, null, 2))
      this.cache.set(workdir, entries)
    } catch {
      /* persistence opsiyonel — disk yazılamazsa sessizce devam et */
    }
  }

  /** `strategyShiftRequired` olmuş bir cooldown entry'sini kalıcı hale getirir. */
  record(workdir: string, entry: FailureCooldownEntry): void {
    if (!entry.strategyShiftRequired) return
    const now = Date.now()
    const entries = this.load(workdir).filter(e => now - e.lastSeenAt < TTL_MS)

    const stored: StoredFailedStrategy = {
      fingerprint: entry.fingerprint,
      tool: entry.tool,
      ...(entry.path ? { path: entry.path } : {}),
      reason: entry.reason,
      count: entry.count,
      lastSeenAt: now,
    }

    const idx = entries.findIndex(e => e.fingerprint === entry.fingerprint)
    if (idx >= 0) entries[idx] = stored
    else entries.push(stored)

    entries.sort((a, b) => b.lastSeenAt - a.lastSeenAt)
    this.save(workdir, entries.slice(0, MAX_ENTRIES))
  }

  /** Session başında enjekte edilecek son N (geçerli, TTL içindeki) kaydı döner. */
  recent(workdir: string, limit = 5): KnownDeadEnd[] {
    const now = Date.now()
    return this.load(workdir)
      .filter(e => now - e.lastSeenAt < TTL_MS)
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .slice(0, limit)
      .map(e => ({
        tool: e.tool,
        ...(e.path ? { path: e.path } : {}),
        reason: e.reason,
        count: e.count,
      }))
  }

  /** Test-only: cache'i ve dosyayı temizler. */
  clearForTests(workdir: string): void {
    this.cache.delete(workdir)
    try {
      writeFileSync(this.filePath(workdir), "[]")
    } catch {
      /* ignore */
    }
  }
}

export const failedStrategiesStore = new FailedStrategiesStore()
