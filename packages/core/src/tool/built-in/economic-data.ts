import { z } from 'zod'
import { callAurictApi, describeAurictApiFailure } from './_shared/aurict-api.js'
import type { ExecuteResult, ToolContext, ToolDef } from '../types.js'

const actions = ['fx_latest', 'fx_on_date', 'series', 'legal_interest', 'minimum_wage'] as const

export const economicDataTool: ToolDef = {
  id: 'economic_data',
  description:
    "Fetch real Turkish economic data from Aurict's rates service (sourced from TCMB/EVDS): FX rates, arbitrary EVDS series (CPI/PPI/policy rate), legal/default interest rate periods, and minimum wage periods. This tool only fetches data; never invent a rate or wage figure from memory. Legal-interest and minimum-wage data are curated by a human and may be genuinely absent if not yet entered — an empty result there does NOT mean the value is zero. If the response is empty or the user isn't authenticated, say so honestly; do not repeat the exact same query.",
  parameters: z.object({
    action: z.enum(actions).describe(
      "'fx_latest' — latest FX rates. 'fx_on_date' — FX rates on a specific date (requires date). 'series' — arbitrary EVDS series history (requires code). 'legal_interest' — legal/default interest rate covering a date (default: today). 'minimum_wage' — minimum wage covering a date (default: today).",
    ),
    date: z.string().optional().describe('ISO date (YYYY-MM-DD) — used by fx_on_date, legal_interest, minimum_wage.'),
    code: z.string().optional().describe('EVDS series code (e.g. "TP.DK.USD.A") — required for "series".'),
    rateType: z.string().optional().describe('Filter for "legal_interest": e.g. "yasal_faiz", "temerrut_faizi", "ticari_faiz".'),
    from: z.string().optional().describe('Series history start date (YYYY-MM-DD) — used by "series".'),
    to: z.string().optional().describe('Series history end date (YYYY-MM-DD) — used by "series".'),
    limit: z.number().int().positive().max(2000).optional(),
  }),
  spec: { category: 'network', riskLevel: 'low', permissionSummary: 'Fetch Turkish economic data (FX/CPI/rates/wage) from the Aurict rates service' },
  async execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ExecuteResult> {
    const action = args.action as (typeof actions)[number]
    const code = typeof args.code === 'string' ? args.code : undefined

    if (action === 'series' && !code) return { output: '', error: '"series" requires a "code" argument.' }

    const path = buildPath(action, {
      date: typeof args.date === 'string' ? args.date : undefined,
      code,
      rateType: typeof args.rateType === 'string' ? args.rateType : undefined,
      from: typeof args.from === 'string' ? args.from : undefined,
      to: typeof args.to === 'string' ? args.to : undefined,
      limit: typeof args.limit === 'number' ? args.limit : undefined,
    })

    const result = await callAurictApi(ctx, 'modules', path)
    if (result.kind !== 'success') {
      if (result.kind === 'error' && result.status === 404 && (action === 'minimum_wage' || action === 'legal_interest')) {
        return { output: 'No curated data covers this date yet. This is expected if it has not been entered — tell the user honestly, do not guess a figure.' }
      }
      return { output: '', error: describeAurictApiFailure(result) }
    }

    if (action === 'fx_latest' || action === 'fx_on_date' || action === 'legal_interest') {
      const data = result.data as unknown[]
      if (data.length === 0) return { output: 'No data found for this query. Tell the user honestly — do not invent a value.' }
    }
    if (action === 'series') {
      const data = result.data as { observations: unknown[] }
      if (data.observations.length === 0) return { output: 'This series has no observations for the requested range. Tell the user honestly.' }
    }

    return { output: JSON.stringify(result.data, null, 2) }
  },
}

function buildPath(
  action: (typeof actions)[number],
  params: {
    date: string | undefined
    code: string | undefined
    rateType: string | undefined
    from: string | undefined
    to: string | undefined
    limit: number | undefined
  },
): string {
  const query = new URLSearchParams()
  if (params.limit !== undefined) query.set('limit', String(params.limit))

  switch (action) {
    case 'fx_latest':
      return '/rates/fx/latest'
    case 'fx_on_date':
      return `/rates/fx/${encodeURIComponent(params.date ?? '')}`
    case 'series':
      if (params.from) query.set('from', params.from)
      if (params.to) query.set('to', params.to)
      return `/rates/series/${encodeURIComponent(params.code!)}?${query}`
    case 'legal_interest':
      if (params.date) query.set('date', params.date)
      if (params.rateType) query.set('rate_type', params.rateType)
      return `/rates/legal-interest?${query}`
    case 'minimum_wage':
      if (params.date) query.set('date', params.date)
      return `/rates/minimum-wage?${query}`
  }
}
