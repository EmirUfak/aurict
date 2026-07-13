export interface IceGatheringPeer {
  iceGatheringState: string
  iceGatheringStateChange: {
    subscribe(listener: (state: string) => void): { unsubscribe?(): void; unSubscribe?(): void } | void
  }
}

export class IceGatheringError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "IceGatheringError"
  }
}

export async function waitForIceGatheringComplete(peer: IceGatheringPeer, timeoutMs: number): Promise<void> {
  if (peer.iceGatheringState === "complete") return

  await new Promise<void>((resolve, reject) => {
    let settled = false
    let subscription: { unsubscribe?(): void; unSubscribe?(): void } | undefined
    let timeout: ReturnType<typeof setTimeout> | undefined
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      subscription?.unsubscribe?.()
      subscription?.unSubscribe?.()
      if (error) reject(error)
      else resolve()
    }
    subscription = peer.iceGatheringStateChange.subscribe((state) => {
      if (state === "complete") finish()
    }) ?? undefined
    if (settled) return
    timeout = setTimeout(() => finish(new IceGatheringError(`ICE gathering timed out after ${timeoutMs}ms.`)), timeoutMs)
  })
}

export function requireIceCandidates(sdp: string): void {
  if (!/^a=candidate:/m.test(sdp)) {
    throw new IceGatheringError("ICE gathering completed without any candidates; remote control cannot establish a peer connection.")
  }
}
