import { ensureAccessToken } from "../../remote/auth.js";
import { RemoteApiError } from "../../remote/backend-client.js";
import { homedir } from "node:os";
import { join } from "node:path";

export const PERMISSION_STORE_FILE = join(
  homedir(),
  ".aurict",
  "permissions.json",
);

export function configuredSandboxBackend(): "none" | "policy" | "docker" {
  const raw =
    process.env["AURICT_SANDBOX_BACKEND"] ?? process.env["AURICT_SANDBOX"];
  if (raw === "none" || raw === "off" || raw === "false" || raw === "0") {
    return "none";
  }
  if (raw === "docker") return "docker";
  return "policy";
}

/** Resolve the backend token only when a remote operation needs it. */
export async function resolveBackendAccessToken(
  signal: AbortSignal,
): Promise<string | undefined> {
  try {
    return await ensureAccessToken(signal);
  } catch (error) {
    if (error instanceof RemoteApiError && error.code === "not_signed_in") {
      return undefined;
    }
    throw error;
  }
}
