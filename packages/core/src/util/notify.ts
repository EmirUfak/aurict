import { execFileSync } from "node:child_process"

type NotifyLevel = "info" | "success" | "error"

export interface NotificationPayload {
  title: string
  body: string
  level: NotifyLevel
}

function platform(): "mac" | "linux" | "other" {
  if (process.platform === "darwin") return "mac"
  if (process.platform === "linux") return "linux"
  return "other"
}

/** Native notifications are opt-in because terminal prompts may be sensitive. */
export function nativeNotificationsEnabled(): boolean {
  return process.env["AURICT_NATIVE_NOTIFICATIONS"] === "1"
}

function sendNative(payload: NotificationPayload): boolean {
  try {
    if (platform() === "mac") {
      const escapedTitle = payload.title.replaceAll("\\", "\\\\").replaceAll('"', '\\"')
      const escapedBody = payload.body.replaceAll("\\", "\\\\").replaceAll('"', '\\"')
      execFileSync("osascript", [
        "-e",
        `display notification "${escapedBody}" with title "Aurict: ${escapedTitle}"`,
      ], { stdio: "ignore", timeout: 3_000 })
      return true
    }
    if (platform() === "linux") {
      execFileSync("notify-send", [
        "-u", "normal",
        "-t", "5000",
        `Aurict: ${payload.title}`,
        payload.body,
      ], { stdio: "ignore", timeout: 3_000 })
      return true
    }
    return false
  } catch (error) {
    console.warn("[aurict] native notification failed", error)
    return false
  }
}

export function notify(payload: NotificationPayload): boolean {
  process.stdout.write("\x07")
  return nativeNotificationsEnabled() ? sendNative(payload) : false
}

export function taskCompletionNotification(durationMs: number): NotificationPayload {
  const duration = durationMs >= 60_000
    ? `${Math.round(durationMs / 60_000)}m`
    : `${Math.round(durationMs / 1_000)}s`
  return {
    title: "Task completed",
    body: `Open Aurict terminal to review the result (${duration}).`,
    level: "success",
  }
}

export function taskFailureNotification(): NotificationPayload {
  return {
    title: "Task needs attention",
    body: "Open Aurict terminal to review the error.",
    level: "error",
  }
}

export function notifyTaskDone(_prompt: string, durationMs: number): void {
  notify(taskCompletionNotification(durationMs))
}

export function notifyError(_prompt: string): void {
  notify(taskFailureNotification())
}
