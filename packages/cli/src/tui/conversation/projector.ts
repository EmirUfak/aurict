import { glyph, terminalText } from "../terminal-glyphs.js";
import { activityLabel, type RunActivity } from "../run-status.js";
import { wrapLine } from "../event-system/wrap-line.js";
import type { TranscriptMessage, TranscriptBlock } from "./types.js";
import { parseToolArtifact, type ToolArtifact } from "./tool-artifact.js";
import { coalesceInterruptedAssistantBlocks } from "./block-flow.js";
import { resolveLivePresentation } from "./live-state.js";
import { groupAdjacentToolBlocks } from "./tool-grouping.js";
import { isMarkdownHeading, isMarkdownListItem, proseLayout, standaloneSectionTitle } from "./readability.js";

export type TranscriptTone =
  | "user" | "assistant" | "tool" | "error" | "muted"
  | "heading" | "code" | "quote" | "thinking" | "success" | "bullet";

export interface TranscriptSegment {
  text: string;
  tone?: TranscriptTone;
  bold?: boolean;
  italic?: boolean;
  dim?: boolean;
}

export interface TranscriptRow {
  id: string;
  segments: TranscriptSegment[];
  detailId?: string;
}

export interface TranscriptLine {
  id: string;
  text: string;
  tone: TranscriptTone;
  bold?: boolean;
  italic?: boolean;
  detailId?: string;
}

export interface ProjectOptions {
  messages: TranscriptMessage[];
  width: number;
  streamingText: string | null;
  streamingReason: string | null;
  streamingError: string | null;
  loading?: boolean;
  activity?: RunActivity;
  activeTool?: string;
  paused?: boolean;
}

export type LiveTranscriptOptions = Omit<ProjectOptions, "messages"> & {
  hasAssistantHeader?: boolean;
};

const ANSI = /\x1B\[[0-?]*[ -/]*[@-~]/g;

function clean(text: string): string {
  return text.replace(ANSI, "").replace(/\r/g, "").replace(/\t/g, "    ");
}

export function wrapTranscriptText(text: string, width: number): string[] {
  const output: string[] = [];
  for (const line of clean(text).split("\n")) output.push(...wrapLine(line, Math.max(12, width)));
  return output.length > 0 ? output : [""];
}

function inlineSegments(text: string, tone: TranscriptTone): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) segments.push({ text: text.slice(cursor, index), tone });
    const token = match[0];
    if (token.startsWith("`")) segments.push({ text: token.slice(1, -1), tone: "code" });
    else segments.push({ text: token.slice(2, -2), tone, bold: true });
    cursor = index + token.length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), tone });
  return segments.length > 0 ? segments : [{ text: "", tone }];
}

function wrapSegments(segments: TranscriptSegment[], width: number): TranscriptSegment[][] {
  const max = Math.max(12, width);
  const rows: TranscriptSegment[][] = [[]];
  let used = 0;
  for (const segment of segments) {
    let rest = segment.text;
    while (rest.length > 0) {
      const room = max - used;
      if (room === 0) {
        rows.push([]);
        used = 0;
        continue;
      }
      let take = Math.min(room, rest.length);
      if (take < rest.length) {
        const breakAt = rest.slice(0, take + 1).lastIndexOf(" ");
        if (breakAt > 0) take = breakAt;
      }
      const part = rest.slice(0, take);
      rows[rows.length - 1]!.push({ ...segment, text: part });
      used += part.length;
      rest = rest.slice(take);
      if (rest.startsWith(" ")) rest = rest.slice(1);
      if (rest.length > 0) {
        rows.push([]);
        used = 0;
      }
    }
  }
  return rows;
}

function pushWrapped(rows: TranscriptRow[], id: string, segments: TranscriptSegment[], width: number, detailId?: string): void {
  wrapSegments(segments, width).forEach((line, index) => rows.push({
    id: `${id}:${index}`,
    segments: line,
    ...(detailId ? { detailId } : {}),
  }));
}

