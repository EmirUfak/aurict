import { createHash } from "node:crypto"
import type { ReviewFinding, ReviewManifest, ReviewReport, ReviewSeverity } from "./types.js"

const SEVERITIES = new Set<ReviewSeverity>(["critical", "high", "medium", "low", "info"])
const CONFIDENCE = new Set(["high", "medium", "low"])

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function payload(text: string): unknown {
  const trimmed = text.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  try { return JSON.parse(fenced?.[1] ?? trimmed) }
  catch (error) { throw new Error(`Review model returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`) }
}

function changedLine(manifest: ReviewManifest, file: string, line: number): boolean {
  const entry = manifest.files.find((candidate) => candidate.path === file)
  if (!entry) return false
  if (entry.untracked) return true
  return entry.hunks.some((hunk) => hunk.newLines > 0 && line >= hunk.newStart && line < hunk.newStart + hunk.newLines)
}

export function parseReviewReport(text: string, manifest: ReviewManifest): ReviewReport {
  const value = payload(text)
  if (!object(value) || typeof value["summary"] !== "string" || !Array.isArray(value["findings"])) {
    throw new Error("Review JSON must contain summary and findings fields.")
  }
  const findings: ReviewFinding[] = value["findings"].map((raw, index) => {
    if (!object(raw)) throw new Error(`Finding ${index + 1} is not an object.`)
    const severity = raw["severity"]
    const confidence = raw["confidence"]
    const file = raw["file"]
    const line = raw["line"]
    for (const field of ["title", "detail", "suggestion"] as const) {
      if (typeof raw[field] !== "string" || !raw[field].trim()) throw new Error(`Finding ${index + 1} has invalid ${field}.`)
    }
    if (typeof severity !== "string" || !SEVERITIES.has(severity as ReviewSeverity)) throw new Error(`Finding ${index + 1} has invalid severity.`)
    if (typeof confidence !== "string" || !CONFIDENCE.has(confidence)) throw new Error(`Finding ${index + 1} has invalid confidence.`)
    if (typeof file !== "string" || !manifest.files.some((candidate) => candidate.path === file)) throw new Error(`Finding ${index + 1} references a file outside the review manifest.`)
    if (line !== null && (!Number.isInteger(line) || Number(line) < 1 || !changedLine(manifest, file, Number(line)))) {
      throw new Error(`Finding ${index + 1} line is not part of a changed hunk; use null for a file-level finding.`)
    }
    const identity = `${file}:${String(line)}:${raw["title"]}`
    return {
      id: createHash("sha256").update(identity).digest("hex").slice(0, 12),
      severity: severity as ReviewSeverity, file, line: line === null ? null : Number(line),
      title: String(raw["title"]).trim(), detail: String(raw["detail"]).trim(), suggestion: String(raw["suggestion"]).trim(),
      confidence: confidence as ReviewFinding["confidence"],
    }
  })
  const unique = [...new Map(findings.map((finding) => [finding.id, finding])).values()]
  return { summary: value["summary"].trim(), findings: unique }
}

export function formatReviewReport(report: ReviewReport): string {
  const lines = [`Review: ${report.summary}`, ""]
  if (report.findings.length === 0) return `${lines.join("\n")}No actionable findings.`
  for (const finding of report.findings) {
    lines.push(`[${finding.severity.toUpperCase()}] ${finding.file}${finding.line ? `:${finding.line}` : ""} — ${finding.title}`)
    lines.push(`  ${finding.detail}`, `  Fix: ${finding.suggestion}`, `  id=${finding.id} confidence=${finding.confidence}`, "")
  }
  return lines.join("\n").trim()
}
