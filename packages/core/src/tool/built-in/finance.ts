import { z } from 'zod'
import { runFinanceCalculation } from '../../finance/runner.js'
import { type FinanceCalculationKind } from '../../finance/types.js'
import type { ExecuteResult, ToolContext, ToolDef } from '../types.js'

const calculationKinds = [
  'net_present_value',
  'internal_rate_of_return',
  'extended_internal_rate_of_return',
  'compound_annual_growth_rate',
  'discounted_cash_flow',
  'amortization_schedule',
  'fixed_coupon_bond_metrics',
  'fixed_coupon_bond_yield_shock',
] as const

export const financeCalculateTool: ToolDef = {
  id: 'finance_calculate',
  description: 'Run a deterministic financial calculation. Use this for NPV, IRR, XIRR, CAGR, DCF, amortization schedules, fixed-coupon bond metrics, or a bond yield-shock repricing. State that results are analytical calculations, preserve the returned assumptions/warnings, and never treat estimates as personalized financial advice.',
  parameters: z.object({
    calculation: z.enum(calculationKinds).describe('The deterministic calculation to run.'),
    input: z.record(z.unknown()).describe('Calculation inputs. Cash flows use { period, amount } or { date, amount } objects, depending on the calculation.'),
  }),
  spec: { category: 'read', riskLevel: 'low', permissionSummary: 'Run a local deterministic financial calculation' },
  async execute(args: Record<string, unknown>, _ctx: ToolContext): Promise<ExecuteResult> {
    try {
      const result = runFinanceCalculation({
        calculation: args.calculation as FinanceCalculationKind,
        input: args.input,
      })
      return { output: JSON.stringify(result, null, 2) }
    } catch (error) {
      return { output: '', error: error instanceof Error ? error.message : String(error) }
    }
  },
}
