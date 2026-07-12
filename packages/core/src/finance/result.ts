import type { FinanceResult, FinanceWarning } from './types.js'

export function financeResult<Input, Output>(calculation: string, inputs: Input, outputs: Output, assumptions: string[], warnings: FinanceWarning[] = []): FinanceResult<Input, Output> {
  return {
    calculation,
    formulaVersion: '1.0',
    calculatedAt: new Date().toISOString(),
    precision: { decimalPlaces: 12, rounding: 'half_up' },
    inputs,
    outputs,
    assumptions,
    warnings,
  }
}
