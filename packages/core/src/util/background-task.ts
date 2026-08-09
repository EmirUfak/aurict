function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function reportBackgroundError(operation: string, error: unknown): void {
  console.warn(`[aurict] ${operation} failed: ${message(error)}`)
}

export function observeBackground(promise: Promise<unknown>, operation: string): void {
  void promise.catch((error) => reportBackgroundError(operation, error))
}
