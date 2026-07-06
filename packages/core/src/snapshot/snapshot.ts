import * as fs from "node:fs/promises"
import * as path from "node:path"
import { homedir } from "node:os"
import type { Snapshot } from "./types.js"
import { persistHistory, loadPersistedHistory, clearHistoryFile } from "./store.js"
import { restoreSnapshot } from "./rollback.js"

export type { Snapshot } from "./types.js"

const MAX_SNAPSHOT_BYTES = 1_000_000

class SnapshotManager {
  private history: Snapshot[] = []
  private storageDir: string | null =
    process.env["AURICT_SNAPSHOT_DIR"] ?? path.join(homedir(), ".aurict", "snapshots")

  setStorageDir(dir: string | null): void {
    this.storageDir = dir
    this.history = []
  }

  getStorageDir(): string | null {
    return this.storageDir
  }

  private async persist(): Promise<void> {
    const result = await persistHistory(this.storageDir, this.history)
    this.history = result.history
    if (result.disableStorage) this.storageDir = null
  }

  async loadPersisted(): Promise<number> {
    this.history = await loadPersistedHistory(this.storageDir)
    return this.history.length
  }

  /**
   * Dosyanın mevcut halini belleğe kopyalar (yedekler).
   * @param filePath Yedeklenecek dosya yolu
   */
  async takeSnapshot(filePath: string): Promise<void> {
    const absolutePath = path.resolve(filePath)
    try {
      const stat = await fs.stat(absolutePath)
      if (stat.size > MAX_SNAPSHOT_BYTES) {
        console.error(`Snapshot skipped (${filePath}): file is ${stat.size} bytes`)
        return
      }
      const content = await fs.readFile(absolutePath, "utf-8")

      this.history.push({
        id: crypto.randomUUID(),
        filePath: absolutePath,
        originalContent: content,
        existed: true,
        timestamp: Date.now(),
      })
      await this.persist()
    } catch (err) {
      // Dosya henüz yoksa (yeni oluşturuluyorsa) yedeklenecek bir şey yok
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        this.history.push({
          id: crypto.randomUUID(),
          filePath: absolutePath,
          originalContent: "",
          existed: false,
          timestamp: Date.now(),
        })
        await this.persist()
      } else {
        console.error(`Snapshot failed (${filePath}):`, err)
      }
    }
  }

  /**
   * En son yedeği geri yükler.
   * @returns Geri yüklenen dosyanın yolu veya yapılamadıysa null
   */
  async undoLast(): Promise<string | null> {
    const last = this.history.pop()
    if (!last) {
      return null
    }

    try {
      await restoreSnapshot(last)
      await this.persist()
      return last.filePath
    } catch (err) {
      console.error(`Restore failed (${last.filePath}):`, err)
      return null
    }
  }

  /** Mevcut history uzunluğunu döner — checkpoint referansı olarak kullanılır */
  mark(): number {
    return this.history.length
  }

  getHistoryLength(): number {
    return this.history.length
  }

  /**
   * mark'tan sonra eklenen tüm snapshot'ları geri yükler.
   * @returns Geri yüklenen dosya yolları
   */
  async restoreToMark(mark: number): Promise<string[]> {
    const toRestore = this.history.splice(mark)
    const restored: string[] = []
    // Tersine çevir: en son alınan snapshot önce geri yüklenir
    for (const snap of toRestore.reverse()) {
      try {
        await restoreSnapshot(snap)
        restored.push(snap.filePath)
      } catch {
        /* ignore individual restore failures */
      }
    }
    await this.persist()
    return restored
  }

  /**
   * Geçmişi temizler.
   */
  clear(): void {
    this.history = []
    clearHistoryFile(this.storageDir)
  }
}

export const snapshotManager = new SnapshotManager()
