export type ReviewMode =
  | { kind: "workspace" }
  | { kind: "base"; ref: string }
  | { kind: "commit"; ref: string }

export interface ReviewHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
}

export interface ReviewFile {
  path: string
  additions: number | null
  deletions: number | null
  binary: boolean
  untracked: boolean
  hunks: ReviewHunk[]
}

export interface ReviewManifest {
  version: 1
  workdir: string
  mode: ReviewMode
  createdAt: string
  scopeHash: string
  patchHash: string
  files: ReviewFile[]
  totals: { files: number; additions: number; deletions: number; binary: number }
}

export type ReviewSeverity = "critical" | "high" | "medium" | "low" | "info"

export interface ReviewFinding {
  id: string
  severity: ReviewSeverity
  file: string
  line: number | null
  title: string
  detail: string
  suggestion: string
  confidence: "high" | "medium" | "low"
}

export interface ReviewReport {
  summary: string
  findings: ReviewFinding[]
}

export interface ReviewSession {
  version: 1
  id: string
  status: "running" | "completed" | "failed" | "interrupted" | "stale" | "cancelled"
  manifest: ReviewManifest
  provider: string
  model: string
  startedAt: string
  completedAt?: string
  report?: ReviewReport
  error?: string
}
