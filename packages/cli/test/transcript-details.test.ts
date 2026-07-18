import { describe, expect, it } from "bun:test";
import {
  collectTranscriptDetails,
  createToolDetail,
  writePreview,
} from "../src/tui/conversation/transcript-details.js";
import type { DisplayMessage } from "../src/tui/conversation/types.js";

describe("transcript details", () => {
  it("uses the tool's emitted unified diff rather than assistant text", () => {
    const output = [
      "Updated src/answer.ts",
      "__UNIFIED_DIFF__",
      "--- a/src/answer.ts",
      "+++ b/src/answer.ts",
      "@@ -1 +1 @@",
      "-export const answer = 41;",
      "+export const answer = 42;",
    ].join("\n");
    const detail = createToolDetail({
      id: "tool-1",
      tool: "edit",
      args: JSON.stringify({ path: "src/answer.ts" }),
      resultContent: output,
    });

    expect(detail).toMatchObject({
      id: "tool-1",
      kind: "diff",
      filePath: "src/answer.ts",
      additions: 1,
      deletions: 1,
    });
    expect(detail.rawDiff).toContain("+export const answer = 42;");
  });

  it("keeps created-file previews separate from output artifacts", () => {
    const output = "Created src/new.ts\n__WRITE_CREATE__\n12\nexport const ready = true;";
    const detail = createToolDetail({
      id: "tool-2",
      tool: "write",
      args: JSON.stringify({ path: "src/new.ts" }),
      resultContent: output,
    });

    expect(detail).toMatchObject({
      kind: "write",
      filePath: "src/new.ts",
      totalLines: 12,
    });
    expect(writePreview(output)).toBe("export const ready = true;");
  });

  it("collects reasoning and every historical tool block with stable detail ids", () => {
    const messages: DisplayMessage[] = [{
      id: "assistant-1",
      role: "assistant",
      content: "",
      reasoningContent: "Inspect the current implementation first.",
      blocks: [{
        type: "tool",
        id: "tool-3",
        tool: "read",
        args: JSON.stringify({ path: "src/app.ts" }),
        pending: false,
        resultContent: "const app = createApp();",
      }],
    }];

    expect(collectTranscriptDetails(messages)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "assistant-1:thinking", kind: "reasoning" }),
      expect.objectContaining({ id: "assistant-1:tool:0", kind: "tool", toolName: "read" }),
    ]));
  });
});
