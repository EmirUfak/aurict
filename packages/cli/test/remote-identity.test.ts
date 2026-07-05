/**
 * Remote — Faz 2 (cihaz kimliği) testleri.
 *
 * Mock backend, gerçek `apps/backend/src/crypto/signatures.ts` doğrulama mantığını
 * (crypto.subtle.importKey("jwk",...) + verify) birebir çalıştırır — bu yüzden bu
 * testler yalnızca kanıtlanmış bir mock'u değil, üretilen anahtar/imzanın backend'in
 * GERÇEK Ed25519 doğrulama yoluyla geçtiğini kanıtlar.
 */
import { describe, it, expect, afterEach, beforeEach, mock } from "bun:test"

mock.module("../src/remote/browser.js", () => ({ openInBrowser: () => {} }))

import { writeStoredTokens, clearStoredTokens } from "../src/remote/session-store.js"
import {
  ensureDeviceIdentity, readDeviceIdentity, clearDeviceIdentity, signWithStoredIdentity,
} from "../src/remote/identity.js"

// ── Sahte backend: gerçek Ed25519 doğrulaması yapar ────────────────────────────
interface PendingDevice { publicKeyJwkStr: string; challenge: string }

function installDeviceBackendMock(opts: { failFirstRegisterWith?: string } = {}) {
  const original = globalThis.fetch
  const pending = new Map<string, PendingDevice>()
  let deviceCounter = 0
  let registerCalls = 0
  const registeredKeys: string[] = []

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input.toString())
    const body = init?.body ? JSON.parse(init.body as string) : {}

    if (url.pathname === "/devices/register" && init?.method === "POST") {
      registerCalls++
      registeredKeys.push(body.signingPublicKey)
      if (opts.failFirstRegisterWith && registerCalls === 1) {
        return new Response(JSON.stringify({
          ok: false, error: { code: opts.failFirstRegisterWith, message: "Device signing key is already registered.", requestId: "req_dup" },
        }), { status: 409 })
      }
      deviceCounter++
      const deviceId  = `dev_${deviceCounter}`
      const challenge = `chal_${deviceId}_${Math.random().toString(36).slice(2)}`
      pending.set(deviceId, { publicKeyJwkStr: body.signingPublicKey, challenge })
      return new Response(JSON.stringify({
        ok: true,
        device: { id: deviceId },
        verification: { challenge, expiresAt: new Date(Date.now() + 60_000).toISOString(), algorithms: ["ed25519"] },
      }), { status: 201 })
    }

    const verifyMatch = url.pathname.match(/^\/devices\/(dev_\d+)\/verify$/)
    if (verifyMatch && init?.method === "POST") {
      const deviceId = verifyMatch[1]!
      const record = pending.get(deviceId)
      if (!record || record.challenge !== body.challenge) {
        return new Response(JSON.stringify({ ok: false, error: { code: "device_challenge_mismatch", message: "mismatch", requestId: "req_x" } }), { status: 400 })
      }
      // Gerçek kriptografik doğrulama — backend'in signatures.ts'iyle birebir aynı yol.
      const jwk = JSON.parse(record.publicKeyJwkStr)
      const key = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["verify"])
      const sigBytes = Buffer.from(body.signature, "base64url")
      const valid = await crypto.subtle.verify({ name: "Ed25519" }, key, sigBytes, new TextEncoder().encode(body.challenge))
      if (!valid) {
        return new Response(JSON.stringify({ ok: false, error: { code: "device_signature_invalid", message: "bad sig", requestId: "req_y" } }), { status: 400 })
      }
      return new Response(JSON.stringify({ ok: true, device: { id: deviceId, verifiedAt: new Date().toISOString() } }), { status: 200 })
    }

    throw new Error(`unexpected request: ${init?.method ?? "GET"} ${url.pathname}`)
  }) as typeof fetch

  return {
    restore: () => { globalThis.fetch = original },
    registerCallCount: () => registerCalls,
    registeredKeys,
  }
}

beforeEach(() => {
  // ensureAccessToken() (auth.ts) gerçek yoldan çağrılır — geçerli, süresi
  // yakın gelmeyen bir token sahte olarak yazılır ki /auth/refresh'e gitmesin.
  const farFuture = Math.floor(Date.now() / 1000) + 3600
  const fakeJwt = `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${Buffer.from(JSON.stringify({ exp: farFuture })).toString("base64url")}.sig`
  writeStoredTokens({ accessToken: fakeJwt, refreshToken: "rt", tokenType: "Bearer" })
})

afterEach(() => {
  clearStoredTokens()
  clearDeviceIdentity()
})

