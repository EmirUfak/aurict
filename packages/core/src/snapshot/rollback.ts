import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { Snapshot } from "./types.js"

/** Tek bir snapshot'ı dosya sistemine geri yazar (ya da dosya yoksa siler). */
export async function restoreSnapshot(snap: Snapshot): Promise<void> {
  if (!snap.existed) {
    try {
      await fs.unlink(snap.filePath)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err
    }
    return
  }

  await fs.mkdir(path.dirname(snap.filePath), { recursive: true })
  await fs.writeFile(snap.filePath, snap.originalContent, "utf-8")
}
