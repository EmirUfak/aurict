export interface FinanceResearchAuditPayload {
  summary: string
  dataAsOf?: string
  sources: Array<{ title: string; url: string; publishedAt?: string; accessedAt: string }>
  assumptions: string[]
  uncertainties: string[]
  warning?: string
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function validSourceUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function fallback(text: string, warning: string): FinanceResearchAuditPayload {
  return {
    summary: text.replace(/```finance-audit[\s\S]*?```/i, '').trim().slice(0, 1_000) || 'Research response completed without a structured audit record.',
    sources: [],
    assumptions: [],
    uncertainties: [],
    warning,
  }
}

export function parseFinanceResearchAudit(text: string, accessedAt = new Date().toISOString()): FinanceResearchAuditPayload {
  const match = /```finance-audit\s*\n([\s\S]*?)```/i.exec(text)
  if (!match?.[1]) return fallback(text, 'The model did not provide the required structured finance audit record. Review citations before relying on this research.')

  let raw: unknown
  try {
    raw = JSON.parse(match[1])
  } catch (error) {
    return fallback(text, `The model returned an unreadable finance audit record: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return fallback(text, 'The model returned a finance audit record with an invalid shape.')

  const value = raw as Record<string, unknown>
  if (typeof value.summary !== 'string' || !value.summary.trim()) return fallback(text, 'The model returned a finance audit record without a summary.')
  const sources = Array.isArray(value.sources) ? value.sources.flatMap((source) => {
    if (typeof source !== 'object' || source === null || Array.isArray(source)) return []
    const candidate = source as Record<string, unknown>
    if (typeof candidate.title !== 'string' || !validSourceUrl(candidate.url)) return []
    return [{
      title: candidate.title,
      url: candidate.url,
      ...(validDate(candidate.publishedAt) ? { publishedAt: candidate.publishedAt } : {}),
      accessedAt,
    }]
  }) : []
  const dataAsOf = validDate(value.dataAsOf) ? value.dataAsOf : undefined

  return {
    summary: value.summary.trim(),
    ...(dataAsOf ? { dataAsOf } : {}),
    sources,
    assumptions: asStringList(value.assumptions),
    uncertainties: asStringList(value.uncertainties),
    ...(sources.length === 0 ? { warning: 'No valid source URLs were supplied. Review this research before relying on time-sensitive claims.' } : {}),
  }
}
