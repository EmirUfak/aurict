#!/usr/bin/env bun
/**
 * Bump only packages and source constants shipped by the CLI release.
 * Usage: bun run bump-version:cli <version> [--dry-run]
 */

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = join(import.meta.dir, "..")
const [version, ...flags] = process.argv.slice(2)
const dryRun = flags.includes("--dry-run")

if (!version || !/^\d+\.\d+\.\d+$/.test(version) || flags.some((flag) => flag !== "--dry-run")) {
  console.error("Usage: bun run bump-version:cli <version> [--dry-run]")
  console.error("Example: bun run bump-version:cli 1.2.3 --dry-run")
  process.exit(1)
}

const PACKAGE_PATHS = [
  "packages/aurict/package.json",
  "packages/cli/package.json",
  "packages/cli-linux-x64/package.json",
  "packages/cli-linux-arm64/package.json",
  "packages/cli-darwin-x64/package.json",
  "packages/cli-darwin-arm64/package.json",
  "packages/cli-win32-x64/package.json",
]

function write(file: string, content: string): void {
  if (!dryRun) writeFileSync(file, content)
}

for (const rel of PACKAGE_PATHS) {
  const file = join(ROOT, rel)
  const pkg = JSON.parse(readFileSync(file, "utf8")) as {
    version: string
    optionalDependencies?: Record<string, string>
  }
  const old = pkg.version
  pkg.version = version

  for (const name of Object.keys(pkg.optionalDependencies ?? {})) {
    pkg.optionalDependencies![name] = version
  }

  write(file, JSON.stringify(pkg, null, 2) + "\n")
  console.log(`${dryRun ? "•" : "✓"} ${rel}  ${old} → ${version}`)
}

console.log(`\n${dryRun ? "Dry run complete" : "CLI version updated"} — v${version}`)
