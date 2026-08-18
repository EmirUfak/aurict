import { existsSync } from "node:fs"
import { join } from "node:path"

const WORKER_BUNDLE_SENTINEL = new TextEncoder().encode(
  "Subagent completed its tool work without a textual summary.",
)

export function agentWorkerEntrypoint(root: string): string {
  return join(root, "packages", "core", "src", "agent", "worker.ts")
}

export function cliBuildEntrypoints(root: string): string[] {
  return [
    join(root, "packages", "cli", "src", "index.ts"),
    agentWorkerEntrypoint(root),
  ]
}

export function desktopSidecarBuildEntrypoints(root: string): string[] {
  return [
    join(root, "apps", "desktop", "src", "sidecar-entry.ts"),
    agentWorkerEntrypoint(root),
  ]
}

export async function verifyAgentWorkerBundled(output: string): Promise<void> {
  if (!existsSync(output)) throw new Error(`Compiled output is missing: ${output}`)
  const bytes = new Uint8Array(await Bun.file(output).arrayBuffer())
  if (!containsBytes(bytes, WORKER_BUNDLE_SENTINEL)) {
    throw new Error(`Compiled output does not contain the agent worker entrypoint: ${output}`)
  }
}

function containsBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  let offset = haystack.indexOf(needle[0]!)
  while (offset !== -1) {
    let matches = true
    for (let index = 1; index < needle.length; index++) {
      if (haystack[offset + index] !== needle[index]) {
        matches = false
        break
      }
    }
    if (matches) return true
    offset = haystack.indexOf(needle[0]!, offset + 1)
  }
  return false
}
