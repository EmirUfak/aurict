/**
 * Remote — CLI transport arayüzü (offerer).
 *
 * Mobildeki `MobileRemoteTransport`/`MockMobileRemoteTransport` (mobile_remote_transport.dart)
 * ile aynı sözleşme deseninin CLI/offerer tarafı: runtime (Workstream C) bu arayüze karşı
 * yazılır, gerçek WebRTC implementasyonu (Workstream D → `webrtc-transport.ts`, `werift`
 * bağımlılığı) bunu implemente eder. Bu sayede signaling+session akışı, gerçek P2P kanalı
 * beklemeden uçtan uca test edilebilir.
 *
 * Bilinçli dosya ayrımı: gerçek implementasyon `werift`'i import ettiği için AYRI bir dosyada
 * (`webrtc-transport.ts`) tutulur ve yalnızca gerçek bir oturum başlatılırken `import()` ile
 * lazy yüklenir — bu dosya (ve onu import eden `runtime.ts`/`identity.ts`/`auth.ts` zinciri)
 * remote control hiç kullanılmasa bile `werift`'i CLI'nin varsayılan başlangıç yoluna sokmaz
 * (codebase'in `/remote`, `/crashes` gibi komutlarda zaten kullandığı lazy-import deseniyle aynı).
 */

export interface SignalEnvelope {
  version:                1
  sessionProtocolVersion: 1
  type:                   "offer" | "answer"
  transport:              "webrtc" | "tunnel" | "lan"
  payload:                string
  signingKeyFingerprint:  string
  signature:              string
}

/** Standart WebRTC ICE server şekli — werift'in `RTCIceServer`'ıyla uyumlu (`urls` TEKİL string). */
export interface IceServer {
  urls:        string
  username?:   string
  credential?: string
}

export interface CliRemoteTransport {
  /** Yerel offer (SDP) üretir ve imzalı signal envelope olarak döner. */
  createOffer(opts: {
    signingKeyFingerprint: string
    sign:                  (payload: string) => Promise<string>
    iceServers?:           IceServer[]
  }): Promise<SignalEnvelope>

  /** Backend'den gelen imzalı answer'ı uygular (remote description). */
  applyAnswer(answer: SignalEnvelope): Promise<void>

  /** Veri kanalı açıldığında (P2P bağlantı kullanıma hazır) tetiklenir. */
  onChannelOpen(handler: () => void): void

  /** Karşı taraftan gelen ham mesaj (JSON string — event-codec ile çözülür). */
  onMessage(handler: (data: string) => void): void

  /** Açık kanaldan ham mesaj gönderir; kanal henüz açılmadıysa açılınca gönderilmek üzere kuyruklanır. */
  send(data: string): void

  close(): Promise<void>
}

/**
 * Workstream D'ye kadar yer tutucu — gerçek SDP/ICE/veri kanalı yok, yalnızca runtime'ın
 * imzalama + sinyalleşme akışını (session oluşturma, poll, answer uygulama,
 * heartbeat/close) uçtan uca doğrulanabilir kılar. Mobildeki
 * `MockMobileRemoteTransport`'un CLI/offerer eşi.
 */
export class MockCliRemoteTransport implements CliRemoteTransport {
  async createOffer(opts: {
    signingKeyFingerprint: string
    sign: (payload: string) => Promise<string>
  }): Promise<SignalEnvelope> {
    const payload = JSON.stringify({
      kind:      "aurict.cli.remote.placeholder-offer",
      createdAt: new Date().toISOString(),
    })
    return {
      version:                1,
      sessionProtocolVersion: 1,
      type:                   "offer",
      transport:              "webrtc",
      payload,
      signingKeyFingerprint:  opts.signingKeyFingerprint,
      signature:              await opts.sign(payload),
    }
  }

  async applyAnswer(): Promise<void> {
    // no-op — gerçek remote description uygulaması Workstream D'de.
  }

  onChannelOpen(): void {
    // no-op — gerçek kanal yok
  }

  onMessage(): void {
    // no-op
  }

  send(): void {
    // no-op — gönderilecek gerçek bir kanal yok
  }

  async close(): Promise<void> {
    // no-op
  }
}
