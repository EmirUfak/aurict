import type { Theme } from "../../utils/theme.js";
import { resolveSemanticTheme } from "./semantic-theme.js";

export interface ThemeValidationIssue {
  pair: string;
  ratio: number;
  minimum: number;
}

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number | null {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!match) return null;
  return 0.2126 * channel(parseInt(match[1]!, 16))
    + 0.7152 * channel(parseInt(match[2]!, 16))
    + 0.0722 * channel(parseInt(match[3]!, 16));
}

export function contrastRatio(foreground: string, background: string): number | null {
  const front = luminance(foreground);
  const back = luminance(background);
  if (front === null || back === null) return null;
  return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05);
}

export function validateThemeContrast(theme: Theme): ThemeValidationIssue[] {
  if (!theme.bgDeep || !theme.bgCard) return [];
  const semantic = resolveSemanticTheme(theme);
  const checks: Array<[string, string, string, number]> = [
    ["primary/base", semantic.foreground.primary, semantic.surface.base, 4.5],
    ["secondary/base", semantic.foreground.secondary, semantic.surface.base, 4.5],
    ["muted/raised", semantic.foreground.muted, semantic.surface.raised, 4.5],
    ["assistant/raised", semantic.identity.assistant, semantic.surface.raised, 4.5],
    ["info/raised", semantic.status.info, semantic.surface.raised, 4.5],
    ["success/raised", semantic.status.success, semantic.surface.raised, 4.5],
    ["warning/raised", semantic.status.warning, semantic.surface.raised, 4.5],
    ["error/raised", semantic.status.error, semantic.surface.raised, 4.5],
    ["focus/raised", semantic.border.focus, semantic.surface.raised, 3],
  ];
  return checks.flatMap(([pair, foreground, background, minimum]) => {
    const ratio = contrastRatio(foreground, background);
    return ratio !== null && ratio < minimum ? [{ pair, ratio, minimum }] : [];
  });
}
