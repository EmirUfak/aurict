import { describe, it, expect, afterEach } from "bun:test"
import { join } from "node:path"
import { mkdirSync, writeFileSync, utimesSync } from "node:fs"
import { summarizeFragileAreas, clearFragileAreasCacheForTests } from "../src/agent/fragile-areas.js"
import type { RunTraceEvent } from "../src/agent/run-trace.js"
import { createTempDir } from "./helpers.js"

function traceLine(overrides: Partial<RunTraceEvent["data"]> = {}, type = "tool_result_distilled"): string {
  const event: RunTraceEvent = {
    ts: Date.now(),
    sessionId: "s1",
    type,
    data: { tool: "bash", status: "success", errors: [], ...overrides },
  }
  return JSON.stringify(event)
}

function writeTraceFile(workdir: string, sessionId: string, lines: string[]): void {
  const dir = join(workdir, ".aurict", "traces")
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${sessionId}.jsonl`), lines.join("\n") + "\n", "utf8")
}

describe("summarizeFragileAreas — Faz 6.3", () => {
  const dirs: Array<() => void> = []

  afterEach(() => {
    for (const cleanup of dirs.splice(0)) cleanup()
    clearFragileAreasCacheForTests()
  })

  it("returns [] when no traces directory exists", async () => {
    const { dir, cleanup } = createTempDir()
    dirs.push(cleanup)
    expect(await summarizeFragileAreas(dir)).toEqual([])
  })

  it("flags a tool with a high error rate and enough occurrences", async () => {
    const { dir, cleanup } = createTempDir()
    dirs.push(cleanup)

    writeTraceFile(dir, "s1", [
      traceLine({ tool: "bash", status: "error", errors: ["permission denied"] }),
      traceLine({ tool: "bash", status: "error", errors: ["permission denied"] }),
      traceLine({ tool: "bash", status: "error", errors: ["permission denied"] }),
      traceLine({ tool: "bash", status: "success" }),
    ])

    const areas = await summarizeFragileAreas(dir)
    expect(areas.length).toBe(1)
    expect(areas[0]!.tool).toBe("bash")
    expect(areas[0]!.errorCount).toBe(3)
    expect(areas[0]!.totalCount).toBe(4)
    expect(areas[0]!.errorRate).toBeCloseTo(0.75)
    expect(areas[0]!.sampleReason).toContain("permission denied")
  })

  it("does not flag a tool below the minimum occurrence threshold", async () => {
    const { dir, cleanup } = createTempDir()
    dirs.push(cleanup)

    writeTraceFile(dir, "s1", [
      traceLine({ tool: "edit", status: "error", errors: ["oops"] }),
      traceLine({ tool: "edit", status: "error", errors: ["oops"] }),
    ])

    expect(await summarizeFragileAreas(dir)).toEqual([])
  })

  it("does not flag a tool with a low error rate even with many occurrences", async () => {
    const { dir, cleanup } = createTempDir()
    dirs.push(cleanup)

    const lines = Array.from({ length: 10 }, (_, i) =>
      traceLine({ tool: "read", status: i === 0 ? "error" : "success", errors: i === 0 ? ["rare"] : [] }),
    )
    writeTraceFile(dir, "s1", lines)

    expect(await summarizeFragileAreas(dir)).toEqual([])
  })

  it("ignores non-tool_result_distilled event types", async () => {
    const { dir, cleanup } = createTempDir()
    dirs.push(cleanup)

    writeTraceFile(dir, "s1", [
      traceLine({ tool: "bash", status: "error", errors: ["x"] }, "completion_gate"),
      traceLine({ tool: "bash", status: "error", errors: ["x"] }, "completion_gate"),
      traceLine({ tool: "bash", status: "error", errors: ["x"] }, "completion_gate"),
    ])

    expect(await summarizeFragileAreas(dir)).toEqual([])
  })

  it("aggregates across multiple trace files (multiple past sessions)", async () => {
    const { dir, cleanup } = createTempDir()
    dirs.push(cleanup)

    writeTraceFile(dir, "s1", [
      traceLine({ tool: "bash", status: "error", errors: ["fail"] }),
      traceLine({ tool: "bash", status: "error", errors: ["fail"] }),
    ])
    writeTraceFile(dir, "s2", [
      traceLine({ tool: "bash", status: "error", errors: ["fail"] }),
      traceLine({ tool: "bash", status: "success" }),
    ])

    const areas = await summarizeFragileAreas(dir)
    expect(areas.length).toBe(1)
    expect(areas[0]!.totalCount).toBe(4)
    expect(areas[0]!.errorCount).toBe(3)
  })

  it("caches results for repeated calls within the TTL window", async () => {
    const { dir, cleanup } = createTempDir()
    dirs.push(cleanup)

    writeTraceFile(dir, "s1", [
      traceLine({ tool: "bash", status: "error", errors: ["fail"] }),
      traceLine({ tool: "bash", status: "error", errors: ["fail"] }),
      traceLine({ tool: "bash", status: "error", errors: ["fail"] }),
    ])

    const first = await summarizeFragileAreas(dir)
    expect(first.length).toBe(1)

    // Cache'i temizlemeden dosyayı boşaltıyoruz — hâlâ eski (cache'lenmiş) sonucu dönmeli.
    writeTraceFile(dir, "s1", [])
    const second = await summarizeFragileAreas(dir)
    expect(second).toEqual(first)
  })

  it("re-scans after clearFragileAreasCacheForTests()", async () => {
    const { dir, cleanup } = createTempDir()
    dirs.push(cleanup)

    writeTraceFile(dir, "s1", [
      traceLine({ tool: "bash", status: "error", errors: ["fail"] }),
      traceLine({ tool: "bash", status: "error", errors: ["fail"] }),
      traceLine({ tool: "bash", status: "error", errors: ["fail"] }),
    ])
    await summarizeFragileAreas(dir)

    writeTraceFile(dir, "s1", [])
    clearFragileAreasCacheForTests(dir)

    expect(await summarizeFragileAreas(dir)).toEqual([])
  })

  it("respects the limit parameter and sorts by descending error rate", async () => {
    const { dir, cleanup } = createTempDir()
    dirs.push(cleanup)

    writeTraceFile(dir, "s1", [
      // bash: 100% error rate (3/3)
      traceLine({ tool: "bash", status: "error", errors: ["a"] }),
      traceLine({ tool: "bash", status: "error", errors: ["a"] }),
      traceLine({ tool: "bash", status: "error", errors: ["a"] }),
      // edit: 50% error rate (2/4)
      traceLine({ tool: "edit", status: "error", errors: ["b"] }),
      traceLine({ tool: "edit", status: "error", errors: ["b"] }),
      traceLine({ tool: "edit", status: "success" }),
      traceLine({ tool: "edit", status: "success" }),
    ])

    const areas = await summarizeFragileAreas(dir, 1)
    expect(areas.length).toBe(1)
    expect(areas[0]!.tool).toBe("bash")
  })

  it("caps the number of trace files scanned and prefers the most recently modified ones", async () => {
    const { dir, cleanup } = createTempDir()
    dirs.push(cleanup)
    const tracesDir = join(dir, ".aurict", "traces")
    mkdirSync(tracesDir, { recursive: true })

    // 22 dosya oluştur (MAX_TRACE_FILES=20'yi aşıyor); en eski 2 dosya "old-tool" içersin,
    // bu iki dosya mtime bakımından en eski olacak şekilde ayarlanır ve taranmamalı.
    for (let i = 0; i < 22; i++) {
      const isOld = i < 2
      const content = traceLine({ tool: isOld ? "old-tool" : "bash", status: "error", errors: ["x"] })
        + "\n" + traceLine({ tool: isOld ? "old-tool" : "bash", status: "error", errors: ["x"] })
        + "\n" + traceLine({ tool: isOld ? "old-tool" : "bash", status: "error", errors: ["x"] })
      const filePath = join(tracesDir, `sess-${i}.jsonl`)
      writeFileSync(filePath, content + "\n", "utf8")
      const mtime = isOld ? new Date(Date.now() - 999_000_000) : new Date(Date.now() - i * 1000)
      utimesSync(filePath, mtime, mtime)
    }

    const areas = await summarizeFragileAreas(dir, 10)
    const tools = areas.map(a => a.tool)
    expect(tools).not.toContain("old-tool")
    expect(tools).toContain("bash")
  })
})
