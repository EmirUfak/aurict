import { describe, expect, test } from "bun:test";
import { classifyToolResult } from "../src/agent/tool-result-artifact.js";

describe("tool result artifacts", () => {
  test("normalizes a multi-file unified diff", () => {
    const output = "Updated files\n__UNIFIED_DIFF__\n--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-old\n+new\n--- a/b.ts\n+++ b/b.ts\n@@ -2 +2 @@\n-x\n+y";
    const artifact = classifyToolResult("edit", output);
    expect(artifact.kind).toBe("diff");
    expect(artifact.files).toEqual(["a.ts", "b.ts"]);
    expect(artifact.additions).toBe(2);
    expect(artifact.deletions).toBe(2);
  });

  test("normalizes apply_patch summaries without reparsing in the UI", () => {
    const artifact = classifyToolResult("apply_patch", "Applied patch:\nM a.ts\n\nChanged files: a.ts, b.ts\nStats: +4 -2");
    expect(artifact).toMatchObject({ kind: "patch", files: ["a.ts", "b.ts"], additions: 4, deletions: 2 });
  });

  test("marks shell failures as errors before shell presentation", () => {
    expect(classifyToolResult("bash", "ERROR: command failed\nexit 1").kind).toBe("error");
  });
});
