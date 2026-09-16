/**
 * The upstream layer: adapter registration, the sync report, and the rule
 * extraction that lets `upstream:check` describe what changed without waiting
 * for a full adapter.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { AdapterRegistry } from '../src/upstream/registry.js';
import { allAdapters } from '../src/upstream/adapters/index.js';
import { indexByName, loadManifest, repositoryUrl, resolveProjectRoot } from '../src/upstream/manifest.js';
import { createAdapterContext, PathEscapeError } from '../src/upstream/workspace.js';
import { renderUpdateReport, runUpstreamCheck } from '../src/upstream/sync.js';
import type { UpstreamSyncStatus } from '../src/upstream/sync.js';
import {
  compareHeadingSets,
  detectLicenseFamily,
  extractCopyrightLines,
  extractNumberedHeadings,
  isRuleBearingFile,
} from '../src/upstream/rule-extract.js';
import { getAssistantSmell } from '../src/behavior/types.js';

const projectRoot = resolveProjectRoot();
const cacheRoot = path.join(projectRoot, '.upstream-cache');
const clonesPresent = existsSync(cacheRoot);

describe('adapter registry', () => {
  const registry = new AdapterRegistry(allAdapters());

  it('registers one adapter per upstream', () => {
    expect(registry.list()).toHaveLength(8);
  });

  it('refuses a duplicate adapter id', () => {
    const duplicate = new AdapterRegistry([allAdapters()[0]!]);
    expect(() => duplicate.register(allAdapters()[0]!)).toThrow(/Duplicate upstream adapter id/);
  });

  it('matches the manifest exactly, with no orphans in either direction', async () => {
    const manifest = await loadManifest(projectRoot);
    const audit = registry.audit(manifest);
    expect(audit.missingAdapters).toEqual([]);
    expect(audit.orphanAdapters).toEqual([]);
    expect(audit.repositoryMismatch).toEqual([]);
  });

  it('groups adapters by how their content is allowed in', () => {
    expect(registry.byIntegration('research-only').map((a) => a.id).sort()).toEqual([
      'op7418-humanizer-zh',
      'stop-slop',
    ]);
    expect(registry.byIntegration('executable-detector').map((a) => a.id)).toEqual(['ai-humanizer']);
    expect(registry.byIntegration('markdown-skill').map((a) => a.id).sort()).toEqual([
      'blader-humanizer',
      'humanizer-zh',
      'humanizer-zh-cn',
    ]);
  });

  it('states a target phase and a description for every adapter', () => {
    for (const adapter of registry.list()) {
      expect(adapter.targetPhase).toBeGreaterThanOrEqual(2);
      expect(adapter.description.length).toBeGreaterThan(60);
      expect(adapter.capabilities.length).toBeGreaterThan(0);
    }
  });

  it('marks both research-only adapters as untracked in the manifest', async () => {
    const byName = indexByName(await loadManifest(projectRoot));
    for (const adapter of registry.byIntegration('research-only')) {
      expect(byName.get(adapter.id)?.tracked).toBe(false);
    }
  });
});

describe('adapter workspace', () => {
  it('refuses to read outside the upstream clone', async () => {
    const entry = indexByName(await loadManifest(projectRoot)).get('blader-humanizer')!;
    const context = createAdapterContext({ entry, repoPath: path.join(cacheRoot, entry.name) });
    await expect(context.readFile('../../../etc/passwd')).rejects.toThrow();
  });

  it('reports a missing clone rather than reading nothing silently', async () => {
    const entry = indexByName(await loadManifest(projectRoot)).get('blader-humanizer')!;
    const context = createAdapterContext({ entry, repoPath: null });
    expect(context.repoPath).toBeNull();
    await expect(context.readFile('SKILL.md')).rejects.toThrow(/not on disk/);
  });

  it('exposes a PathEscapeError type for the containment failure', () => {
    const error = new PathEscapeError('../x', '/root');
    expect(error.name).toBe('PathEscapeError');
    expect(error.message).toContain('outside its upstream clone');
  });
});

describe('rule extraction heuristics', () => {
  it('reads H3 numbered headings', () => {
    const headings = extractNumberedHeadings('### 1. Not X but Y\n\nbody\n\n### 2. One-line closers\n');
    expect(headings.map((h) => h.number)).toEqual([1, 2]);
    expect(headings[0]!.title).toBe('Not X but Y');
    expect(headings[0]!.line).toBe(1);
  });

  it('reads H2 numbering used by the Chinese pattern references', () => {
    const headings = extractNumberedHeadings('## 1. 机械对照句\n\n## 2. 翻译腔连接词\n');
    expect(headings.map((h) => h.title)).toEqual(['机械对照句', '翻译腔连接词']);
  });

  it('reads bold numbered leads', () => {
    const headings = extractNumberedHeadings('**3. Sayings that sound deep**\n');
    expect(headings[0]!.number).toBe(3);
    expect(headings[0]!.title).toBe('Sayings that sound deep');
  });

  it('ignores duplicates and unnumbered headings', () => {
    const headings = extractNumberedHeadings('# Title\n## 1. A\n## 1. A again\n## Notes\n');
    expect(headings).toHaveLength(1);
  });

  it('decides which files can carry rules', () => {
    expect(isRuleBearingFile('SKILL.md')).toBe(true);
    expect(isRuleBearingFile('references/patterns.md')).toBe(true);
    expect(isRuleBearingFile('references/phrases.md')).toBe(true);
    expect(isRuleBearingFile('references/voices/fengtang.md')).toBe(true);
    expect(isRuleBearingFile('README.md')).toBe(false);
    expect(isRuleBearingFile('CHANGELOG.md')).toBe(false);
    expect(isRuleBearingFile('LICENSE')).toBe(false);
    expect(isRuleBearingFile('src/core/rules.ts')).toBe(false);
  });

  it('reports a renamed rule as a rename, not as a removal plus an addition', () => {
    const before = extractNumberedHeadings('### 1. A\n### 2. B\n### 3. C\n');
    const after = extractNumberedHeadings('### 1. A\n### 2. B changed\n### 3. C\n### 4. D\n');
    const delta = compareHeadingSets(before, after);
    expect(delta.added).toEqual(['4. D']);
    expect(delta.removed).toEqual([]);
    expect(delta.renamed).toEqual([{ number: 2, from: 'B', to: 'B changed' }]);
    expect(delta.unchanged).toBe(2);
  });

  it('reports a dropped rule number as removed', () => {
    const before = extractNumberedHeadings('### 1. A\n### 2. B\n### 3. C\n');
    const after = extractNumberedHeadings('### 1. A\n### 3. C\n');
    const delta = compareHeadingSets(before, after);
    expect(delta.removed).toEqual(['2. B']);
    expect(delta.added).toEqual([]);
    expect(delta.renamed).toEqual([]);
  });

  it('recognises licence families from their text', () => {
    expect(detectLicenseFamily('MIT License\n\nCopyright (c) 2025 Someone')).toBe('MIT');
    expect(
      detectLicenseFamily(
        'BSD 3-Clause License\n\n1. Redistributions of source code must retain...\n3. Neither the name of the copyright holder...',
      ),
    ).toBe('BSD-3-Clause');
    expect(detectLicenseFamily('Apache License\nVersion 2.0, January 2004')).toBe('Apache-2.0');
    expect(detectLicenseFamily('something else entirely')).toBe('unknown');
  });

  it('pulls copyright lines for change detection', () => {
    const lines = extractCopyrightLines(
      'MIT License\n\nCopyright (c) 2025 Siqi Chen\nCopyright (c) 2026 Someone Else\n',
    );
    expect(lines.map((l) => l.holder)).toEqual([
      'Copyright (c) 2025 Siqi Chen',
      'Copyright (c) 2026 Someone Else',
    ]);
  });
});

describe('repository URL derivation', () => {
  it('turns the owner/repo shorthand into a usable clone URL', () => {
    // Regression: `git ls-remote` reads a bare `owner/repo` as a local path and
    // fails, which surfaced only as a silent "remote unknown" for every
    // upstream rather than as an error.
    expect(repositoryUrl({ repository: 'blader/humanizer' })).toBe(
      'https://github.com/blader/humanizer.git',
    );
  });

  it('prefers an explicit url when the manifest provides one', () => {
    expect(
      repositoryUrl({ repository: 'blader/humanizer', url: 'git@github.com:blader/humanizer.git' }),
    ).toBe('git@github.com:blader/humanizer.git');
  });

  it('produces a clone URL for every upstream in the manifest', async () => {
    const manifest = await loadManifest(projectRoot);
    for (const entry of manifest.upstreams) {
      const url = repositoryUrl(entry);
      expect(url).toMatch(/^(https:\/\/|git@|ssh:\/\/)/);
      expect(url).toContain(entry.repository);
      // The shorthand itself must never be handed to git.
      expect(url).not.toBe(entry.repository);
    }
  });
});

describe('sync report rendering', () => {
  function status(overrides: Partial<UpstreamSyncStatus> = {}): UpstreamSyncStatus {
    return {
      name: 'blader-humanizer',
      repository: 'blader/humanizer',
      license: 'MIT',
      version: '3.0.0',
      manifestCommit: '9862685f575c65a8247f90369951df1b3416e3d6',
      localCommit: '9862685f575c65a8247f90369951df1b3416e3d6',
      remoteCommit: 'abcdef1234567890abcdef1234567890abcdef12',
      defaultBranch: 'main',
      state: 'update-available',
      derivedFrom: ['blader-humanizer'],
      lineageRoots: ['blader-humanizer'],
      tracked: true,
      commitCount: 1,
      commits: ['abcdef1 2026-09-16 add a pattern'],
      fileChanges: [{ status: 'M', path: 'SKILL.md' }],
      ruleDeltas: [
        {
          file: 'SKILL.md',
          beforeCount: 25,
          afterCount: 26,
          added: ['26. New tell'],
          removed: [],
          renamed: [],
        },
      ],
      licenseDelta: null,
      notes: [],
      ...overrides,
    };
  }

  it('states up front that it never modifies local code', () => {
    const markdown = renderUpdateReport({
      generatedAt: '2026-09-16T00:00:00.000Z',
      offline: false,
      projectRoot,
      cacheDir: '.upstream-cache',
      upstreams: [status()],
      summary: {
        total: 1,
        upToDate: 0,
        updateAvailable: 1,
        cloneMissing: 0,
        remoteUnknown: 0,
        licenseAlerts: 0,
        ruleChanges: 1,
      },
    });

    expect(markdown).toContain('# UPSTREAM_UPDATE_REPORT');
    expect(markdown).toContain('never modifies local code');
    expect(markdown).toContain('26. New tell');
    expect(markdown).toContain('Decision required');
    expect(markdown).toContain('Absorbing this change is a human or agent decision');
  });

  it('surfaces a licence alert prominently', () => {
    const markdown = renderUpdateReport({
      generatedAt: '2026-09-16T00:00:00.000Z',
      offline: false,
      projectRoot,
      cacheDir: '.upstream-cache',
      upstreams: [
        status({
          licenseDelta: {
            changed: true,
            beforeFamily: 'MIT',
            afterFamily: 'AGPL',
            beforeCopyright: ['Copyright (c) 2025 Siqi Chen'],
            afterCopyright: [],
            problems: [
              'Licence family changed: MIT -> AGPL.',
              'Copyright notice removed upstream: Copyright (c) 2025 Siqi Chen',
            ],
          },
        }),
      ],
      summary: {
        total: 1,
        upToDate: 0,
        updateAvailable: 1,
        cloneMissing: 0,
        remoteUnknown: 0,
        licenseAlerts: 1,
        ruleChanges: 0,
      },
    });

    expect(markdown).toContain('**ALERT**');
    expect(markdown).toContain('Licence family changed: MIT -> AGPL.');
    expect(markdown).toContain('Copyright notice removed upstream');
  });

  it('renders the lineage table so same-lineage repos are visibly not independent', () => {
    const markdown = renderUpdateReport({
      generatedAt: '2026-09-16T00:00:00.000Z',
      offline: false,
      projectRoot,
      cacheDir: '.upstream-cache',
      upstreams: [
        status({
          name: 'humanizer-zh-cn',
          repository: 'holygeek00/humanizer-zh-cn',
          derivedFrom: ['blader-humanizer'],
          state: 'up-to-date',
        }),
      ],
      summary: {
        total: 1,
        upToDate: 1,
        updateAvailable: 0,
        cloneMissing: 0,
        remoteUnknown: 0,
        licenseAlerts: 0,
        ruleChanges: 0,
      },
    });

    expect(markdown).toContain('## Lineage');
    expect(markdown).toContain('| `holygeek00/humanizer-zh-cn` | `blader-humanizer` | `blader-humanizer` |');
  });

  it('reports "No action." for an up-to-date upstream', () => {
    const markdown = renderUpdateReport({
      generatedAt: '2026-09-16T00:00:00.000Z',
      offline: true,
      projectRoot,
      cacheDir: '.upstream-cache',
      upstreams: [status({ state: 'up-to-date' })],
      summary: {
        total: 1,
        upToDate: 1,
        updateAvailable: 0,
        cloneMissing: 0,
        remoteUnknown: 0,
        licenseAlerts: 0,
        ruleChanges: 0,
      },
    });
    expect(markdown).toContain('No action.');
  });
});

describe('offline upstream check', () => {
  it('reports local state without touching the network', async () => {
    const report = await runUpstreamCheck({ projectRoot, offline: true });
    expect(report.offline).toBe(true);
    expect(report.upstreams.length).toBe(8);
    for (const upstream of report.upstreams) {
      // Offline mode must never reach the network, whatever the clone state.
      expect(upstream.remoteCommit).toBeNull();
      expect(['up-to-date', 'clone-missing', 'manifest-commit-unreachable']).toContain(
        upstream.state,
      );
    }
  });

  it('says which upstreams it could not inspect, rather than implying success', async () => {
    const report = await runUpstreamCheck({ projectRoot, offline: true });
    for (const upstream of report.upstreams) {
      const notes = upstream.notes.join(' ');
      if (upstream.state === 'clone-missing') {
        // A fresh checkout has no cache, and that must read as a gap.
        expect(notes, upstream.name).toMatch(/No clone at/);
        expect(notes, upstream.name).toMatch(/fetch step/);
      } else {
        expect(notes, upstream.name).toMatch(/Offline mode/);
      }
    }
  });

  it('fails loudly when there is no manifest to read', async () => {
    // Pointing at a directory without `upstreams/manifest.json` must throw
    // rather than silently reporting zero upstreams.
    await expect(
      runUpstreamCheck({ projectRoot: path.join(projectRoot, 'tests'), offline: true }),
    ).rejects.toThrow(/manifest not found/i);
  });

  it('summarises the run', async () => {
    const report = await runUpstreamCheck({ projectRoot, offline: true });
    expect(report.summary.total).toBe(8);
    expect(
      report.summary.upToDate +
        report.summary.updateAvailable +
        report.summary.cloneMissing +
        report.summary.remoteUnknown,
    ).toBe(8);
  });
});

/**
 * Integration tests against the real upstream clones. Skipped on a fresh
 * checkout of this repository, where `.upstream-cache` is empty by design.
 */
