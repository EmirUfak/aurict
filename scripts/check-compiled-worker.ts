#!/usr/bin/env bun

import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { agentWorkerEntrypoint, verifyAgentWorkerBundled } from "./agent-build-entrypoints.js"

const root = join(import.meta.dir, "..")
const tempRoot = mkdtempSync(join(tmpdir(), "aurict-worker-smoke-"))
const output = join(tempRoot, process.platform === "win32" ? "worker-smoke.exe" : "worker-smoke")

try {
  const build = Bun.spawnSync([
    "bun", "build",
    join(import.meta.dir, "worker-bootstrap-probe.ts"),
    agentWorkerEntrypoint(root),
    "--compile",
    "--minify",
    "--external", "fsevents",
    "--define", "__AURICT_COMPILED__=true",
    "--outfile", output,
  ], { cwd: root, stdout: "inherit", stderr: "inherit" })
  if (build.exitCode !== 0) throw new Error(`Compiled worker smoke build failed with exit code ${build.exitCode}`)

  await verifyAgentWorkerBundled(output)
  const run = Bun.spawnSync([output], {
    cwd: tempRoot,
    env: { ...process.env, AURICT_STATE_DIR: join(tempRoot, "state") },
    stdout: "inherit",
    stderr: "inherit",
  })
  if (run.exitCode !== 0) throw new Error(`Compiled worker smoke run failed with exit code ${run.exitCode}`)
} finally {
  rmSync(tempRoot, { recursive: true, force: true })
}
