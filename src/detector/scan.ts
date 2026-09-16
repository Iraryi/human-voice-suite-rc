/**
 * Unified scan.
 *
 * This is the core of the `human_voice_scan` capability. It runs every
 * available detector, collapses the result onto canonical rules so that a tell
 * claimed by three upstreams is charged once, and reports the single score it
 * is entitled to report: `antiAIScore`.
 *
 * It deliberately does NOT report a blended "how human is this" number. See
 * `src/validation/types.ts` for why.
 */

import { computeTextStats, detectLanguage } from '../shared/text.js';
import type { TextStats } from '../shared/text.js';
import type { Language, TextMode } from '../shared/types.js';
import { CanonicalRuleRegistry } from '../rules/canonical/registry.js';
import type { Finding, Detector, DetectorFamily } from './types.js';
import { DETECTOR_CATALOG } from './catalog.js';
import { clampScore, assertNoBlendedScore } from '../validation/types.js';
import { ANTI_AI_FAMILIES } from '../validation/types.js';
import type { ScoreName, ScoreRationale, VoiceScoreSet } from '../validation/types.js';
import { applySuppression, weakAloneRuleIds, nonCorroboratingRuleIds } from './suppression.js';
import { DEFAULT_SUPPRESSION } from './suppression.js';
import type { SuppressionPolicy } from './suppression.js';
import { assessBehavior, behaviorFindings } from '../validation/behavior/index.js';
import type { BehaviorRuleHold } from '../validation/behavior/index.js';
import { compareToProfile } from '../voice/scoring/index.js';
import type { VoiceComparison } from '../voice/scoring/index.js';
import type { VoiceProfile } from '../voice/types.js';
import type { ConversationContext } from '../behavior/types.js';
import { compareText } from '../shared/order.js';

/**
 * How many full-strength findings it takes to drive `antiAIScore` to zero.
 * Chosen so the score is legible rather than precise: with a budget of 8,
 * one severity-5 finding at full confidence costs 0.125.
 */
export const ANTI_AI_PENALTY_BUDGET = 8;

export interface ScanOptions {
  readonly language?: Language;
  readonly mode?: TextMode;
  readonly locale?: string;
  readonly registry?: CanonicalRuleRegistry;
  readonly detectors?: readonly Detector[];
  readonly maxFindings?: number;
  /**
   * The upstream suppression policy. Applied after detection and before
   * scoring, so a suppressed finding never reaches a score.
   */
  readonly suppression?: SuppressionPolicy;
  /** Skip suppression entirely, for benchmarks that need raw detector output. */
  readonly disableSuppression?: boolean;
  /**
   * The voice profile to measure against. Without one, the stylometry detector
   * has no target and reports nothing.
   */
  readonly voiceProfile?: VoiceProfile;
  /**
   * The conversation the text sits in. Without it the assistant-behaviour
   * detector judges only what one reply can show and reports the rest as
   * unjudged rather than clean.
   */
  readonly conversation?: ConversationContext;
  /**
   * Run only these detector families.
   *
   * This exists so ablation can switch a layer off in the real code path rather
   * than in a reimplementation of it. A benchmark that reimplements the scanner
   * with a layer removed measures the reimplementation. `undefined` means every
   * family the supplied detectors cover.
   */
  readonly families?: readonly DetectorFamily[];
}

export interface SuppressedFinding {
  readonly finding: Finding;
  readonly reason: string;
}

export interface ScanResult {
  readonly language: Language;
  readonly mode: TextMode;
  readonly stats: TextStats;
  /** Raw detector output, before the suppression policy. */
  readonly findings: readonly Finding[];
  /**
   * Findings after collapsing onto canonical rules. Use this for scoring; use
   * `findings` for explanation.
   */
  readonly canonicalFindings: readonly Finding[];
  /** Everything the policy dropped, with the reason. Never scored, always visible. */
  readonly suppressed: readonly SuppressedFinding[];
  readonly byFamily: Readonly<Record<string, number>>;
  readonly byUpstream: Readonly<Record<string, number>>;
  readonly byRule: Readonly<Record<string, number>>;
  readonly detectorsRun: readonly string[];
  /** Catalog slots that exist but are not implemented yet. */
  readonly detectorsPlanned: readonly string[];
  /**
   * Behaviour rules that were evaluated and declined to decide, with the state that
   * stopped them.
   *
   * The third outcome, surfaced where a caller looks for results. Without it, a
   * context-dependent rule whose evidence is missing would be indistinguishable from
   * a rule that ran and matched nothing.
   */
  readonly behaviorAbstained: readonly BehaviorRuleHold[];
  /**
   * Behaviour rules the evidence ruled out before evaluation.
   *
   * Not the upstream suppression policy: those are `suppressed`, below.
   */
  readonly behaviorSuppressed: readonly BehaviorRuleHold[];
  readonly scores: VoiceScoreSet;
}

