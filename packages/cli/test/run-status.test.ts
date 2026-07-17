import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { activityLabel } from "../src/tui/run-status.js";
import { CockpitHeader } from "../src/tui/CockpitHeader.js";
import { TerminalSizeContext } from "../src/tui/TerminalSizeContext.js";

describe("run activity labels", () => {
  test("makes each pre-response phase visible", () => {
    expect(activityLabel("preparing_context")).toBe("assembling context");
    expect(activityLabel("resolving_model")).toBe("resolving model");
    expect(activityLabel("waiting_for_provider")).toBe("waiting for provider");
  });

  test("describes the active response state", () => {
    expect(activityLabel("thinking")).toBe("thinking");
    expect(activityLabel("responding")).toBe("responding");
    expect(activityLabel("using_tool")).toBe("running tool");
  });

  test("renders the live phase in the terminal header", () => {
    const { lastFrame } = render(
      React.createElement(
        TerminalSizeContext.Provider,
        { value: { columns: 120, rows: 30 } },
        React.createElement(CockpitHeader, {
          provider: "anthropic",
          model: "claude-opus-4",
          workdir: "/tmp/project",
          tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 },
          contextTokens: 0,
          loading: true,
          activity: "resolving_model",
        }),
      ),
    );

    expect(lastFrame()).toContain("resolving model");
  });
});
