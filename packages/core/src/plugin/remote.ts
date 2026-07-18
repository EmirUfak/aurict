/**
 * Remote plugin installer.
 * Fetches .js/.mjs plugin files from a URL and saves them to ~/.aurict/plugins/.
 * Mirrors the skill remote system but for executable JS plugins.
 */

import { join } from "path"
import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync, existsSync, renameSync } from "fs"
import { createHash } from "node:crypto"
import { PLUGIN_DIR } from "./loader.js"
import { fetchWithUrlPolicy, readResponseTextLimited } from "../security/network-policy.js"

const META_SUFFIX = ".meta.json"
const MAX_PLUGIN_BYTES = 2_000_000
const DOWNLOAD_TIMEOUT_MS = 30_000

export interface RemotePluginMeta {
  id:          string
  name:        string
  description: string
  source:      string
  filePath:    string
  installedAt: string
  sha256?:     string
}

function ensureDir(): void {
  mkdirSync(PLUGIN_DIR, { recursive: true })
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function idFromUrl(url: string): string {
  const filename = url.split("/").pop() ?? "plugin"
  return slugify(filename.replace(/\.(m?js)$/, ""))
}

export async function installRemotePlugin(url: string, nameHint?: string, expectedSha256?: string): Promise<RemotePluginMeta> {
  const rawUrl = url
    .replace("github.com", "raw.githubusercontent.com")
    .replace("/blob/", "/")

  const parsedUrl = new URL(rawUrl)
  if (!/\.(?:mjs|js)$/.test(parsedUrl.pathname)) throw new Error("Remote plugins must use a .js or .mjs URL")
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)
  let content: string
  try {
    const resp = await fetchWithUrlPolicy(rawUrl, { signal: controller.signal })
    if (!resp.ok) throw new Error(`Failed to download plugin from ${rawUrl}: HTTP ${resp.status}`)
    const downloaded = await readResponseTextLimited(resp, MAX_PLUGIN_BYTES)
    if (downloaded.truncated) throw new Error(`Plugin exceeds the ${MAX_PLUGIN_BYTES} byte download limit`)
    content = downloaded.text
  } finally {
    clearTimeout(timer)
  }
  if (!content.trim()) throw new Error("Downloaded content is empty")
  const sha256 = createHash("sha256").update(content).digest("hex")
  if (expectedSha256 && sha256.toLowerCase() !== expectedSha256.toLowerCase()) {
    throw new Error(`Plugin integrity check failed: expected ${expectedSha256}, received ${sha256}`)
  }

  const id       = nameHint ? slugify(nameHint) : idFromUrl(url)
  if (!id) throw new Error("Plugin URL or name does not produce a valid plugin id")
  const ext      = url.endsWith(".mjs") ? ".mjs" : ".js"
  const filePath = join(PLUGIN_DIR, `${id}${ext}`)

  ensureDir()
  const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`
  try {
    writeFileSync(tempPath, content, { encoding: "utf8", mode: 0o600 })
    renameSync(tempPath, filePath)
  } catch (error) {
    if (existsSync(tempPath)) unlinkSync(tempPath)
    throw error
  }

  const meta: RemotePluginMeta = {
    id,
    name:        nameHint || id,
    description: "",
    source:      url,
    filePath,
    installedAt: new Date().toISOString(),
    sha256,
  }
  writeFileSync(join(PLUGIN_DIR, `${id}${META_SUFFIX}`), JSON.stringify(meta, null, 2), "utf8")

  return meta
}

export function listInstalledPlugins(): RemotePluginMeta[] {
  ensureDir()
  let files: string[]
  try { files = readdirSync(PLUGIN_DIR) } catch { return [] }

  const results: RemotePluginMeta[] = []
  for (const f of files) {
    if (!f.endsWith(META_SUFFIX)) continue
    const id = f.replace(META_SUFFIX, "")
    try {
      const raw  = readFileSync(join(PLUGIN_DIR, f), "utf8")
      const meta = JSON.parse(raw) as RemotePluginMeta
      results.push({ ...meta, id })
    } catch { /* skip corrupt meta */ }
  }
  return results
}

export function uninstallPlugin(id: string): boolean {
  ensureDir()
  const metaPath = join(PLUGIN_DIR, `${id}${META_SUFFIX}`)
  if (!existsSync(metaPath)) return false

  let filePath = join(PLUGIN_DIR, `${id}.js`)
  if (!existsSync(filePath)) filePath = join(PLUGIN_DIR, `${id}.mjs`)

  try {
    if (existsSync(filePath)) unlinkSync(filePath)
    unlinkSync(metaPath)
    return true
  } catch { return false }
}
