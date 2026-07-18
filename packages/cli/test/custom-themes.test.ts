import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { registerCustomThemes } from "../src/tui/theme/custom-themes.js";
import { THEMES, THEME_NAMES } from "../src/utils/theme.js";

const createdIds: string[] = [];
const tempRoots: string[] = [];

afterEach(() => {
  for (const id of createdIds.splice(0)) {
    delete THEMES[id];
    const index = THEME_NAMES.indexOf(id);
    if (index >= 0) THEME_NAMES.splice(index, 1);
  }
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "aurict-theme-"));
  tempRoots.push(root);
  return root;
}

describe("custom terminal themes", () => {
  test("loads a project theme by extending a built-in semantic palette", () => {
    const project = tempRoot();
    const config = tempRoot();
    mkdirSync(join(project, ".aurict"));
    writeFileSync(join(project, ".aurict", "themes.json"), JSON.stringify({
      themes: {
        "studio-night": {
          name: "Studio Night",
          extends: "ink-sapphire",
          colors: { accent: "#73b7ff", borderActive: "#73b7ff" },
        },
      },
    }));
    createdIds.push(...registerCustomThemes(project, config));
    expect(THEMES["studio-night"]).toMatchObject({
      name: "Studio Night",
      accent: "#73b7ff",
      textPrimary: THEMES["ink-sapphire"]!.textPrimary,
    });
    expect(THEME_NAMES).toContain("studio-night");
  });

  test("fails visibly for unknown roles instead of masking a typo", () => {
    const project = tempRoot();
    const config = tempRoot();
    mkdirSync(join(project, ".aurict"));
    writeFileSync(join(project, ".aurict", "themes.json"), JSON.stringify({
      themes: { typo: { name: "Typo", colors: { acccent: "#ffffff" } } },
    }));
    expect(() => registerCustomThemes(project, config)).toThrow("unknown color role \"acccent\"");
  });
});
