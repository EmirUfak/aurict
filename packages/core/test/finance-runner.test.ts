import { describe, expect, it } from 'bun:test'
import { runFinanceCalculation } from '../src/finance/runner.js'

describe('finance calculation runner', () => {
  it('dispatches a validated request to the deterministic finance engine', () => {
    const result = runFinanceCalculation({
      calculation: 'net_present_value',
      input: { rate: '0.1', cashFlows: [{ period: 0, amount: -100 }, { period: 1, amount: 110 }] },
    })

    expect(result.calculation).toBe('net_present_value')
    expect((result.outputs as { netPresentValue: string }).netPresentValue).toBe('0')
  })

  it('rejects malformed process-boundary input with a useful error', () => {
    expect(() => runFinanceCalculation({ calculation: 'amortization_schedule', input: { principal: 100 } })).toThrow('Invalid amortization_schedule input')
  })
})
