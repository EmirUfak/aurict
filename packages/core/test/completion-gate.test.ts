/**
 * completion-gate.ts — Faz 4.1 (environmental-skip) ve Faz 4.2 (critique_required)
 * dallarını doğrular. Önceden bu dosya için doğrudan bir test yoktu.
 */
import { describe, it, expect } from "bun:test"
import { evaluateCompletionGate } from "../src/agent/completion-gate.js"
import type { ContinuationDecision } from "../src/agent/continuation.js"
import type { WorkingSetItem, WorkingSetSnapshot } from "../src/agent/working-set.js"

const completeContinuation: ContinuationDecision = {
  shouldContinue: false,
  stopReason: "complete",
  previousContinuations: 0,
  maxContinuations: 5,
  nextContinuationCount: 0,
  tasksOpen: false,
}

function item(partial: Partial<WorkingSetItem> & Pick<WorkingSetItem, "kind" | "label">): WorkingSetItem {
  return {
    id: partial.id ?? `${partial.kind}:${partial.label}`,
    score: partial.score ?? 50,
    lastSeenAt: Date.now(),
    source: partial.source ?? "test",
    reason: partial.reason ?? "test",
    ...partial,
  }
}

function workingSet(items: WorkingSetItem[]): WorkingSetSnapshot {
  return { items, updatedAt: Date.now() }
}

describe("evaluateCompletionGate — mevcut davranış (regresyon)", () => {
  it("değişen dosya yoksa complete döner", () => {
    const decision = evaluateCompletionGate({
      text: "Done.",
      continuation: completeContinuation,
      workingSet: workingSet([]),
    })
    expect(decision.status).toBe("complete")
  })

  it("değişen dosya var ama geçen doğrulama yoksa verification_required döner", () => {
    const decision = evaluateCompletionGate({
      text: "Done.",
      continuation: completeContinuation,
      workingSet: workingSet([
        item({ kind: "file", label: "src/a.ts", reason: "changed file" }),
      ]),
    })
    expect(decision.status).toBe("verification_required")
    expect(decision.shouldAutoContinue).toBe(true)
  })

  it("geçen doğrulama varsa complete döner", () => {
    const decision = evaluateCompletionGate({
      text: "Done.",
      continuation: completeContinuation,
      workingSet: workingSet([
        item({ kind: "file", label: "src/a.ts", reason: "changed file" }),
        item({ kind: "verification", label: "[TypeScript] ✓ No errors", status: "passed" }),
      ]),
    })
    expect(decision.status).toBe("complete")
  })

  it("failed verification varsa her zaman verification_required döner", () => {
    const decision = evaluateCompletionGate({
      text: "Done.",
      continuation: completeContinuation,
      workingSet: workingSet([
        item({ kind: "file", label: "src/a.ts", reason: "changed file" }),
        item({ kind: "verification", label: "error TS2322", status: "failed" }),
      ]),
    })
    expect(decision.status).toBe("verification_required")
    expect(decision.reason).toContain("verification failed")
  })
})

describe("evaluateCompletionGate — Faz 4.1 environmental skip", () => {
  it("TÜM verification item'ları 'not installed' skip ise complete döner (sonsuz döngü olmaz)", () => {
    const decision = evaluateCompletionGate({
      text: "Done.",
      continuation: completeContinuation,
      workingSet: workingSet([
        item({ kind: "file", label: "src/a.py", reason: "changed file" }),
        item({ kind: "verification", label: "[mypy] skipped — mypy not installed", status: "skipped" }),
      ]),
    })
    expect(decision.status).toBe("complete")
  })

  it("skip'lerden biri 'not installed' DEĞİLSE (ör. non-type change) o tek başına environmental sayılmaz ama safeSkip başka yoldan geçebilir", () => {
    // Sadece "not installed" olmayan bir skip varsa hasOnlyEnvironmentalSkips false olur.
    const decision = evaluateCompletionGate({
      text: "Done.",
      continuation: completeContinuation,
      workingSet: workingSet([
        item({ kind: "file", label: "src/a.py", reason: "changed file" }),
        item({ kind: "verification", label: "[mypy] skipped — some other reason", status: "skipped" }),
      ]),
    })
    expect(decision.status).toBe("verification_required")
  })

  it("bir dil check'i failed ise environmental-skip başka check'ler skip olsa bile devreye girmez", () => {
    const decision = evaluateCompletionGate({
      text: "Done.",
      continuation: completeContinuation,
      workingSet: workingSet([
        item({ kind: "file", label: "src/a.py", reason: "changed file" }),
        item({ kind: "verification", label: "[mypy] failed — type error", status: "failed" }),
        item({ kind: "verification", label: "[ruff] skipped — ruff not installed", status: "skipped" }),
      ]),
    })
    expect(decision.status).toBe("verification_required")
    expect(decision.reason).toContain("verification failed")
  })
})

describe("evaluateCompletionGate — Faz 4.2 critique_required", () => {
  it("bekleyen (active) bir critique item'ı varsa critique_required döner", () => {
    const decision = evaluateCompletionGate({
      text: "Done.",
      continuation: completeContinuation,
      workingSet: workingSet([
        item({ kind: "critique", label: "80 lines changed", status: "active", reason: "large change requires adversarial review" }),
      ]),
    })
    expect(decision.status).toBe("critique_required")
    expect(decision.shouldAutoContinue).toBe(true)
  })

  it("critique item'ı 'resolved' ise artık engellemez", () => {
    const decision = evaluateCompletionGate({
      text: "Done.",
      continuation: completeContinuation,
      workingSet: workingSet([
        item({ kind: "critique", label: "80 lines changed", status: "resolved" }),
      ]),
    })
    expect(decision.status).toBe("complete")
  })

  it("allowTaskAutoContinue=false iken critique_required shadowOnly olarak işaretlenir", () => {
    const decision = evaluateCompletionGate({
      text: "Done.",
      continuation: completeContinuation,
      workingSet: workingSet([
        item({ kind: "critique", label: "80 lines changed", status: "active" }),
      ]),
      allowTaskAutoContinue: false,
    })
    expect(decision.status).toBe("critique_required")
    expect(decision.shouldAutoContinue).toBe(false)
    expect(decision.shadowOnly).toBe(true)
  })

  it("verification_required ile critique_required aynı anda oluşursa verification önce gelir", () => {
    const decision = evaluateCompletionGate({
      text: "Done.",
      continuation: completeContinuation,
      workingSet: workingSet([
        item({ kind: "file", label: "src/a.ts", reason: "changed file" }),
        item({ kind: "critique", label: "80 lines changed", status: "active" }),
      ]),
    })
    expect(decision.status).toBe("verification_required")
  })
})
