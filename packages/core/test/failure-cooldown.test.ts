import { describe, it, expect, afterEach } from "bun:test"
import {
  recordFailureCooldown,
  getFailureCooldownSnapshot,
  clearFailureCooldown,
} from "../src/agent/failure-cooldown.js"
import type { DistilledToolResult } from "../src/tool/result-distiller.js"

function makeDistilled(overrides: Partial<DistilledToolResult> = {}): DistilledToolResult {
  return {
    tool: "bash",
    status: "error",
    changedFiles: [],
    filePaths: [],
    errors: ["command not found"],
    importantLines: [],
    verification: [],
    outputPreview: "command not found",
    ...overrides,
  }
}

describe("recordFailureCooldown — Faz 5.1 path field", () => {
  afterEach(() => {
    clearFailureCooldown()
  })

  it("populates entry.path from args.path when present", () => {
    const entry = recordFailureCooldown("s1", "edit", { path: "src/foo.ts" }, makeDistilled({ tool: "edit" }))
    expect(entry?.path).toBe("src/foo.ts")
  })

  it("falls back to distilled.filePaths[0] when args has no path", () => {
    const entry = recordFailureCooldown(
      "s1",
      "bash",
      { command: "cat src/bar.ts" },
      makeDistilled({ filePaths: ["src/bar.ts"] }),
    )
    expect(entry?.path).toBe("src/bar.ts")
  })

  it("omits path entirely when neither args nor distilled provide one", () => {
    const entry = recordFailureCooldown("s1", "bash", { command: "echo hi" }, makeDistilled())
    expect(entry?.path).toBeUndefined()
  })

  it("marks strategyShiftRequired once the same fingerprint repeats 3 times", () => {
    let entry = recordFailureCooldown("s1", "bash", { path: "src/foo.ts", command: "run" }, makeDistilled())
    expect(entry?.strategyShiftRequired).toBe(false)
    entry = recordFailureCooldown("s1", "bash", { path: "src/foo.ts", command: "run" }, makeDistilled())
    expect(entry?.strategyShiftRequired).toBe(false)
    entry = recordFailureCooldown("s1", "bash", { path: "src/foo.ts", command: "run" }, makeDistilled())
    expect(entry?.strategyShiftRequired).toBe(true)
    expect(entry?.count).toBe(3)
  })

  it("keeps path-differing calls to the same tool as separate fingerprints", () => {
    recordFailureCooldown("s1", "bash", { path: "src/a.ts", command: "run" }, makeDistilled())
    recordFailureCooldown("s1", "bash", { path: "src/b.ts", command: "run" }, makeDistilled())
    const snapshot = getFailureCooldownSnapshot("s1")
    expect(snapshot.entries.length).toBe(2)
  })
})
