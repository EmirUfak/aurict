import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { economicDataTool } from '../src/tool/built-in/economic-data.js'
import type { ToolContext } from '../src/tool/types.js'

function fakeCtx(): ToolContext {
  return { sessionId: 's', workdir: '/tmp', signal: new AbortController().signal, backendAccessToken: 'test-token' }
}

let server: ReturnType<typeof Bun.serve>

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url)
      if (url.pathname === '/rates/fx/latest') return Response.json([{ series: { code: 'TP.DK.USD.A' }, value: '34.10' }])
      if (url.pathname === '/rates/fx/2000-01-01') return Response.json([])
      if (url.pathname === '/rates/series/TP.DK.USD.A') {
        return Response.json({ series: { code: 'TP.DK.USD.A' }, observations: [{ obs_date: '2026-07-13', value: '34.10' }] })
      }
      if (url.pathname === '/rates/series/TP.EMPTY') {
        return Response.json({ series: { code: 'TP.EMPTY' }, observations: [] })
      }
      if (url.pathname === '/rates/legal-interest') return Response.json([])
      if (url.pathname === '/rates/minimum-wage') return Response.json({ detail: 'No minimum wage period covers this date' }, { status: 404 })
      return new Response(null, { status: 404 })
    },
  })
  process.env['AURICT_MODULES_URL'] = `http://127.0.0.1:${server.port}`
})

afterAll(() => {
  server.stop(true)
  delete process.env['AURICT_MODULES_URL']
})

describe('economic_data tool', () => {
  it('requires code for "series" without making a request', async () => {
    const result = await economicDataTool.execute({ action: 'series' }, fakeCtx())
    expect(result.error).toContain('code')
  })

  it('fetches latest FX rates', async () => {
    const result = await economicDataTool.execute({ action: 'fx_latest' }, fakeCtx())
    expect(JSON.parse(result.output)[0].value).toBe('34.10')
  })

  it('reports empty FX-on-date results clearly', async () => {
    const result = await economicDataTool.execute({ action: 'fx_on_date', date: '2000-01-01' }, fakeCtx())
    expect(result.error).toBeUndefined()
    expect(result.output.toLowerCase()).toContain('no data found')
  })

  it('fetches a series with observations', async () => {
    const result = await economicDataTool.execute({ action: 'series', code: 'TP.DK.USD.A' }, fakeCtx())
    expect(JSON.parse(result.output).observations).toHaveLength(1)
  })

  it('reports an empty series clearly', async () => {
    const result = await economicDataTool.execute({ action: 'series', code: 'TP.EMPTY' }, fakeCtx())
    expect(result.output.toLowerCase()).toContain('no observations')
  })

  it('treats empty legal_interest as a normal (not error) empty result', async () => {
    const result = await economicDataTool.execute({ action: 'legal_interest' }, fakeCtx())
    expect(result.error).toBeUndefined()
  })

  it('treats a 404 minimum_wage as "not yet curated", not an error', async () => {
    const result = await economicDataTool.execute({ action: 'minimum_wage', date: '2000-01-01' }, fakeCtx())
    expect(result.error).toBeUndefined()
    expect(result.output.toLowerCase()).toContain('not been entered')
  })
})
