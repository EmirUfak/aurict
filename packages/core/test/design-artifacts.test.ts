import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { designArtifactStore } from '../src/design/artifacts.js'

const testHome = mkdtempSync(join(tmpdir(), 'aurict-design-artifacts-'))
const originalDesignDataDir = process.env.AURICT_DESIGN_DATA_DIR

beforeAll(() => {
  process.env.AURICT_DESIGN_DATA_DIR = testHome
})

afterAll(() => {
  if (originalDesignDataDir === undefined) delete process.env.AURICT_DESIGN_DATA_DIR
  else process.env.AURICT_DESIGN_DATA_DIR = originalDesignDataDir
  rmSync(testHome, { recursive: true, force: true })
})

describe('designArtifactStore', () => {
  it('creates, lists, and versions a generated design artifact', () => {
    const artifact = designArtifactStore.create({
      id: 'onboarding-test',
      title: 'Onboarding test',
      brief: 'A focused onboarding flow',
      workspace: '/tmp/workspace',
      systemId: 'linear-app',
      skillId: 'mobile-app',
    })

    expect(artifact.status).toBe('generating')
    writeFileSync(designArtifactStore.outputPath(artifact.id), '<main>ready</main>', 'utf8')

    const versioned = designArtifactStore.captureRevision(artifact.id, 'Initial prototype')
    expect(versioned.status).toBe('ready')
    expect(versioned.revisions).toHaveLength(1)
    expect(existsSync(join(designArtifactStore.rootDir(), artifact.id, 'revisions', 'r1.html'))).toBe(true)
    expect(designArtifactStore.list('/tmp/workspace')).toHaveLength(1)
  })

  it('fails visibly when an artifact manifest is malformed', () => {
    const id = 'broken-manifest'
    mkdirSync(join(designArtifactStore.rootDir(), id), { recursive: true })
    writeFileSync(join(designArtifactStore.rootDir(), id, 'artifact.json'), '{not-json', 'utf8')

    expect(() => designArtifactStore.list('/tmp/workspace')).toThrow('Failed to read design artifact manifest')
  })

  it('reopens a failed artifact without discarding its prior revisions', () => {
    const artifact = designArtifactStore.create({
      id: 'retry-test', title: 'Retry test', brief: 'Recover a design', workspace: '/tmp/workspace', systemId: 'linear-app', skillId: 'mobile-app',
    })
    writeFileSync(designArtifactStore.outputPath(artifact.id), '<main>first</main>', 'utf8')
    designArtifactStore.captureRevision(artifact.id, 'First revision')
    designArtifactStore.fail(artifact.id, 'provider interrupted')

    const retried = designArtifactStore.retry(artifact.id)
    expect(retried.status).toBe('generating')
    expect(retried.error).toBeUndefined()
    expect(retried.revisions).toHaveLength(1)
  })
})
