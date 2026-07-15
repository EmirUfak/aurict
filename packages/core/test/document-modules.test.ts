import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { documentExtractTool } from "../src/tool/built-in/document-extract.js"
import { structuredDataTool } from "../src/tool/built-in/structured-data.js"
import type { ToolContext } from "../src/tool/types.js"

let server: ReturnType<typeof Bun.serve>
let workspace = ""
let received: { path: string; authorization: string | null; filename: string; content: string } | null = null

function context(): ToolContext {
  return { sessionId: "test", workdir: workspace, signal: new AbortController().signal, backendAccessToken: "test-token" }
}

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), "aurict-document-tools-"))
  await writeFile(join(workspace, "note.txt"), "hello from a selected file")
  await writeFile(join(workspace, "data.csv"), "name,email\nAda,ada@example.com\n")
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const form = await request.formData()
      const file = form.get("file") as File
      received = {
        path: new URL(request.url).pathname,
        authorization: request.headers.get("authorization"),
        filename: file.name,
        content: await file.text(),
      }
      return Response.json({ ok: true, route: received.path })
    },
  })
  process.env.AURICT_MODULES_URL = `http://127.0.0.1:${server.port}`
})

afterAll(async () => {
  server.stop(true)
  await rm(workspace, { recursive: true, force: true })
  delete process.env.AURICT_MODULES_URL
})

describe("document-backed module tools", () => {
  it("uploads a selected document to the authenticated extract route", async () => {
    const result = await documentExtractTool.execute({ path: "note.txt", include_tables: false }, context())
    expect(result.error).toBeUndefined()
    expect(JSON.parse(result.output).route).toBe("/extract/document")
    expect(received).toEqual({
      path: "/extract/document",
      authorization: "Bearer test-token",
      filename: "note.txt",
      content: "hello from a selected file",
    })
  })

  it("uploads a selected data file to the authenticated analysis route", async () => {
    const result = await structuredDataTool.execute({ path: "data.csv", action: "profile", max_rows: 10 }, context())
    expect(result.error).toBeUndefined()
    expect(JSON.parse(result.output).route).toBe("/structured-data/analyze")
    expect(received?.filename).toBe("data.csv")
    expect(received?.content).toContain("ada@example.com")
  })

  it("rejects attempts to upload a file outside the workspace", async () => {
    const result = await documentExtractTool.execute({ path: "../outside.txt" }, context())
    expect(result.error).toContain("Cannot access")
  })

  it("requires a query before uploading a query request", async () => {
    const result = await structuredDataTool.execute({ path: "data.csv", action: "query" }, context())
    expect(result.error).toContain('"query"')
  })
})
