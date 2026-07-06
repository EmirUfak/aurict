import { describe, it, expect } from "bun:test"
import { CredentialPool, parseCredentialList } from "../src/provider/credential-pool.js"

describe("parseCredentialList", () => {
  it("splits comma-separated values and trims whitespace", () => {
    expect(parseCredentialList("key1,key2,key3")).toEqual(["key1", "key2", "key3"])
    expect(parseCredentialList(" key1 , key2 ,key3 ")).toEqual(["key1", "key2", "key3"])
  })

  it("drops empty entries", () => {
    expect(parseCredentialList("key1,,key2,")).toEqual(["key1", "key2"])
  })

  it("returns empty array for undefined/empty input", () => {
    expect(parseCredentialList(undefined)).toEqual([])
    expect(parseCredentialList("")).toEqual([])
  })
})

describe("CredentialPool → construction", () => {
  it("throws on empty key list", () => {
    expect(() => new CredentialPool([])).toThrow()
  })

  it("size() reports the number of keys", () => {
    expect(new CredentialPool(["a", "b", "c"]).size()).toBe(3)
  })
})

describe("CredentialPool → round-robin", () => {
  it("cycles through keys in order", () => {
    const pool = new CredentialPool(["a", "b", "c"])
    expect(pool.next().value).toBe("a")
    expect(pool.next().value).toBe("b")
    expect(pool.next().value).toBe("c")
    expect(pool.next().value).toBe("a")
  })

  it("single-key pool always returns the same key", () => {
    const pool = new CredentialPool(["only"])
    expect(pool.next().value).toBe("only")
    expect(pool.next().value).toBe("only")
  })
})

describe("CredentialPool → cooldown", () => {
  it("skips a key on cooldown until it expires", () => {
    let t = 1000
    const pool = new CredentialPool(["a", "b"], () => t)

    const leaseA = pool.next() // "a"
    pool.reportFailure(leaseA, "cooldown", 5000) // "a" cools down until t=6000

    expect(pool.next().value).toBe("b")
    expect(pool.next().value).toBe("b") // "a" still cooling, wraps back to "b"

    t = 6001 // "a"'s cooldown has expired
    expect(pool.next().value).toBe("a")
  })

  it("reportSuccess clears a cooldown early", () => {
    let t = 1000
    const pool = new CredentialPool(["a", "b"], () => t)

    const leaseA = pool.next() // "a"
    pool.reportFailure(leaseA, "cooldown", 999999)
    pool.reportSuccess(leaseA)

    expect(pool.next().value).toBe("b")
    expect(pool.next().value).toBe("a") // recovered immediately
  })
})

describe("CredentialPool → auth failure (permanent)", () => {
  it("permanently disables a key on auth failure", () => {
    const pool = new CredentialPool(["a", "b"])
    const leaseA = pool.next() // "a"
    pool.reportFailure(leaseA, "auth")

    expect(pool.next().value).toBe("b")
    expect(pool.next().value).toBe("b")
    expect(pool.next().value).toBe("b")
  })

  it("throws when every key is permanently disabled", () => {
    const pool = new CredentialPool(["a", "b"])
    const leaseA = pool.next()
    const leaseB = pool.next()
    pool.reportFailure(leaseA, "auth")
    pool.reportFailure(leaseB, "auth")

    expect(() => pool.next()).toThrow()
  })
})

describe("CredentialPool → all-cooling fallback", () => {
  it("falls back to the least-recently-failed key when all are cooling down", () => {
    let t = 1000
    const pool = new CredentialPool(["a", "b"], () => t)

    const leaseA = pool.next() // "a", lastFailureAt will be t=1000
    pool.reportFailure(leaseA, "cooldown", 999999)

    t = 2000
    const leaseB = pool.next() // "b", lastFailureAt will be t=2000
    pool.reportFailure(leaseB, "cooldown", 999999)

    // Both cooling; "a" failed earlier (t=1000) than "b" (t=2000) → "a" is the fallback.
    t = 2500
    expect(pool.next().value).toBe("a")
  })
})

describe("CredentialPool → lease identity", () => {
  it("reportFailure only affects the leased slot, not other keys with the same value", () => {
    const pool = new CredentialPool(["dup", "dup"])
    const lease0 = pool.next() // index 0
    pool.reportFailure(lease0, "auth")

    // index 1 ("dup") is still active
    const lease1 = pool.next()
    expect(lease1.index).toBe(1)
    expect(lease1.value).toBe("dup")
  })
})
