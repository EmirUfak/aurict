import { stat } from "node:fs/promises"
import { resolve } from "node:path"
import crypto from "node:crypto"

interface CacheEntry<T> {
  mtimeMs: number
  hash: string
  data: T
}

function isMissingPath(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error
    && (error.code === "ENOENT" || error.code === "ENOTDIR"))
}

class SemanticCache {
  private cache = new Map<string, CacheEntry<any>>()

  private computeHash(content: string): string {
    return crypto.createHash("sha1").update(content).digest("hex")
  }

  async get<T>(filePath: string): Promise<T | null> {
    const entry = this.cache.get(filePath)
    if (!entry) return null

    try {
      const st = await stat(filePath)
      if (st.mtimeMs !== entry.mtimeMs) {
        this.cache.delete(filePath)
        return null
      }
      return entry.data
    } catch (error) {
      this.cache.delete(filePath)
      if (isMissingPath(error)) return null
      throw error
    }
  }

  async set<T>(filePath: string, data: T, content: string): Promise<void> {
    const st = await stat(filePath)
    const hash = this.computeHash(content)
    this.cache.set(filePath, { mtimeMs: st.mtimeMs, hash, data })
  }

  async triggerPrefetch(filePath: string, fromDir: string): Promise<void> {
    const content = await Bun.file(filePath).text()
    const importRegex = /import\s+.*?from\s+['"](\.\/|\.\.\/)(.*?)['"]/g
    let match
    while ((match = importRegex.exec(content)) !== null) {
      const relativePath = match[1]! + match[2]!
      const resolved = resolve(fromDir, relativePath)
      const finalPath = await this.resolveExtension(resolved)
      if (finalPath && !this.cache.has(finalPath)) {
        await this.preloadFile(finalPath)
      }
    }
  }

  private async resolveExtension(basePath: string): Promise<string | null> {
    const extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]
    for (const ext of extensions) {
      const p = basePath + ext
      try {
        await stat(p)
        return p
      } catch (error) {
        if (!isMissingPath(error)) throw error
      }
    }
    return null
  }

  private async preloadFile(filePath: string): Promise<void> {
    const content = await Bun.file(filePath).text()
    await this.set(filePath, content, content)
  }

  clear(): void {
    this.cache.clear()
  }
}

export const semanticCache = new SemanticCache()
