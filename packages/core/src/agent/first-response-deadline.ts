export interface FirstResponseDeadline {
  signal: AbortSignal
  markResponse(): void
  dispose(): void
  isArmed(): boolean
}

/**
 * Streaming requests have an observable first event, so a TTFT deadline is
 * meaningful. Non-streaming calls only resolve at completion and must never be
 * aborted by that deadline.
 */
export function createFirstResponseDeadline(options: {
  enabled: boolean
  timeoutMs: number
  idleTimeoutMs?: number
  parentSignal?: AbortSignal
}): FirstResponseDeadline {
  if (!options.enabled) {
    const signal = options.parentSignal ?? new AbortController().signal
    return {
      signal,
      markResponse: () => undefined,
      dispose: () => undefined,
      isArmed: () => false,
    }
  }

  const controller = new AbortController()
  let armed = true
  let timer: ReturnType<typeof setTimeout> | undefined
  const arm = (timeoutMs: number, message: string) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      armed = false
      controller.abort(new Error(message))
    }, timeoutMs)
  }
  arm(options.timeoutMs, "Provider did not start responding in time.")
  const signal = options.parentSignal
    ? AbortSignal.any([options.parentSignal, controller.signal])
    : controller.signal
  const disarm = () => {
    if (!armed) return
    armed = false
    if (timer) clearTimeout(timer)
  }

  return {
    signal,
    markResponse: () => {
      if (!armed) return
      const idleTimeoutMs = options.idleTimeoutMs
      if (idleTimeoutMs && idleTimeoutMs > 0) {
        arm(idleTimeoutMs, "Provider stopped making progress before the response completed.")
      } else {
        disarm()
      }
    },
    dispose: disarm,
    isArmed: () => armed,
  }
}
