import Decimal from 'decimal.js'
import { decimal, serializeDecimal } from './decimal.js'
import { financeResult } from './result.js'
import type { AmortizationInput, CagrInput, CashFlow, DatedCashFlow, DcfInput, FinanceResult, InternalRateOfReturnInput, NetPresentValueInput, XirrInput } from './types.js'
import { FinanceCalculationError } from './types.js'
import { normalizeCashFlows, normalizeDatedCashFlows, requireNonNegative, requirePositive, requirePositiveInteger, requireRateAboveNegativeOne, signChanges } from './validation.js'

type CashFlowOutput = { netPresentValue: string }

function presentValue(rate: Decimal, cashFlows: Array<{ period: number; amount: Decimal }>): Decimal {
  return cashFlows.reduce((total, flow) => total.plus(flow.amount.div(new Decimal(1).plus(rate).pow(flow.period))), new Decimal(0))
}

function solveRate(evaluate: (rate: Decimal) => Decimal, tolerance: Decimal, maxIterations: number, guess?: string | number): Decimal {
  let low = new Decimal('-0.9999999999')
  let high = guess === undefined ? new Decimal(1) : requireRateAboveNegativeOne(guess, 'guess')
  if (high.lte(low)) high = new Decimal(1)
  let lowValue = evaluate(low)
  let highValue = evaluate(high)

  for (let expansion = 0; lowValue.mul(highValue).gt(0) && expansion < 32; expansion += 1) {
    high = high.mul(2).plus(1)
    highValue = evaluate(high)
  }
  if (lowValue.mul(highValue).gt(0)) throw new FinanceCalculationError('Unable to bracket a rate that solves the cash flows')

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const midpoint = low.plus(high).div(2)
    const value = evaluate(midpoint)
    if (value.abs().lte(tolerance) || high.minus(low).abs().lte(tolerance)) return midpoint
    if (lowValue.mul(value).lte(0)) {
      high = midpoint
      highValue = value
    } else {
      low = midpoint
      lowValue = value
    }
  }
  throw new FinanceCalculationError(`Rate solver did not converge after ${maxIterations} iterations`)
}

export function calculateNetPresentValue(input: NetPresentValueInput): FinanceResult<NetPresentValueInput, CashFlowOutput> {
  const rate = requireRateAboveNegativeOne(input.rate, 'discount rate')
  const cashFlows = normalizeCashFlows(input.cashFlows)
  return financeResult('net_present_value', input, { netPresentValue: serializeDecimal(presentValue(rate, cashFlows)) }, ['Periodic cash flows are discounted at the supplied per-period rate.'])
}

export function calculateInternalRateOfReturn(input: InternalRateOfReturnInput): FinanceResult<InternalRateOfReturnInput, { internalRateOfReturn: string }> {
  const cashFlows = normalizeCashFlows(input.cashFlows)
  const tolerance = input.tolerance === undefined ? new Decimal('0.000000000001') : requirePositive(input.tolerance, 'tolerance')
  const maxIterations = input.maxIterations ?? 200
  requirePositiveInteger(maxIterations, 'maxIterations')
  const warnings = signChanges(cashFlows.map((flow) => flow.amount)) > 1
    ? [{ code: 'multiple_irr_possible', message: 'Cash flows change sign more than once; additional IRR roots may exist.' }]
    : []
  const rate = solveRate((candidate) => presentValue(candidate, cashFlows), tolerance, maxIterations, input.guess)
  return financeResult('internal_rate_of_return', input, { internalRateOfReturn: serializeDecimal(rate) }, ['IRR is the per-period rate whose NPV is zero.', 'A bracketed bisection solver is used for deterministic convergence.'], warnings)
}

function xnpv(rate: Decimal, cashFlows: Array<{ date: Date; amount: Decimal }>): Decimal {
  const firstDate = cashFlows[0]?.date
  if (!firstDate) throw new FinanceCalculationError('At least one dated cash flow is required')
  return cashFlows.reduce((total, flow) => {
    const years = new Decimal(flow.date.getTime() - firstDate.getTime()).div(86_400_000 * 365)
    return total.plus(flow.amount.div(new Decimal(1).plus(rate).pow(years)))
  }, new Decimal(0))
}

export function calculateXirr(input: XirrInput): FinanceResult<XirrInput, { extendedInternalRateOfReturn: string }> {
  const cashFlows = normalizeDatedCashFlows(input.cashFlows)
  const tolerance = input.tolerance === undefined ? new Decimal('0.000000000001') : requirePositive(input.tolerance, 'tolerance')
  const maxIterations = input.maxIterations ?? 200
  requirePositiveInteger(maxIterations, 'maxIterations')
  const warnings = signChanges(cashFlows.map((flow) => flow.amount)) > 1
    ? [{ code: 'multiple_irr_possible', message: 'Cash flows change sign more than once; additional XIRR roots may exist.' }]
    : []
  const rate = solveRate((candidate) => xnpv(candidate, cashFlows), tolerance, maxIterations, input.guess)
  return financeResult('extended_internal_rate_of_return', input, { extendedInternalRateOfReturn: serializeDecimal(rate) }, ['XIRR discounts dated cash flows using an Actual/365 fixed day-count convention.', 'A bracketed bisection solver is used for deterministic convergence.'], warnings)
}

