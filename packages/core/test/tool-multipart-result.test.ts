import { describe, expect, it } from "bun:test"
import { formatAdaptedToolResult } from "../src/agent/tool-adapter.js"

describe("multipart tool results", () => {
  it("keeps transcript consumers on the human-readable text", () => {
    expect(formatAdaptedToolResult({
      text: "Image loaded: screenshot.png",
      content: [{ type: "image", data: "AA==", mimeType: "image/png" }],
    })).toBe("Image loaded: screenshot.png")
  })

  it("preserves ordinary string results", () => {
    expect(formatAdaptedToolResult("plain output")).toBe("plain output")
  })
})
