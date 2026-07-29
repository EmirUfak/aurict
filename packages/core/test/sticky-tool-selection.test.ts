import { describe, expect, it } from "bun:test"
import { mergeStickyToolSelection } from "../src/agent/sticky-tool-selection.js"

describe("sticky tool selection", () => {
  it("keeps prior capabilities in canonical registry order", () => {
    expect(mergeStickyToolSelection({
      current: ["grep", "edit"],
      previous: ["read", "grep"],
      available: ["read", "edit", "grep", "bash"],
      maxVisible: 4,
    })).toEqual(["read", "edit", "grep"])
  })

  it("never widens an explicit tools override", () => {
    expect(mergeStickyToolSelection({
      current: ["read", "edit"],
      previous: ["bash"],
      available: ["read", "edit", "bash"],
      allowed: ["read"],
      maxVisible: 4,
    })).toEqual(["read"])
  })

  it("reserves required tools before dynamic routing candidates", () => {
    expect(mergeStickyToolSelection({
      current: ["read", "grep"],
      previous: ["write"],
      required: ["market_data", "calculator"],
      available: ["read", "grep", "write", "market_data", "calculator"],
      maxVisible: 2,
    })).toEqual(["market_data", "calculator"])
  })
})
