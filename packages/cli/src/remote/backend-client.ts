/**
 * Remote — Aurict Backend HTTP client.
 *
 * `apps/backend` only provides the control plane (auth, device registration,
 * signaling, TURN credentials) — it never carries prompts/commands/terminal
 * output/tool results. The response contract is identical to
 * `apps/backend/src/client.ts`:
 *   { ok: true, ...T } | { ok: false, error: { code, message, requestId, issues? } }
 */

const DEFAULT_BASE_URL = "https://api.aurict.com"

export function backendBaseUrl(): string {
  return process.env["AURICT_BACKEND_URL"]?.trim() || DEFAULT_BASE_URL
}

export class RemoteApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId: string,
    public readonly issues?: Array<{ path: string; message: string }>,
  ) {
    super(message)
    this.name = "RemoteApiError"
  }
}

export interface BackendRequestOptions {
  method?:      "GET" | "POST" | "DELETE"
  body?:        unknown
  accessToken?: string
}

type ApiOk<T>  = T & { ok: true }
type ApiErr    = { ok: false; error: { code: string; message: string; requestId: string; issues?: Array<{ path: string; message: string }> } }
type ApiResult<T> = ApiOk<T> | ApiErr

export async function backendRequest<T>(path: string, options: BackendRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers["content-type"] = "application/json"
  if (options.accessToken) headers["authorization"] = `Bearer ${options.accessToken}`

  const body = options.body === undefined ? undefined : JSON.stringify(options.body)
  const request: RequestInit = {
    method: options.method ?? "GET",
    headers,
    ...(body === undefined ? {} : { body }),
  }

  let res: Response
  try {
    res = await fetch(new URL(path, backendBaseUrl()), request)
  } catch (error) {
    throw new RemoteApiError(
      "network_error",
      `Could not reach Aurict backend: ${error instanceof Error ? error.message : String(error)}`,
      "client",
    )
  }

  let json: ApiResult<T>
  try {
    json = await res.json() as ApiResult<T>
  } catch {
    throw new RemoteApiError("invalid_response", `Backend returned a non-JSON response (HTTP ${res.status}).`, "client")
  }

  if (json.ok === false) {
    throw new RemoteApiError(json.error.code, json.error.message, json.error.requestId, json.error.issues)
  }
  return json
}
