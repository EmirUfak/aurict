import { useMemo } from "react";
import type { Theme } from "../../utils/theme.js";
import { useTheme } from "../../utils/theme.js";

export interface SemanticTheme {
  foreground: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  identity: {
    user: string;
    assistant: string;
    system: string;
  };
  activity: {
    idle: string;
    running: string;
  };
  status: {
    info: string;
    success: string;
    warning: string;
    error: string;
  };
  tool: {
    default: string;
    running: string;
    success: string;
    error: string;
  };
  surface: {
    base: string;
    raised: string;
    overlay: string;
    selected: string;
  };
  border: {
    subtle: string;
    default: string;
    focus: string;
  };
  markdown: {
    heading: string;
    link: string;
    bullet: string;
    code: string;
    quote: string;
  };
  diff: {
    added: string;
    removed: string;
    context: string;
    hunk: string;
    lineNumber: string;
  };
}

/** Converts palette-level values into stable user-facing roles. */
export function resolveSemanticTheme(theme: Theme): SemanticTheme {
  const base = theme.bgDeep ?? theme.bgHighlight;
  const raised = theme.bgCard ?? theme.bgHighlight;
  return {
    foreground: {
      primary: theme.textPrimary,
      secondary: theme.textSecondary,
      muted: theme.textDim,
      inverse: theme.accentInk ?? base,
    },
    identity: {
      user: theme.userColor,
      assistant: theme.assistantDot,
      system: theme.systemColor,
    },
    activity: {
      idle: theme.textDim,
      running: theme.accent,
    },
    status: {
      info: theme.accentAlt,
      success: theme.success,
      warning: theme.warning,
      error: theme.error,
    },
    tool: {
      default: theme.textSecondary,
      running: theme.accentAlt,
      success: theme.success,
      error: theme.error,
    },
    surface: {
      base,
      raised,
      overlay: theme.bgAlt ?? raised,
      selected: theme.bgCardHover ?? theme.bgHighlight,
    },
    border: {
      subtle: theme.borderDim,
      default: theme.borderBright,
      focus: theme.borderActive,
    },
    markdown: {
      heading: theme.textPrimary,
      link: theme.accentAlt,
      bullet: theme.accentAlt,
      code: theme.accentAlt,
      quote: theme.textDim,
    },
    diff: {
      added: theme.success,
      removed: theme.error,
      context: theme.textDim,
      hunk: theme.accent,
      lineNumber: theme.borderBright,
    },
  };
}

export function useSemanticTheme(): SemanticTheme {
  const theme = useTheme();
  return useMemo(() => resolveSemanticTheme(theme), [theme]);
}
