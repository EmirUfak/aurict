import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareUserInput } from "../src/tui/app/prepare-user-input.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("prepareUserInput", () => {
  test("keeps ordinary prompts unchanged", async () => {
    expect(await prepareUserInput("  explain this  ", "/workspace")).toEqual({
      text: "explain this",
      attachments: [],
      warnings: [],
    });
  });

  test("resolves an image reference for the same turn", async () => {
    const directory = mkdtempSync(join(tmpdir(), "aurict-input-"));
    temporaryDirectories.push(directory);
    writeFileSync(join(directory, "pixel.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const prepared = await prepareUserInput("inspect @pixel.png please", directory);

    expect(prepared.text).toBe("inspect please");
    expect(prepared.attachments).toHaveLength(1);
    expect(prepared.attachments[0]?.name).toBe("pixel.png");
    expect(prepared.warnings).toEqual([]);
  });

  test("reports missing references instead of swallowing them", async () => {
    const prepared = await prepareUserInput("inspect @missing.png", "/workspace");

    expect(prepared.text).toBe("inspect");
    expect(prepared.attachments).toEqual([]);
    expect(prepared.warnings[0]).toContain("@missing.png yüklenemedi");
  });
});
