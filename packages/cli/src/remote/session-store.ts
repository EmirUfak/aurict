/**
 * Remote — auth token'larının yerel saklanması.
 *
 * Cihaz imzalama anahtarları (Ed25519) ayrı bir dosyada tutulacak (bkz. plan
 * Workstream B); bu dosya yalnızca backend erişim/yenileme token'larını kapsar.
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

/** JWT'nin ikinci (payload) segmentini çözüp `exp` claim'ini (epoch saniye) döner. */
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

/** exp bilinmiyorsa (parse hatası) güvenli taraf: "süresi dolmak üzere" say — yenilemeye zorla. */
export function isAccessTokenExpiringSoon(token: string, bufferSeconds = 60): boolean {
  const exp = decodeJwtExpirySeconds(token)
  if (exp === null) return true
  return exp - bufferSeconds <= Math.floor(Date.now() / 1000)
}
