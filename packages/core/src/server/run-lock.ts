const activeSessions = new Set<string>()

export function acquireSessionRun(sessionId: string): (() => void) | null {
  if (activeSessions.has(sessionId)) return null
  activeSessions.add(sessionId)
  let released = false
  return () => {
    if (released) return
    released = true
    activeSessions.delete(sessionId)
  }
}

export function isSessionRunActive(sessionId: string): boolean {
  return activeSessions.has(sessionId)
}
