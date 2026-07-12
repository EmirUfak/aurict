import { describe, expect, it } from 'bun:test'
import { desktopSessionMetadata } from '../src/session-metadata.js'

const base = {
  id: 'session-1', title: 'Analysis', status: 'active', createdAt: 10, updatedAt: 20, parentId: null,
  config: '{"provider":"openai","model":"gpt-test"}', turnCount: 3, totalInputTokens: 100, totalOutputTokens: 20, totalCacheTokens: 10, accumulatedCostUsd: 0.0123, lastModel: 'gpt-test',
}

describe('desktop session metadata', () => {
  it('preserves timing, hierarchy, token, cost, and model metadata', () => {
    expect(desktopSessionMetadata(base)).toEqual({
      id: 'session-1', title: 'Analysis', status: 'active', createdAt: 10, updatedAt: 20, parentId: null,
      turnCount: 3, totalInputTokens: 100, totalOutputTokens: 20, totalCacheTokens: 10, accumulatedCostUsd: 0.0123, provider: 'openai', lastModel: 'gpt-test',
    })
  })

  it('fails visibly for a corrupted persisted session config', () => {
    expect(() => desktopSessionMetadata({ ...base, config: '{bad-json' })).toThrow('Invalid session config')
  })
})
