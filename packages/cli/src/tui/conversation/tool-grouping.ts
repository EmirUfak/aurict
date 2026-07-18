import type { FlowBlock } from "./block-flow.js";

type ToolFlowBlock = FlowBlock & {
  block: Extract<FlowBlock["block"], { type: "tool" }>;
};

export type GroupedFlowBlock =
  | { kind: "single"; entry: FlowBlock }
  | { kind: "tool-group"; key: string; entries: ToolFlowBlock[] };

/** Groups only directly-adjacent tool events; prose always remains a boundary. */
export function groupAdjacentToolBlocks(
  flow: FlowBlock[],
  keyFor: (block: ToolFlowBlock["block"]) => string | undefined,
): GroupedFlowBlock[] {
  const output: GroupedFlowBlock[] = [];
  let index = 0;
  while (index < flow.length) {
    const current = flow[index]!;
    if (current.block.type !== "tool") {
      output.push({ kind: "single", entry: current });
      index++;
      continue;
    }

    const key = keyFor(current.block);
    if (!key) {
      output.push({ kind: "single", entry: current });
      index++;
      continue;
    }

    const entries: ToolFlowBlock[] = [current as ToolFlowBlock];
    let cursor = index + 1;
    while (cursor < flow.length) {
      const candidate = flow[cursor]!;
      if (candidate.block.type !== "tool" || keyFor(candidate.block) !== key) break;
      entries.push(candidate as ToolFlowBlock);
      cursor++;
    }

    if (entries.length > 1) output.push({ kind: "tool-group", key, entries });
    else output.push({ kind: "single", entry: current });
    index = cursor;
  }
  return output;
}
