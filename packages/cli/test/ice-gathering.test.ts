import { describe, expect, it } from "bun:test"
import { IceGatheringError, requireIceCandidates, waitForIceGatheringComplete, type IceGatheringPeer } from "../src/remote/ice-gathering.js"

function peer(state = "new"): IceGatheringPeer & { emitState(next: string): void } {
  let stateListener: ((next: string) => void) | undefined
  return {
    iceGatheringState: state,
    iceGatheringStateChange: { subscribe(listener) { stateListener = listener } },
    emitState(next) { this.iceGatheringState = next; stateListener?.(next) },
  }
}

describe("ICE gathering contract", () => {
  it("resolves when gathering completes", async () => {
    const fake = peer()
    const waiting = waitForIceGatheringComplete(fake, 100)
    fake.emitState("complete")
    await waiting
  })

  it("rejects when gathering does not complete before its deadline", async () => {
    await expect(waitForIceGatheringComplete(peer(), 1)).rejects.toBeInstanceOf(IceGatheringError)
  })

  it("accepts SDP with embedded candidates and rejects candidate-free SDP", () => {
    expect(() => requireIceCandidates("v=0\r\na=candidate:1 1 UDP 1 127.0.0.1 9 typ host\r\n")).not.toThrow()
    expect(() => requireIceCandidates("v=0\r\na=ice-options:trickle\r\n")).toThrow(IceGatheringError)
  })
})
