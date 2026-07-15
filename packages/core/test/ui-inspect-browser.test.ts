import { describe, expect, it } from "bun:test"
import {
  readAccessibilitySnapshot,
  type BrowserPage,
} from "../src/tool/built-in/_ui-inspect-browser.js"

function fakePage(overrides: Partial<BrowserPage>): BrowserPage {
  return {
    goto: async () => undefined,
    setContent: async () => undefined,
    evaluate: async () => undefined,
    title: async () => "",
    url: () => "http://example.test",
    $: async () => undefined,
    close: async () => undefined,
    ...overrides,
  }
}

describe("ui_inspect browser adapter", () => {
  it("uses Playwright's current ariaSnapshot API and scopes it to the selector", async () => {
    let receivedSelector: string | undefined
    const page = fakePage({
      locator(selector) {
        receivedSelector = selector
        return { ariaSnapshot: async () => '- button "Save"' }
      },
    })

    await expect(readAccessibilitySnapshot(page, "playwright", "main")).resolves.toEqual({
      kind: "aria",
      value: '- button "Save"',
    })
    expect(receivedSelector).toBe("main")
  })

  it("uses Puppeteer's accessibility tree with the selected root", async () => {
    const root = { id: "dialog" }
    let receivedOptions: unknown
    const page = fakePage({
      $: async () => root,
      accessibility: {
        snapshot: async (options?: unknown) => {
          receivedOptions = options
          return { role: "dialog", name: "Confirm" }
        },
      },
    })

    await expect(readAccessibilitySnapshot(page, "puppeteer", "#dialog")).resolves.toEqual({
      kind: "tree",
      value: { role: "dialog", name: "Confirm" },
    })
    expect(receivedOptions).toEqual({ root })
  })
})
