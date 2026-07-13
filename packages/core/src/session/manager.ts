import { createSession, getSession, listSessions, updateSession, deleteSession as dbDeleteSession, addPart, getSessionParts, getSessionPartsCount, getSessionPartsTail, recordTurn as dbRecordTurn, listSessionsWithStats, getSessionStats, searchSessions as dbSearchSessions } from "../storage/queries.js"
import type { Session, Part, SessionConfig } from "./types.js"
import type { SessionStats, SessionSearchResult } from "../storage/queries.js"
import { hooks } from "../hook/emitter.js"

function newId(): string {
  return crypto.randomUUID()
}

export const SessionManager = {
  create(cfg: SessionConfig, opts: { title?: string; parentId?: string } = {}): string {
    const id = newId()
    createSession({
      id,
      config: JSON.stringify(cfg),
      ...(opts.title !== undefined ? { title: opts.title } : {}),
      ...(opts.parentId !== undefined ? { parentId: opts.parentId } : {}),
    })
    hooks.emit("v1.session.start", { sessionId: id })
    return id
  },

  get(id: string): Session | undefined {
    return getSession(id) ?? undefined
  },

  list(): Session[] {
    return listSessions()
  },

  async end(id: string, reason = "user"): Promise<void> {
    updateSession(id, { status: "complete" })
    await hooks.emit("v1.session.end", { sessionId: id, reason })
  },

  deleteSession(id: string): void {
    dbDeleteSession(id)
  },

  rename(id: string, title: string): void {
    const normalized = title.trim()
    if (!normalized) throw new Error("Session title cannot be empty")
    updateSession(id, { title: normalized })
  },

  archive(id: string, archived: boolean): void {
    updateSession(id, { status: archived ? "archived" : "complete" })
  },

  branch(id: string): string {
    const parent = getSession(id)
    if (!parent) throw new Error("Session to branch was not found")
    if (!parent.config) throw new Error("Session configuration is unavailable")
    const config = JSON.parse(parent.config) as SessionConfig
    const childId = this.create(config, { parentId: id, title: parent.title ? `${parent.title} — branch` : "Branched session" })
    for (const part of getSessionParts(id)) this.addPart({ sessionId: childId, role: part.role, type: part.type, content: part.content, ...(part.tokens === null ? {} : { tokens: part.tokens }) })
    return childId
  },

  ensureExists(id: string, cfg: SessionConfig): void {
    if (!getSession(id)) {
      createSession({ id, config: JSON.stringify(cfg) })
    }
  },

  addPart(data: {
    sessionId: string
    role: string
    type: string
    content: string
    tokens?: number
  }): string {
    // COUNT(*) instead of fetching all rows just to get the length
    const sequence = getSessionPartsCount(data.sessionId)
    const id = newId()
    addPart({ id, sequence, ...data })
    return id
  },

  getParts(sessionId: string): Part[] {
    return getSessionParts(sessionId)
  },

  getPartsTail(sessionId: string, limit: number): Part[] {
    return getSessionPartsTail(sessionId, limit)
  },

  getPartsCount(sessionId: string): number {
    return getSessionPartsCount(sessionId)
  },

  /** LLM turn'ü bitti — token ve maliyet birikimini güncelle */
  recordTurn(sessionId: string, data: {
    inputTokens:  number
    outputTokens: number
    cacheTokens:  number
    costUsd:      number
    model:        string
  }): void {
    try {
      dbRecordTurn(sessionId, data)
    } catch (error) {
      console.error(`[aurict] failed to record session usage for ${sessionId}`, error)
    }
  },

  /** Maliyet istatistikleriyle tüm session listesi */
  listWithStats(limit?: number): SessionStats[] {
    return listSessionsWithStats(limit)
  },

  /** Tek session'ın maliyet özeti */
  getStats(sessionId: string): SessionStats | undefined {
    return getSessionStats(sessionId)
  },

  /** Part içeriklerinde tam metin arama */
  search(query: string, limit?: number): SessionSearchResult[] {
    return dbSearchSessions(query, limit)
  },
}
