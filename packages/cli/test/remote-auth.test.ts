/**
 * Remote — Phase 1 (browser-based device login) tests.
 *
 * Coverage: session-store (JWT exp decoding, secure file round-trip),
 * backend-client (success/error/network-error/invalid-JSON path mapping),
 * auth (device-login orchestration: approve/deny/timeout, token refresh).
 *
 * `openInBrowser` is wired to a no-op via mock.module, since it can launch
 * a real subprocess (xdg-open/open) — tests must never open a browser.
 */
import { describe, it, expect, afterEach, mock } from "bun:test"

mock.module("../src/remote/browser.js", () => ({ openInBrowser: () => {} }))

import {
  readStoredTokens, writeStoredTokens, clearStoredTokens,
  decodeJwtExpirySeconds, isAccessTokenExpiringSoon,
} from "../src/remote/session-store.js"
import { backendBaseUrl, backendRequest, RemoteApiError } from "../src/remote/backend-client.js"
import {
  loginWithBrowser, refreshAccessToken, ensureAccessToken, getAuthStatus, logout,
  type RemoteLoginEvent,
} from "../src/remote/auth.js"

function mockFetchOnce(handler: (url: URL, init: RequestInit | undefined) => { status: number; body: unknown }) {
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input.toString())
    const { status, body } = handler(url, init)
    return new Response(JSON.stringify(body), { status })
  }) as typeof fetch
  return () => { globalThis.fetch = original }
}

