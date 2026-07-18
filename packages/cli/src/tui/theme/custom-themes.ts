import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_THEME, THEMES, THEME_NAMES, type Theme } from "../../utils/theme.js";

type ThemeColorKey = Exclude<keyof Theme, "name" | "brandId">;

interface ThemeDefinition {
  name: string;
  extends?: string;
  colors?: Partial<Record<ThemeColorKey, string>>;
}

interface ThemeFile {
  themes: Record<string, ThemeDefinition>;
}

const COLOR_KEYS = new Set<ThemeColorKey>([
  "accent", "accentAlt", "accentInk", "success", "error", "warning",
  "userColor", "assistantDot", "toolColor", "systemColor", "textPrimary",
  "textSecondary", "textDim", "textLabel", "borderDim", "borderBright",
  "borderActive", "bgHighlight", "bgDeep", "bgCard", "bgCardHover", "bgAlt",
  "buddyMain", "buddyEar",
]);

function parseThemeFile(path: string): ThemeFile | undefined {
  if (!existsSync(path)) return undefined;
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!parsed || typeof parsed !== "object" || !("themes" in parsed))
    throw new Error(`Invalid theme file ${path}: expected a top-level \"themes\" object`);
  const themes = (parsed as { themes?: unknown }).themes;
  if (!themes || typeof themes !== "object" || Array.isArray(themes))
    throw new Error(`Invalid theme file ${path}: \"themes\" must be an object`);
  return { themes: themes as Record<string, ThemeDefinition> };
}

function registerFile(path: string, customIds: Set<string>): void {
  const file = parseThemeFile(path);
  if (!file) return;
  for (const [id, definition] of Object.entries(file.themes)) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id))
      throw new Error(`Invalid theme id \"${id}\" in ${path}`);
    if (!definition || typeof definition !== "object" || typeof definition.name !== "string" || !definition.name.trim())
      throw new Error(`Invalid theme \"${id}\" in ${path}: a non-empty name is required`);
    if (THEMES[id] && !customIds.has(id))
      throw new Error(`Custom theme \"${id}\" in ${path} conflicts with a built-in theme`);
    const baseId = definition.extends ?? DEFAULT_THEME;
    const base = THEMES[baseId];
    if (!base) throw new Error(`Custom theme \"${id}\" in ${path} extends unknown theme \"${baseId}\"`);
    const colors = definition.colors ?? {};
    for (const [key, value] of Object.entries(colors)) {
      if (!COLOR_KEYS.has(key as ThemeColorKey))
        throw new Error(`Custom theme \"${id}\" in ${path} uses unknown color role \"${key}\"`);
      if (typeof value !== "string" || !value.trim())
        throw new Error(`Custom theme \"${id}\" in ${path} has an invalid value for \"${key}\"`);
    }
    const custom: Theme = { ...base, ...colors, name: definition.name.trim() };
    delete custom.brandId;
    THEMES[id] = custom;
    if (!THEME_NAMES.includes(id)) THEME_NAMES.push(id);
    customIds.add(id);
  }
}

/** Loads user themes first, then lets the current project override custom ids. */
export function registerCustomThemes(
  workdir: string,
  configRoot = process.env["XDG_CONFIG_HOME"] ?? join(homedir(), ".config"),
): string[] {
  const customIds = new Set<string>();
  registerFile(join(configRoot, "aurict", "themes.json"), customIds);
  registerFile(join(workdir, ".aurict", "themes.json"), customIds);
  return [...customIds];
}
