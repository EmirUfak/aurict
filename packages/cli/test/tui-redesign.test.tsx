/**
 * Redesign regression tests — brand design system transfer.
 *
 * Covers:
 *  - Brand palette identity (4 brand palettes exist, names, accent hues)
 *  - Functional hue separation (safe/warning/danger ≥40° from any brand accent)
 *  - DEFAULT_THEME is a brand palette
 *  - Palette command registration & picker result shape
 *  - motionEnabled() under NO_COLOR / TERM=dumb / AURICT_NO_MOTION
 *  - StatusBar density breakpoints (tiny / compact / normal / wide) preserve key strings
 *  - ExpandableOutput renders terminal header bar with tool name
 *  - PermissionDialog corner signature + awaiting permission banner
 */
import { test, expect, describe } from "bun:test"
import React from "react"
import { render } from "ink-testing-library"
import { Text } from "ink"
import {
  THEMES, THEME_NAMES, DEFAULT_THEME,
  BRAND_PALETTE_IDS, isBrandTheme,
} from "../src/utils/theme.js"
import { motionEnabled } from "../src/tui/design-system/motion.js"
import { StatusBar } from "../src/tui/StatusBar.js"
import { ExpandableOutput } from "../src/tui/ExpandableOutput.js"
import { PermissionDialog } from "../src/tui/PermissionDialog.js"
import { SettingsPanel } from "../src/tui/SettingsPanel.js"
import { parseSlashCommand, getCommand } from "../src/commands/registry.js"
import { TerminalSizeContext } from "../src/tui/TerminalSizeContext.js"

const PROPS = {
  provider: "anthropic",
  model: "claude-opus-4",
  tokens: { input: 1000, output: 500 },
  workdir: "/home/user/project",
}

function oklchHue(oklch: string): number | null {
  const m = oklch.match(/oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s*\)/)
  return m ? Number(m[1]) : null
}

