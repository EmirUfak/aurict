import type { FinanceCalculationKind, FinanceCalculationRequest } from '../../shared/ipc-types.js';

export interface CalculatorField {
  name: string;
  label: string;
  placeholder: string;
  help?: string;
  optional?: boolean;
  integer?: boolean;
}

export interface CalculatorDefinition {
  id: FinanceCalculationKind;
  title: string;
  detail: string;
  cashFlows?: 'periodic' | 'dated';
  fields: CalculatorField[];
}

const periodicFlows = { name: 'cashFlows', label: 'Cash flows', placeholder: '0: -1000\n1: 600\n2: 600', help: 'One period and amount per line: period: amount.' };
const datedFlows = { name: 'cashFlows', label: 'Dated cash flows', placeholder: '2024-01-01: -1000\n2025-01-01: 1100', help: 'One ISO date and amount per line: YYYY-MM-DD: amount.' };

export const calculators: CalculatorDefinition[] = [
  { id: 'fixed_coupon_bond_metrics', title: 'Bond pricing', detail: 'Clean/dirty price, accrued interest, duration, and convexity.', fields: [
    { name: 'faceValue', label: 'Face value', placeholder: '1000' }, { name: 'couponRate', label: 'Coupon rate', placeholder: '0.05', help: 'Use decimal form: 5% = 0.05.' },
    { name: 'yieldRate', label: 'Yield rate', placeholder: '0.04' }, { name: 'yearsToMaturity', label: 'Years to maturity', placeholder: '5' },
    { name: 'paymentsPerYear', label: 'Coupon payments per year', placeholder: '2', integer: true }, { name: 'accruedCouponFraction', label: 'Accrued coupon fraction', placeholder: '0.5', optional: true, help: 'Fraction of the current coupon period already accrued.' },
  ] },
  { id: 'fixed_coupon_bond_yield_shock', title: 'Bond yield shock', detail: 'Fully reprice a fixed-coupon bond after a parallel basis-point shock.', fields: [
    { name: 'faceValue', label: 'Face value', placeholder: '1000' }, { name: 'couponRate', label: 'Coupon rate', placeholder: '0.05' },
    { name: 'yieldRate', label: 'Starting yield rate', placeholder: '0.04' }, { name: 'yearsToMaturity', label: 'Years to maturity', placeholder: '5' },
    { name: 'paymentsPerYear', label: 'Coupon payments per year', placeholder: '2', integer: true }, { name: 'accruedCouponFraction', label: 'Accrued coupon fraction', placeholder: '0.5', optional: true },
    { name: 'shockBasisPoints', label: 'Yield shock (basis points)', placeholder: '50' },
  ] },
  { id: 'net_present_value', title: 'Net present value', detail: 'Discount periodic cash flows at a supplied per-period rate.', cashFlows: 'periodic', fields: [{ name: 'rate', label: 'Discount rate per period', placeholder: '0.1' }, periodicFlows] },
  { id: 'internal_rate_of_return', title: 'Internal rate of return', detail: 'Solve the periodic rate that makes NPV equal zero.', cashFlows: 'periodic', fields: [periodicFlows, { name: 'guess', label: 'Initial upper guess', placeholder: '0.1', optional: true }] },
  { id: 'extended_internal_rate_of_return', title: 'Extended IRR', detail: 'Solve dated cash flows using an Actual/365 fixed day-count convention.', cashFlows: 'dated', fields: [datedFlows, { name: 'guess', label: 'Initial upper guess', placeholder: '0.1', optional: true }] },
  { id: 'compound_annual_growth_rate', title: 'CAGR', detail: 'Calculate a compounded annual growth rate between two positive values.', fields: [
    { name: 'beginningValue', label: 'Beginning value', placeholder: '100' }, { name: 'endingValue', label: 'Ending value', placeholder: '121' }, { name: 'years', label: 'Years', placeholder: '2' },
  ] },
  { id: 'discounted_cash_flow', title: 'Discounted cash flow', detail: 'Value projected free cash flows, with an optional direct or Gordon-growth terminal value.', cashFlows: 'periodic', fields: [
    { name: 'discountRate', label: 'Discount rate per period', placeholder: '0.1' }, { name: 'freeCashFlows', label: 'Free cash flows', placeholder: '1: 60\n2: 60', help: 'One period and amount per line: period: amount.' },
    { name: 'terminalValue', label: 'Direct terminal value', placeholder: '500', optional: true }, { name: 'terminalGrowthRate', label: 'Terminal growth rate', placeholder: '0.025', optional: true, help: 'When used, this replaces direct terminal value.' },
  ] },
  { id: 'amortization_schedule', title: 'Amortization schedule', detail: 'Produce a complete level-payment loan schedule.', fields: [
    { name: 'principal', label: 'Principal', placeholder: '100000' }, { name: 'annualRate', label: 'Annual rate', placeholder: '0.06' },
    { name: 'periodsPerYear', label: 'Payments per year', placeholder: '12', integer: true }, { name: 'totalPeriods', label: 'Total payments', placeholder: '360', integer: true },
  ] },
];

