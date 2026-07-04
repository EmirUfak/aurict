import { NextResponse } from "next/server"
import { assertSameOrigin, authProxyResponse, clearAuthCookies, jsonError, readJsonBody, safeAuthError } from "@/lib/auth/server"

type DeleteAccountResponse = { ok: true }

export async function DELETE(request: Request) {
  if (!(await assertSameOrigin(request))) return jsonError("Invalid request origin.", 403, "invalid_origin")
  const body = await readJsonBody<Record<string, unknown>>(request)
  if (!body) return jsonError("Account deletion confirmation is required.", 400)

  const result = await authProxyResponse<DeleteAccountResponse>("/auth/account", {
    method: "DELETE",
    bodyJson: body,
  })
  const response = NextResponse.json(
    result.body.ok ? result.body : safeAuthError(result.body, "Could not delete account."),
    { status: result.status },
  )

  const errorCode = result.body.ok ? undefined : result.body.error.code
  if (result.body.ok || errorCode === "unauthorized") clearAuthCookies(response)
  if (!result.body.ok && "refreshedResponse" in result && result.refreshedResponse) {
    for (const cookie of result.refreshedResponse.cookies.getAll()) response.cookies.set(cookie)
  }
  return response
}
