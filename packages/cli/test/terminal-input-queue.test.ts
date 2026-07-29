import { describe, expect, test } from "bun:test"
import {
  physicalInputFirst,
  TerminalInputQueue,
} from "../src/tui/event-system/terminal-input-queue.js"

describe("terminal synthetic input queue", () => {
  test("stays bounded during a navigation flood", () => {
    const queue = new TerminalInputQueue(64)
    for (let index = 0; index < 10_000; index++) queue.push("\u001b[B")

    expect(queue.size).toBe(64)
  })

  test("prioritizes physical Enter over queued navigation", () => {
    const queue = new TerminalInputQueue(64)
    queue.pushMany(Array.from({ length: 64 }, () => "\u001b[B"))

    expect(physicalInputFirst("\r", queue)).toBe("\r")
    expect(queue.size).toBe(64)
  })

  test("prioritizes physical Ctrl+C over queued navigation", () => {
    const queue = new TerminalInputQueue(64)
    queue.pushMany(Array.from({ length: 64 }, () => "\u001b[A"))

    expect(physicalInputFirst("\u0003", queue)).toBe("\u0003")
    expect(queue.size).toBe(64)
  })

  test("uses the newest bounded synthetic events when stdin is idle", () => {
    const queue = new TerminalInputQueue(2)
    queue.push("old")
    queue.push("middle")
    queue.push("new")

    expect(physicalInputFirst(null, queue)).toBe("middle")
    expect(physicalInputFirst(undefined, queue)).toBe("new")
  })
})
