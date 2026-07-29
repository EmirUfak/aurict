import { z } from 'zod'
import { decimal, serializeDecimal } from '../../finance/decimal.js'
import type { DecimalInput } from '../../finance/types.js'
import type { ExecuteResult, ToolContext, ToolDef } from '../types.js'

const operations = ['add', 'subtract', 'multiply', 'divide', 'power'] as const

export type CalculatorOperation = (typeof operations)[number]

export interface CalculatorInput {
  operation: CalculatorOperation
  operands: DecimalInput[]
}

export function calculateArithmetic({ operation, operands }: CalculatorInput): string {
  if (operands.length < 2) throw new Error('Calculator requires at least two operands')
  if (operation === 'power' && operands.length !== 2) throw new Error('Power requires exactly two operands')

  const values = operands.map((operand, index) => decimal(operand, `operand ${index + 1}`))
  const first = values[0]
  if (!first) throw new Error('Calculator requires at least two operands')
  const remaining = values.slice(1)

  let result = first
  switch (operation) {
    case 'add': result = remaining.reduce((total, value) => total.plus(value), first); break
    case 'subtract': result = remaining.reduce((total, value) => total.minus(value), first); break
    case 'multiply': result = remaining.reduce((total, value) => total.mul(value), first); break
    case 'divide':
      result = remaining.reduce((total, value, index) => {
        if (value.isZero()) throw new Error(`Cannot divide by operand ${index + 2}: zero`)
        return total.div(value)
      }, first)
      break
    case 'power': result = first.pow(remaining[0]!)
  }
  if (!result.isFinite()) throw new Error('Calculator result must be finite')
  return serializeDecimal(result)
}

const decimalInput = z.union([z.string().min(1), z.number().finite()])
const calculatorParameters = z.object({
  operation: z.enum(operations).describe('Arithmetic operation. Divide and subtract apply left-to-right; power requires exactly two operands.'),
  operands: z.array(decimalInput).min(2).max(100).describe('At least two decimal operands. Prefer strings, for example ["1000", "0.05"].'),
})

export const calculatorTool: ToolDef = {
  id: 'calculator',
  description: 'Perform only deterministic decimal arithmetic: add, subtract, multiply, divide, or power. This tool contains no financial formulas or assumptions. For every non-trivial numeric step, especially in finance, call this tool instead of doing arithmetic yourself. Pass decimal values as strings whenever precision matters.',
  parameters: calculatorParameters,
  spec: { category: 'read', riskLevel: 'low', permissionSummary: 'Run a local decimal calculator' },
  async execute(args: Record<string, unknown>, _ctx: ToolContext): Promise<ExecuteResult> {
    try {
      const parsed = calculatorParameters.parse(args)
      const result = calculateArithmetic(parsed)
      return {
        output: JSON.stringify({
          operation: parsed.operation,
          operands: parsed.operands.map((operand, index) => serializeDecimal(decimal(operand, `operand ${index + 1}`))),
          result,
          precision: { decimalPlaces: 12, rounding: 'half_up' },
        }, null, 2),
      }
    } catch (error) {
      return { output: '', error: error instanceof Error ? error.message : String(error) }
    }
  },
}
