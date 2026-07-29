// eslint-disable-next-line import/no-unresolved -- Bun provides this test module at runtime.
import { describe, expect, it } from 'bun:test';
import { parseMarkdown } from '../src/renderer/components/markdown-parser.js';

describe('desktop Markdown parser', () => {
  it('preserves a finance analysis as headings, tables, lists, and a structured audit block', () => {
    const blocks = parseMarkdown(`## TRSYKFK72716 — Getiri Hesaplaması

Tahvil tipi: **TLREF'e endeksli**.

| Metrik | Değer |
|---|---|
| TLREF Günlük Oran | %0,1094274 |

1. TLREF düşüş riski

\`\`\`finance-audit
{"summary":"Analiz tamamlandı","dataAsOf":"2026-07-24"}
\`\`\``);

    expect(blocks).toEqual([
      { kind: 'heading', level: 2, content: 'TRSYKFK72716 — Getiri Hesaplaması' },
      { kind: 'paragraph', content: "Tahvil tipi: **TLREF'e endeksli**." },
      { kind: 'table', headers: ['Metrik', 'Değer'], rows: [['TLREF Günlük Oran', '%0,1094274']] },
      { kind: 'list', ordered: true, items: ['TLREF düşüş riski'] },
      { kind: 'code', language: 'finance-audit', content: '{"summary":"Analiz tamamlandı","dataAsOf":"2026-07-24"}' },
    ]);
  });

  it('leaves unmatched table syntax as readable prose', () => {
    expect(parseMarkdown('| This is not a table |')).toEqual([{ kind: 'paragraph', content: '| This is not a table |' }]);
  });
});
