export type DecimalInput = string | number

export type FinanceCalculationKind =
  | 'net_present_value'
  | 'internal_rate_of_return'
  | 'extended_internal_rate_of_return'
  | 'compound_annual_growth_rate'
  | 'discounted_cash_flow'
  | 'amortization_schedule'
  | 'fixed_coupon_bond_metrics'
  | 'fixed_coupon_bond_yield_shock'

export interface FinanceCalculationRequest {
  calculation: FinanceCalculationKind
  input: unknown
}

export interface FinanceWarning {
  code: string
  message: string
}

export interface FinanceResult<Input, Output> {
  calculation: string
  formulaVersion: '1.0'
  calculatedAt: string
  precision: { decimalPlaces: number; rounding: 'half_up' }
  inputs: Input
  outputs: Output
  assumptions: string[]
  warnings: FinanceWarning[]
}

export interface CashFlow {
  period: number
  amount: DecimalInput
}

export interface DatedCashFlow {
  date: string
  amount: DecimalInput
}

export interface NetPresentValueInput {
  rate: DecimalInput
  cashFlows: CashFlow[]
}

export interface InternalRateOfReturnInput {
  cashFlows: CashFlow[]
  guess?: DecimalInput
  tolerance?: DecimalInput
  maxIterations?: number
}

export interface XirrInput {
  cashFlows: DatedCashFlow[]
  guess?: DecimalInput
  tolerance?: DecimalInput
  maxIterations?: number
}

export interface DcfInput {
  discountRate: DecimalInput
  freeCashFlows: CashFlow[]
  terminalValue?: DecimalInput
  terminalGrowthRate?: DecimalInput
}

export interface CagrInput {
  beginningValue: DecimalInput
  endingValue: DecimalInput
  years: DecimalInput
}

export interface AmortizationInput {
  principal: DecimalInput
  annualRate: DecimalInput
  periodsPerYear: number
  totalPeriods: number
}

export interface BondInput {
  faceValue: DecimalInput
  couponRate: DecimalInput
  yieldRate: DecimalInput
  yearsToMaturity: DecimalInput
  paymentsPerYear: number
  accruedCouponFraction?: DecimalInput
}

export interface YieldShockInput extends BondInput {
  shockBasisPoints: DecimalInput
}

export class FinanceCalculationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FinanceCalculationError'
  }
}
