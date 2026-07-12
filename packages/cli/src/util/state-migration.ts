import { copyFileSync, existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

const MIGRATION_FILE = 'legacy-state-migration-v1.json'
const STATE_FILES = ['aurict.db', 'aurict.db-shm', 'aurict.db-wal', 'config.json', 'design-prefs.json'] as const

interface MigrationEntry {
  file: string
  status: 'copied' | 'already-present' | 'not-found'
  bytes?: number
}

export interface StateMigrationOptions {
  sourceDir?: string
  targetDir?: string
}

/**
 * Moves no data destructively. It runs before @aurict/core is imported, which
 * is required because core opens its SQLite database during module loading.
 */
export function migrateLegacyCoreState(options: StateMigrationOptions = {}): void {
  const configured = options.targetDir ?? process.env.AURICT_STATE_DIR?.trim()
  if (!configured) return

  const sourceDir = options.sourceDir ?? join(homedir(), '.aurict')
  const targetDir = resolve(configured)
  if (resolve(sourceDir) === targetDir) return

  mkdirSync(targetDir, { recursive: true })
  const marker = join(targetDir, MIGRATION_FILE)
  if (existsSync(marker)) return

  const files: MigrationEntry[] = []
  for (const file of STATE_FILES) {
    const source = join(sourceDir, file)
    const target = join(targetDir, file)
    if (!existsSync(source)) {
      files.push({ file, status: 'not-found' })
      continue
    }
    if (!statSync(source).isFile()) throw new Error(`Legacy core state entry is not a file: ${source}`)
    if (existsSync(target)) {
      files.push({ file, status: 'already-present', bytes: statSync(target).size })
      continue
    }

    const temporary = `${target}.migrating-${process.pid}`
    copyFileSync(source, temporary)
    renameSync(temporary, target)
    files.push({ file, status: 'copied', bytes: statSync(target).size })
  }

  const temporaryMarker = `${marker}.migrating-${process.pid}`
  writeFileSync(temporaryMarker, JSON.stringify({ version: 1, sourceDir, migratedAt: Date.now(), files }, null, 2), 'utf8')
  renameSync(temporaryMarker, marker)
}
