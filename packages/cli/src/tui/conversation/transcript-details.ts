import type { DisplayMessage } from "../Message.js";

export type TranscriptDetailKind = "tool" | "reasoning" | "diff" | "write";

export interface TranscriptDetail {
  id: string;
  kind: TranscriptDetailKind;
  title: string;
  content: string;
  toolName?: string;
  rawDiff?: string;
  filePath?: string;
  totalLines?: number;
  additions?: number;
  deletions?: number;
}

interface ToolDetailInput {
  id: string;
  tool: string;
  args: string;
  resultContent?: string;
}

function pathFromArgs(args: string): string | undefined {
  try {
    const parsed = JSON.parse(args) as Record<string, unknown>;
    for (const key of ["path", "filePath", "file"]) {
      const value = parsed[key];
      if (typeof value === "string" && value) return value;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function pathFromOutput(output: string): string | undefined {
  const match = output.match(/^(?:Updated|Created)\s+(.+?)(?:\s+\(no changes\))?$/m);
  return match?.[1]?.trim();
}

function diffStats(rawDiff: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of rawDiff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
    if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
  }
  return { additions, deletions };
}

function parseWriteCreate(output: string): { totalLines: number; preview: string } | null {
  const marker = "__WRITE_CREATE__\n";
  const markerIndex = output.indexOf(marker);
  if (markerIndex === -1) return null;
  const lines = output.slice(markerIndex + marker.length).split("\n");
  const totalLines = Number(lines.shift());
  if (!Number.isInteger(totalLines) || totalLines < 0) return null;
  return { totalLines, preview: lines.join("\n") };
}

export function createToolDetail({ id, tool, args, resultContent }: ToolDetailInput): TranscriptDetail {
  const content = resultContent ?? args;
  const outputPath = resultContent ? pathFromOutput(resultContent) : undefined;
  const filePath = outputPath ?? pathFromArgs(args);
  const writeCreate = resultContent ? parseWriteCreate(resultContent) : null;
  const diffMarker = "__UNIFIED_DIFF__\n";
  const diffIndex = resultContent?.indexOf(diffMarker) ?? -1;

  if (diffIndex >= 0 && resultContent) {
    const rawDiff = resultContent.slice(diffIndex + diffMarker.length);
    const { additions, deletions } = diffStats(rawDiff);
    return {
      id,
      kind: "diff",
      title: `changed ${filePath ?? "file"}`,
      content: resultContent,
      toolName: tool,
      rawDiff,
      ...(filePath ? { filePath } : {}),
      additions,
      deletions,
    };
  }

  if (writeCreate && resultContent) {
    return {
      id,
      kind: "write",
      title: `created ${filePath ?? "file"}`,
      content: resultContent,
      toolName: tool,
      ...(filePath ? { filePath } : {}),
      totalLines: writeCreate.totalLines,
    };
  }

  return {
    id,
    kind: "tool",
    title: tool,
    content,
    toolName: tool,
    ...(filePath ? { filePath } : {}),
  };
}

function addReasoningDetail(
  details: TranscriptDetail[],
  id: string,
  content: string,
): void {
  if (!content.trim()) return;
  details.push({ id, kind: "reasoning", title: "thinking", content });
}

export function collectTranscriptDetails(messages: DisplayMessage[]): TranscriptDetail[] {
  const details: TranscriptDetail[] = [];
  for (const [messageIndex, message] of messages.entries()) {
    const messageId = message.id ?? `message-${messageIndex}`;
    if (message.reasoningContent)
      addReasoningDetail(details, `${messageId}:thinking`, message.reasoningContent);

    if (message.blocks?.length) {
      for (const [blockIndex, block] of message.blocks.entries()) {
        if (block.type === "text") {
          if (block.reasoningContent)
            addReasoningDetail(
              details,
              `${messageId}:text:${blockIndex}:thinking`,
              block.reasoningContent,
            );
          continue;
        }
        details.push(
          createToolDetail({
            id: `${messageId}:tool:${blockIndex}`,
            tool: block.tool,
            args: block.args,
            ...(block.resultContent !== undefined ? { resultContent: block.resultContent } : {}),
          }),
        );
      }
      continue;
    }

    if (message.role === "tool_call") {
      details.push(
        createToolDetail({
          id: `${messageId}:tool`,
          tool: message.tool ?? "tool",
          args: message.content,
          ...(message.resultContent !== undefined ? { resultContent: message.resultContent } : {}),
        }),
      );
    }
  }
  return details;
}

export function writePreview(content: string): string | undefined {
  return parseWriteCreate(content)?.preview;
}
