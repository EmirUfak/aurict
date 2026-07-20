import { createHash, randomUUID } from "node:crypto"
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"

export type FlightReplayPolicy = "safe" | "confirm" | "blocked"

export interface WorkspaceFingerprint {
  digest: string
  files: string[]
}

export interface FlightFailure {
  version: 1
  id: string
  sessionId: string
  recordedAt: number
  tool: string
  args: Record<string, unknown>
  output: string
  error: string
  durationMs: number
  workdir: string
  replayPolicy: FlightReplayPolicy
  replayBlockReason?: string | undefined
  environment: {
    platform: string
    architecture: string
    bunVersion: string
    nodeVersion: string
  }
  workspace: WorkspaceFingerprint
}

export interface RecordFlightFailureInput {
  workdir: string
  sessionId: string
  tool: string
  args: Record<string, unknown>
  output: string
  error: string
  durationMs: number
  replayPolicy: FlightReplayPolicy
  replayBlockReason?: string | undefined
  now?: number | undefined
}

const FINGERPRINT_FILES = [
  "package.json", "bun.lock", "bun.lockb", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
  "Cargo.lock", "go.sum", "requirements.txt", "poetry.lock", "Gemfile.lock",
]
const SENSITIVE_KEY = /(?:token|secret|password|passwd|authorization|cookie|api[_-]?key|private[_-]?key)/i

export async function recordFlightFailure(input: RecordFlightFailureInput): Promise<FlightFailure> {
  const redacted = redactRecord(input.args)
  const redactionBlocked = redacted.redacted
  const entry: FlightFailure = {
    version: 1,
    id: `${input.now ?? Date.now()}-${randomUUID().slice(0, 8)}`,
    sessionId: input.sessionId,
    recordedAt: input.now ?? Date.now(),
    tool: input.tool,
    args: redacted.value,
    output: redactText(input.output).slice(0, 12_000),
    error: redactText(input.error).slice(0, 6_000),
    durationMs: input.durationMs,
    workdir: input.workdir,
    replayPolicy: redactionBlocked ? "blocked" : input.replayPolicy,
    ...(redactionBlocked
      ? { replayBlockReason: "Recorded arguments contained redacted sensitive data" }
      : input.replayBlockReason ? { replayBlockReason: input.replayBlockReason } : {}),
    environment: {
      platform: process.platform,
      architecture: process.arch,
      bunVersion: Bun.version,
      nodeVersion: process.version,
    },
    workspace: await fingerprintWorkspace(input.workdir),
  }
  const directory = flightDirectory(input.workdir, input.sessionId)
  await mkdir(directory, { recursive: true })
  const destination = join(directory, `${safeId(entry.id)}.json`)
  const temporary = `${destination}.${process.pid}.tmp`
  await writeFile(temporary, JSON.stringify(entry, null, 2), "utf8")
  await rename(temporary, destination)
  return entry
}

export async function listFlightFailures(
  workdir: string,
  sessionId: string,
  limit = 20,
): Promise<FlightFailure[]> {
  let names: string[]
  try {
    names = (await readdir(flightDirectory(workdir, sessionId)))
      .filter((name) => name.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, Math.max(1, limit))
  } catch (error) {
    if (isNotFound(error)) return []
    throw error
  }
  return Promise.all(names.map(async (name) => parseFlightFailure(
    await readFile(join(flightDirectory(workdir, sessionId), name), "utf8"),
  )))
}

export async function readFlightFailure(
  workdir: string,
  sessionId: string,
  id: string,
): Promise<FlightFailure | null> {
  try {
    return parseFlightFailure(await readFile(
      join(flightDirectory(workdir, sessionId), `${safeId(id)}.json`),
      "utf8",
    ))
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

export async function fingerprintWorkspace(workdir: string): Promise<WorkspaceFingerprint> {
  const hash = createHash("sha256")
  const files: string[] = []
  for (const relative of FINGERPRINT_FILES) {
    try {
      const content = await readFile(join(workdir, relative))
      files.push(relative)
      hash.update(relative)
      hash.update(content)
    } catch (error) {
      if (!isNotFound(error)) throw error
    }
  }
  if (files.length === 0) hash.update("empty-workspace-fingerprint")
  return { digest: hash.digest("hex"), files }
}

export function formatFlightFailure(entry: FlightFailure): string {
  return [
    `Flight ${entry.id}`,
    `Tool: ${entry.tool}`,
    `Recorded: ${new Date(entry.recordedAt).toISOString()}`,
    `Duration: ${entry.durationMs}ms`,
    `Replay: ${entry.replayPolicy}${entry.replayBlockReason ? ` — ${entry.replayBlockReason}` : ""}`,
    `Workspace: ${entry.workspace.digest.slice(0, 12)} (${entry.workspace.files.join(", ") || "no manifests"})`,
    `Arguments: ${JSON.stringify(entry.args, null, 2)}`,
    `Error: ${entry.error}`,
    entry.output ? `Output:\n${entry.output}` : "Output: (none)",
  ].join("\n")
}

function redactRecord(value: Record<string, unknown>): { value: Record<string, unknown>; redacted: boolean } {
  let redacted = false
  const walk = (current: unknown, key = ""): unknown => {
    if (SENSITIVE_KEY.test(key)) {
      redacted = true
      return "[REDACTED]"
    }
    if (typeof current === "string") {
      const next = redactText(current)
      if (next !== current) redacted = true
      return next.length > 8_000 ? `${next.slice(0, 8_000)}…[truncated]` : next
    }
    if (Array.isArray(current)) return current.map((item) => walk(item))
    if (current && typeof current === "object") {
      return Object.fromEntries(Object.entries(current).map(([childKey, child]) => [childKey, walk(child, childKey)]))
    }
    return current
  }
  return { value: walk(value) as Record<string, unknown>, redacted }
}

function redactText(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [REDACTED]")
    .replace(/\b(api[_-]?key|token|password|secret)\s*[:=]\s*([^\s,;]+)/gi, "$1=[REDACTED]")
}

function parseFlightFailure(raw: string): FlightFailure {
  const parsed = JSON.parse(raw) as FlightFailure
  if (parsed.version !== 1 || !parsed.id || !parsed.sessionId || !parsed.tool || !parsed.error) {
    throw new Error("Invalid flight recorder entry")
  }
  return parsed
}

function flightDirectory(workdir: string, sessionId: string): string {
  return join(workdir, ".aurict", "flights", safeId(sessionId))
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.:-]/g, "_")
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}
