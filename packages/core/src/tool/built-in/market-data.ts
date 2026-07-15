import { z } from 'zod'
import { callAurictApi, describeAurictApiFailure } from './_shared/aurict-api.js'
import type { ExecuteResult, ToolContext, ToolDef } from '../types.js'

const actions = ['list', 'detail', 'tlref_latest'] as const

type BondListResponse = { total: number; items: unknown[] }

export const marketDataTool: ToolDef = {
  id: 'market_data',
  description:
    "Fetch real Turkish bond market data (BIST tahvil/bono) from Aurict's bonds service — issuer, maturity, yield, prices, and the TLREF index. This tool only fetches data; it never calculates. If the user's question requires a calculation (yield, present value, amortization), pass the numbers this tool returns into `finance_calculate` — never compute by hand. If the response is empty or the user isn't authenticated, say so honestly and don't repeat the exact same query — ask the user for a different ISIN/issuer or report that no data is available.",
  parameters: z.object({
    action: z.enum(actions).describe(
      "'list' searches bonds by issuer; 'detail' fetches one bond by ISIN; 'tlref_latest' fetches the latest TLREF index value.",
    ),
    isin: z.string().optional().describe('ISIN code — required for "detail".'),
    issuer: z.string().optional().describe('Issuer name substring to search — used by "list".'),
    limit: z.number().int().positive().max(200).optional().describe('Max results (default: service default).'),
  }),
  spec: { category: 'network', riskLevel: 'low', permissionSummary: 'Fetch Turkish bond market data from the Aurict bonds service' },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ExecuteResult> {
    const action = args.action as (typeof actions)[number]
    const isin = typeof args.isin === 'string' ? args.isin : undefined
    const issuer = typeof args.issuer === 'string' ? args.issuer : undefined
    const limit = typeof args.limit === 'number' ? args.limit : undefined

    if (action === 'detail' && !isin) {
      return { output: '', error: `"${action}" requires an "isin" argument.` }
    }

    const path = buildPath(action, { isin, issuer, limit })
    const result = await callAurictApi(ctx, 'modules', path)
    if (result.kind !== 'success') return { output: '', error: describeAurictApiFailure(result) }

    if (action === 'list') {
      const data = result.data as BondListResponse
      if (data.items.length === 0) return { output: 'No bonds matched this query. Tell the user honestly — no data was found; do not invent a result.' }
    }
    return { output: JSON.stringify(result.data, null, 2) }
  },
}

function buildPath(
  action: (typeof actions)[number],
  params: { isin: string | undefined; issuer: string | undefined; limit: number | undefined },
): string {
  const query = new URLSearchParams()
  if (params.limit !== undefined) query.set('limit', String(params.limit))

  switch (action) {
    case 'list':
      if (params.issuer) query.set('issuer', params.issuer)
      return `/bonds/bonds?${query}`
    case 'detail':
      return `/bonds/bonds/${encodeURIComponent(params.isin!)}`
    case 'tlref_latest':
      return '/bonds/tlref/latest'
  }
}
