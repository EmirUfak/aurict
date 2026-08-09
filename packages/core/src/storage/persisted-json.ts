import {
  chmodSync,
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname } from "node:path"

export type PersistedJsonOperation = "read" | "parse" | "validate" | "write" | "backup" | "replace"

export class PersistedJsonError extends Error {
  constructor(
    readonly operation: PersistedJsonOperation,
    readonly path: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`${message}: ${path}`, options)
    this.name = "PersistedJsonError"
  }
}

export interface ReadJsonOptions<T> {
  optional?: boolean
  validate?: (value: unknown) => value is T
  description?: string
}

export function readJsonFileSync<T>(path: string, options: ReadJsonOptions<T> = {}): T | undefined {
  let raw: string
  try {
    raw = readFileSync(path, "utf8")
  } catch (error) {
    if (options.optional && isMissingFile(error)) return undefined
    throw new PersistedJsonError("read", path, `Failed to read ${options.description ?? "persisted JSON"}`, { cause: error })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new PersistedJsonError("parse", path, `Malformed ${options.description ?? "persisted JSON"}`, { cause: error })
  }
  if (options.validate && !options.validate(parsed)) {
    throw new PersistedJsonError("validate", path, `Invalid ${options.description ?? "persisted JSON"}`)
  }
  return parsed as T
}

export interface AtomicJsonWriteOptions {
  mode?: number
  backup?: boolean
  trailingNewline?: boolean
}

export function writeJsonFileAtomicSync(path: string, value: unknown, options: AtomicJsonWriteOptions = {}): void {
  const mode = options.mode ?? 0o600
  const temporary = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`
  const backup = `${path}.bak`
  const serialized = `${JSON.stringify(value, null, 2)}${options.trailingNewline === false ? "" : "\n"}`
  mkdirSync(dirname(path), { recursive: true })

  let descriptor: number | undefined
  let temporaryCreated = false
  try {
    descriptor = openSync(temporary, "wx", mode)
    temporaryCreated = true
    writeFileSync(descriptor, serialized, "utf8")
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
  } catch (error) {
    let closeError: unknown
    if (descriptor !== undefined) {
      try { closeSync(descriptor) } catch (caught) { closeError = caught }
    }
    if (temporaryCreated) removeTemporaryOrThrow(temporary, path, error)
    if (closeError !== undefined) {
      throw new PersistedJsonError("write", path, "Failed to close temporary persisted JSON", { cause: closeError })
    }
    throw new PersistedJsonError("write", path, "Failed to write persisted JSON", { cause: error })
  }

  try {
    if (options.backup && existsSync(path)) {
      copyFileSync(path, backup)
      if (process.platform !== "win32") chmodSync(backup, mode)
    }
  } catch (error) {
    removeTemporaryOrThrow(temporary, path, error)
    throw new PersistedJsonError("backup", path, "Failed to create persisted JSON backup", { cause: error })
  }

  try {
    renameSync(temporary, path)
    if (process.platform !== "win32") chmodSync(path, mode)
  } catch (error) {
    removeTemporaryOrThrow(temporary, path, error)
    throw new PersistedJsonError("replace", path, "Failed to atomically replace persisted JSON", { cause: error })
  }
}

export function restoreJsonBackupSync(path: string, options: Omit<AtomicJsonWriteOptions, "backup"> = {}): void {
  const backup = `${path}.bak`
  const value = readJsonFileSync<unknown>(backup, { description: "persisted JSON backup" })
  writeJsonFileAtomicSync(path, value, { ...options, backup: false })
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT")
}

function removeTemporaryOrThrow(temporary: string, path: string, originalError: unknown): void {
  try {
    rmSync(temporary, { force: true })
  } catch (cleanupError) {
    throw new PersistedJsonError("write", path, "Failed to clean up temporary persisted JSON", {
      cause: new AggregateError([originalError, cleanupError]),
    })
  }
}
