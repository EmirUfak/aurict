import { cookies, headers } from "next/headers"
import { NextResponse } from "next/server"

const ACCESS_COOKIE = "aurict_access"
const REFRESH_COOKIE = "aurict_refresh"
const TOKEN_TYPE = "Bearer"
const ACCESS_MAX_AGE_SECONDS = 15 * 60
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

type BackendError = {
  ok: false
  error: {
    code: string
    message: string
    requestId?: string
    issues?: Array<{ path: string; message: string }>
  }
}

type AuthPayload = {
  ok: true
  accessToken: string
  refreshToken: string
  tokenType?: typeof TOKEN_TYPE
}

export type BackendResult<T> = (T & { ok: true }) | BackendError

export function backendBaseUrl() {
  return process.env.AURICT_API_URL ?? "https://api.aurict.com"
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function normalizeUserCode(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase()
}

export function safeAuthError(result: BackendError, fallback = "Authentication failed.") {
  return {
    ok: false,
    error: {
      code: result.error?.code ?? "auth_error",
      message: result.error?.message ?? fallback,
      issues: result.error?.issues,
    },
  }
}

export function jsonError(message: string, status: number, code = "bad_request") {
  return NextResponse.json({ ok: false, error: { code, message } }, { status })
}

export async function readJsonBody<T extends object>(request: Request): Promise<T | undefined> {
  try {
    const body = await request.json()
    if (!body || typeof body !== "object") return undefined
    return body as T
  } catch {
    return undefined
  }
}

export async function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return true

  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host")
  const proto = headerList.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http")
  if (!host) return false

  const allowed = new Set([`${proto}://${host}`])
  for (const value of [process.env.NEXT_PUBLIC_SITE_URL, process.env.AURICT_WEB_URL]) {
    if (!value) continue
    try {
      allowed.add(new URL(value).origin)
    } catch {
      continue
    }
  }

  return allowed.has(origin)
}

export async function backendRequest<T>(
  path: string,
  init: RequestInit & { accessToken?: string; bodyJson?: unknown } = {},
): Promise<{ status: number; body: BackendResult<T> }> {
  const requestHeaders = new Headers(init.headers)
  requestHeaders.set("accept", "application/json")
  if (init.bodyJson !== undefined) requestHeaders.set("content-type", "application/json")
  if (init.accessToken) requestHeaders.set("authorization", `${TOKEN_TYPE} ${init.accessToken}`)

  let response: Response
  try {
    response = await fetch(new URL(path, backendBaseUrl()), {
      ...init,
      headers: requestHeaders,
      body: init.bodyJson === undefined ? init.body : JSON.stringify(init.bodyJson),
      cache: "no-store",
    })
  } catch {
    return {
      status: 503,
      body: {
        ok: false,
        error: {
          code: "backend_unavailable",
          message: "Authentication service is unavailable.",
        },
      },
    }
  }

  const body = await response.json().catch(() => ({
    ok: false,
    error: { code: "invalid_backend_response", message: "Backend returned an invalid response." },
  }))

  return { status: response.status, body: body as BackendResult<T> }
}

export function setAuthCookies(response: NextResponse, payload: AuthPayload) {
  const secure = process.env.NODE_ENV === "production"
  response.cookies.set(ACCESS_COOKIE, payload.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE_SECONDS,
  })
  response.cookies.set(REFRESH_COOKIE, payload.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_MAX_AGE_SECONDS,
  })
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 })
  response.cookies.set(REFRESH_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 })
}

export async function currentAccessToken() {
  const cookieStore = await cookies()
  return cookieStore.get(ACCESS_COOKIE)?.value
}

export async function currentRefreshToken() {
  const cookieStore = await cookies()
  return cookieStore.get(REFRESH_COOKIE)?.value
}

export async function refreshAuthCookies() {
  const refreshToken = await currentRefreshToken()
  if (!refreshToken) return undefined

  const result = await backendRequest<AuthPayload>("/auth/refresh", {
    method: "POST",
    bodyJson: { refreshToken },
  })

  if (!result.body.ok) return undefined
  const response = NextResponse.json({ ok: true })
  setAuthCookies(response, result.body)
  return { response, accessToken: result.body.accessToken }
}

export async function authProxyResponse<T>(
  path: string,
  init: RequestInit & { bodyJson?: unknown } = {},
) {
  const accessToken = await currentAccessToken()
  const first = await backendRequest<T>(path, { ...init, accessToken })
  if (first.status !== 401) return first

  const refreshed = await refreshAuthCookies()
  if (!refreshed) return first

  const second = await backendRequest<T>(path, { ...init, accessToken: refreshed.accessToken })
  return { ...second, refreshedResponse: refreshed.response }
}
