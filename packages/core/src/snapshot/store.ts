import * as fs from "node:fs/promises"
import * as path from "node:path"
import { rmSync } from "node:fs"
import type { Snapshot } from "./types.js"

export const MAX_HISTORY_ENTRIES = 100

export function getHistoryFile(storageDir: string | null): string | null {
  return storageDir ? path.join(storageDir, "history.json") : null
}

/**
 * Geçmişi diske yazar. Depo dizinine yazılamıyorsa (salt-okunur/izin hatası)
 * `disableStorage: true` döner — üst katman bunu görüp `storageDir`'i
 * `null`'a düşürerek kalıcılığı kapatır (bellek-içi çalışmaya devam eder).
 */
export async function persistHistory(
  storageDir: string | null,
  history: Snapshot[],
): Promise<{ history: Snapshot[]; disableStorage: boolean }> {
  const historyFile = getHistoryFile(storageDir)
  if (!historyFile) return { history, disableStorage: false }

  let trimmed = history
  try {
    if (trimmed.length > MAX_HISTORY_ENTRIES) {
      trimmed = trimmed.slice(-MAX_HISTORY_ENTRIES)
    }
    await fs.mkdir(path.dirname(historyFile), { recursive: true })
    await fs.writeFile(historyFile, JSON.stringify(trimmed, null, 2), "utf-8")
    return { history: trimmed, disableStorage: false }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      console.error("Snapshot history persistence disabled:", err)
      return { history: trimmed, disableStorage: true }
    }
    console.error("Snapshot history persistence failed:", err)
    return { history: trimmed, disableStorage: false }
  }
}

export async function loadPersistedHistory(storageDir: string | null): Promise<Snapshot[]> {
  const historyFile = getHistoryFile(storageDir)
  if (!historyFile) return []

  try {
    const raw = await fs.readFile(historyFile, "utf-8")
    const parsed = JSON.parse(raw) as Snapshot[]
    return Array.isArray(parsed)
      ? parsed.map((snap) => ({
        ...snap,
        existed: snap.existed ?? snap.originalContent !== "",
      }))
      : []
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Snapshot history load failed:", err)
    }
    return []
  }
}

export function clearHistoryFile(storageDir: string | null): void {
  const historyFile = getHistoryFile(storageDir)
  if (historyFile) rmSync(historyFile, { force: true })
}
