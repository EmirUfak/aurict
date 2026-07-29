import type { CoreMessage } from "@aurict/core"

export interface PersistentTurnHistoryInput {
  currentHistory: CoreMessage[]
  submittedHistory: CoreMessage[]
  compactedMessages?: CoreMessage[]
  newMessages: CoreMessage[]
  internalContinuation: boolean
  submittedPrompt: string
}

/** Resolves the exact history that the next terminal turn must send. */
export function resolvePersistentTurnHistory(
  input: PersistentTurnHistoryInput,
): CoreMessage[] {
  const base = input.compactedMessages
    ? input.internalContinuation
      ? removeInternalContinuation(input.compactedMessages, input.submittedPrompt)
      : input.compactedMessages
    : input.internalContinuation
      ? input.currentHistory
      : input.submittedHistory
  return [...base, ...input.newMessages]
}

function removeInternalContinuation(
  history: CoreMessage[],
  prompt: string,
): CoreMessage[] {
  let index = -1
  for (let candidate = history.length - 1; candidate >= 0; candidate--) {
    const message = history[candidate]
    if (message?.role === "user" && message.content === prompt) {
      index = candidate
      break
    }
  }
  if (index < 0) return history
  return [...history.slice(0, index), ...history.slice(index + 1)]
}
