import { describe, it, expect, afterEach } from "bun:test"
import { join } from "node:path"
import { readFileSync } from "node:fs"
import { failedStrategiesStore } from "../src/agent/failed-strategies-store.js"
import type { FailureCooldownEntry } from "../src/agent/failure-cooldown.js"
import { createTempDir } from "./helpers.js"

function makeEntry(overrides: Partial<FailureCooldownEntry> = {}): FailureCooldownEntry {
  return {
    fingerprint: "bash:src/foo.ts::error",
    tool: "bash",
    path: "src/foo.ts",
    count: 3,
    firstSeenAt: Date.now() - 1000,
    lastSeenAt: Date.now(),
    strategyShiftRequired: true,
    reason: "command not found",
    ...overrides,
  }
}

describe("failedStrategiesStore", () => {
  let dirs: Array<() => void> = []

  afterEach(() => {
    for (const cleanup of dirs) cleanup()
    dirs = []
  })

  it("does not persist entries that are not strategyShiftRequired", () => {
    const { dir, cleanup } = createTempDir()
    dirs.push(cleanup)
    failedStrategiesStore.clearForTests(dir)

    failedStrategiesStore.record(dir, makeEntry({ strategyShiftRequired: false }))
    expect(failedStrategiesStore.recent(dir)).toEqual([])
  })

  it("persists a strategyShiftRequired entry to workdir/.aurict/failed-strategies.json", () => {
    const { dir, cleanup } = createTempDir()
    dirs.push(cleanup)
    failedStrategiesStore.clearForTests(dir)

    failedStrategiesStore.record(dir, makeEntry())
    const recent = failedStrategiesStore.recent(dir)
    expect(recent.length).toBe(1)
    expect(recent[0]!.tool).toBe("bash")
    expect(recent[0]!.path).toBe("src/foo.ts")
    expect(recent[0]!.count).toBe(3)

    const onDisk = JSON.parse(
      readFileSync(join(dir, ".aurict", "failed-strategies.json"), "utf8"),
    )
    expect(Array.isArray(onDisk)).toBe(true)
    expect(onDisk.length).toBe(1)
  })

  it("updates an existing entry by fingerprint instead of duplicating", () => {
    const { dir, cleanup } = createTempDir()
    dirs.push(cleanup)
    failedStrategiesStore.clearForTests(dir)

    failedStrategiesStore.record(dir, makeEntry({ count: 3 }))
    failedStrategiesStore.record(dir, makeEntry({ count: 4 }))

    const recent = failedStrategiesStore.recent(dir)
    expect(recent.length).toBe(1)
    expect(recent[0]!.count).toBe(4)
  })

  it("caps stored entries at MAX_ENTRIES (40) keeping the most recent", () => {
    const { dir, cleanup } = createTempDir()
    dirs.push(cleanup)
    failedStrategiesStore.clearForTests(dir)

    for (let i = 0; i < 45; i++) {
      failedStrategiesStore.record(
        dir,
        makeEntry({ fingerprint: `bash:src/f${i}.ts::error`, path: `src/f${i}.ts`, lastSeenAt: Date.now() + i }),
      )
    }

    const onDisk = JSON.parse(
      readFileSync(join(dir, ".aurict", "failed-strategies.json"), "utf8"),
    )
    expect(onDisk.length).toBe(40)
  })

  it("excludes entries older than the 7-day TTL from recent()", () => {
    // record() her zaman Date.now() ile damgalar; TTL filtresini izole test etmek
    // için persisted dosyaya doğrudan eski bir lastSeenAt yazıyoruz.
    const { dir, cleanup, createFile } = createTempDir()
    dirs.push(cleanup)
    failedStrategiesStore.clearForTests(dir)

    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
    createFile(join(".aurict", "failed-strategies.json"), JSON.stringify([
      { fingerprint: "x", tool: "bash", path: "src/foo.ts", reason: "old", count: 3, lastSeenAt: eightDaysAgo },
    ]))

    expect(failedStrategiesStore.recent(dir)).toEqual([])
  })

  it("respects the limit parameter and orders by most recent first", () => {
    const { dir, cleanup, createFile } = createTempDir()
    dirs.push(cleanup)
    failedStrategiesStore.clearForTests(dir)

    const now = Date.now()
    createFile(join(".aurict", "failed-strategies.json"), JSON.stringify([
      { fingerprint: "a", tool: "bash", path: "a.ts", reason: "x", count: 1, lastSeenAt: now - 3000 },
      { fingerprint: "b", tool: "bash", path: "b.ts", reason: "x", count: 1, lastSeenAt: now - 1000 },
      { fingerprint: "c", tool: "bash", path: "c.ts", reason: "x", count: 1, lastSeenAt: now - 2000 },
    ]))

    const recent = failedStrategiesStore.recent(dir, 2)
    expect(recent.length).toBe(2)
    expect(recent[0]!.path).toBe("b.ts")
    expect(recent[1]!.path).toBe("c.ts")
  })

  it("keeps different workdirs isolated from each other", () => {
    const a = createTempDir()
    const b = createTempDir()
    dirs.push(a.cleanup, b.cleanup)
    failedStrategiesStore.clearForTests(a.dir)
    failedStrategiesStore.clearForTests(b.dir)

    failedStrategiesStore.record(a.dir, makeEntry({ path: "only-in-a.ts" }))

    expect(failedStrategiesStore.recent(a.dir).length).toBe(1)
    expect(failedStrategiesStore.recent(b.dir).length).toBe(0)
  })
})