function makeFakeJwt(expEpochSeconds: number): string {
  const b64url = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url")
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: "usr_1", typ: "access", iat: 0, exp: expEpochSeconds })}.sig`
}

afterEach(() => {
  clearStoredTokens()
})

describe("session-store — JWT expiry", () => {
  it("decodeJwtExpirySeconds reads the exp claim", () => {
    const exp = Math.floor(Date.now() / 1000) + 900
    expect(decodeJwtExpirySeconds(makeFakeJwt(exp))).toBe(exp)
  })

  it("decodeJwtExpirySeconds returns null for malformed tokens", () => {
    expect(decodeJwtExpirySeconds("not-a-jwt")).toBeNull()
    expect(decodeJwtExpirySeconds("a.b")).toBeNull()
    expect(decodeJwtExpirySeconds("a.!!!notbase64!!!.c")).toBeNull()
  })

  it("isAccessTokenExpiringSoon is true within the buffer window", () => {
    const soon = Math.floor(Date.now() / 1000) + 30 // 30s left, default buffer 60s
    expect(isAccessTokenExpiringSoon(makeFakeJwt(soon))).toBe(true)
  })

  it("isAccessTokenExpiringSoon is false comfortably before expiry", () => {
    const later = Math.floor(Date.now() / 1000) + 3600
    expect(isAccessTokenExpiringSoon(makeFakeJwt(later))).toBe(false)
  })

  it("isAccessTokenExpiringSoon treats unparseable tokens as expiring (safe default)", () => {
    expect(isAccessTokenExpiringSoon("garbage")).toBe(true)
  })
})

describe("session-store — secure round trip", () => {
  it("write → read → clear works and clear leaves no trace", () => {
    expect(readStoredTokens()).toBeNull()
    writeStoredTokens({ accessToken: "at", refreshToken: "rt", tokenType: "Bearer", userId: "usr_1", userEmail: "a@b.com" })
    const read = readStoredTokens()
    expect(read?.accessToken).toBe("at")
    expect(read?.userEmail).toBe("a@b.com")
    clearStoredTokens()
    expect(readStoredTokens()).toBeNull()
  })
})

describe("backend-client", () => {
  it("backendBaseUrl defaults to api.aurict.com", () => {
    const prev = process.env["AURICT_BACKEND_URL"]
    delete process.env["AURICT_BACKEND_URL"]
    try {
      expect(backendBaseUrl()).toBe("https://api.aurict.com")
    } finally {
      if (prev !== undefined) process.env["AURICT_BACKEND_URL"] = prev
    }
  })

  it("backendBaseUrl respects AURICT_BACKEND_URL override", () => {
    const prev = process.env["AURICT_BACKEND_URL"]
    process.env["AURICT_BACKEND_URL"] = "http://localhost:8787"
    try {
      expect(backendBaseUrl()).toBe("http://localhost:8787")
    } finally {
      if (prev !== undefined) process.env["AURICT_BACKEND_URL"] = prev
      else delete process.env["AURICT_BACKEND_URL"]
    }
  })

  it("resolves with the flattened payload on ok:true", async () => {
    const restore = mockFetchOnce(() => ({ status: 200, body: { ok: true, hello: "world" } }))
    try {
      const result = await backendRequest<{ hello: string }>("/ping")
      expect(result.hello).toBe("world")
    } finally { restore() }
  })

  it("throws RemoteApiError with code/message/requestId on ok:false", async () => {
    const restore = mockFetchOnce(() => ({
      status: 401,
      body: { ok: false, error: { code: "invalid_credentials", message: "nope", requestId: "req_1" } },
    }))
    try {
      await expect(backendRequest("/auth/login")).rejects.toThrow(RemoteApiError)
      try {
        await backendRequest("/auth/login")
      } catch (err) {
        expect(err).toBeInstanceOf(RemoteApiError)
        expect((err as RemoteApiError).code).toBe("invalid_credentials")
        expect((err as RemoteApiError).requestId).toBe("req_1")
      }
    } finally { restore() }
  })

  it("wraps network failures as RemoteApiError('network_error')", async () => {
    const original = globalThis.fetch
    globalThis.fetch = (async () => { throw new Error("ECONNREFUSED") }) as typeof fetch
    try {
      await backendRequest("/ping")
      throw new Error("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(RemoteApiError)
      expect((err as RemoteApiError).code).toBe("network_error")
    } finally { globalThis.fetch = original }
  })

  it("wraps non-JSON responses as RemoteApiError('invalid_response')", async () => {
    const original = globalThis.fetch
    globalThis.fetch = (async () => new Response("<html>not json</html>", { status: 502 })) as typeof fetch
    try {
      await backendRequest("/ping")
      throw new Error("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(RemoteApiError)
      expect((err as RemoteApiError).code).toBe("invalid_response")
    } finally { globalThis.fetch = original }
  })
})

describe("auth — device login orchestration", () => {
  it("approves on first poll, stores tokens, and reports waiting → approved events", async () => {
    let pollCount = 0
    const restore = mockFetchOnce((url) => {
      if (url.pathname === "/auth/device/start") {
        return {
          status: 201,
          body: {
            ok: true,
            deviceCode: "dc_1", userCode: "ABCD-1234",
            verificationUri: "https://aurict.com/activate",
            verificationUriComplete: "https://aurict.com/activate?code=ABCD-1234",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            intervalSeconds: 1,
          },
        }
      }
      if (url.pathname === "/auth/device/poll") {
        pollCount++
        return {
          status: 200,
          body: {
            ok: true, status: "approved",
            user: { id: "usr_1", email: "a@b.com", createdAt: new Date().toISOString() },
            accessToken: "at_1", refreshToken: "rt_1", tokenType: "Bearer",
          },
        }
      }
      throw new Error(`unexpected path ${url.pathname}`)
    })
    try {
      const events: RemoteLoginEvent[] = []
      const user = await loginWithBrowser((e) => events.push(e))
      expect(user.email).toBe("a@b.com")
      expect(pollCount).toBe(1)
      expect(events.map((e) => e.phase)).toEqual(["starting", "waiting", "approved"])
      const stored = readStoredTokens()
      expect(stored?.accessToken).toBe("at_1")
      expect(stored?.userEmail).toBe("a@b.com")
    } finally { restore() }
  }, 10_000)

  it("survives a transient network failure during polling and succeeds on retry", async () => {
    let pollCount = 0
    const original = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === "string" ? input : input.toString())
      if (url.pathname === "/auth/device/start") {
        return new Response(JSON.stringify({
          ok: true, deviceCode: "dc_3", userCode: "NETW-0001",
          verificationUri: "https://aurict.com/auth/device",
          verificationUriComplete: "https://aurict.com/auth/device?code=NETW-0001",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          intervalSeconds: 1,
        }), { status: 201 })
      }
      if (url.pathname === "/auth/device/poll") {
        pollCount++
        if (pollCount === 1) throw new Error("socket connection was closed unexpectedly")
        return new Response(JSON.stringify({
          ok: true, status: "approved",
          user: { id: "usr_3", email: "c@d.com", createdAt: new Date().toISOString() },
          accessToken: "at_3", refreshToken: "rt_3", tokenType: "Bearer",
        }), { status: 200 })
      }
      throw new Error(`unexpected path ${url.pathname} ${init?.method ?? ""}`)
    }) as typeof fetch
    try {
      const events: RemoteLoginEvent[] = []
      const user = await loginWithBrowser((e) => events.push(e))
      expect(user.email).toBe("c@d.com")
      expect(pollCount).toBe(2)
      expect(events.map((e) => e.phase)).toEqual(["starting", "waiting", "polling", "approved"])
    } finally { globalThis.fetch = original }
  }, 10_000)

  it("gives up after too many consecutive network failures during polling", async () => {
    let pollCount = 0
    const original = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(typeof input === "string" ? input : input.toString())
      if (url.pathname === "/auth/device/start") {
        return new Response(JSON.stringify({
          ok: true, deviceCode: "dc_4", userCode: "NETW-0002",
          verificationUri: "https://aurict.com/auth/device",
          verificationUriComplete: "https://aurict.com/auth/device?code=NETW-0002",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          intervalSeconds: 1,
        }), { status: 201 })
      }
      if (url.pathname === "/auth/device/poll") {
        pollCount++
        throw new Error("socket connection was closed unexpectedly")
      }
      throw new Error(`unexpected path ${url.pathname}`)
    }) as typeof fetch
    try {
      const events: RemoteLoginEvent[] = []
      await expect(loginWithBrowser((e) => events.push(e))).rejects.toThrow(RemoteApiError)
      expect(pollCount).toBe(5)
      expect(events.at(-1)?.phase).toBe("error")
    } finally { globalThis.fetch = original }
  }, 10_000)

  it("propagates denial as a rejected promise with a 'denied' event", async () => {
    const restore = mockFetchOnce((url) => {
      if (url.pathname === "/auth/device/start") {
        return {
          status: 201,
          body: {
            ok: true, deviceCode: "dc_2", userCode: "WXYZ-5678",
            verificationUri: "https://aurict.com/activate",
            verificationUriComplete: "https://aurict.com/activate?code=WXYZ-5678",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            intervalSeconds: 1,
          },
        }
      }
      if (url.pathname === "/auth/device/poll") {
        return { status: 403, body: { ok: false, error: { code: "access_denied", message: "Denied.", requestId: "req_2" } } }
      }
      throw new Error(`unexpected path ${url.pathname}`)
    })
    try {
      const events: RemoteLoginEvent[] = []
      await expect(loginWithBrowser((e) => events.push(e))).rejects.toThrow(RemoteApiError)
      expect(events.at(-1)?.phase).toBe("denied")
    } finally { restore() }
  }, 10_000)
})

describe("auth — token refresh", () => {
  it("ensureAccessToken throws not_signed_in when no session is stored", async () => {
    clearStoredTokens()
    await expect(ensureAccessToken()).rejects.toThrow(RemoteApiError)
  })

  it("ensureAccessToken returns the stored token without refreshing when far from expiry", async () => {
    const farFuture = makeFakeJwt(Math.floor(Date.now() / 1000) + 3600)
    writeStoredTokens({ accessToken: farFuture, refreshToken: "rt", tokenType: "Bearer" })
    let fetchCalled = false
    const original = globalThis.fetch
    globalThis.fetch = (async () => { fetchCalled = true; throw new Error("should not be called") }) as typeof fetch
    try {
      const token = await ensureAccessToken()
      expect(token).toBe(farFuture)
      expect(fetchCalled).toBe(false)
    } finally { globalThis.fetch = original }
  })

  it("ensureAccessToken refreshes when the token is expiring soon", async () => {
    const expiringSoon = makeFakeJwt(Math.floor(Date.now() / 1000) + 10)
    writeStoredTokens({ accessToken: expiringSoon, refreshToken: "rt_old", tokenType: "Bearer" })
    const restore = mockFetchOnce((url) => {
      expect(url.pathname).toBe("/auth/refresh")
      return { status: 200, body: { ok: true, accessToken: "at_new", refreshToken: "rt_new" } }
    })
    try {
      const token = await ensureAccessToken()
      expect(token).toBe("at_new")
      expect(readStoredTokens()?.refreshToken).toBe("rt_new")
    } finally { restore() }
  })

  it("refreshAccessToken clears the local session when the backend rejects the refresh token", async () => {
    writeStoredTokens({ accessToken: "at", refreshToken: "reused", tokenType: "Bearer" })
    const restore = mockFetchOnce(() => ({
      status: 401,
      body: { ok: false, error: { code: "refresh_reuse_detected", message: "reuse", requestId: "req_3" } },
    }))
    try {
      await expect(refreshAccessToken()).rejects.toThrow(RemoteApiError)
      expect(readStoredTokens()).toBeNull()
    } finally { restore() }
  })
})

describe("auth — status and logout", () => {
  it("getAuthStatus reports signedIn:false when no tokens are stored", async () => {
    clearStoredTokens()
    expect(await getAuthStatus()).toEqual({ signedIn: false })
  })

  it("getAuthStatus reports signedIn:true and the account email when /auth/me succeeds", async () => {
    const farFuture = makeFakeJwt(Math.floor(Date.now() / 1000) + 3600)
    writeStoredTokens({ accessToken: farFuture, refreshToken: "rt", tokenType: "Bearer" })
    const restore = mockFetchOnce(() => ({ status: 200, body: { ok: true, user: { id: "usr_1", email: "a@b.com" } } }))
    try {
      expect(await getAuthStatus()).toEqual({ signedIn: true, email: "a@b.com" })
    } finally { restore() }
  })

  it("logout clears local tokens even when the backend call fails", async () => {
    writeStoredTokens({ accessToken: "at", refreshToken: "rt", tokenType: "Bearer" })
    const original = globalThis.fetch
    globalThis.fetch = (async () => { throw new Error("offline") }) as typeof fetch
    try {
      await logout()
      expect(readStoredTokens()).toBeNull()
    } finally { globalThis.fetch = original }
  })
})
