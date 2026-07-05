import { spawn } from "bun"
import { dirname } from "node:path"
import type { VerificationCheck, VerificationStatus } from "./pipeline.js"

/**
 * Faz 4.1 — Dile-agnostik post-edit doğrulama.
 *
 * tsc.ts'in TypeScript'e özel yaptığını Python/Go/Rust/Ruby için tekrarlar:
 * dosya uzantısına göre ilgili derleyici/type-checker'ı (varsa) çalıştırır.
 * Binary kurulu değilse (Bun.which → null) sessizce "skipped" döner — hiçbir
 * proje bu araçları kurmaya zorlanmaz, sadece varsa kullanılır.
 *
 * "check" tier (mypy/go vet/cargo check/ruby -c): tsc ile parite — varsayılan
 * açık, sadece verification.languages[ext]===false ile kapatılabilir.
 * "lint" tier (ruff/rubocop): daha gürültülü/opinionated — sadece
 * verification.autoLint===true iken çalışır.
 */

const RUNNER_TIMEOUT_MS = 6_000
const MAX_OUTPUT_CHARS = 2_000

export interface LanguageRunnerResult {
  checkId: VerificationCheck
  status:  VerificationStatus
  reason?: string
  output?: string
}

interface RunnerSpec {
  checkId: VerificationCheck
  binary:  string
  tier:    "check" | "lint"
  buildArgs: (filePath: string) => string[]
  /** Varsayılan: dosyanın kendi dizini (paket-per-dizin diller için, ör. Go). undefined → workdir. */
  cwd?: (filePath: string, workdir: string) => string
}

const RUNNERS_BY_EXT: Record<string, RunnerSpec[]> = {
  ".py": [
    { checkId: "mypy", binary: "mypy", tier: "check", buildArgs: (f) => ["mypy", "--no-error-summary", f] },
    { checkId: "ruff", binary: "ruff", tier: "lint",  buildArgs: (f) => ["ruff", "check", "--output-format=concise", f] },
  ],
  ".go": [
    { checkId: "govet", binary: "go", tier: "check", buildArgs: () => ["go", "vet", "./..."], cwd: (f) => dirname(f) },
  ],
  ".rs": [
    { checkId: "cargo", binary: "cargo", tier: "check", buildArgs: () => ["cargo", "check", "--message-format=short"] },
  ],
  ".rb": [
    { checkId: "ruby",    binary: "ruby",    tier: "check", buildArgs: (f) => ["ruby", "-c", f] },
    { checkId: "rubocop", binary: "rubocop", tier: "lint",  buildArgs: (f) => ["rubocop", "--format", "simple", f] },
  ],
}

export function extensionOf(filePath: string): string {
  const idx = filePath.lastIndexOf(".")
  return idx === -1 ? "" : filePath.slice(idx).toLowerCase()
}

/** Bir dosya uzantısı için tanımlı tüm runner'ları döner (kurulu olup olmadığına bakmadan). */
export function runnersForExtension(ext: string): RunnerSpec[] {
  return RUNNERS_BY_EXT[ext] ?? []
}

async function runOne(spec: RunnerSpec, filePath: string, workdir: string): Promise<LanguageRunnerResult> {
  if (!Bun.which(spec.binary)) {
    return { checkId: spec.checkId, status: "skipped", reason: `${spec.binary} not installed` }
  }

  const cwd = spec.cwd ? spec.cwd(filePath, workdir) : workdir
  try {
    const proc = spawn(spec.buildArgs(filePath), { cwd, stdout: "pipe", stderr: "pipe" })
    const timer = setTimeout(() => { try { proc.kill() } catch { /* already exited */ } }, RUNNER_TIMEOUT_MS)
    let exitCode: number
    let combined: string
    try {
      const out = await new Response(proc.stdout).text()
      const err = await new Response(proc.stderr).text()
      exitCode = await proc.exited
      combined = (out + err).trim()
    } finally {
      clearTimeout(timer)
    }

    if (exitCode === 0) {
      return { checkId: spec.checkId, status: "passed" }
    }
    return {
      checkId: spec.checkId,
      status: "failed",
      output: (combined || `${spec.binary} exited with code ${exitCode}`).slice(0, MAX_OUTPUT_CHARS),
    }
  } catch (err) {
    return {
      checkId: spec.checkId,
      status: "timeout",
      reason: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Bir dosya için ilgili tüm dil-özel doğrulayıcıları (varsa, kuruluysa) çalıştırır.
 * İlgili runner yoksa (bilinmeyen uzantı) boş dizi döner.
 */
export async function runLanguageChecks(
  filePath: string,
  workdir: string,
  opts: { languages?: Record<string, boolean>; autoLint?: boolean } = {},
): Promise<LanguageRunnerResult[]> {
  const ext = extensionOf(filePath)
  if (opts.languages?.[ext] === false) return []

  const specs = runnersForExtension(ext).filter((spec) => spec.tier === "check" || opts.autoLint === true)
  if (specs.length === 0) return []

  return Promise.all(specs.map((spec) => runOne(spec, filePath, workdir)))
}
