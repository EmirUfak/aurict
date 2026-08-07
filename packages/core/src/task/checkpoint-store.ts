/**
 * CheckpointStore — Çok adımlı görev ilerleme takibi.
 *
 * Veriler bellek içinde tutulur ve ~/.aurict/checkpoints.json dosyasına
 * persist edilir. Context compaction olsa bile checkpoint'ler kaybolmaz.
 * SessionId bazlı izolasyon — farklı session'lar birbirini etkilemez.
 */

import { coreStatePath } from "../storage/paths.js"
import { readJsonFileSync, writeJsonFileAtomicSync } from "../storage/persisted-json.js"

// ── Tipler ────────────────────────────────────────────────────────────────────

export type StepStatus = "pending" | "done" | "skipped" | "failed"

export interface CheckpointStep {
  id:      string
  label:   string
  status:  StepStatus
  note?:   string
  doneAt?: number
}

export interface CheckpointEntry {
  id:        string
  title:     string
  steps:     CheckpointStep[]
  sessionId: string
  createdAt: number
  updatedAt: number
}

// ── Store sınıfı ──────────────────────────────────────────────────────────────

export class CheckpointStore {
  private data = new Map<string, CheckpointEntry>()   // key: `${sessionId}:${id}`
  private loaded = false
  private loadedPath: string | undefined

  constructor(private readonly resolveStorePath: () => string = () => coreStatePath("checkpoints.json")) {}

  // ── I/O ─────────────────────────────────────────────────────────────────────

  private load() {
    const path = this.resolveStorePath()
    if (this.loaded && this.loadedPath === path) return
    if (this.loadedPath !== path) this.data.clear()
    const entries = readJsonFileSync<CheckpointEntry[]>(path, {
      optional: true,
      description: "checkpoint store",
      validate: isCheckpointEntries,
    }) ?? []
    for (const entry of entries) this.data.set(`${entry.sessionId}:${entry.id}`, entry)
    this.loaded = true
    this.loadedPath = path
  }

  private persist() {
    writeJsonFileAtomicSync(this.resolveStorePath(), [...this.data.values()], { backup: true, mode: 0o600 })
  }

  // ── API ──────────────────────────────────────────────────────────────────────

  create(id: string, title: string, stepLabels: string[], sessionId: string): CheckpointEntry {
    this.load()
    const key = `${sessionId}:${id}`
    if (this.data.has(key)) {
      throw new Error(`Checkpoint '${id}' already exists for this session. Use 'read' to check progress or 'clear' to reset.`)
    }

    const steps: CheckpointStep[] = stepLabels.map((label, i) => ({
      id:     `step-${i + 1}`,
      label:  label.trim(),
      status: "pending",
    }))

    const entry: CheckpointEntry = {
      id,
      title,
      steps,
      sessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.data.set(key, entry)
    this.persist()
    return entry
  }

  private getOrThrow(id: string, sessionId: string): CheckpointEntry {
    this.load()
    const entry = this.data.get(`${sessionId}:${id}`)
    if (!entry) throw new Error(`Checkpoint '${id}' not found. Create it first with action='create'.`)
    return entry
  }

  tick(id: string, stepId: string, note: string | undefined, sessionId: string): CheckpointEntry {
    const entry = this.getOrThrow(id, sessionId)
    const step  = entry.steps.find((s) => s.id === stepId || s.label.toLowerCase().startsWith(stepId.toLowerCase()))
    if (!step) throw new Error(`Step '${stepId}' not found in checkpoint '${id}'.`)
    step.status = "done"
    step.doneAt = Date.now()
    if (note) step.note = note
    entry.updatedAt = Date.now()
    this.persist()
    return entry
  }

  markStep(id: string, stepId: string, status: StepStatus, reason: string | undefined, sessionId: string): CheckpointEntry {
    const entry = this.getOrThrow(id, sessionId)
    const step  = entry.steps.find((s) => s.id === stepId || s.label.toLowerCase().startsWith(stepId.toLowerCase()))
    if (!step) throw new Error(`Step '${stepId}' not found in checkpoint '${id}'.`)
    step.status = status
    step.doneAt = Date.now()
    if (reason) step.note = reason
    entry.updatedAt = Date.now()
    this.persist()
    return entry
  }

  read(id: string, sessionId: string): CheckpointEntry | null {
    this.load()
    return this.data.get(`${sessionId}:${id}`) ?? null
  }

  readAll(sessionId: string): CheckpointEntry[] {
    this.load()
    return [...this.data.values()].filter((e) => e.sessionId === sessionId)
  }

  clear(id: string, sessionId: string): boolean {
    this.load()
    const deleted = this.data.delete(`${sessionId}:${id}`)
    if (deleted) this.persist()
    return deleted
  }

  clearAll(sessionId: string): number {
    this.load()
    const keys = [...this.data.keys()].filter((k) => k.startsWith(`${sessionId}:`))
    for (const k of keys) this.data.delete(k)
    if (keys.length > 0) this.persist()
    return keys.length
  }

  // ── Formatla ─────────────────────────────────────────────────────────────────

  format(entry: CheckpointEntry): string {
    const done    = entry.steps.filter((s) => s.status === "done").length
    const skipped = entry.steps.filter((s) => s.status === "skipped").length
    const failed  = entry.steps.filter((s) => s.status === "failed").length
    const total   = entry.steps.length

    const pct = total > 0 ? Math.round((done / total) * 100) : 0

    const lines: string[] = [
      `Checkpoint: ${entry.id}`,
      `Title:      ${entry.title}`,
      `Progress:   ${done}/${total} done (${pct}%)${skipped > 0 ? `  ${skipped} skipped` : ""}${failed > 0 ? `  ${failed} failed` : ""}`,
      "",
    ]

    // Mevcut adım — ilk pending
    const currentIdx = entry.steps.findIndex((s) => s.status === "pending")

    for (let i = 0; i < entry.steps.length; i++) {
      const s       = entry.steps[i]!
      const isCur   = i === currentIdx
      const icon    = s.status === "done"    ? "✓"
                    : s.status === "skipped" ? "○"
                    : s.status === "failed"  ? "✗"
                    : isCur                  ? "▶"
                    :                         "○"
      const noteStr = s.note ? `  → ${s.note}` : ""
      const cur     = isCur ? " ← CURRENT" : ""
      lines.push(`  ${icon} ${s.id.padEnd(8)} ${s.label}${noteStr}${cur}`)
    }

    return lines.join("\n")
  }
}

export const checkpointStore = new CheckpointStore()

function isCheckpointEntries(value: unknown): value is CheckpointEntry[] {
  return Array.isArray(value) && value.every(entry => {
    if (!entry || typeof entry !== "object") return false
    const candidate = entry as Partial<CheckpointEntry>
    return typeof candidate.id === "string"
      && typeof candidate.title === "string"
      && typeof candidate.sessionId === "string"
      && typeof candidate.createdAt === "number"
      && typeof candidate.updatedAt === "number"
      && Array.isArray(candidate.steps)
      && candidate.steps.every(step => {
        if (!step || typeof step !== "object") return false
        const checkpointStep = step as Partial<CheckpointStep>
        return typeof checkpointStep.id === "string"
          && typeof checkpointStep.label === "string"
          && ["pending", "done", "skipped", "failed"].includes(checkpointStep.status ?? "")
          && (checkpointStep.note === undefined || typeof checkpointStep.note === "string")
          && (checkpointStep.doneAt === undefined || typeof checkpointStep.doneAt === "number")
      })
  })
}
