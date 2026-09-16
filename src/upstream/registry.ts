/**
 * The adapter registry.
 *
 * This is the extension point the project brief cares about most: adding a new
 * humanizer project must mean registering one more adapter here, and nothing
 * else in the core changes.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import type {
  AdapterContext,
  IntegrationKind,
  UpstreamAdapter,
  UpstreamManifest,
  UpstreamManifestEntry,
} from './types.js';
import { resolveProjectRoot } from './manifest.js';
import { createAdapterContext } from './workspace.js';

export class AdapterRegistry {
  readonly #adapters = new Map<string, UpstreamAdapter>();

  constructor(adapters: readonly UpstreamAdapter[] = []) {
    for (const adapter of adapters) this.register(adapter);
  }

  register(adapter: UpstreamAdapter): void {
    if (this.#adapters.has(adapter.id)) {
      throw new Error(`Duplicate upstream adapter id ${JSON.stringify(adapter.id)}`);
    }
    this.#adapters.set(adapter.id, adapter);
  }

  has(id: string): boolean {
    return this.#adapters.has(id);
  }

  get(id: string): UpstreamAdapter | undefined {
    return this.#adapters.get(id);
  }

  list(): UpstreamAdapter[] {
    return [...this.#adapters.values()];
  }

  byIntegration(kind: IntegrationKind): UpstreamAdapter[] {
    return this.list().filter((adapter) => adapter.integration === kind);
  }

  /** Adapters whose upstream has a clone on disk and can therefore do work. */
  available(projectRoot: string = resolveProjectRoot(), cacheDir = '.upstream-cache'): UpstreamAdapter[] {
    const cache = path.resolve(projectRoot, cacheDir);
    return this.list().filter((adapter) => existsSync(path.join(cache, adapter.id)));
  }

  /**
   * Cross-check the registry against the manifest. A mismatch means provenance
   * and capability have drifted apart, which the suite must never allow
   * silently.
   */
  audit(manifest: UpstreamManifest): {
    readonly missingAdapters: readonly string[];
    readonly orphanAdapters: readonly string[];
    readonly repositoryMismatch: ReadonlyArray<{
      readonly id: string;
      readonly manifestRepository: string;
      readonly adapterRepository: string;
    }>;
  } {
    const manifestNames = new Set(manifest.upstreams.map((entry) => entry.name));
    const adapterIds = new Set(this.#adapters.keys());

    const missingAdapters = [...manifestNames].filter((name) => !adapterIds.has(name)).sort();
    const orphanAdapters = [...adapterIds].filter((id) => !manifestNames.has(id)).sort();

    const repositoryMismatch: Array<{
      id: string;
      manifestRepository: string;
      adapterRepository: string;
    }> = [];
    for (const entry of manifest.upstreams) {
      const adapter = this.#adapters.get(entry.name);
      if (adapter && adapter.upstream !== entry.repository) {
        repositoryMismatch.push({
          id: entry.name,
          manifestRepository: entry.repository,
          adapterRepository: adapter.upstream,
        });
      }
    }

    return { missingAdapters, orphanAdapters, repositoryMismatch };
  }

  contextFor(
    entry: UpstreamManifestEntry,
    projectRoot: string = resolveProjectRoot(),
    cacheDir = '.upstream-cache',
    logger?: (message: string) => void,
  ): AdapterContext {
    const repoPath = path.resolve(projectRoot, cacheDir, entry.name);
    return createAdapterContext({
      entry,
      repoPath: existsSync(repoPath) ? repoPath : null,
      ...(logger ? { logger } : {}),
    });
  }
}
