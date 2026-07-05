/**
 * Faz 3C — dosya tabanlı worker lock.
 *  1) agent/file-lock.ts'in saf modül testleri (acquire/release/stale/idempotent).
 *  2) tool/executor.ts entegrasyonu: isSubagent:true iken kilitli bir dosyaya
 *     yazma denemesi engellenir; isSubagent:false (solo session) hiç etkilenmez.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  acquireFileLock,
  releaseFileLock,
  getFileLockInfo,
} from "../src/agent/file-lock.js"
import { executeTool, ExecutorEvents, PermissionGate, PermissionStore } from "../src/index.js"
import { writeTool } from "../src/tool/built-in/write.js"

let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "aurict-file-lock-"))
})
afterAll(() => {
  try { rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
})

function ctx(extra: Record<string, unknown> = {}) {
  return {
    workdir: dir,
    sessionId: "test-session",
    signal: new AbortController().signal,
    provider: "anthropic",
    model: "test",
    isSubagent: true,
    ...extra,
  }
}

describe("agent/file-lock.ts — saf modül davranışı", () => {
  const target = () => join(dir, `module-test-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`)

  it("kilitli olmayan bir dosya için lock alır", async () => {
    const f = target()
    const ok = await acquireFileLock(dir, f, "agent-a", "session-a")
    expect(ok).toBe(true)
  })

  it("aynı agentId tekrar lock almaya çalışırsa idempotent (true) döner", async () => {
    const f = target()
    await acquireFileLock(dir, f, "agent-a", "session-a")
    const ok = await acquireFileLock(dir, f, "agent-a", "session-a")
    expect(ok).toBe(true)
  })

  it("başka bir agentId geçerli bir lock varken false döner", async () => {
    const f = target()
    await acquireFileLock(dir, f, "agent-a", "session-a")
    const ok = await acquireFileLock(dir, f, "agent-b", "session-b")
    expect(ok).toBe(false)
  })

  it("süresi dolmuş (stale) bir lock otomatik temizlenip yeniden alınabilir", async () => {
    const f = target()
    await acquireFileLock(dir, f, "agent-a", "session-a", 10) // 10ms TTL
    await new Promise((r) => setTimeout(r, 30))
    const ok = await acquireFileLock(dir, f, "agent-b", "session-b")
    expect(ok).toBe(true)
  })

  it("releaseFileLock sadece sahibi tarafından yapılabilir", async () => {
    const f = target()
    await acquireFileLock(dir, f, "agent-a", "session-a")
    const releasedByOther = await releaseFileLock(dir, f, "agent-b")
    expect(releasedByOther).toBe(false)
    const releasedByOwner = await releaseFileLock(dir, f, "agent-a")
    expect(releasedByOwner).toBe(true)
  })

  it("release sonrası başka bir agent lock alabilir", async () => {
    const f = target()
    await acquireFileLock(dir, f, "agent-a", "session-a")
    await releaseFileLock(dir, f, "agent-a")
    const ok = await acquireFileLock(dir, f, "agent-b", "session-b")
    expect(ok).toBe(true)
  })

  it("getFileLockInfo geçerli bir lock için bilgi, süresi dolmuşsa null döner", async () => {
    const f = target()
    await acquireFileLock(dir, f, "agent-a", "session-a", 10)
    const infoValid = await getFileLockInfo(dir, f)
    expect(infoValid?.agentId).toBe("agent-a")
    await new Promise((r) => setTimeout(r, 30))
    const infoExpired = await getFileLockInfo(dir, f)
    expect(infoExpired).toBeNull()
  })

  it("hiç lock yoksa getFileLockInfo null döner", async () => {
    const info = await getFileLockInfo(dir, target())
    expect(info).toBeNull()
  })
})

describe("tool/executor.ts — Faz 3C entegrasyonu", () => {
  afterEach(async () => {
    PermissionStore.clear()
    PermissionGate.cancelPending()
    // Her testten sonra olası kalıntı lock'ları temizle
    try { await releaseFileLock(dir, join(dir, "shared.ts"), "other-worker") } catch { /* ignore */ }
  })

  it("isSubagent:false (solo session) kilitli bir dosyaya yazarken bile lock kontrolünden hiç etkilenmez", async () => {
    // isSubagent:false → PermissionGate gerçek bir kullanıcı onayı bekler; testte
    // otomatik onaylayan bir dinleyici kuruyoruz (permission-metadata.test.ts ile aynı desen).
    const off = ExecutorEvents.on((event) => {
      PermissionGate.respond(event.request.id, "allow_once")
    })
    const f = join(dir, "shared.ts")
    await acquireFileLock(dir, f, "other-worker", "other-session")
    try {
      const result = await executeTool(writeTool, { path: f, content: "export const x = 1\n" }, ctx({ isSubagent: false }))
      expect(result.error).toBeUndefined()
    } finally {
      off()
      await releaseFileLock(dir, f, "other-worker")
    }
  })

  it("isSubagent:true + dosya başka bir worker tarafından kilitliyse [file-lock] hatasıyla engellenir", async () => {
    const f = join(dir, "shared.ts")
    await acquireFileLock(dir, f, "other-worker", "other-session")
    try {
      const result = await executeTool(writeTool, { path: f, content: "export const x = 1\n" }, ctx({ sessionId: "worker-b" }))
      expect(result.error).toContain("[file-lock]")
    } finally {
      await releaseFileLock(dir, f, "other-worker")
    }
  })

  it("isSubagent:true + dosya AYNI worker (sessionId) tarafından kilitliyse (idempotent) engellenmez", async () => {
    const f = join(dir, "shared.ts")
    await acquireFileLock(dir, f, "worker-a", "worker-a")
    try {
      const result = await executeTool(writeTool, { path: f, content: "export const x = 1\n" }, ctx({ sessionId: "worker-a" }))
      expect(result.error).toBeUndefined()
    } finally {
      await releaseFileLock(dir, f, "worker-a")
    }
  })

  it("başarılı bir write sonrası executeTool kendi lock'unu serbest bırakır (bir sonraki worker engellenmez)", async () => {
    const f = join(dir, "shared.ts")
    const result = await executeTool(writeTool, { path: f, content: "export const x = 1\n" }, ctx({ sessionId: "worker-a" }))
    expect(result.error).toBeUndefined()
    const info = await getFileLockInfo(dir, f)
    expect(info).toBeNull()
  })
})
