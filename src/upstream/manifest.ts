/**
 * Loading and validating `upstreams/manifest.json`.
 *
 * The manifest is the answer to "where did this capability come from". It is
 * validated strictly, because a manifest with a missing commit or a missing
 * licence silently destroys the project's provenance guarantees.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { UpstreamManifest, UpstreamManifestEntry } from './types.js';
import { UPSTREAM_MANIFEST_SCHEMA_VERSION } from './types.js';

/** Repository root, derived from this file's location in `src/` or `dist/`. */
export function resolveProjectRoot(): string {
  const override = process.env['HVS_PROJECT_ROOT'];
  if (override && override.length > 0) return path.resolve(override);
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

/**
 * Resolve a *generated* data file: under `src/` in a checkout, under `dist/` in an
 * installed package.
 *
 * `relativePath` is relative to `src/`, because `dist/` **replaces** `src/` rather
 * than sitting beside it — `src/upstream/adapters/x/rules.generated.json` and
 * `dist/upstream/adapters/x/rules.generated.json`. Getting that wrong is the one
 * mistake here that fails silently: a resolver looking for `dist/src/...` finds
 * nothing, the registry keeps only the rules this project wrote itself, and every
 * scan comes back clean. A packaged install was checked against exactly that,
 * which is how the first version of this function was caught.
 *
 * Falls back to the checkout path when neither exists, so an error message names a
 * location a developer recognises.
 */
export function resolveDataFile(
  relativePath: string,
  projectRoot: string = resolveProjectRoot(),
): string {
  const candidates = dataFileCandidates(relativePath, projectRoot);
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!;
}

/** The candidate paths `resolveDataFile` tries, in order. Exported for the tests. */
export function dataFileCandidates(relativePath: string, projectRoot: string): string[] {
  return [
    path.join(projectRoot, 'src', relativePath),
    path.join(projectRoot, 'dist', relativePath),
  ];
}

/**
 * The upstream manifest.
 *
 * It lives at the package root, not under `src/`, so it does not go through
 * `resolveDataFile`: the root copy is the source of truth in a checkout and the
 * `dist/` copy is what an installed package has, and the order says so.
 */
export function manifestPath(projectRoot: string = resolveProjectRoot()): string {
  const candidates = [
    path.join(projectRoot, 'upstreams', 'manifest.json'),
    path.join(projectRoot, 'dist', 'upstreams', 'manifest.json'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!;
}

/**
 * The clone URL for an upstream.
 *
 * `git ls-remote` and `git fetch` need a URL or a path, not the `owner/repo`
 * shorthand the manifest uses for readability. Passing the shorthand straight
 * through makes git treat it as a local directory and fail, which surfaces as a
 * silent "remote unknown" rather than an error — so this conversion is done in
 * exactly one place.
 */
export function repositoryUrl(entry: Pick<UpstreamManifestEntry, 'repository' | 'url'>): string {
  if (entry.url && entry.url.length > 0) return entry.url;
  return `https://github.com/${entry.repository}.git`;
}

export class ManifestValidationError extends Error {
  readonly problems: readonly string[];
  constructor(problems: readonly string[]) {
    super(`Invalid upstream manifest:\n- ${problems.join('\n- ')}`);
    this.name = 'ManifestValidationError';
    this.problems = problems;
  }
}

const REQUIRED_STRING_FIELDS = [
  'name',
  'repository',
  'license',
  'version',
  'commit',
  'last_sync',
] as const;

const REQUIRED_ARRAY_FIELDS = ['role', 'derived_from'] as const;

const VALID_INTEGRATION = new Set([
  'executable-detector',
  'markdown-skill',
  'voice-profile',
  'methodology',
  'research-only',
]);

export function validateManifest(raw: unknown): string[] {
  const problems: string[] = [];
  if (typeof raw !== 'object' || raw === null) {
    return ['manifest root must be an object'];
  }
  const manifest = raw as Partial<UpstreamManifest>;

  if (manifest.schemaVersion !== UPSTREAM_MANIFEST_SCHEMA_VERSION) {
    problems.push(
      `schemaVersion must be ${JSON.stringify(UPSTREAM_MANIFEST_SCHEMA_VERSION)}, got ${JSON.stringify(manifest.schemaVersion)}`,
    );
  }
  if (typeof manifest.cacheDir !== 'string' || manifest.cacheDir.length === 0) {
    problems.push('cacheDir must be a non-empty string');
  }
  if (!Array.isArray(manifest.upstreams) || manifest.upstreams.length === 0) {
    problems.push('upstreams must be a non-empty array');
    return problems;
  }

  const names = new Set<string>();
  const repositories = new Set<string>();

  manifest.upstreams.forEach((entry, index) => {
    const where = `upstreams[${index}]`;
    if (typeof entry !== 'object' || entry === null) {
      problems.push(`${where} must be an object`);
      return;
    }
    const record = entry as unknown as Record<string, unknown>;

    for (const field of REQUIRED_STRING_FIELDS) {
      const value = record[field];
      if (typeof value !== 'string' || value.length === 0) {
        problems.push(`${where}.${field} is required and must be a non-empty string`);
      }
    }
    for (const field of REQUIRED_ARRAY_FIELDS) {
      const value = record[field];
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        problems.push(`${where}.${field} is required and must be an array of strings`);
      }
    }

    const name = record['name'];
    if (typeof name === 'string') {
      if (names.has(name)) problems.push(`${where}.name ${JSON.stringify(name)} is duplicated`);
      names.add(name);
    }

    const repository = record['repository'];
    if (typeof repository === 'string' && repository.length > 0) {
      if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
        problems.push(`${where}.repository must be "owner/repo", got ${JSON.stringify(repository)}`);
      }
      if (repositories.has(repository)) {
        problems.push(`${where}.repository ${JSON.stringify(repository)} is duplicated`);
      }
      repositories.add(repository);
    }

    const commit = record['commit'];
    if (typeof commit === 'string' && commit.length > 0 && !/^[0-9a-f]{40}$/.test(commit)) {
      problems.push(`${where}.commit must be a full 40-character lowercase SHA`);
    }

    const lastSync = record['last_sync'];
    if (typeof lastSync === 'string' && lastSync.length > 0 && Number.isNaN(Date.parse(lastSync))) {
      problems.push(`${where}.last_sync must be an ISO date, got ${JSON.stringify(lastSync)}`);
    }

    const license = record['license'];
    if (typeof license === 'string' && license.length === 0) {
      problems.push(`${where}.license must be an SPDX identifier`);
    }

    const integration = record['integration'];
    if (integration !== undefined) {
      if (typeof integration !== 'string' || !VALID_INTEGRATION.has(integration)) {
        problems.push(
          `${where}.integration must be one of ${[...VALID_INTEGRATION].join(', ')}`,
        );
      }
    }
  });

  // derived_from must reference a sibling that actually exists, otherwise the
  // lineage graph is a lie.
  manifest.upstreams.forEach((entry, index) => {
    const record = entry as unknown as Record<string, unknown>;
    const derived = record['derived_from'];
    if (!Array.isArray(derived)) return;
    for (const parent of derived) {
      if (typeof parent !== 'string') continue;
      if (!names.has(parent)) {
        problems.push(
          `upstreams[${index}].derived_from references unknown upstream ${JSON.stringify(parent)}`,
        );
      }
      if (parent === record['name']) {
        problems.push(`upstreams[${index}].derived_from cannot reference itself`);
      }
    }
  });

  return problems;
}

export async function loadManifest(
  projectRoot: string = resolveProjectRoot(),
): Promise<UpstreamManifest> {
  const file = manifestPath(projectRoot);
  if (!existsSync(file)) {
    throw new Error(`Upstream manifest not found at ${file}`);
  }
  const raw: unknown = JSON.parse(await readFile(file, 'utf8'));
  const problems = validateManifest(raw);
  if (problems.length > 0) throw new ManifestValidationError(problems);
  return raw as UpstreamManifest;
}

/** Convenience: manifest entries keyed by `name`. */
export function indexByName(
  manifest: UpstreamManifest,
): Map<string, UpstreamManifestEntry> {
  return new Map(manifest.upstreams.map((entry) => [entry.name, entry]));
}

/** Entries that must be wired in for real, as opposed to merely investigated. */
export function trackedUpstreams(manifest: UpstreamManifest): UpstreamManifestEntry[] {
  return manifest.upstreams.filter((entry) => entry.tracked !== false);
}

/**
 * Resolve the lineage of an upstream to the roots it descends from. Used to
 * stop same-lineage repositories being counted as independent discoveries.
 */
export function lineageRoots(
  name: string,
  byName: Map<string, UpstreamManifestEntry>,
): string[] {
  const roots = new Set<string>();
  const seen = new Set<string>();
  const walk = (current: string): void => {
    if (seen.has(current)) return;
    seen.add(current);
    const entry = byName.get(current);
    if (!entry || entry.derived_from.length === 0) {
      roots.add(current);
      return;
    }
    for (const parent of entry.derived_from) walk(parent);
  };
  walk(name);
  return [...roots].sort();
}
