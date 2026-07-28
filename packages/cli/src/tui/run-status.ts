type AgentPreparationPhase =
  | "preparing_context"
  | "resolving_model"
  | "compacting"
  | "waiting_for_provider";

export type RunActivity =
  | AgentPreparationPhase
  | "thinking"
  | "responding"
  | "using_tool";

const ACTIVITY_LABELS: Record<RunActivity, string> = {
  preparing_context: "assembling context",
  resolving_model: "resolving model",
  compacting: "compacting context",
  waiting_for_provider: "waiting for provider",
  thinking: "thinking",
  responding: "responding",
  using_tool: "running tool",
};

export function activityLabel(activity: RunActivity | undefined): string {
  return activity ? (ACTIVITY_LABELS[activity] ?? "working") : "working";
}
