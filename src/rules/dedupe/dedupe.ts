/**
 * Cross-upstream rule deduplication.
 *
 * Several of the upstreams are the same lineage. `blader/humanizer` has 33
 * numbered English patterns, and two of the Chinese repositories are
 * localisations of it. Treating those as independent discoveries would make a
 * single tell score three times, which is exactly the failure the project
 * brief forbids.
 *
 * The unit of deduplication is the *signature*: a stable dotted snake_case key
 * that adapters assign to a tell independently of how their upstream spells or
 * numbers it. Same signature means same tell.
 */

import { clampSeverity, isValidId } from '../../shared/types.js';
import { signatureSpec } from '../canonical/signatures.js';
import type { CanonicalRule, RuleCandidate, RuleStatus } from '../types.js';
import type { SourceReference } from '../provenance/types.js';
import { compareText } from '../../shared/order.js';

export type SeverityPolicy = 'max' | 'median' | 'mean';

export interface DedupeOptions {
  /**
   * How to combine severities when several upstreams claim the same tell.
   * Default `max`: the rule fires once, at the strength of the most insistent
   * upstream. `median` resists a single aggressive source.
   */
  severityPolicy?: SeverityPolicy;
  /** Lifecycle status stamped onto every produced rule. Default `seed`. */
  status?: RuleStatus;
  /**
   * Safety net for signatures that were spelled differently before the
   * convention settled. Maps a non-canonical signature to a canonical one.
   */
  signatureAliases?: Readonly<Record<string, string>>;
  /** Human-readable description overrides, keyed by canonical signature. */
  descriptions?: Readonly<Record<string, string>>;
  /** Rewrite guidance overrides, keyed by canonical signature. */
  rewriteGuidance?: Readonly<Record<string, string>>;
}

export interface DedupeMember {
  readonly upstream: string;
  readonly upstreamRuleId: string;
  readonly locator?: string;
}

export interface DedupeMerge {
  readonly canonicalId: string;
  readonly signature: string;
  /** More than one entry means the tell was independently claimed more than once. */
  readonly members: readonly DedupeMember[];
  /** True when this rule collapsed a multi-upstream lineage into one rule. */
  readonly crossUpstream: boolean;
}

export interface DedupeConflict {
  readonly signature: string;
  readonly field: 'category';
  readonly values: ReadonlyArray<{ upstream: string; value: string }>;
}

export interface DedupeResult {
  readonly rules: CanonicalRule[];
  readonly merges: DedupeMerge[];
  readonly conflicts: DedupeConflict[];
  readonly inputCount: number;
  /** How many candidate claims were absorbed. `inputCount - rules.length`. */
  readonly collapsedCount: number;
}

