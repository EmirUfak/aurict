/* eslint-disable import/no-unresolved -- Bun provides this test module at runtime. */
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FINANCE_UI_FILES = [
  'src/renderer/finance/FinanceComposer.tsx',
  'src/renderer/finance/FinanceAuditPanel.tsx',
  'src/renderer/finance/FinanceConversationList.tsx',
  'src/renderer/screens/FinanceScreen.tsx',
  'src/renderer/hooks/useFinanceChat.ts',
];

const TURKISH_UI_COPY = /[çğıöşüÇĞİÖŞÜ]|\b(?:Durum|Kaynaklar|kaynaklar|kayıt|araştırma|konuşmaları|yenile|gönder|iptal|hazırlanıyor|kullanılıyor)\b/u;

describe('Finance Desk interface language', () => {
  it('keeps user-facing Finance Desk copy in English', () => {
    for (const relativePath of FINANCE_UI_FILES) {
      const source = readFileSync(resolve(import.meta.dir, '..', relativePath), 'utf8');
      expect(source).not.toMatch(TURKISH_UI_COPY);
      expect(source).not.toContain("'tr-TR'");
    }
  });
});
