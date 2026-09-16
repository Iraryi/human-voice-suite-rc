/**
 * Rule-driven lexical detection.
 *
 * One detector serves every upstream, because it does not know about upstreams:
 * it reads each canonical rule's `watchPhrases` and matches them. That is the
 * payoff of extracting watched lists into the rule registry instead of porting
 * one detector per repository.
 *
 * What it deliberately does not do:
 *
 * - It does not use `template` phrases. Those are constructions such as
 *   `not X but Y` and need a pattern, not a string. They are detected by the
 *   structural and rhythm detectors.
 * - It does not use `reference` phrases. Those were classified as too short or
 *   too common to match safely.
 * - It does not decide whether a phrase is a tell in context. That is the
 *   suppression layer's job, and the two are deliberately separate so the
 *   policy can be reviewed on its own.
 */

import { CanonicalRuleRegistry } from '../../rules/canonical/registry.js';
import type { CanonicalRule, WatchPhrase } from '../../rules/types.js';
import type { Detector, DetectionContext, Finding, FindingEvidence } from '../types.js';
import { LOCAL_UPSTREAM } from '../../rules/provenance/types.js';
import { MIN_CJK_MATCH_LENGTH, isTooCommonToMatch } from '../../upstream/extract/phrase.js';
import { buildPhraseIndex, ownsPhrase } from '../../rules/dedupe/phrases.js';
import type { PhraseIndex } from '../../rules/dedupe/phrases.js';

/** Cap per rule so one repeated word cannot flood the result. */
export const MAX_EVIDENCE_PER_RULE = 5;

export interface PhrasePattern {
  readonly ruleId: string;
  readonly upstream: string;
  readonly phrase: WatchPhrase;
  readonly regex: RegExp;
  /**
   * 0..1. Lowered when the upstream attached a scope restriction we cannot
   * verify, such as `highlight (verb)` or `robust (figurative; keep technical
   * uses)`. Matching the letters is not the same as matching the usage.
   */
  readonly confidence: number;
}

const REGEX_METACHARACTERS = /[.*+?^${}()|[\]\\]/g;

function escapeLiteral(text: string): string {
  return text.replace(REGEX_METACHARACTERS, '\\$&');
}

function isMostlyCjk(text: string): boolean {
  let cjk = 0;
  let total = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    total += 1;
    if (ch.codePointAt(0)! >= 0x3000) cjk += 1;
  }
  return total > 0 && cjk / total >= 0.5;
}

/**
 * Expand one watched phrase into the variants the upstream wrote down.
 *
 * `gate/gated/gating` is three words. `intricate/intricacies` is two. The
 * upstream uses the slash to save space, not to mean a literal slash.
 */
export function expandVariants(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed.includes('/')) return [trimmed];
  const parts = trimmed
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : [trimmed];
}

function buildRegex(variants: readonly string[], cjk: boolean): RegExp {
  const alternation = variants.map(escapeLiteral).join('|');
  if (cjk) {
    // No word boundaries: Chinese has none, and a phrase like 值得注意的是 must
    // match wherever it appears.
    return new RegExp(`(?:${alternation})`, 'gu');
  }

  // Anchor only where the pattern actually ends in a word character.
  //
  // A blanket `\b` on both sides silently disabled every phrase ending in
  // punctuation: `\b(?:Great question!)\b` can never match, because `!` is not a
  // word character, so there is no boundary between it and the following space.
  // The corpus is full of such phrases — `Certainly!`, `Of course!`, `Read that
  // again.`, `Let that sink in.` — and all of them were dead.
  const startsWord = variants.every((variant) => /^\w/.test(variant));
  const endsWord = variants.every((variant) => /\w$/.test(variant));
  const prefix = startsWord ? '\\b' : '';
  const suffix = endsWord ? '\\b' : '';
  return new RegExp(`${prefix}(?:${alternation})${suffix}`, 'giu');
}

/** Phrases whose upstream note restricts scope are matched less confidently. */
function confidenceFor(phrase: WatchPhrase, variantCount: number): number {
  let confidence = 0.8;
  if (variantCount > 1) confidence -= 0.05;
  if (phrase.note) {
    // "verb", "abstract noun", "figurative; keep technical uses" — all say the
    // letters are not sufficient. We cannot check part of speech, so we lower
    // confidence rather than pretend.
    confidence -= 0.25;
  }
  if (phrase.text.split(/\s+/).length >= 3) confidence += 0.1;
  return Math.max(0.2, Math.min(0.95, Number(confidence.toFixed(2))));
}