export function dedupeRuleCandidates(
  candidates: readonly RuleCandidate[],
  options: DedupeOptions = {},
): DedupeResult {
  const severityPolicy = options.severityPolicy ?? 'max';
  const status = options.status ?? 'seed';
  const aliases = options.signatureAliases ?? {};

  const groups = new Map<string, RuleCandidate[]>();
  for (const candidate of candidates) {
    const signature = aliases[candidate.signature] ?? candidate.signature;
    const bucket = groups.get(signature);
    if (bucket) bucket.push(candidate);
    else groups.set(signature, [candidate]);
  }

  const rules: CanonicalRule[] = [];
  const merges: DedupeMerge[] = [];
  const conflicts: DedupeConflict[] = [];

  for (const [signature, group] of [...groups.entries()].sort(([a], [b]) => compareText(a, b))) {
    if (!isValidId(signature)) {
      throw new Error(
        `Dedupe signature must be dotted snake_case (got ${JSON.stringify(signature)}). ` +
          'Fix the upstream adapter that emitted it.',
      );
    }

    const categories = uniqueBy(group, (c) => c.category);
    if (categories.length > 1) {
      conflicts.push({
        signature,
        field: 'category',
        values: group.map((c) => ({ upstream: c.upstream, value: c.category })),
      });
    }

    const severities = group
      .map((c) => c.severity)
      .filter((s): s is number => typeof s === 'number');
    const severity = severities.length === 0 ? 3 : combineSeverity(severities, severityPolicy);

    const primary = group[0]!;
    const sources: SourceReference[] = group.map((c) => ({
      upstream: c.upstream,
      ruleId: c.upstreamRuleId,
      ...(c.locator ? { locator: c.locator } : {}),
      ...(c.quote ? { quote: c.quote } : {}),
    }));

    const aliasesForRule = [
      ...new Set(group.map((c) => `${c.upstream}#${c.upstreamRuleId}`)),
    ];

    const detection = pickFirst(group.map((c) => c.detection));
    const guidance =
      options.rewriteGuidance?.[signature] ?? pickFirst(group.map((c) => c.rewriteGuidance));

    // Watched phrases union across every claiming upstream. Three upstreams that
    // watched different phrasings of one tell now contribute to one rule, which
    // is what makes the collapse useful rather than merely tidy.
    const watchPhrases = uniqueBy(
      group.flatMap((c) => c.watchPhrases ?? []),
      (phrase) => `${phrase.kind}\u0000${phrase.text}`,
    );

    // Weak alone is decided by an upstream vote, not by "any source".
    //
    // The corpus uses the idea for three different things: `blader` means "this
    // tell needs company from other tells"; `stop-slop` means "the upstream
    // states this absolutely, or it is one common word"; and `ai-humanizer`'s
    // adapter uses it for a low weight or a provider gate. Taking the union of
    // all three made 43% of the registry weak alone and suppressed five of six
    // real findings in a plainly AI-flavoured paragraph — a detector that finds
    // nothing is not a conservative detector, it is a broken one.
    //
    // So each upstream gets one vote, an upstream votes weak alone if any of its
    // claims says so, and a tie goes to weak alone. That keeps the cases the
    // policy exists for (`dash_overuse`, `hyphenated_pairs`, `curly_quotes`,
    // `passive_and_subjectless`) while letting four upstreams outvote one.
    const votesByUpstream = new Map<string, boolean>();
    for (const candidate of group) {
      const previous = votesByUpstream.get(candidate.upstream) ?? false;
      votesByUpstream.set(candidate.upstream, previous || candidate.weakAlone === true);
    }
    const weakVotes = [...votesByUpstream.values()].filter(Boolean).length;
    const weakAloneSources = [...votesByUpstream.entries()]
      .filter(([, weak]) => weak)
      .map(([upstream]) => upstream);

    // The vocabulary can override the vote when the lineage's own policy is
    // authoritative — see `SignatureSpec.weakAlone`. Without this, three
    // upstreams stating "avoid dashes" without blader's caveat would outvote the
    // one source that thought about false positives.
    const policyOverride = signatureSpec(signature)?.weakAlone === true;
    const weakAlone = policyOverride || weakVotes * 2 >= votesByUpstream.size;

    const originatedIn = uniqueBy(
      group.flatMap((c) => c.originatedIn ?? []),
      (upstream) => upstream,
    );

    rules.push({
      id: signature,
      category: primary.category,
      languages: uniqueBy(group.flatMap((c) => c.languages), (l) => l),
      description:
        options.descriptions?.[signature] ??
        pickFirst(group.map((c) => c.description)) ??
        signature.replace(/_/g, ' '),
      ...(detection ? { detection } : {}),
      rewriteGuidance:
        guidance ?? 'Rewrite the passage so this tell is absent; keep the original meaning.',
      severity,
      sources,
      aliases: aliasesForRule,
      ...(watchPhrases.length > 0 ? { watchPhrases } : {}),
      ...(weakAlone ? { weakAlone: true } : {}),
      ...(weakAloneSources.length > 0 ? { weakAloneSources } : {}),
      ...(originatedIn.length > 0 ? { originatedIn } : {}),
      status,
      tags: uniqueBy(group.flatMap((c) => c.tags ?? []), (t) => t),
    });

    const members: DedupeMember[] = group.map((c) => ({
      upstream: c.upstream,
      upstreamRuleId: c.upstreamRuleId,
      ...(c.locator ? { locator: c.locator } : {}),
    }));

    merges.push({
      canonicalId: signature,
      signature,
      members,
      crossUpstream: new Set(group.map((c) => c.upstream)).size > 1,
    });
  }

  return {
    rules,
    merges,
    conflicts,
    inputCount: candidates.length,
    collapsedCount: candidates.length - rules.length,
  };
}

export function combineSeverity(values: readonly number[], policy: SeverityPolicy): number {
  if (values.length === 0) return 3;
  const sorted = [...values].sort((a, b) => a - b);
  switch (policy) {
    case 'max':
      return clampSeverity(sorted[sorted.length - 1]!);
    case 'median': {
      const mid = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
      return clampSeverity(median);
    }
    case 'mean':
      return clampSeverity(sorted.reduce((a, b) => a + b, 0) / sorted.length);
  }
}

/** Rules that collapsed a lineage: the evidence that dedupe actually worked. */
export function crossUpstreamMerges(result: DedupeResult): DedupeMerge[] {
  return result.merges.filter((m) => m.crossUpstream);
}

function pickFirst<T>(values: ReadonlyArray<T | undefined>): T | undefined {
  for (const value of values) {
    if (value !== undefined) return value;
  }
  return undefined;
}

function uniqueBy<T, K>(values: readonly T[], key: (value: T) => K): T[] {
  const seen = new Set<K>();
  const out: T[] = [];
  for (const value of values) {
    const k = key(value);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(value);
  }
  return out;
}
