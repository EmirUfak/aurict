import { mkdir, readFile, writeFile, unlink } from "node:fs/promises"
import { join, resolve } from "node:path"
import { createHash } from "node:crypto"

/**
 * Faz 3C — Dosya-tabanlı worker lock.
 *
 * Tasarım düzeltmesi (bkz. plan dosyası): context-bus.ts'in in-memory lock'u
 * agentPool.spawn'ın her worker için AYRI bir Worker thread başlatması
 * (pool.ts: new Worker(...)) yüzünden hiçbir çakışmayı önlemiyordu — her
 * thread kendi modül grafiğini yükler, contextBus singleton'ı paylaşılmaz.
 * Dosya sistemi thread/process sınırlarını aşar; bu yüzden lock durumu
 * `.aurict/locks/<sha1(path)>.lock` dosyalarında tutulur.
 */

export interface FileLockInfo {
  agentId:    string
  sessionId:  string
  acquiredAt: number
  expiresAt:  number
}

export interface AcquireLocksResult {
  acquired: boolean
  conflictingPath?: string
  acquiredPaths?: string[]
}

export const DEFAULT_FILE_LOCK_TTL_MS = 30_000

type AcquireFileLockResult = "acquired" | "owned" | "locked"

function lockDir(workdir: string): string {
  return join(workdir, ".aurict", "locks")
}

function lockPathFor(workdir: string, filePath: string): string {
  const canonical = resolve(workdir, filePath)
  const hash = createHash("sha1").update(canonical).digest("hex")
  return join(lockDir(workdir), `${hash}.lock`)
}

async function readLock(path: string): Promise<FileLockInfo | null> {
  try {
    const raw = await readFile(path, "utf8")
    return JSON.parse(raw) as FileLockInfo
  } catch {
    return null
  }
}

/**
 * Bir dosya için lock almaya çalışır.
 *   - Aynı agentId zaten sahipse: true (idempotent — aynı worker'ın ardışık edit'leri).
 *   - Başka bir agent hâlâ geçerli (süresi dolmamış) bir lock'a sahipse: false.
 *   - Süresi dolmuş (stale) bir lock varsa: temizlenir ve bir kez daha denenir.
 * `wx` flag'i ("write, fail if exists") dosya oluşturmayı atomic yapar.
 */
export async function acquireFileLock(
  workdir:   string,
  filePath:  string,
  agentId:   string,
  sessionId: string,
  ttlMs = DEFAULT_FILE_LOCK_TTL_MS,
): Promise<boolean> {
  return (await acquireFileLockResult(workdir, filePath, agentId, sessionId, ttlMs)) !== "locked"
}

async function acquireFileLockResult(
  workdir: string,
  filePath: string,
  agentId: string,
  sessionId: string,
  ttlMs: number,
): Promise<AcquireFileLockResult> {
  const path = lockPathFor(workdir, filePath)
  await mkdir(lockDir(workdir), { recursive: true })

  const now = Date.now()
  const info: FileLockInfo = { agentId, sessionId, acquiredAt: now, expiresAt: now + ttlMs }
  try {
    await writeFile(path, JSON.stringify(info), { flag: "wx" })
    return "acquired"
  } catch {
    const existing = await readLock(path)
    if (!existing) return "locked"
    if (existing.expiresAt > now) {
      return existing.agentId === agentId && existing.sessionId === sessionId ? "owned" : "locked"
    }

    try {
      await unlink(path)
      await writeFile(path, JSON.stringify(info), { flag: "wx" })
      return "acquired"
    } catch {
      return "locked"
    }
  }
}

/**
 * Birden fazla dosya için deterministik sırada lock almaya çalışır.
 *   - Yolları normalize eder, yinelenenleri eler ve alfabetik olarak sıralar.
 *   - Herhangi bir dosyanın lock'u alınamazsa, bu çağrıda şimdiye kadar alınan
 *     tüm lock'lar geri bırakılır (rollback) ve çakışan yol ile birlikte false döner.
 */
export async function acquireFileLocks(
  workdir:   string,
  filePaths: string[],
  agentId:   string,
  sessionId: string,
  ttlMs = DEFAULT_FILE_LOCK_TTL_MS,
): Promise<AcquireLocksResult> {
  const canonicalSortedPaths = [...new Set(filePaths.map((p) => resolve(workdir, p)))].sort()
  const acquiredPaths: string[] = []

  try {
    for (const filePath of canonicalSortedPaths) {
      const lock = await acquireFileLockResult(workdir, filePath, agentId, sessionId, ttlMs)
      if (lock === "locked") {
        await releaseFileLocks(workdir, acquiredPaths, agentId, sessionId)
        return { acquired: false, conflictingPath: filePath }
      }
      if (lock === "acquired") acquiredPaths.push(filePath)
    }
  } catch (error) {
    await releaseFileLocks(workdir, acquiredPaths, agentId, sessionId)
    throw error
  }

  return { acquired: true, acquiredPaths }
}

/** Bir lock'u serbest bırakır. Sadece sahibi (aynı agentId) serbest bırakabilir. */
export async function releaseFileLock(workdir: string, filePath: string, agentId: string, sessionId?: string): Promise<boolean> {
  const path = lockPathFor(workdir, filePath)
  const existing = await readLock(path)
  if (!existing || existing.agentId !== agentId || (sessionId !== undefined && existing.sessionId !== sessionId)) return false
  try {
    await unlink(path)
    return true
  } catch {
    return false
  }
}

/** Birden fazla lock'u toplu serbest bırakır. */
export async function releaseFileLocks(
  workdir:   string,
  filePaths: string[],
  agentId:   string,
  sessionId?: string,
): Promise<boolean> {
  const canonicalPaths = [...new Set(filePaths.map((p) => resolve(workdir, p)))]
  const results = await Promise.all(
    canonicalPaths.map((filePath) => releaseFileLock(workdir, filePath, agentId, sessionId)),
  )
  return results.every(Boolean)
}

/** Bir dosyanın şu an (başka bir agent tarafından, geçerli şekilde) kilitli olup olmadığını döner. */
export async function getFileLockInfo(workdir: string, filePath: string): Promise<FileLockInfo | null> {
  const existing = await readLock(lockPathFor(workdir, filePath))
  if (!existing) return null
  if (existing.expiresAt <= Date.now()) return null // stale — kilitli sayılmaz
  return existing
}
