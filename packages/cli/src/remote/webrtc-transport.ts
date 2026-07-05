/**
 * Remote — gerçek WebRTC transport (offerer), `werift` (saf TypeScript, native binding yok).
 *
 * `MockCliRemoteTransport`'un yerini alır: gerçek `RTCPeerConnection` + veri kanalı ("aurict-remote").
 * Doğrulandı (bkz. proje dışı probe): Bun 1.3.12 üzerinde iki werift `RTCPeerConnection`
 * SDP/ICE değişimi yapıp veri kanalı açabiliyor ve mesaj alışverişi yapabiliyor.
 *
 * Sinyalleşme payload sözleşmesi (bu projede tanımlanan): `payload` alanı **ham SDP metnidir**
 * (JSON sarmalı yok) — backend `payload: z.string().min(16).max(128_000)` şemasında yalnızca
 * opak bir string bekliyor, yapıyı transport tipi belirliyor.
 *
 * Non-trickle ICE: sinyalleşme REST/poll tabanlı olduğu için (canlı soket yok) tüm ICE aday
 * bilgisi offer/answer SDP'sine gömülü gönderilir — `setLocalDescription` sonrası ICE toplama
 * bitene kadar beklenir, SDP `pc.localDescription.sdp`'den (offer'ı üreten `createOffer()`
 * çağrısının döndürdüğü ilk SDP'den DEĞİL — o, toplama başlamadan önceki an-lık görüntüdür)
 * okunur.
 */

import { RTCPeerConnection, type RTCDataChannel } from "werift"
import type { CliRemoteTransport, SignalEnvelope, IceServer } from "./transport.js"

const DATA_CHANNEL_LABEL     = "aurict-remote"
const ICE_GATHER_TIMEOUT_MS  = 8000
const DEFAULT_ICE_SERVERS: IceServer[] = [{ urls: "stun:stun.l.google.com:19302" }]

async function waitForIceGatheringComplete(pc: RTCPeerConnection, timeoutMs = ICE_GATHER_TIMEOUT_MS): Promise<void> {
  if (pc.iceGatheringState === "complete") return
  await new Promise<void>((resolve) => {
    let settled = false
    const done = () => { if (!settled) { settled = true; resolve() } }
    pc.onicecandidate = ({ candidate }) => {
      if (candidate === undefined) done()  // standart "aday bitti" sinyali
    }
    pc.iceGatheringStateChange.subscribe((state) => { if (state === "complete") done() })
    setTimeout(done, timeoutMs)  // güvenlik ağı — kısıtlı ağlarda gathering hiç bitmeyebilir
  })
}

export class WebRtcCliTransport implements CliRemoteTransport {
  private pc:      RTCPeerConnection | null = null
  private channel: RTCDataChannel | null    = null
  private readonly openHandlers    = new Set<() => void>()
  private readonly messageHandlers = new Set<(data: string) => void>()
  // Kanal açılmadan önce gönderilmeye çalışılan mesajlar — açılınca sırayla gönderilir.
  private readonly pendingOutbox: string[] = []

  async createOffer(opts: {
    signingKeyFingerprint: string
    sign:                  (payload: string) => Promise<string>
    iceServers?:           IceServer[]
  }): Promise<SignalEnvelope> {
    const pc = new RTCPeerConnection({
      iceServers: opts.iceServers?.length ? opts.iceServers : DEFAULT_ICE_SERVERS,
    })
    this.pc = pc
    this.wireChannel(pc.createDataChannel(DATA_CHANNEL_LABEL))

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    await waitForIceGatheringComplete(pc)
    const sdp = pc.localDescription!.sdp

    return {
      version:                1,
      sessionProtocolVersion: 1,
      type:                   "offer",
      transport:              "webrtc",
      payload:                sdp,
      signingKeyFingerprint:  opts.signingKeyFingerprint,
      signature:              await opts.sign(sdp),
    }
  }

  async applyAnswer(answer: SignalEnvelope): Promise<void> {
    if (!this.pc) throw new Error("createOffer() must be called before applyAnswer().")
    await this.pc.setRemoteDescription({ type: "answer", sdp: answer.payload })
  }

  private wireChannel(channel: RTCDataChannel): void {
    this.channel = channel
    channel.onopen = () => {
      for (const raw of this.pendingOutbox.splice(0)) channel.send(raw)
      for (const handler of this.openHandlers) handler()
    }
    channel.onmessage = (event) => {
      const data = typeof event.data === "string" ? event.data : event.data.toString("utf8")
      for (const handler of this.messageHandlers) handler(data)
    }
  }

  onChannelOpen(handler: () => void): void {
    this.openHandlers.add(handler)
  }

  onMessage(handler: (data: string) => void): void {
    this.messageHandlers.add(handler)
  }

  send(data: string): void {
    if (this.channel && this.channel.readyState === "open") {
      this.channel.send(data)
    } else {
      this.pendingOutbox.push(data)
    }
  }

  async close(): Promise<void> {
    this.channel?.close()
    if (this.pc) await this.pc.close()
    this.pc      = null
    this.channel = null
  }
}
