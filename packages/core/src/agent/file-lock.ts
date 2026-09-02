import { mkdir, readFile, writeFile, unlink, rename, readdir, stat } from "node:fs/promises"
import { join } from "node:path"
import { createHash, randomBytes } from "node:crypto"

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

function claimSuffix(): string {
  return randomBytes(6).toString("hex")
}

async function readRaw(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8")
  } catch {
    return null
  }
}

function parseLock(raw: string): FileLockInfo | null {
  try {
    return JSON.parse(raw) as FileLockInfo
  } catch {
    return null
  }
}

/**
 * A crash between a CAS rename and its unlink leaves a claim sibling behind.
 * Orphans never block acquisition (the canonical path is free again), so this
 * only reclaims disk; it runs on the rare reclamation path and never throws.
 */
async function pruneOrphanClaims(dir: string): Promise<void> {
  try {
    const cutoff = Date.now() - DEFAULT_TTL_MS
    for (const name of await readdir(dir)) {
      if (!/\.lock\.(?:reclaim|release)\.[0-9a-f]+$/.test(name)) continue
      const full = join(dir, name)
      const info = await stat(full).catch(() => null)
      if (info && info.mtimeMs < cutoff) await unlink(full).catch(() => { /* raced — already gone */ })
    }
  } catch { /* best-effort — sweeping must never fail an acquire */ }
}

async function readLock(path: string): Promise<FileLockInfo | null> {
  const raw = await readRaw(path)
  return raw === null ? null : parseLock(raw)
}

/**
 * Bir dosya için lock almaya çalışır.
 *   - Aynı agentId zaten sahipse: true (idempotent — aynı worker'ın ardışık edit'leri).
 *   - Başka bir agent hâlâ geçerli (süresi dolmamış) bir lock'a sahipse: false.
 *   - Süresi dolmuş (stale) bir lock varsa: race-safe biçimde devralınır.
 * `wx` flag'i ("write, fail if exists") dosya oluşturmayı atomic yapar.
 *
 * Stale reclamation uses rename() as a compare-and-swap instead of
 * read → unlink → create: rename requires its source to exist, so racing
 * callers get exactly one winner and ENOENT for the rest. The captured bytes
 * are re-checked against the stale observation; a mismatch means the slot
 * changed underneath us, so it is restored (only into an empty slot) and
 * reclamation abandoned.
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
  const raw = JSON.stringify(info)

  try {
    await writeFile(path, raw, { flag: "wx" })
    return true
  } catch {
    // contended — fall through to the read/decide path below
  }

  const existingRaw = await readRaw(path)
  if (existingRaw === null) return false // okunamadı (silinmiş/bozuk) — güvenli tarafta kal
  const existing = parseLock(existingRaw)
  if (!existing) return false
  if (existing.agentId === agentId) return true // aynı agent — idempotent
  if (existing.expiresAt > now) return false // başka agent hâlâ geçerli şekilde sahip

  // Stale lock — exclusive reclamation via rename-as-CAS (see doc comment above).
  await pruneOrphanClaims(lockDir(workdir))
  const claimPath = `${path}.reclaim.${claimSuffix()}`
  try {
    await rename(path, claimPath)
  } catch {
    return false // another contender (or the owner) already moved it first
  }

  try {
    const capturedRaw = await readRaw(claimPath)
    if (capturedRaw !== existingRaw) {
      // Slot changed under us — restore only if nothing else reclaimed it.
      if (capturedRaw !== null) {
        try { await writeFile(path, capturedRaw, { flag: "wx" }) } catch { /* slot already reoccupied — leave it */ }
      }
      return false
    }

    await writeFile(path, raw, { flag: "wx" })
    return true
  } catch {
    return false // a fresh acquirer filled the slot in the gap — defer to it
  } finally {
    await unlink(claimPath).catch(() => { /* best-effort — already gone or never created */ })
  }
}

/**
 * Bir lock'u serbest bırakır. Sadece sahibi (aynı agentId) serbest bırakabilir.
 *
 * Ownership is checked BEFORE the rename-as-CAS capture: renaming first would
 * make a still-valid lock briefly invisible, letting a third agent win the `wx`
 * fast path and destroying the real owner's lock. A non-owner release must stay
 * a pure no-op. The CAS still guards the owner against a racing stale reclaim.
 */
export async function releaseFileLock(workdir: string, filePath: string, agentId: string): Promise<boolean> {
  const path = lockPathFor(workdir, filePath)

  const existing = await readLock(path)
  if (!existing || existing.agentId !== agentId) return false

  const claimPath = `${path}.release.${claimSuffix()}`
  try {
    await rename(path, claimPath)
  } catch {
    return false // nothing there to release, or someone else captured it first
  }

  try {
    const capturedRaw = await readRaw(claimPath)
    const captured = capturedRaw === null ? null : parseLock(capturedRaw)
    if (captured && captured.agentId === agentId) return true

    // Replaced between our read and our capture — restore the exact bytes we
    // took (parseable or not) if the slot is still empty, and report no-op.
    if (capturedRaw !== null) {
      try { await writeFile(path, capturedRaw, { flag: "wx" }) } catch { /* slot reoccupied — leave it */ }
    }
    return false
  } finally {
    await unlink(claimPath).catch(() => { /* best-effort — already gone */ })
  }
}

/** Bir dosyanın şu an (başka bir agent tarafından, geçerli şekilde) kilitli olup olmadığını döner. */
export async function getFileLockInfo(workdir: string, filePath: string): Promise<FileLockInfo | null> {
  const existing = await readLock(lockPathFor(workdir, filePath))
  if (!existing) return null
  if (existing.expiresAt <= Date.now()) return null // stale — kilitli sayılmaz
  return existing
}
