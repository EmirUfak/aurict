import Decimal from 'decimal.js'
import { decimal, serializeDecimal } from './decimal.js'
import { financeResult } from './result.js'
import type { BondInput, FinanceResult, YieldShockInput } from './types.js'
import { FinanceCalculationError } from './types.js'
import { requireNonNegative, requirePositive, requirePositiveInteger, requireRateAboveNegativeOne } from './validation.js'

interface BondValues {
  accruedInterest: Decimal
  cleanPrice: Decimal
  convexityYearsSquared: Decimal
  dirtyPrice: Decimal
  macaulayDurationYears: Decimal
  modifiedDurationYears: Decimal
}

function couponPeriods(input: BondInput): number {
  const periods = requirePositive(input.yearsToMaturity, 'years to maturity').mul(input.paymentsPerYear)
  if (!periods.isInteger()) throw new FinanceCalculationError('years to maturity multiplied by payments per year must be a whole number of coupon periods')
  return periods.toNumber()
}

function calculateBondValues(input: BondInput): BondValues {
  const faceValue = requirePositive(input.faceValue, 'face value')
  const couponRate = requireNonNegative(input.couponRate, 'coupon rate')
  const yieldRate = requireRateAboveNegativeOne(input.yieldRate, 'yield rate')
  requirePositiveInteger(input.paymentsPerYear, 'payments per year')
  const periods = couponPeriods(input)
  const accruedCouponFraction = input.accruedCouponFraction === undefined
    ? new Decimal(0)
    : requireNonNegative(input.accruedCouponFraction, 'accrued coupon fraction')
  if (accruedCouponFraction.gte(1)) throw new FinanceCalculationError('accrued coupon fraction must be less than one coupon period')

  const periodicCoupon = faceValue.mul(couponRate).div(input.paymentsPerYear)
  const periodicYield = yieldRate.div(input.paymentsPerYear)
  const discountBase = new Decimal(1).plus(periodicYield)
  let dirtyPrice = new Decimal(0)
  let durationNumerator = new Decimal(0)
  let convexityNumerator = new Decimal(0)

  for (let period = 1; period <= periods; period += 1) {
    const cashFlow = period === periods ? periodicCoupon.plus(faceValue) : periodicCoupon
    const presentValue = cashFlow.div(discountBase.pow(period))
    dirtyPrice = dirtyPrice.plus(presentValue)
    durationNumerator = durationNumerator.plus(presentValue.mul(period))
    convexityNumerator = convexityNumerator.plus(cashFlow.mul(period).mul(period + 1).div(discountBase.pow(period + 2)))
  }

  const accruedInterest = periodicCoupon.mul(accruedCouponFraction)
  const macaulayDurationYears = durationNumerator.div(dirtyPrice).div(input.paymentsPerYear)
  const modifiedDurationYears = macaulayDurationYears.div(discountBase)
  const convexityYearsSquared = convexityNumerator.div(dirtyPrice).div(new Decimal(input.paymentsPerYear).pow(2))
  return {
    accruedInterest,
    cleanPrice: dirtyPrice.minus(accruedInterest),
    convexityYearsSquared,
    dirtyPrice,
    macaulayDurationYears,
    modifiedDurationYears,
  }
}

export function calculateBondMetrics(input: BondInput): FinanceResult<BondInput, {
  dirtyPrice: string
  cleanPrice: string
  accruedInterest: string
  macaulayDurationYears: string
  modifiedDurationYears: string
  convexityYearsSquared: string
}> {
  const values = calculateBondValues(input)
  return financeResult('fixed_coupon_bond_metrics', input, {
    dirtyPrice: serializeDecimal(values.dirtyPrice),
    cleanPrice: serializeDecimal(values.cleanPrice),
    accruedInterest: serializeDecimal(values.accruedInterest),
    macaulayDurationYears: serializeDecimal(values.macaulayDurationYears),
    modifiedDurationYears: serializeDecimal(values.modifiedDurationYears),
    convexityYearsSquared: serializeDecimal(values.convexityYearsSquared),
  }, ['The bond has a fixed coupon, a constant yield curve, and no credit/default risk adjustment.', 'Accrued interest is deducted from dirty price to derive clean price.'])
}

export function calculateBondYieldShock(input: YieldShockInput): FinanceResult<YieldShockInput, {
  baselineDirtyPrice: string
  shockedDirtyPrice: string
  priceChange: string
  priceChangePercent: string
  resultingYieldRate: string
}> {
  const baseline = calculateBondValues(input)
  const resultingYieldRate = requireRateAboveNegativeOne(decimal(input.yieldRate, 'yield rate').plus(decimal(input.shockBasisPoints, 'yield shock basis points').div(10_000)).toString(), 'resulting yield rate')
  const shocked = calculateBondValues({ ...input, yieldRate: resultingYieldRate.toString() })
  const priceChange = shocked.dirtyPrice.minus(baseline.dirtyPrice)
  return financeResult('fixed_coupon_bond_yield_shock', input, {
    baselineDirtyPrice: serializeDecimal(baseline.dirtyPrice),
    shockedDirtyPrice: serializeDecimal(shocked.dirtyPrice),
    priceChange: serializeDecimal(priceChange),
    priceChangePercent: serializeDecimal(priceChange.div(baseline.dirtyPrice)),
    resultingYieldRate: serializeDecimal(resultingYieldRate),
  }, ['The price change is calculated by fully repricing the bond after the parallel yield shock.', 'The calculation does not infer a yield curve, credit spread, taxes, or transaction costs.'])
}
