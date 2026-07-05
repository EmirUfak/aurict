/**
 * Remote — event codec (mobil `mobile_remote_event_codec.dart`'ın TS eşi).
 *
 * Backend veri düzlemini görmez ("dataPlane: peer_to_peer") — bu event'ler yalnızca
 * P2P veri kanalı (Workstream D) üzerinden akar. Sözleşme birebir aynı olmalı:
 *   signingPayload = JSON.stringify({sessionId, seq, timestamp, senderDeviceId, type, payload})
 *   (alan SIRASI sabit — karşı taraf aynı sırayla yeniden üretip imzayı doğrular)
 */

export const RemoteEventTypes = {
  promptSubmit:       "prompt.submit",
  terminalOutput:     "terminal.output",
  agentStatus:        "agent.status",
  toolCall:           "tool.call",
  toolResultSummary:  "tool.result.summary",
  interrupt:          "interrupt",
  resume:             "resume",
  heartbeat:          "heartbeat",
  close:              "close",
  error:              "error",
  // İzin köprüsü (Workstream E) — backend protokolünde yok, P2P app-layer serbest.
  permissionRequest:  "permission.request",
  permissionResponse: "permission.response",
} as const

export type RemoteEventType = (typeof RemoteEventTypes)[keyof typeof RemoteEventTypes]

export interface RemoteEvent {
  sessionId:      string
  seq:            number
  timestamp:      string  // ISO-8601 UTC
  senderDeviceId: string
  type:           string
  payload:        Record<string, unknown>
  signature:      string
}

type UnsignedEvent = Omit<RemoteEvent, "signature">

/** Alan sırası mobille aynı olmalı — bu string doğrudan imzalanır/doğrulanır. */
export function signingPayload(event: UnsignedEvent): string {
  return JSON.stringify({
    sessionId:      event.sessionId,
    seq:            event.seq,
    timestamp:      event.timestamp,
    senderDeviceId: event.senderDeviceId,
    type:           event.type,
    payload:        event.payload,
  })
}

export class RemoteEventLedger {
  private outgoingSeq = 0
  private incomingSeq = 0

  get lastSequence(): number {
    return Math.max(this.outgoingSeq, this.incomingSeq)
  }

  get currentOutgoingSeq(): number { return this.outgoingSeq }
  get currentIncomingSeq(): number { return this.incomingSeq }

  async createSigned(opts: {
    sessionId:      string
    senderDeviceId: string
    type:           string
    payload:        Record<string, unknown>
    sign:           (payload: string) => Promise<string>
  }): Promise<RemoteEvent> {
    const nextSeq = this.outgoingSeq + 1
    const unsigned: UnsignedEvent = {
      sessionId:      opts.sessionId,
      seq:            nextSeq,
      timestamp:      new Date().toISOString(),
      senderDeviceId: opts.senderDeviceId,
      type:           opts.type,
      payload:        opts.payload,
    }
    const signature = await opts.sign(signingPayload(unsigned))
    this.outgoingSeq = nextSeq
    return { ...unsigned, signature }
  }

  /** Monotonik sıra korunur — eski/tekrar eden event'i reddeder (replay koruması). */
  acceptIncoming(event: RemoteEvent): boolean {
    if (event.seq <= this.incomingSeq) return false
    this.incomingSeq = event.seq
    return true
  }

  restore(opts: { outgoingSeq?: number; incomingSeq?: number }): void {
    if (opts.outgoingSeq !== undefined) this.outgoingSeq = opts.outgoingSeq
    if (opts.incomingSeq !== undefined) this.incomingSeq = opts.incomingSeq
  }
}
