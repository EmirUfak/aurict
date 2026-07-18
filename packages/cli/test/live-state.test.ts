import { describe, expect, test } from "bun:test";
import { resolveLivePresentation } from "../src/tui/conversation/live-state.js";

const base = { loading: true, paused: false, hasText: false, hasReasoning: false, hasActiveTool: false };

describe("live transcript state", () => {
  test("prioritizes pause, commentary, and stable tools over generic activity", () => {
    expect(resolveLivePresentation({ ...base, paused: true, hasText: true })).toBe("paused");
    expect(resolveLivePresentation({ ...base, hasText: true, hasActiveTool: true })).toBe("text");
    expect(resolveLivePresentation({ ...base, hasActiveTool: true, hasReasoning: true })).toBe("tool");
  });

  test("shows reasoning or generic activity only when neither text nor a tool owns the area", () => {
    expect(resolveLivePresentation({ ...base, loading: false, hasReasoning: true })).toBe("reasoning");
    expect(resolveLivePresentation(base)).toBe("activity");
    expect(resolveLivePresentation({ ...base, loading: false })).toBe("idle");
  });
});
