#!/usr/bin/env bun
/**
 * Bump version across all packages and source files.
 * Usage: bun run scripts/bump-version.ts <version> [--desktop]
 * Example: bun run scripts/bump-version.ts 1.0.2
 */

import { join } from "node:path"
import { readFileSync, writeFileSync } from "node:fs"

const ROOT = join(import.meta.dir, "..")
const version = process.argv[2]
const desktopOnly = process.argv.includes("--desktop")

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: bun run scripts/bump-version.ts <version> [--desktop]")
  console.error("Example: bun run scripts/bump-version.ts 1.0.2")
  process.exit(1)
}

// package.json files to update (version field)
const PACKAGES = [
  "package.json",
  "packages/aurict/package.json",
  "packages/cli/package.json",
  "packages/core/package.json",
  "packages/sdk/package.json",
  "packages/cli-linux-x64/package.json",
  "packages/cli-linux-arm64/package.json",
  "packages/cli-darwin-x64/package.json",
  "packages/cli-darwin-arm64/package.json",
  "packages/cli-win32-x64/package.json",
  "apps/desktop/package.json",
]

const packagesToUpdate = desktopOnly ? ["apps/desktop/package.json"] : PACKAGES

// Product surfaces outside the CLI read package metadata at build/runtime.
const SOURCE_FILES: Array<{ path: string; pattern: RegExp; replace: string }> = [
  {
    path: "apps/web/src/components/Nav.tsx",
    pattern: /v\d+\.\d+\.\d+ · AGPLv3/,
    replace: `v${version} · AGPLv3`,
  },
  {
    path: "apps/web/src/components/landing/AurictLandingExact.tsx",
    pattern: /v\d+\.\d+\.\d+ · AGPLv3/,
    replace: `v${version} · AGPLv3`,
  },
  {
    path: "apps/web/src/content/home-translations.ts",
    pattern: /"softwareVersion":(\s*)"\d+\.\d+\.\d+"/g,
    replace: `"softwareVersion":$1"${version}"`,
  },
]

let changed = 0

for (const rel of packagesToUpdate) {
  const file = join(ROOT, rel)
  const pkg = JSON.parse(readFileSync(file, "utf8"))
  const old = pkg.version

  pkg.version = version

  // Also update optionalDependencies if present (packages/aurict)
  if (pkg.optionalDependencies) {
    for (const k of Object.keys(pkg.optionalDependencies)) {
      pkg.optionalDependencies[k] = version
    }
  }

  writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n")
  console.log(`✓ ${rel}  ${old} → ${version}`)
  changed++
}

for (const { path: rel, pattern, replace } of desktopOnly ? [] : SOURCE_FILES) {
  const file = join(ROOT, rel)
  const src = readFileSync(file, "utf8")
  const next = src.replace(pattern, replace)
  if (next !== src) {
    writeFileSync(file, next)
    console.log(`✓ ${rel}  (version string updated)`)
    changed++
  }
}

console.log(`\nDone — ${changed} file(s) updated to v${version}${desktopOnly ? " (desktop only)" : ""}`)
console.log(desktopOnly
  ? `Next: git add apps/desktop/package.json && git commit -m "chore(desktop): bump version to ${version}"`
  : `Next: git add -A && git commit -m "chore: bump version to ${version}" && git tag v${version} && git push origin main v${version}`)
