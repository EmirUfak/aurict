/**
 * Remote — open browser (best-effort).
 *
 * Tries to open the device-login approval page; silently swallows failures —
 * the caller already prints the URL to the user, so opening it isn't on the
 * critical path (spawn can fail on headless servers/SSH sessions).
 *
 * Uses Bun.spawn (the same pattern as the git-branch detection in App.tsx) —
 * it throws synchronously when the binary is missing, so there's no risk of
 * crashing the process the way node:child_process's async "error" event can
 * if left without a listener.
 */

function openCommand(url: string): string[] {
  if (process.platform === "darwin") return ["open", url]
  if (process.platform === "win32") return ["cmd", "/c", "start", "", url]
  return ["xdg-open", url]
}

export function openInBrowser(url: string): void {
  const cmd = openCommand(url)
  import("bun").then(({ spawn }) => {
    try {
      spawn(cmd, { stdout: "ignore", stderr: "ignore", stdin: "ignore" })
    } catch {
      // best-effort — caller prints the URL regardless
    }
  }).catch(() => { /* not running under bun — shouldn't happen for this CLI */ })
}
