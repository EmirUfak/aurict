/**
 * Remote — CLI oturum çalışma zamanı (offerer).
 *
 * Mobildeki `MobileRemoteRuntime` (mobile_remote_runtime.dart) ile aynı desen,
 * ama CLI **offer üreten taraf**: cihaz kimliği hazırla → offer imzala →
 * `/remote/sessions` oluştur → telefon kabul edene kadar poll et → answer'ı
 * transport'a uygula → `connected`. Bağlı kaldığı sürece heartbeat atar.
 *
 * Önemli: `GET /remote/sessions/:id` (plain poll) backend'de `assertRemoteOpen`
 * çağırmaz — yalnızca `accept`/`resume`/`heartbeat` route'ları süresi geçmiş bir
 * oturumu DB'de "expired"e çevirir. Bu yüzden pasif poll sırasında sunucudaki
 * `status` alanı süresi geçmiş olsa bile "available" kalabilir; süre aşımı
 * `expiresAt` istemci tarafında ayrıca kontrol edilerek yakalanır.
 */

import { backendRequest, RemoteApiError } from "./backend-client.js"
import { ensureAccessToken } from "./auth.js"
import { ensureDeviceIdentity, signWithStoredIdentity } from "./identity.js"
import { type CliRemoteTransport, type SignalEnvelope, type IceServer, MockCliRemoteTransport } from "./transport.js"
import { RemoteEventLedger, type RemoteEvent } from "./event-codec.js"

interface TurnCredential {
  urls:        string[]
  username:    string
  credential:  string
  expiresAt:   string
}

/** Backend'in `urls: string[]` credential'ını werift'in TEKİL `urls: string` beklediği
 *  ICE server listesine çevirir — bir credential birden fazla TURN URI'sini kapsayabilir. */
function toIceServers(credential: TurnCredential): IceServer[] {
  return credential.urls.map((urls) => ({ urls, username: credential.username, credential: credential.credential }))
}

export type CliRemoteStatus =
  | "signedOut"
  | "registeringDevice"
  | "creatingSession"
  | "waitingForPhone"
  | "connected"
  | "expired"
  | "closed"
  | "error"

export interface RemoteSessionPublic {
  id:                  string
  desktopDeviceId:     string
  protocolVersion:     number
  status:              string
  connectionMode:      "webrtc" | "tunnel" | "lan"
  signedOffer:         SignalEnvelope
  acceptedByDeviceId?: string
  signedAnswer?:       SignalEnvelope
  resumeAvailable:     boolean
  lastSequence:        number
  maxIdleSeconds:      number
  expiresAt:           string
  lastHeartbeatAt:     string
  createdAt:           string
  acceptedAt?:         string
  closedAt?:           string
}

export interface StartOptions {
  ttlSeconds?:     number
  pollIntervalMs?: number
}

const DEFAULT_TTL_SECONDS      = 300
const DEFAULT_POLL_INTERVAL_MS = 3000
const HEARTBEAT_INTERVAL_MS    = 20_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isSessionExpired(session: RemoteSessionPublic): boolean {
  return session.status === "expired" || new Date(session.expiresAt).getTime() <= Date.now()
}

export class CliRemoteRuntime {
  private readonly transport: CliRemoteTransport
  private status: CliRemoteStatus = "signedOut"
  private session: RemoteSessionPublic | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private cancelled = false
  private readonly listeners = new Set<(status: CliRemoteStatus) => void>()
  // Ajan köprüsü (Workstream E): mobildeki `MobileRemoteRuntime.createPromptEvent`
  // deseninin aynısı — runtime, event ledger'ı doğrudan sahiplenir.
  private readonly ledger = new RemoteEventLedger()
  private deviceId: string | null = null
  private readonly eventListeners = new Set<(event: RemoteEvent) => void>()

  constructor(opts?: { transport?: CliRemoteTransport }) {
    this.transport = opts?.transport ?? new MockCliRemoteTransport()
    this.transport.onMessage((raw) => this.handleRawMessage(raw))
  }

  getStatus(): CliRemoteStatus { return this.status }
  getSession(): RemoteSessionPublic | null { return this.session }

  onStatusChange(fn: (status: CliRemoteStatus) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private setStatus(next: CliRemoteStatus): void {
    this.status = next
    for (const fn of this.listeners) fn(next)
  }

  /** Karşı taraftan (telefon) gelen olayları dinler — `prompt.submit`, `interrupt`,
   *  `permission.response` vb. Ajan köprüsü (App.tsx) bunu tüketir. */
  onEvent(handler: (event: RemoteEvent) => void): () => void {
    this.eventListeners.add(handler)
    return () => this.eventListeners.delete(handler)
  }

  private handleRawMessage(raw: string): void {
    let event: RemoteEvent
    try {
      event = JSON.parse(raw) as RemoteEvent
    } catch {
      return  // bozuk mesaj — P2P app-layer serbest, backend zaten doğrulamıyor, sessizce yut
    }
    if (!this.ledger.acceptIncoming(event)) return  // replay/eski sıra — yut
    for (const fn of this.eventListeners) fn(event)
  }

  /**
   * Ajan olaylarını (terminal.output/tool.call/.../permission.request) telefona
   * yayınlar. Bağlı değilken (henüz `start()` çağrılmadı veya kapatıldı) sessizce
   * no-op — çağıran taraf remote aktif olsun olmasın aynı kod yolunu kullanabilir.
   */
  async publish(type: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.deviceId || this.status !== "connected" || !this.session) return
    const event = await this.ledger.createSigned({
      sessionId:      this.session.id,
      senderDeviceId: this.deviceId,
      type,
      payload,
      sign: (p) => signWithStoredIdentity(p),
    })
    this.transport.send(JSON.stringify(event))
  }

