import { z } from 'zod'
import { calculateBondMetrics, calculateBondYieldShock } from './bonds.js'
import { calculateAmortization, calculateCagr, calculateDcf, calculateInternalRateOfReturn, calculateNetPresentValue, calculateXirr } from './cashflows.js'
import type { FinanceCalculationKind, FinanceCalculationRequest, FinanceResult } from './types.js'
import { FinanceCalculationError } from './types.js'

const decimalInput = z.union([z.string().min(1), z.number().finite()])
const cashFlow = z.object({ period: z.number().int().nonnegative(), amount: decimalInput })
const datedCashFlow = z.object({ date: z.string().min(1), amount: decimalInput })

const inputSchemas = {
  net_present_value: z.object({ rate: decimalInput, cashFlows: z.array(cashFlow) }),
  internal_rate_of_return: z.object({ cashFlows: z.array(cashFlow), guess: decimalInput.optional(), tolerance: decimalInput.optional(), maxIterations: z.number().int().positive().optional() }),
  extended_internal_rate_of_return: z.object({ cashFlows: z.array(datedCashFlow), guess: decimalInput.optional(), tolerance: decimalInput.optional(), maxIterations: z.number().int().positive().optional() }),
  compound_annual_growth_rate: z.object({ beginningValue: decimalInput, endingValue: decimalInput, years: decimalInput }),
  discounted_cash_flow: z.object({ discountRate: decimalInput, freeCashFlows: z.array(cashFlow), terminalValue: decimalInput.optional(), terminalGrowthRate: decimalInput.optional() }),
  amortization_schedule: z.object({ principal: decimalInput, annualRate: decimalInput, periodsPerYear: z.number().int().positive(), totalPeriods: z.number().int().positive() }),
  fixed_coupon_bond_metrics: z.object({ faceValue: decimalInput, couponRate: decimalInput, yieldRate: decimalInput, yearsToMaturity: decimalInput, paymentsPerYear: z.number().int().positive(), accruedCouponFraction: decimalInput.optional() }),
  fixed_coupon_bond_yield_shock: z.object({ faceValue: decimalInput, couponRate: decimalInput, yieldRate: decimalInput, yearsToMaturity: decimalInput, paymentsPerYear: z.number().int().positive(), accruedCouponFraction: decimalInput.optional(), shockBasisPoints: decimalInput }),
} as const

export function runFinanceCalculation(request: FinanceCalculationRequest): FinanceResult<unknown, unknown> {
  try {
    switch (request.calculation) {
      case 'net_present_value': return calculateNetPresentValue(inputSchemas.net_present_value.parse(request.input))
      case 'internal_rate_of_return': {
        const input = inputSchemas.internal_rate_of_return.parse(request.input)
        return calculateInternalRateOfReturn({
          cashFlows: input.cashFlows,
          ...(input.guess === undefined ? {} : { guess: input.guess }),
          ...(input.tolerance === undefined ? {} : { tolerance: input.tolerance }),
          ...(input.maxIterations === undefined ? {} : { maxIterations: input.maxIterations }),
        })
      }
      case 'extended_internal_rate_of_return': {
        const input = inputSchemas.extended_internal_rate_of_return.parse(request.input)
        return calculateXirr({
          cashFlows: input.cashFlows,
          ...(input.guess === undefined ? {} : { guess: input.guess }),
          ...(input.tolerance === undefined ? {} : { tolerance: input.tolerance }),
          ...(input.maxIterations === undefined ? {} : { maxIterations: input.maxIterations }),
        })
      }
      case 'compound_annual_growth_rate': return calculateCagr(inputSchemas.compound_annual_growth_rate.parse(request.input))
      case 'discounted_cash_flow': {
        const input = inputSchemas.discounted_cash_flow.parse(request.input)
        return calculateDcf({
          discountRate: input.discountRate,
          freeCashFlows: input.freeCashFlows,
          ...(input.terminalValue === undefined ? {} : { terminalValue: input.terminalValue }),
          ...(input.terminalGrowthRate === undefined ? {} : { terminalGrowthRate: input.terminalGrowthRate }),
        })
      }
      case 'amortization_schedule': return calculateAmortization(inputSchemas.amortization_schedule.parse(request.input))
      case 'fixed_coupon_bond_metrics': {
        const input = inputSchemas.fixed_coupon_bond_metrics.parse(request.input)
        return calculateBondMetrics({
          faceValue: input.faceValue,
          couponRate: input.couponRate,
          yieldRate: input.yieldRate,
          yearsToMaturity: input.yearsToMaturity,
          paymentsPerYear: input.paymentsPerYear,
          ...(input.accruedCouponFraction === undefined ? {} : { accruedCouponFraction: input.accruedCouponFraction }),
        })
      }
      case 'fixed_coupon_bond_yield_shock': {
        const input = inputSchemas.fixed_coupon_bond_yield_shock.parse(request.input)
        return calculateBondYieldShock({
          faceValue: input.faceValue,
          couponRate: input.couponRate,
          yieldRate: input.yieldRate,
          yearsToMaturity: input.yearsToMaturity,
          paymentsPerYear: input.paymentsPerYear,
          shockBasisPoints: input.shockBasisPoints,
          ...(input.accruedCouponFraction === undefined ? {} : { accruedCouponFraction: input.accruedCouponFraction }),
        })
      }
    }
  } catch (error) {
    if (error instanceof FinanceCalculationError) throw error
    throw new FinanceCalculationError(`Invalid ${request.calculation} input: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export function financeCalculationKinds(): FinanceCalculationKind[] {
  return Object.keys(inputSchemas) as FinanceCalculationKind[]
}
