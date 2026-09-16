/**
 * The canonical rule model.
 *
 * This is the single most important piece of shared infrastructure in the
 * suite. Several upstreams detect the same tell; the registry guarantees that
 * one tell is one rule with one id, no matter how many upstreams noticed it.
 */

import type { Language, Severity } from '../shared/types.js';
import type { LocalChange, SourceReference } from './provenance/types.js';

/**
 * Lifecycle of a rule.
 *
 * - `seed`      — imported during Phase 1 to prove the registry works; not yet
 *                 deduplicated against the full upstream corpus.
 * - `canonical` — deduplicated, reviewed, safe to score against.
 * - `deprecated`— kept for provenance so old findings remain explainable.
 */
export type RuleStatus = 'seed' | 'canonical' | 'deprecated';

/**
 * How a watched phrase can be matched.
 *
 * `literal` can be matched as text; `template` is a construction such as
 * `not X but Y` and needs a pattern rather than a string; `reference` is too
 * short or too common to match safely and is kept only so the data is complete.
 */
export type PhraseKind = 'literal' | 'template' | 'reference';

export interface WatchPhrase {
  /** The phrase as the upstream states it, cleaned of markup. */
  readonly text: string;
  readonly kind: PhraseKind;
  readonly match: string;
  /** A scope restriction the upstream attached, e.g. "keep technical uses". */
  readonly note?: string;
}

export interface CanonicalRule {
  /** Stable dotted snake_case id, unique across the whole registry. */
  id: string;
  /** Coarse bucket used for grouping and for strategy selection. */
  category: string;

  /** Languages this rule is meaningful for. `unknown` means language-agnostic. */
  languages: string[];

  /** What the rule detects, in one sentence. */
  description: string;

  /**
   * How to detect it. Either a machine-checkable expression (the suite's own
   * mini-syntax) or a plain-language description when detection is inherently
   * model-judged. Absent means detection is not yet specified.
   */
  detection?: string;

  /** What a rewrite should do about this rule. Required: a rule you cannot act on is noise. */
  rewriteGuidance: string;

  /** 1..5. Clamped on construction; see `clampSeverity`. */
  severity: number;

  /** Every upstream that independently states this rule, plus where. */
  sources: SourceReference[];

  /**
   * Other upstream-local identifiers or spellings that resolve to this rule.
   * Alias resolution is what stops one tell from scoring three times.
   */
  aliases: string[];

  /** Changes this project made on top of the upstreams. */
  localChanges?: LocalChange[];

  /**
   * Phrases this rule watches, unioned from every upstream that states it.
   *
   * Carried on the canonical rule rather than kept beside it so that the
   * lexical detector needs only the registry. When three upstreams claim one
   * tell, their watched lists merge here and the tell is still charged once.
   */
  watchPhrases?: WatchPhrase[];

  /**
   * True when the rule may only fire with corroboration from other tells.
   * Inherited from the upstream's own suppression policy, not invented here.
   */
  weakAlone?: boolean;

  /**
   * Which upstreams said so.
   *
   * Recorded because upstreams disagree. `lexical.ai_vocabulary` is weak alone
   * here only because `humanize-text` flagged it; `blader` ranks the same tell
   * as confident. The merge is deliberately conservative — one source's caution
   * is enough — so this field exists to make the disagreement auditable rather
   * than invisible. See `docs/provenance-policy.md`.
   */
  weakAloneSources?: string[];

  /** Where the rule content originated, when that differs from `sources`. */
  originatedIn?: string[];

  status?: RuleStatus;

  /** Free-form tags for strategy selection, e.g. `chat`, `chinese`, `rhythm`. */
  tags?: string[];
}

/** A rule as claimed by exactly one upstream, before deduplication. */
export interface RuleCandidate {
  /** The identifier the upstream itself uses, verbatim. */
  upstreamRuleId: string;
  /** Manifest key of the claiming upstream. */
  upstream: string;
  category: string;
  languages: string[];
  description: string;
  detection?: string;
  rewriteGuidance?: string;
  /** Upstream-native weight, if it states one. Normalised by the registry. */
  severity?: number;
  /**
   * Normalised dedupe key. Two candidates with the same signature and
   * language set describe the same underlying tell and must become one rule.
   */
  signature: string;
  locator?: string;
  quote?: string;
  tags?: string[];
  /** Phrases this upstream watches for the tell. Unioned at dedupe time. */
  watchPhrases?: WatchPhrase[];
  /** True when the upstream says the tell needs corroboration. */
  weakAlone?: boolean;
  /** Upstreams the content actually originated in, when that is not the claimant. */
  originatedIn?: string[];
}

export interface CanonicalRuleRegistrySnapshot {
  readonly schemaVersion: string;
  readonly generatedAt: string;
  readonly rules: readonly CanonicalRule[];
}

/** Current on-disk shape version for registry snapshots. */
export const RULE_REGISTRY_SCHEMA_VERSION = '1.0.0';

export function ruleLanguages(rule: CanonicalRule): Language[] {
  return rule.languages.filter((l): l is Language => l === 'zh' || l === 'en');
}

export function isScorable(rule: CanonicalRule): boolean {
  return rule.status !== 'deprecated' && rule.severity > 0;
}
