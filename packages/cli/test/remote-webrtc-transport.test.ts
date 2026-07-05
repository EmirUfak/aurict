/**
 * Remote — Faz 4 (gerçek WebRTC transport, `werift`) testleri.
 *
 * Gerçek iki `RTCPeerConnection` arasında SDP/ICE değişimi ve veri kanalı açılışını
 * doğrular (mock değil) — bir tarafta `WebRtcCliTransport` (offerer), diğer tarafta
 * mobilin gelecekteki gerçek answerer'ını taklit eden çıplak werift `RTCPeerConnection`.
 * Bu, `webrtc-transport.ts`'in yalnızca tip uyumlu değil, GERÇEKTEN çalıştığını kanıtlar.
 */
import { describe, it, expect, afterEach } from "bun:test"
import { RTCPeerConnection } from "werift"
import { WebRtcCliTransport } from "../src/remote/webrtc-transport.js"
import type { SignalEnvelope } from "../src/remote/transport.js"

const runningTransports: WebRtcCliTransport[] = []
const runningPeers: RTCPeerConnection[] = []

afterEach(async () => {
  for (const t of runningTransports.splice(0)) await t.close().catch(() => {})
  for (const p of runningPeers.splice(0)) await p.close().catch(() => {})
})

/** Mobilin (Workstream F) gelecekteki gerçek answerer'ını taklit eden çıplak werift peer. */
async function answerWithBarePeer(offer: SignalEnvelope): Promise<{ answer: SignalEnvelope; pc: RTCPeerConnection; channelOpened: Promise<import("werift").RTCDataChannel> }> {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] })
  runningPeers.push(pc)

  const channelOpened = new Promise<import("werift").RTCDataChannel>((resolve) => {
    pc.ondatachannel = (event) => resolve(event.channel)
  })

  await pc.setRemoteDescription({ type: "offer", sdp: offer.payload })
  const answer = await pc.createAnswer()
  await pc.setLocalDescription(answer)
  await new Promise<void>((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve()
    let settled = false
    const done = () => { if (!settled) { settled = true; resolve() } }
    pc.onicecandidate = ({ candidate }) => { if (candidate === undefined) done() }
    pc.iceGatheringStateChange.subscribe((state) => { if (state === "complete") done() })
    setTimeout(done, 8000)
  })

  const sdp = pc.localDescription!.sdp
  return {
    pc,
    channelOpened,
    answer: {
      version: 1, sessionProtocolVersion: 1, type: "answer", transport: "webrtc",
      payload: sdp, signingKeyFingerprint: "fp_mobile_bare", signature: "unsigned-test-answer",
    },
  }
}

describe("WebRtcCliTransport", () => {
  it("createOffer() returns a real, signed SDP envelope (not a JSON placeholder)", async () => {
    const transport = new WebRtcCliTransport()
    runningTransports.push(transport)
    const signed: string[] = []
    const offer = await transport.createOffer({
      signingKeyFingerprint: "fp_cli_1",
      sign: async (payload) => { signed.push(payload); return `sig(${payload.length})` },
    })
    expect(offer.type).toBe("offer")
    expect(offer.transport).toBe("webrtc")
    expect(offer.signingKeyFingerprint).toBe("fp_cli_1")
    expect(offer.payload.startsWith("v=0")).toBe(true)          // gerçek SDP, JSON değil
    expect(offer.payload).toContain("a=candidate")               // non-trickle: adaylar gömülü
    expect(offer.signature).toBe(`sig(${offer.payload.length})`)
    expect(signed[0]).toBe(offer.payload)                        // imzalanan tam olarak SDP'nin kendisi
  }, 15_000)

  it("establishes a real data channel with a bare peer answerer and exchanges messages both ways", async () => {
    const transport = new WebRtcCliTransport()
    runningTransports.push(transport)

    const offer = await transport.createOffer({
      signingKeyFingerprint: "fp_cli_1",
      sign: async (payload) => `sig(${payload.length})`,
    })

    const { answer, channelOpened } = await answerWithBarePeer(offer)
    await transport.applyAnswer(answer)

    const remoteChannel = await channelOpened
    const received: string[] = []
    remoteChannel.onmessage = (e) => {
      received.push(typeof e.data === "string" ? e.data : e.data.toString("utf8"))
      remoteChannel.send("ack-from-bare-peer")
    }

    const opened = new Promise<void>((resolve) => transport.onChannelOpen(resolve))
    await opened

    const cliReceived = new Promise<string>((resolve) => transport.onMessage(resolve))
    transport.send("hello-from-cli")

    const reply = await cliReceived
    expect(received).toEqual(["hello-from-cli"])
    expect(reply).toBe("ack-from-bare-peer")
  }, 20_000)

  it("queues send() calls made before the channel opens, and flushes them on open", async () => {
    const transport = new WebRtcCliTransport()
    runningTransports.push(transport)

    const offer = await transport.createOffer({
      signingKeyFingerprint: "fp_cli_1",
      sign: async () => "sig",
    })
    // Kanal henüz açık değil (answer uygulanmadı) — bu send() kuyruğa alınmalı, atılmamalı.
    transport.send("queued-before-open")

    const { answer, channelOpened } = await answerWithBarePeer(offer)
    await transport.applyAnswer(answer)
    const remoteChannel = await channelOpened

    const received = new Promise<string>((resolve) => {
      remoteChannel.onmessage = (e) => resolve(typeof e.data === "string" ? e.data : e.data.toString("utf8"))
    })
    expect(await received).toBe("queued-before-open")
  }, 20_000)

  it("close() tears down the peer connection without throwing", async () => {
    const transport = new WebRtcCliTransport()
    await transport.createOffer({ signingKeyFingerprint: "fp_x", sign: async () => "sig" })
    await transport.close()
    // Kapandıktan sonra applyAnswer çağrısı güvenli bir hata fırlatmalı (crash değil).
    await expect(transport.applyAnswer({
      version: 1, sessionProtocolVersion: 1, type: "answer", transport: "webrtc", payload: "v=0", signingKeyFingerprint: "x", signature: "x",
    })).rejects.toThrow()
  }, 15_000)
})
