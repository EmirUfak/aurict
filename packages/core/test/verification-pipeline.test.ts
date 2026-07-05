import { describe, expect, it } from "bun:test"
import { verificationSummary, withTscVerification, withVerification } from "../src/verification/pipeline.js"

describe("verification pipeline metadata", () => {
  it("merges TSC verification metadata into execute results", () => {
    const result = withTscVerification(
      { output: "ok", metadata: { changedFiles: ["src/a.ts"] } },
      { status: "passed" },
    )

    expect(result.metadata?.changedFiles).toEqual(["src/a.ts"])
    expect(result.metadata?.verification?.tsc?.status).toBe("passed")
    expect(verificationSummary(result)).toBe("verified:tsc")
  })

  it("summarizes skipped verification with reason", () => {
    const result = withTscVerification(
      { output: "ok" },
      { status: "skipped", reason: "non-type change" },
    )

    expect(verificationSummary(result)).toBe("skipped:tsc:non-type change")
  })

  it("returns not_verified when no verification metadata exists", () => {
    expect(verificationSummary({ output: "ok" })).toBe("not_verified")
  })

  // Faz 4.1 — dile-agnostik check'ler
  it("summarizes a non-tsc check (ruff/mypy/govet/cargo/ruby/rubocop) the same way as tsc", () => {
    const result = withVerification({ output: "ok" }, "mypy", { status: "passed" })
    expect(verificationSummary(result)).toBe("verified:mypy")
  })

  it("summarizes multiple checks together (check + lint tier both ran)", () => {
    let result = withVerification({ output: "ok" }, "mypy", { status: "passed" })
    result = withVerification(result, "ruff", { status: "failed", output: "E501 line too long" })
    const summary = verificationSummary(result)
    expect(summary).toContain("verified:mypy")
    expect(summary).toContain("failed:ruff")
  })

  it("summarizes an environmental skip (tool not installed) with its reason", () => {
    const result = withVerification({ output: "ok" }, "cargo", { status: "skipped", reason: "cargo not installed" })
    expect(verificationSummary(result)).toBe("skipped:cargo:cargo not installed")
  })
})
