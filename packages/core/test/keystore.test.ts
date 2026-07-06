import { describe, it, expect } from "bun:test"
import { normalizeKeystoreKey, getKeystore, KEYSTORE_SERVICE } from "../src/security/keystore/index.js"
import { plainFile, macosKeychain, windowsCredential, linuxSecretService } from "../src/security/keystore/index.js"

describe("keystore → normalizeKeystoreKey", () => {
  it("lower-cases provider names", () => {
    expect(normalizeKeystoreKey("Anthropic")).toBe("anthropic")
    expect(normalizeKeystoreKey("OPENAI")).toBe("openai")
  })

  it("strips non a-z0-9_- chars to dash", () => {
    expect(normalizeKeystoreKey("OpenRouter/Default")).toBe("openrouter-default")
    expect(normalizeKeystoreKey("Anthropic!Default")).toBe("anthropic-default")
  })

  it("preserves underscore", () => {
    expect(normalizeKeystoreKey("OPEN_AI")).toBe("open_ai")
    expect(normalizeKeystoreKey("XAI_API_KEY")).toBe("xai_api_key")
  })
})

describe("keystore → getKeystore", () => {
  it("forced plain-file yields plainFile backend", () => {
    expect(getKeystore("plain-file")).toBe(plainFile)
  })

  it("forced backends return their respective instances", () => {
    expect(getKeystore("macos-keychain")).toBe(macosKeychain)
    expect(getKeystore("windows-credential")).toBe(windowsCredential)
    expect(getKeystore("linux-secret-service")).toBe(linuxSecretService)
  })
})

describe("keystore → platform invariant", () => {
  it("plainFile is always available regardless of platform", async () => {
    expect(await plainFile.available()).toBe(true)
  })

  it("native backends reject non-matching platforms", async () => {
    const expectNotAndroidLike = async (ok: boolean) => {
      if (process.platform !== "darwin") expect(ok).toBe(false)
    }
    expectNotAndroidLike(await macosKeychain.available())
    if (process.platform !== "win32")  expect(await windowsCredential.available()).toBe(false)
    if (process.platform !== "linux") expect(await linuxSecretService.available()).toBe(false)
  })
})

describe("keystore → service identifier", () => {
  it("KEYSTORE_SERVICE is constant 'aurict'", () => {
    expect(KEYSTORE_SERVICE).toBe("aurict")
  })
})