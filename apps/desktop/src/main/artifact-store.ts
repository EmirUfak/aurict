import { existsSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ArtifactInfo } from '../shared/ipc-types.js';

type StoredArtifact = ArtifactInfo & { path: string };

export function createArtifactStore(userDataPath: () => string, workspace: () => string) {
  const filePath = () => path.join(userDataPath(), 'artifacts.json');
  const read = (): StoredArtifact[] => {
    try { return existsSync(filePath()) ? JSON.parse(readFileSync(filePath(), 'utf8')) as StoredArtifact[] : []; }
    catch (error) { throw new Error(`Artifact registry could not be read: ${error instanceof Error ? error.message : String(error)}`); }
  };
  const save = (records: StoredArtifact[]) => {
    const temp = `${filePath()}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(records, null, 2), 'utf8'); renameSync(temp, filePath());
  };

  // Uses realpathSync (not path.resolve) so containment checks follow
  // symlinks to their real target — a symlink inside the approved root
  // that points outside it is rejected, not just the symlink's own path.
  // Fails closed (returns false) if either path can't be resolved at all
  // (missing file, broken symlink), rather than throwing a raw fs error.
  const within = (candidate: string, root: string): boolean => {
    let resolvedRoot: string;
    let resolvedCandidate: string;
    try {
      resolvedRoot = realpathSync(root);
    } catch {
      return false; // approved root itself missing — fail closed
    }
    try {
      resolvedCandidate = realpathSync(candidate);
    } catch {
      return false; // candidate missing, broken symlink, etc. — fail closed
    }
    return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(`${resolvedRoot}${path.sep}`);
  };
  return {
    register(record: ArtifactInfo & { path: string }) {
      if (!within(record.path, record.source === 'workspace' ? workspace() : userDataPath())) throw new Error(`Artifact path is outside its approved root: ${record.id}`);
      const records = read().filter((item) => item.id !== record.id);
      const prior = records.find((item) => item.title === record.title && item.kind === record.kind && item.sessionId === record.sessionId);
      const versioned = record.previousId || !prior ? record : { ...record, previousId: prior.id };
      records.unshift(versioned); save(records); return versioned;
    },
    list(): ArtifactInfo[] {
      return read().map((record) => {
        const copy = { ...record };
        delete (copy as Partial<StoredArtifact>).path;
        return copy;
      });
    },
    resolve(id: string): StoredArtifact {
      const record = read().find((item) => item.id === id); if (!record) throw new Error('Artifact not found');
      if (!existsSync(record.path) || !statSync(record.path).isFile()) throw new Error('Artifact file is unavailable');
      if (!within(record.path, record.source === 'workspace' ? workspace() : userDataPath())) throw new Error('Artifact is outside its approved root');
      return record;
    },
  };
}
