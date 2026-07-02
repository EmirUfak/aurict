import { NextResponse } from "next/server"
import { authProxyResponse, clearAuthCookies, safeAuthError } from "@/lib/auth/server"

type MeResponse = { user: { id: string; email: string; createdAt: string } }

export async function GET() {
  const result = await authProxyResponse<MeResponse>("/auth/me")
  const response = NextResponse.json(
    result.body.ok ? result.body : safeAuthError(result.body, "Not authenticated."),
    { status: result.status },
  )

  if (!result.body.ok && result.status === 401) clearAuthCookies(response)
  if ("refreshedResponse" in result && result.refreshedResponse) {
    for (const cookie of result.refreshedResponse.cookies.getAll()) response.cookies.set(cookie)
  }
  return response
}
