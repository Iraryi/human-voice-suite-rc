/**
 * Upstream synchronisation checking.
 *
 * Section 8 of the project brief is explicit about what this must and must not
 * do. It MUST notice that an upstream moved, say which files changed, which
 * rules were added or dropped, and whether the licence changed. It MUST NOT
 * silently overwrite local code. The only artefact it produces is
 * `UPSTREAM_UPDATE_REPORT.md`; absorbing the change stays a human decision.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { UpstreamManifest, UpstreamManifestEntry } from './types.js';
import { indexByName, lineageRoots, loadManifest, repositoryUrl, resolveProjectRoot } from './manifest.js';
import {
  commitLog,
  diffNameStatus,
  fetchRemote,
  hasCommit,
  listTree,
  localHead,
  lsRemoteHead,
  showFile,
} from './git.js';
import type { FileChange } from './git.js';
import {
  compareHeadingSets,
  detectLicenseFamily,
  extractCopyrightLines,
  extractNumberedHeadings,
  isRuleBearingFile,
} from './rule-extract.js';
import type { RenamedHeading } from './rule-extract.js';

export type SyncState =
  | 'up-to-date'
  | 'update-available'
  | 'clone-missing'
  | 'remote-unknown'
  | 'manifest-commit-unreachable';

export interface RuleDelta {
  readonly file: string;
  readonly beforeCount: number;
  readonly afterCount: number;
  readonly added: readonly string[];
  readonly removed: readonly string[];
  /** Same rule number, changed title: reworded or retargeted upstream. */
  readonly renamed: readonly RenamedHeading[];
}

export interface LicenseDelta {
  readonly changed: boolean;
  readonly beforeFamily: string;
  readonly afterFamily: string;
  readonly beforeCopyright: readonly string[];
  readonly afterCopyright: readonly string[];
  readonly problems: readonly string[];
}

export interface UpstreamSyncStatus {
  readonly name: string;
  readonly repository: string;
  readonly license: string;
  readonly version: string;
  readonly manifestCommit: string;
  readonly localCommit: string | null;
  readonly remoteCommit: string | null;
  readonly defaultBranch: string;
  readonly state: SyncState;
  /** Manifest key lineage roots, so same-lineage repos are visibly not independent. */
  readonly derivedFrom: readonly string[];
  readonly lineageRoots: readonly string[];
  readonly integration?: string;
  readonly tracked: boolean;
  readonly commitCount: number;
  readonly commits: readonly string[];
  readonly fileChanges: readonly FileChange[];
  readonly ruleDeltas: readonly RuleDelta[];
  readonly licenseDelta: LicenseDelta | null;
  readonly notes: readonly string[];
}

export interface SyncReport {
  readonly generatedAt: string;
  readonly offline: boolean;
  readonly projectRoot: string;
  readonly cacheDir: string;
  readonly upstreams: readonly UpstreamSyncStatus[];
  readonly summary: {
    readonly total: number;
    readonly upToDate: number;
    readonly updateAvailable: number;
    readonly cloneMissing: number;
    readonly remoteUnknown: number;
    readonly licenseAlerts: number;
    readonly ruleChanges: number;
  };
}

export interface SyncOptions {
  readonly projectRoot?: string;
  /** Skip all network access. Only local clone state is reported. */
  readonly offline?: boolean;
  /** Fetch into the clone so file-level diffs become possible. */
  readonly fetch?: boolean;
  readonly logger?: (message: string) => void;
}

const LICENSE_CANDIDATES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING', 'LICENSE-MIT'];

