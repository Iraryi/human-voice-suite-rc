/**
 * Phrase-level deduplication.
 *
 * Signature-level dedupe stops the same *tell* being counted twice. It does not
 * stop the same *phrase* being counted twice, and in this corpus that happens a
 * great deal: 901 literal watched phrases reduce to 803 distinct ones, and 72 of
 * them are claimed by more than one rule. Thirty-eight span different
 * categories, which is the damaging case — a text containing "I hope this helps"
 * is charged once for `assistant.chatbot_residue` and again for
 * `lexical.provider_tic`, and a text containing 值得注意的是 is charged three
 * times.
 *
 * The fix is ownership. Every phrase has exactly one owning rule; the other
 * claimants keep the phrase in their data — it is what the upstream said, and
 * deleting it would be a lie — but they do not match on it. One phrase, one
 * finding.
 *
 * Ownership is decided deterministically and then reviewed. The default is
 * "the most specific rule wins", measured as the fewest watched phrases, because
 * a rule that watches ten phrases is describing something narrower than a rule
 * that watches four hundred. Where that default is wrong — and it is wrong for
 * some phrases, which is why `PHRASE_OWNER_OVERRIDES` exists — a curated entry
 * settles it and records why.
 */

import type { CanonicalRule, WatchPhrase } from '../types.js';
import { PHRASE_OWNER_OVERRIDES, UNMATCHED_RULES } from '../aliases/phrase-ownership.js';
import { compareText } from '../../shared/order.js';

export type PhraseKind = WatchPhrase['kind'];

/** Why a rule ended up owning a phrase. */
export type OwnershipReason =
  | 'sole-claimant'
  | 'fewest-phrases'
  | 'severity'
  | 'alphabetical'
  | 'override';

export interface ContestedPhrase {
  /** The phrase as the owning rule spells it. */
  readonly phrase: string;
  readonly kind: PhraseKind;
  readonly owner: string;
  readonly claimants: readonly string[];
  readonly reason: OwnershipReason;
  /** The decided-against rules, kept so a report can show what changed. */
  readonly others: readonly string[];
}

export interface PhraseIndex {
  /** Normalised phrase text to the rule that owns it, for both kinds. */
  readonly owners: ReadonlyMap<string, string>;
  readonly contested: readonly ContestedPhrase[];
  readonly literalCount: number;
  readonly templateCount: number;
  readonly distinctCount: number;
  /** Phrases duplicated within a single rule, which are dropped silently. */
  readonly selfDuplicates: number;
  /** Rules removed from matching entirely, and therefore from ownership. */
  readonly excludedRules: readonly string[];
  /**
   * Overrides that named a rule which does not claim the phrase.
   *
   * Recorded rather than thrown, so the index stays usable on any rule set —
   * including the small synthetic ones tests build. `validateOwnershipOverrides`
   * is what turns these into a failure, against the real registry.
   */
  readonly staleOverrides: readonly string[];
  /**
   * Overrides that change no outcome: the phrase has one claimant, or the
   * default already picks the rule the override names.
   */
  readonly unnecessaryOverrides: readonly string[];
}

export interface BuildPhraseIndexOptions {
  /**
   * Curated ownership. Keyed by the normalised phrase, valued by the rule that
   * should own it. Applied before the default, and recorded as `override` so a
   * report shows where the default was overruled. Defaults to the table in
   * `src/rules/aliases/phrase-ownership.ts`.
   */
  readonly overrides?: Readonly<Record<string, string>>;
  /**
   * Rules that neither claim nor own any phrase.
   *
   * A rule whose upstream gates it off has no business taking a phrase away from
   * a rule that does match, so excluded rules are removed before ownership is
   * decided rather than after. Defaults to `UNMATCHED_RULES`.
   */
  readonly excludeRules?: ReadonlySet<string>;
}

/**
 * The key two spellings of one phrase share.
 *
 * Lowercased and whitespace-collapsed, with edge punctuation stripped — because
 * the corpus writes the same tell as `Great question!` in one upstream and
 * `great question` in another, and treating those as different phrases let the
 * wrong rule keep one of them. Interior punctuation is kept: `not X but Y` and
 * `not X, but Y` are different constructions.
 */
