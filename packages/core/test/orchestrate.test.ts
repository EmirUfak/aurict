/**
 * Faz 3B — orchestrate tool: decomposeTask + DAGOrchestrator + agentPool.spawn'ı
 * gerçek bir tool olarak bağlar. Bu ikisi önceden 0 çağırana sahip ölü koddu.
 */
import { describe, it, expect, mock } from "bun:test"
import { createMockContext, createTempDir } from "./helpers.js"

const spawnCalls: Array<{ id: string; agentType: string; prompt: string }> = []
let failAll = false

mock.module("../src/agent/pool.js", () => ({
  agentPool: {
    spawn: async (opts: { id: string; agentType: string; prompt: string; desc: string }) => {
      spawnCalls.push({ id: opts.id, agentType: opts.agentType, prompt: opts.prompt })
      if (failAll) throw new Error(`mock failure for ${opts.desc}`)
      return `mock result for ${opts.desc}`
    },
    active: [],
  },
  PoolFullError: class PoolFullError extends Error {},
}))

const { orchestrateTool } = await import("../src/tool/built-in/orchestrate.js")

function reset() {
  spawnCalls.length = 0
  failAll = false
}

describe("orchestrateTool", () => {
  it("orchestration.enabled ayarlanmamışsa (varsayılan kapalı) hata döner, hiçbir şey spawn etmez", async () => {
    reset()
    const { dir, cleanup } = createTempDir()
    try {
      const result = await orchestrateTool.execute(
        { objective: "analyze security, performance, architecture" },
        createMockContext({ workdir: dir }),
      )
      expect(result.error).toBeTruthy()
      expect(spawnCalls.length).toBe(0)
    } finally {
      cleanup()
    }
  })

  it("complexity:'simple' tek bir worker spawn eder", async () => {
    reset()
    const { dir, cleanup, createFile } = createTempDir()
    createFile(".aurict/config.json", JSON.stringify({ orchestration: { enabled: true } }))
    try {
      const result = await orchestrateTool.execute(
        { objective: "fix the login bug", complexity: "simple" },
        createMockContext({ workdir: dir }),
      )
      expect(result.error).toBeUndefined()
      expect(spawnCalls.length).toBe(1)
      expect(result.output).toContain("<orchestration-result")
      expect(result.output).toContain("total=\"1\"")
    } finally {
      cleanup()
    }
  })

  it("çok-boyutlu bir objective + complexity:'moderate' birden fazla PARALEL worker spawn eder", async () => {
    reset()
    const { dir, cleanup, createFile } = createTempDir()
    createFile(".aurict/config.json", JSON.stringify({ orchestration: { enabled: true } }))
    try {
      const result = await orchestrateTool.execute(
        { objective: "analyze this for security, performance and architecture", complexity: "moderate" },
        createMockContext({ workdir: dir }),
      )
      expect(result.error).toBeUndefined()
      expect(spawnCalls.length).toBeGreaterThanOrEqual(2)
      // Farklı boyutlar farklı agentType'lara map'lenmeli (security -> security, performance -> performance)
      const types = new Set(spawnCalls.map(c => c.agentType))
      expect(types.size).toBeGreaterThanOrEqual(2)
    } finally {
      cleanup()
    }
  })

  it("başarılı sonuç her sub-task için <subtask> bloğu içerir", async () => {
    reset()
    const { dir, cleanup, createFile } = createTempDir()
    createFile(".aurict/config.json", JSON.stringify({ orchestration: { enabled: true } }))
    try {
      const result = await orchestrateTool.execute(
        { objective: "analyze this for security, performance and architecture", complexity: "moderate" },
        createMockContext({ workdir: dir }),
      )
      expect(result.error).toBeUndefined()
      expect(result.output).toContain("<subtask")
      expect((result.output.match(/<subtask/g) ?? []).length).toBe(spawnCalls.length)
    } finally {
      cleanup()
    }
  })

  it("maxDepth:1 iken 'complex' istense bile 'simple' seviyeye düşürülür (tek worker)", async () => {
    reset()
    const { dir, cleanup, createFile } = createTempDir()
    createFile(".aurict/config.json", JSON.stringify({ orchestration: { enabled: true, maxDepth: 1 } }))
    try {
      const result = await orchestrateTool.execute(
        { objective: "analyze this for security, performance and architecture", complexity: "complex" },
        createMockContext({ workdir: dir }),
      )
      expect(result.error).toBeUndefined()
      expect(spawnCalls.length).toBe(1)
    } finally {
      cleanup()
    }
  })

  it("objective boşsa hata döner", async () => {
    reset()
    const { dir, cleanup, createFile } = createTempDir()
    createFile(".aurict/config.json", JSON.stringify({ orchestration: { enabled: true } }))
    try {
      const result = await orchestrateTool.execute({ objective: "" }, createMockContext({ workdir: dir }))
      expect(result.error).toBeTruthy()
      expect(spawnCalls.length).toBe(0)
    } finally {
      cleanup()
    }
  })

  it("tüm sub-task'lar fail olursa sonucun kendisinde error alanı da set edilir", async () => {
    reset()
    failAll = true
    const { dir, cleanup, createFile } = createTempDir()
    createFile(".aurict/config.json", JSON.stringify({ orchestration: { enabled: true } }))
    try {
      const result = await orchestrateTool.execute(
        { objective: "fix the login bug", complexity: "simple" },
        createMockContext({ workdir: dir }),
      )
      expect(result.error).toBeTruthy()
      expect(result.output).toContain("ERROR:")
    } finally {
      failAll = false
      cleanup()
    }
  })
})