function pushText(rows: TranscriptRow[], id: string, text: string, tone: TranscriptTone, width: number, detailId?: string): void {
  for (const [lineIndex, line] of clean(text).split("\n").entries())
    pushWrapped(rows, `${id}:${lineIndex}`, [{ text: line, tone }], width, detailId);
}

function isBlankRow(row: TranscriptRow | undefined): boolean {
  return Boolean(row) && row!.segments.every((segment) => segment.text === "");
}

function pushGap(rows: TranscriptRow[], id: string): void {
  if (rows.length === 0) return;
  if (!isBlankRow(rows[rows.length - 1]))
    rows.push({ id, segments: [{ text: "", tone: "muted" }] });
}

function markdownSegments(line: string, tone: TranscriptTone, inCode: boolean): { segments: TranscriptSegment[]; toggleCode: boolean } {
  const fence = line.match(/^```\s*([^\s]*)/);
  if (fence) return { segments: [{ text: inCode ? glyph("close") : `${glyph("open")} ${fence[1] || "code"}`, tone: "code" }], toggleCode: true };
  if (inCode) return { segments: [{ text: line, tone: "code" }], toggleCode: false };
  const heading = line.match(/^(#{1,6})\s+(.+)$/);
  if (heading) {
    const level = heading[1]!.length;
    return {
      segments: [{
        text: `${glyph(level < 3 ? "headingMajor" : "headingMinor")} ${heading[2]!}`,
        tone: level <= 2 ? "heading" : "assistant",
        ...(level <= 3 ? { bold: true } : {}),
      }],
      toggleCode: false,
    };
  }
  const sectionTitle = standaloneSectionTitle(line);
  if (sectionTitle) return { segments: [{ text: sectionTitle, tone: "heading", bold: true }], toggleCode: false };
  if (/^(---+|\*\*\*+)\s*$/.test(line)) return { segments: [{ text: glyph("divider").repeat(16), tone: "muted" }], toggleCode: false };
  if (line.startsWith(">")) return { segments: [{ text: `${glyph("quote")} ${line.replace(/^>\s?/, "")}`, tone: "quote", italic: true }], toggleCode: false };
  const task = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.*)$/);
  if (task) return { segments: [{ text: `${task[1]}${task[2]!.toLowerCase() === "x" ? glyph("done") : glyph("todo")} `, tone: task[2]!.toLowerCase() === "x" ? "success" : "muted" }, ...inlineSegments(task[3]!, tone)], toggleCode: false };
  const list = line.match(/^(\s*)[-*]\s+(.*)$/);
  if (list) return { segments: [{ text: `${list[1]}${glyph("bullet")} `, tone: "bullet" }, ...inlineSegments(list[2]!, tone)], toggleCode: false };
  return { segments: inlineSegments(line, tone), toggleCode: false };
}

function pushMarkdown(rows: TranscriptRow[], id: string, text: string, tone: TranscriptTone, width: number): void {
  let inCode = false;
  const layout = proseLayout(width);
  const inset = layout.leftInset > 0 ? " ".repeat(layout.leftInset) : "";
  const sources = clean(text).split("\n");
  for (const [index, source] of sources.entries()) {
    if (!inCode && !source.trim()) {
      pushGap(rows, `${id}:${index}:gap`);
      continue;
    }
    const sectionHeading = !inCode && (isMarkdownHeading(source) || standaloneSectionTitle(source) !== undefined);
    const listItem = !inCode && isMarkdownListItem(source);
    const previousListItem = index > 0 && isMarkdownListItem(sources[index - 1]!);
    const nextListItem = index + 1 < sources.length && isMarkdownListItem(sources[index + 1]!);
    if (sectionHeading) pushGap(rows, `${id}:${index}:before`);
    if (listItem && !previousListItem) pushGap(rows, `${id}:${index}:list-before`);
    const formatted = markdownSegments(source, tone, inCode);
    const codeLine = inCode || formatted.toggleCode;
    if (formatted.toggleCode) inCode = !inCode;
    const firstRow = rows.length;
    pushWrapped(rows, `${id}:${index}`, formatted.segments, codeLine ? width : layout.contentWidth);
    if (inset && !codeLine) {
      for (let rowIndex = firstRow; rowIndex < rows.length; rowIndex++)
        rows[rowIndex]!.segments.unshift({ text: inset, tone: "muted" });
    }
    if (sectionHeading) pushGap(rows, `${id}:${index}:after`);
    if (listItem && !nextListItem) pushGap(rows, `${id}:${index}:list-after`);
  }
}

function thinkingSummary(content: string): string {
  const normalized = content.toLowerCase();
  const stage = /test|verify|check|lint|build/.test(normalized) ? "verifying"
    : /search|research|source|investigat/.test(normalized) ? "researching"
      : /plan|approach|step|first/.test(normalized) ? "planning" : "thinking";
  return `${glyph("thinking")} ${stage} · Ctrl+O inspect`;
}

function toolLabel(tool: string): { done: string; pending: string } {
  const labels: Record<string, { done: string; pending: string }> = {
    bash: { done: "Ran", pending: "Running" }, shell: { done: "Ran", pending: "Running" },
    read: { done: "Read", pending: "Reading" }, write: { done: "Wrote", pending: "Writing" },
    edit: { done: "Edited", pending: "Editing" }, apply_patch: { done: "Patched", pending: "Patching" },
    grep: { done: "Searched", pending: "Searching" }, glob: { done: "Explored", pending: "Exploring" },
    websearch: { done: "Searched web", pending: "Searching web" }, webfetch: { done: "Fetched", pending: "Fetching" },
    subagent: { done: "Delegated", pending: "Delegating" },
  };
  return labels[tool] ?? { done: `Used ${tool}`, pending: `Using ${tool}` };
}

function argSummary(artifact: ToolArtifact): string {
  if (artifact.command) return artifact.command.replace(/\n/g, " ");
  try {
    const parsed = JSON.parse(artifact.args) as Record<string, unknown>;
    for (const key of ["path", "query", "pattern", "url"])
      if (typeof parsed[key] === "string") return String(parsed[key]).replace(/\n/g, " ");
  } catch {
    // Plain-text tool input is valid and displayed below.
  }
  return artifact.args.replace(/\n/g, " ");
}

function shortSubject(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, Math.max(1, max - 1))}${glyph("ellipsis")}`;
}

function pushTool(rows: TranscriptRow[], id: string, block: Extract<TranscriptBlock, { type: "tool" }>, width: number): void {
  const artifact = parseToolArtifact(block.tool, block.args, block.resultContent, block.artifact);
  const presentation = toolLabel(block.tool);
  const failed = !block.pending && artifact.kind === "error";
  const rawSubject = artifact.files && artifact.files.length > 1
    ? `${artifact.files.length} files`
    : artifact.filePath ?? argSummary(artifact);
  const subject = shortSubject(rawSubject, Math.max(24, Math.min(96, width - 18)));
  pushWrapped(rows, `${id}:summary`, [
    { text: `${block.pending ? glyph("working") : failed ? glyph("error") : glyph("bullet")} `, tone: block.pending ? "thinking" : failed ? "error" : "tool" },
    { text: block.pending ? presentation.pending : presentation.done, tone: failed ? "error" : block.pending ? "thinking" : "tool", bold: true },
    ...(subject ? [{ text: ` ${subject}`, tone: "assistant" as const }] : []),
    ...(block.durationMs !== undefined && block.durationMs >= 1_000 ? [{ text: ` · ${formatDuration(block.durationMs)}`, tone: "muted" as const }] : []),
  ], width, id);
  if (block.pending) return;
  if (artifact.kind === "diff") {
    const target = artifact.files && artifact.files.length > 1
      ? `${artifact.files.length} files · ${artifact.files.join(", ")}`
      : artifact.filePath ?? "file";
    pushWrapped(rows, `${id}:result`, [{ text: `  ${target}`, tone: "assistant" }, { text: `  +${artifact.additions ?? 0} −${artifact.deletions ?? 0} · Ctrl+O diff`, tone: "muted" }], width, id);
  } else if (artifact.kind === "write") {
    pushWrapped(rows, `${id}:result`, [{ text: `  ${artifact.filePath ?? "file"}`, tone: "assistant" }, { text: `  ${artifact.totalLines ?? 0} lines · Ctrl+O preview`, tone: "muted" }], width, id);
  } else if (artifact.kind === "patch") {
    pushWrapped(rows, `${id}:result`, [
      { text: `  ${glyph("close")} +${artifact.additions ?? 0} −${artifact.deletions ?? 0} · Ctrl+O details`, tone: "muted" },
    ], width, id);
  } else if (artifact.kind === "error") {
    pushText(rows, `${id}:error`, `  ${glyph("quote")} ${artifact.output.split("\n")[0] ?? "tool failed"} · Ctrl+O details`, "error", width, id);
  } else if (artifact.result && (artifact.kind === "shell" || !["read", "grep", "glob", "websearch", "webfetch"].includes(block.tool))) {
    const source = clean(artifact.result).split("\n");
    const preview = source.length > 5 ? [...source.slice(0, 3), source[source.length - 1]!] : source;
    preview.forEach((line, index) => pushText(rows, `${id}:output:${index}`, `  ${glyph("quote")} ${line}`, "muted", width, id));
    if (source.length > preview.length) pushText(rows, `${id}:hidden`, `  ${glyph("close")} ${source.length - preview.length} of ${source.length} lines hidden · Ctrl+O inspect`, "muted", width, id);
  }
}

const GROUPABLE_TOOL_FAMILIES: Record<string, string> = {
  read: "read",
  grep: "search",
  glob: "search",
  websearch: "web",
  webfetch: "web",
  write: "change",
  edit: "change",
  apply_patch: "change",
};

function toolGroupKey(block: Extract<TranscriptBlock, { type: "tool" }>): string | undefined {
  if (block.pending) return undefined;
  const family = GROUPABLE_TOOL_FAMILIES[block.tool];
  if (!family) return undefined;
  const artifact = parseToolArtifact(block.tool, block.args, block.resultContent, block.artifact);
  return artifact.kind === "error" ? undefined : family;
}

function pushToolGroup(
  rows: TranscriptRow[],
  id: string,
  family: string,
  entries: Array<{ block: Extract<TranscriptBlock, { type: "tool" }>; sourceIndex: number }>,
  width: number,
): void {
  pushGap(rows, `${id}:before`);
  const artifacts = entries.map(({ block }) => parseToolArtifact(block.tool, block.args, block.resultContent, block.artifact));
  const paths = [...new Set(artifacts.map((artifact) => artifact.filePath).filter((path): path is string => Boolean(path)))];
  const additions = artifacts.reduce((sum, artifact) => sum + (artifact.additions ?? 0), 0);
  const deletions = artifacts.reduce((sum, artifact) => sum + (artifact.deletions ?? 0), 0);
  const duration = entries.reduce((sum, { block }) => sum + (block.durationMs ?? 0), 0);
  const noun = family === "read" ? "Read"
    : family === "search" ? "Searched"
      : family === "web" ? "Researched"
        : "Changed";
  const unit = family === "search" ? "queries" : family === "web" ? "sources" : "files";
  const sample = paths.length > 0
    ? ` · ${shortSubject(paths.slice(0, 2).join(", "), Math.max(18, width - 34))}${paths.length > 2 ? ` +${paths.length - 2}` : ""}`
    : "";
  const diff = family === "change" ? ` · +${additions} −${deletions}` : "";
  const timing = duration >= 1_000 ? ` · ${formatDuration(duration)}` : "";
  pushWrapped(rows, `${id}:summary`, [
    { text: `${glyph("bullet")} `, tone: "tool" },
    { text: `${noun} ${entries.length} ${unit}`, tone: "tool", bold: true },
    { text: `${sample}${diff}${timing} · Ctrl+O inspect`, tone: "muted" },
  ], width, id);
  pushGap(rows, `${id}:after`);
}

function formatDuration(durationMs: number): string {
  return durationMs < 1_000 ? `${durationMs}ms` : `${(durationMs / 1_000).toFixed(durationMs < 10_000 ? 1 : 0)}s`;
}

function timestamp(timestamp: number | undefined): string {
  if (timestamp === undefined) return "";
  const date = new Date(timestamp);
  return ` · ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}

function projectMessage(rows: TranscriptRow[], message: TranscriptMessage, index: number, width: number): void {
  const id = message.id ?? `message-${index}`;
  if (message.role === "system") {
    pushWrapped(rows, `${id}:notice`, [{ text: `${glyph("system")} `, tone: "muted" }, { text: message.content, tone: "muted" }], width);
    return;
  }
  if (message.role === "error") {
    const error = message.errorPresentation;
    pushWrapped(rows, `${id}:error`, [{ text: `${glyph("error")} `, tone: "error", bold: true }, { text: error?.title ?? message.content, tone: "error", bold: true }], width);
    if (error?.detail && error.detail !== error.title) pushText(rows, `${id}:detail`, `  ${error.detail}`, "muted", width);
    if (error?.action) pushText(rows, `${id}:action`, `  ${glyph("action")} ${error.action}`, "muted", width);
    pushGap(rows, `${id}:gap`);
    return;
  }
  if (message.role === "tool_result") return;
  if (message.role === "tool_call") {
    pushTool(rows, `${id}:tool`, { type: "tool", id, tool: message.tool ?? "tool", args: message.content, pending: Boolean(message.pending), ...(message.resultContent !== undefined ? { resultContent: message.resultContent } : {}) }, width);
    return;
  }
  const tone = message.role === "user" ? "user" : "assistant";
  const toolOnly = message.role === "assistant" && Boolean(message.blocks?.length) && message.blocks!.every((block) => block.type === "tool");
  if (!toolOnly) {
    const marker = message.role === "user" ? glyph("headingMinor") : glyph("assistant");
    rows.push({ id: `${id}:header`, segments: [{ text: `${marker} ${message.role === "user" ? "You" : "Aurict"}${timestamp(message.timestamp)}`, tone, bold: true }] });
  }
  if (message.reasoningContent) rows.push({ id: `${id}:thinking`, segments: [{ text: thinkingSummary(message.reasoningContent), tone: "thinking", italic: true }], detailId: `${id}:thinking` });
  if (message.blocks?.length) {
    const displayBlocks = message.role === "assistant"
      ? coalesceInterruptedAssistantBlocks(message.blocks)
      : message.blocks.map((block, sourceIndex) => ({ block, sourceIndex }));
    const groupedBlocks = groupAdjacentToolBlocks(displayBlocks, toolGroupKey);
    for (const item of groupedBlocks) {
      const { block, sourceIndex } = item.kind === "single" ? item.entry : item.entries[0]!;
      if (item.kind === "tool-group") {
        pushToolGroup(rows, `${id}:tool:${sourceIndex}`, item.key, item.entries, width);
      } else if (block.type === "tool") pushTool(rows, `${id}:tool:${sourceIndex}`, block, width);
      else {
        if (block.reasoningContent) rows.push({ id: `${id}:text:${sourceIndex}:thinking`, segments: [{ text: thinkingSummary(block.reasoningContent), tone: "thinking", italic: true }], detailId: `${id}:text:${sourceIndex}:thinking` });
        pushMarkdown(rows, `${id}:text:${sourceIndex}`, block.content, tone, width);
      }
    }
  } else pushMarkdown(rows, `${id}:body`, message.resultContent ?? message.content, tone, width);
  pushGap(rows, `${id}:gap`);
}

export function projectStableTranscript(messages: TranscriptMessage[], width: number): TranscriptRow[] {
  const rows: TranscriptRow[] = [];
  const contentWidth = Math.max(12, width - 2);
  messages.forEach((message, index) => projectMessage(rows, message, index, contentWidth));
  return normalizeTerminalRows(rows);
}

export function projectLiveTranscript(options: LiveTranscriptOptions): TranscriptRow[] {
  const rows: TranscriptRow[] = [];
  const width = Math.max(12, options.width - 2);
  const presentation = resolveLivePresentation({
    loading: Boolean(options.loading),
    paused: Boolean(options.paused),
    hasText: Boolean(options.streamingText),
    hasReasoning: Boolean(options.streamingReason),
    hasActiveTool: Boolean(options.activeTool),
  });
  if (presentation === "reasoning")
    rows.push({ id: "stream:reason", segments: [{ text: `${glyph("thinking")} thinking…`, tone: "thinking", italic: true }] });
  if (presentation === "text" && options.streamingText) {
    if (!options.hasAssistantHeader)
      rows.push({ id: "stream:header", segments: [{ text: `${glyph("assistant")} Aurict`, tone: "assistant", bold: true }] });
    pushMarkdown(rows, "stream:text", options.streamingText, "assistant", width);
  }
  if (presentation === "paused" || presentation === "activity") {
    const paused = presentation === "paused";
    const label = paused ? "live output paused · Ctrl+L resume" : activityLabel(options.activity);
    rows.push({
      id: "stream:activity",
      segments: [
        { text: `${glyph(paused ? "paused" : "working")} `, tone: "thinking" },
        { text: label, tone: "muted", italic: true },
      ],
    });
  }
  if (options.streamingError) pushText(rows, "stream:error", `${glyph("error")} ${options.streamingError}`, "error", width);
  return normalizeTerminalRows(rows);
}

function normalizeTerminalRows(rows: TranscriptRow[]): TranscriptRow[] {
  return rows.map((row) => ({
    ...row,
    segments: row.segments.map((segment) => ({ ...segment, text: terminalText(segment.text) })),
  }));
}

function hasAssistantHeader(rows: TranscriptRow[]): boolean {
  return rows.some((row) => row.id.endsWith(":header") && row.segments.some((segment) => segment.text.toLowerCase().includes("aurict")));
}

export function projectTranscript(options: ProjectOptions): TranscriptRow[] {
  const stable = projectStableTranscript(options.messages, options.width);
  const live = projectLiveTranscript({
    width: options.width,
    streamingText: options.streamingText,
    streamingReason: options.streamingReason,
    streamingError: options.streamingError,
    hasAssistantHeader: hasAssistantHeader(stable),
    ...(options.loading !== undefined ? { loading: options.loading } : {}),
    ...(options.activity !== undefined ? { activity: options.activity } : {}),
    ...(options.activeTool !== undefined ? { activeTool: options.activeTool } : {}),
    ...(options.paused !== undefined ? { paused: options.paused } : {}),
  });
  const rows = [...stable, ...live];
  return rows.length > 0 ? rows : [{ id: "empty", segments: [{ text: "", tone: "muted" }] }];
}

/** Compatibility export for callers moving from the old flat line buffer. */
export const buildTranscriptLines = (
  messages: TranscriptMessage[], width: number, streamingText: string | null,
  streamingReason: string | null, streamingError: string | null,
): TranscriptLine[] => projectTranscript({ messages, width, streamingText, streamingReason, streamingError }).map((row) => {
  const first = row.segments[0];
  return {
    id: row.id,
    text: row.segments.map((segment) => segment.text).join(""),
    tone: first?.tone ?? "muted",
    ...(row.segments.some((segment) => segment.bold) ? { bold: true } : {}),
    ...(row.segments.some((segment) => segment.italic) ? { italic: true } : {}),
    ...(row.detailId ? { detailId: row.detailId } : {}),
  };
});
