import { classifyToolResult, type ToolResultArtifact } from "@aurict/core";

export interface ToolArtifact extends ToolResultArtifact {
  tool: string;
  args: string;
  result?: string;
  command?: string;
}

function commandFromArgs(args: string): string | undefined {
  try {
    const parsed = JSON.parse(args) as Record<string, unknown>;
    return typeof parsed["command"] === "string" ? parsed["command"] : undefined;
  } catch {
    return undefined;
  }
}

function pathFromArgs(args: string): string | undefined {
  try {
    const parsed = JSON.parse(args) as Record<string, unknown>;
    for (const key of ["path", "filePath", "file"])
      if (typeof parsed[key] === "string" && parsed[key]) return String(parsed[key]);
  } catch {
    return undefined;
  }
  return undefined;
}

/** Enriches the core artifact with call arguments; persisted legacy events are classified once here. */
export function parseToolArtifact(
  tool: string,
  args: string,
  result?: string,
  normalized?: ToolResultArtifact,
): ToolArtifact {
  const artifact = normalized ?? classifyToolResult(tool, result ?? "");
  const filePath = artifact.filePath ?? pathFromArgs(args);
  const command = commandFromArgs(args);
  return {
    ...artifact,
    tool,
    args,
    ...(result !== undefined ? { result } : {}),
    ...(filePath ? { filePath } : {}),
    ...(command ? { command } : {}),
  };
}
