import type { ContinuationDecision } from "./continuation.js"
import type { WorkingSetSnapshot } from "./working-set.js"
import type { SessionVerificationSnapshot } from "../session/resume-state.js"

export type CompletionGateStatus =
  | "complete"
  | "continue_required"
  | "blocked"
  | "verification_required"
  | "proof_required"
  | "critique_required"
  | "budget_exhausted"

export interface CompletionGateDecision {
  status: CompletionGateStatus
  shouldAutoContinue: boolean
  reason: string
  shadowOnly: boolean
}

export interface CompletionGateInput {
  text: string
  continuation: ContinuationDecision
  workingSet: WorkingSetSnapshot
  verification?: SessionVerificationSnapshot | undefined
  allowTaskAutoContinue?: boolean | undefined
}

export function evaluateCompletionGate(input: CompletionGateInput): CompletionGateDecision {
  if (process.env["AURICT_DISABLE_COMPLETION_GATE"] === "1") {
    return { status: "complete", shouldAutoContinue: false, reason: "completion gate disabled", shadowOnly: true }
  }
  if (input.continuation.stopReason === "blocked") {
    return { status: "blocked", shouldAutoContinue: false, reason: "continuation reported blocker", shadowOnly: false }
  }
  if (input.continuation.stopReason === "budget_exhausted") {
    return { status: "budget_exhausted", shouldAutoContinue: false, reason: "continuation budget exhausted", shadowOnly: false }
  }
  if (input.continuation.shouldContinue) {
    return { status: "continue_required", shouldAutoContinue: true, reason: `continuation:${input.continuation.reason ?? "unknown"}`, shadowOnly: false }
  }

  const allowTaskAutoContinue = input.allowTaskAutoContinue ?? true

  const changedFiles = input.workingSet.items.filter(item => item.kind === "file" && item.reason === "changed file")
  const verificationItems = input.workingSet.items.filter(item => item.kind === "verification")
  const failedVerification = verificationItems.find(item => item.status === "failed")
  const skippedRisky = input.verification?.status === "timeout"
  const hasPassedVerification = input.verification?.status === "passed" ||
    verificationItems.some(item => item.status === "passed")

  // Faz 4.1: bir dil için doğrulama aracı kurulu değilse (ör. mypy/ruff yok) bu
  // çevresel bir kısıttır, modelin çözebileceği bir şey değil — working-set'teki
  // TÜM verification item'ları "not installed" nedeniyle skip edildiyse (hiçbiri
  // failed değilse), TSC'nin "non-type change" skip'i gibi kabul edilebilir sayılır.
  // Aksi halde araç kurulu olmayan her proje sonsuz "verification gerekli" döngüsüne girer.
  const hasOnlyEnvironmentalSkips = verificationItems.length > 0 &&
    verificationItems.every(item => item.status === "passed" || (item.status === "skipped" && /not installed/i.test(item.label)))

  if (failedVerification) {
    return {
      status: "verification_required",
      shouldAutoContinue: allowTaskAutoContinue,
      reason: allowTaskAutoContinue ? "verification failed" : "verification failed outside task turn",
      shadowOnly: !allowTaskAutoContinue,
    }
  }
  if (changedFiles.length > 0 && !hasPassedVerification) {
    const safeSkip = (input.verification?.status === "skipped" && /non-type change|comment/i.test(input.verification.summary))
      || hasOnlyEnvironmentalSkips
    if (!safeSkip) {
      return {
        status: "verification_required",
        shouldAutoContinue: allowTaskAutoContinue && !skippedRisky,
        reason: !allowTaskAutoContinue ? "changed files outside task turn" : skippedRisky ? "verification timed out" : "changed files lack passing verification",
        shadowOnly: !allowTaskAutoContinue || process.env["AURICT_COMPLETION_GATE_SHADOW"] === "1",
      }
    }
  }

  // Faz 4.2: zorunlu adversarial critique — executor.ts sadece critique.enabled
  // true iken bu working-set item'ını oluşturur, o yüzden burada ek bir config
  // kontrolüne gerek yok (kaynağında kapalı).
  const pendingCritique = input.workingSet.items.find(item => item.kind === "critique" && item.status === "active")
  if (pendingCritique) {
    return {
      status: "critique_required",
      shouldAutoContinue: allowTaskAutoContinue,
      reason: allowTaskAutoContinue ? "critique_required" : "critique pending outside task turn",
      shadowOnly: !allowTaskAutoContinue,
    }
  }

  return { status: "complete", shouldAutoContinue: false, reason: "no blocking completion signals", shadowOnly: false }
}