/** Build matchable patterns from the registry. */
export function buildPhrasePatterns(
  rules: readonly CanonicalRule[],
  language: string,
  index?: PhraseIndex,
): PhrasePattern[] {
  const phraseIndex = index ?? buildPhraseIndex(rules);
  const excluded = new Set(phraseIndex.excludedRules);
  const patterns: PhrasePattern[] = [];

  for (const rule of rules) {
    if (!rule.languages.includes(language) && !rule.languages.includes('unknown')) continue;
    // A rule whose upstream gates it off matches nothing at all. Checking this
    // separately matters: a phrase only that rule claims is absent from the
    // index, and `ownsPhrase` treats an unindexed phrase as owned so that
    // nothing is silently dropped — which would have let the excluded rule
    // match exactly the phrases exclusion was meant to stop.
    if (excluded.has(rule.id)) continue;
    for (const phrase of rule.watchPhrases ?? []) {
      if (phrase.kind !== 'literal') continue;
      // Ownership: a phrase claimed by several rules belongs to one of them. The
      // others keep it in their data and do not match on it, so one phrase
      // produces one finding rather than one per rule that noticed it.
      if (!ownsPhrase(phraseIndex, phrase, rule.id)) continue;
      // Apply the same guard extraction uses. Adapters that classify their own
      // phrases bypass `classifyPhrase`, so `just` arrived here as matchable and
      // fired on ordinary English.
      if (isTooCommonToMatch(phrase.text)) continue;
      const variants = expandVariants(phrase.text);
      if (variants.length === 0) continue;
      const cjk = isMostlyCjk(phrase.text);
      // A CJK phrase must clear the match minimum; extraction keeps shorter
      // entries as a faithful record, the detector declines to use them.
      if (cjk && [...phrase.text].length < MIN_CJK_MATCH_LENGTH) continue;

      patterns.push({
        ruleId: rule.id,
        upstream: rule.sources[0]?.upstream ?? LOCAL_UPSTREAM,
        phrase,
        regex: buildRegex(variants, cjk),
        confidence: confidenceFor(phrase, variants.length),
      });
    }
  }

  return patterns;
}

export interface LexicalPlan {
  readonly index: PhraseIndex;
  readonly patterns: readonly PhrasePattern[];
}

/** Cache keyed by registry identity, so repeated scans do not rebuild regexes. */
const planCache = new WeakMap<CanonicalRuleRegistry, Map<string, LexicalPlan>>();

export function planFor(registry: CanonicalRuleRegistry, language: string): LexicalPlan {
  let byLanguage = planCache.get(registry);
  if (!byLanguage) {
    byLanguage = new Map();
    planCache.set(registry, byLanguage);
  }
  const cached = byLanguage.get(language);
  if (cached) return cached;

  const rules = registry.list();
  const index = buildPhraseIndex(rules);
  const plan: LexicalPlan = { index, patterns: buildPhrasePatterns(rules, language, index) };
  byLanguage.set(language, plan);
  return plan;
}

export interface LexicalDetectorOptions {
  /**
   * Rules to skip. Populated with the suppressed set when the caller wants the
   * suppression policy expressed as excluded rules rather than filtered
   * findings.
   */
  readonly excludeRuleIds?: ReadonlySet<string>;
}

export function createLexicalDetector(
  options: LexicalDetectorOptions = {},
): Detector {
  const exclude = options.excludeRuleIds ?? new Set<string>();

  return {
    id: 'lexical.watched_phrases',
    upstream: LOCAL_UPSTREAM,
    family: 'lexical',
    languages: ['en', 'zh', 'unknown'],
    status: 'ready',
    description:
      'Matches the literal watched phrases contributed by every upstream, read from the canonical rules rather than from any one repository.',
    detect(text: string, context: DetectionContext): Finding[] {
      const registry = context.rules;
      if (!registry) return [];

      const plan = planFor(registry, context.language);
      const byRule = new Map<string, PhrasePattern[]>();
      for (const pattern of plan.patterns) {
        if (exclude.has(pattern.ruleId)) continue;
        const bucket = byRule.get(pattern.ruleId);
        if (bucket) bucket.push(pattern);
        else byRule.set(pattern.ruleId, [pattern]);
      }

      const findings: Finding[] = [];
      const ceiling = context.maxFindings ?? 500;

      for (const [ruleId, rulePatterns] of byRule) {
        const rule = registry.get(ruleId);
        if (!rule) continue;

        const evidence: FindingEvidence[] = [];
        const matchedPhrases = new Set<string>();
        let totalHits = 0;
        let bestConfidence = 0;

        for (const pattern of rulePatterns) {
          pattern.regex.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = pattern.regex.exec(text)) !== null) {
            totalHits += 1;
            matchedPhrases.add(pattern.phrase.text);
            bestConfidence = Math.max(bestConfidence, pattern.confidence);
            if (evidence.length < MAX_EVIDENCE_PER_RULE) {
              evidence.push({
                start: match.index,
                end: match.index + match[0].length,
                text: match[0],
              });
            }
            if (match.index === pattern.regex.lastIndex) pattern.regex.lastIndex += 1;
          }
        }

        if (totalHits === 0) continue;

        findings.push({
          ruleId,
          canonicalRuleId: ruleId,
          upstream: rule.sources[0]?.upstream ?? LOCAL_UPSTREAM,
          detectorId: 'lexical.watched_phrases',
          category: rule.category,
          family: 'lexical',
          severity: rule.severity,
          languages: rule.languages,
          message: `${totalHits} watched phrase hit(s) across ${matchedPhrases.size} phrase(s): ${[...matchedPhrases].slice(0, 6).join(', ')}`,
          evidence,
          confidence: bestConfidence,
        });

        if (findings.length >= ceiling) break;
      }

      return findings;
    },
  };
}
