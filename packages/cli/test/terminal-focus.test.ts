import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { onFocusChange } from "../src/tui/mouse.js"
import { __resetForTest as __resetTerminalModesForTest } from "../src/tui/event-system/terminal-modes.js"

let writes: string[] = []
let originalWrite: typeof process.stdout.write

beforeEach(() => {
  writes = []
  originalWrite = process.stdout.write.bind(process.stdout)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(process.stdout as any).write = (chunk: string) => { writes.push(chunk); return true }
  __resetTerminalModesForTest()
})

afterEach(() => {
  process.stdout.write = originalWrite
  __resetTerminalModesForTest()
})

describe("onFocusChange — mode toggling", () => {
  it("enables DECSET 1004 focus reporting on first subscriber", () => {
    const unsub = onFocusChange(() => {})
    expect(writes).toContain("\x1b[?1004h")
    unsub()
  })

  it("disables focus reporting once the last subscriber unsubscribes", () => {
    const unsub = onFocusChange(() => {})
    writes = []
    unsub()
    expect(writes).toContain("\x1b[?1004l")
  })

  it("keeps reporting enabled while at least one subscriber remains", () => {
    const unsub1 = onFocusChange(() => {})
    const unsub2 = onFocusChange(() => {})
    writes = []
    unsub1()
    expect(writes).not.toContain("\x1b[?1004l")
    unsub2()
    expect(writes).toContain("\x1b[?1004l")
  })
})

describe("onFocusChange — event dispatch via stdin", () => {
  it("dispatches focused=true for CSI I and focused=false for CSI O, stripping the sequence from the data stream", async () => {
    const events: boolean[] = []
    const unsub = onFocusChange((focused) => events.push(focused))

    const seen: string[] = []
    const dataListener = (chunk: Buffer) => seen.push(chunk.toString("binary"))
    process.stdin.on("data", dataListener)

    process.stdin.emit("data", Buffer.from("\x1b[Ihello", "binary"))
    process.stdin.emit("data", Buffer.from("world\x1b[O", "binary"))

    process.stdin.off("data", dataListener)
    unsub()

    expect(events).toEqual([true, false])
    expect(seen.join("")).toBe("helloworld")
  })

  it("passes through normal data untouched when no focus sequence is present", () => {
    const unsub = onFocusChange(() => {})
    const seen: string[] = []
    const dataListener = (chunk: Buffer) => seen.push(chunk.toString("binary"))
    process.stdin.on("data", dataListener)

    process.stdin.emit("data", Buffer.from("plain text", "binary"))

    process.stdin.off("data", dataListener)
    unsub()
    expect(seen.join("")).toBe("plain text")
    expect(process.stdin.isPaused()).toBe(true)
  })
})
