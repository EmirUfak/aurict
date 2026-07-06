import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import {
  registerTerminalMode,
  getActiveModes,
  reassertActiveModes,
  __resetForTest,
  __triggerRestoreForTest,
} from "../src/tui/event-system/terminal-modes.js"

let writes: string[] = []
let originalWrite: typeof process.stdout.write

beforeEach(() => {
  writes = []
  originalWrite = process.stdout.write.bind(process.stdout)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(process.stdout as any).write = (chunk: string) => { writes.push(chunk); return true }
  __resetForTest()
})

afterEach(() => {
  process.stdout.write = originalWrite
  __resetForTest()
})

describe("registerTerminalMode", () => {
  it("writes the enable sequence immediately", () => {
    registerTerminalMode("test-mode", "\x1b[?9999h", "\x1b[?9999l")
    expect(writes).toContain("\x1b[?9999h")
  })

  it("tracks the mode as active", () => {
    registerTerminalMode("test-mode", "\x1b[?9999h", "\x1b[?9999l")
    expect(getActiveModes().get("test-mode")).toBe("\x1b[?9999l")
  })

  it("cleanup() writes the disable sequence and untracks the mode", () => {
    const cleanup = registerTerminalMode("test-mode", "\x1b[?9999h", "\x1b[?9999l")
    writes = []
    cleanup()
    expect(writes).toContain("\x1b[?9999l")
    expect(getActiveModes().has("test-mode")).toBe(false)
  })

  it("cleanup() is idempotent — calling twice writes the disable sequence once", () => {
    const cleanup = registerTerminalMode("test-mode", "\x1b[?9999h", "\x1b[?9999l")
    writes = []
    cleanup()
    cleanup()
    expect(writes.filter((w) => w === "\x1b[?9999l")).toHaveLength(1)
  })

  it("supports multiple independent modes at once", () => {
    registerTerminalMode("mode-a", "\x1b[?1h", "\x1b[?1l")
    registerTerminalMode("mode-b", "\x1b[?2h", "\x1b[?2l")
    expect(getActiveModes().size).toBe(2)
  })
})

describe("process-exit restoration", () => {
  it("writes every active mode's disable sequence when the process signals exit", () => {
    registerTerminalMode("mode-a", "\x1b[?1h", "\x1b[?1l")
    registerTerminalMode("mode-b", "\x1b[?2h", "\x1b[?2l")
    writes = []
    __triggerRestoreForTest()
    expect(writes).toContain("\x1b[?1l")
    expect(writes).toContain("\x1b[?2l")
  })

  it("clears the active-modes registry after restoring", () => {
    registerTerminalMode("mode-a", "\x1b[?1h", "\x1b[?1l")
    __triggerRestoreForTest()
    expect(getActiveModes().size).toBe(0)
  })

  it("a mode cleaned up normally is not written again on process exit", () => {
    const cleanup = registerTerminalMode("mode-a", "\x1b[?1h", "\x1b[?1l")
    cleanup()
    writes = []
    __triggerRestoreForTest()
    expect(writes).not.toContain("\x1b[?1l")
  })
})

describe("reassertActiveModes", () => {
  it("re-writes the enable sequence of every active mode", () => {
    registerTerminalMode("mode-a", "\x1b[?1h", "\x1b[?1l")
    registerTerminalMode("mode-b", "\x1b[?2h", "\x1b[?2l")
    writes = []
    reassertActiveModes()
    expect(writes).toContain("\x1b[?1h")
    expect(writes).toContain("\x1b[?2h")
  })

  it("does not re-write modes that were already cleaned up", () => {
    const cleanup = registerTerminalMode("mode-a", "\x1b[?1h", "\x1b[?1l")
    cleanup()
    writes = []
    reassertActiveModes()
    expect(writes).not.toContain("\x1b[?1h")
  })

  it("is a no-op when nothing is registered", () => {
    writes = []
    reassertActiveModes()
    expect(writes).toHaveLength(0)
  })
})
