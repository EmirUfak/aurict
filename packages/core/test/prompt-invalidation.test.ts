import { afterEach, describe, expect, it } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { invalidatePromptSectionsForChangedFile } from "../src/agent/prompt-invalidation.js"
import {
  clearPromptSectionCache,
  resolvePromptSections,
  sessionPromptSection,
} from "../src/agent/prompt-sections.js"

let tmpDir: string

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true })
  clearPromptSectionCache({ cacheKey: tmpDir })
})

describe("prompt section invalidation", () => {
  it("invalidates project instructions when AGENTS.md changes", async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "aurict-prompt-invalidate-"))
    let instructionComputes = 0
    let contextComputes = 0
    const sections = [
      sessionPromptSection("project_instructions", () => { instructionComputes++; return "instructions" }),
      sessionPromptSection("project_context", () => { contextComputes++; return "context" }),
    ]
    await resolvePromptSections(sections, tmpDir)

    invalidatePromptSectionsForChangedFile(tmpDir, "AGENTS.md")
    await resolvePromptSections(sections, tmpDir)

    expect(instructionComputes).toBe(2)
    expect(contextComputes).toBe(1)
  })

  it("invalidates project context when .aurict files change", async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "aurict-prompt-invalidate-"))
    let instructionComputes = 0
    let contextComputes = 0
    const sections = [
      sessionPromptSection("project_instructions", () => { instructionComputes++; return "instructions" }),
      sessionPromptSection("project_context", () => { contextComputes++; return "context" }),
    ]
    await resolvePromptSections(sections, tmpDir)

    invalidatePromptSectionsForChangedFile(tmpDir, ".aurict/architecture.md")
    await resolvePromptSections(sections, tmpDir)

    expect(instructionComputes).toBe(1)
    expect(contextComputes).toBe(2)
  })

  it("ignores unrelated files", async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "aurict-prompt-invalidate-"))
    let instructionComputes = 0
    let contextComputes = 0
    const sections = [
      sessionPromptSection("project_instructions", () => { instructionComputes++; return "instructions" }),
      sessionPromptSection("project_context", () => { contextComputes++; return "context" }),
    ]
    await resolvePromptSections(sections, tmpDir)

    invalidatePromptSectionsForChangedFile(tmpDir, "src/index.ts")
    await resolvePromptSections(sections, tmpDir)

    expect(instructionComputes).toBe(1)
    expect(contextComputes).toBe(1)
  })
})
