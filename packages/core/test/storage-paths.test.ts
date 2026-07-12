import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { coreAssetDir, coreStateDir, coreStatePath, ensureCoreStateDir } from '../src/storage/paths.js'
import { loadDesignPrefs, saveDesignPrefs } from '../src/design/prefs.js'

const originalStateDir = process.env.AURICT_STATE_DIR
const originalAssetDir = process.env.AURICT_ASSET_DIR
const originalDataDir = process.env.AURICT_DATA_DIR
const created: string[] = []

afterEach(() => {
  if (originalStateDir === undefined) delete process.env.AURICT_STATE_DIR
  else process.env.AURICT_STATE_DIR = originalStateDir
  if (originalAssetDir === undefined) delete process.env.AURICT_ASSET_DIR
  else process.env.AURICT_ASSET_DIR = originalAssetDir
  if (originalDataDir === undefined) delete process.env.AURICT_DATA_DIR
  else process.env.AURICT_DATA_DIR = originalDataDir
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('core state paths', () => {
  it('uses an explicit writable state directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aurict-state-'))
    created.push(dir)
    process.env.AURICT_STATE_DIR = dir

    expect(coreStateDir()).toBe(dir)
    expect(coreStatePath('aurict.db')).toBe(join(dir, 'aurict.db'))
    expect(ensureCoreStateDir()).toBe(dir)
  })

  it('uses the dedicated asset directory before the legacy alias', () => {
    process.env.AURICT_ASSET_DIR = '/tmp/aurict-assets'
    process.env.AURICT_DATA_DIR = '/tmp/aurict-legacy-assets'
    expect(coreAssetDir()).toBe('/tmp/aurict-assets')
  })

  it('persists preferences in the configured state directory and rejects corrupt data', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aurict-prefs-'))
    created.push(dir)
    process.env.AURICT_STATE_DIR = dir

    saveDesignPrefs({ favoriteSystemIds: [], favoriteSkillIds: [], recentSystemIds: ['linear'] })
    expect(loadDesignPrefs().recentSystemIds).toEqual(['linear'])

    writeFileSync(join(dir, 'design-prefs.json'), '{bad-json', 'utf8')
    expect(() => loadDesignPrefs()).toThrow('Failed to read design preferences')
  })
})
