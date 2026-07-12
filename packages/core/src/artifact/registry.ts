import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { coreStatePath } from '../storage/paths.js'

export type ArtifactKind = 'pdf' | 'html' | 'image' | 'markdown' | 'code' | 'table' | 'document' | 'unknown'
export type ArtifactLifecycle = 'generating' | 'ready' | 'failed' | 'unavailable'
export type ArtifactSource = 'workspace' | 'aurict-managed'
export interface ArtifactRecord { id: string; title: string; kind: ArtifactKind; lifecycle: ArtifactLifecycle; source: ArtifactSource; path: string; workspace: string; mimeType?: string; createdAt: number; updatedAt: number; sessionId?: string; tool?: string; prompt?: string; error?: string }

function storePath(): string { return coreStatePath('artifacts.json') }
function valid(record: ArtifactRecord): boolean { return /^[a-z0-9][a-z0-9-]{0,120}$/i.test(record.id) && Boolean(record.path) && Boolean(record.workspace) }
function read(): ArtifactRecord[] {
  try {
    if (!existsSync(storePath())) return []
    const records = JSON.parse(readFileSync(storePath(), 'utf8')) as ArtifactRecord[]
    if (!Array.isArray(records) || records.some((record) => !valid(record))) throw new Error('invalid artifact registry')
    return records
  } catch (error) { throw new Error(`Failed to read artifact registry: ${error instanceof Error ? error.message : String(error)}`) }
}
function save(records: ArtifactRecord[]): void {
  mkdirSync(coreStatePath(), { recursive: true })
  const temporary = `${storePath()}.${process.pid}.tmp`
  writeFileSync(temporary, JSON.stringify(records, null, 2), 'utf8')
  renameSync(temporary, storePath())
}
export const artifactRegistry = {
  register(input: Omit<ArtifactRecord, 'createdAt' | 'updatedAt'> & Partial<Pick<ArtifactRecord, 'createdAt' | 'updatedAt'>>): ArtifactRecord {
    const path = resolve(input.path); const now = Date.now()
    const record: ArtifactRecord = { ...input, title: input.title.trim() || basename(path), path, createdAt: input.createdAt ?? now, updatedAt: now }
    if (!valid(record)) throw new Error('Artifact record is invalid')
    const records = read().filter((current) => current.id !== record.id); records.unshift(record); save(records); return record
  },
  list(workspace?: string): ArtifactRecord[] { return read().filter((record) => !workspace || record.workspace === workspace).sort((a, b) => b.updatedAt - a.updatedAt) },
  get(id: string): ArtifactRecord { const record = read().find((current) => current.id === id); if (!record) throw new Error(`Artifact not found: ${id}`); return record },
  markUnavailable(id: string, error: string): ArtifactRecord { const record = this.get(id); return this.register({ ...record, lifecycle: 'unavailable', error }) },
}
