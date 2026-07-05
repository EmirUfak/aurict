/**
 * Remote — tarayıcı tabanlı cihaz girişi (device authorization grant).
 *
 * Akış (`gh auth login` ile aynı desen, backend: apps/backend/src/routes/auth.ts):
 *   1. POST /auth/device/start → deviceCode + kullanıcıya gösterilecek userCode + onay URL'i
 *   2. Tarayıcı açılır (best-effort); kullanıcı web/mobilden onaylar
 *   3. POST /auth/device/poll ile deviceCode periyodik sorgulanır
 *   4. Onaylanınca access/refresh token'lar alınır ve güvenli saklanır
 *
 * Bu modül CLI'yi backend'e bağlar; aynı hesapla PC + telefon girişini mümkün kılar.
 * WebRTC/cihaz-imzalama/remote-oturum katmanları sonraki workstream'lerdedir.
 */

import { backendRequest, RemoteApiError } from "./backend-client.js"
import {
  readStoredTokens, writeStoredTokens, clearStoredTokens,
  isAccessTokenExpiringSoon, type RemoteSessionTokens,
} from "./session-store.js"
import { openInBrowser } from "./browser.js"

const CLIENT_NAME  = "Aurict CLI"
// Backend'in kendi TTL'i (varsayılan 600s, env ile ayarlanabilir, en fazla 1800s)
// kaynaktır; bu yalnızca istemci tarafında makul bir üst sınırdır (saat kayması vb.).
const MAX_WAIT_MS  = 30 * 60 * 1000

export interface DeviceLoginStart {
  deviceCode:              string
  userCode:                string
  verificationUri:         string
  verificationUriComplete: string
  expiresAt:               string
  intervalSeconds:         number
}

interface DeviceLoginPollPending {
  status:           "pending"
  intervalSeconds?: number
}
interface DeviceLoginPollApproved {
  status:       "approved"
  user:         { id: string; email: string; emailVerifiedAt?: string; createdAt: string }
  accessToken:  string
  refreshToken: string
  tokenType:    "Bearer"
}
type DeviceLoginPollResult = DeviceLoginPollPending | DeviceLoginPollApproved

export type RemoteLoginPhase = "starting" | "waiting" | "polling" | "approved" | "denied" | "expired" | "error"

export interface RemoteLoginEvent {
  phase:   RemoteLoginPhase
  message: string
}

export async function startDeviceLogin(): Promise<DeviceLoginStart> {
  return backendRequest<DeviceLoginStart>("/auth/device/start", {
    method: "POST",
    body:   { clientName: CLIENT_NAME, platform: "cli" },
  })
}

export async function pollDeviceLoginOnce(deviceCode: string): Promise<DeviceLoginPollResult> {
  return backendRequest<DeviceLoginPollResult>("/auth/device/poll", {
    method: "POST",
    body:   { deviceCode },
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Tarayıcı tabanlı cihaz girişini uçtan uca yürütür. `onEvent` ile ara aşamalar
 * raporlanır (TUI bunu bir sistem mesajı olarak gösterebilir); akış tamamlanana
 * kadar (onay/ret/süre aşımı) bekler.
 */
export async function loginWithBrowser(onEvent?: (event: RemoteLoginEvent) => void): Promise<{ id: string; email: string }> {
  onEvent?.({ phase: "starting", message: "Requesting device code…" })
  const start = await startDeviceLogin()
  onEvent?.({
    phase:   "waiting",
    message: `Open ${start.verificationUriComplete} and approve — code ${start.userCode} (also approvable from the mobile app).`,
  })
  openInBrowser(start.verificationUriComplete)

  const remainingMs = Math.max(0, new Date(start.expiresAt).getTime() - Date.now())
  const deadline     = Date.now() + Math.min(MAX_WAIT_MS, remainingMs || MAX_WAIT_MS)
  let intervalMs      = Math.max(1000, start.intervalSeconds * 1000)

  while (Date.now() < deadline) {
    await sleep(intervalMs)
    let result: DeviceLoginPollResult
    try {
      result = await pollDeviceLoginOnce(start.deviceCode)
    } catch (error) {
      if (error instanceof RemoteApiError) {
        if (error.code === "access_denied") onEvent?.({ phase: "denied", message: "Login was denied." })
        else if (error.code === "device_login_expired") onEvent?.({ phase: "expired", message: "Login code expired." })
        else onEvent?.({ phase: "error", message: error.message })
      }
      throw error
    }
    if (result.status === "approved") {
      const tokens: RemoteSessionTokens = {
        accessToken:  result.accessToken,
        refreshToken: result.refreshToken,
        tokenType:    result.tokenType,
        userId:       result.user.id,
        userEmail:    result.user.email,
      }
      writeStoredTokens(tokens)
      onEvent?.({ phase: "approved", message: `Signed in as ${result.user.email}.` })
      return { id: result.user.id, email: result.user.email }
    }
    if (result.intervalSeconds) intervalMs = Math.max(1000, result.intervalSeconds * 1000)
    onEvent?.({ phase: "polling", message: "Waiting for approval…" })
  }
  onEvent?.({ phase: "expired", message: "Login timed out." })
  throw new RemoteApiError("device_login_timeout", "Device login timed out waiting for approval.", "client")
}

export async function refreshAccessToken(): Promise<RemoteSessionTokens> {
  const current = readStoredTokens()
  if (!current) throw new RemoteApiError("not_signed_in", "No remote session found. Run /remote login.", "client")
  try {
    const result = await backendRequest<{ accessToken: string; refreshToken: string }>("/auth/refresh", {
      method: "POST",
      body:   { refreshToken: current.refreshToken },
    })
    const next: RemoteSessionTokens = { ...current, accessToken: result.accessToken, refreshToken: result.refreshToken }
    writeStoredTokens(next)
    return next
  } catch (error) {
    // Refresh geçersiz/yeniden-kullanım tespiti → yerel oturum ölü, temiz bir
    // yeniden girişe zorlamak için sil.
    clearStoredTokens()
    throw error
  }
}

/** Geçerli (gerekirse yenilenmiş) access token döner; oturum yoksa fırlatır. */
export async function ensureAccessToken(): Promise<string> {
  const current = readStoredTokens()
  if (!current) throw new RemoteApiError("not_signed_in", "No remote session found. Run /remote login.", "client")
  if (isAccessTokenExpiringSoon(current.accessToken)) {
    const refreshed = await refreshAccessToken()
    return refreshed.accessToken
  }
  return current.accessToken
}

export interface RemoteAuthStatus {
  signedIn: boolean
  email?:   string
}

export async function getAuthStatus(): Promise<RemoteAuthStatus> {
  const current = readStoredTokens()
  if (!current) return { signedIn: false }
  try {
    const accessToken = await ensureAccessToken()
    const me = await backendRequest<{ user: { id: string; email: string } }>("/auth/me", { accessToken })
    return { signedIn: true, email: me.user.email }
  } catch {
    return { signedIn: false }
  }
}

export async function logout(): Promise<void> {
  const current = readStoredTokens()
  clearStoredTokens()
  if (!current) return
  try {
    await backendRequest("/auth/logout", { method: "POST", body: { refreshToken: current.refreshToken } })
  } catch {
    // best-effort — yerel oturum zaten silindi
  }
}
