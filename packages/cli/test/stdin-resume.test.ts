import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import {
  shouldReassertModes,
  installStdinResumeGuard,
  STDIN_RESUME_GAP_MS,
  __resetForTest as __resetStdinResumeForTest,
} from "../src/tui/event-system/stdin-resume.js"
import {
  registerTerminalMode,
  __resetForTest as __resetTerminalModesForTest,
} from "../src/tui/event-system/terminal-modes.js"

describe("shouldReassertModes", () => {
  it("returns false when the gap is under the threshold", () => {
    expect(shouldReassertModes(1000, 900, 500)).toBe(false)
  })

  it("returns true when the gap exceeds the threshold", () => {
    expect(shouldReassertModes(2000, 900, 500)).toBe(true)
  })

  it("returns false exactly at the threshold boundary", () => {
    expect(shouldReassertModes(1500, 1000, 500)).toBe(false)
  })

  it("defaults to STDIN_RESUME_GAP_MS when no threshold is given", () => {
    expect(shouldReassertModes(0, 0)).toBe(false)
    expect(shouldReassertModes(STDIN_RESUME_GAP_MS + 1, 0)).toBe(true)
  })
})

describe("installStdinResumeGuard", () => {
  let uninstall: (() => void) | null = null
  let writes: string[] = []
  let originalWrite: typeof process.stdout.write

  beforeEach(() => {
    __resetStdinResumeForTest()
    __resetTerminalModesForTest()
    writes = []
    originalWrite = process.stdout.write.bind(process.stdout)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(process.stdout as any).write = (chunk: string) => { writes.push(chunk); return true }
  })

  afterEach(() => {
    uninstall?.()
    uninstall = null
    process.stdout.write = originalWrite
    __resetTerminalModesForTest()
  })

  it("re-asserts active modes when stdin activity resumes after a long gap", () => {
    let fakeNow = 1_000_000
    uninstall = installStdinResumeGuard(() => fakeNow)

    registerTerminalMode("mouse-tracking", "\x1b[?1000h", "\x1b[?1000l")
    writes = []

    fakeNow += STDIN_RESUME_GAP_MS + 1000 // simulate a long silence
    process.stdin.emit("readable")

    expect(writes).toContain("\x1b[?1000h")
  })

  it("does not re-assert modes on normal, frequent stdin activity", () => {
    let fakeNow = 1_000_000
    uninstall = installStdinResumeGuard(() => fakeNow)

    registerTerminalMode("mouse-tracking", "\x1b[?1000h", "\x1b[?1000l")
    writes = []

    fakeNow += 50 // typing cadence, well under the gap threshold
    process.stdin.emit("readable")

    expect(writes).not.toContain("\x1b[?1000h")
  })

  it("calling install twice is a no-op (returns an inert uninstall)", () => {
    const first  = installStdinResumeGuard()
    const second = installStdinResumeGuard()
    first()
    second() // should not throw or double-remove listeners
    uninstall = null
  })
})
