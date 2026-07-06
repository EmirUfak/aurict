/**
 * Remote — local storage of auth tokens.
 *
 * Device signing keys (Ed25519) will be kept in a separate file (see plan
 * Workstream B); this file only covers backend access/refresh tokens.
 */

import { readSecureJson, writeSecureJson, deleteSecureFile } from "./secure-store.js"

const TOKENS_FILE = "session.json"

export interface RemoteSessionTokens {
  accessToken:  string
  refreshToken: string
  tokenType:    "Bearer"
  userId?:      string
  userEmail?:   string
}

export function readStoredTokens(): RemoteSessionTokens | null {
  return readSecureJson<RemoteSessionTokens>(TOKENS_FILE)
}

export function writeStoredTokens(tokens: RemoteSessionTokens): void {
  writeSecureJson(TOKENS_FILE, tokens)
}

export function clearStoredTokens(): void {
  deleteSecureFile(TOKENS_FILE)
}

/** Decodes the JWT's second (payload) segment and returns the `exp` claim (epoch seconds). */
export function decodeJwtExpirySeconds(token: string): number | null {
  const parts = token.split(".")
  if (parts.length !== 3 || !parts[1]) return null
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8")
    const claims = JSON.parse(json) as { exp?: unknown }
    return typeof claims.exp === "number" ? claims.exp : null
  } catch {
    return null
  }
}

/** If exp is unknown (parse error), err on the safe side: treat it as "about to expire" — force a refresh. */
export function isAccessTokenExpiringSoon(token: string, bufferSeconds = 60): boolean {
  const exp = decodeJwtExpirySeconds(token)
  if (exp === null) return true
  return exp - bufferSeconds <= Math.floor(Date.now() / 1000)
}
