import { readFileSync } from "node:fs"
import { join } from "node:path"

export interface BuildMetadata {
  version: string
  commit: string
  buildDate: string
}

export function resolveBuildMetadata(root: string): BuildMetadata {
  const pkg = JSON.parse(readFileSync(join(root, "packages", "cli", "package.json"), "utf8")) as { version?: string }
  if (!pkg.version) throw new Error("packages/cli/package.json is missing version")
  const commit = process.env.AURICT_BUILD_COMMIT?.trim() || gitCommit(root)
  const buildDate = resolveBuildDate(process.env.SOURCE_DATE_EPOCH)
  return { version: pkg.version, commit, buildDate }
}

export function buildDefineArgs(metadata: BuildMetadata): string[] {
  return [
    "--define", `__AURICT_VERSION__=${JSON.stringify(metadata.version)}`,
    "--define", `__AURICT_COMMIT__=${JSON.stringify(metadata.commit)}`,
    "--define", `__AURICT_BUILD_DATE__=${JSON.stringify(metadata.buildDate)}`,
  ]
}

function gitCommit(root: string): string {
  const result = Bun.spawnSync(["git", "rev-parse", "--short=12", "HEAD"], {
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  })
  if (result.exitCode !== 0) return "unknown"
  return result.stdout.toString().trim() || "unknown"
}

function resolveBuildDate(sourceDateEpoch: string | undefined): string {
  if (sourceDateEpoch === undefined) return new Date().toISOString()
  const epochSeconds = Number(sourceDateEpoch)
  if (!Number.isFinite(epochSeconds) || epochSeconds < 0) {
    throw new Error(`Invalid SOURCE_DATE_EPOCH: ${sourceDateEpoch}`)
  }
  return new Date(epochSeconds * 1_000).toISOString()
}
