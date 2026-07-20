import type { ToolArtifact } from "./tool-artifact.js";
import { toolDisplayIdentity } from "./tool-identity.js";

export interface ToolRowModel {
  action: string;
  subject: string;
  spacer: string;
  metadata: string;
}

function argumentSubject(artifact: ToolArtifact): string {
  if (artifact.command) return artifact.command.replace(/\n/g, " ");
  try {
    const parsed = JSON.parse(artifact.args) as Record<string, unknown>;
    for (const key of ["path", "filePath", "file", "query", "pattern", "url", "action"])
      if (typeof parsed[key] === "string") return String(parsed[key]).replace(/\n/g, " ");
  } catch {
    // Plain-text tool input is a valid subject.
  }
  return artifact.args.replace(/\n/g, " ");
}

function compact(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max
    ? normalized
    : `${normalized.slice(0, Math.max(1, max - 1))}…`;
}

function compactMetadata(value: string, max: number): string {
  if (value.length <= max) return value;
  if (max < 8) return compact(value, max);
  const tailLength = Math.min(18, Math.floor(max * 0.55));
  const headLength = Math.max(1, max - tailLength - 1);
  return `${value.slice(0, headLength)}…${value.slice(-tailLength)}`;
}

export function alignToolRow(action: string, subject: string, metadata: string, width: number): ToolRowModel {
  const actionColumn = action.slice(0, 10).padEnd(10);
  const available = Math.max(8, width - 2 - actionColumn.length);
  const maxMetadata = Math.max(0, Math.min(metadata.length, Math.floor(available * 0.5)));
  const visibleMetadata = maxMetadata > 0 ? compactMetadata(metadata, maxMetadata) : "";
  const metadataWidth = visibleMetadata ? visibleMetadata.length + 2 : 0;
  const visibleSubject = compact(subject, Math.max(4, available - metadataWidth));
  const used = 2 + actionColumn.length + visibleSubject.length + visibleMetadata.length;
  const spacer = visibleMetadata ? " ".repeat(Math.max(2, width - used)) : "";
  return { action: actionColumn, subject: visibleSubject, spacer, metadata: visibleMetadata };
}

export function formatToolDuration(durationMs: number): string {
  if (durationMs < 1_000) return `${durationMs}ms`;
  if (durationMs < 60_000) return `${(durationMs / 1_000).toFixed(1).replace(/\.0$/, "")}s`;
  const minutes = Math.floor(durationMs / 60_000);
  const seconds = Math.round((durationMs % 60_000) / 1_000);
  return `${minutes}m ${seconds}s`;
}

export function toolRowModel(
  tool: string,
  artifact: ToolArtifact,
  width: number,
  durationMs?: number,
): ToolRowModel {
  const identity = toolDisplayIdentity(tool, artifact);
  const rawSubject = identity.operation
    ?? (artifact.files && artifact.files.length > 1
      ? `${artifact.files.length} files`
      : artifact.filePath ?? argumentSubject(artifact));
  const metadata = durationMs !== undefined && durationMs >= 1_000
    ? formatToolDuration(durationMs)
    : "";
  return alignToolRow(
    identity.label,
    rawSubject,
    metadata,
    width,
  );
}
