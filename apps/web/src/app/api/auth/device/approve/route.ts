import { NextResponse } from "next/server"
import { assertSameOrigin, authProxyResponse, jsonError, normalizeUserCode, readJsonBody, safeAuthError } from "@/lib/auth/server"

type ApproveResponse = { status: "approved"; clientName: string; expiresAt: string }

export async function POST(request: Request) {
  if (!(await assertSameOrigin(request))) return jsonError("Invalid request origin.", 403, "invalid_origin")
  const body = await readJsonBody<{ userCode?: unknown }>(request)
  if (typeof body?.userCode !== "string") return jsonError("User code is required.", 400)
  const userCode = normalizeUserCode(body.userCode)
  if (!userCode || userCode.length > 64) return jsonError("User code is invalid.", 400)

  const result = await authProxyResponse<ApproveResponse>("/auth/device/approve", {
    method: "POST",
    bodyJson: { userCode },
  })
  const response = NextResponse.json(
    result.body.ok ? result.body : safeAuthError(result.body, "Could not approve CLI login."),
    { status: result.status },
  )
  if ("refreshedResponse" in result && result.refreshedResponse) {
    for (const cookie of result.refreshedResponse.cookies.getAll()) response.cookies.set(cookie)
  }
  return response
}
