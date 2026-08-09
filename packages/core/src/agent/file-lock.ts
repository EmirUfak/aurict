import { mkdir, readFile, writeFile, unlink } from "node:fs/promises"
import { join } from "node:path"
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

const DEFAULT_TTL_MS = 30_000

function lockDir(workdir: string): string {
  return join(workdir, ".aurict", "locks")
}

function lockPathFor(workdir: string, filePath: string): string {
  const hash = createHash("sha1").update(filePath).digest("hex")
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
  ttlMs = DEFAULT_TTL_MS,
): Promise<boolean> {
  const path = lockPathFor(workdir, filePath)
  await mkdir(lockDir(workdir), { recursive: true })

  const now = Date.now()
  const info: FileLockInfo = { agentId, sessionId, acquiredAt: now, expiresAt: now + ttlMs }

  try {
    await writeFile(path, JSON.stringify(info), { flag: "wx" })
    return true
  } catch {
    const existing = await readLock(path)
    if (!existing) return false // okunamadı (silinmiş/bozuk) — güvenli tarafta kal
    if (existing.agentId === agentId) return true // aynı agent — idempotent
    if (existing.expiresAt > now) return false // başka agent hâlâ geçerli şekilde sahip

    // Stale lock — temizle ve bir kez daha dene (sınırsız retry yok, tek deneme yeterli)
    try {
      await unlink(path)
      await writeFile(path, JSON.stringify(info), { flag: "wx" })
      return true
    } catch {
      return false
    }
  }
}

/** Bir lock'u serbest bırakır. Sadece sahibi (aynı agentId) serbest bırakabilir. */
export async function releaseFileLock(workdir: string, filePath: string, agentId: string): Promise<boolean> {
  const path = lockPathFor(workdir, filePath)
  const existing = await readLock(path)
  if (!existing || existing.agentId !== agentId) return false
  try {
    await unlink(path)
    return true
  } catch {
    return false
  }
}

/** Bir dosyanın şu an (başka bir agent tarafından, geçerli şekilde) kilitli olup olmadığını döner. */
export async function getFileLockInfo(workdir: string, filePath: string): Promise<FileLockInfo | null> {
  const existing = await readLock(lockPathFor(workdir, filePath))
  if (!existing) return null
  if (existing.expiresAt <= Date.now()) return null // stale — kilitli sayılmaz
  return existing
}
