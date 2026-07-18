import { describe, expect, test } from "bun:test";
import { groupAdjacentToolBlocks } from "../src/tui/conversation/tool-grouping.js";
import type { FlowBlock } from "../src/tui/conversation/block-flow.js";

const tool = (sourceIndex: number, name: string, pending = false): FlowBlock => ({
  sourceIndex,
  block: { type: "tool", id: String(sourceIndex), tool: name, args: "{}", pending },
});

describe("tool activity grouping", () => {
  test("groups adjacent related tools and preserves source identity", () => {
    const grouped = groupAdjacentToolBlocks(
      [tool(0, "read"), tool(1, "read"), tool(2, "grep")],
      (block) => block.pending ? undefined : block.tool,
    );
    expect(grouped[0]).toMatchObject({
      kind: "tool-group",
      key: "read",
      entries: [{ sourceIndex: 0 }, { sourceIndex: 1 }],
    });
    expect(grouped[1]).toMatchObject({ kind: "single", entry: { sourceIndex: 2 } });
  });

  test("never groups across prose or pending activity", () => {
    const prose: FlowBlock = { sourceIndex: 1, block: { type: "text", content: "Result" } };
    const grouped = groupAdjacentToolBlocks(
      [tool(0, "read"), prose, tool(2, "read"), tool(3, "read", true)],
      (block) => block.pending ? undefined : block.tool,
    );
    expect(grouped.map((item) => item.kind)).toEqual(["single", "single", "single", "single"]);
  });
});
