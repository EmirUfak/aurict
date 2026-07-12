/* eslint-disable import/no-unresolved -- Bun provides this test module at runtime. */
import { describe, expect, it } from 'bun:test';
import { buildFinanceRequest, calculators, initialValues } from '../src/renderer/finance/calculator-config.js';

describe('desktop finance calculator input mapping', () => {
  it('converts the NPV form into the narrow sidecar request shape', () => {
    const request = buildFinanceRequest('net_present_value', { rate: '0.1', cashFlows: '0: -100\n1: 110' });

    expect(request).toEqual({ calculation: 'net_present_value', input: { rate: '0.1', cashFlows: [{ period: 0, amount: '-100' }, { period: 1, amount: '110' }] } });
  });

  it('rejects malformed user-entered cash-flow lines before IPC', () => {
    expect(() => buildFinanceRequest('internal_rate_of_return', { cashFlows: 'first year 100' })).toThrow('period: amount');
  });

  it('provides an empty value map for every visible calculator field', () => {
    for (const calculator of calculators) {
      const values = initialValues(calculator);
      expect(Object.keys(values)).toHaveLength(calculator.fields.length);
      expect(Object.values(values).every((value) => value === '')).toBe(true);
    }
  });
});
