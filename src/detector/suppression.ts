/**
 * Suppression.
 *
 * `blader/humanizer` ships a policy it calls "When not to act", and five of its
 * patterns are marked `*weak alone*`. That policy is the difference between a
 * detector that is useful and one that fires on every careful piece of writing,
 * so it is imported as a first-class layer rather than folded into a threshold.
 *
 * The policy has three parts, quoted from the upstream:
 *
 * 1. "Act on a *weak alone* tell only when several tells share a passage."
 * 2. "Leave a watched phrase alone inside a quotation, a title, a proper name,
 *    or a passage that discusses the phrase rather than uses it."
 * 3. "Text written before November 30, 2022 is not AI-written."
 *
 * Importing the weak-alone patterns as ordinary detectors — which is what a
 * naive port does — raises false positives sharply. See `UPSTREAM_INVENTORY.md`
 * §4.2.
 */

import type { Finding } from './types.js';

export interface SuppressionPolicy {
  /**
   * How many distinct non-weak-alone rules must fire before a weak-alone rule
   * may fire. One is the upstream's own bar: "several tells share a passage".
   */
  readonly weakAloneCorroboration: number;
  readonly exemptQuotations: boolean;
  readonly exemptTitles: boolean;
  readonly exemptProperNames: boolean;
  /**
   * Skip suppression entirely when the caller knows the text predates
   * large-scale AI writing. The upstream dates that at 2022-11-30.
   */
  readonly predatesAiWriting: boolean;
}

export const DEFAULT_SUPPRESSION: SuppressionPolicy = {
  // Two, not one: "several" in the upstream's own wording, and a single
  // unrelated hit elsewhere in a long document is not corroboration.
  weakAloneCorroboration: 2,
  exemptQuotations: true,
  exemptTitles: true,
  exemptProperNames: true,
  predatesAiWriting: false,
};

/** The date the upstream names as the boundary for AI-written text. */
export const AI_WRITING_EPOCH = '2022-11-30';

export interface Span {
  readonly start: number;
  readonly end: number;
  readonly reason: 'quotation' | 'code' | 'title' | 'proper-name';
}

/**
 * Find spans a watched phrase must not be flagged inside.
 *
 * Deliberately limited to what can be detected reliably. The upstream also
 * exempts "a passage that discusses the phrase rather than uses it", which is a
 * semantic judgement; that case is approximated by the quotation rule and is
 * recorded as a known gap in `docs/behavior-engine.md` rather than guessed at.
 */
