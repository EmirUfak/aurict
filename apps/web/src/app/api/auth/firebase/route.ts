import { NextResponse } from "next/server"
import { assertSameOrigin, backendRequest, jsonError, readJsonBody, safeAuthError, setAuthCookies } from "@/lib/auth/server"

type AuthResponse = { accessToken: string; refreshToken: string; tokenType: "Bearer" }

export async function POST(request: Request) {
  if (!(await assertSameOrigin(request))) return jsonError("Invalid request origin.", 403, "invalid_origin")
  const body = await readJsonBody<{ idToken?: unknown }>(request)
  if (typeof body?.idToken !== "string") return jsonError("Firebase ID token is required.", 400)
  if (!body.idToken || body.idToken.length > 8192) return jsonError("Firebase ID token is invalid.", 400)

  const result = await backendRequest<AuthResponse>("/auth/firebase", {
    method: "POST",
    bodyJson: { idToken: body.idToken },
  })
  if (!result.body.ok) return NextResponse.json(safeAuthError(result.body, "Provider login failed."), { status: result.status })

  const response = NextResponse.json({ ok: true }, { status: result.status === 201 ? 201 : 200 })
  setAuthCookies(response, result.body)
  return response
}
