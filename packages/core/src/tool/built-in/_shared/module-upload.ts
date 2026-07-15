import { realpath, readFile, stat } from "node:fs/promises"
import { basename, isAbsolute, relative, resolve } from "node:path"
import type { ToolContext } from "../../types.js"

export type PreparedModuleUpload = {
  filename: string
  blob: Blob
}

/** Reads one user-selected workspace file after rejecting path escapes and oversized input. */
export async function prepareModuleUpload(
  ctx: ToolContext,
  requestedPath: string,
  maxBytes: number,
): Promise<PreparedModuleUpload | { error: string }> {
  const requested = resolve(ctx.workdir, requestedPath)
  let workspace: string
  let filePath: string
  let fileStat: Awaited<ReturnType<typeof stat>>
  try {
    workspace = await realpath(ctx.workdir)
    filePath = await realpath(requested)
    fileStat = await stat(filePath)
  } catch (error) {
    return { error: `Cannot access the requested file: ${error instanceof Error ? error.message : String(error)}` }
  }

  const pathFromWorkspace = relative(workspace, filePath)
  if (pathFromWorkspace.startsWith("..") || isAbsolute(pathFromWorkspace)) {
    return { error: "Document uploads must be files inside the current workspace." }
  }
  if (!fileStat.isFile()) return { error: "Document uploads must be regular files." }
  if (fileStat.size > maxBytes) return { error: `File exceeds the ${Math.floor(maxBytes / (1024 * 1024))} MB upload limit.` }

  try {
    return { filename: basename(filePath), blob: new Blob([await readFile(filePath)]) }
  } catch (error) {
    return { error: `Cannot read the requested file: ${error instanceof Error ? error.message : String(error)}` }
  }
}
