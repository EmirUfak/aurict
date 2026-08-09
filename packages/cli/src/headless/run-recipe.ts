import { loadPlugins, parseRecipeFile, runRecipe } from "@aurict/core"
import type { CliOutputAudience, CliOutputFormat } from "./pipe.js"

export interface RunRecipeCommandOptions {
  recipePath: string
  workdir: string
  format: CliOutputFormat
  audience: CliOutputAudience
  quiet: boolean
  backendAccessToken?: string
  backendAccessTokenResolver?: () => Promise<string | undefined>
  prepare?: () => Promise<void>
}

interface RecipeCommandResult {
  schema: "aurict.recipe/v1"
  status: "completed" | "failed" | "infrastructure_error"
  recipe?: { name: string; description?: string }
  steps?: Array<{ index: number; name: string; output: string; error?: string }>
  error?: { message: string }
}

export async function runRecipeCommand(options: RunRecipeCommandOptions): Promise<number> {
  try {
    await options.prepare?.()
    const pluginResults = await loadPlugins({
      logger: options.format === "text" && !options.quiet
        ? message => process.stderr.write(`${message}\n`)
        : () => {},
    })
    const pluginFailure = pluginResults.find(result => result.error)
    if (pluginFailure) throw new Error(`Plugin '${pluginFailure.file}' failed to load: ${pluginFailure.error}`)
    const recipe = await parseRecipeFile(options.recipePath)
    const backendAccessToken = options.backendAccessToken ?? await options.backendAccessTokenResolver?.()
    const showProgress = options.format === "text" && options.audience === "human" && !options.quiet
    let streamed = false
    if (showProgress) {
      process.stderr.write(`▶ ${recipe.name}${recipe.description ? ` — ${recipe.description}` : ""}\n`)
    }
    const result = await runRecipe({
      recipe,
      workdir: options.workdir,
      ...(backendAccessToken !== undefined ? { backendAccessToken } : {}),
      ...(showProgress ? { onStepStart: (index, step) => {
        const label = step.name ?? (step.bash ? `bash: ${step.bash.slice(0, 50)}` : `prompt ${index + 1}`)
        process.stderr.write(`[${index + 1}] ${label}\n`)
      } } : {}),
      ...(options.format === "text" && !options.quiet ? { onText: text => {
        streamed = true
        process.stdout.write(text)
      } } : {}),
    })
    if (options.format === "json") {
      writeJson({
        schema: "aurict.recipe/v1",
        status: result.success ? "completed" : "failed",
        recipe: {
          name: recipe.name,
          ...(recipe.description ? { description: recipe.description } : {}),
        },
        steps: result.steps,
      })
    } else {
      if (!streamed || options.quiet) {
        const output = result.steps.map(step => step.output).filter(Boolean).join("\n")
        if (output) process.stdout.write(`${output}${output.endsWith("\n") ? "" : "\n"}`)
      } else {
        process.stdout.write("\n")
      }
      if (showProgress) {
        const failed = result.steps.filter(step => step.error)
        process.stderr.write(failed.length > 0
          ? `✗ ${failed.length} step(s) failed\n`
          : `✓ Recipe complete — ${result.steps.length} step(s)\n`)
      }
    }
    return result.success ? 0 : 1
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (options.format === "json") {
      writeJson({ schema: "aurict.recipe/v1", status: "infrastructure_error", error: { message } })
    } else {
      process.stderr.write(`[aurict run] ${message}\n`)
    }
    return 1
  }
}

function writeJson(result: RecipeCommandResult): void {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}