export function initialValues(definition: CalculatorDefinition): Record<string, string> {
  return Object.fromEntries(definition.fields.map((field) => [field.name, '']));
}

function required(values: Record<string, string>, name: string): string {
  const value = values[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function optional(values: Record<string, string>, name: string): string | undefined {
  const value = values[name]?.trim();
  return value || undefined;
}

function integer(values: Record<string, string>, name: string): number {
  const value = Number(required(values, name));
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
  return value;
}

function periodicCashFlows(value: string): Array<{ period: number; amount: string }> {
  return value.split('\n').filter(Boolean).map((line, index) => {
    const match = /^\s*(\d+)\s*:\s*(.+?)\s*$/.exec(line);
    if (!match?.[1] || !match[2]) throw new Error(`Cash-flow line ${index + 1} must use “period: amount”`);
    return { period: Number(match[1]), amount: match[2] };
  });
}

function datedCashFlows(value: string): Array<{ date: string; amount: string }> {
  return value.split('\n').filter(Boolean).map((line, index) => {
    const match = /^\s*(\d{4}-\d{2}-\d{2})\s*:\s*(.+?)\s*$/.exec(line);
    if (!match?.[1] || !match[2]) throw new Error(`Cash-flow line ${index + 1} must use “YYYY-MM-DD: amount”`);
    return { date: match[1], amount: match[2] };
  });
}

export function buildFinanceRequest(calculation: FinanceCalculationKind, values: Record<string, string>): FinanceCalculationRequest {
  switch (calculation) {
    case 'net_present_value': return { calculation, input: { rate: required(values, 'rate'), cashFlows: periodicCashFlows(required(values, 'cashFlows')) } };
    case 'internal_rate_of_return': return { calculation, input: { cashFlows: periodicCashFlows(required(values, 'cashFlows')), ...(optional(values, 'guess') ? { guess: optional(values, 'guess') } : {}) } };
    case 'extended_internal_rate_of_return': return { calculation, input: { cashFlows: datedCashFlows(required(values, 'cashFlows')), ...(optional(values, 'guess') ? { guess: optional(values, 'guess') } : {}) } };
    case 'compound_annual_growth_rate': return { calculation, input: { beginningValue: required(values, 'beginningValue'), endingValue: required(values, 'endingValue'), years: required(values, 'years') } };
    case 'discounted_cash_flow': return { calculation, input: { discountRate: required(values, 'discountRate'), freeCashFlows: periodicCashFlows(required(values, 'freeCashFlows')), ...(optional(values, 'terminalValue') ? { terminalValue: optional(values, 'terminalValue') } : {}), ...(optional(values, 'terminalGrowthRate') ? { terminalGrowthRate: optional(values, 'terminalGrowthRate') } : {}) } };
    case 'amortization_schedule': return { calculation, input: { principal: required(values, 'principal'), annualRate: required(values, 'annualRate'), periodsPerYear: integer(values, 'periodsPerYear'), totalPeriods: integer(values, 'totalPeriods') } };
    case 'fixed_coupon_bond_metrics': return { calculation, input: { faceValue: required(values, 'faceValue'), couponRate: required(values, 'couponRate'), yieldRate: required(values, 'yieldRate'), yearsToMaturity: required(values, 'yearsToMaturity'), paymentsPerYear: integer(values, 'paymentsPerYear'), ...(optional(values, 'accruedCouponFraction') ? { accruedCouponFraction: optional(values, 'accruedCouponFraction') } : {}) } };
    case 'fixed_coupon_bond_yield_shock': return { calculation, input: { faceValue: required(values, 'faceValue'), couponRate: required(values, 'couponRate'), yieldRate: required(values, 'yieldRate'), yearsToMaturity: required(values, 'yearsToMaturity'), paymentsPerYear: integer(values, 'paymentsPerYear'), shockBasisPoints: required(values, 'shockBasisPoints'), ...(optional(values, 'accruedCouponFraction') ? { accruedCouponFraction: optional(values, 'accruedCouponFraction') } : {}) } };
  }
}
