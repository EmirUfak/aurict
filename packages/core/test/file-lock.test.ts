/**
 * Faz 3C — dosya tabanlı worker lock.
 *  1) agent/file-lock.ts saf modül testleri (acquire/release/stale/idempotent/batch/rollback/ordering).
 *  2) tool/executor.ts entegrasyonu:
 *     - subagent mutasyonları (write, edit, apply_patch, notebook_edit) worker file lock ile korunur.
 *     - çok dosyalı apply_patch tüm kilitleri önceden alır; kısmi kilit başarısızlığında geri bırakır.
 *     - solo session (isSubagent: false) kilit kontrolünden etkilenmez.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  acquireFileLock,
  acquireFileLocks,
  releaseFileLock,
  releaseFileLocks,
  getFileLockInfo,
} from "../src/agent/file-lock.js"
import { executeTool, ExecutorEvents, PermissionGate, PermissionStore } from "../src/index.js"
import { writeTool } from "../src/tool/built-in/write.js"
import { editTool } from "../src/tool/built-in/edit.js"
import { applyPatchTool } from "../src/tool/built-in/apply-patch.js"
import { notebookEditTool } from "../src/tool/built-in/notebook.js"
import { progressTracker } from "../src/util/progress.js"

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

  it("acquireFileLocks birden fazla dosya için başarıyla lock alır", async () => {
    const f1 = target()
    const f2 = target()
    const result = await acquireFileLocks(dir, [f1, f2], "agent-batch", "session-batch")
    expect(result.acquired).toBe(true)
    expect(result.conflictingPath).toBeUndefined()
    expect(await getFileLockInfo(dir, f1)).not.toBeNull()
    expect(await getFileLockInfo(dir, f2)).not.toBeNull()
  })

  it("acquireFileLocks bir dosya kilitliyse başarısız olur ve kısmi kilitleri geri bırakır", async () => {
    const f1 = target()
    const f2 = target()
    const f3 = target()
    // f2 başka bir worker tarafından kilitlenmiş olsun
    await acquireFileLock(dir, f2, "other-agent", "other-session")

    const result = await acquireFileLocks(dir, [f1, f2, f3], "agent-batch", "session-batch")
    expect(result.acquired).toBe(false)
    expect(result.conflictingPath).toBe(f2)

    // f1 ve f3 üzerinde kilit kalmamış olmalı (rollback)
    expect(await getFileLockInfo(dir, f1)).toBeNull()
    expect(await getFileLockInfo(dir, f3)).toBeNull()

    // Başka bir worker f1'i hemen kilitleyebilmeli
    const ok = await acquireFileLock(dir, f1, "third-agent", "third-session")
    expect(ok).toBe(true)
  })

  it("acquireFileLocks yinelenen ve göreceli yolları tek bir kilide indirger (deduplicate/canonicalize)", async () => {
    const rel = `rel-test-${Date.now()}.ts`
    const abs = join(dir, rel)
    const result = await acquireFileLocks(dir, [rel, `./${rel}`, abs], "agent-dedup", "session-dedup")
    expect(result.acquired).toBe(true)
    const info = await getFileLockInfo(dir, abs)
    expect(info?.agentId).toBe("agent-dedup")
    await releaseFileLocks(dir, [rel], "agent-dedup")
    expect(await getFileLockInfo(dir, abs)).toBeNull()
  })

  it("acquireFileLocks giriş sırasından bağımsız olarak aynı deterministik sırayı kullanır", async () => {
    const a = join(dir, "order-a.ts")
    const b = join(dir, "order-b.ts")
    await acquireFileLock(dir, a, "other-agent", "other-session")
    await acquireFileLock(dir, b, "other-agent", "other-session")

    const reversed = await acquireFileLocks(dir, [b, a], "agent-order", "session-order")
    const ordered = await acquireFileLocks(dir, [a, b], "agent-order", "session-order")

    expect(reversed.conflictingPath).toBe(a)
    expect(ordered.conflictingPath).toBe(a)
  })

  it("releaseFileLocks tüm kilitleri toplu serbest bırakır", async () => {
    const f1 = target()
    const f2 = target()
    await acquireFileLocks(dir, [f1, f2], "agent-rel", "session-rel")
    const released = await releaseFileLocks(dir, [f1, f2], "agent-rel")
    expect(released).toBe(true)
    expect(await getFileLockInfo(dir, f1)).toBeNull()
    expect(await getFileLockInfo(dir, f2)).toBeNull()
  })
})

describe("tool/executor.ts — Faz 3C entegrasyonu & çok dosyalı subagent mutasyon kilitleme", () => {
  afterEach(async () => {
    PermissionStore.clear()
    PermissionGate.cancelPending()
    // Her testten sonra olası kalıntı lock'ları temizle
    try { await releaseFileLock(dir, join(dir, "shared.ts"), "other-worker") } catch { /* ignore */ }
    try { await releaseFileLock(dir, join(dir, "a.txt"), "other-worker") } catch { /* ignore */ }
    try { await releaseFileLock(dir, join(dir, "b.txt"), "other-worker") } catch { /* ignore */ }
    try { await releaseFileLock(dir, join(dir, "c.txt"), "other-worker") } catch { /* ignore */ }
  })

  it("Test H: isSubagent:false (solo session) kilitli bir dosyaya yazarken bile lock kontrolünden hiç etkilenmez", async () => {
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

  it("Test F: write aracı — isSubagent:true + dosya başka bir worker tarafından kilitliyse [file-lock] hatasıyla engellenir", async () => {
    const f = join(dir, "shared.ts")
    await acquireFileLock(dir, f, "other-worker", "other-session")
    try {
      const result = await executeTool(writeTool, { path: f, content: "export const x = 1\n" }, ctx({ sessionId: "worker-b" }))
      expect(result.error).toContain("[file-lock]")
    } finally {
      await releaseFileLock(dir, f, "other-worker")
    }
  })

  it("Test F: write aracı — isSubagent:true + dosya AYNI worker (sessionId) tarafından kilitliyse (idempotent) engellenmez", async () => {
    const f = join(dir, "shared.ts")
    await acquireFileLock(dir, f, "worker-a", "worker-a")
    try {
      const result = await executeTool(writeTool, { path: f, content: "export const x = 1\n" }, ctx({ sessionId: "worker-a" }))
      expect(result.error).toBeUndefined()
    } finally {
      await releaseFileLock(dir, f, "worker-a")
    }
  })

  it("Test F: write aracı — başarılı bir write sonrası executeTool kendi lock'unu serbest bırakır", async () => {
    const f = join(dir, "shared.ts")
    const result = await executeTool(writeTool, { path: f, content: "export const x = 1\n" }, ctx({ sessionId: "worker-a" }))
    expect(result.error).toBeUndefined()
    const info = await getFileLockInfo(dir, f)
    expect(info).toBeNull()
  })

  it("Test G: edit aracı — kilitli dosyaya düzenleme yapamaz, kendi kilidine izin verir ve işlem bitince kilit serbest kalır", async () => {
    const f = join(dir, "edit-target.txt")
    writeFileSync(f, "hello world\n")

    await acquireFileLock(dir, f, "other-worker", "other-session")
    try {
      const blocked = await executeTool(editTool, { path: f, old_string: "hello", new_string: "hi" }, ctx({ sessionId: "worker-b" }))
      expect(blocked.error).toContain("[file-lock]")
    } finally {
      await releaseFileLock(dir, f, "other-worker")
    }

    const success = await executeTool(editTool, { path: f, old_string: "hello", new_string: "hi" }, ctx({ sessionId: "worker-a" }))
    expect(success.error).toBeUndefined()
    expect(readFileSync(f, "utf8")).toBe("hi world\n")
    expect(await getFileLockInfo(dir, f)).toBeNull()
  })

  it("Test A: apply_patch aracı — kilitli hedef dosyayı içeren patch [file-lock] hatası ile engellenir ve çalıştırılmaz", async () => {
    const f = join(dir, "a.txt")
    writeFileSync(f, "initial\n")
    await acquireFileLock(dir, f, "other-worker", "other-session")

    try {
      const patchText = `*** Begin Patch
*** Update File: a.txt
@@
-initial
+modified
*** End Patch`
      const result = await executeTool(applyPatchTool, { patchText }, ctx({ sessionId: "worker-b" }))
      expect(result.error).toContain("[file-lock]")
      expect(readFileSync(f, "utf8")).toBe("initial\n")
    } finally {
      await releaseFileLock(dir, f, "other-worker")
    }
  })

  it("Test B: apply_patch aracı — çok dosyalı patch'te bir dosya kilitliyse tüm patch reddedilir ve hiçbir dosya değişmez", async () => {
    const a = join(dir, "a.txt")
    const b = join(dir, "b.txt")
    const c = join(dir, "c.txt")
    writeFileSync(a, "a-init\n")
    writeFileSync(b, "b-init\n")
    writeFileSync(c, "c-init\n")

    // b.txt başka bir worker tarafından kilitlensin
    await acquireFileLock(dir, b, "other-worker", "other-session")

    try {
      const patchText = `*** Begin Patch
*** Update File: a.txt
@@
-a-init
+a-modified
*** Update File: b.txt
@@
-b-init
+b-modified
*** Update File: c.txt
@@
-c-init
+c-modified
*** End Patch`

      const result = await executeTool(applyPatchTool, { patchText }, ctx({ sessionId: "worker-b" }))
      expect(result.error).toContain("[file-lock]")

      // Hiçbir dosya değişmemiş olmalı
      expect(readFileSync(a, "utf8")).toBe("a-init\n")
      expect(readFileSync(b, "utf8")).toBe("b-init\n")
      expect(readFileSync(c, "utf8")).toBe("c-init\n")
    } finally {
      await releaseFileLock(dir, b, "other-worker")
    }
  })

  it("Test C: kısmi kilit başarısızlığında geri bırakılan dosyaları başka bir worker hemen kilitleyebilir", async () => {
    const a = join(dir, "a.txt")
    const b = join(dir, "b.txt")
    const c = join(dir, "c.txt")
    writeFileSync(a, "a-init\n")
    writeFileSync(b, "b-init\n")
    writeFileSync(c, "c-init\n")

    await acquireFileLock(dir, c, "other-worker", "other-session")

    try {
      const patchText = `*** Begin Patch
*** Update File: a.txt
@@
-a-init
+a-modified
*** Update File: b.txt
@@
-b-init
+b-modified
*** Update File: c.txt
@@
-c-init
+c-modified
*** End Patch`

      const result = await executeTool(applyPatchTool, { patchText }, ctx({ sessionId: "worker-attempt" }))
      expect(result.error).toContain("[file-lock]")

      // a.txt üzerinde worker-attempt'in kilidi kalmamış olmalı
      expect(await getFileLockInfo(dir, a)).toBeNull()
      expect(await getFileLockInfo(dir, b)).toBeNull()

      const relock = await acquireFileLocks(dir, [a, b], "worker-c", "worker-c")
      expect(relock.acquired).toBe(true)
      await releaseFileLocks(dir, [a, b], "worker-c")
    } finally {
      await releaseFileLock(dir, c, "other-worker")
    }
  })

  it("Test D: başarılı çok dosyalı apply_patch sonrası tüm kilitler serbest bırakılır", async () => {
    const a = join(dir, "a.txt")
    const b = join(dir, "b.txt")
    const c = join(dir, "c.txt")
    writeFileSync(a, "a-init\n")
    writeFileSync(b, "b-init\n")
    writeFileSync(c, "c-init\n")

    const patchText = `*** Begin Patch
*** Update File: a.txt
@@
-a-init
+a-success
*** Update File: b.txt
@@
-b-init
+b-success
*** Update File: c.txt
@@
-c-init
+c-success
*** End Patch`

    const result = await executeTool(applyPatchTool, { patchText }, ctx({ sessionId: "worker-multi" }))
    expect(result.error).toBeUndefined()
    expect(readFileSync(a, "utf8")).toBe("a-success\n")
    expect(readFileSync(b, "utf8")).toBe("b-success\n")
    expect(readFileSync(c, "utf8")).toBe("c-success\n")

    // Tüm kilitler serbest kalmış olmalı
    expect(await getFileLockInfo(dir, a)).toBeNull()
    expect(await getFileLockInfo(dir, b)).toBeNull()
    expect(await getFileLockInfo(dir, c)).toBeNull()
  })

  it("Test E: bağımsız mutasyonlar birbirini engellemez", async () => {
    const a = join(dir, "a.txt")
    const b = join(dir, "b.txt")
    writeFileSync(a, "a-init\n")
    writeFileSync(b, "b-init\n")

    // Worker A, a.txt'yi kilitler
    await acquireFileLock(dir, a, "worker-a", "worker-a")

    try {
      // Worker B, bağımsız b.txt dosyasına yazabilir
      const result = await executeTool(writeTool, { path: b, content: "b-from-worker-b\n" }, ctx({ sessionId: "worker-b" }))
      expect(result.error).toBeUndefined()
      expect(readFileSync(b, "utf8")).toBe("b-from-worker-b\n")
    } finally {
      await releaseFileLock(dir, a, "worker-a")
    }
  })

  it("Test I: yinelenen mutasyon yolları tek bir kilit altında başarıyla çalışır", async () => {
    const a = join(dir, "a.txt")
    writeFileSync(a, "line 1\nline 2\n")

    const patchText = `*** Begin Patch
*** Update File: a.txt
@@
-line 1
+line 1 mod
*** End Patch`

    const result = await executeTool(applyPatchTool, { patchText }, ctx({ sessionId: "worker-dedup" }))
    expect(result.error).toBeUndefined()
    expect(await getFileLockInfo(dir, a)).toBeNull()
  })

  it("notebook_edit aracı subagent mutasyon kilitlemesine katılır", async () => {
    const nbPath = join(dir, "test.ipynb")
    const initialNb = JSON.stringify({
      cells: [{ cell_type: "code", source: ["print(1)\n"], metadata: {}, execution_count: null, outputs: [] }],
      metadata: {},
      nbformat: 4,
      nbformat_minor: 5,
    })
    writeFileSync(nbPath, initialNb)

    await acquireFileLock(dir, nbPath, "other-worker", "other-session")
    try {
      const blocked = await executeTool(
        notebookEditTool,
        { path: nbPath, action: "update", cellIndex: 0, source: "print(2)\n" },
        ctx({ sessionId: "worker-nb" }),
      )
      expect(blocked.error).toContain("[file-lock]")
    } finally {
      await releaseFileLock(dir, nbPath, "other-worker")
    }

    const success = await executeTool(
      notebookEditTool,
      { path: nbPath, action: "update", cellIndex: 0, source: "print(2)\n" },
      ctx({ sessionId: "worker-nb" }),
    )
    expect(success.error).toBeUndefined()
    expect(await getFileLockInfo(dir, nbPath)).toBeNull()
  })

  it("Test K: araç çalışırken throw etse bile kilitler serbest bırakılır", async () => {
    const f = join(dir, "throw-test.txt")
    writeFileSync(f, "content\n")

    // Hatalı argüman veya çalışma zamanı hatası simülasyonu
    const brokenTool = {
      ...writeTool,
      async execute() {
        throw new Error("simulated failure")
      },
    }

    const result = await executeTool(brokenTool, { path: f, content: "new" }, ctx({ sessionId: "worker-throw" }))
    expect(result.error).toContain("simulated failure")

    // Kilit serbest kalmış olmalı
    expect(await getFileLockInfo(dir, f)).toBeNull()
  })

  it("transaction kurulumu başarısız olsa bile kilit serbest bırakılır", async () => {
    progressTracker.clear()
    const result = executeTool(writeTool, { path: dir, content: "new" }, ctx({ sessionId: "worker-transaction" }))
    await expect(result).rejects.toThrow()
    expect(await getFileLockInfo(dir, dir)).toBeNull()
    expect(progressTracker.getActiveTools()).toEqual([])
  })
})