describe("identity — device registration + verification", () => {
  it("generates a real Ed25519 key, registers, and verifies against the mock backend's genuine signature check", async () => {
    const backend = installDeviceBackendMock()
    try {
      const identity = await ensureDeviceIdentity()
      expect(identity.verified).toBe(true)
      expect(identity.deviceId).toBe("dev_1")
      expect(identity.signingKeyFingerprint.startsWith("fp_")).toBe(true)
      expect(identity.encryptionPublicKey).toBe(identity.signingPublicKey)

      const jwk = JSON.parse(identity.signingPublicKey)
      expect(jwk).toMatchObject({ kty: "OKP", crv: "Ed25519", ext: true, key_ops: ["verify"] })
      expect(typeof jwk.x).toBe("string")
      expect(backend.registerCallCount()).toBe(1)
    } finally { backend.restore() }
  })

  it("persists the identity and does not hit the network on a second call", async () => {
    const backend = installDeviceBackendMock()
    try {
      const first = await ensureDeviceIdentity()
      expect(first.verified).toBe(true)
    } finally { backend.restore() }

    // İkinci çağrı: fetch hiç çağrılmamalı (yerelde doğrulanmış kimlik var).
    const original = globalThis.fetch
    globalThis.fetch = (async () => { throw new Error("should not hit the network") }) as typeof fetch
    try {
      const second = await ensureDeviceIdentity()
      expect(second.deviceId).toBe("dev_1")
      const persisted = readDeviceIdentity()
      expect(persisted?.deviceId).toBe("dev_1")
    } finally { globalThis.fetch = original }
  })

  it("retries with a fresh keypair when the backend reports device_exists (fingerprint already claimed)", async () => {
    const backend = installDeviceBackendMock({ failFirstRegisterWith: "device_exists" })
    try {
      const identity = await ensureDeviceIdentity()
      expect(identity.verified).toBe(true)
      expect(backend.registerCallCount()).toBe(2)
      // İki denemede de FARKLI anahtarlar gönderilmiş olmalı (taze keypair üretildi).
      expect(backend.registeredKeys[0]).not.toBe(backend.registeredKeys[1])
    } finally { backend.restore() }
  })

  it("signWithStoredIdentity produces signatures that verify against the stored public key", async () => {
    const backend = installDeviceBackendMock()
    let identity
    try {
      identity = await ensureDeviceIdentity()
    } finally { backend.restore() }

    const signature = await signWithStoredIdentity("arbitrary-remote-event-payload")
    const jwk = JSON.parse(identity.signingPublicKey)
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["verify"])
    const ok = await crypto.subtle.verify(
      { name: "Ed25519" }, key, Buffer.from(signature, "base64url"), new TextEncoder().encode("arbitrary-remote-event-payload"),
    )
    expect(ok).toBe(true)
  })

  it("clearDeviceIdentity removes the local identity", async () => {
    const backend = installDeviceBackendMock()
    try {
      await ensureDeviceIdentity()
    } finally { backend.restore() }
    expect(readDeviceIdentity()).not.toBeNull()
    clearDeviceIdentity()
    expect(readDeviceIdentity()).toBeNull()
  })

  it("propagates not_signed_in when there is no auth session", async () => {
    clearStoredTokens()
    await expect(ensureDeviceIdentity()).rejects.toThrow()
  })

  it("does not reuse a verified identity registered under a different account", async () => {
    const backendA = installDeviceBackendMock()
    let firstFingerprint: string
    try {
      const identity = await ensureDeviceIdentity()
      firstFingerprint = identity.signingKeyFingerprint
      expect(backendA.registerCallCount()).toBe(1)
    } finally { backendA.restore() }

    // Farklı bir hesapla giriş yapıldığını simüle et (userId değişir).
    const farFuture = Math.floor(Date.now() / 1000) + 3600
    const fakeJwt = `${Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url")}.${Buffer.from(JSON.stringify({ exp: farFuture, sub: "usr_2" })).toString("base64url")}.sig`
    writeStoredTokens({ accessToken: fakeJwt, refreshToken: "rt2", tokenType: "Bearer", userId: "usr_2", userEmail: "b@c.com" })

    const backendB = installDeviceBackendMock()
    try {
      const identity = await ensureDeviceIdentity()
      // Yeni hesap için taze bir anahtar/fingerprint üretilmeli — eskisi sessizce
      // yeniden kullanılmamalı, ve bu tek bir register çağrısıyla olmalı (device_exists
      // round-trip'i tetiklenmemeli çünkü fingerprint zaten farklı).
      expect(identity.signingKeyFingerprint).not.toBe(firstFingerprint)
      expect(backendB.registerCallCount()).toBe(1)
    } finally { backendB.restore() }
  })
})
