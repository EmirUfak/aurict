/* eslint-disable import/no-unresolved -- Bun provides this test module at runtime. */
import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createFinanceStore } from '../src/main/finance-store.js';

const created: string[] = [];

afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('desktop finance store', () => {
  it('persists an auditable deterministic calculation and removes it explicitly', () => {
    const userData = mkdtempSync(path.join(tmpdir(), 'aurict-finance-'));
    created.push(userData);
    const store = createFinanceStore(() => userData);
    const saved = store.saveCalculation({
      calculation: 'net_present_value', formulaVersion: '1.0', calculatedAt: '2026-07-11T00:00:00.000Z',
      precision: { decimalPlaces: 12, rounding: 'half_up' }, inputs: { rate: '0.1' }, outputs: { netPresentValue: '0' }, assumptions: ['test assumption'], warnings: [],
    });

    expect(store.listCalculations()).toEqual([saved]);
    expect(store.removeCalculation(saved.id)).toBe(true);
    expect(store.listCalculations()).toEqual([]);
  });

  it('keeps research requests separately from calculation history', () => {
    const userData = mkdtempSync(path.join(tmpdir(), 'aurict-finance-'));
    created.push(userData);
    const store = createFinanceStore(() => userData);
    const entry = store.createResearch('Compare funding costs');

    expect(store.listResearch()).toEqual([entry]);
    expect(store.listCalculations()).toEqual([]);
  });

  it('records source-backed research audits and flags review only when needed', () => {
    const userData = mkdtempSync(path.join(tmpdir(), 'aurict-finance-'));
    created.push(userData);
    const store = createFinanceStore(() => userData);
    const entry = store.createResearch('Compare funding costs');
    const audited = store.recordResearchAudit(entry.id, {
      summary: 'Funding costs increased.', dataAsOf: '2026-07-11T00:00:00.000Z',
      sources: [{ title: 'Primary source', url: 'https://example.com/source', accessedAt: '2026-07-11T01:00:00.000Z' }], assumptions: ['Illustrative inputs'], uncertainties: ['Market conditions change'],
    });

    expect(audited.status).toBe('complete');
    expect(audited.audit?.sources).toHaveLength(1);
    expect(store.listResearch()[0]?.status).toBe('complete');
  });

  it('persists a Finance Desk conversation, its audit, and a failed turn state', () => {
    const userData = mkdtempSync(path.join(tmpdir(), 'aurict-finance-'));
    created.push(userData);
    const store = createFinanceStore(() => userData);
    const conversation = store.createConversation();
    const withQuestion = store.appendConversationMessage(conversation.id, {
      id: 'question', role: 'user', content: 'TRSYKFK72716 için getiri nedir?', createdAt: 1,
    });
    const withAudit = store.recordConversationAudit(conversation.id, {
      summary: 'Calculator-backed result.', dataAsOf: '2026-07-25T00:00:00.000Z',
      sources: [{ title: 'BIST', url: 'https://www.borsaistanbul.com', accessedAt: '2026-07-25T01:00:00.000Z' }], assumptions: ['Illustrative'], uncertainties: ['Rate changes'],
    });
    const complete = store.completeConversation(conversation.id, {
      id: 'answer', role: 'assistant', content: '', createdAt: 2,
      blocks: [{ type: 'tool', id: 'calculator-1', tool: 'calculator', argsSummary: '1 + 1', pending: false, result: '2', durationMs: 3 }, { type: 'text', content: 'Sonuç 2.' }],
    });
    const failed = store.failConversation(conversation.id, 'Provider unavailable');

    expect(withQuestion.title).toContain('TRSYKFK72716');
    expect(withAudit.audit?.sources[0]?.title).toBe('BIST');
    expect(complete.status).toBe('complete');
    expect(failed.status).toBe('failed');
    expect(store.listConversations()[0]?.messages).toHaveLength(3);
  });

  it('imports legacy research records without deleting their source file', () => {
    const userData = mkdtempSync(path.join(tmpdir(), 'aurict-finance-'));
    created.push(userData);
    const legacyPath = path.join(userData, 'finance-research.json');
    writeFileSync(legacyPath, JSON.stringify([{ id: 'legacy-1', question: 'Eski araştırma', createdAt: 1, status: 'complete' }]), 'utf8');
    const store = createFinanceStore(() => userData);

    expect(store.listConversations()[0]).toMatchObject({ id: 'legacy-1', title: 'Eski araştırma', status: 'complete' });
    expect(store.listResearch()[0]?.question).toBe('Eski araştırma');
  });
});
