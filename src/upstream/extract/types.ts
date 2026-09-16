/**
 * The rule-extraction contract.
 *
 * Every adapter turns its upstream into `ExtractedRule[]`. That intermediate
 * shape is deliberately richer than `RuleCandidate`: it keeps the watched
 * phrases and the before/after examples, which the lexical detector and the
 * benchmark need, and which would be lost if an adapter produced candidates
 * directly.
 *
 * Extraction runs against a pinned clone. The result is committed as
 * `<adapter>/rules.generated.json` so that the published package carries the
 * rules with their provenance and does not need the clone at run time. See
 * `docs/provenance-policy.md`.
 */

import type { PhraseKind, RuleCandidate, WatchPhrase } from '../../rules/types.js';

// The phrase shape is a rule-level concept, so it lives in `rules/types.ts` and
// is re-exported here for adapters. Keeping one definition is what lets the
// canonical rule carry its watched phrases through deduplication.
export type { PhraseKind, WatchPhrase };

/** How a watched phrase can be matched. See `PhraseKind` in `rules/types.ts`. */
export type PhraseClassification = PhraseKind | 'unclassified';

export interface RuleExample {
  readonly before: string;
  readonly after: string;
  /** The upstream's own label, e.g. "split across sentences". */
  readonly note?: string;
}

export interface ExtractedRule {
  /** The identifier the upstream itself uses. Verbatim. */
  readonly upstreamRuleId: string;
  /**
   * Canonical signature from the upstream's own signature map. Two upstreams
   * detecting the same tell must emit the same signature.
   */
  readonly signature: string;
  /** True when the signature came from the map rather than a fallback. */
  readonly signatureMapped: boolean;
  readonly title: string;
  /** Coarse bucket, normalised to the suite's taxonomy where possible. */
  readonly category: string;
  readonly languages: readonly string[];
  readonly description: string;
  /** Machine-checkable detection spec, when the upstream states one. */
  readonly detection?: string;
  readonly rewriteGuidance: string;
  readonly severity: number;
  readonly watchPhrases: readonly WatchPhrase[];
  readonly examples: readonly RuleExample[];
  /**
   * True when the upstream says this tell needs corroboration before acting.
   * Imported into the suppression layer rather than ignored.
   */
  readonly weakAlone: boolean;
  /** Where in the upstream this came from, e.g. `SKILL.md:162`. */
  readonly locator: string;
  /** A short verbatim quote, for auditability. */
  readonly quote?: string;
  /**
   * Set when the content originated in a different upstream than the one being
   * parsed. Used for the ai-humanizer / stop-slop case, so that the pair is
   * never attributed twice and never counted as two discoveries.
   */
  readonly originatedIn?: string;
  /** Provenance notes, especially about scope changes made on import. */
  readonly notes?: readonly string[];
}

export interface ExtractionResult {
  /** Manifest key of the adapter that produced this. */
  readonly upstream: string;
  /** The commit the extraction ran against. */
  readonly sourceCommit: string;
  readonly extractedAt: string;
  /** Where the rules came from, for a reader of the generated file. */
  readonly sources: readonly string[];
  readonly rules: readonly ExtractedRule[];
  /**
   * Anything the parser could not handle. A non-empty `warnings` is a signal
   * that a human should look; it fails `npm run upstream:extract` on purpose.
   */
  readonly warnings: readonly string[];
  /**
   * Deliberate decisions recorded for the reader, not defects.
   *
   * `humanize-text` documents eight techniques it never implemented and ships a
   * remote translation chain that must not become a strategy. Those absences are
   * worth writing down, but they are not problems and must not fail the build —
   * which is exactly why they are a separate field from `warnings`.
   */
  readonly disclosures?: readonly string[];
}

export const EXTRACTION_SCHEMA_VERSION = '1.0.0';

export interface ExtractionFile {
  readonly schemaVersion: string;
  readonly result: ExtractionResult;
}

/**
 * Convert extracted rules into dedupe input.
 *
 * The signature is the dedupe key, so this is where a lineage stops being
 * counted more than once.
 */
export function toRuleCandidates(result: ExtractionResult): RuleCandidate[] {
  return result.rules.map((rule) => ({
    upstreamRuleId: rule.upstreamRuleId,
    upstream: result.upstream,
    category: rule.category,
    languages: [...rule.languages],
    description: rule.description,
    ...(rule.detection ? { detection: rule.detection } : {}),
    rewriteGuidance: rule.rewriteGuidance,
    severity: rule.severity,
    signature: rule.signature,
    locator: rule.locator,
    ...(rule.quote ? { quote: rule.quote } : {}),
    tags: deriveTags(rule),
    ...(rule.watchPhrases.length > 0 ? { watchPhrases: [...rule.watchPhrases] } : {}),
    ...(rule.weakAlone ? { weakAlone: true } : {}),
    ...(rule.originatedIn ? { originatedIn: [rule.originatedIn] } : {}),
  }));
}

function deriveTags(rule: ExtractedRule): string[] {
  const tags = new Set<string>();
  if (rule.weakAlone) tags.add('weak-alone');
  if (rule.originatedIn) tags.add('inherited');
  for (const language of rule.languages) tags.add(language);
  return [...tags];
}

/** Rules the upstream marks as needing corroboration. */
export function weakAloneRules(result: ExtractionResult): ExtractedRule[] {
  return result.rules.filter((rule) => rule.weakAlone);
}

/**
 * Warnings plus unmapped signatures: everything that should stop a build.
 *
 * Deliberate disclosures are excluded. A technique the upstream documented but
 * never implemented is worth recording and is not a defect in this parser.
 */
export function extractionProblems(result: ExtractionResult): string[] {
  const problems = [...result.warnings];
  for (const rule of result.rules) {
    if (!rule.signatureMapped) {
      problems.push(
        `${result.upstream}#${rule.upstreamRuleId} (${rule.title}) has no signature mapping; ` +
          `fell back to ${rule.signature}`,
      );
    }
  }
  return problems;
}

/** Deliberate decisions worth printing but not worth failing on. */
export function extractionDisclosures(result: ExtractionResult): string[] {
  return [...(result.disclosures ?? [])];
}
