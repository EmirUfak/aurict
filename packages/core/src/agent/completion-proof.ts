import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { CompletionGateDecision } from "./completion-gate.js"
import type { TaskLedger } from "./task-ledger.js"

export type ProofStatus = "passed" | "failed" | "pending" | "waived" | "not_applicable"
export type ProofEvidenceKind = "change_set" | "verification" | "task_state" | "waiver"

export interface ProofEvidence {
  id: string
  kind: ProofEvidenceKind
  status: "passed" | "failed" | "info"
  summary: string
  source: string
  recordedAt: number
}

export interface ProofCriterion {
  id: string
  label: string
  required: boolean
  status: ProofStatus
  evidence: ProofEvidence[]
  waiverReason?: string | undefined
}

export interface CompletionProof {
  version: 1
  sessionId: string
  objective: string
  status: ProofStatus
  criteria: ProofCriterion[]
  evidenceCount: number
  createdAt: number
  updatedAt: number
}

export interface BuildCompletionProofInput {
  sessionId: string
  ledger: TaskLedger
  completionGate: CompletionGateDecision
  previous?: CompletionProof | undefined
  now?: number | undefined
}

export function buildCompletionProof(input: BuildCompletionProofInput): CompletionProof {
  const now = input.now ?? Date.now()
  const previousWaivers = new Map(
    (input.previous?.criteria ?? [])
      .filter((criterion) => criterion.status === "waived")
      .map((criterion) => [criterion.id, criterion.waiverReason ?? "User waived this criterion"]),
  )
  const criteria = input.ledger.changedFiles.length === 0
    ? []
    : [
        changeSetCriterion(input.ledger, now),
        applyPreviousWaiver(verificationCriterion(input.ledger, input.completionGate, now), previousWaivers),
        applyPreviousWaiver(openWorkCriterion(input.ledger, now), previousWaivers),
      ]

  return {
    version: 1,
    sessionId: input.sessionId,
    objective: input.ledger.objective,
    status: overallStatus(criteria),
    criteria,
    evidenceCount: criteria.reduce((total, criterion) => total + criterion.evidence.length, 0),
    createdAt: input.previous?.createdAt ?? now,
    updatedAt: now,
  }
}

export function applyCompletionProofGate(
  decision: CompletionGateDecision,
  proof: CompletionProof,
): CompletionGateDecision {
  if (decision.status !== "complete" || proof.status === "passed" || proof.status === "not_applicable") {
    return decision
  }
  return {
    status: "proof_required",
    shouldAutoContinue: true,
    reason: proof.status === "failed" ? "completion proof contains failed criteria" : "completion proof is incomplete",
    shadowOnly: false,
  }
}

export function waiveProofCriterion(
  proof: CompletionProof,
  criterionId: string,
  reason: string,
  now = Date.now(),
): CompletionProof {
  const cleanReason = reason.trim()
  if (!cleanReason) throw new Error("A waiver reason is required")
  const target = proof.criteria.find((criterion) => criterion.id === criterionId)
  if (!target) throw new Error(`Unknown proof criterion: ${criterionId}`)
  const criteria = proof.criteria.map((criterion) => criterion.id === criterionId
    ? {
        ...criterion,
        status: "waived" as const,
        waiverReason: cleanReason,
        evidence: [...criterion.evidence, {
          id: `waiver:${criterionId}:${now}`,
          kind: "waiver" as const,
          status: "info" as const,
          summary: cleanReason,
          source: "user",
          recordedAt: now,
        }],
      }
    : criterion)
  return {
    ...proof,
    criteria,
    status: overallStatus(criteria),
    evidenceCount: criteria.reduce((total, criterion) => total + criterion.evidence.length, 0),
    updatedAt: now,
  }
}

export async function writeCompletionProof(workdir: string, proof: CompletionProof): Promise<void> {
  const directory = proofDirectory(workdir)
  await mkdir(directory, { recursive: true })
  const destination = proofPath(workdir, proof.sessionId)
  const temporary = `${destination}.${process.pid}.tmp`
  await writeFile(temporary, JSON.stringify(proof, null, 2), "utf8")
  await rename(temporary, destination)
}

