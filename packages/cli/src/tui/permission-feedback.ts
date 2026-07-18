import type { PermissionDecision } from "@aurict/core";

type PermissionAction = PermissionDecision | "deny_abort" | "edit";

/** Successful approvals are transient UI state; only exceptional decisions belong in the transcript. */
export function permissionTranscriptFeedback(action: PermissionAction, tool: string): string | null {
  if (action === "edit") return `Permission declined for ${tool}; request moved to input for editing.`;
  if (action === "deny_abort") return `Permission denied for ${tool}; agent stopped by user.`;
  if (action === "deny") return `Permission denied: ${tool}.`;
  return null;
}
