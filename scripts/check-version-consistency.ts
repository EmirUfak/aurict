#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const ROOT = join(import.meta.dir, "..")
const PACKAGE_PATHS = [
  "package.json",
  "packages/core/package.json",
  "packages/sdk/package.json",
  "packages/aurict/package.json",
  "packages/cli/package.json",
  "packages/cli-linux-x64/package.json",
  "packages/cli-linux-arm64/package.json",
  "packages/cli-darwin-x64/package.json",
  "packages/cli-darwin-arm64/package.json",
  "packages/cli-win32-x64/package.json",
  "apps/desktop/package.json",
  "apps/web/package.json",
  "apps/mobile-web/package.json",
] as const

interface PackageShape {
  name: string
  version: string
  optionalDependencies?: Record<string, string>
}

const packages = PACKAGE_PATHS.map(path => ({ path, pkg: readPackage(path) }))
const expected = packages.find(entry => entry.path === "packages/cli/package.json")!.pkg.version
const mismatches = packages.filter(entry => entry.pkg.version !== expected)
if (mismatches.length > 0) {
  throw new Error(`Version mismatch; expected ${expected}: ${mismatches.map(entry => `${entry.path}=${entry.pkg.version}`).join(", ")}`)
}

for (const entry of packages.filter(item => item.path === "packages/cli/package.json" || item.path === "packages/aurict/package.json")) {
  for (const [name, version] of Object.entries(entry.pkg.optionalDependencies ?? {})) {
    if (version !== expected) throw new Error(`${entry.path} pins ${name}@${version}; expected ${expected}`)
  }
}

const coreSource = readFileSync(join(ROOT, "packages/core/src/server/hono.ts"), "utf8")
const coreVersion = coreSource.match(/const CORE_VERSION = "(\d+\.\d+\.\d+)"/)?.[1]
if (coreVersion !== expected) throw new Error(`Core HTTP version is ${coreVersion ?? "<missing>"}; expected ${expected}`)

const mobileManifest = readFileSync(join(ROOT, "mobile/pubspec.yaml"), "utf8")
const mobileVersion = mobileManifest.match(/^version: (\d+\.\d+\.\d+)\+\d+$/m)?.[1]
if (mobileVersion !== expected) throw new Error(`Mobile version is ${mobileVersion ?? "<missing>"}; expected ${expected}`)

for (const path of ["README.md", "docs/getting-started.md", "apps/web/src/content/docs-translations.ts"]) {
  const source = readFileSync(join(ROOT, path), "utf8")
  const pinnedVersions = [...source.matchAll(/AURICT_INSTALL_VERSION=(\d+\.\d+\.\d+)/g)].map(match => match[1])
  if (pinnedVersions.length === 0) throw new Error(`${path} is missing its pinned installer example`)
  if (pinnedVersions.some(version => version !== expected)) {
    throw new Error(`${path} has an installer example that does not pin ${expected}`)
  }
}

const binaryFlag = process.argv.indexOf("--binary")
if (binaryFlag !== -1) {
  const rawPath = process.argv[binaryFlag + 1]
  if (!rawPath) throw new Error("--binary requires a path")
  const binary = resolve(ROOT, rawPath)
  if (!existsSync(binary)) throw new Error(`Binary not found: ${binary}`)
  const result = Bun.spawnSync([binary, "version", "--json"], { stdout: "pipe", stderr: "pipe" })
  if (result.exitCode !== 0) throw new Error(`Binary version check failed: ${result.stderr.toString().trim()}`)
  const info = JSON.parse(result.stdout.toString()) as { version?: string; commit?: string }
  if (info.version !== expected) throw new Error(`Binary reports ${info.version ?? "<missing>"}; expected ${expected}`)
  if (!info.commit || info.commit === "development") throw new Error("Built binary is missing injected commit provenance")
}

console.log(`Version contract valid: ${expected}`)

function readPackage(path: string): PackageShape {
  try {
    return JSON.parse(readFileSync(join(ROOT, path), "utf8")) as PackageShape
  } catch (error) {
    throw new Error(`Failed to read ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}