export async function readCompletionProof(workdir: string, sessionId: string): Promise<CompletionProof | null> {
  try {
    const parsed = JSON.parse(await readFile(proofPath(workdir, sessionId), "utf8")) as CompletionProof
    if (parsed.version !== 1 || parsed.sessionId !== sessionId || !Array.isArray(parsed.criteria)) {
      throw new Error(`Invalid completion proof for session ${sessionId}`)
    }
    return parsed
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

export function formatCompletionProof(proof: CompletionProof): string {
  const lines = [
    `Completion proof: ${proof.status}`,
    `Objective: ${proof.objective || "(unknown)"}`,
    `Evidence: ${proof.evidenceCount}`,
  ]
  if (proof.criteria.length === 0) lines.push("No workspace changes require proof in this turn.")
  for (const criterion of proof.criteria) {
    const marker = criterion.status === "passed" ? "✓"
      : criterion.status === "waived" ? "~"
        : criterion.status === "failed" ? "✗" : "○"
    lines.push(`${marker} ${criterion.id}: ${criterion.label} [${criterion.status}]`)
    for (const evidence of criterion.evidence) lines.push(`    - ${evidence.summary} (${evidence.source})`)
    if (criterion.waiverReason) lines.push(`    waiver: ${criterion.waiverReason}`)
  }
  return lines.join("\n")
}

function changeSetCriterion(ledger: TaskLedger, now: number): ProofCriterion {
  return {
    id: "change-set",
    label: "Workspace changes are identified",
    required: true,
    status: "passed",
    evidence: [{
      id: `change-set:${now}`,
      kind: "change_set",
      status: "passed",
      summary: ledger.changedFiles.join(", "),
      source: "working_set",
      recordedAt: now,
    }],
  }
}

function verificationCriterion(
  ledger: TaskLedger,
  completionGate: CompletionGateDecision,
  now: number,
): ProofCriterion {
  const verification = ledger.verification
  let status: ProofStatus = "pending"
  if (verification.status === "passed" && verification.source === "tool_metadata") status = "passed"
  else if (verification.status === "failed" || verification.status === "timeout") status = "failed"
  else if (verification.status === "skipped" && completionGate.status === "complete") status = "waived"
  const evidence: ProofEvidence[] = verification.status === "none"
    ? []
    : [{
        id: `verification:${now}`,
        kind: "verification",
        status: status === "failed" ? "failed" : status === "passed" ? "passed" : "info",
        summary: verification.summary ?? verification.status,
        source: verification.source ?? "verification_pipeline",
        recordedAt: now,
      }]
  return {
    id: "verification",
    label: "Affected code path has verification evidence",
    required: true,
    status,
    evidence,
    ...(status === "waived" ? { waiverReason: verification.summary ?? "Verification safely skipped" } : {}),
  }
}

function openWorkCriterion(ledger: TaskLedger, now: number): ProofCriterion {
  const blockers = [...ledger.blockers]
  const openSteps = ledger.openSteps.map((step) => step.label)
  const status: ProofStatus = blockers.length > 0 ? "failed" : openSteps.length > 0 ? "pending" : "passed"
  return {
    id: "open-work",
    label: "No required work or blockers remain",
    required: true,
    status,
    evidence: [{
      id: `task-state:${now}`,
      kind: "task_state",
      status: status === "passed" ? "passed" : status === "failed" ? "failed" : "info",
      summary: blockers.length > 0
        ? `Blockers: ${blockers.join(", ")}`
        : openSteps.length > 0 ? `Open steps: ${openSteps.join(", ")}` : "No open steps or blockers",
      source: "task_ledger",
      recordedAt: now,
    }],
  }
}

function applyPreviousWaiver(
  criterion: ProofCriterion,
  waivers: Map<string, string>,
): ProofCriterion {
  const reason = waivers.get(criterion.id)
  return reason ? { ...criterion, status: "waived", waiverReason: reason } : criterion
}

function overallStatus(criteria: ProofCriterion[]): ProofStatus {
  if (criteria.length === 0) return "not_applicable"
  if (criteria.some((criterion) => criterion.required && criterion.status === "failed")) return "failed"
  if (criteria.some((criterion) => criterion.required && criterion.status === "pending")) return "pending"
  return "passed"
}

function proofDirectory(workdir: string): string {
  return join(workdir, ".aurict", "proofs")
}

function proofPath(workdir: string, sessionId: string): string {
  return join(proofDirectory(workdir), `${safeId(sessionId)}.json`)
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.:-]/g, "_")
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}
