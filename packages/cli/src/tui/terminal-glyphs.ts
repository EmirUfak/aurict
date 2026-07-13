export type GlyphName =
  | "assistant"
  | "user"
  | "system"
  | "thinking"
  | "tool"
  | "search"
  | "write"
  | "web"
  | "agent"
  | "quote"
  | "bullet"
  | "done"
  | "todo"
  | "open"
  | "close"

const UNICODE_GLYPHS: Record<GlyphName, string> = {
  assistant: "◇", user: "◆", system: "·", thinking: "∴", tool: "›",
  search: "⌕", write: "✦", web: "↗", agent: "◇", quote: "│",
  bullet: "•", done: "●", todo: "○", open: "┌", close: "└",
}

const ASCII_GLYPHS: Record<GlyphName, string> = {
  assistant: "*", user: ">", system: "-", thinking: "~", tool: ">",
  search: "?", write: "+", web: ">", agent: "*", quote: "|",
  bullet: "-", done: "x", todo: "o", open: "+", close: "+",
}

export function prefersAsciiGlyphs(): boolean {
  return process.env["AURICT_ASCII"] === "1" || process.env["TERM"] === "dumb"
}

export function glyph(name: GlyphName): string {
  return (prefersAsciiGlyphs() ? ASCII_GLYPHS : UNICODE_GLYPHS)[name]
}
