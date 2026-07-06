import { reassertActiveModes } from "./terminal-modes.js"

/**
 * If new data arrives on stdin after a silence longer than this duration,
 * we assume terminal modes (mouse tracking, bracketed paste, ...) need to
 * be re-asserted — in scenarios like tmux detach/reattach, an SSH
 * disconnect, or a laptop sleep/wake, the remote terminal may have reset
 * its DEC private mode state; a mode Aurict still considers "active" may
 * no longer actually be active in the terminal.
 */
export const STDIN_RESUME_GAP_MS = 5000

let installed = false
let lastActivityAt = Date.now()

/** Pure decision function — verified in tests without needing a real time source. */
export function shouldReassertModes(
  now: number,
  lastActivity: number,
  gapMs: number = STDIN_RESUME_GAP_MS,
): boolean {
  return now - lastActivity > gapMs
}

/**
 * Installs the stdin activity watcher. Since Ink 5 consumes stdin via
 * 'readable' + `read()` (paused mode), we do NOT add a 'data' listener here
 * — adding one would switch the stream into flowing mode, conflicting with
 * Ink's manual `read()` loop. A 'readable' listener doesn't disturb paused mode.
 *
 * @returns An uninstall function.
 */
export function installStdinResumeGuard(now: () => number = Date.now): () => void {
  if (installed) return () => {}
  installed = true
  lastActivityAt = now()

  const onActivity = (): void => {
    const current = now()
    if (shouldReassertModes(current, lastActivityAt)) {
      reassertActiveModes()
    }
    lastActivityAt = current
  }

  process.stdin.on("readable", onActivity)
  return () => {
    process.stdin.off("readable", onActivity)
    installed = false
  }
}

/** Test-only: resets module-level state. */
export function __resetForTest(): void {
  installed = false
  lastActivityAt = Date.now()
}
