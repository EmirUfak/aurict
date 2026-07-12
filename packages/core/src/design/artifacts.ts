import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { coreStatePath } from '../storage/paths.js'

export type DesignArtifactStatus = 'draft' | 'generating' | 'ready' | 'failed'

export interface DesignArtifactRevision {
  id: string
  createdAt: number
  summary?: string
  htmlFile: string
}

export interface DesignArtifact {
  id: string
  title: string
  brief: string
  workspace: string
  systemId: string
  skillId: string
  status: DesignArtifactStatus
  createdAt: number
  updatedAt: number
  error?: string
  revisions: DesignArtifactRevision[]
}

export interface CreateDesignArtifactInput {
  id: string
  title: string
  brief: string
  workspace: string
  systemId: string
  skillId: string
}

function rootDir(): string {
  const configured = process.env.AURICT_DESIGN_DATA_DIR
  if (configured) return configured
  return coreStatePath('designs')
}

function validId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,80}$/i.test(id)
}

function artifactDir(id: string): string {
  if (!validId(id)) throw new Error(`Invalid design artifact id: ${id}`)
  return join(rootDir(), id)
}

function manifestPath(id: string): string {
  return join(artifactDir(id), 'artifact.json')
}

function save(artifact: DesignArtifact): void {
  mkdirSync(artifactDir(artifact.id), { recursive: true })
  writeFileSync(manifestPath(artifact.id), JSON.stringify(artifact, null, 2), 'utf8')
}

function parseArtifact(path: string): DesignArtifact {
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<DesignArtifact>
    if (!raw.id || !raw.title || !raw.workspace || !raw.brief || !raw.systemId || !raw.skillId) {
      throw new Error('required artifact fields are missing')
    }
    return {
      id: raw.id,
      title: raw.title,
      brief: raw.brief,
      workspace: raw.workspace,
      systemId: raw.systemId,
      skillId: raw.skillId,
      status: raw.status ?? 'draft',
      createdAt: raw.createdAt ?? Date.now(),
      updatedAt: raw.updatedAt ?? Date.now(),
      ...(raw.error ? { error: raw.error } : {}),
      revisions: Array.isArray(raw.revisions) ? raw.revisions : [],
    }
  } catch (error) {
    throw new Error(`Failed to read design artifact manifest at ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function requireArtifact(id: string): DesignArtifact {
  const artifact = parseArtifact(manifestPath(id))
  if (!artifact) throw new Error(`Design artifact not found: ${id}`)
  return artifact
}

function outputPath(id: string): string {
  return join(artifactDir(id), 'index.html')
}

export const designArtifactStore = {
  rootDir,

  create(input: CreateDesignArtifactInput): DesignArtifact {
    const now = Date.now()
    const artifact: DesignArtifact = {
      ...input,
      status: 'generating',
      createdAt: now,
      updatedAt: now,
      revisions: [],
    }
    mkdirSync(join(artifactDir(input.id), 'revisions'), { recursive: true })
    save(artifact)
    return artifact
  },

  list(workspace?: string): DesignArtifact[] {
    if (!existsSync(rootDir())) return []
    return readdirSync(rootDir(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && validId(entry.name))
      .map((entry) => parseArtifact(join(rootDir(), entry.name, 'artifact.json')))
      .filter((artifact) => !workspace || artifact.workspace === workspace)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  },

  get(id: string): DesignArtifact {
    return requireArtifact(id)
  },

  outputPath,

  captureRevision(id: string, summary?: string): DesignArtifact {
    const artifact = requireArtifact(id)
    const source = outputPath(id)
    if (!existsSync(source)) throw new Error(`Design artifact has no generated output: ${id}`)
    const revision: DesignArtifactRevision = {
      id: `r${artifact.revisions.length + 1}`,
      createdAt: Date.now(),
      ...(summary ? { summary } : {}),
      htmlFile: `revisions/r${artifact.revisions.length + 1}.html`,
    }
    copyFileSync(source, join(artifactDir(id), revision.htmlFile))
    artifact.revisions = [...artifact.revisions, revision]
    artifact.status = 'ready'
    artifact.updatedAt = revision.createdAt
    delete artifact.error
    save(artifact)
    return artifact
  },

  fail(id: string, error: string): DesignArtifact {
    const artifact = requireArtifact(id)
    artifact.status = 'failed'
    artifact.error = error
    artifact.updatedAt = Date.now()
    save(artifact)
    return artifact
  },

  retry(id: string): DesignArtifact {
    const artifact = requireArtifact(id)
    if (artifact.status !== 'failed') throw new Error(`Only failed design artifacts can be retried: ${id}`)
    artifact.status = 'generating'
    artifact.updatedAt = Date.now()
    delete artifact.error
    save(artifact)
    return artifact
  },
}
