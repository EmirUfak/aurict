import { describe, expect, it } from "bun:test"
import { ConcurrencyLimiter } from "../src/security/rate-limiter.js"

describe("security concurrency limiter", () => {
  it("removes an aborted request while it is waiting for a slot", async () => {
    const limiter = new ConcurrencyLimiter(1)
    let release!: () => void
    const running = limiter.run(() => new Promise<void>(resolve => { release = resolve }))
    const controller = new AbortController()
    const queued = limiter.run(async () => "unreachable", controller.signal)

    controller.abort(new Error("cancelled"))
    await expect(queued).rejects.toThrow("cancelled")
    release()
    await running
  })
})
