/**
 * Remote — event codec (TS counterpart of mobile's `mobile_remote_event_codec.dart`).
 *
 * The backend never sees the data plane ("dataPlane: peer_to_peer") — these
 * events only flow over the P2P data channel (Workstream D). The contract
 * must be identical:
 *   signingPayload = JSON.stringify({sessionId, seq, timestamp, senderDeviceId, type, payload})
 *   (field ORDER is fixed — the other side reproduces it in the same order to verify the signature)
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
  // Permission bridge (Workstream E) — not in the backend protocol, free-form P2P app-layer.
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

/** Field order must match mobile exactly — this string is signed/verified directly. */
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

  /** Preserves a monotonic sequence — rejects old/duplicate events (replay protection). */
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
