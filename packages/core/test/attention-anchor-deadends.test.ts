import { describe, it, expect } from "bun:test"
import { buildAttentionAnchor } from "../src/agent/attention-anchor.js"
import type { WorkingSetSnapshot } from "../src/agent/working-set.js"

const emptyWorkingSet: WorkingSetSnapshot = { items: [], updatedAt: Date.now() }

describe("buildAttentionAnchor — Faz 5.1 enrichments", () => {
  it("omits cooldown/dead-end sections when none are present", () => {
    const anchor = buildAttentionAnchor({ objective: "fix the bug", workingSet: emptyWorkingSet })
    expect(anchor).not.toContain("Strategy cooldown")
    expect(anchor).not.toContain("Known dead ends")
  })

  it("renders a cooldown line including the path and 'do not retry' guidance", () => {
    const anchor = buildAttentionAnchor({
      objective: "fix the bug",
      workingSet: emptyWorkingSet,
      cooldown: {
        entries: [],
        active: [
          {
            fingerprint: "bash:src/foo.ts::error",
            tool: "bash",
            path: "src/foo.ts",
            count: 3,
            firstSeenAt: Date.now(),
            lastSeenAt: Date.now(),
            strategyShiftRequired: true,
            reason: "permission denied",
          },
        ],
      },
    })
    expect(anchor).toContain("Strategy cooldown (this session):")
    expect(anchor).toContain("bash on src/foo.ts")
    expect(anchor).toContain("permission denied")
    expect(anchor).toContain("(3x) — do not retry this approach")
  })

  it("omits the location suffix when a cooldown entry has no path", () => {
    const anchor = buildAttentionAnchor({
      objective: "fix the bug",
      workingSet: emptyWorkingSet,
      cooldown: {
        entries: [],
        active: [
          {
            fingerprint: "bash:::error",
            tool: "bash",
            count: 3,
            firstSeenAt: Date.now(),
            lastSeenAt: Date.now(),
            strategyShiftRequired: true,
            reason: "generic failure",
          },
        ],
      },
    })
    expect(anchor).toContain("- bash: generic failure")
    expect(anchor).not.toContain("bash on")
  })

  it("renders known dead ends from past sessions distinctly from this-session cooldowns", () => {
    const anchor = buildAttentionAnchor({
      objective: "fix the bug",
      workingSet: emptyWorkingSet,
      knownDeadEnds: [
        { tool: "edit", path: "src/bar.ts", reason: "syntax error introduced", count: 5 },
      ],
    })
    expect(anchor).toContain("Known dead ends in this project (from past sessions):")
    expect(anchor).toContain("edit on src/bar.ts")
    expect(anchor).toContain("(seen 5x before)")
  })

  it("caps known dead ends at 5 entries", () => {
    const anchor = buildAttentionAnchor({
      objective: "fix the bug",
      workingSet: emptyWorkingSet,
      knownDeadEnds: Array.from({ length: 8 }, (_, i) => ({
        tool: "bash",
        path: `src/f${i}.ts`,
        reason: "failed",
        count: 3,
      })),
    })
    const occurrences = anchor.split("\n").filter(line => line.includes("- bash on")).length
    expect(occurrences).toBe(5)
  })

  it("renders fragile areas from run-trace history with error rate and sample reason", () => {
    const anchor = buildAttentionAnchor({
      objective: "fix the bug",
      workingSet: emptyWorkingSet,
      fragileAreas: [
        { tool: "bash", errorCount: 3, totalCount: 4, errorRate: 0.75, sampleReason: "permission denied" },
      ],
    })
    expect(anchor).toContain("Known fragile areas in this project (from run-trace history):")
    expect(anchor).toContain("- bash: fails 75% of the time (3/4)")
    expect(anchor).toContain('e.g. "permission denied"')
    expect(anchor).toContain("double-check before using")
  })

  it("omits the sample-reason suffix when a fragile area has no sample", () => {
    const anchor = buildAttentionAnchor({
      objective: "fix the bug",
      workingSet: emptyWorkingSet,
      fragileAreas: [{ tool: "edit", errorCount: 3, totalCount: 5, errorRate: 0.6, sampleReason: "" }],
    })
    expect(anchor).toContain("- edit: fails 60% of the time (3/5)")
    expect(anchor).not.toContain("e.g.")
  })

  it("keeps dead-ends and fragile-areas sections distinct when both are present", () => {
    const anchor = buildAttentionAnchor({
      objective: "fix the bug",
      workingSet: emptyWorkingSet,
      knownDeadEnds: [{ tool: "edit", path: "src/bar.ts", reason: "syntax error", count: 5 }],
      fragileAreas: [{ tool: "bash", errorCount: 3, totalCount: 4, errorRate: 0.75, sampleReason: "" }],
    })
    expect(anchor).toContain("Known dead ends in this project (from past sessions):")
    expect(anchor).toContain("Known fragile areas in this project (from run-trace history):")
  })

  it("returns empty string when AURICT_DISABLE_ATTENTION_ANCHOR=1", () => {
    process.env["AURICT_DISABLE_ATTENTION_ANCHOR"] = "1"
    try {
      const anchor = buildAttentionAnchor({ objective: "fix the bug", workingSet: emptyWorkingSet })
      expect(anchor).toBe("")
    } finally {
      delete process.env["AURICT_DISABLE_ATTENTION_ANCHOR"]
    }
  })
})
