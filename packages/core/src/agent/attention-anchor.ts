import type { ActiveSkillPolicy } from "../skill/runtime-policy.js"
import type { WorkingSetSnapshot } from "./working-set.js"
import type { ContinuationDecision } from "./continuation.js"
import type { SessionVerificationSnapshot } from "../session/resume-state.js"
import type { FailureCooldownSnapshot } from "./failure-cooldown.js"
import type { FragileArea } from "./fragile-areas.js"

/** Faz 5.1b: workdir-keyed failed-strategies store'dan gelen kalıcı "known dead end" kaydı. */
export interface KnownDeadEnd {
  tool: string
  path?: string | undefined
  reason: string
  count: number
}

export interface AttentionAnchorInput {
  objective: string
  activeSkill?: ActiveSkillPolicy | null | undefined
  workingSet: WorkingSetSnapshot
  continuation?: ContinuationDecision | undefined
  verification?: SessionVerificationSnapshot | undefined
  cooldown?: FailureCooldownSnapshot | undefined
  /** Bu session'a özel değil — projede geçmiş session'larda da tekrarlanmış başarısız stratejiler. */
  knownDeadEnds?: KnownDeadEnd[] | undefined
  /** Faz 6.3: run-trace geçmişinden çıkarılan "bu projede en çok hata veren tool'lar" özeti. */
  fragileAreas?: FragileArea[] | undefined
  maxChars?: number | undefined
}

export function buildAttentionAnchor(input: AttentionAnchorInput): string {
  if (process.env["AURICT_DISABLE_ATTENTION_ANCHOR"] === "1") return ""
  const maxChars = Math.max(400, input.maxChars ?? 4_800)
  const files = input.workingSet.items.filter(item => item.kind === "file").slice(0, 8)
  const verification = input.workingSet.items.filter(item => item.kind === "verification").slice(0, 4)
  const errors = input.workingSet.items.filter(item => item.kind === "error").slice(0, 4)
  const cooldowns = input.cooldown?.active.slice(0, 3) ?? []
  const deadEnds = input.knownDeadEnds?.slice(0, 5) ?? []
  const fragileAreas = input.fragileAreas?.slice(0, 5) ?? []

  const lines = [
    "# Attention Anchor",
    `Objective: ${oneLine(input.objective || "Continue the current user task.", 260)}`,
    input.activeSkill ? `Active skill: ${input.activeSkill.skillName} (${input.activeSkill.skillId})` : "",
    input.continuation ? `Continuation: ${input.continuation.shouldContinue ? `continue (${input.continuation.reason ?? "unspecified"})` : `stop (${input.continuation.stopReason ?? "complete"})`}` : "",
    input.verification ? `Last verification: ${input.verification.status} — ${oneLine(input.verification.summary, 220)}` : "",
    files.length ? `Working files: ${files.map(item => item.label).join(", ")}` : "",
    verification.length ? `Verification signals: ${verification.map(item => oneLine(item.label, 140)).join(" | ")}` : "",
    errors.length ? `Active errors: ${errors.map(item => oneLine(item.label, 140)).join(" | ")}` : "",
    // Faz 5.1: sadece "N kez tekrarlandı" değil, HANGİ yaklaşımın öldüğü de görünür —
    // model "bash 3x tekrarladı"dan hangi komutu/dosyayı tekrar denememesi gerektiğini çıkaramazdı.
    cooldowns.length
      ? `Strategy cooldown (this session):\n${cooldowns.map(entry => formatCooldownLine(entry)).join("\n")}`
      : "",
    deadEnds.length
      ? `Known dead ends in this project (from past sessions):\n${deadEnds.map(entry => formatDeadEndLine(entry)).join("\n")}`
      : "",
    fragileAreas.length
      ? `Known fragile areas in this project (from run-trace history):\n${fragileAreas.map(entry => formatFragileAreaLine(entry)).join("\n")}`
      : "",
    "Next action: use the current working set and verification state; do not rely on stale context.",
  ].filter(Boolean)

  return truncate(lines.join("\n"), maxChars)
}

function formatCooldownLine(entry: { tool: string; path?: string | undefined; reason: string; count: number }): string {
  const location = entry.path ? ` on ${entry.path}` : ""
  return `- ${entry.tool}${location}: ${oneLine(entry.reason, 120)} (${entry.count}x) — do not retry this approach`
}

function formatDeadEndLine(entry: KnownDeadEnd): string {
  const location = entry.path ? ` on ${entry.path}` : ""
  return `- ${entry.tool}${location}: ${oneLine(entry.reason, 120)} (seen ${entry.count}x before)`
}

function formatFragileAreaLine(entry: FragileArea): string {
  const rate = Math.round(entry.errorRate * 100)
  const sample = entry.sampleReason ? ` — e.g. "${oneLine(entry.sampleReason, 100)}"` : ""
  return `- ${entry.tool}: fails ${rate}% of the time (${entry.errorCount}/${entry.totalCount})${sample} — double-check before using`
}

function oneLine(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 32)}\n[anchor truncated]` : value
}