export function calculateCagr(input: CagrInput): FinanceResult<CagrInput, { compoundAnnualGrowthRate: string }> {
  const beginningValue = requirePositive(input.beginningValue, 'beginning value')
  const endingValue = requirePositive(input.endingValue, 'ending value')
  const years = requirePositive(input.years, 'years')
  const rate = endingValue.div(beginningValue).pow(new Decimal(1).div(years)).minus(1)
  return financeResult('compound_annual_growth_rate', input, { compoundAnnualGrowthRate: serializeDecimal(rate) }, ['CAGR assumes a constant compounded annual rate over the supplied period.'])
}

export function calculateDcf(input: DcfInput): FinanceResult<DcfInput, { enterpriseValue: string; presentValueOfExplicitCashFlows: string; presentValueOfTerminalValue: string }> {
  const discountRate = requireRateAboveNegativeOne(input.discountRate, 'discount rate')
  const cashFlows = normalizeCashFlows(input.freeCashFlows, { minimumEntries: 1, requireMixedSigns: false })
  const explicitValue = presentValue(discountRate, cashFlows)
  let terminalValue = input.terminalValue === undefined ? new Decimal(0) : decimal(input.terminalValue, 'terminal value')
  if (input.terminalGrowthRate !== undefined) {
    const growthRate = requireRateAboveNegativeOne(input.terminalGrowthRate, 'terminal growth rate')
    if (growthRate.gte(discountRate)) throw new FinanceCalculationError('terminal growth rate must be lower than discount rate')
    const terminalCashFlow = cashFlows.at(-1)?.amount
    if (!terminalCashFlow) throw new FinanceCalculationError('A terminal growth rate requires at least one free cash flow')
    terminalValue = terminalCashFlow.mul(new Decimal(1).plus(growthRate)).div(discountRate.minus(growthRate))
  }
  const terminalPeriod = cashFlows.at(-1)?.period ?? 0
  const terminalPresentValue = terminalValue.div(new Decimal(1).plus(discountRate).pow(terminalPeriod))
  return financeResult('discounted_cash_flow', input, {
    enterpriseValue: serializeDecimal(explicitValue.plus(terminalPresentValue)),
    presentValueOfExplicitCashFlows: serializeDecimal(explicitValue),
    presentValueOfTerminalValue: serializeDecimal(terminalPresentValue),
  }, ['Free cash flows are discounted at the supplied periodic discount rate.', input.terminalGrowthRate === undefined ? 'Terminal value is supplied directly.' : 'Terminal value uses the Gordon growth model.'])
}

export function calculateAmortization(input: AmortizationInput): FinanceResult<AmortizationInput, { periodicPayment: string; totalInterest: string; totalPaid: string; schedule: Array<{ period: number; payment: string; principal: string; interest: string; remainingPrincipal: string }> }> {
  const principal = requirePositive(input.principal, 'principal')
  const annualRate = requireNonNegative(input.annualRate, 'annual rate')
  requirePositiveInteger(input.periodsPerYear, 'periodsPerYear')
  requirePositiveInteger(input.totalPeriods, 'totalPeriods')
  const periodicRate = annualRate.div(input.periodsPerYear)
  const payment = periodicRate.eq(0)
    ? principal.div(input.totalPeriods)
    : principal.mul(periodicRate).div(new Decimal(1).minus(new Decimal(1).plus(periodicRate).pow(-input.totalPeriods)))
  let remaining = principal
  let totalInterest = new Decimal(0)
  const schedule = []
  for (let period = 1; period <= input.totalPeriods; period += 1) {
    const interest = remaining.mul(periodicRate)
    const principalPayment = period === input.totalPeriods ? remaining : payment.minus(interest)
    const actualPayment = principalPayment.plus(interest)
    remaining = Decimal.max(0, remaining.minus(principalPayment))
    totalInterest = totalInterest.plus(interest)
    schedule.push({ period, payment: serializeDecimal(actualPayment), principal: serializeDecimal(principalPayment), interest: serializeDecimal(interest), remainingPrincipal: serializeDecimal(remaining) })
  }
  return financeResult('amortization_schedule', input, { periodicPayment: serializeDecimal(payment), totalInterest: serializeDecimal(totalInterest), totalPaid: serializeDecimal(principal.plus(totalInterest)), schedule }, ['Payments are level across the supplied number of periods.', 'The final payment is adjusted for residual decimal rounding.'])
}

export function cashFlowsFromAmounts(amounts: Array<string | number>): CashFlow[] {
  return amounts.map((amount, period) => ({ period, amount }))
}

export function datedCashFlowsFromAmounts(cashFlows: DatedCashFlow[]): DatedCashFlow[] {
  return cashFlows.map((flow) => ({ ...flow }))
}
