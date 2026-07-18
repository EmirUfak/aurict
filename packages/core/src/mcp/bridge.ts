import { z } from "zod"
import { ToolRegistry } from "../tool/registry.js"
import type { ToolDef, ToolContext } from "../tool/types.js"
import type { MCPClient } from "./client.js"
import type { MCPToolInfo } from "./types.js"

function schemaNodeToZod(schema: Record<string, unknown>): z.ZodTypeAny {
  if (Array.isArray(schema["enum"]) && schema["enum"].length > 0) {
    const values = (schema["enum"] as unknown[]).filter(
      (value): value is string | number | boolean | null => value === null || ["string", "number", "boolean"].includes(typeof value),
    )
    if (values.length === 1) return z.literal(values[0]!)
    if (values.length >= 2) {
      return z.union(values.map((value) => z.literal(value)) as [z.ZodLiteral<string | number | boolean | null>, z.ZodLiteral<string | number | boolean | null>, ...z.ZodLiteral<string | number | boolean | null>[]])
    }
  }
  const alternatives = (schema["oneOf"] ?? schema["anyOf"]) as Record<string, unknown>[] | undefined
  if (alternatives?.length === 1) return schemaNodeToZod(alternatives[0]!)
  if (alternatives && alternatives.length >= 2) {
    return z.union(alternatives.map(schemaNodeToZod) as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]])
  }
  switch (schema["type"]) {
    case "string": return z.string()
    case "number": return z.number()
    case "integer": return z.number().int()
    case "boolean": return z.boolean()
    case "null": return z.null()
    case "array": {
      const items = schema["items"] as Record<string, unknown> | undefined
      return z.array(items ? schemaNodeToZod(items) : z.unknown())
    }
    case "object": return objectSchemaToZod(schema)
    default: return z.unknown()
  }
}

function objectSchemaToZod(schema: Record<string, unknown>): z.AnyZodObject {
  const props    = (schema["properties"] as Record<string, Record<string, unknown>>) ?? {}
  const required = new Set((schema["required"] as string[]) ?? [])
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const [key, prop] of Object.entries(props)) {
    let t = schemaNodeToZod(prop)
    if (typeof prop["description"] === "string") t = t.describe(prop["description"])
    if (!required.has(key)) t = t.optional()
    shape[key] = t
  }
  const object = z.object(shape)
  return schema["additionalProperties"] === false ? object.strict() : object.passthrough()
}

// JSON Schema → recursive Zod object. MCP tool roots are object schemas.
export function jsonSchemaToZod(schema: Record<string, unknown>): z.AnyZodObject {
  return schema["type"] === "object" ? objectSchemaToZod(schema) : z.object({}).passthrough()
}

export function bridgeTool(client: MCPClient, info: MCPToolInfo): ToolDef {
  return {
    id:          `mcp:${info.server}:${info.name}`,
    description: `[MCP:${info.server}] ${info.description}`,
    parameters:  jsonSchemaToZod(info.inputSchema),
    async execute(args: Record<string, unknown>, _ctx: ToolContext) {
      try {
        const output = await client.callTool(info.name, args)
        return { output }
      } catch (err) {
        return { output: "", error: String(err) }
      }
    },
  }
}

export async function registerMCPTools(client: MCPClient): Promise<string[]> {
  const tools = await client.listTools()
  const ids: string[] = []

  for (const info of tools) {
    const def = bridgeTool(client, info)
    ToolRegistry.register(def)
    ids.push(def.id)
  }

  return ids
}
