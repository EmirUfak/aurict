import type { DisplayMessage } from "../Message.js";
import { wrapLine } from "../event-system/wrap-line.js";
import { glyph } from "../terminal-glyphs.js";

export type TranscriptTone =
  | "user"
  | "assistant"
  | "tool"
  | "error"
  | "muted"
  | "heading"
  | "code"
  | "quote"
  | "thinking";

export interface TranscriptLine {
  id: string;
  text: string;
  tone: TranscriptTone;
  bold?: boolean;
  italic?: boolean;
}

function timestampLabel(timestamp: number | undefined): string {
  if (timestamp === undefined) return "";
  const date = new Date(timestamp);
  return ` · ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function clean(text: string): string {
  return text
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\r/g, "")
    .replace(/\t/g, "    ");
}

export function wrapTranscriptText(text: string, width: number): string[] {
  const output: string[] = [];
  for (const source of clean(text).split("\n")) {
    output.push(...wrapLine(source, Math.max(12, width)));
  }
  return output.length ? output : [""];
}

function add(
  lines: TranscriptLine[],
  id: string,
  text: string,
  tone: TranscriptTone,
  width: number,
): void {
  wrapTranscriptText(text, width).forEach((part, index) =>
    lines.push({ id: `${id}:${index}`, text: part, tone }),
  );
}

function markdownLine(line: string, inCode: boolean): {
  text: string;
  tone?: TranscriptTone;
  bold?: boolean;
  italic?: boolean;
  toggleCode: boolean;
} {
  const fence = line.match(/^```\s*([^\s]*)/);
  if (fence)
    return {
      text: inCode ? glyph("close") : `${glyph("open")} ${fence[1] || "code"}`,
      tone: "code",
      toggleCode: true,
    };
  if (inCode) return { text: line, tone: "code", toggleCode: false };

  const heading = line.match(/^(#{1,6})\s+(.+)$/);
  if (heading)
    return {
      text: `${heading[1]!.length < 3 ? "◆" : "▸"} ${heading[2]!}`,
      tone: "heading",
      bold: true,
      toggleCode: false,
    };
  if (/^(---+|\*\*\*+)\s*$/.test(line))
    return { text: "────────────────", tone: "muted", toggleCode: false };
  if (line.startsWith(">"))
    return {
      text: `${glyph("quote")} ${line.replace(/^>\s?/, "")}`,
      tone: "quote",
      italic: true,
      toggleCode: false,
    };

  const task = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.*)$/);
  if (task)
    return {
      text: `${task[1]}${task[2]!.toLowerCase() === "x" ? glyph("done") : glyph("todo")} ${task[3]}`,
      toggleCode: false,
    };
  const list = line.match(/^(\s*)[-*]\s+(.*)$/);
  if (list)
    return { text: `${list[1]}${glyph("bullet")} ${list[2]}`, toggleCode: false };

  return {
    text: line
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/`([^`]+)`/g, "$1"),
    toggleCode: false,
  };
}

function addMarkdown(
  lines: TranscriptLine[],
  id: string,
  text: string,
  tone: TranscriptTone,
  width: number,
): void {
  let inCode = false;
  for (const [index, source] of clean(text).split("\n").entries()) {
    const formatted = markdownLine(source, inCode);
    if (formatted.toggleCode) inCode = !inCode;
    wrapTranscriptText(formatted.text, width).forEach((part, partIndex) =>
      lines.push({
        id: `${id}:${index}:${partIndex}`,
        text: part,
        tone: formatted.tone ?? tone,
        ...(formatted.bold ? { bold: true } : {}),
        ...(formatted.italic ? { italic: true } : {}),
      }),
    );
  }
}

function addThinkingSummary(
  lines: TranscriptLine[],
  id: string,
  content: string,
): void {
  const lineCount = content.split("\n").filter((line) => line.trim()).length;
  const normalized = content.toLowerCase();
  const stage = /test|verify|check|lint|build/.test(normalized)
    ? "verifying"
    : /search|research|source|investigat/.test(normalized)
      ? "researching"
      : /plan|approach|step|first/.test(normalized)
        ? "planning"
        : "thinking";
  lines.push({
    id,
    text: `${glyph("thinking")} ${stage} · ${lineCount || 1} ${lineCount === 1 ? "line" : "lines"} · Ctrl+O expand`,
    tone: "thinking",
    italic: true,
  });
}

function toolPresentation(tool: string): { icon: string; label: string; intent: string } {
  const presentations: Record<string, { icon: string; label: string; intent: string }> = {
    bash:        { icon: glyph("tool"), label: "shell", intent: "execute command" },
    shell:       { icon: glyph("tool"), label: "shell", intent: "execute command" },
    read:        { icon: glyph("search"), label: "read", intent: "inspect file" },
    write:       { icon: glyph("write"), label: "write", intent: "create file" },
    edit:        { icon: glyph("write"), label: "edit", intent: "change file" },
    apply_patch: { icon: "±", label: "patch", intent: "apply changes" },
    grep:        { icon: glyph("search"), label: "search", intent: "find content" },
    glob:        { icon: glyph("search"), label: "paths", intent: "find files" },
    websearch:   { icon: glyph("web"), label: "research", intent: "search web" },
    webfetch:    { icon: glyph("web"), label: "fetch", intent: "retrieve source" },
    subagent:    { icon: glyph("agent"), label: "agent", intent: "delegate work" },
  };
  return presentations[tool] ?? { icon: glyph("system"), label: tool, intent: "run tool" };
}

function summarizeToolArgs(args: string): string {
  try {
    const parsed = JSON.parse(args) as Record<string, unknown>;
    for (const key of ["command", "path", "query", "pattern", "url"]) {
      const value = parsed[key];
      if (typeof value === "string" && value) return value.replace(/\n/g, " ");
    }
  } catch {
    // Tool args can be plain text; it is still safe to show a bounded preview.
  }
  return args.replace(/\n/g, " ");
}

function addToolPreview(
  lines: TranscriptLine[],
  id: string,
  tool: string,
  args: string,
  resultContent: string | undefined,
  pending: boolean,
  width: number,
): void {
  const presentation = toolPresentation(tool);
  lines.push({
    id: `${id}:header`,
    text: `╭─ ${presentation.icon} ${presentation.label} · ${pending ? "working…" : "complete"}`,
    tone: "tool",
    bold: true,
  });
  add(
    lines,
    `${id}:args`,
    `│ ${presentation.intent} · ${summarizeToolArgs(args)}`,
    "muted",
    width,
  );

  const source = resultContent ? clean(resultContent).split("\n") : [];
  const preview = source.length > 5
    ? [...source.slice(0, 4), source[source.length - 1]!]
    : source;
  for (const [index, output] of preview.entries())
    add(lines, `${id}:result:${index}`, `│ ${output}`, "muted", width);
  if (source.length > preview.length)
    lines.push({
      id: `${id}:hidden`,
      text: `│ ⋯ ${source.length - preview.length} lines hidden · Ctrl+O expand latest`,
      tone: "muted",
    });
  lines.push({
    id: `${id}:footer`,
    text: resultContent
      ? `╰─ ${source.length} output lines · Ctrl+O review latest`
      : "╰─ awaiting output",
    tone: "tool",
  });
}

export function buildTranscriptLines(
  messages: DisplayMessage[],
  width: number,
  streamingText: string | null,
  streamingReason: string | null,
  streamingError: string | null,
): TranscriptLine[] {
  const lines: TranscriptLine[] = [];
  const contentWidth = Math.max(12, width - 4);
  for (const [index, message] of messages.entries()) {
    const id = message.id ?? `message-${index}`;
    const tone: TranscriptTone =
      message.role === "user"
        ? "user"
        : message.role === "error"
          ? "error"
          : message.role === "tool_call"
            ? "tool"
            : "assistant";
    const label =
      message.role === "user"
        ? "you"
        : message.role === "assistant"
          ? "aurict"
          : (message.tool ?? message.role);
    const marker = message.role === "user"
      ? glyph("user")
      : message.role === "assistant"
        ? glyph("assistant")
        : glyph("system");
    lines.push({
      id: `${id}:header`,
      text: `${marker} ${label}${timestampLabel(message.timestamp)}`,
      tone,
      bold: true,
    });
    if (message.reasoningContent)
      addThinkingSummary(lines, `${id}:thinking`, message.reasoningContent);
    if (message.blocks?.length) {
      for (const [blockIndex, block] of message.blocks.entries()) {
        if (block.type === "text") {
          if (block.reasoningContent)
            addThinkingSummary(
              lines,
              `${id}:text:${blockIndex}:thinking`,
              block.reasoningContent,
            );
          addMarkdown(
            lines,
            `${id}:text:${blockIndex}`,
            block.content,
            tone,
            contentWidth,
          );
        } else
          addToolPreview(
            lines,
            `${id}:tool:${blockIndex}`,
            block.tool,
            block.args,
            block.resultContent,
            block.pending,
            contentWidth,
          );
      }
    } else {
      if (message.role === "assistant")
        addMarkdown(
          lines,
          `${id}:body`,
          message.resultContent ?? message.content,
          tone,
          contentWidth,
        );
      else if (message.role === "tool_call")
        addToolPreview(
          lines,
          `${id}:tool`,
          message.tool ?? "tool",
          message.content,
          message.resultContent,
          Boolean(message.pending),
          contentWidth,
        );
      else
        add(
          lines,
          `${id}:body`,
          message.resultContent ?? message.content,
          tone,
          contentWidth,
        );
    }
    lines.push({ id: `${id}:gap`, text: "", tone: "muted" });
  }
  if (streamingReason)
    add(
      lines,
      "stream:reason",
      `${glyph("thinking")} thinking in progress…\n${streamingReason}`,
      "thinking",
      contentWidth,
    );
  if (streamingText)
    add(
      lines,
      "stream:text",
      `${glyph("assistant")} aurict · responding…\n${streamingText}`,
      "assistant",
      contentWidth,
    );
  if (streamingError)
    add(lines, "stream:error", `✗ ${streamingError}`, "error", contentWidth);
  if (
    lines.length === 0 &&
    !streamingText &&
    !streamingReason &&
    !streamingError
  )
    lines.push({ id: "empty", text: "", tone: "muted" });
  return lines;
}
