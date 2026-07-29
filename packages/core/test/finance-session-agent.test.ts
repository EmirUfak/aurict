import { describe, expect, it } from 'bun:test';
import { getSessionAgent } from '../src/agent/session-agents.js';

describe('finance session agent', () => {
  it('reserves market data and calculator capabilities without a formula tool', () => {
    const finance = getSessionAgent('finance', process.cwd());

    expect(finance.name).toBe('Finance');
    expect(finance.allowedTools).toContain('market_data');
    expect(finance.allowedTools).toContain('calculator');
    expect(finance.system).toContain('There is no financial');
    expect(finance.allowedTools).not.toContain('finance_calculate');
  });
});
