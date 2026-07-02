import { NextResponse } from "next/server"
import { assertSameOrigin, backendRequest, jsonError, normalizeEmail, readJsonBody, safeAuthError, setAuthCookies } from "@/lib/auth/server"

type AuthResponse = { accessToken: string; refreshToken: string; tokenType: "Bearer" }

export async function POST(request: Request) {
  if (!(await assertSameOrigin(request))) return jsonError("Invalid request origin.", 403, "invalid_origin")
  const body = await readJsonBody<{ email?: unknown; password?: unknown }>(request)
  if (typeof body?.email !== "string" || typeof body.password !== "string") {
    return jsonError("Email and password are required.", 400)
  }
  const email = normalizeEmail(body.email)
  if (!email || email.length > 254) return jsonError("Email is invalid.", 400)
  if (body.password.length < 10 || body.password.length > 1024) {
    return jsonError("Password must be between 10 and 1024 characters.", 400)
  }

  const result = await backendRequest<AuthResponse>("/auth/register", {
    method: "POST",
    bodyJson: { email, password: body.password },
  })
  if (!result.body.ok) return NextResponse.json(safeAuthError(result.body, "Registration failed."), { status: result.status })

  const response = NextResponse.json({ ok: true, user: { email } }, { status: 201 })
  setAuthCookies(response, result.body)
  return response
}
