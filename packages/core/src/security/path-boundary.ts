import { lstat, realpath } from "node:fs/promises"
import { dirname, isAbsolute, relative, resolve } from "node:path"

export class PathBoundaryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PathBoundaryError"
  }
}

function isWithin(root: string, candidate: string): boolean {
  const rel = relative(root, candidate)
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))
}

async function nearestExisting(path: string): Promise<string> {
  let current = path
  while (true) {
    try {
      await lstat(current)
      return current
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      const parent = dirname(current)
      if (parent === current) throw error
      current = parent
    }
  }
}

/**
 * Resolves a path inside a workspace and rejects lexical escapes and symlink
 * traversal. Missing leaf paths are supported for create/write operations.
 */
export async function resolveWithinWorkspace(
  workdir: string,
  inputPath: string,
  opts: { allowMissing?: boolean } = {},
): Promise<string> {
  const rootLexical = resolve(workdir)
  const rootReal = await realpath(rootLexical)
  const candidateLexical = resolve(rootLexical, inputPath)
  if (!isWithin(rootLexical, candidateLexical)) {
    throw new PathBoundaryError(`Path escapes working directory: ${inputPath}`)
  }

  const relativeCandidate = relative(rootLexical, candidateLexical)
  const canonicalCandidate = resolve(rootReal, relativeCandidate)
  let existing: string
  try {
    existing = opts.allowMissing ? await nearestExisting(candidateLexical) : candidateLexical
    const existingReal = await realpath(existing)
    const expectedReal = resolve(rootReal, relative(rootLexical, existing))
    if (existingReal !== expectedReal || !isWithin(rootReal, existingReal)) {
      throw new PathBoundaryError(`Path traverses a symlink outside the working directory: ${inputPath}`)
    }
  } catch (error) {
    if (error instanceof PathBoundaryError) throw error
    throw error
  }

  return canonicalCandidate
}
