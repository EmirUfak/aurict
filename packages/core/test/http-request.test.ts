import { describe, it, expect, mock, beforeEach } from "bun:test"
import { createMockContext } from "./helpers.js"

type Scenario = "success" | "hang-body" | "pending-fetch" | "fetch-error"

let scenario: Scenario = "success"
let fetchCalls = 0
let lastSignal: AbortSignal | undefined

function abortError(): Error {
  return Object.assign(new Error("The operation was aborted"), { name: "AbortError" })
}

mock.module("../src/security/network-policy.js", () => ({
  fetchWithUrlPolicy: async (_url: string, request: RequestInit) => {
    fetchCalls++
    lastSignal = request.signal as AbortSignal
    if (lastSignal?.aborted) throw abortError()
    if (scenario === "fetch-error") throw new Error("network down")
    if (scenario === "pending-fetch") {
      return new Promise((_resolve, reject) => {
        lastSignal!.addEventListener("abort", () => reject(abortError()), { once: true })
      })
    }
    return {
      ok: true, status: 200, statusText: "OK",
      headers: new Headers({ "content-type": "application/json" }),
    } as unknown as Response
  },
  readResponseTextLimited: async (_res: Response, _max: number) => {
    if (scenario === "hang-body") {
      return new Promise((_resolve, reject) => {
        lastSignal!.addEventListener("abort", () => reject(abortError()), { once: true })
      })
    }
    return { text: JSON.stringify({ ok: true }), truncated: false }
  },
}))

const { httpRequestTool } = await import("../src/tool/built-in/http-request.js")

beforeEach(() => {
  scenario = "success"
  fetchCalls = 0
  lastSignal = undefined
})

describe("httpRequestTool yaşam döngüsü", () => {
  it("normal bir yanıtta başarılı olur", async () => {
    const ctx = createMockContext()
    const result = await httpRequestTool.execute({ url: "https://example.com", timeout: 5000 }, ctx)

    expect(result.error).toBeUndefined()
    const body = JSON.parse(result.output)
    expect(body.status).toBe(200)
    expect(body.body.ok).toBe(true)
    expect(typeof body.timing_ms).toBe("number")
  })

  it("sadece header değil, takılan gövde için de timeout uygular", async () => {
    scenario = "hang-body"
    const ctx = createMockContext()
    const result = await httpRequestTool.execute({ url: "https://example.com", timeout: 30 }, ctx)

    expect(result.error).toMatch(/timed out after 30ms/)
  })

  it("istek ortasında parent signal iptal edilirse hemen durur", async () => {
    scenario = "pending-fetch"
    const parent = new AbortController()
    const ctx = createMockContext({ signal: parent.signal })

    const promise = httpRequestTool.execute({ url: "https://example.com", timeout: 30000 }, ctx)
    await new Promise((r) => setTimeout(r, 5))
    parent.abort()
    const result = await promise

    expect(result.error).toBe("Request cancelled")
  })

  it("zaten iptal edilmiş bir context ile devam etmeyi reddeder", async () => {
    const parent = new AbortController()
    parent.abort()
    const ctx = createMockContext({ signal: parent.signal })

    const result = await httpRequestTool.execute({ url: "https://example.com", timeout: 30000 }, ctx)

    expect(result.error).toBe("Request cancelled")
  })

  it("sıradan fetch hatalarını timeout/iptalden ayrı raporlar", async () => {
    scenario = "fetch-error"
    const ctx = createMockContext()
    const result = await httpRequestTool.execute({ url: "https://example.com", timeout: 5000 }, ctx)

    expect(result.error).toBe("Request failed: network down")
  })

  it("parent-abort dinleyicisini her kod yolunda temizler", async () => {
    for (const s of ["success", "hang-body", "pending-fetch", "fetch-error"] as Scenario[]) {
      scenario = s
      const parent = new AbortController()
      let addCount = 0
      let removeCount = 0
      const realAdd = parent.signal.addEventListener.bind(parent.signal)
      const realRemove = parent.signal.removeEventListener.bind(parent.signal)
      parent.signal.addEventListener = (...a: Parameters<typeof realAdd>) => { addCount++; return realAdd(...a) }
      parent.signal.removeEventListener = (...a: Parameters<typeof realRemove>) => { removeCount++; return realRemove(...a) }

      const ctx = createMockContext({ signal: parent.signal })
      const promise = httpRequestTool.execute({ url: "https://example.com", timeout: 30 }, ctx)
      if (s === "pending-fetch") {
        await new Promise((r) => setTimeout(r, 5))
        parent.abort()
      }
      await promise

      expect(removeCount).toBe(addCount)
    }
  })
})