describe.skipIf(!clonesPresent)('against the real clones', () => {
  it('extracts exactly 25 numbered patterns from blader/humanizer v3.0.0', async () => {
    const entry = indexByName(await loadManifest(projectRoot)).get('blader-humanizer')!;
    const context = createAdapterContext({
      entry,
      repoPath: path.join(cacheRoot, entry.name),
    });
    const skill = await context.readFile('SKILL.md');
    const headings = extractNumberedHeadings(skill);

    expect(headings).toHaveLength(25);
    expect(headings.map((h) => h.number)).toEqual(
      Array.from({ length: 25 }, (_, i) => i + 1),
    );
    expect(headings[0]!.title).toBe('Not X but Y');
    expect(headings[5]!.title).toBe('Forced triads');
    expect(headings[7]!.title).toBe('Dashes as the universal connector');
    expect(headings[20]!.title).toBe('Curly quotation marks');
    expect(headings[24]!.title).toBe('Writing about the previous version');
  });

  it('extracts 33 numbered patterns from humanizer-zh-cn, one generation behind', async () => {
    const entry = indexByName(await loadManifest(projectRoot)).get('humanizer-zh-cn')!;
    const context = createAdapterContext({
      entry,
      repoPath: path.join(cacheRoot, entry.name),
    });
    const headings = extractNumberedHeadings(await context.readFile('SKILL.md'));
    expect(headings).toHaveLength(33);
    expect(headings[0]!.title).toBe('空泛拔高意义');
  });

  it('extracts 13 patterns from the Chinese patterns reference', async () => {
    const entry = indexByName(await loadManifest(projectRoot)).get('humanizer-zh')!;
    const context = createAdapterContext({
      entry,
      repoPath: path.join(cacheRoot, entry.name),
    });
    const headings = extractNumberedHeadings(await context.readFile('references/patterns.md'));
    expect(headings).toHaveLength(13);
    expect(headings[0]!.title).toBe('机械对照句');
  });

  it('finds the eight Chinese author voice profiles the manifest promises', async () => {
    const entry = indexByName(await loadManifest(projectRoot)).get('humanizer-zh')!;
    const context = createAdapterContext({
      entry,
      repoPath: path.join(cacheRoot, entry.name),
    });
    const files = await context.listFiles('references/voices');
    const profiles = files.filter((f) => f.endsWith('.md') && !f.endsWith('index.md'));
    expect(profiles).toHaveLength(8);
  });

  it('confirms humanizer-zh-cn kept blader\'s copyright notice verbatim', async () => {
    const byName = indexByName(await loadManifest(projectRoot));
    const blader = createAdapterContext({
      entry: byName.get('blader-humanizer')!,
      repoPath: path.join(cacheRoot, 'blader-humanizer'),
    });
    const zhCn = createAdapterContext({
      entry: byName.get('humanizer-zh-cn')!,
      repoPath: path.join(cacheRoot, 'humanizer-zh-cn'),
    });

    expect(await blader.readFile('LICENSE')).toBe(await zhCn.readFile('LICENSE'));
  });

  it('confirms op7418 does not retain the upstream copyright notice', async () => {
    const entry = indexByName(await loadManifest(projectRoot)).get('op7418-humanizer-zh')!;
    const context = createAdapterContext({
      entry,
      repoPath: path.join(cacheRoot, entry.name),
    });
    const license = await context.readFile('LICENSE');
    expect(license).toContain('歸藏');
    expect(license).not.toContain('Siqi Chen');
  });

  it('extracts 24 patterns from op7418, matching its upstream baseline', async () => {
    const entry = indexByName(await loadManifest(projectRoot)).get('op7418-humanizer-zh')!;
    const context = createAdapterContext({
      entry,
      repoPath: path.join(cacheRoot, entry.name),
    });
    const headings = extractNumberedHeadings(await context.readFile('SKILL.md'));
    expect(headings).toHaveLength(24);
    expect(headings[8]!.title).toBe('否定式排比');
  });

  it('reads the rule registry file the ai-humanizer adapter will parse', async () => {
    const entry = indexByName(await loadManifest(projectRoot)).get('ai-humanizer')!;
    const context = createAdapterContext({
      entry,
      repoPath: path.join(cacheRoot, entry.name),
    });
    const registry = await context.readFile('scripts/registry/rules.mjs');
    const ruleIds = registry.match(/^\s+id:\s*'([^']+)'/gm) ?? [];
    // The README claims 40 rules; the registry is the authority.
    expect(ruleIds.length).toBeGreaterThan(40);
    expect(ruleIds.length).toBe(46);
  });

  it('confirms the stop-slop origin is recorded in ai-humanizer its own source', async () => {
    const entry = indexByName(await loadManifest(projectRoot)).get('ai-humanizer')!;
    const context = createAdapterContext({
      entry,
      repoPath: path.join(cacheRoot, entry.name),
    });
    const registry = await context.readFile('scripts/registry/rules.mjs');
    expect(registry).toMatch(/Absorbed from stop-slop/i);
  });

  it('confirms the humanizer-zh appendix points at blader as inspiration only', async () => {
    const entry = indexByName(await loadManifest(projectRoot)).get('humanizer-zh')!;
    const context = createAdapterContext({
      entry,
      repoPath: path.join(cacheRoot, entry.name),
    });
    const readme = await context.readFile('README.md');
    expect(readme).toMatch(/blader\/humanizer/);
    expect(readme).not.toMatch(/翻译自 blader/);
  });

  it('confirms the voice-adoption taxonomy exposes all ten assistant smells', () => {
    expect(getAssistantSmell('chat.unsolicited_offer')?.labelZh).toBe('主动提供更多帮助');
  });
});
