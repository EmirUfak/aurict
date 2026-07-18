export type LivePresentation =
  | "idle"
  | "paused"
  | "text"
  | "reasoning"
  | "tool"
  | "activity";

export interface LiveStateInput {
  loading: boolean;
  paused: boolean;
  hasText: boolean;
  hasReasoning: boolean;
  hasActiveTool: boolean;
}

/**
 * Chooses one owner for the live area. Stable pending tool rows own tool
 * progress; commentary owns the area while text is arriving. This prevents
 * a generic spinner from splitting prose or duplicating a visible tool call.
 */
export function resolveLivePresentation(input: LiveStateInput): LivePresentation {
  if (input.loading && input.paused) return "paused";
  if (input.hasText) return "text";
  if (input.loading && input.hasActiveTool) return "tool";
  if (input.hasReasoning) return "reasoning";
  if (input.loading) return "activity";
  return "idle";
}