export async function scan(text: string, options: ScanOptions = {}): Promise<ScanResult> {
  const language = options.language ?? detectLanguage(text);
  const mode = options.mode ?? 'unknown';
  const registry = options.registry ?? new CanonicalRuleRegistry();
  const detectors = options.detectors ?? [];
  const maxFindings = options.maxFindings ?? 500;
  const policy = options.suppression ?? DEFAULT_SUPPRESSION;

  const stats = computeTextStats(text);
  const raw: Finding[] = [];
  const detectorsRun: string[] = [];
  const families = options.families ? new Set<string>(options.families) : undefined;

  for (const detector of detectors) {
    if (families && !families.has(detector.family)) continue;
    if (detector.languages.length > 0 && !detector.languages.includes(language)) {
      continue;
    }
    detectorsRun.push(detector.id);
    const produced = await detector.detect(text, {
      language,
      mode,
      ...(options.locale ? { locale: options.locale } : {}),
      rules: registry,
      maxFindings,
      ...(options.voiceProfile ? { voiceProfile: options.voiceProfile } : {}),
      ...(options.conversation ? { conversation: options.conversation } : {}),
    });
    for (const finding of produced) {
      raw.push(resolveFinding(finding, registry));
      if (raw.length >= maxFindings) break;
    }
    if (raw.length >= maxFindings) break;
  }

  const suppressed: SuppressedFinding[] = [];
  let considered = raw;

  if (!options.disableSuppression) {
    // Suppression runs before collapsing, because a weak-alone rule must not be
    // corroborated by another finding that itself only fired inside a quotation.
    const rules = registry.list();
    const result = applySuppression(
      raw,
      text,
      weakAloneRuleIds(rules),
      policy,
      // A voice-distance finding is not evidence about AI writing, so it may not
      // vouch for a tell that the upstream policy gates.
      { nonCorroborating: nonCorroboratingRuleIds(rules) },
    );
    considered = [...result.kept];
    suppressed.push(...result.suppressed);
  }

  const canonicalFindings = collapseToCanonical(considered);

  // Prose tells and behaviour tells are scored apart, on disjoint rule sets, so
  // that neither can hide behind the other. See `ANTI_AI_FAMILIES`.
  //
  // The `voice` tag forms a third disjoint set: a rule that measures distance
  // from a target profile is charged to `voiceScore` and to nothing else. It
  // would otherwise be deducted once for being off-voice and once again for
  // being a tell, which is the double-charging this project exists to remove.
  const proseFindings = canonicalFindings.filter(
    (finding) =>
      (ANTI_AI_FAMILIES as readonly string[]).includes(finding.family) &&
      !isVoiceTargetRule(finding, registry),
  );
  const behaviour = assessBehavior(
    canonicalFindings,
    options.conversation ?? {},
    !families || families.has('assistant'),
  );

  // A layer that was switched off must not report a score. The ablation harness
  // relies on this: `+anti-ai` without `+voice` has no target to measure against,
  // and reporting 1 would look like a perfect voice match.
  const voiceEnabled = (!families || families.has('stylometry')) && options.voiceProfile !== undefined;
  const voice = voiceEnabled
    ? compareToProfile(text, options.voiceProfile as VoiceProfile, { language, mode })
    : undefined;

  const unmeasured: ScoreName[] = [];
  // No profile at all, or a profile with nothing comparable in it: either way
  // `voiceScore` is 1 because nothing was measured, and it says so.
  if (!voice || voice.unmeasured) unmeasured.push('voiceScore');
  if (behaviour.unmeasured) unmeasured.push('behaviorScore');
  // `antiAIScore` is a prose score. With every prose family switched off — which
  // is what the `+voice` and `+behavior` ablation rows do — a 1 here means
  // "nothing looked", not "nothing found".
  if (families && !ANTI_AI_FAMILIES.some((family) => families.has(family))) {
    unmeasured.push('antiAIScore');
  }
  // A scan has one text, and preservation compares two. It is therefore never
  // measured here, and saying so is the difference between "nothing was lost" and
  // "nothing was compared". The benchmark harness adds this too; `composeScores`
  // de-duplicates, so it stays one entry.
  unmeasured.push('preservationScore');

  return {
    language,
    mode,
    stats,
    findings: raw,
    canonicalFindings,
    suppressed,
    byFamily: countBy(canonicalFindings, (f) => f.family),
    byUpstream: countBy(canonicalFindings, (f) => f.upstream),
    byRule: countBy(canonicalFindings, (f) => f.canonicalRuleId ?? f.ruleId),
    detectorsRun,
    detectorsPlanned: DETECTOR_CATALOG.filter((slot) => slot.status !== 'ready').map(
      (slot) => slot.id,
    ),
    behaviorAbstained: behaviour.abstained,
    behaviorSuppressed: behaviour.suppressed,
    scores: composeScores({
      antiAI: scoreAntiAI(proseFindings),
      behaviorScore: behaviour.behaviorScore,
      behaviorRationale: behaviour.rationale,
      voice,
      unmeasured,
    }),
  };
}

