/**
 * Remote — real WebRTC transport (offerer), using `werift` (pure TypeScript,
 * no native bindings).
 *
 * Replaces `MockCliRemoteTransport`: a real `RTCPeerConnection` + data
 * channel ("aurict-remote"). Verified (see an out-of-project probe): on Bun
 * 1.3.12, two werift `RTCPeerConnection`s can exchange SDP/ICE, open a data
 * channel, and exchange messages.
 *
 * Signaling payload contract (defined in this project): the `payload` field
 * is the **raw SDP text** (no JSON wrapper) — the backend's schema,
 * `payload: z.string().min(16).max(128_000)`, only expects an opaque
 * string; the transport type determines the structure.
 *
 * Non-trickle ICE: since signaling is REST/poll-based (no live socket), all
 * ICE candidate info is embedded directly in the offer/answer SDP — after
 * `setLocalDescription`, we wait until ICE gathering completes, then read
 * the SDP from `pc.localDescription.sdp` (NOT from the SDP returned by the
 * initial `createOffer()` call — that's a snapshot taken before gathering starts).
 */

import { RTCPeerConnection, type RTCDataChannel } from "werift"
import type { CliRemoteTransport, SignalEnvelope, IceServer } from "./transport.js"
import { requireIceCandidates, waitForIceGatheringComplete } from "./ice-gathering.js"

const DATA_CHANNEL_LABEL     = "aurict-remote"
const ICE_GATHER_TIMEOUT_MS  = 8000
const DEFAULT_ICE_SERVERS: IceServer[] = [{ urls: "stun:stun.l.google.com:19302" }]

export class WebRtcCliTransport implements CliRemoteTransport {
  private pc:      RTCPeerConnection | null = null
  private channel: RTCDataChannel | null    = null
  private readonly openHandlers    = new Set<() => void>()
  private readonly messageHandlers = new Set<(data: string) => void>()
  // Messages we tried to send before the channel opened — sent in order once it opens.
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
    await waitForIceGatheringComplete(pc, ICE_GATHER_TIMEOUT_MS)
    const sdp = pc.localDescription!.sdp
    requireIceCandidates(sdp)

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