export async function runUpstreamCheck(options: SyncOptions = {}): Promise<SyncReport> {
  const projectRoot = options.projectRoot ?? resolveProjectRoot();
  const offline = options.offline ?? false;
  const doFetch = options.fetch ?? true;
  const log = options.logger ?? (() => {});

  const manifest: UpstreamManifest = await loadManifest(projectRoot);
  const byName = indexByName(manifest);
  const cacheRoot = path.resolve(projectRoot, manifest.cacheDir);

  const statuses: UpstreamSyncStatus[] = [];
  for (const entry of manifest.upstreams) {
    log(`checking ${entry.repository}`);
    statuses.push(
      await checkOne(entry, {
        repoPath: path.join(cacheRoot, entry.name),
        byName,
        offline,
        fetch: doFetch,
        projectRoot,
        log,
      }),
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    offline,
    projectRoot,
    cacheDir: manifest.cacheDir,
    upstreams: statuses,
    summary: {
      total: statuses.length,
      upToDate: statuses.filter((s) => s.state === 'up-to-date').length,
      updateAvailable: statuses.filter((s) => s.state === 'update-available').length,
      cloneMissing: statuses.filter((s) => s.state === 'clone-missing').length,
      remoteUnknown: statuses.filter((s) => s.state === 'remote-unknown').length,
      licenseAlerts: statuses.filter((s) => (s.licenseDelta?.problems.length ?? 0) > 0).length,
      ruleChanges: statuses.filter((s) => s.ruleDeltas.length > 0).length,
    },
  };
}

interface CheckContext {
  readonly repoPath: string;
  readonly byName: Map<string, UpstreamManifestEntry>;
  readonly offline: boolean;
  readonly fetch: boolean;
  readonly projectRoot: string;
  readonly log: (message: string) => void;
}

async function checkOne(
  entry: UpstreamManifestEntry,
  context: CheckContext,
): Promise<UpstreamSyncStatus> {
  const notes: string[] = [];
  const branch = entry.default_branch ?? 'main';
  const url = repositoryUrl(entry);
  const derivedFrom = entry.derived_from;
  const roots = lineageRoots(entry.name, context.byName);

  if (!existsSync(context.repoPath)) {
    return base(entry, {
      state: 'clone-missing',
      localCommit: null,
      remoteCommit: null,
      branch,
      derivedFrom,
      roots,
      notes: [`No clone at ${context.repoPath}. Run the upstream fetch step.`],
    });
  }

  const local = await localHead(context.repoPath);

  if (context.offline) {
    return base(entry, {
      state: local === entry.commit ? 'up-to-date' : 'manifest-commit-unreachable',
      localCommit: local,
      remoteCommit: null,
      branch,
      derivedFrom,
      roots,
      notes: ['Offline mode: remote state not checked.'],
    });
  }

  let remote = await lsRemoteHead(url, branch);
  if (remote === null && branch !== 'master') {
    const fallback = await lsRemoteHead(url, 'master');
    if (fallback !== null) {
      remote = fallback;
      notes.push(`Default branch appears to be "master", not "${branch}".`);
    }
  }

  if (remote === null) {
    return base(entry, {
      state: 'remote-unknown',
      localCommit: local,
      remoteCommit: null,
      branch,
      derivedFrom,
      roots,
      notes: [
        ...notes,
        `Could not read refs/heads/${branch} from ${url}. ` +
          'Network problem, repository gone, or the URL in the manifest is wrong.',
      ],
    });
  }

  if (remote === entry.commit) {
    return base(entry, {
      state: 'up-to-date',
      localCommit: local,
      remoteCommit: remote,
      branch,
      derivedFrom,
      roots,
      notes: local === entry.commit ? notes : [...notes, 'Clone HEAD differs from the pinned commit.'],
    });
  }

  // The remote moved. Deepen the local clone so we can diff pinned..remote.
  const reachable = await hasCommit(context.repoPath, remote);
  if (!reachable && context.fetch) {
    context.log(`fetching ${entry.repository}`);
    await fetchRemote(context.repoPath, url);
  }

  const canDiff = await hasCommit(context.repoPath, remote);
  const canDiffFrom = await hasCommit(context.repoPath, entry.commit);
  if (!canDiff || !canDiffFrom) {
    notes.push(
      'Pinned or remote commit is not present locally, so file-level and rule-level diffs are unavailable.',
    );
    return base(entry, {
      state: 'update-available',
      localCommit: local,
      remoteCommit: remote,
      branch,
      derivedFrom,
      roots,
      notes,
    });
  }

  const fileChanges = await diffNameStatus(context.repoPath, entry.commit, remote);
  const commits = await commitLog(context.repoPath, entry.commit, remote);
  const ruleDeltas = await computeRuleDeltas(context.repoPath, entry.commit, remote);
  const licenseDelta = await computeLicenseDelta(context.repoPath, entry.commit, remote);

  return base(entry, {
    state: 'update-available',
    localCommit: local,
    remoteCommit: remote,
    branch,
    derivedFrom,
    roots,
    notes,
    fileChanges,
    commits,
    ruleDeltas,
    licenseDelta,
  });
}

interface BaseInput {
  readonly state: SyncState;
  readonly localCommit: string | null;
  readonly remoteCommit: string | null;
  readonly branch: string;
  readonly derivedFrom: readonly string[];
  readonly roots: readonly string[];
  readonly notes: readonly string[];
  readonly fileChanges?: readonly FileChange[];
  readonly commits?: readonly string[];
  readonly ruleDeltas?: readonly RuleDelta[];
  readonly licenseDelta?: LicenseDelta | null;
}

function base(entry: UpstreamManifestEntry, input: BaseInput): UpstreamSyncStatus {
  return {
    name: entry.name,
    repository: entry.repository,
    license: entry.license,
    version: entry.version,
    manifestCommit: entry.commit,
    localCommit: input.localCommit,
    remoteCommit: input.remoteCommit,
    defaultBranch: input.branch,
    state: input.state,
    derivedFrom: input.derivedFrom,
    lineageRoots: input.roots,
    ...(entry.integration ? { integration: entry.integration } : {}),
    tracked: entry.tracked !== false,
    commitCount: input.commits?.length ?? 0,
    commits: input.commits ?? [],
    fileChanges: input.fileChanges ?? [],
    ruleDeltas: input.ruleDeltas ?? [],
    licenseDelta: input.licenseDelta ?? null,
    notes: input.notes,
  };
}

async function computeRuleDeltas(
  repoPath: string,
  fromRef: string,
  toRef: string,
): Promise<RuleDelta[]> {
  const [fromTree, toTree] = await Promise.all([
    listTree(repoPath, fromRef),
    listTree(repoPath, toRef),
  ]);
  const candidates = [...new Set([...fromTree, ...toTree])].filter(isRuleBearingFile);

  const deltas: RuleDelta[] = [];
  for (const file of candidates) {
    const [beforeText, afterText] = await Promise.all([
      showFile(repoPath, fromRef, file),
      showFile(repoPath, toRef, file),
    ]);
    const before = beforeText === null ? [] : extractNumberedHeadings(beforeText);
    const after = afterText === null ? [] : extractNumberedHeadings(afterText);
    const delta = compareHeadingSets(before, after);
    if (delta.added.length === 0 && delta.removed.length === 0 && delta.renamed.length === 0) {
      continue;
    }
    deltas.push({
      file,
      beforeCount: before.length,
      afterCount: after.length,
      added: delta.added,
      removed: delta.removed,
      renamed: delta.renamed,
    });
  }
  return deltas;
}

async function computeLicenseDelta(
  repoPath: string,
  fromRef: string,
  toRef: string,
): Promise<LicenseDelta | null> {
  const [fromTree, toTree] = await Promise.all([
    listTree(repoPath, fromRef),
    listTree(repoPath, toRef),
  ]);
  const files = [...new Set([...fromTree, ...toTree])].filter((file) =>
    LICENSE_CANDIDATES.includes((file.split('/').pop() ?? '').toUpperCase()) ||
    /^licen[cs]e/i.test(file.split('/').pop() ?? ''),
  );
  if (files.length === 0) return null;

  const file = files[0]!;
  const [beforeText, afterText] = await Promise.all([
    showFile(repoPath, fromRef, file),
    showFile(repoPath, toRef, file),
  ]);

  const beforeFamily = beforeText === null ? 'absent' : detectLicenseFamily(beforeText);
  const afterFamily = afterText === null ? 'absent' : detectLicenseFamily(afterText);
  const beforeCopyright = (beforeText === null ? [] : extractCopyrightLines(beforeText)).map(
    (c) => c.holder,
  );
  const afterCopyright = (afterText === null ? [] : extractCopyrightLines(afterText)).map(
    (c) => c.holder,
  );

  const problems: string[] = [];
  if (beforeFamily !== afterFamily) {
    problems.push(`Licence family changed: ${beforeFamily} -> ${afterFamily}.`);
  }
  if (afterText === null) {
    problems.push(`Licence file ${file} was removed upstream.`);
  }
  const lostHolders = beforeCopyright.filter((holder) => !afterCopyright.includes(holder));
  if (lostHolders.length > 0) {
    problems.push(`Copyright notice removed upstream: ${lostHolders.join('; ')}`);
  }

  const changed =
    beforeFamily !== afterFamily ||
    beforeText !== afterText ||
    beforeCopyright.join('|') !== afterCopyright.join('|');

  return { changed, beforeFamily, afterFamily, beforeCopyright, afterCopyright, problems };
}

/**
 * Verify that the preserved licence copies still match what upstream ships at
 * the pinned commit. A mismatch means `THIRD_PARTY_NOTICES.md` is describing a
 * licence that is no longer accurate.
 */
export async function verifyPreservedLicenses(
  projectRoot: string = resolveProjectRoot(),
): Promise<Array<{ name: string; ok: boolean; detail: string }>> {
  const manifest = await loadManifest(projectRoot);
  const cacheRoot = path.resolve(projectRoot, manifest.cacheDir);
  const results: Array<{ name: string; ok: boolean; detail: string }> = [];

  for (const entry of manifest.upstreams) {
    const repoPath = path.join(cacheRoot, entry.name);
    const preserved = entry.license_file
      ? path.resolve(projectRoot, entry.license_file)
      : path.join(projectRoot, 'licenses', `${entry.license}-${entry.name}`);

    if (!existsSync(preserved)) {
      results.push({ name: entry.name, ok: false, detail: `preserved licence missing: ${preserved}` });
      continue;
    }
    if (!existsSync(repoPath)) {
      results.push({
        name: entry.name,
        ok: false,
        detail: 'clone missing, cannot compare against upstream',
      });
      continue;
    }

    const upstreamLicense = await findUpstreamLicense(repoPath);
    if (upstreamLicense === null) {
      results.push({ name: entry.name, ok: false, detail: 'no licence file found in the clone' });
      continue;
    }

    const [preservedText, upstreamText] = await Promise.all([
      readFile(preserved, 'utf8'),
      readFile(upstreamLicense, 'utf8'),
    ]);
    const same = normaliseWhitespace(preservedText) === normaliseWhitespace(upstreamText);
    results.push({
      name: entry.name,
      ok: same,
      detail: same
        ? `matches ${path.relative(repoPath, upstreamLicense).split(path.sep).join('/')}`
        : `differs from ${path.relative(repoPath, upstreamLicense).split(path.sep).join('/')}`,
    });
  }

  return results;
}

async function findUpstreamLicense(repoPath: string): Promise<string | null> {
  for (const candidate of LICENSE_CANDIDATES) {
    const full = path.join(repoPath, candidate);
    if (existsSync(full)) return full;
  }
  return null;
}

function normaliseWhitespace(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
}

/** Render the report the sync check is allowed to produce. */
export function renderUpdateReport(report: SyncReport): string {
  const lines: string[] = [];
  lines.push('# UPSTREAM_UPDATE_REPORT');
  lines.push('');
  lines.push('Generated automatically by `npm run upstream:check`.');
  lines.push('');
  lines.push('**This report never modifies local code.** It records what moved upstream so that');
  lines.push('a human or an agent can decide what, if anything, to absorb.');
  lines.push('');
  lines.push(`- Generated: ${report.generatedAt}`);
  lines.push(`- Mode: ${report.offline ? 'offline (local state only)' : 'online'}`);
  lines.push(`- Upstreams checked: ${report.summary.total}`);
  lines.push(`- Up to date: ${report.summary.upToDate}`);
  lines.push(`- Updates available: ${report.summary.updateAvailable}`);
  lines.push(`- Clones missing: ${report.summary.cloneMissing}`);
  lines.push(`- Licence alerts: ${report.summary.licenseAlerts}`);
  lines.push('');

  lines.push('## Summary table');
  lines.push('');
  lines.push('| Upstream | State | Version | Pinned | Remote | Files changed | Rule changes | Licence |');
  lines.push('| --- | --- | --- | --- | --- | ---: | ---: | --- |');
  for (const upstream of report.upstreams) {
    lines.push(
      `| \`${upstream.repository}\` | ${upstream.state} | ${upstream.version} | ` +
        `\`${short(upstream.manifestCommit)}\` | \`${short(upstream.remoteCommit)}\` | ` +
        `${upstream.fileChanges.length} | ${upstream.ruleDeltas.length} | ` +
        `${upstream.licenseDelta?.problems.length ? '**ALERT**' : 'ok'} |`,
    );
  }
  lines.push('');

  lines.push('## Lineage');
  lines.push('');
  lines.push('Same-lineage repositories are not independent discoveries. Rules that appear in');
  lines.push('more than one of these must collapse to a single canonical rule.');
  lines.push('');
  lines.push('| Upstream | Declared ancestry | Resolved roots |');
  lines.push('| --- | --- | --- |');
  for (const upstream of report.upstreams) {
    lines.push(
      `| \`${upstream.repository}\` | ${upstream.derivedFrom.length ? upstream.derivedFrom.map((d) => `\`${d}\``).join(', ') : '—'} | ${upstream.lineageRoots.map((r) => `\`${r}\``).join(', ')} |`,
    );
  }
  lines.push('');

  for (const upstream of report.upstreams) {
    lines.push(`## ${upstream.repository}`);
    lines.push('');
    lines.push(`- State: **${upstream.state}**`);
    lines.push(`- Licence: ${upstream.license}`);
    lines.push(`- Pinned commit: \`${upstream.manifestCommit}\``);
    lines.push(`- Remote commit: \`${upstream.remoteCommit ?? 'unknown'}\``);
    lines.push(`- Integration: ${upstream.integration ?? 'unspecified'}`);
    lines.push(`- Tracked: ${upstream.tracked ? 'yes' : 'no (investigation only)'}`);
    lines.push('');

    if (upstream.notes.length > 0) {
      lines.push('Notes:');
      for (const note of upstream.notes) lines.push(`- ${note}`);
      lines.push('');
    }

    if (upstream.state === 'up-to-date') {
      lines.push('No action.');
      lines.push('');
      continue;
    }

    if (upstream.commits.length > 0) {
      lines.push(`### New commits (${upstream.commitCount})`);
      lines.push('');
      lines.push('```text');
      for (const commit of upstream.commits) lines.push(commit);
      lines.push('```');
      lines.push('');
    }

    if (upstream.fileChanges.length > 0) {
      lines.push(`### Changed files (${upstream.fileChanges.length})`);
      lines.push('');
      lines.push('| Status | File |');
      lines.push('| --- | --- |');
      for (const change of upstream.fileChanges.slice(0, 200)) {
        lines.push(`| ${change.status} | \`${change.path}\` |`);
      }
      if (upstream.fileChanges.length > 200) {
        lines.push(`| … | ${upstream.fileChanges.length - 200} more |`);
      }
      lines.push('');
    }

    if (upstream.ruleDeltas.length > 0) {
      lines.push('### Rule changes');
      lines.push('');
      for (const delta of upstream.ruleDeltas) {
        lines.push(
          `**\`${delta.file}\`** — ${delta.beforeCount} rules before, ${delta.afterCount} after.`,
        );
        lines.push('');
        if (delta.added.length > 0) {
          lines.push('Added:');
          for (const rule of delta.added) lines.push(`- ${rule}`);
          lines.push('');
        }
        if (delta.removed.length > 0) {
          lines.push('Removed:');
          for (const rule of delta.removed) lines.push(`- ${rule}`);
          lines.push('');
        }
        if (delta.renamed.length > 0) {
          lines.push('Renamed or retargeted (same number, different title):');
          for (const rule of delta.renamed) {
            lines.push(`- ${rule.number}. ${rule.from} -> ${rule.to}`);
          }
          lines.push('');
        }
      }
    }

    const license = upstream.licenseDelta;
    if (license) {
      lines.push('### Licence changes');
      lines.push('');
      lines.push(`- Family: ${license.beforeFamily} -> ${license.afterFamily}`);
      if (license.beforeCopyright.length > 0) {
        lines.push(`- Copyright before: ${license.beforeCopyright.join('; ')}`);
      }
      if (license.afterCopyright.length > 0) {
        lines.push(`- Copyright after: ${license.afterCopyright.join('; ')}`);
      }
      if (license.problems.length > 0) {
        lines.push('');
        lines.push('**Alerts:**');
        for (const problem of license.problems) lines.push(`- ${problem}`);
      }
      lines.push('');
    }

    lines.push('### Decision required');
    lines.push('');
    lines.push('Absorbing this change is a human or agent decision. Nothing has been written.');
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function short(sha: string | null): string {
  return sha === null ? 'none' : sha.slice(0, 10);
}
