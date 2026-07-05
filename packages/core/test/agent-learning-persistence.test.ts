import { describe, it, expect, afterEach } from "bun:test"
import { join } from "node:path"
import { readFileSync } from "node:fs"
import { agentLearner, createAgentLearner } from "../src/agent/learning.js"
import { createTempDir } from "./helpers.js"

describe("agentLearner persistence — Faz 5.2", () => {
  let cleanups: Array<() => void> = []

  afterEach(() => {
    for (const cleanup of cleanups) cleanup()
    cleanups = []
  })

  it("createAgentLearner() instances stay in-memory only by default (no disk writes)", () => {
    const { dir, cleanup } = createTempDir()
    cleanups.push(cleanup)
    const learner = createAgentLearner()
    learner.recordTask("code", true, 10, 5000)

    // In-memory hâlâ çalışır...
    expect(learner.getPerformance("code")?.totalTasks).toBe(1)
    // ...ama hiçbir yere yazmaz — rastgele bir dizine bakınca dosya oluşmamış olmalı.
    expect(() => readFileSync(join(dir, ".aurict", "agent-perf.json"), "utf8")).toThrow()
  })

  it("the real agentLearner singleton persists recordTask() to its configured path", () => {
    const { dir, cleanup } = createTempDir()
    cleanups.push(cleanup)
    const persistPath = join(dir, "agent-perf.json")
    agentLearner.setPersistPathForTests(persistPath)

    agentLearner.recordTask("debug", true, 4, 1200)

    const onDisk = JSON.parse(readFileSync(persistPath, "utf8"))
    expect(onDisk.debug).toBeDefined()
    expect(onDisk.debug.totalTasks).toBe(1)
    expect(onDisk.debug.successfulTasks).toBe(1)
  })

  it("a fresh instance pointed at the same path loads persisted state back", () => {
    const { dir, cleanup } = createTempDir()
    cleanups.push(cleanup)
    const persistPath = join(dir, "agent-perf.json")

    agentLearner.setPersistPathForTests(persistPath)
    agentLearner.recordTask("review", false, 6, 2000)
    agentLearner.recordTask("review", false, 6, 2000)
    agentLearner.recordTask("review", false, 6, 2000)

    // Ayrı bir instance aynı path'e ensureLoaded ile ilk erişimde disk'ten okumalı.
    // createAgentLearner in-memory default'tur; gerçek "farklı process, aynı dosya"
    // senaryosunu doğrulamak için setPersistPathForTests kullanıyoruz.
    const second = createAgentLearner()
    second.setPersistPathForTests(persistPath)

    const perf = second.getPerformance("review")
    expect(perf).not.toBeNull()
    expect(perf!.totalTasks).toBe(3)
    expect(perf!.failedTasks).toBe(3)
  })

  it("reset() clears in-memory state and persists the empty state to disk", () => {
    const { dir, cleanup } = createTempDir()
    cleanups.push(cleanup)
    const persistPath = join(dir, "agent-perf.json")
    agentLearner.setPersistPathForTests(persistPath)

    agentLearner.recordTask("code", true, 10, 5000)
    agentLearner.reset()

    expect(agentLearner.getPerformance("code")).toBeNull()
    const onDisk = JSON.parse(readFileSync(persistPath, "utf8"))
    expect(Object.keys(onDisk).length).toBe(0)
  })

  it("silently tolerates a corrupt persisted file instead of throwing", () => {
    const { dir, cleanup, createFile } = createTempDir()
    cleanups.push(cleanup)
    const persistPath = createFile("agent-perf.json", "{ not valid json")
    agentLearner.setPersistPathForTests(persistPath)

    expect(() => agentLearner.getAllPerformances()).not.toThrow()
    expect(agentLearner.getAllPerformances()).toEqual([])
  })
})
