import Decimal from 'decimal.js'
import { decimal } from './decimal.js'
import { FinanceCalculationError, type CashFlow, type DatedCashFlow, type DecimalInput } from './types.js'

export function requirePositive(value: DecimalInput, label: string): Decimal {
  const parsed = decimal(value, label)
  if (parsed.lte(0)) throw new FinanceCalculationError(`${label} must be greater than zero`)
  return parsed
}

export function requireNonNegative(value: DecimalInput, label: string): Decimal {
  const parsed = decimal(value, label)
  if (parsed.lt(0)) throw new FinanceCalculationError(`${label} cannot be negative`)
  return parsed
}

export function requireRateAboveNegativeOne(value: DecimalInput, label: string): Decimal {
  const parsed = decimal(value, label)
  if (parsed.lte(-1)) throw new FinanceCalculationError(`${label} must be greater than -100%`)
  return parsed
}

export function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new FinanceCalculationError(`${label} must be a positive integer`)
}

interface CashFlowNormalizationOptions {
  minimumEntries?: number
  requireMixedSigns?: boolean
}

export function normalizeCashFlows(cashFlows: CashFlow[], options: CashFlowNormalizationOptions = {}): Array<{ period: number; amount: Decimal }> {
  const minimumEntries = options.minimumEntries ?? 2
  const requireMixedSigns = options.requireMixedSigns ?? true
  if (cashFlows.length < minimumEntries) throw new FinanceCalculationError(`At least ${minimumEntries} cash flow${minimumEntries === 1 ? '' : 's'} ${minimumEntries === 1 ? 'is' : 'are'} required`)
  const seen = new Set<number>()
  const normalized = cashFlows.map((flow) => {
    if (!Number.isInteger(flow.period) || flow.period < 0) throw new FinanceCalculationError('Cash-flow periods must be non-negative integers')
    if (seen.has(flow.period)) throw new FinanceCalculationError(`Duplicate cash-flow period: ${flow.period}`)
    seen.add(flow.period)
    return { period: flow.period, amount: decimal(flow.amount, `cash flow at period ${flow.period}`) }
  }).sort((a, b) => a.period - b.period)
  if (requireMixedSigns && (!normalized.some((flow) => flow.amount.lt(0)) || !normalized.some((flow) => flow.amount.gt(0)))) {
    throw new FinanceCalculationError('Cash flows must include both a positive and a negative amount')
  }
  return normalized
}

export function normalizeDatedCashFlows(cashFlows: DatedCashFlow[]): Array<{ date: Date; amount: Decimal }> {
  if (cashFlows.length < 2) throw new FinanceCalculationError('At least two cash flows are required')
  const normalized = cashFlows.map((flow) => {
    const date = new Date(`${flow.date}T00:00:00.000Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(flow.date) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== flow.date) {
      throw new FinanceCalculationError(`Invalid cash-flow date: ${flow.date}`)
    }
    return { date, amount: decimal(flow.amount, `cash flow on ${flow.date}`) }
  }).sort((a, b) => a.date.getTime() - b.date.getTime())
  if (normalized[0]?.date.getTime() === normalized.at(-1)?.date.getTime()) throw new FinanceCalculationError('Cash-flow dates must span at least one day')
  if (!normalized.some((flow) => flow.amount.lt(0)) || !normalized.some((flow) => flow.amount.gt(0))) {
    throw new FinanceCalculationError('Cash flows must include both a positive and a negative amount')
  }
  return normalized
}

export function signChanges(values: Decimal[]): number {
  let previous = 0
  let changes = 0
  for (const value of values) {
    const sign = value.comparedTo(0)
    if (sign !== 0 && previous !== 0 && sign !== previous) changes += 1
    if (sign !== 0) previous = sign
  }
  return changes
}
