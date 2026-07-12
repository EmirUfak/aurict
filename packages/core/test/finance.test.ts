import { describe, expect, it } from 'bun:test'
import {
  calculateAmortization,
  calculateBondMetrics,
  calculateBondYieldShock,
  calculateCagr,
  calculateDcf,
  calculateInternalRateOfReturn,
  calculateNetPresentValue,
  calculateXirr,
  FinanceCalculationError,
} from '../src/finance/index.js'

describe('deterministic finance calculations', () => {
  it('calculates periodic NPV and IRR with decimal arithmetic', () => {
    const cashFlows = [{ period: 0, amount: -100 }, { period: 1, amount: 60 }, { period: 2, amount: 60 }]
    const npv = calculateNetPresentValue({ rate: '0.1', cashFlows })
    const irr = calculateInternalRateOfReturn({ cashFlows })

    expect(npv.outputs.netPresentValue).toBe('4.132231404959')
    expect(Number(irr.outputs.internalRateOfReturn)).toBeCloseTo(0.130662386292, 10)
    expect(irr.formulaVersion).toBe('1.0')
    expect(irr.assumptions).toContain('IRR is the per-period rate whose NPV is zero.')
  })

  it('calculates XIRR with explicitly dated cash flows', () => {
    const result = calculateXirr({
      cashFlows: [{ date: '2023-01-01', amount: -100 }, { date: '2024-01-01', amount: 110 }],
    })

    expect(Number(result.outputs.extendedInternalRateOfReturn)).toBeCloseTo(0.1, 10)
    expect(result.assumptions[0]).toContain('Actual/365 fixed')
  })

  it('calculates CAGR and DCF without requiring mixed-sign projected cash flows', () => {
    const cagr = calculateCagr({ beginningValue: 100, endingValue: 121, years: 2 })
    const dcf = calculateDcf({
      discountRate: '0.1',
      freeCashFlows: [{ period: 1, amount: 60 }, { period: 2, amount: 60 }],
      terminalValue: 0,
    })

    expect(cagr.outputs.compoundAnnualGrowthRate).toBe('0.1')
    expect(dcf.outputs.enterpriseValue).toBe('104.132231404959')
    expect(dcf.outputs.presentValueOfTerminalValue).toBe('0')
  })

  it('creates a complete amortization schedule and handles zero interest', () => {
    const result = calculateAmortization({ principal: 1_000, annualRate: 0, periodsPerYear: 12, totalPeriods: 12 })
    const finalPayment = result.outputs.schedule.at(-1)

    expect(result.outputs.periodicPayment).toBe('83.333333333333')
    expect(result.outputs.totalInterest).toBe('0')
    expect(finalPayment?.remainingPrincipal).toBe('0')
    expect(result.outputs.schedule).toHaveLength(12)
  })

  it('calculates fixed-coupon bond prices, risk measures, and a full repricing shock', () => {
    const bond = { faceValue: 1_000, couponRate: '0.05', yieldRate: '0.04', yearsToMaturity: 2, paymentsPerYear: 2, accruedCouponFraction: '0.5' }
    const metrics = calculateBondMetrics(bond)
    const shock = calculateBondYieldShock({ ...bond, shockBasisPoints: 100 })

    expect(Number(metrics.outputs.dirtyPrice)).toBeCloseTo(1019.038643, 6)
    expect(Number(metrics.outputs.cleanPrice)).toBeCloseTo(1006.538643, 6)
    expect(Number(metrics.outputs.modifiedDurationYears)).toBeGreaterThan(0)
    expect(Number(metrics.outputs.convexityYearsSquared)).toBeGreaterThan(0)
    expect(Number(shock.outputs.shockedDirtyPrice)).toBeLessThan(Number(shock.outputs.baselineDirtyPrice))
    expect(shock.outputs.resultingYieldRate).toBe('0.05')
  })

  it('fails loudly for invalid input domains', () => {
    expect(() => calculateInternalRateOfReturn({ cashFlows: [{ period: 0, amount: 10 }, { period: 1, amount: 20 }] })).toThrow(FinanceCalculationError)
    expect(() => calculateXirr({ cashFlows: [{ date: '2024-02-30', amount: -100 }, { date: '2025-02-28', amount: 110 }] })).toThrow('Invalid cash-flow date')
    expect(() => calculateDcf({ discountRate: '0.1', terminalGrowthRate: '0.1', freeCashFlows: [{ period: 1, amount: 100 }] })).toThrow('terminal growth rate must be lower')
    expect(() => calculateBondMetrics({ faceValue: 100, couponRate: '0.05', yieldRate: '0.04', yearsToMaturity: '1.25', paymentsPerYear: 2 })).toThrow('whole number of coupon periods')
  })
})
