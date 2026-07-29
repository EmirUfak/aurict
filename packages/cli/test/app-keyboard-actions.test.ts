import { afterEach, describe, expect, test } from "bun:test"
import { PermissionGate } from "@aurict/core"
import type { PermissionRequest } from "@aurict/core"
import { closeFocusedLayer } from "../src/tui/app/app-keyboard-actions.js"
import type { AppKeyboardParams } from "../src/tui/app/app-keyboard-types.js"

afterEach(() => PermissionGate.cancelPending())

describe("terminal permission keyboard handling", () => {
  test("closing the permission layer denies and removes the request", async () => {
    const request: PermissionRequest = {
      id: "permission-enter-escape",
      tool: "bash",
      pattern: "example",
    }
    let queue = [request]
    const messages: string[] = []
    const wait = PermissionGate.wait(request.id, { timeoutMs: 1_000 })
    const params = {
      focusLayer: "permission",
      permission: request,
      setPermissionQueue: (update: typeof queue | ((current: typeof queue) => typeof queue)) => {
        queue = typeof update === "function" ? update(queue) : update
      },
      addSystemMsg: (message: string) => messages.push(message),
      overlay: {},
    } as unknown as AppKeyboardParams

    expect(closeFocusedLayer(params)).toBe(true)
    expect((await wait).decision).toBe("deny")
    expect(queue).toEqual([])
    expect(messages).toEqual(["Permission denied: bash"])
  })
})
