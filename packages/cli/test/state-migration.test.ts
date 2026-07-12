import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrateLegacyCoreState } from '../src/util/state-migration.js'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('legacy core state migration', () => {
  it('copies supported state files once and preserves the source', () => {
    const source = mkdtempSync(join(tmpdir(), 'aurict-legacy-state-'))
    const target = mkdtempSync(join(tmpdir(), 'aurict-next-state-'))
    dirs.push(source, target)
    writeFileSync(join(source, 'config.json'), '{"defaults":{"provider":"openai"}}', 'utf8')
    writeFileSync(join(source, 'design-prefs.json'), '{"recentSystemIds":["linear"]}', 'utf8')

    migrateLegacyCoreState({ sourceDir: source, targetDir: target })

    expect(readFileSync(join(target, 'config.json'), 'utf8')).toContain('openai')
    expect(readFileSync(join(target, 'design-prefs.json'), 'utf8')).toContain('linear')
    expect(existsSync(join(target, 'legacy-state-migration-v1.json'))).toBe(true)
    expect(existsSync(join(source, 'config.json'))).toBe(true)

    writeFileSync(join(source, 'config.json'), '{"defaults":{"provider":"changed"}}', 'utf8')
    migrateLegacyCoreState({ sourceDir: source, targetDir: target })
    expect(readFileSync(join(target, 'config.json'), 'utf8')).toContain('openai')
  })
})
