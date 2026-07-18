export type TerminalDensity = "tiny" | "compact" | "normal" | "wide";

export function terminalDensity(columns: number): TerminalDensity {
  if (columns < 60) return "tiny";
  if (columns < 90) return "compact";
  if (columns < 120) return "normal";
  return "wide";
}
