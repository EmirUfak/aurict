import type { SessionStats } from '@aurict/core'

export interface DesktopSessionMetadata {
  id: string
  title: string | null
  createdAt: number
  updatedAt: number
  status: string
  parentId: string | null
  turnCount: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheTokens: number
  accumulatedCostUsd: number
  provider: string | null
  lastModel: string | null
}

export function desktopSessionMetadata(session: SessionStats): DesktopSessionMetadata {
  let provider: string | null = null
  if (session.config) {
    let config: unknown
    try {
      config = JSON.parse(session.config)
    } catch (error) {
      throw new Error(`Invalid session config for ${session.id}: ${error instanceof Error ? error.message : String(error)}`)
    }
    if (typeof config !== 'object' || config === null || Array.isArray(config)) throw new Error(`Invalid session config for ${session.id}: expected an object`)
    const candidate = config as Record<string, unknown>
    provider = typeof candidate.provider === 'string' ? candidate.provider : null
  }
  return {
    id: session.id,
    title: session.title ?? null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    status: session.status,
    parentId: session.parentId ?? null,
    turnCount: session.turnCount,
    totalInputTokens: session.totalInputTokens,
    totalOutputTokens: session.totalOutputTokens,
    totalCacheTokens: session.totalCacheTokens,
    accumulatedCostUsd: session.accumulatedCostUsd,
    provider,
    lastModel: session.lastModel ?? null,
  }
}
