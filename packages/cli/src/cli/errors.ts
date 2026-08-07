import { CliUsageError } from "./types.js"

interface CliErrorResult {
  schema: "aurict.cli.error/v1"
  status: "usage_error" | "infrastructure_error"
  error: { message: string; suggestion?: string }
}

export function wantsJsonOutput(argv: readonly string[]): boolean {
  return argv.includes("--json")
    || argv.includes("--format=json")
    || argv.some((value, index) => value === "--format" && argv[index + 1] === "json")
}

export function writeCliUsageError(error: CliUsageError, json: boolean): void {
  if (json) {
    writeJson({
      schema: "aurict.cli.error/v1",
      status: "usage_error",
      error: {
        message: error.message,
        ...(error.suggestion ? { suggestion: error.suggestion } : {}),
      },
    })
    return
  }
  process.stderr.write(`[aurict] ${error.message}\n`)
  if (error.suggestion) process.stderr.write(`${error.suggestion}\n`)
}

export function writeCliInfrastructureError(error: unknown, json: boolean): void {
  const message = error instanceof Error ? error.message : String(error)
  if (json) {
    writeJson({ schema: "aurict.cli.error/v1", status: "infrastructure_error", error: { message } })
    return
  }
  process.stderr.write(`[aurict] ${message}\n`)
}

function writeJson(result: CliErrorResult): void {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}
