/**
 * Filesystem access handed to adapters.
 *
 * Adapters must never be able to read outside their own upstream clone, so all
 * paths go through a containment check. They also must never write: nothing in
 * this module exposes a write operation, and that is intentional — upstream
 * clones are read-only inputs.
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

import type { AdapterContext, UpstreamManifestEntry } from './types.js';

export class PathEscapeError extends Error {
  constructor(attempted: string, root: string) {
    super(`Adapter attempted to read outside its upstream clone: ${attempted} (root ${root})`);
    this.name = 'PathEscapeError';
  }
}

function assertContained(root: string, candidate: string, original: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new PathEscapeError(original, resolvedRoot);
  }
  return resolved;
}

export interface AdapterContextOptions {
  readonly entry: UpstreamManifestEntry;
  /** Absolute path to the clone, or `null` when it is not on disk. */
  readonly repoPath: string | null;
  readonly logger?: (message: string) => void;
}

export function createAdapterContext(options: AdapterContextOptions): AdapterContext {
  const { entry, repoPath } = options;
  const log = options.logger ?? (() => {});

  const requireRepo = (operation: string): string => {
    if (!repoPath) {
      throw new Error(
        `Upstream ${entry.name} is not on disk; cannot ${operation}. ` +
          'Run the upstream fetch step first.',
      );
    }
    return repoPath;
  };

  return {
    upstream: entry,
    repoPath,
    log,
    async readFile(relativePath: string): Promise<string> {
      const root = requireRepo(`read ${relativePath}`);
      const target = assertContained(root, path.join(root, relativePath), relativePath);
      return readFile(target, 'utf8');
    },
    async listFiles(relativeDir = '.'): Promise<string[]> {
      const root = requireRepo(`list ${relativeDir}`);
      const start = assertContained(root, path.join(root, relativeDir), relativeDir);
      const out: string[] = [];
      const walk = async (dir: string): Promise<void> => {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const dirent of entries) {
          if (dirent.name === '.git') continue;
          const full = path.join(dir, dirent.name);
          if (dirent.isDirectory()) {
            await walk(full);
          } else if (dirent.isFile()) {
            out.push(path.relative(root, full).split(path.sep).join('/'));
          }
        }
      };
      if (existsSync(start)) await walk(start);
      return out.sort();
    },
  };
}
