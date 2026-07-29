import type { TranscriptBlock } from "./types.js";

type TextBlock = Extract<TranscriptBlock, { type: "text" }>;

export interface FlowBlock {
  block: TranscriptBlock;
  sourceIndex: number;
}

const TERMINAL_PUNCTUATION = /[.!?…:;\)\]"'`]$/u;
const STRUCTURED_LINE = /^\s*(?:[-*+]\s|\d+[.)]\s|#{1,6}\s|>|```)/u;
const MISSING_SENTENCE_SPACE = /([.!?…])(?=[A-ZÇĞİÖŞÜ])/gu;

function splitIncompleteTail(content: string): { settled: string; tail: string } | null {
  const trimmed = content.trimEnd();
  if (!trimmed || TERMINAL_PUNCTUATION.test(trimmed)) return null;

  const paragraphBreak = trimmed.lastIndexOf("\n\n");
  const tail = trimmed.slice(paragraphBreak < 0 ? 0 : paragraphBreak + 2).trim();
  if (!tail || STRUCTURED_LINE.test(tail)) return null;

  return {
    settled: paragraphBreak < 0 ? "" : trimmed.slice(0, paragraphBreak).trimEnd(),
    tail,
  };
}

function joinInterruptedProse(left: string, right: string): string {
  const before = left.trimEnd();
  const after = right.trimStart();
  if (!before) return after;
  if (!after) return before;
  const separator = /^[,.;:!?…\)\]]/u.test(after) || /[(\[/]$/u.test(before) ? "" : " ";
  return `${before}${separator}${after}`.replace(MISSING_SENTENCE_SPACE, "$1 ");
}

/**
 * Providers may emit a tool call halfway through a sentence. Keep the tool's
 * chronological position, but defer only the unfinished trailing paragraph so
 * the visible prose resumes as one readable unit after the tool activity.
 */
export function coalesceInterruptedAssistantBlocks(blocks: TranscriptBlock[]): FlowBlock[] {
  const output: FlowBlock[] = [];
  let deferred: { block: TextBlock; sourceIndex: number } | null = null;

  for (let index = 0; index < blocks.length; index++) {
    const source = blocks[index]!;
    if (source.type === "tool") {
      output.push({ block: source, sourceIndex: index });
      continue;
    }

    let block = source;
    if (deferred) {
      block = {
        ...source,
        content: joinInterruptedProse(deferred.block.content, source.content),
        ...(deferred.block.reasoningContent && !source.reasoningContent
          ? { reasoningContent: deferred.block.reasoningContent }
          : {}),
      };
      deferred = null;
    }

    if (blocks[index + 1]?.type === "tool") {
      const split = splitIncompleteTail(block.content);
      if (split) {
        if (split.settled) output.push({ block: { ...block, content: split.settled }, sourceIndex: index });
        deferred = {
          block: split.settled
            ? { type: "text", content: split.tail }
            : { ...block, content: split.tail },
          sourceIndex: index,
        };
        continue;
      }
    }

    output.push({ block, sourceIndex: index });
  }

  if (deferred) output.push(deferred);
  return output;
}

function repeatSignature(block: TextBlock): string | null {
  const content = block.content.replace(/\s+/gu, " ").trim();
  if (content.length < 12 || content.includes("```")) return null;
  return content;
}

/**
 * Some tool-capable models repeat the same progress sentence before every
 * tool call. Keep the first visible occurrence while retaining every raw block
 * in the message state for provider history and diagnostics.
 */
export function collapseRepeatedAssistantText(flow: FlowBlock[]): FlowBlock[] {
  const seen = new Set<string>();
  return flow.filter(entry => {
    if (entry.block.type !== "text") return true;
    const signature = repeatSignature(entry.block);
    if (!signature) return true;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}
