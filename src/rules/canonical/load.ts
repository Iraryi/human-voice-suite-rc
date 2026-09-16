/**
 * Building the canonical registry from what has actually been extracted.
 *
 * Phase 1 shipped a hand-written seed to prove the dedupe mechanism. Phase 2
 * replaces it with the real thing: every committed `rules.generated.json`, run
 * through deduplication, so the registry is a function of the pinned upstreams
 * rather than of anybody's typing.
 *
 * The seed is kept and still used by its own tests, because it is a much faster
 * way to test the collapse logic than loading six upstreams.
 */

import { resolveProjectRoot } from '../../upstream/manifest.js';
import { loadAllExtractions } from '../../upstream/extract/generate.js';
import { toRuleCandidates } from '../../upstream/extract/types.js';
import type { ExtractionResult } from '../../upstream/extract/types.js';
import { CanonicalRuleRegistry } from './registry.js';
import { LOCAL_RULES } from './local.js';
import { dedupeRuleCandidates, crossUpstreamMerges } from '../dedupe/dedupe.js';
import type { DedupeResult } from '../dedupe/dedupe.js';
import type { RuleCandidate } from '../types.js';

export interface RegistryBuild {
  readonly registry: CanonicalRuleRegistry;
  readonly dedupe: DedupeResult;
  readonly extractions: ReadonlyMap<string, ExtractionResult>;
  /** Adapters whose generated file is present but contributed nothing. */
  readonly emptyAdapters: readonly string[];
  /** Rules that belong to this project rather than to an upstream. */
  readonly localRuleCount: number;
  /** Every problem worth a human's attention. Empty is the healthy case. */
  readonly problems: readonly string[];
}

export interface BuildRegistryOptions {
  readonly projectRoot?: string;
  readonly severityPolicy?: 'max' | 'median' | 'mean';
  readonly status?: 'seed' | 'canonical';
}

export async function buildRegistryFromExtractions(
  options: BuildRegistryOptions = {},
): Promise<RegistryBuild> {
  const projectRoot = options.projectRoot ?? resolveProjectRoot();
  const extractions = await loadAllExtractions(projectRoot);

  const candidates: RuleCandidate[] = [];
  const emptyAdapters: string[] = [];

  for (const [adapterId, result] of extractions) {
    if (result.rules.length === 0) {
      emptyAdapters.push(adapterId);
      continue;
    }
    candidates.push(...toRuleCandidates(result));
  }

  const dedupe = dedupeRuleCandidates(candidates, {
    severityPolicy: options.severityPolicy ?? 'max',
    status: options.status ?? 'canonical',
  });

  const registry = new CanonicalRuleRegistry(dedupe.rules);

  // Rules that belong to this project are added after the extracted ones. They
  // have no upstream to parse, so they cannot arrive through an adapter, and
  // adding them here is what lets a detector and the behaviour taxonomy resolve
  // to the same rule rather than to two.
  const localAdded = registry.addAll(LOCAL_RULES);

  const problems: string[] = [];
  if (extractions.size === 0) {
    problems.push(
      'No extraction has been run. Run npm run upstream:extract, or the registry will be empty.',
    );
  }
  else {
    for (const adapterId of emptyAdapters) {
      problems.push(`${adapterId} produced an empty extraction`);
    }
    for (const conflict of dedupe.conflicts) {
      problems.push(
        `signature ${conflict.signature} is claimed under ${conflict.values.length} categories: ` +
          conflict.values.map((v) => `${v.upstream}=${v.value}`).join(', '),
      );
    }
  }

  return { registry, dedupe, extractions, emptyAdapters, localRuleCount: localAdded.length, problems };
}

export interface RegistryStats {
  readonly ruleCount: number;
  readonly crossUpstreamRuleCount: number;
  readonly localOnlyRuleCount: number;
  readonly upstreamContribution: ReadonlyArray<{
    readonly upstream: string;
    readonly exclusive: number;
    readonly shared: number;
  }>;
  readonly watchPhraseCount: number;
  readonly weakAloneRuleCount: number;
  readonly rulesWithoutWatchPhrases: readonly string[];
}

export async function registryStats(
  options: BuildRegistryOptions = {},
): Promise<{ readonly build: RegistryBuild; readonly stats: RegistryStats }> {
  const build = await buildRegistryFromExtractions(options);
  const rules = build.registry.list();

  const contribution = new Map<string, { exclusive: number; shared: number }>();
  const withoutPhrases: string[] = [];
  let watchPhraseCount = 0;
  let weakAlone = 0;

  for (const rule of rules) {
    const upstreams = [...new Set(rule.sources.map((s) => s.upstream))];
    for (const upstream of upstreams) {
      const entry = contribution.get(upstream) ?? { exclusive: 0, shared: 0 };
      if (upstreams.length === 1) entry.exclusive += 1;
      else entry.shared += 1;
      contribution.set(upstream, entry);
    }
    watchPhraseCount += rule.watchPhrases?.length ?? 0;
    if (rule.weakAlone) weakAlone += 1;
    if ((rule.watchPhrases?.length ?? 0) === 0) withoutPhrases.push(rule.id);
  }

  return {
    build,
    stats: {
      ruleCount: rules.length,
      crossUpstreamRuleCount: crossUpstreamMerges(build.dedupe).length,
      localOnlyRuleCount: rules.filter((rule) =>
        rule.sources.every((s) => s.upstream === 'human-voice-suite/local'),
      ).length,
      upstreamContribution: [...contribution.entries()]
        .map(([upstream, counts]) => ({ upstream, ...counts }))
        .sort((a, b) => b.shared + b.exclusive - (a.shared + a.exclusive)),
      watchPhraseCount,
      weakAloneRuleCount: weakAlone,
      rulesWithoutWatchPhrases: withoutPhrases,
    },
  };
}
