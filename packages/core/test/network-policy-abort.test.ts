import { describe, it, expect } from "bun:test"
import { withAbort, fetchWithUrlPolicy } from "../src/security/network-policy.js"

describe("network-policy iptal edilebilirliği", () => {
  it("takılan bir işlemi signal abort edilince hemen sonlandırır", async () => {
    // dns.promises.lookup bir AbortSignal almaz; takılan bir resolver bu yarış
    // olmadan hem timeout'u hem parent iptalini yok sayardı.
    const controller = new AbortController()
    const stuck = withAbort(controller.signal, () => new Promise<never>(() => { /* asla settle olmaz */ }))
    setTimeout(() => controller.abort(), 10)

    await expect(stuck).rejects.toMatchObject({ name: "AbortError" })
  })

  it("zaten iptal edilmiş bir signal ile işi hiç başlatmaz", async () => {
    const controller = new AbortController()
    controller.abort()
    let started = false

    await expect(
      withAbort(controller.signal, async () => { started = true }),
    ).rejects.toMatchObject({ name: "AbortError" })
    expect(started).toBe(false)
  })

  it("signal yoksa işi olduğu gibi çalıştırır", async () => {
    await expect(withAbort(undefined, async () => "ok")).resolves.toBe("ok")
  })

  it("iş bittikten sonra signal üzerinde dinleyici bırakmaz", async () => {
    const controller = new AbortController()
    await withAbort(controller.signal, async () => "ok")
    let leaked = false
    controller.signal.addEventListener("abort", () => { leaked = true })
    controller.abort()
    expect(leaked).toBe(true) // yeni dinleyici çalışır; eski dinleyici reject etmediği için test asılmaz
  })

  it("zaten iptal edilmiş bir signal ile fetchWithUrlPolicy DNS'e hiç girmez", async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      fetchWithUrlPolicy("https://example.com/", { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" })
  })
})
