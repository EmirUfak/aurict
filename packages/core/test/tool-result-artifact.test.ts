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

  test("classifies direct and ANSI-colored shell diffs as inspectable diffs", () => {
    const output = "\u001b[1mdiff --git a/src/a.ts b/src/a.ts\u001b[0m\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-old\n+new";
    const artifact = classifyToolResult("bash", output);
    expect(artifact).toMatchObject({
      kind: "diff",
      filePath: "src/a.ts",
      additions: 1,
      deletions: 1,
    });
    expect(artifact.rawDiff).not.toContain("\u001b[");
  });

  test("normalizes apply_patch summaries without reparsing in the UI", () => {
    const artifact = classifyToolResult("apply_patch", "Applied patch:\nM a.ts\n\nChanged files: a.ts, b.ts\nStats: +4 -2");
    expect(artifact).toMatchObject({ kind: "patch", files: ["a.ts", "b.ts"], additions: 4, deletions: 2 });
  });

  test("marks shell failures as errors before shell presentation", () => {
    expect(classifyToolResult("bash", "ERROR: command failed\nexit 1").kind).toBe("error");
  });

  test("uses structured status without parsing localized output", () => {
    const presentation = {
      status: "error" as const,
      changedFiles: [],
      filePaths: [],
      errors: ["検証に失敗しました"],
      importantLines: [],
      verification: [{ check: "test", status: "failed" as const }],
    };
    const artifact = classifyToolResult("verify", "検証に失敗しました", presentation);
    expect(artifact.kind).toBe("error");
    expect(artifact.presentation).toEqual(presentation);
  });
});
