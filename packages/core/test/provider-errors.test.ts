import { describe, expect, test } from "bun:test"
import {
  parseProviderError,
  sanitizeProviderDiagnostic,
} from "../src/agent/provider-errors.js"

describe("provider error diagnostics", () => {
  test("explains 400 responses without exposing credentials", () => {
    const error = Object.assign(new Error("Bad Request"), {
      statusCode: 400,
      url: "https://provider.example/v1/chat",
      responseBody: JSON.stringify({
        error: "unsupported tool schema",
        api_key: "sk-super-secret-value",
      }),
    })

    const diagnostic = parseProviderError(error)
    expect(diagnostic).toContain("400 Bad Request")
    expect(diagnostic).toContain("unsupported tool schema")
    expect(diagnostic).toContain("[REDACTED]")
    expect(diagnostic).not.toContain("sk-super-secret-value")
  })

  test("redacts bearer and assignment-style tokens", () => {
    const diagnostic = sanitizeProviderDiagnostic(
      "Authorization: Bearer abc.def-123 api_key=token-secret-value",
    )
    expect(diagnostic).not.toContain("abc.def-123")
    expect(diagnostic).not.toContain("token-secret-value")
  })
})