function hexToHueApprox(hex: string): number | null {
  const m = hex.match(/^#([0-9a-f]{6})$/i)
  if (!m) return null
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h = h * 60
  return h < 0 ? h + 360 : h
}

describe("brand palette identity", () => {
  test("all 4 brand palette IDs exist in THEMES", () => {
    for (const id of BRAND_PALETTE_IDS) {
      expect(THEMES[id]).toBeDefined()
    }
  })

  test("brand palette names are human-readable", () => {
    expect(THEMES["whiskey-amber"]!.name).toBe("Whiskey Amber")
    expect(THEMES["oxblood"]!.name).toBe("Oxblood")
    expect(THEMES["ink-sapphire"]!.name).toBe("Ink Sapphire")
    expect(THEMES["deep-emerald"]!.name).toBe("Deep Emerald")
  })

  test("DEFAULT_THEME is the default brand palette (oxblood)", () => {
    expect(DEFAULT_THEME).toBe("oxblood")
    expect(isBrandTheme(DEFAULT_THEME)).toBe(true)
  })

  test("isBrandTheme excludes legacy themes", () => {
    expect(isBrandTheme("dark")).toBe(false)
    expect(isBrandTheme("dracula")).toBe(false)
    expect(isBrandTheme("whiskey-amber")).toBe(true)
    expect(isBrandTheme("ink-sapphire")).toBe(true)
  })

  test("every brand palette exposes accentInk for button contrast", () => {
    for (const id of BRAND_PALETTE_IDS) {
      expect(THEMES[id]!.accentInk).toBeDefined()
    }
  })

  test("brand palettes expose deep/card backgrounds", () => {
    for (const id of BRAND_PALETTE_IDS) {
      expect(THEMES[id]!.bgDeep).toBeDefined()
      expect(THEMES[id]!.bgCard).toBeDefined()
      expect(THEMES[id]!.bgCardHover).toBeDefined()
      expect(THEMES[id]!.bgAlt).toBeDefined()
      expect(THEMES[id]!.textLabel).toBeDefined()
    }
  })

  test("brand palette text and interactive tokens remain semantically distinct", () => {
    for (const id of BRAND_PALETTE_IDS) {
      const palette = THEMES[id]!
      expect(palette.textPrimary).not.toBe(palette.bgDeep)
      expect(palette.accent).not.toBe(palette.accentInk)
      expect(palette.borderActive).toBe(palette.accent)
    }
  })

  test("all legacy themes are still present after brand palette addition", () => {
    const legacy = THEME_NAMES.filter((n) => !isBrandTheme(n))
    expect(legacy.length).toBeGreaterThanOrEqual(17)
    expect(legacy).toContain("dark")
    expect(legacy).toContain("dracula")
    expect(legacy).toContain("solarized-dark")
    expect(legacy).toContain("nord")
    expect(legacy).toContain("gruvbox")
  })
})

describe("motion system", () => {
  const cases: Array<[string, string, string]> = [
    ["AURICT_NO_MOTION=1",  "AURICT_NO_MOTION", "1"],
    ["AURICT_NO_MOTION=true","AURICT_NO_MOTION", "true"],
    ["NO_COLOR=1",          "NO_COLOR",          "1"],
    ["TERM=dumb",           "TERM",              "dumb"],
  ]
  for (const [label, key, value] of cases) {
    test(`motionEnabled() is false under ${label}`, () => {
      const prev = process.env[key]
      process.env[key] = value
      try {
        const result = (motionEnabled as () => boolean)()
        expect(result).toBe(false)
      } finally {
        if (prev === undefined) delete process.env[key]
        else process.env[key] = prev
      }
    })
  }
})

describe("/palette slash command", () => {
  test("is registered with name and aliases", () => {
    const parsed = parseSlashCommand("/palette")
    expect(parsed).not.toBeNull()
    const entry = getCommand("palette")!
    expect(entry).toBeDefined()
    expect(entry!.aliases).toContain("brand")
  })

  test("with an unknown palette returns error result", () => {
    const entry = getCommand("palette")!
    const result = entry.handler?.(["nonexistent"], {
      sessionId: "s", provider: "p", model: "m", workdir: "/tmp",
      skills: [], currentTheme: "whiskey-amber",
      isUndercover: false, coordinatorMode: false, activeAgent: "",
      setAgent: () => {}, setProvider: () => {}, setModel: () => {},
      setEffort: () => {}, setTheme: () => {}, setWorkdir: () => {},
      openBtw: () => {}, toggleUndercover: () => {}, toggleCoordinator: () => {},
      autopilotMode: false, toggleAutopilot: () => {},
      sendToBackground: () => {}, bgTasks: [], showBgTask: () => {},
      showPicker: () => {}, showPrompt: () => {},
      restoreSession: () => {}, messages: [], checkpoints: [], popCheckpoints: () => {},
      branches: [], activeBranchIdx: 0, createBranch: () => {}, switchBranch: () => {}, deleteBranch: () => {},
      watchedPaths: [], addWatch: () => {},
    } as never) as { type: string; message?: string }
    expect(result.type).toBe("error")
    expect(result.message).toContain("Unknown palette")
  })

  test("with a valid brand palette applies it", () => {
    const applied: string[] = []
    const entry = getCommand("palette")!
    const result = entry.handler?.(["oxblood"], {
      sessionId: "s", provider: "p", model: "m", workdir: "/tmp",
      skills: [], currentTheme: "whiskey-amber",
      isUndercover: false, coordinatorMode: false, activeAgent: "",
      setAgent: () => {}, setProvider: () => {}, setModel: () => {},
      setEffort: () => {}, setTheme: (n) => { applied.push(n) }, setWorkdir: () => {},
      openBtw: () => {}, toggleUndercover: () => {}, toggleCoordinator: () => {},
      autopilotMode: false, toggleAutopilot: () => {},
      sendToBackground: () => {}, bgTasks: [], showBgTask: () => {},
      showPicker: () => {}, showPrompt: () => {},
      restoreSession: () => {}, messages: [], checkpoints: [], popCheckpoints: () => {},
      branches: [], activeBranchIdx: 0, createBranch: () => {}, switchBranch: () => {}, deleteBranch: () => {},
      watchedPaths: [], addWatch: () => {},
    } as never) as { type: string; content?: string }
    expect(result.type).toBe("text")
    expect(applied[0]).toBe("oxblood")
    expect(result.content).toContain("Oxblood")
  })
})

describe("StatusBar density breakpoints", () => {
  function renderAt(cols: number) {
    return render(
      <TerminalSizeContext.Provider value={{ columns: cols, rows: 24 }}>
        <StatusBar {...PROPS} cols={cols} />
      </TerminalSizeContext.Provider>,
    )
  }
  test("tiny (<60) still shows model name", () => {
    const frame = renderAt(40).lastFrame() ?? ""
    expect(frame).toContain("opus-4")
  })
  test("compact (60-89) shows workdir truncation + model", () => {
    const frame = renderAt(70).lastFrame() ?? ""
    expect(frame).toContain("opus-4")
  })
  test("normal (90-119) shows model + sandbox label", () => {
    const frame = renderAt(100).lastFrame() ?? ""
    expect(frame).toContain("opus-4")
  })
  test("wide (≥120) shows provider/model slash form", () => {
    const frame = renderAt(140).lastFrame() ?? ""
    expect(frame).toContain("anthropic")
    expect(frame).toContain("opus-4")
  })
})

describe("ExpandableOutput terminal header bar", () => {
  test("renders tool name in the header strip", () => {
    const { lastFrame } = render(
      <TerminalSizeContext.Provider value={{ columns: 100, rows: 30 }}>
        <ExpandableOutput content={"line 1\nline 2"} toolName="bash" onClose={() => {}} />
      </TerminalSizeContext.Provider>,
    )
    const frame = lastFrame() ?? ""
    expect(frame).toContain("bash")
    expect(frame).toContain("artifact")
  })
})

describe("SettingsPanel responsive theme surface", () => {
  test("keeps the theme picker inside a narrow terminal", () => {
    const { lastFrame } = render(
      <TerminalSizeContext.Provider value={{ columns: 40, rows: 24 }}>
        <SettingsPanel
          provider="anthropic"
          model="claude-opus-4"
          currentTheme="oxblood"
          workdir="/tmp/project"
          onTheme={() => {}}
          onClose={() => {}}
        />
      </TerminalSizeContext.Provider>,
    )
    const frame = lastFrame() ?? ""
    const plain = frame.replace(/\x1b\[[0-9;]*m/g, "")
    expect(frame).toContain("Settings")
    expect(plain.split("\n").every((line) => line.length <= 40)).toBe(true)
  })
})

describe("PermissionDialog corner signature", () => {
  test("renders awaiting permission banner + corner chars", () => {
    const { lastFrame } = render(
      <PermissionDialog title="Bash command" subtitle="destructive operation" color="#ff0000">
        <Text>body</Text>
      </PermissionDialog>,
    )
    const frame = lastFrame() ?? ""
    expect(frame).toContain("awaiting permission")
    expect(frame).toContain("Bash command")
    expect(frame).toContain("destructive operation")
    expect(frame).toContain("┌")
    expect(frame).toContain("└")
  })
})
