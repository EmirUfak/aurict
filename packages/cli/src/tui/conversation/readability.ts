const MARKDOWN_HEADING = /^#{1,6}\s+\S/u;
const STANDALONE_BOLD = /^\s*(\*\*|__)(\S(?:.*\S)?)\1\s*$/u;
const SENTENCE_END = /[.!?…]$/u;
const MAX_PROSE_WIDTH = 110;

export interface ProseLayout {
  contentWidth: number;
  leftInset: number;
}

/** Keeps prose scannable on wide terminals while preserving compact layouts. */
export function proseLayout(availableWidth: number): ProseLayout {
  const safeWidth = Math.max(12, availableWidth);
  const leftInset = safeWidth > MAX_PROSE_WIDTH ? 2 : 0;
  return {
    contentWidth: Math.max(12, Math.min(MAX_PROSE_WIDTH, safeWidth - leftInset)),
    leftInset,
  };
}

export function isMarkdownHeading(line: string): boolean {
  return MARKDOWN_HEADING.test(line);
}

export function isMarkdownListItem(line: string): boolean {
  return /^\s*(?:[-*+]\s|\d+[.)]\s)/u.test(line);
}

/**
 * Treat only a short, bold-only line as a section heading. Inline emphasis,
 * list items, full sentences, and long generated paragraphs keep normal flow.
 */
export function standaloneSectionTitle(line: string): string | undefined {
  const match = line.match(STANDALONE_BOLD);
  const title = match?.[2]?.trim();
  if (!title || title.length > 80 || SENTENCE_END.test(title)) return undefined;
  return /[\p{L}\p{N}]/u.test(title) ? title : undefined;
}
