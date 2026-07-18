import { describe, expect, test } from "bun:test";
import { permissionTranscriptFeedback } from "../src/tui/permission-feedback.js";

describe("permission transcript feedback", () => {
  test("keeps successful approvals out of the transcript", () => {
    expect(permissionTranscriptFeedback("allow_once", "bash")).toBeNull();
    expect(permissionTranscriptFeedback("allow", "bash")).toBeNull();
    expect(permissionTranscriptFeedback("allow_directory", "write")).toBeNull();
    expect(permissionTranscriptFeedback("allow_partial", "apply_patch")).toBeNull();
  });

  test("retains exceptional decisions without mislabeling denial as approval", () => {
    expect(permissionTranscriptFeedback("deny", "bash")).toBe("Permission denied: bash.");
    expect(permissionTranscriptFeedback("deny_abort", "bash")).toContain("agent stopped");
    expect(permissionTranscriptFeedback("edit", "bash")).toContain("moved to input");
  });
});