export function normalizePhraseKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\s!?.,;:()\[\]"'\u201c\u201d\u3002\uff01\uff1f\uff0c\u3001]+/, '')
    .replace(/[\s!?.,;:()\[\]"'\u201c\u201d\u3002\uff01\uff1f\uff0c\u3001]+$/, '')
    .trim();
}

function key(phrase: WatchPhrase): string {
  return normalizePhraseKey(phrase.text);
}

/**
 * Rank the claimants of a phrase, best first.
 *
 * Ordering is total and independent of input order, so the decision does not
 * change when an adapter happens to emit its rules in a different sequence.
 */
function rankClaimants(
  claimants: readonly { readonly rule: CanonicalRule; readonly phraseCount: number }[],
): readonly { readonly rule: CanonicalRule; readonly phraseCount: number }[] {
  return [...claimants].sort((a, b) => {
    // A narrower rule describes a narrower tell.
    if (a.phraseCount !== b.phraseCount) return a.phraseCount - b.phraseCount;
    // Failing that, trust the rule that matters more.
    if (a.rule.severity !== b.rule.severity) return b.rule.severity - a.rule.severity;
    // Finally, determinism.
    return compareText(a.rule.id, b.rule.id);
  });
}

/** Count the matchable phrases a rule carries, which is the specificity measure. */
export function matchablePhraseCount(rule: CanonicalRule): number {
  return (rule.watchPhrases ?? []).filter((phrase) => phrase.kind !== 'reference').length;
}

export function buildPhraseIndex(
  rules: readonly CanonicalRule[],
  options: BuildPhraseIndexOptions = {},
): PhraseIndex {
  const overrides = options.overrides ?? PHRASE_OWNER_OVERRIDES;
  const excludeRules = options.excludeRules ?? new Set(Object.keys(UNMATCHED_RULES));

  // phrase -> every rule that claims it, with the phrase as that rule spells it.
  const claims = new Map<string, { phrase: WatchPhrase; rule: CanonicalRule }[]>();
  let literalCount = 0;
  let templateCount = 0;
  let selfDuplicates = 0;

  for (const rule of rules) {
    if (excludeRules.has(rule.id)) continue;
    const seenInRule = new Set<string>();
    for (const phrase of rule.watchPhrases ?? []) {
      if (phrase.kind === 'reference') continue;
      if (phrase.kind === 'literal') literalCount += 1;
      else templateCount += 1;

      const phraseKey = key(phrase);
      if (phraseKey.length === 0) continue;
      if (seenInRule.has(phraseKey)) {
        selfDuplicates += 1;
        continue;
      }
      seenInRule.add(phraseKey);

      const bucket = claims.get(phraseKey);
      if (bucket) bucket.push({ phrase, rule });
      else claims.set(phraseKey, [{ phrase, rule }]);
    }
  }

  const owners = new Map<string, string>();
  const contested: ContestedPhrase[] = [];
  const staleOverrides: string[] = [];
  const unnecessaryOverrides: string[] = [];

  for (const [phraseKey, bucket] of claims) {
    const ruleIds = [...new Set(bucket.map((entry) => entry.rule.id))];
    const first = bucket[0]!;

    const override = overrides[phraseKey];
    // An override naming a rule that does not claim the phrase is stale or
    // mistyped. It is recorded and skipped here; `validateOwnershipOverrides`
    // turns it into a failure where that is meaningful.
    if (override !== undefined && !ruleIds.includes(override)) {
      staleOverrides.push(
        `${JSON.stringify(phraseKey)} -> ${override} (claimants: ${ruleIds.join(', ')})`,
      );
    }

    // A sole claimant needs no decision from anyone.
    if (ruleIds.length === 1) {
      if (override !== undefined) {
        unnecessaryOverrides.push(
          `${JSON.stringify(phraseKey)} -> ${override} (the only claimant)`,
        );
      }
      owners.set(phraseKey, ruleIds[0]!);
      continue;
    }

    // Decide what the default would do, so an override that agrees with it can
    // be reported as doing nothing. A table entry that changes no outcome is how
    // a curated table rots.
    const ranked = rankClaimants(
      bucket.map((entry) => ({ rule: entry.rule, phraseCount: matchablePhraseCount(entry.rule) })),
    );
    const winner = ranked[0]!;
    const runnerUp = ranked[1]!;

    const valid = override !== undefined && ruleIds.includes(override);
    const isStale = override !== undefined && !ruleIds.includes(override);
    if (valid && !isStale && override === winner.rule.id) {
      unnecessaryOverrides.push(
        `${JSON.stringify(phraseKey)} -> ${override} (the default already chooses it)`,
      );
    }

    if (valid && override !== winner.rule.id) {
      owners.set(phraseKey, override);
      contested.push({
        phrase: first.phrase.text,
        kind: first.phrase.kind,
        owner: override,
        claimants: ruleIds,
        reason: 'override',
        others: ruleIds.filter((id) => id !== override),
      });
      continue;
    }

    let reason: OwnershipReason = 'fewest-phrases';
    if (winner.phraseCount === runnerUp.phraseCount) {
      reason = winner.rule.severity === runnerUp.rule.severity ? 'alphabetical' : 'severity';
    }

    owners.set(phraseKey, winner.rule.id);
    contested.push({
      phrase: first.phrase.text,
      kind: first.phrase.kind,
      owner: winner.rule.id,
      claimants: ruleIds,
      reason,
      others: ruleIds.filter((id) => id !== winner.rule.id),
    });
  }

  return {
    owners,
    contested: contested.sort((a, b) => b.claimants.length - a.claimants.length || compareText(a.phrase, b.phrase)),
    literalCount,
    templateCount,
    distinctCount: owners.size,
    selfDuplicates,
    excludedRules: [...excludeRules].sort(),
    staleOverrides,
    unnecessaryOverrides,
  };
}

/**
 * Check the curated tables against a real rule set.
 *
 * Two failures matter, and they are mutually exclusive:
 *
 * - **stale** — the override names a rule that does not claim the phrase.
 * - **unnecessary** — the phrase has one claimant, or the default already picks
 *   the rule the override names. An entry that changes no outcome is how a
 *   curated table rots: it looks like a decision and is not one.
 *
 * Both are returned rather than thrown, so a caller can report all of them at
 * once. `buildPhraseIndex` itself stays usable on any rule set, including the
 * small synthetic ones tests build.
 */
export function validateOwnershipOverrides(
  rules: readonly CanonicalRule[],
  overrides: Readonly<Record<string, string>>,
): string[] {
  const index = buildPhraseIndex(rules, { overrides });
  return [
    ...index.staleOverrides.map((entry) => `Stale phrase ownership override: ${entry}`),
    ...index.unnecessaryOverrides.map(
      (entry) => `Unnecessary phrase ownership override: ${entry} — remove it.`,
    ),
  ];
}

/** True when this rule owns the phrase and may therefore match on it. */
export function ownsPhrase(index: PhraseIndex, phrase: WatchPhrase, ruleId: string): boolean {
  const owner = index.owners.get(key(phrase));
  // An unindexed phrase is one no rule owns, which should not happen; treating it
  // as owned keeps the detector from silently dropping data if it does.
  return owner === undefined || owner === ruleId;
}

/** The phrases a rule owns, which are the ones it may match. */
export function ownedPhrases(
  index: PhraseIndex,
  rule: CanonicalRule,
): WatchPhrase[] {
  return (rule.watchPhrases ?? []).filter(
    (phrase) => phrase.kind !== 'reference' && ownsPhrase(index, phrase, rule.id),
  );
}

export interface PhraseIndexStats {
  readonly distinct: number;
  readonly literal: number;
  readonly template: number;
  readonly contested: number;
  readonly overridden: number;
  readonly selfDuplicates: number;
  /** Phrases one non-owning rule has stopped matching, in total. */
  readonly findingsAvoided: number;
}

export function phraseIndexStats(index: PhraseIndex): PhraseIndexStats {
  return {
    distinct: index.distinctCount,
    literal: index.literalCount,
    template: index.templateCount,
    contested: index.contested.length,
    overridden: index.contested.filter((c) => c.reason === 'override').length,
    selfDuplicates: index.selfDuplicates,
    findingsAvoided: index.contested.reduce((sum, entry) => sum + entry.others.length, 0),
  };
}
