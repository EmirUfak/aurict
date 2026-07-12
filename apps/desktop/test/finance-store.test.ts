/* eslint-disable import/no-unresolved -- Bun provides this test module at runtime. */
import { afterEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
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
});
