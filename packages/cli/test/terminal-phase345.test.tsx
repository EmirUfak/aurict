import { describe, expect, test } from "bun:test";
import React from "react";
import { render } from "ink-testing-library";
import { PermissionPrompt } from "../src/tui/PermissionPrompt.js";
import { TerminalSizeContext } from "../src/tui/TerminalSizeContext.js";
import { parseRawDiff } from "../src/tui/DiffRenderer/logic.js";
import { presentTranscriptError } from "../src/tui/conversation/error-presentation.js";
import { projectTranscript } from "../src/tui/conversation/projector.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const rowText = (row: ReturnType<typeof projectTranscript>[number]) => row.segments.map((segment) => segment.text).join("");

describe("terminal phases 3-5", () => {
  test("projects live and paused activity into the scrollable transcript", () => {
    const live = projectTranscript({ messages: [], width: 80, streamingText: null, streamingReason: null, streamingError: null, loading: true, activity: "waiting_for_provider" });
    const paused = projectTranscript({ messages: [], width: 80, streamingText: "partial", streamingReason: null, streamingError: null, loading: true, paused: true });
    expect(live.map(rowText).join("\n")).toContain("waiting for provider");
    expect(paused.map(rowText).join("\n")).toContain("live output paused · Ctrl+L resume");
  });

  test("gives live commentary and pending tools a single visual owner", () => {
    const commentary = projectTranscript({
      messages: [], width: 80, streamingText: "I am checking the repository.",
      streamingReason: "reasoning", streamingError: null, loading: true,
      activity: "waiting_for_provider", activeTool: "bash",
    });
    expect(commentary.map(rowText).join("\n")).toContain("I am checking the repository.");
    expect(commentary.map(rowText).join("\n")).not.toContain("waiting for provider");
    expect(commentary.map(rowText).join("\n")).not.toContain("using tool");

    const pendingTool = projectTranscript({
      messages: [{ id: "a", role: "assistant", content: "", blocks: [
        { type: "tool", id: "tool", tool: "bash", args: "git status", pending: true },
      ] }],
      width: 80, streamingText: null, streamingReason: "reasoning",
      streamingError: null, loading: true, activeTool: "bash",
    });
    const text = pendingTool.map(rowText).join("\n");
    expect(text.match(/Running git status/g)?.length).toBe(1);
    expect(text).not.toContain("using tool");
    expect(text).not.toContain("thinking…");
  });

  test("preserves file identity for every hunk in a multi-file diff", () => {
    const parsed = parseRawDiff("--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-a\n+A\n--- a/b.ts\n+++ b/b.ts\n@@ -2 +2 @@\n-b\n+B");
    expect(parsed.fileNames).toEqual(["a.ts", "b.ts"]);
    expect(parsed.hunks.map((hunk) => hunk.fileName)).toEqual(["a.ts", "b.ts"]);
  });

  test("keeps tool calls compact and displays meaningful duration", () => {
    const rows = projectTranscript({
      width: 80, streamingText: null, streamingReason: null, streamingError: null,
      messages: [{ id: "a", role: "assistant", content: "", blocks: [
        { type: "tool", id: "one", tool: "read", args: '{"path":"a.ts"}', pending: false, resultContent: "one", durationMs: 1_280 },
        { type: "tool", id: "two", tool: "bash", args: '{"command":"bun test"}', pending: true },
      ] }],
    });
    const text = rows.map(rowText).join("\n");
    expect(text).toContain("Read a.ts · 1.3s");
    expect(text).toContain("Running bun test");
    expect(text).not.toContain("tools · 2 calls");
  });

  test("folds adjacent low-level activity into a modern inspectable summary", () => {
    const rows = projectTranscript({
      width: 100, streamingText: null, streamingReason: null, streamingError: null,
      messages: [{ id: "group", role: "assistant", content: "", blocks: [
        { type: "tool", id: "one", tool: "read", args: '{"path":"src/a.ts"}', pending: false, resultContent: "a" },
        { type: "tool", id: "two", tool: "read", args: '{"path":"src/b.ts"}', pending: false, resultContent: "b" },
        { type: "tool", id: "three", tool: "read", args: '{"path":"src/c.ts"}', pending: false, resultContent: "c" },
      ] }],
    });
    const summary = rows.find((row) => rowText(row).includes("Read 3 files"));
    const summaryIndex = summary ? rows.indexOf(summary) : -1;
    expect(summary && rowText(summary)).toContain("src/a.ts, src/b.ts +1 · Ctrl+O inspect");
    expect(summary?.detailId).toBe("group:tool:0");
    expect(summaryIndex === 0 || rowText(rows[summaryIndex - 1]!) === "").toBe(true);
    expect(rowText(rows[summaryIndex + 1]!)).toBe("");
    expect(rows.filter((row) => rowText(row).startsWith("• Read ")).length).toBe(1);
  });

  test("maps common provider failures to an action", () => {
    expect(presentTranscriptError("401 Unauthorized: bad API key")).toMatchObject({ title: "Authentication required" });
    expect(presentTranscriptError("fetch failed: ECONNREFUSED").action).toContain("Check the connection");
  });

  test("supports direct allow and deny permission keys", async () => {
    const decisions: string[] = [];
    const view = render(
      <TerminalSizeContext.Provider value={{ columns: 80, rows: 24 }}>
        <PermissionPrompt request={{ id: "p", tool: "write", pattern: "a.ts", level: "warning" }} onDecide={(decision) => decisions.push(typeof decision === "string" ? decision : decision.decision)} />
      </TerminalSizeContext.Provider>,
    );
    await sleep(30);
    view.stdin.write("y");
    await sleep(20);
    expect(decisions).toEqual(["allow_once"]);
    view.unmount();
  });

  test("navigates horizontal permission actions with left and right arrows", async () => {
    const decisions: string[] = [];
    const view = render(
      <TerminalSizeContext.Provider value={{ columns: 80, rows: 24 }}>
        <PermissionPrompt
          request={{ id: "bash-horizontal", tool: "bash", pattern: "bun test", level: "warning" }}
          onDecide={(decision) => decisions.push(typeof decision === "string" ? decision : decision.decision)}
        />
      </TerminalSizeContext.Provider>,
    );
    await sleep(30);
    view.stdin.write("\x1b[C");
    await sleep(20);
    expect(view.lastFrame()).toContain("remember until exit");
    view.stdin.write("\r");
    await sleep(20);
    expect(decisions).toEqual(["allow"]);
    view.unmount();
  });
});
