import Decimal from 'decimal.js'
import { FinanceCalculationError, type DecimalInput } from './types.js'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -30, toExpPos: 30 })

export const FINANCE_DECIMAL_PLACES = 12

export function decimal(value: DecimalInput, label: string): Decimal {
  try {
    const parsed = new Decimal(value)
    if (!parsed.isFinite()) throw new Error('must be finite')
    return parsed
  } catch (error) {
    throw new FinanceCalculationError(`Invalid ${label}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function serializeDecimal(value: Decimal, places = FINANCE_DECIMAL_PLACES): string {
  const fixed = value.toDecimalPlaces(places, Decimal.ROUND_HALF_UP).toFixed(places)
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
}
