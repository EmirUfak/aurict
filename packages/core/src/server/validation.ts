import { z } from "zod"

export const createSessionSchema = z.object({
  provider: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  system: z.string().optional(),
  title: z.string().trim().min(1).max(200).optional(),
}).strict()

export const messageSchema = z.object({
  content: z.string().min(1).max(1_000_000),
}).strict()

export const storedSessionConfigSchema = z.object({
  provider: z.string().trim().min(1),
  model: z.string().trim().min(1),
  system: z.string().optional(),
}).passthrough()

export const mcpServerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  command: z.string().trim().min(1).optional(),
  args: z.array(z.string()).max(100).optional(),
  env: z.record(z.string()).optional(),
  url: z.string().url().refine((value) => value.startsWith("http://") || value.startsWith("https://"), "MCP URL must use http or https").optional(),
  headers: z.record(z.string()).optional(),
  enabled: z.boolean().optional(),
}).strict().refine(
  (value) => Boolean(value.command) !== Boolean(value.url),
  "Exactly one of command or url is required",
)
