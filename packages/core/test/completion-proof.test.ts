import { afterEach, describe, expect, it } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  applyCompletionProofGate,
  buildCompletionProof,
  readCompletionProof,
  waiveProofCriterion,
  writeCompletionProof,
} from "../src/agent/completion-proof.js"
import type { CompletionGateDecision } from "../src/agent/completion-gate.js"
import type { TaskLedger } from "../src/agent/task-ledger.js"

const temporaryDirectories: string[] = []
const completeGate: CompletionGateDecision = {
  status: "complete",
  shouldAutoContinue: false,
  reason: "verified",
  shadowOnly: false,
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe("completion proof", () => {
  it("passes only when changed files and verification evidence are present", () => {
    const proof = buildCompletionProof({
      sessionId: "session-1",
      ledger: ledger({ status: "passed", summary: "12 tests passed", source: "tool_metadata" }),
      completionGate: completeGate,
      now: 100,
    })
    expect(proof.status).toBe("passed")
    expect(proof.criteria.map((criterion) => criterion.id)).toEqual(["change-set", "verification", "open-work"])
    expect(proof.evidenceCount).toBe(3)
  })

  it("turns a nominal completion into proof_required when evidence is pending", () => {
    const proof = buildCompletionProof({
      sessionId: "session-1",
      ledger: ledger({ status: "none" }),
      completionGate: completeGate,
      now: 100,
    })
    const gated = applyCompletionProofGate(completeGate, proof)
    expect(proof.status).toBe("pending")
    expect(gated.status).toBe("proof_required")
    expect(gated.shouldAutoContinue).toBe(true)
  })

  it("does not accept a model's text claim as verification evidence", () => {
    const proof = buildCompletionProof({
      sessionId: "session-1",
      ledger: ledger({ status: "passed", summary: "I ran the tests and they passed", source: "text" }),
      completionGate: completeGate,
      now: 100,
    })
    expect(proof.status).toBe("pending")
    expect(proof.criteria.find((criterion) => criterion.id === "verification")?.status).toBe("pending")
  })

  it("requires an explicit reason and preserves a waiver", () => {
    const original = buildCompletionProof({
      sessionId: "session-1",
      ledger: ledger({ status: "none" }),
      completionGate: completeGate,
      now: 100,
    })
    expect(() => waiveProofCriterion(original, "verification", "")).toThrow("waiver reason")
    const waived = waiveProofCriterion(original, "verification", "runner unavailable", 200)
    expect(waived.status).toBe("passed")
    expect(waived.criteria.find((criterion) => criterion.id === "verification")?.waiverReason).toBe("runner unavailable")
  })

  it("writes and reads the proof atomically", async () => {
    const workdir = await temporaryWorkdir()
    const proof = buildCompletionProof({
      sessionId: "session/a",
      ledger: ledger({ status: "passed", summary: "typecheck passed", source: "tool_metadata" }),
      completionGate: completeGate,
      now: 100,
    })
    await writeCompletionProof(workdir, proof)
    expect(await readCompletionProof(workdir, "session/a")).toEqual(proof)
    expect(await readCompletionProof(workdir, "missing")).toBeNull()
  })
})

function ledger(verification: TaskLedger["verification"]): TaskLedger {
  return {
    objective: "Implement verified behavior",
    phase: verification.status === "passed" ? "complete" : "verifying",
    openSteps: [],
    changedFiles: ["src/example.ts"],
    verification,
    recoveryAttempts: [],
    blockers: [],
    lastProgressAt: 1,
  }
}

async function temporaryWorkdir(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "aurict-proof-"))
  temporaryDirectories.push(directory)
  return directory
}
