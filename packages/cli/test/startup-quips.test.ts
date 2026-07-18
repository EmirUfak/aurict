import { describe, expect, test } from "bun:test";
import { STARTUP_QUIPS, selectStartupQuip } from "../src/tui/startup-quips.js";

describe("startup quips", () => {
  test("selects the full deterministic range without crossing its bounds", () => {
    expect(selectStartupQuip(() => 0)).toBe(STARTUP_QUIPS[0]);
    expect(selectStartupQuip(() => 0.999_999)).toBe(STARTUP_QUIPS.at(-1));
  });

  test("keeps every line original-sized and unique for a compact banner", () => {
    expect(new Set(STARTUP_QUIPS).size).toBe(STARTUP_QUIPS.length);
    expect(STARTUP_QUIPS.every((quip) => quip.length <= 72)).toBe(true);
  });
});
