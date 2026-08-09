import { readFileSync } from "node:fs"
import { join } from "node:path"

declare const __AURICT_VERSION__: string | undefined
declare const __AURICT_COMMIT__: string | undefined
declare const __AURICT_BUILD_DATE__: string | undefined

interface PackageMetadata {
  version?: string
}

function injectedValue(value: () => string | undefined): string | undefined {
  try {
    const resolved = value()
    return resolved && resolved.trim() ? resolved : undefined
  } catch (error) {
    if (error instanceof ReferenceError) return undefined
    throw error
  }
}

function sourcePackageVersion(): string {
  const path = join(import.meta.dir, "..", "package.json")
  let parsed: PackageMetadata
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as PackageMetadata
  } catch (error) {
    throw new Error(`Failed to read CLI package metadata at ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!parsed.version || !/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(parsed.version)) {
    throw new Error(`CLI package metadata at ${path} has an invalid version`)
  }
  return parsed.version
}

export const CURRENT_VERSION = injectedValue(() => typeof __AURICT_VERSION__ === "string" ? __AURICT_VERSION__ : undefined)
  ?? sourcePackageVersion()

export interface AurictBuildInfo {
  name: "aurict"
  version: string
  commit: string
  build_date: string | null
  runtime: string
  platform: string
  arch: string
}

export function getBuildInfo(): AurictBuildInfo {
  return {
    name: "aurict",
    version: CURRENT_VERSION,
    commit: injectedValue(() => typeof __AURICT_COMMIT__ === "string" ? __AURICT_COMMIT__ : undefined) ?? "development",
    build_date: injectedValue(() => typeof __AURICT_BUILD_DATE__ === "string" ? __AURICT_BUILD_DATE__ : undefined) ?? null,
    runtime: `Bun ${Bun.version}`,
    platform: process.platform,
    arch: process.arch,
  }
}

export function formatVersionText(): string {
  const info = getBuildInfo()
  const provenance = info.commit === "development" ? "" : ` (${info.commit})`
  return `Aurict v${info.version}${provenance} ${info.platform}/${info.arch}`
}
