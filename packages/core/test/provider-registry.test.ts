/**
 * ProviderRegistry — verifies that dynamically `register()`-ed plugins (the
 * JS plugin loader, or user-added custom providers) surface correctly via
 * `available()` and can be removed via `unregister()`, without disturbing
 * the built-in providers' existing behavior.
 */
import { describe, it, expect, afterEach } from "bun:test"
import { ProviderRegistry } from "../src/provider/registry.js"
import { createMockProvider } from "./helpers.js"

const registeredIds: string[] = []

afterEach(() => {
  for (const id of registeredIds.splice(0)) ProviderRegistry.unregister(id)
})

describe("ProviderRegistry.available() — built-ins unaffected", () => {
  it("still lists all built-in providers with their expected ids", () => {
    const ids = ProviderRegistry.available().map((p) => p.id)
    for (const expected of ["anthropic", "openai", "openrouter", "google", "opencode", "ollama", "xai", "azure", "bedrock", "nvidia", "zai", "alibaba"]) {
      expect(ids).toContain(expected)
    }
  })

  it("ollama always reports hasKey:true (no key required)", () => {
    const ollama = ProviderRegistry.available().find((p) => p.id === "ollama")
    expect(ollama?.hasKey).toBe(true)
  })
})

describe("ProviderRegistry — dynamic registration surfaces in available()", () => {
  it("a register()-ed plugin not in the built-in list appears in available() with hasKey:true", () => {
    const id = `test-dynamic-${Date.now()}`
    registeredIds.push(id)
    ProviderRegistry.register(createMockProvider({ id, name: "Dynamic Test Provider" }))

    const entry = ProviderRegistry.available().find((p) => p.id === id)
    expect(entry).toBeDefined()
    expect(entry?.name).toBe("Dynamic Test Provider")
    expect(entry?.hasKey).toBe(true)
  })

  it("get()/has()/list() see the registered plugin", () => {
    const id = `test-dynamic-get-${Date.now()}`
    registeredIds.push(id)
    ProviderRegistry.register(createMockProvider({ id }))

    expect(ProviderRegistry.has(id)).toBe(true)
    expect(ProviderRegistry.get(id).id).toBe(id)
    expect(ProviderRegistry.list().some((p) => p.id === id)).toBe(true)
  })
})

describe("ProviderRegistry.unregister()", () => {
  it("removes a dynamically registered plugin", () => {
    const id = `test-unregister-${Date.now()}`
    ProviderRegistry.register(createMockProvider({ id }))
    expect(ProviderRegistry.has(id)).toBe(true)

    ProviderRegistry.unregister(id)
    expect(ProviderRegistry.has(id)).toBe(false)
    expect(ProviderRegistry.available().some((p) => p.id === id)).toBe(false)
  })

  it("is a no-op for an id that was never registered", () => {
    expect(() => ProviderRegistry.unregister("does-not-exist-ever")).not.toThrow()
  })
})
