import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { marketDataTool } from '../src/tool/built-in/market-data.js'
import type { ToolContext } from '../src/tool/types.js'

function fakeCtx(token = 'test-token'): ToolContext {
  return { sessionId: 's', workdir: '/tmp', signal: new AbortController().signal, backendAccessToken: token }
}

function fakeCtxNoToken(): ToolContext {
  return { sessionId: 's', workdir: '/tmp', signal: new AbortController().signal }
}

let server: ReturnType<typeof Bun.serve>
let requestedPaths: string[] = []

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url)
      requestedPaths.push(url.pathname + url.search)
      if (url.pathname === '/bonds/bonds' && url.searchParams.get('issuer') === 'nonexistent') {
        return Response.json({ total: 0, limit: 50, offset: 0, items: [] })
      }
      if (url.pathname === '/bonds/bonds') {
        return Response.json({ total: 1, limit: 50, offset: 0, items: [{ isin_code: 'TR000000TEST' }] })
      }
      if (url.pathname === '/bonds/bonds/TR000000TEST') {
        return Response.json({ isin_code: 'TR000000TEST', issuer: 'Test Issuer' })
      }
      if (url.pathname === '/bonds/bonds/NOEXIST') {
        return Response.json({ detail: 'Bond not found' }, { status: 404 })
      }
      if (url.pathname === '/bonds/bonds/TR000000TEST/kap') {
        return Response.json([])
      }
      if (url.pathname === '/bonds/tlref/latest') {
        return Response.json({ rate_date: '2026-07-13', index_value: '6291.49' })
      }
      return new Response(null, { status: 404 })
    },
  })
  process.env['AURICT_MODULES_URL'] = `http://127.0.0.1:${server.port}`
})

afterAll(() => {
  server.stop(true)
  delete process.env['AURICT_MODULES_URL']
})

describe('market_data tool', () => {
  it('requires isin for detail/kap_disclosures without making a request', async () => {
    requestedPaths = []
    const result = await marketDataTool.execute({ action: 'detail' }, fakeCtx())
    expect(result.error).toContain('isin')
    expect(requestedPaths).toHaveLength(0)
  })

  it('returns a clear message (not a crash) when the list is empty', async () => {
    const result = await marketDataTool.execute({ action: 'list', issuer: 'nonexistent' }, fakeCtx())
    expect(result.error).toBeUndefined()
    expect(result.output.toLowerCase()).toContain('no bonds')
  })

  it('returns real bond data for a matching list query', async () => {
    const result = await marketDataTool.execute({ action: 'list', issuer: 'Test' }, fakeCtx())
    expect(JSON.parse(result.output).items[0].isin_code).toBe('TR000000TEST')
  })

  it('fetches a bond by ISIN', async () => {
    const result = await marketDataTool.execute({ action: 'detail', isin: 'TR000000TEST' }, fakeCtx())
    expect(JSON.parse(result.output).issuer).toBe('Test Issuer')
  })

  it('surfaces a friendly not-found message for an unknown ISIN (FastAPI 404 detail)', async () => {
    const result = await marketDataTool.execute({ action: 'detail', isin: 'NOEXIST' }, fakeCtx())
    expect(result.error).toContain('Bond not found')
  })

  it('reports empty KAP disclosures clearly', async () => {
    const result = await marketDataTool.execute({ action: 'kap_disclosures', isin: 'TR000000TEST' }, fakeCtx())
    expect(result.output.toLowerCase()).toContain('no kap disclosures')
  })

  it('fetches TLREF latest', async () => {
    const result = await marketDataTool.execute({ action: 'tlref_latest' }, fakeCtx())
    expect(JSON.parse(result.output).index_value).toBe('6291.49')
  })

  it('reports not-authenticated without calling the network when token is missing', async () => {
    requestedPaths = []
    const result = await marketDataTool.execute({ action: 'tlref_latest' }, fakeCtxNoToken())
    expect(result.error).toContain('giriş yapmamış')
    expect(requestedPaths).toHaveLength(0)
  })
})
