import { describe, expect, it } from 'bun:test'
import { parseFinanceResearchAudit } from '../src/finance-research-audit.js'

describe('finance research audit parsing', () => {
  it('extracts a source-backed audit record from a model response', () => {
    const audit = parseFinanceResearchAudit(`The yield changed.

\`\`\`finance-audit
{"summary":"A concise market review.","dataAsOf":"2026-07-11T00:00:00.000Z","sources":[{"title":"Treasury data","url":"https://home.treasury.gov/"}],"assumptions":["Illustrative inputs"],"uncertainties":["Rates can move"]}
\`\`\``, '2026-07-11T12:00:00.000Z')

    expect(audit.summary).toBe('A concise market review.')
    expect(audit.dataAsOf).toBe('2026-07-11T00:00:00.000Z')
    expect(audit.sources).toEqual([{ title: 'Treasury data', url: 'https://home.treasury.gov/', accessedAt: '2026-07-11T12:00:00.000Z' }])
    expect(audit.warning).toBeUndefined()
  })

  it('makes an absent or malformed audit record visible for review', () => {
    const audit = parseFinanceResearchAudit('No structured record here.')

    expect(audit.sources).toEqual([])
    expect(audit.warning).toContain('did not provide')
  })

  it('rejects non-web source URLs before the renderer can link to them', () => {
    const audit = parseFinanceResearchAudit([
      '```finance-audit',
      '{"summary":"Unsafe source.","sources":[{"title":"Bad","url":"javascript:alert(1)"}],"assumptions":[],"uncertainties":[]}',
      '```',
    ].join('\n'))

    expect(audit.sources).toEqual([])
    expect(audit.warning).toContain('No valid source URLs')
  })
})
