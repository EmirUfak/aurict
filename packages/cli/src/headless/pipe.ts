import {
  ExecutorEvents,
  PermissionGate,
  runAgent,
} from "@aurict/core"

export type CliOutputFormat = "text" | "json"
export type CliOutputAudience = "human" | "agent"

export interface PipeCommandOptions {
  provider?: string
  model?: string
  workdir: string
  input: string
  format: CliOutputFormat
  audience: CliOutputAudience
  quiet: boolean
  system?: string
  undercover?: boolean
  backendAccessTokenResolver?: (signal: AbortSignal) => Promise<string | undefined>
  prepare?: () => Promise<Partial<Pick<PipeCommandOptions, "provider" | "model" | "system" | "undercover">>>
}

export interface PipeCommandDependencies {
  runAgent: typeof runAgent
}

interface PipeResult {
  schema: "aurict.pipe/v1"
  status: "completed" | "blocked" | "infrastructure_error"
  run_id?: string
  provider: string
  model: string
  text?: string
  usage?: {
    input_tokens: number
    output_tokens: number
    cache_read_tokens: number
    cache_write_tokens: number
    reasoning_tokens: number
  }
  error?: { message: string }
}

export async function runPipeCommand(
  options: PipeCommandOptions,
  dependencies: PipeCommandDependencies = { runAgent },
): Promise<number> {
  const unsubscribe = ExecutorEvents.on(event => PermissionGate.respond(event.request.id, "deny"))
  let provider = options.provider
  let model = options.model
  try {
    if (!options.input.trim()) throw new Error("No input received")
    const prepared = await options.prepare?.()
    provider = prepared?.provider ?? provider
    model = prepared?.model ?? model
    const system = prepared?.system ?? options.system
    const undercover = prepared?.undercover ?? options.undercover
    const finish = await dependencies.runAgent({
      ...(provider !== undefined ? { provider } : {}),
      ...(model !== undefined ? { model } : {}),
      workdir: options.workdir,
      ...(system !== undefined ? { system } : {}),
      ...(undercover !== undefined ? { undercover } : {}),
      ...(options.backendAccessTokenResolver ? { backendAccessTokenResolver: options.backendAccessTokenResolver } : {}),
      messages: [{ role: "user", content: options.input }],
      runtime: { profile: "headless" },
      onModelSelected: selection => {
        provider = selection.provider
        model = selection.model
      },
      ...(options.format === "text" && !options.quiet
        ? { onText: (delta: string) => { process.stdout.write(delta) } }
        : {}),
    })
    const status = finish.runtime?.state.phase === "blocked" ? "blocked" : "completed"
    if (options.format === "json") {
      writeJson({
        schema: "aurict.pipe/v1",
        status,
        ...(finish.runtime?.runId ? { run_id: finish.runtime.runId } : {}),
        provider: provider ?? "unknown",
        model: model ?? "unknown",
        text: finish.text,
        usage: {
          input_tokens: finish.tokens.input,
          output_tokens: finish.tokens.output,
          cache_read_tokens: finish.tokens.cacheRead,
          cache_write_tokens: finish.tokens.cacheWrite,
          reasoning_tokens: finish.tokens.reasoning,
        },
      })
    } else {
      if (options.quiet) process.stdout.write(finish.text)
      if (finish.text && !finish.text.endsWith("\n")) process.stdout.write("\n")
      if (options.audience === "human" && !options.quiet) {
        process.stderr.write(`[tokens: ${finish.tokens.input} in / ${finish.tokens.output} out]\n`)
      }
    }
    return status === "blocked" ? 2 : 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (options.format === "json") {
      writeJson({
        schema: "aurict.pipe/v1",
        status: "infrastructure_error",
        provider: provider ?? "unknown",
        model: model ?? "unknown",
        error: { message },
      })
    } else {
      process.stderr.write(`[aurict] ${message}\n`)
    }
    return 1
  } finally {
    unsubscribe()
    PermissionGate.cancelPending()
  }
}

function writeJson(result: PipeResult): void {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}
