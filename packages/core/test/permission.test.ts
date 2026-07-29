import { describe, it, expect } from "bun:test"
import { PermissionEvaluator } from "../src/permission/evaluator.js"
import { PermissionGate, PermissionStore } from "../src/permission/store.js"

describe("PermissionEvaluator.evaluate", () => {
  // ── Always-allow tools ────────────────────────────────────────────────────

  it("read is always allowed", () => {
    expect(PermissionEvaluator.evaluate("read", "src/index.ts")).toBe("allow")
    expect(PermissionEvaluator.evaluate("read", "/etc/passwd")).toBe("allow")
  })

  it("glob is always allowed", () => {
    expect(PermissionEvaluator.evaluate("glob", "**/*.ts")).toBe("allow")
  })

  it("grep is always allowed", () => {
    expect(PermissionEvaluator.evaluate("grep", "TODO")).toBe("allow")
  })

  it("websearch is always allowed", () => {
    expect(PermissionEvaluator.evaluate("websearch", "bun runtime")).toBe("allow")
  })

  it("lsp is always allowed", () => {
    expect(PermissionEvaluator.evaluate("lsp", "typescript")).toBe("allow")
  })

  // ── Deny rules ────────────────────────────────────────────────────────────

  it("sudo bash is denied", () => {
    expect(PermissionEvaluator.evaluate("bash", "sudo rm -rf /")).toBe("deny")
  })

  it("write to /etc/ is denied", () => {
    expect(PermissionEvaluator.evaluate("write", "/etc/hosts")).toBe("deny")
  })

  it("write to /usr/ is denied", () => {
    expect(PermissionEvaluator.evaluate("write", "/usr/local/bin/evil")).toBe("deny")
  })

  it("write to /sys/ is denied", () => {
    expect(PermissionEvaluator.evaluate("write", "/sys/kernel")).toBe("deny")
  })

  // ── Ask rules ─────────────────────────────────────────────────────────────

  it("rm bash is ask", () => {
    expect(PermissionEvaluator.evaluate("bash", "rm file.txt")).toBe("ask")
  })

  it("rm -rf bash is ask", () => {
    expect(PermissionEvaluator.evaluate("bash", "rm -rf dist/")).toBe("ask")
  })

  it("curl bash is ask", () => {
    expect(PermissionEvaluator.evaluate("bash", "curl https://example.com")).toBe("ask")
  })

  it("shell remains a backwards-compatible alias for bash", () => {
    expect(PermissionEvaluator.evaluate("shell", "rm file.txt")).toBe("ask")
  })

  // ── Unknown tool defaults to ask ──────────────────────────────────────────

  it("unknown tool defaults to ask", () => {
    expect(PermissionEvaluator.evaluate("unknowntool", "something")).toBe("ask")
  })

  // ── Wildcard pattern matching ─────────────────────────────────────────────

  it("wildcard * matches any value", () => {
    expect(PermissionEvaluator.evaluate("task", "anything")).toBe("allow")
    expect(PermissionEvaluator.evaluate("memory", "random-pattern")).toBe("allow")
  })
})

describe("PermissionStore directory approvals", () => {
  it("approves paths inside the remembered directory only", () => {
    PermissionStore.clear()
    PermissionStore.approveDirectory("write", "src/features/auth/login.ts")

    expect(PermissionStore.isApproved("write", "src/features/auth/session.ts")).toBe(true)
    expect(PermissionStore.isApproved("write", "src/features/auth/nested/token.ts")).toBe(true)
    expect(PermissionStore.isApproved("write", "src/features/profile.ts")).toBe(false)
    expect(PermissionStore.isApproved("edit", "src/features/auth/session.ts")).toBe(false)

    PermissionStore.clear()
  })
})

describe("PermissionGate.wait", () => {
  it("returns deny and clears pending when the prompt times out", async () => {
    PermissionGate.cancelPending()
    const res = await PermissionGate.wait("timeout-test", { timeoutMs: 10 })

    expect(res.decision).toBe("deny")
    expect(PermissionGate.hasPending()).toBe(false)
  })

  it("returns deny and clears pending when aborted", async () => {
    PermissionGate.cancelPending()
    const ac = new AbortController()
    const wait = PermissionGate.wait("abort-test", { signal: ac.signal, timeoutMs: 1000 })
    ac.abort()
    const res = await wait

    expect(res.decision).toBe("deny")
    expect(PermissionGate.hasPending()).toBe(false)
  })

  it("reports timeout settlement so clients can remove stale prompts", async () => {
    PermissionGate.cancelPending()
    const settlements: Array<{ id: string; reason: string }> = []
    const off = PermissionGate.onSettled(settlement => settlements.push(settlement))

    try {
      await PermissionGate.wait("ui-timeout", { timeoutMs: 10 })
      expect(settlements).toContainEqual(expect.objectContaining({
        id: "ui-timeout",
        reason: "timeout",
      }))
      expect(PermissionGate.hasPending("ui-timeout")).toBe(false)
    } finally {
      off()
    }
  })

  it("reports cancellation settlement exactly once", async () => {
    PermissionGate.cancelPending()
    const settlements: Array<{ id: string; reason: string }> = []
    const off = PermissionGate.onSettled(settlement => settlements.push(settlement))
    const wait = PermissionGate.wait("cancel-test", { timeoutMs: 1_000 })

    try {
      PermissionGate.cancelPending()
      await wait
      expect(settlements.filter(item => item.id === "cancel-test")).toEqual([
        expect.objectContaining({ reason: "cancel" }),
      ])
    } finally {
      off()
    }
  })

  it("settles even when a UI listener throws", async () => {
    PermissionGate.cancelPending()
    const originalError = console.error
    console.error = () => {}
    const off = PermissionGate.onSettled(() => {
      throw new Error("broken UI listener")
    })

    try {
      const wait = PermissionGate.wait("listener-error", { timeoutMs: 1_000 })
      PermissionGate.respond("listener-error", "allow_once")
      await expect(wait).resolves.toEqual({ decision: "allow_once" })
      expect(PermissionGate.hasPending("listener-error")).toBe(false)
    } finally {
      off()
      console.error = originalError
    }
  })
})
