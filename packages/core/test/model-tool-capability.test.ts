import { describe, expect, test } from "bun:test"
import {
  decideModelToolCapability,
  requiredToolCapabilityError,
} from "../src/provider/model-tool-capability.js"
import type { ModelInfo } from "../src/provider/plugin.js"

function model(overrides: Partial<ModelInfo>): ModelInfo {
  return {
    id: "example/model",
    name: "Example",
    contextWindow: 128_000,
    maxOutput: 8_000,
    supportsTools: true,
    supportsVision: false,
    ...overrides,
  }
}

describe("model tool capability", () => {
  test("allows declared and metadata-backed tool support", () => {
    expect(decideModelToolCapability(model({ toolSupportSource: "declared" })).supported).toBe(true)
    expect(decideModelToolCapability(model({ toolSupportSource: "metadata" })).supported).toBe(true)
  })

  test("does not send tool schemas when support is only inferred", () => {
    expect(decideModelToolCapability(model({ toolSupportSource: "inferred" }))).toEqual({
      supported: false,
      reason: "unverified",
      source: "inferred",
    })
  })

  test("honors an explicit unsupported declaration", () => {
    expect(decideModelToolCapability(model({
      supportsTools: false,
      toolSupportSource: "declared",
    })).reason).toBe("declared_unsupported")
  })

  test("provides an actionable local error before a required-tool request", () => {
    const error = requiredToolCapabilityError(model({ toolSupportSource: "inferred" }))
    expect(error).toContain("selected agent requires tools")
    expect(error).toContain("/models")
    expect(error).toContain("No provider request was sent")
  })
})