  /**
   * Offer oluşturur, oturumu backend'de açar ve telefon kabul edene kadar bekler.
   * Kabul edilince transport'a answer uygulanır ve heartbeat döngüsü başlar.
   */
  async start(opts: StartOptions = {}): Promise<RemoteSessionPublic> {
    this.cancelled = false
    this.setStatus("registeringDevice")
    const identity = await ensureDeviceIdentity()
    this.deviceId = identity.deviceId

    const iceServers = await this.preflightTurn(identity.deviceId)

    this.setStatus("creatingSession")
    const offer = await this.transport.createOffer({
      signingKeyFingerprint: identity.signingKeyFingerprint,
      sign: (payload) => signWithStoredIdentity(payload),
      ...(iceServers ? { iceServers } : {}),
    })

    const accessToken = await ensureAccessToken()
    const created = await backendRequest<{ session: RemoteSessionPublic }>("/remote/sessions", {
      method: "POST",
      accessToken,
      body: {
        desktopDeviceId: identity.deviceId,
        connectionMode:  "webrtc",
        signedOffer:     offer,
        ttlSeconds:      opts.ttlSeconds ?? DEFAULT_TTL_SECONDS,
      },
    })
    this.session = created.session
    this.setStatus("waitingForPhone")

    const accepted = await this.pollUntilAccepted(created.session.id, opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS)
    this.session = accepted
    await this.transport.applyAnswer(accepted.signedAnswer!)
    this.setStatus("connected")
    this.startHeartbeat(identity.deviceId)
    return accepted
  }

  /**
   * TURN kimlik bilgisini alır ve werift'in beklediği ICE server listesine çevirir.
   * Yapılandırılmamışsa (`turn_not_configured`) `undefined` döner — transport kendi
   * varsayılan STUN sunucusuna sessizce düşer (cross-network bağlantı bu durumda
   * yalnızca doğrudan/host-erişilebilir ağlarda çalışır).
   */
  private async preflightTurn(deviceId: string): Promise<IceServer[] | undefined> {
    try {
      const accessToken = await ensureAccessToken()
      const result = await backendRequest<{ credential: TurnCredential }>(
        "/remote/turn-credentials", { method: "POST", accessToken, body: { deviceId } },
      )
      return toIceServers(result.credential)
    } catch (error) {
      if (error instanceof RemoteApiError && error.code === "turn_not_configured") return undefined
      throw error
    }
  }

  private async pollUntilAccepted(sessionId: string, intervalMs: number): Promise<RemoteSessionPublic> {
    while (!this.cancelled) {
      await sleep(intervalMs)
      const accessToken = await ensureAccessToken()
      const result  = await backendRequest<{ session: RemoteSessionPublic }>(`/remote/sessions/${sessionId}`, { accessToken })
      const session = result.session

      if (isSessionExpired(session)) {
        this.setStatus("expired")
        throw new RemoteApiError("remote_expired", "Remote session expired before the phone accepted it.", "client")
      }
      if (session.status === "closed") {
        this.setStatus("closed")
        throw new RemoteApiError("remote_closed", "Remote session was closed.", "client")
      }
      if (session.status === "accepted" && session.signedAnswer) {
        return session
      }
      // "available" — telefon henüz kabul etmedi, beklemeye devam.
    }
    throw new RemoteApiError("remote_session_cancelled", "Waiting for the phone to accept was cancelled.", "client")
  }

  /** `start()` içindeki bekleme döngüsünü dışarıdan iptal eder (ör. kullanıcı Esc/Ctrl+C). */
  cancelWaiting(): void {
    this.cancelled = true
  }

  private startHeartbeat(deviceId: string): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => { void this.heartbeat(deviceId) }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null }
  }

  async heartbeat(deviceId: string): Promise<void> {
    const session = this.session
    if (!session) return
    try {
      const accessToken = await ensureAccessToken()
      const result = await backendRequest<{ session: RemoteSessionPublic }>(`/remote/sessions/${session.id}/heartbeat`, {
        method: "POST",
        accessToken,
        body: { deviceId, lastSequence: session.lastSequence },
      })
      this.session = result.session
      if (result.session.status === "expired") {
        this.setStatus("expired")
        this.stopHeartbeat()
      }
    } catch (error) {
      if (error instanceof RemoteApiError && (error.code === "remote_expired" || error.code === "remote_idle_timeout")) {
        this.setStatus("expired")
        this.stopHeartbeat()
        return
      }
      throw error
    }
  }

  /** Oturumu kapatır (backend + transport); best-effort — ağ hatası kapanışı engellemez. */
  async close(): Promise<void> {
    this.cancelled = true
    this.stopHeartbeat()
    if (this.session) {
      try {
        const accessToken = await ensureAccessToken()
        await backendRequest(`/remote/sessions/${this.session.id}/close`, { method: "POST", accessToken })
      } catch {
        // best-effort — zaten kapanıyoruz
      }
    }
    await this.transport.close()
    this.session = null
    this.deviceId = null
    this.setStatus("closed")
  }
}
