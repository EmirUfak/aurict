import { NextResponse } from "next/server"
import { assertSameOrigin, clearAuthCookies, jsonError, refreshAuthCookies } from "@/lib/auth/server"

export async function POST(request: Request) {
  if (!(await assertSameOrigin(request))) return jsonError("Invalid request origin.", 403, "invalid_origin")
  const refreshed = await refreshAuthCookies()
  if (!refreshed) {
    const response = NextResponse.json({ ok: false, error: { code: "invalid_refresh", message: "Session expired." } }, { status: 401 })
    clearAuthCookies(response)
    return response
  }
  return refreshed.response
}
