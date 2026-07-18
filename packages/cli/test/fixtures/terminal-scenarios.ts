import type { TranscriptMessage } from "../../src/tui/conversation/types.js";

const longOutput = Array.from({ length: 80 }, (_, index) => `test ${index + 1}: passed`).join("\n");

export const terminalScenarios: Record<string, TranscriptMessage[]> = {
  normal: [
    { id: "u1", role: "user", content: "Explain the authentication flow.", timestamp: 1_721_234_000_000 },
    { id: "a1", role: "assistant", content: "The request passes through **three layers**:\n- session lookup\n- token validation\n- policy check" },
  ],
  streaming: [
    { id: "u2", role: "user", content: "Refactor the provider registry and verify it." },
    { id: "a2", role: "assistant", content: "I inspected the registry and isolated provider selection." },
  ],
  shell: [
    { id: "u3", role: "user", content: "Run the test suite." },
    { id: "a3", role: "assistant", content: "", blocks: [
      { type: "tool", id: "tool-shell", tool: "bash", args: JSON.stringify({ command: "bun test" }), resultContent: longOutput, pending: false },
      { type: "text", content: "The suite completed successfully." },
    ] },
  ],
  multiFileDiff: [
    { id: "u4", role: "user", content: "Update both layout modules." },
    { id: "a4", role: "assistant", content: "", blocks: [
      { type: "tool", id: "diff-a", tool: "edit", args: JSON.stringify({ path: "src/header.tsx" }), resultContent: "Updated src/header.tsx\n__UNIFIED_DIFF__\n--- a/src/header.tsx\n+++ b/src/header.tsx\n@@ -1 +1 @@\n-old\n+new", pending: false },
      { type: "tool", id: "diff-b", tool: "edit", args: JSON.stringify({ path: "src/footer.tsx" }), resultContent: "Updated src/footer.tsx\n__UNIFIED_DIFF__\n--- a/src/footer.tsx\n+++ b/src/footer.tsx\n@@ -1 +1 @@\n-old\n+new", pending: false },
    ] },
  ],
  permissionError: [
    { id: "u5", role: "user", content: "Deploy the application." },
    { id: "s5", role: "system", content: "Permission required: network access for deployment." },
    { id: "e5", role: "error", content: "Deployment stopped because permission was denied." },
  ],
};

export const terminalSizes = [
  { columns: 60, rows: 18 },
  { columns: 80, rows: 24 },
  { columns: 100, rows: 30 },
  { columns: 140, rows: 40 },
] as const;