/**
 * True when a rule exists to measure distance from a voice profile rather than
 * to name a tell. Those rules are scored by `voiceScore` alone.
 */
export function isVoiceTargetRule(
  finding: Finding,
  registry: CanonicalRuleRegistry,
): boolean {
  const rule = registry.get(finding.canonicalRuleId ?? finding.ruleId);
  return rule?.tags?.includes('voice') ?? false;
}

interface ScoreInputs {
  readonly antiAI: VoiceScoreSet;
  readonly behaviorScore: number;
  readonly behaviorRationale: ScoreRationale;
  readonly voice: VoiceComparison | undefined;
  readonly unmeasured: readonly ScoreName[];
}

/** Fuse the four independent measurements into one set, without fusing the numbers. */
function composeScores(inputs: ScoreInputs): VoiceScoreSet {
  const scores: VoiceScoreSet = {
    antiAIScore: inputs.antiAI.antiAIScore,
    voiceScore: inputs.voice?.voiceScore ?? 1,
    behaviorScore: inputs.behaviorScore,
    preservationScore: 1,
    ...(inputs.unmeasured.length > 0 ? { unmeasured: [...inputs.unmeasured] } : {}),
    rationales: [
      ...inputs.antiAI.rationales,
      inputs.behaviorRationale,
      ...(inputs.voice ? [inputs.voice.rationale] : []),
    ],
  };
  assertNoBlendedScore(scores);
  return scores;
}

/**
 * Attach the canonical rule id when the registry knows the rule.
 *
 * This is the mechanism that stops `blader rule 12`, `ai-humanizer rule 22` and
 * `humanizer-zh rule 9` from being three separate deductions.
 */
export function resolveFinding(
  finding: Finding,
  registry: CanonicalRuleRegistry,
): Finding {
  if (finding.canonicalRuleId) return finding;

  let canonical = registry.get(finding.ruleId)?.id;
  if (!canonical) {
    canonical = registry.resolveUpstreamRule(finding.upstream, finding.ruleId)?.id;
  }
  if (!canonical) return finding;

  return { ...finding, canonicalRuleId: canonical };
}

/**
 * Collapse findings onto canonical rules, keeping the strongest claim per rule
 * and merging the evidence so nothing is hidden by the collapse.
 */
export function collapseToCanonical(findings: readonly Finding[]): Finding[] {
  const byRule = new Map<string, Finding>();

  for (const finding of findings) {
    const key = finding.canonicalRuleId ?? finding.ruleId;
    const existing = byRule.get(key);
    if (!existing) {
      byRule.set(key, finding);
      continue;
    }
    const stronger =
      finding.severity > existing.severity ||
      (finding.severity === existing.severity && finding.confidence > existing.confidence);
    byRule.set(key, {
      ...(stronger ? finding : existing),
      evidence: [...existing.evidence, ...finding.evidence].slice(0, 20),
      confidence: Math.max(existing.confidence, finding.confidence),
    });
  }

  return [...byRule.values()].sort(
    (a, b) => b.severity - a.severity || compareText(a.ruleId, b.ruleId),
  );
}

export function scoreAntiAI(findings: readonly Finding[]): VoiceScoreSet {
  let penalty = 0;
  const contributions: Array<{
    label: string;
    value: number;
    weight: number;
    evidence?: string;
  }> = [];

  for (const finding of findings) {
    const weight = (finding.severity / 5) * finding.confidence;
    penalty += weight;
    contributions.push({
      label: finding.canonicalRuleId ?? finding.ruleId,
      value: Number(weight.toFixed(4)),
      weight: finding.severity,
      evidence: finding.evidence[0]?.text.slice(0, 80) ?? finding.message,
    });
  }

  const antiAIScore = clampScore(1 - penalty / ANTI_AI_PENALTY_BUDGET);

  const rationale: ScoreRationale = {
    score: 'antiAIScore',
    summary:
      findings.length === 0
        ? 'No detector fired.'
        : `${findings.length} canonical rule(s) fired, total penalty ${penalty.toFixed(3)} against a budget of ${ANTI_AI_PENALTY_BUDGET}.`,
    contributions: contributions.sort((a, b) => b.value - a.value).slice(0, 50),
  };

  return {
    antiAIScore,
    voiceScore: 1,
    behaviorScore: 1,
    preservationScore: 1,
    rationales: [rationale],
  };
}

function countBy<T>(values: readonly T[], key: (value: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const value of values) {
    const k = key(value);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
