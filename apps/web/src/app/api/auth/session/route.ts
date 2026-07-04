import { NextResponse } from "next/server"
import { authProxyResponse, clearAuthCookies } from "@/lib/auth/server"

type MeResponse = { user: { id: string; email: string; createdAt: string } }

export async function GET() {
  const result = await authProxyResponse<MeResponse>("/auth/me")

  if (result.body.ok) {
    const response = NextResponse.json({
      ok: true,
      authenticated: true,
      user: result.body.user,
    })
    if ("refreshedResponse" in result && result.refreshedResponse) {
      for (const cookie of result.refreshedResponse.cookies.getAll()) response.cookies.set(cookie)
    }
    return response
  }

  const response = NextResponse.json({
    ok: true,
    authenticated: false,
    user: null,
  })
  if (result.status === 401) clearAuthCookies(response)
  return response
}
