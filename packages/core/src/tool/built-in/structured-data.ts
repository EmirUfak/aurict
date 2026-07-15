import { z } from "zod"
import { callAurictApi, describeAurictApiFailure } from "./_shared/aurict-api.js"
import { prepareModuleUpload } from "./_shared/module-upload.js"
import type { ExecuteResult, ToolContext, ToolDef } from "../types.js"

const actions = ["profile", "preview", "validate", "query"] as const
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export const structuredDataTool: ToolDef = {
  id: "structured_data",
  description:
    "Analyze a user-selected workspace CSV, JSON, or Parquet file through Aurict's authenticated temporary data service. Start with profile to inspect the schema, then use preview or a read-only SELECT query grounded in that schema. The service masks common sensitive columns and rejects writes, filesystem access, network access, and non-SELECT queries. Treat returned rows as the computed evidence and keep interpretations separate from the data.",
  parameters: z.object({
    path: z.string().describe("Path to a user-selected CSV, JSON, or Parquet file inside the current workspace."),
    action: z.enum(actions).default("profile").describe("profile inspects schema, preview returns sample rows, validate returns quality warnings, query runs one read-only SELECT."),
    query: z.string().optional().describe("Required only for the query action. It must be one SELECT that reads the dataset table."),
    max_rows: z.number().int().positive().max(200).default(50).describe("Maximum preview or query result rows."),
  }),
  spec: {
    category: "network",
    riskLevel: "medium",
    requiresConfirmation: true,
    permissionSummary: "Upload a selected workspace data file to Aurict's authenticated temporary analysis service",
  },
  timeoutMs: 60_000,
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ExecuteResult> {
    const requestedPath = typeof args.path === "string" ? args.path : ""
    const action = args.action as (typeof actions)[number]
    const query = typeof args.query === "string" ? args.query : undefined
    const maxRows = typeof args.max_rows === "number" ? args.max_rows : 50
    if (!requestedPath) return { output: "", error: '"path" is required.' }
    if (action === "query" && !query) return { output: "", error: '"query" is required for the query action.' }

    const upload = await prepareModuleUpload(ctx, requestedPath, MAX_UPLOAD_BYTES)
    if ("error" in upload) return { output: "", error: upload.error }

    const form = new FormData()
    form.set("file", upload.blob, upload.filename)
    form.set("operation", action)
    form.set("max_rows", String(maxRows))
    if (query) form.set("query", query)
    const result = await callAurictApi(ctx, "modules", "/structured-data/analyze", { method: "POST", body: form })
    if (result.kind !== "success") return { output: "", error: describeAurictApiFailure(result) }
    return { output: JSON.stringify(result.data, null, 2) }
  },
}
