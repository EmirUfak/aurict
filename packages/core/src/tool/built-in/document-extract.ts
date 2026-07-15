import { z } from "zod"
import { callAurictApi, describeAurictApiFailure } from "./_shared/aurict-api.js"
import { prepareModuleUpload } from "./_shared/module-upload.js"
import type { ExecuteResult, ToolContext, ToolDef } from "../types.js"

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export const documentExtractTool: ToolDef = {
  id: "document_extract",
  description:
    "Extract text and tables from a user-selected workspace PDF, DOCX, or UTF-8 text file through Aurict's authenticated document service. Use this to ground answers in the document. Preserve page and table references in your answer; do not claim a fact that is absent from the extracted result. OCR is not available yet, so scanned PDFs may return an explicit warning instead of invented text.",
  parameters: z.object({
    path: z.string().describe("Path to a user-selected PDF, DOCX, or UTF-8 text file inside the current workspace."),
    include_tables: z.boolean().default(false).describe("Extract DOCX tables when true."),
  }),
  spec: {
    category: "network",
    riskLevel: "medium",
    requiresConfirmation: true,
    permissionSummary: "Upload a selected workspace document to Aurict's authenticated temporary extraction service",
  },
  timeoutMs: 60_000,
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ExecuteResult> {
    const requestedPath = typeof args.path === "string" ? args.path : ""
    if (!requestedPath) return { output: "", error: '"path" is required.' }

    const upload = await prepareModuleUpload(ctx, requestedPath, MAX_UPLOAD_BYTES)
    if ("error" in upload) return { output: "", error: upload.error }

    const form = new FormData()
    form.set("file", upload.blob, upload.filename)
    form.set("ocr", "off")
    form.set("include_tables", String(args.include_tables === true))
    const result = await callAurictApi(ctx, "modules", "/extract/document", { method: "POST", body: form })
    if (result.kind !== "success") return { output: "", error: describeAurictApiFailure(result) }
    return { output: JSON.stringify(result.data, null, 2) }
  },
}
