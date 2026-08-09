/**
 * `/visual` — launch the LLM-free 3D semantic-graph viewer in the browser.
 *
 * Spawns the HTTP server (packages/cli/src/visual/server.ts) as a detached
 * child so it survives the next prompt — the user keeps the graph open while
 * they keep coding. The server's PID + port are recorded under
 * `.aurict/visual/` so subsequent `/visual` calls reuse the running instance
 * instead of spawning a second one.
 *
 * No model, no network, no MCP — just SQLite + HTTP + three.js (client side).
 */

import { spawn, type Subprocess } from "bun"
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import type { CommandDef, CommandResult } from "./types.js"
import { openInBrowser } from "../remote/browser.js"

const DEFAULT_PORT = 4321
const MAX_PORT_ATTEMPTS = 64
const PID_FILE = ".aurict/visual/server.pid"

// ─── Command ─────────────────────────────────────────────────────────────────

export const visualCommands: CommandDef[] = [{
  name: "visual",
  aliases: ["graph", "3d"],
  description: "Open the 3D semantic code graph in your browser (needs `codegraph init`)",
  usage: "[port]",
  handler: (args, ctx): CommandResult => {
    const port = parsePort(args[0]) ?? DEFAULT_PORT

    // Reuse a running server if one is alive on this project.
    const existing = readRunningServer(ctx.workdir)
    if (existing) {
      const url = "http://127.0.0.1:" + existing.port
      openInBrowser(url)
      return {
        type: "text",
        content: [
          "Visual server already running.",
          "  URL: " + url,
          "  PID: " + existing.pid,
          "  Killed it? Run /visual --stop",
        ].join("\n"),
      }
    }

    // One-time idempotent guard so /visual --stop works without first running /visual.
    if (args.includes("--stop") || args.includes("-k")) {
      return stopRunningServer(ctx.workdir)
    }

    const boundPort = findFreePort(port)
    if (boundPort === null) {
      return { type: "error", message: "No free port in range " + port + "-" + (port + MAX_PORT_ATTEMPTS) + ". Pass an explicit port: /visual 5000" }
    }

    const serverPath = resolve(import.meta.dir, "../visual/server.ts")
    if (!existsSync(serverPath)) {
      return { type: "error", message: "Viewer server not found: " + serverPath }
    }

    const proc = spawn({
      cmd: ["bun", "run", serverPath, ctx.workdir, String(boundPort)],
      stdout: "ignore",
      stderr: "ignore",
      stdin: "ignore",
      // Detached so the server keeps running after the CLI's current event
      // loop tick completes. The parent writes the PID so it can later be
      // reaped by /visual --stop.
      detached: true,
      onExit: () => {
        removePidFile(join(ctx.workdir, PID_FILE), "visual server exit")
      },
    })

    // Allow the parent to exit independently of the child.
    try { (proc as Subprocess<"ignore", "ignore", "ignore">).unref() }
    catch (error) { console.warn(`[aurict] visual server could not detach: ${error instanceof Error ? error.message : String(error)}`) }

    const pid = typeof proc.pid === "number" ? proc.pid : -1
    writeRunningServer(ctx.workdir, { pid, port: boundPort })

    const url = "http://127.0.0.1:" + boundPort
    openInBrowser(url)

    return {
      type: "text",
      content: [
        "Visual server started.",
        "  URL: " + url,
        pid > 0 ? "  PID: " + pid : "  (PID unavailable — server is detached)",
        "  Graph: " + (
          existsSync(join(ctx.workdir, ".codegraph", "codegraph.db"))
            ? "indexed ✓"
            : "no index — run `codegraph init` then refresh"
        ),
        "",
        "  The server keeps running in the background. Use /visual --stop to kill it.",
      ].join("\n"),
    }
  },
}]

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface RunningServer { pid: number; port: number }

function parsePort(arg: string | undefined): number | undefined {
  if (!arg) return undefined
  const n = parseInt(arg, 10)
  if (!Number.isInteger(n) || n < 1024 || n > 65535) return undefined
  return n
}

/**
 * Quick TCP-bind probe. Open + immediately close a Bun.serve socket on the
 * candidate port; if the bind fails (EADDRINUSE) skip to the next one.
 */
function findFreePort(start: number): number | null {
  for (let p = start; p < start + MAX_PORT_ATTEMPTS; p++) {
    if (isPortFree(p)) return p
  }
  return null
}

function isPortFree(port: number): boolean {
  try {
    const probe = Bun.serve({
      port,
      hostname: "127.0.0.1",
      fetch: () => new Response("ok"),
    })
    probe.stop(true)
    return true
  } catch {
    return false
  }
}

function pidFilePath(workdir: string): string {
  return join(workdir, PID_FILE)
}

function readRunningServer(workdir: string): RunningServer | null {
  const path = pidFilePath(workdir)
  if (!existsSync(path)) return null
  try {
    const data = readFileSync(path, "utf8")
    const parsed = JSON.parse(data) as RunningServer
    if (!Number.isInteger(parsed.pid) || !Number.isInteger(parsed.port)) return null
    if (!isProcessAlive(parsed.pid)) {
      // Stale PID file — clean it up.
      const cleanupError = removePidFile(path, "stale visual server")
      if (cleanupError) throw new Error(cleanupError)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeRunningServer(workdir: string, info: RunningServer): void {
  const dir = dirname(pidFilePath(workdir))
  mkdirSync(dir, { recursive: true })
  writeFileSync(pidFilePath(workdir), JSON.stringify(info, null, 2) + "\n", "utf8")
}

function isProcessAlive(pid: number): boolean {
  if (pid <= 0) return false
  try {
    // signal 0 = just check existence, don't actually signal
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function removePidFile(path: string, context: string): string | null {
  try {
    unlinkSync(path)
    return null
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null
    const message = `${context} PID cleanup failed: ${error instanceof Error ? error.message : String(error)}`
    console.warn(`[aurict] ${message}`)
    return message
  }
}

function stopRunningServer(workdir: string): CommandResult {
  const existing = readRunningServer(workdir)
  if (!existing) return { type: "text", content: "No running visual server for this project." }
  let alreadyStopped = false
  try {
    process.kill(existing.pid, "SIGTERM")
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ESRCH") alreadyStopped = true
    else return { type: "error", message: `Failed to stop visual server: ${error instanceof Error ? error.message : String(error)}` }
  }
  const cleanupError = removePidFile(pidFilePath(workdir), "stopped visual server")
  if (cleanupError) return { type: "error", message: cleanupError }
  return { type: "text", content: (alreadyStopped ? "Visual server was already stopped" : "Visual server stopped") + " (PID " + existing.pid + ", port " + existing.port + ")." }
}
