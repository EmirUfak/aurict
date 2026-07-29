import { describe, expect, test } from "bun:test"
import {
  taskCompletionNotification,
  taskFailureNotification,
} from "../src/util/notify.js"

describe("terminal notifications", () => {
  test("never places the user prompt in native notification content", () => {
    const secretPrompt = "deploy using token-super-secret"
    const notification = taskCompletionNotification(65_000)
    expect(notification.body).toBe("Open Aurict terminal to review the result (1m).")
    expect(JSON.stringify(notification)).not.toContain(secretPrompt)
  })

  test("uses a non-sticky generic failure message", () => {
    expect(taskFailureNotification()).toEqual({
      title: "Task needs attention",
      body: "Open Aurict terminal to review the error.",
      level: "error",
    })
  })
})
