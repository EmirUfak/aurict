import { NextResponse } from "next/server"
import { assertSameOrigin, backendRequest, clearAuthCookies, currentRefreshToken } from "@/lib/auth/server"

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true })
  clearAuthCookies(response)

  if (!(await assertSameOrigin(request))) return response

  const refreshToken = await currentRefreshToken()
  if (refreshToken) {
    await backendRequest("/auth/logout", {
      method: "POST",
      bodyJson: { refreshToken },
    }).catch(() => undefined)
  }

  return response
}
