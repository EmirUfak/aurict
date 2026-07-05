/**
 * Faz 3A — coordinator promptunun karmaşıklık-kapılı enjeksiyon mantığı.
 */
import { describe, it, expect } from "bun:test"
import { looksMultiDimensional, shouldInjectCoordinatorPrompt } from "../src/agent/coordinator.js"

describe("looksMultiDimensional", () => {
  it("2+ farklı boyut kelimesi (security, performance) içeren metinde true döner", () => {
    expect(looksMultiDimensional("analyze this for security, performance and architecture")).toBe(true)
  })

  it("tek bir boyut kelimesi için false döner", () => {
    expect(looksMultiDimensional("check the security of this endpoint")).toBe(false)
  })

  it("'review the whole codebase' kalıbı için true döner", () => {
    expect(looksMultiDimensional("please review the whole codebase")).toBe(true)
    expect(looksMultiDimensional("audit the entire project")).toBe(true)
  })

  it("'find all X' kalıbı için true döner", () => {
    expect(looksMultiDimensional("find all unused exports")).toBe(true)
  })

  it("sıradan kısa bir mesaj için false döner", () => {
    expect(looksMultiDimensional("fix this typo")).toBe(false)
    expect(looksMultiDimensional("")).toBe(false)
  })
})

describe("shouldInjectCoordinatorPrompt", () => {
  it("complexityLevel 'complex' ise metin ne olursa olsun true döner", () => {
    expect(shouldInjectCoordinatorPrompt("hi", "complex")).toBe(true)
  })

  it("complexityLevel 'trivial'/'simple'/'moderate' iken sadece çok-boyutlu metin true döner", () => {
    expect(shouldInjectCoordinatorPrompt("fix typo", "trivial")).toBe(false)
    expect(shouldInjectCoordinatorPrompt("fix typo", "simple")).toBe(false)
    expect(shouldInjectCoordinatorPrompt("fix typo", "moderate")).toBe(false)
    expect(shouldInjectCoordinatorPrompt("analyze security, performance, architecture", "moderate")).toBe(true)
  })
})
