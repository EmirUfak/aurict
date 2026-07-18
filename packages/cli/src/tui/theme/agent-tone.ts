import type { SemanticTheme } from "./semantic-theme.js";

/** Maps agent specialities to a small, theme-owned set of meaningful tones. */
export function agentTone(type: string, theme: SemanticTheme): string {
  switch (type) {
    case "security":
    case "pentest":
      return theme.status.error;
    case "review":
    case "performance":
    case "analytics":
      return theme.status.warning;
    case "docs":
    case "reporter":
    case "critic":
      return theme.foreground.secondary;
    case "explore":
    case "code":
    case "test":
    case "debug":
    case "refactor":
    case "devops":
    case "design":
    case "data":
    case "adviser":
      return theme.status.info;
    default:
      return theme.identity.assistant;
  }
}
