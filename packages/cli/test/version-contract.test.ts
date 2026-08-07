import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { CURRENT_VERSION, getBuildInfo } from "../src/version.js"

describe("version contract", () => {
  it("uses the CLI package as the development source of truth", () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dir, "..", "package.json"), "utf8")) as { version: string }
    expect(CURRENT_VERSION).toBe(pkg.version)
    expect(getBuildInfo().version).toBe(pkg.version)
  })

  it("keeps every published CLI package on the same version", () => {
    const root = join(import.meta.dir, "..", "..", "..")
    const paths = [
      "packages/aurict/package.json",
      "packages/cli/package.json",
      "packages/cli-linux-x64/package.json",
      "packages/cli-linux-arm64/package.json",
      "packages/cli-darwin-x64/package.json",
      "packages/cli-darwin-arm64/package.json",
      "packages/cli-win32-x64/package.json",
    ]
    const versions = paths.map(path => (JSON.parse(readFileSync(join(root, path), "utf8")) as { version: string }).version)
    expect(new Set(versions)).toEqual(new Set([CURRENT_VERSION]))
  })
})
