export type MarkdownBlock =
  | { kind: 'heading'; level: number; content: string }
  | { kind: 'paragraph'; content: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'rule' }
  | { kind: 'code'; language: string; content: string };

function tableCells(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index] ?? '';
  return /^#{1,6}\s+/.test(line)
    || /^```/.test(line)
    || /^([-*_])\1{2,}\s*$/.test(line)
    || /^\s*(?:[-*+] |\d+\. )/.test(line)
    || (line.includes('|') && isTableDivider(lines[index + 1] ?? ''));
}

export function parseMarkdown(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';
    if (!line.trim()) { index += 1; continue; }

    const fence = /^```([^\s]*)\s*$/.exec(line);
    if (fence) {
      const language = fence[1] ?? '';
      index += 1;
      const code: string[] = [];
      while (index < lines.length && !/^```\s*$/.test(lines[index] ?? '')) {
        code.push(lines[index] ?? '');
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ kind: 'code', language, content: code.join('\n') });
      continue;
    }

    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading?.[1] && heading[2]) {
      blocks.push({ kind: 'heading', level: heading[1].length, content: heading[2] });
      index += 1;
      continue;
    }
    if (/^([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push({ kind: 'rule' });
      index += 1;
      continue;
    }

    if (line.includes('|') && isTableDivider(lines[index + 1] ?? '')) {
      const headers = tableCells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && (lines[index] ?? '').includes('|') && (lines[index] ?? '').trim()) {
        const row = tableCells(lines[index] ?? '');
        if (row.length !== headers.length) break;
        rows.push(row);
        index += 1;
      }
      blocks.push({ kind: 'table', headers, rows });
      continue;
    }

    const list = /^\s*(?:([-*+])|(\d+)\.)\s+(.+?)\s*$/.exec(line);
    if (list) {
      const ordered = Boolean(list[2]);
      const items: string[] = [];
      while (index < lines.length) {
        const item = /^\s*(?:([-*+])|(\d+)\.)\s+(.+?)\s*$/.exec(lines[index] ?? '');
        if (!item || Boolean(item[2]) !== ordered || !item[3]) break;
        items.push(item[3]);
        index += 1;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length && (lines[index] ?? '').trim() && !isBlockStart(lines, index)) {
      paragraph.push(lines[index] ?? '');
      index += 1;
    }
    blocks.push({ kind: 'paragraph', content: paragraph.join('\n') });
  }

  return blocks;
}
