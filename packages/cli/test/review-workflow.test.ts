import { afterEach, describe, expect, it } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { buildReviewManifest, buildReviewPatch } from "../src/review/manifest.js"
import { parseReviewReport } from "../src/review/report.js"
import { runReview } from "../src/review/runner.js"
import { listReviewSessions, readReviewSession, writeReviewSession } from "../src/review/store.js"
import type { ReviewSession } from "../src/review/types.js"

const roots: string[] = []

function repository(): string {
  const root = mkdtempSync(join(tmpdir(), "aurict-review-"))
  roots.push(root)
  execFileSync("git", ["init", "-q", root])
  execFileSync("git", ["-C", root, "config", "user.email", "review@example.test"])
  execFileSync("git", ["-C", root, "config", "user.name", "Review Test"])
  writeFileSync(join(root, "app.ts"), "export const value = 1\n", "utf8")
  execFileSync("git", ["-C", root, "add", "app.ts"])
  execFileSync("git", ["-C", root, "commit", "-qm", "initial"])
  return root
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true })
})

describe("deterministic review workflow", () => {
  it("manifests tracked and untracked workspace changes with exact hunks", () => {
    const root = repository()
    writeFileSync(join(root, "app.ts"), "export const value = 2\n", "utf8")
    writeFileSync(join(root, "new.ts"), "export const fresh = true\n", "utf8")
    const manifest = buildReviewManifest(root, { kind: "workspace" })
    expect(manifest.files.map((file) => file.path)).toEqual(["app.ts", "new.ts"])
    expect(manifest.files[0]?.hunks[0]).toMatchObject({ newStart: 1, newLines: 1 })
    expect(manifest.files[1]?.untracked).toBe(true)
    expect(buildReviewPatch(manifest)).toContain("+++ b/new.ts")
  })

  it("supports a single-commit scope without treating option text as a path", () => {
    const root = repository()
    writeFileSync(join(root, "app.ts"), "export const value = 3\n", "utf8")
    execFileSync("git", ["-C", root, "add", "app.ts"])
    execFileSync("git", ["-C", root, "commit", "-qm", "change value"])
    const manifest = buildReviewManifest(root, { kind: "commit", ref: "HEAD" })
    expect(manifest.files.map((file) => file.path)).toEqual(["app.ts"])
    expect(buildReviewPatch(manifest)).toContain("export const value = 3")
  })

  it("accepts only structured findings anchored to manifest changes", () => {
    const root = repository()
    writeFileSync(join(root, "app.ts"), "export const value = 2\n", "utf8")
    const manifest = buildReviewManifest(root, { kind: "workspace" })
    const report = parseReviewReport(JSON.stringify({ summary: "one issue", findings: [{
      severity: "high", file: "app.ts", line: 1, title: "Changed contract",
      detail: "The exported value changed without its consumer.", suggestion: "Update the consumer.", confidence: "high",
    }] }), manifest)
    expect(report.findings).toHaveLength(1)
    expect(report.findings[0]?.id).toHaveLength(12)
    expect(() => parseReviewReport(JSON.stringify({ summary: "bad", findings: [{
      severity: "high", file: "app.ts", line: 99, title: "Drifted line",
      detail: "Not on a changed line.", suggestion: "Do not report it.", confidence: "high",
    }] }), manifest)).toThrow("changed hunk")
  })

  it("persists review sessions atomically and lists them newest first", () => {
    const root = repository()
    writeFileSync(join(root, "app.ts"), "export const value = 2\n", "utf8")
    const manifest = buildReviewManifest(root, { kind: "workspace" })
    const session: ReviewSession = {
      version: 1, id: "review-test-123", status: "completed", manifest,
      provider: "test", model: "test", startedAt: "2026-08-07T00:00:00.000Z",
      completedAt: "2026-08-07T00:00:01.000Z", report: { summary: "clean", findings: [] },
    }
    writeReviewSession(session)
    expect(readReviewSession(root, session.id)).toEqual(session)
    expect(listReviewSessions(root).map((entry) => entry.id)).toEqual([session.id])
  })

  it("runs the read-only review path and persists validated model output", async () => {
    const root = repository()
    writeFileSync(join(root, "app.ts"), "export const value = 2\n", "utf8")
    let capturedTools: string[] | undefined
    const session = await runReview({
      workdir: root, mode: { kind: "workspace" }, provider: "test", model: "test",
      executeAgent: async (options) => {
        capturedTools = options.toolsOverride
        return { text: JSON.stringify({ summary: "clean", findings: [] }) }
      },
    })
    expect(capturedTools).toEqual(["read", "glob", "grep", "lsp"])
    expect(session.status).toBe("completed")
    expect(readReviewSession(root, session.id).report?.summary).toBe("clean")
  })
})
