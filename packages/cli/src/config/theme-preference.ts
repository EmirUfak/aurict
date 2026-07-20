import { setDefault } from "@aurict/core";
import { DEFAULT_THEME, THEMES } from "../utils/theme.js";

export function resolveThemePreference(configuredTheme?: string): string {
  if (configuredTheme === undefined) return DEFAULT_THEME;
  if (!THEMES[configuredTheme])
    throw new Error(`Configured theme '${configuredTheme}' is not available`);
  return configuredTheme;
}

export function persistThemePreference(themeName: string): void {
  if (!THEMES[themeName])
    throw new Error(`Cannot persist unknown theme '${themeName}'`);
  setDefault("theme", themeName);
}

