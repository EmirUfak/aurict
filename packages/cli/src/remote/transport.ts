/**
 * Remote — CLI transport interface (offerer).
 *
 * The CLI/offerer side of the same contract pattern as mobile's
 * `MobileRemoteTransport`/`MockMobileRemoteTransport` (mobile_remote_transport.dart):
 * the runtime (Workstream C) is written against this interface, and the
 * real WebRTC implementation (Workstream D → `webrtc-transport.ts`, the
 * `werift` dependency) implements it. This lets the signaling+session flow
 * be tested end-to-end without needing a real P2P channel.
 *
 * Deliberate file separation: since the real implementation imports
 * `werift`, it's kept in a SEPARATE file (`webrtc-transport.ts`) and only
 * lazy-loaded via `import()` when a real session is actually started —
 * this file (and the chain of `runtime.ts`/`identity.ts`/`auth.ts` that
 * import it) never pulls `werift` into the CLI's default startup path even
 * if remote control is never used (the same lazy-import pattern the
 * codebase already uses for commands like `/remote`, `/crashes`).
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

/** Standard WebRTC ICE server shape — compatible with werift's `RTCIceServer` (`urls` is a SINGULAR string). */
export interface IceServer {
  urls:        string
  username?:   string
  credential?: string
}

export interface CliRemoteTransport {
  /** Generates the local offer (SDP) and returns it as a signed signal envelope. */
  createOffer(opts: {
    signingKeyFingerprint: string
    sign:                  (payload: string) => Promise<string>
    iceServers?:           IceServer[]
  }): Promise<SignalEnvelope>

  /** Applies the signed answer received from the backend (remote description). */
  applyAnswer(answer: SignalEnvelope): Promise<void>

  /** Fires when the data channel opens (P2P connection ready to use). */
  onChannelOpen(handler: () => void): void

  /** Raw message from the other side (a JSON string — decoded via event-codec). */
  onMessage(handler: (data: string) => void): void

  /** Sends a raw message over the open channel; queued to send once open if the channel isn't open yet. */
  send(data: string): void

  close(): Promise<void>
}

/**
 * A placeholder until Workstream D — no real SDP/ICE/data channel, it just
 * makes the runtime's signing + signaling flow (session creation, polling,
 * applying the answer, heartbeat/close) verifiable end-to-end. The
 * CLI/offerer counterpart of mobile's `MockMobileRemoteTransport`.
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
    // no-op — the real remote-description application happens in Workstream D.
  }

  onChannelOpen(): void {
    // no-op — no real channel
  }

  onMessage(): void {
    // no-op
  }

  send(): void {
    // no-op — no real channel to send over
  }

  async close(): Promise<void> {
    // no-op
  }
}
