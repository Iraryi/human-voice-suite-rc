/**
 * The upstream manifest is the project's provenance backbone. If it is wrong,
 * every claim the suite makes about where a rule came from is wrong too.
 *
 * The commit check below is not decoration: it is the test that catches a
 * hand-written or mis-copied SHA before it becomes a permanent provenance lie.
 */

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  ManifestValidationError,
  indexByName,
  lineageRoots,
  loadManifest,
  resolveProjectRoot,
  trackedUpstreams,
  validateManifest,
} from '../src/upstream/manifest.js';
import type { UpstreamManifest } from '../src/upstream/types.js';

const projectRoot = resolveProjectRoot();
const cacheRoot = path.join(projectRoot, '.upstream-cache');
const clonesPresent = existsSync(cacheRoot);

let manifest: UpstreamManifest;

beforeAll(async () => {
  manifest = await loadManifest(projectRoot);
});

describe('manifest shape', () => {
  it('loads and validates against the shipped schema version', () => {
    expect(manifest.schemaVersion).toBe('1.0.0');
    expect(manifest.cacheDir).toBe('.upstream-cache');
    expect(manifest.upstreams.length).toBe(8);
  });

  it('gives every upstream the eight required fields, non-empty', () => {
    for (const entry of manifest.upstreams) {
      expect(entry.name).toBeTruthy();
      expect(entry.repository).toMatch(/^[^/\s]+\/[^/\s]+$/);
      expect(entry.license).toBeTruthy();
      expect(entry.version).toBeTruthy();
      expect(entry.commit).toMatch(/^[0-9a-f]{40}$/);
      expect(Array.isArray(entry.role)).toBe(true);
      expect(Array.isArray(entry.derived_from)).toBe(true);
      expect(Number.isNaN(Date.parse(entry.last_sync))).toBe(false);
    }
  });

  it('has no duplicate names or repositories', () => {
    expect(new Set(manifest.upstreams.map((u) => u.name)).size).toBe(manifest.upstreams.length);
    expect(new Set(manifest.upstreams.map((u) => u.repository)).size).toBe(
      manifest.upstreams.length,
    );
  });

  it('records a copyright holder and a licence file for every upstream', () => {
    for (const entry of manifest.upstreams) {
      expect(entry.copyright_holder).toMatch(/^Copyright \(c\)/);
      expect(entry.license_file).toMatch(/^licenses\//);
    }
  });

  it('only ever marks the two barred upstreams as untracked', () => {
    const untracked = manifest.upstreams.filter((u) => u.tracked === false).map((u) => u.name);
    expect(untracked.sort()).toEqual(['op7418-humanizer-zh', 'stop-slop']);
  });

  it('marks the notice-defective upstream as research only', () => {
    const entry = indexByName(manifest).get('op7418-humanizer-zh')!;
    expect(entry.integration).toBe('research-only');
    expect(entry.derived_from).toEqual(['blader-humanizer']);
  });

  it('enumerates the import exclusions on the upstream with inherited content', () => {
    const entry = indexByName(manifest).get('ai-humanizer')!;
    expect(entry.integration).toBe('executable-detector');
    expect(entry.derived_from).toEqual(['stop-slop']);
    expect(entry.import_exclusions?.length ?? 0).toBeGreaterThanOrEqual(5);
    for (const exclusion of entry.import_exclusions ?? []) {
      expect(exclusion.what).toBeTruthy();
      expect(exclusion.reason).toBeTruthy();
    }
  });
});

describe('lineage', () => {
  it('resolves every declared derivative to the common ancestor', () => {
    const byName = indexByName(manifest);
    expect(lineageRoots('humanizer-zh-cn', byName)).toEqual(['blader-humanizer']);
    expect(lineageRoots('op7418-humanizer-zh', byName)).toEqual(['blader-humanizer']);
    expect(lineageRoots('ai-humanizer', byName)).toEqual(['stop-slop']);
    expect(lineageRoots('blader-humanizer', byName)).toEqual(['blader-humanizer']);
  });

  it('treats the Chinese siblings as one lineage, not two discoveries', () => {
    const byName = indexByName(manifest);
    const roots = lineageRoots('humanizer-zh-cn', byName);
    expect(roots).toEqual(lineageRoots('op7418-humanizer-zh', byName));
  });
});

describe('manifest validation', () => {
  it('rejects a missing required field', () => {
    const broken = structuredClone(manifest) as unknown as Record<string, unknown>;
    const list = broken['upstreams'] as Array<Record<string, unknown>>;
    delete list[0]!['license'];
    const problems = validateManifest(broken);
    expect(problems.some((p) => p.includes('license'))).toBe(true);
  });

  it('rejects a short commit sha', () => {
    const broken = structuredClone(manifest) as unknown as Record<string, unknown>;
    const list = broken['upstreams'] as Array<Record<string, unknown>>;
    list[0]!['commit'] = '9862685f57';
    expect(validateManifest(broken).some((p) => p.includes('40-character'))).toBe(true);
  });

  it('rejects a derived_from that points at a nonexistent sibling', () => {
    const broken = structuredClone(manifest) as unknown as Record<string, unknown>;
    const list = broken['upstreams'] as Array<Record<string, unknown>>;
    list[0]!['derived_from'] = ['nobody/nothing'];
    expect(validateManifest(broken).some((p) => p.includes('unknown upstream'))).toBe(true);
  });

  it('rejects self-referential lineage', () => {
    const broken = structuredClone(manifest) as unknown as Record<string, unknown>;
    const list = broken['upstreams'] as Array<Record<string, unknown>>;
    list[0]!['derived_from'] = [list[0]!['name']];
    expect(validateManifest(broken).some((p) => p.includes('cannot reference itself'))).toBe(true);
  });

  it('rejects an unknown integration kind', () => {
    const broken = structuredClone(manifest) as unknown as Record<string, unknown>;
    const list = broken['upstreams'] as Array<Record<string, unknown>>;
    list[0]!['integration'] = 'copy-paste-everything';
    expect(validateManifest(broken).some((p) => p.includes('integration'))).toBe(true);
  });

  it('throws a ManifestValidationError carrying every problem', () => {
    const problems = ['a', 'b'];
    const error = new ManifestValidationError(problems);
    expect(error.problems).toEqual(problems);
    expect(error.message).toContain('- a');
  });
});

describe('tracked subset', () => {
  it('separates the upstreams that must be wired in from those under investigation', () => {
    const tracked = trackedUpstreams(manifest).map((u) => u.name);
    expect(tracked).toContain('blader-humanizer');
    expect(tracked).toContain('dsh-humanizer');
    expect(tracked).toContain('humanize-text');
    expect(tracked).not.toContain('stop-slop');
    expect(tracked.length).toBe(6);
  });
});

/**
 * Only meaningful where the upstream clones exist. On a fresh checkout of this
 * repository the cache is empty and these are skipped rather than failed.
 */
describe.skipIf(!clonesPresent)('pinned commits match the clones on disk', () => {
  it('has a clone for every manifest entry', () => {
    for (const entry of manifest.upstreams) {
      expect(existsSync(path.join(cacheRoot, entry.name)), `missing clone: ${entry.name}`).toBe(true);
    }
  });

  it('records the commit the clone is actually at', () => {
    const mismatches: string[] = [];
    for (const entry of manifest.upstreams) {
      const repoPath = path.join(cacheRoot, entry.name);
      if (!existsSync(repoPath)) continue;
      const head = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: repoPath,
        encoding: 'utf8',
      }).trim();
      if (head !== entry.commit) {
        mismatches.push(`${entry.name}: manifest ${entry.commit} but clone at ${head}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('records the branch the clone is actually on', () => {
    for (const entry of manifest.upstreams) {
      const repoPath = path.join(cacheRoot, entry.name);
      if (!existsSync(repoPath)) continue;
      const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: repoPath,
        encoding: 'utf8',
      }).trim();
      expect(branch).toBe(entry.default_branch);
    }
  });

  it('never modified an upstream working tree', () => {
    for (const entry of manifest.upstreams) {
      const repoPath = path.join(cacheRoot, entry.name);
      if (!existsSync(repoPath)) continue;
      const status = execFileSync('git', ['status', '--porcelain'], {
        cwd: repoPath,
        encoding: 'utf8',
      }).trim();
      expect(status, `${entry.name} has local modifications`).toBe('');
    }
  });
});