export function findExemptSpans(
  text: string,
  policy: SuppressionPolicy = DEFAULT_SUPPRESSION,
): Span[] {
  const spans: Span[] = [];

  const collect = (pattern: RegExp, reason: Span['reason']): void => {
    const scanner = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = scanner.exec(text)) !== null) {
      spans.push({ start: match.index, end: match.index + match[0].length, reason });
      if (scanner.lastIndex === match.index) scanner.lastIndex += 1;
    }
  };

  // Code is always exempt: a watched word inside a code block is not prose.
  collect(/```[\s\S]*?```/g, 'code');
  collect(/`[^`\n]+`/g, 'code');

  if (policy.exemptQuotations) {
    collect(/\u201c[^\u201d\n]*\u201d/g, 'quotation');
    collect(/\u300c[^\u300d\n]*\u300d/g, 'quotation');
    collect(/"[^"\n]{2,400}"/g, 'quotation');
  }

  if (policy.exemptTitles) {
    collect(/\u300a[^\u300b\n]*\u300b/g, 'title');
    collect(/^#{1,6} .*$/gm, 'title');
    // Title Case runs of three or more words, the shape of a document title.
    //
    // `[ \t]` rather than `\s`: a whitespace class that includes the newline
    // lets the run walk out of the title and into the paragraph below, and the
    // over-wide span then exempts real findings in that paragraph. That is
    // exactly what happened to "Let's dive" sitting under a Title Case heading.
    collect(/\b(?:[A-Z][a-z]+[ \t]+){2,}[A-Z][a-z]+\b/g, 'title');
  }

  if (policy.exemptProperNames) {
    // A capitalised run immediately after a title or honorific.
    collect(/\b(?:Mr|Mrs|Ms|Dr|Prof|Sir)\.?\s+[A-Z][a-z]+/g, 'proper-name');
  }

  return spans.sort((a, b) => a.start - b.start);
}

export function isInsideSpan(offset: number, spans: readonly Span[]): Span | undefined {
  for (const span of spans) {
    if (offset >= span.start && offset < span.end) return span;
  }
  return undefined;
}

export interface SuppressionResult {
  readonly kept: readonly Finding[];
  readonly suppressed: ReadonlyArray<{ readonly finding: Finding; readonly reason: string }>;
  readonly corroboratingRuleCount: number;
}

/**
 * Rules that may not corroborate a weak-alone tell.
 *
 * Phase 8 fix, driven by the benchmark. Corroboration originally counted any
 * non-weak-alone rule that fired anywhere in the text, which let a *voice
 * distance* finding — `stylometry.fingerprint_punctuation`, say — corroborate a
 * prose tell. That is incoherent: the weak-alone policy exists because some tells
 * are weak evidence **of AI writing**, and being far from one person's voice
 * profile is not evidence of AI writing at all. It is not even evidence about
 * authorship; it says the text is not that writer, which is true of almost
 * everything.
 *
 * The practical effect was that a noisy voice rule propped up prose rules the
 * upstream deliberately gated, so fixing the noisy rule silently changed which
 * prose tells survived. This makes the separation explicit instead.
 */
export function nonCorroboratingRuleIds(
  rules: ReadonlyArray<{ id: string; tags?: readonly string[] }>,
): Set<string> {
  return new Set(
    rules.filter((rule) => rule.tags?.includes('voice') === true).map((rule) => rule.id),
  );
}

export interface SuppressionOptions {
  /**
   * Rule ids that can be suppressed but never corroborate. Voice-distance rules,
   * by default policy. See `nonCorroboratingRuleIds`.
   */
  readonly nonCorroborating?: ReadonlySet<string>;
}

/**
 * Apply the policy to a set of findings.
 *
 * Order matters. Exempt spans are removed first, because a weak-alone rule that
 * only fired inside a quotation must not then count as corroboration for
 * another weak-alone rule.
 */
export function applySuppression(
  findings: readonly Finding[],
  text: string,
  weakAloneRuleIds: ReadonlySet<string>,
  policy: SuppressionPolicy = DEFAULT_SUPPRESSION,
  options: SuppressionOptions = {},
): SuppressionResult {
  const suppressed: Array<{ finding: Finding; reason: string }> = [];
  const surviving: Finding[] = [];

  const spans = policy.predatesAiWriting ? [] : findExemptSpans(text, policy);

  for (const finding of findings) {
    const ruleId = finding.canonicalRuleId ?? finding.ruleId;

    const exempt = finding.evidence
      .map((evidence) => isInsideSpan(evidence.start, spans))
      .find((span) => span !== undefined);

    if (exempt) {
      suppressed.push({
        finding,
        reason: `inside a ${exempt.reason} at ${exempt.start}-${exempt.end}`,
      });
      continue;
    }

    surviving.push(finding);
  }

  // Corroboration counts distinct rules that are neither weak alone themselves
  // nor measuring distance from a voice profile.
  const nonCorroborating = options.nonCorroborating ?? new Set<string>();
  const corroborating = new Set<string>();
  for (const finding of surviving) {
    const ruleId = finding.canonicalRuleId ?? finding.ruleId;
    if (!weakAloneRuleIds.has(ruleId) && !nonCorroborating.has(ruleId)) {
      corroborating.add(ruleId);
    }
  }

  if (policy.predatesAiWriting || corroborating.size >= policy.weakAloneCorroboration) {
    return { kept: surviving, suppressed, corroboratingRuleCount: corroborating.size };
  }

  const kept: Finding[] = [];
  for (const finding of surviving) {
    const ruleId = finding.canonicalRuleId ?? finding.ruleId;
    if (weakAloneRuleIds.has(ruleId)) {
      suppressed.push({
        finding,
        reason:
          `${ruleId} is weak alone and only ${corroborating.size} other rule(s) fired; ` +
          `${policy.weakAloneCorroboration} needed`,
      });
      continue;
    }
    kept.push(finding);
  }

  return { kept, suppressed, corroboratingRuleCount: corroborating.size };
}

/** Rule ids the registry marks as needing corroboration. */
export function weakAloneRuleIds(
  rules: ReadonlyArray<{ id: string; weakAlone?: boolean }>,
): Set<string> {
  return new Set(rules.filter((rule) => rule.weakAlone === true).map((rule) => rule.id));
}
