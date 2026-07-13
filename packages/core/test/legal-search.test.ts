import { describe, expect, it, beforeAll, afterAll } from 'bun:test'
import { legalSearchTool } from '../src/tool/built-in/legal-search.js'
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
      if (url.pathname === '/legal/search' && url.searchParams.get('q') === 'sözleşme') {
        return Response.json({ ok: true, results: [{ unit: { id: 'lgu_1', label: 'MADDE 1' }, document: { identifier: '6098' } }] })
      }
      if (url.pathname === '/legal/search') return Response.json({ ok: true, results: [] })
      if (url.pathname === '/legal/statute/TR/6098') {
        return Response.json({ ok: true, document: { identifier: '6098', title: 'TÜRK BORÇLAR KANUNU' }, units: [] })
      }
      if (url.pathname === '/legal/statute/TR/99999') {
        return Response.json({ error: { code: 'fetch_failed', message: 'HTTP 404' } }, { status: 502 })
      }
      if (url.pathname === '/legal/unit/lgu_1' && url.searchParams.get('expand') === 'citations') {
        return Response.json({ ok: true, unit: { id: 'lgu_1' }, children: [], citations: [{ rawText: 'test' }] })
      }
      if (url.pathname === '/legal/unit/lgu_1') return Response.json({ ok: true, unit: { id: 'lgu_1' }, children: [] })
      if (url.pathname === '/legal/unit/lgu_missing') return Response.json({ error: { code: 'not_found', message: 'Legal unit not found.' } }, { status: 404 })
      return new Response(null, { status: 404 })
    },
  })
  process.env['AURICT_BACKEND_URL'] = `http://127.0.0.1:${server.port}`
})

afterAll(() => {
  server.stop(true)
  delete process.env['AURICT_BACKEND_URL']
})

describe('legal_search tool', () => {
  it('requires query for "search"', async () => {
    const result = await legalSearchTool.execute({ action: 'search' }, fakeCtx())
    expect(result.error).toContain('query')
  })

  it('requires jurisdiction+identifier for "get_statute"', async () => {
    const result = await legalSearchTool.execute({ action: 'get_statute', jurisdiction: 'TR' }, fakeCtx())
    expect(result.error).toContain('identifier')
  })

  it('requires unitId for "get_unit"', async () => {
    const result = await legalSearchTool.execute({ action: 'get_unit' }, fakeCtx())
    expect(result.error).toContain('unitId')
  })

  it('finds real search results', async () => {
    const result = await legalSearchTool.execute({ action: 'search', query: 'sözleşme' }, fakeCtx())
    expect(JSON.parse(result.output).results[0].unit.label).toBe('MADDE 1')
  })

  it('reports empty search results clearly', async () => {
    const result = await legalSearchTool.execute({ action: 'search', query: 'yoktur' }, fakeCtx())
    expect(result.output.toLowerCase()).toContain('no matching articles')
  })

  it('fetches a statute', async () => {
    const result = await legalSearchTool.execute({ action: 'get_statute', jurisdiction: 'TR', identifier: '6098' }, fakeCtx())
    expect(JSON.parse(result.output).document.title).toBe('TÜRK BORÇLAR KANUNU')
  })

  it('surfaces a service failure for an unresolvable statute (Hono error shape)', async () => {
    const result = await legalSearchTool.execute({ action: 'get_statute', jurisdiction: 'TR', identifier: '99999' }, fakeCtx())
    expect(result.error).toContain('ulaşılamıyor')
  })

  it('fetches a unit without citations by default', async () => {
    const result = await legalSearchTool.execute({ action: 'get_unit', unitId: 'lgu_1' }, fakeCtx())
    expect(JSON.parse(result.output).citations).toBeUndefined()
  })

  it('expands citations when requested', async () => {
    const result = await legalSearchTool.execute({ action: 'get_unit', unitId: 'lgu_1', expandCitations: true }, fakeCtx())
    expect(JSON.parse(result.output).citations).toHaveLength(1)
  })

  it('reports 404 for a missing unit as "not found", not a generic error', async () => {
    const result = await legalSearchTool.execute({ action: 'get_unit', unitId: 'lgu_missing' }, fakeCtx())
    expect(result.error).toBeUndefined()
    expect(result.output.toLowerCase()).toContain('not found')
  })
})
