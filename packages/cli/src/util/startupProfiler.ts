/**
 * Aurict startup profiler — minimal, zero-cost-when-disabled phase tracker.
 *
 * İki mod:
 * 1. **Detaylı profil** (`AURICT_PROFILE_STARTUP=1`): her `profileCheckpoint`
 *    çağrısı için perf.mark + memory snapshot alır, program çıkışında
 *    insan veya JSON biçiminde timeline basar.
 * 2. **Kapalı (varsayılan)**: `profileCheckpoint` no-op'tur, `profileReport`
 *    boş dize döner. Üretim maliyeti ~0.
 *
 * OpenClaude'un `startupProfiler.ts` desenine parallel bir uyarlamadır,
 * amaç Aurict simli (`@aurict/cli` native binary) başlangıç fazlarını
 * gözle görülür hale getirmek ve `loadConfig` → `bootstrap` → `App.render`
 * zincirinin en yavaş adımını teşhis edebilmek.
 *
 * Kullanım:
 *   import { profileCheckpoint, profileReport } from "./util/startupProfiler.js"
 *   profileCheckpoint("config_loader_loaded")
 *   // ...
 *   profileCheckpoint("app_rendered")
 *   // Çıkışta:
 *   const text = profileReport("text")  // veya "json"
 *   if (text) console.error(text)
 *
 * Not: Node'un `perf_hooks` API'si kullanılır — `Bun` da `perf_hooks`'i
 * buggy olmadan destekler, ekstra dep gerekmez.
 */

import { performance } from "node:perf_hooks"

const ENV_FLAG = "AURICT_PROFILE_STARTUP"
const enabled = process.env[ENV_FLAG] === "1" || process.env[ENV_FLAG] === "true"

interface Phase {
  name:      string
  ts:        number            // perf.now() ms — Monotonic time from process start
  memory?:   NodeJS.MemoryUsage
}

const phases: Phase[] = []

if (enabled) {
  // İlk faz — bu modülün yüklenmesi
  phases.push({
    name:    "startup_profiler_loaded",
    ts:      performance.now(),
    memory:  process.memoryUsage(),
  })
}

/**
 * Checkpoint — geçerli fazı kaydeder. Disabled modda no-op.
 *
 * Aynı isim birden çok kez kullanılabilir (örn. iki adımlı init).
 */
export function profileCheckpoint(name: string): void {
  if (!enabled) return
  performance.mark(name)
  phases.push({
    name,
    ts:     performance.now(),
    memory: process.memoryUsage(),
  })
}

/** Phase'ler arasında sürüsü (milisaniye). Disabled modda boş dize döner. */
export function profileReport(format: "text" | "json" = "text"): string {
  if (!enabled || phases.length === 0) return ""
  if (format === "json") {
    return JSON.stringify({ phases }, null, 2)
  }

  const lines: string[] = ["Aurict startup profile"]
  lines.push("─".repeat(60))
  let prev: Phase | undefined
  for (const phase of phases) {
    const delta = prev ? phase.ts - prev.ts : 0
    const rssMb = phase.memory ? (phase.memory.rss / 1024 / 1024).toFixed(1) : "?"
    const absFromStart = phase.ts.toFixed(1).padStart(8)
    const deltaStr   = (prev ? `+${delta.toFixed(1)}` : "──").padStart(7)
    lines.push(`${absFromStart}ms  ${deltaStr}ms  rSS=${rssMb}MB  ${phase.name}`)
    prev = phase
  }
  const total = prev ? prev.ts - phases[0]!.ts : 0
  lines.push("─".repeat(60))
  lines.push(`total: ${total.toFixed(1)}ms across ${phases.length} phase(s)`)
  return lines.join("\n")
}

/**
 * profili request'e bağlı çıkışa yaz. Disabled modda atılır.
 * Çağıran modül `process.on("exit")` ile entegre etmeli.
 */
export function flushProfileReportOnExit(): void {
  if (!enabled) return
  process.on("exit", () => {
    const text = profileReport("text")
    if (text) {
      // stderr — stdout TUI'yi bozmaz
      process.stderr.write("\n" + text + "\n")
    }
  })
}

/** Test veya yerleşim kontrolü için enabled bayrağını getir. */
export function isStartupProfilingEnabled(): boolean {
  return enabled
}

/** Test veya reset için iç durumu temizle (sadece(enabled)) — üretimde kullanılmaz. */
export function __resetForTests(): void {
  phases.length = 0
}