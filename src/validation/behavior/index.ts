/**
 * Behaviour validation.
 *
 * `behaviorScore` answers one question and refuses to answer any other: does
 * this reply behave the way a person behaves in a conversation, or the way an
 * assistant does?
 *
 * It is deliberately not a second lexical score. A reply can be lexically
 * immaculate — no AI vocabulary, no em dash, no bold, no bullet list — and still
 * mirror, agree, summarise, offer help and explain what nobody asked about. The
 * flagship case in `benchmarks/corpora/ai-pretending-casual/` is exactly that,
 * and it is the reason this layer exists.
 *
 * Two properties make the score honest rather than decorative:
 *
 * **It counts canonical rules, once each.** The assistant smells are canonical
 * rules in their own right (`chat.over_agreement` and so on), so a smell found
 * by two detectors is still one deduction. The collapse happens upstream in
 * `collapseToCanonical`, and this module consumes the collapsed list.
 *
 * **It says what it could not judge.** Mirroring is a relationship between two
 * turns and over-completeness is a ratio between the question and the answer.
 * With no user turn, two of the ten are unjudgeable, and a score that silently
 * treated "could not tell" as "clean" would be worse than no score at all.
 */

import { ASSISTANT_SMELLS, getAssistantSmell } from '../../behavior/types.js';
import type { AssistantSmellId, ConversationContext } from '../../behavior/types.js';
import { describeAdvicePermission, resolveAdvicePermission } from '../../behavior/permission/index.js';
import type { AdvicePermissionReading } from '../../behavior/permission/index.js';
import type { Finding } from '../../detector/types.js';
import { clampScore } from '../types.js';
import type { ScoreRationale, ValidationIssue } from '../types.js';

export const AREA = 'validation.behavior';
export const TARGET_PHASE = 5;

/**
 * How many full-strength smells it takes to drive `behaviorScore` to zero.
 *
 * Smaller than the anti-AI budget of 8 on purpose. The ten smells are not
 * independent observations of one property: three of them at once is not "a
 * third of the way to machine-shaped", it is a reply that is behaving like an
 * assistant. A budget of 3 makes one smell cost a third and three cost the
 * reply. Like every budget in this project it is a legibility choice, not a
 * measurement.
 */
export const BEHAVIOR_PENALTY_BUDGET = 3;

export interface BehaviorAssessment {
  /**
   * 0..1. Higher is better: the reply behaves like a person, as far as the
   * available context allows the ten behaviours to be judged.
   */
  readonly behaviorScore: number;
  /**
   * Whether the assistant detector ran at all. When it did not — because an
   * ablation switched the layer off — the score is 1 and means nothing, and
   * `unmeasured` says so.
   */
  readonly unmeasured: boolean;
  /** How many of the ten behaviours the available context allowed judging. */
  readonly judgedCount: number;
  /**
   * The behaviours that could not be judged. Non-empty means the score is a
   * lower bound on the evidence, not a clean bill of health.
   */
  readonly unjudged: readonly AssistantSmellId[];
  /**
   * The behaviours that were evaluated and declined to decide, with the state that
   * stopped them.
   *
   * The third outcome. `chat.unsolicited_advice` with an unknown advice permission
   * lands here rather than in `findings` or in silence, because "nobody established
   * whether advice was invited" is not "no advice was found".
   */
  readonly abstained: readonly BehaviorRuleHold[];
  /** The behaviours the evidence ruled out before evaluation, and why. */
  readonly suppressed: readonly BehaviorRuleHold[];
  /** Canonical assistant findings, strongest first. */
  readonly findings: readonly Finding[];
  readonly rationale: ScoreRationale;
}

/** A rule the detector did not evaluate, with the state that decided it. */
export interface BehaviorRuleHold {
  readonly ruleId: AssistantSmellId;
  /** `abstained` — not enough evidence; `suppressed` — evidence ruled the rule out. */
  readonly outcome: 'abstained' | 'suppressed';
  readonly reason: string;
  readonly state: string;
  readonly source: string;
  readonly signals: readonly string[];
}

/**
 * The two smells that need the turn before them.
 *
 * Kept as data rather than inferred from the detector so that a caller can see
 * the reason, and so a test can assert the reason is the same one the detector
 * gives in `unjudgedSmells()`.
 */
export const CONTEXT_DEPENDENT_SMELLS: readonly AssistantSmellId[] = [
  'chat.mirrors_user',
  'chat.over_completeness',
];

/** Smells this assessment could not judge, given the conversation it was handed. */
export function unjudgedBehaviors(context: ConversationContext = {}): AssistantSmellId[] {
  return context.userTurn === undefined ? [...CONTEXT_DEPENDENT_SMELLS] : [];
}

/**
 * Smells the evidence left undecided for this conversation.
 *
 * Derived through the same resolver the detector uses, and asserted against the
 * detector's own list by `tests/behavior-advice-permission.test.ts`, so a report
 * cannot claim a rule abstained while the detector quietly fired it.
 */
export function abstainedBehaviors(context: ConversationContext = {}): BehaviorRuleHold[] {
  return holds(context).filter((entry) => entry.outcome === 'abstained');
}

/** Smells this conversation ruled out before they were evaluated. */
export function suppressedBehaviors(context: ConversationContext = {}): BehaviorRuleHold[] {
  return holds(context).filter((entry) => entry.outcome === 'suppressed');
}

function adviceReading(context: ConversationContext): AdvicePermissionReading {
  return resolveAdvicePermission({
    ...(context.advicePermission !== undefined
      ? { advicePermission: context.advicePermission }
      : {}),
    ...(context.solutionPermission !== undefined
      ? { solutionPermission: context.solutionPermission }
      : {}),
    ...(context.requestKind !== undefined ? { requestKind: context.requestKind } : {}),
  });
}

function holds(context: ConversationContext): BehaviorRuleHold[] {
  const advice = adviceReading(context);
  if (advice.advicePermission === 'absent') return [];
  const outcome = advice.advicePermission === 'granted' ? 'suppressed' : 'abstained';
  return [
    {
      ruleId: 'chat.unsolicited_advice',
      outcome,
      reason: `${describeAdvicePermission(advice)}. ${advice.note}`,
      state: advice.advicePermission,
      source: advice.source,
      signals: advice.signals,
    },
  ];
}

/** Pick the assistant-family findings out of a scan's canonical findings. */
export function behaviorFindings(findings: readonly Finding[]): Finding[] {
  const smellIds = new Set<string>(ASSISTANT_SMELLS.map((smell) => smell.id as string));
  return findings.filter(
    (finding) =>
      finding.family === 'assistant' ||
      smellIds.has(finding.canonicalRuleId ?? finding.ruleId),
  );
}

/**
 * Score the behaviour of one reply.
 *
 * `findings` is expected to be a scan's `canonicalFindings`, so that this layer
 * inherits the collapse and cannot double-charge a smell. `ran` is false when
 * the assistant detector was switched off, which is how an ablation reports "not
 * measured" rather than the perfect score it did not earn.
 */
export function assessBehavior(
  findings: readonly Finding[],
  context: ConversationContext = {},
  ran = true,
): BehaviorAssessment {
  const smells = behaviorFindings(findings);
  const unjudged = unjudgedBehaviors(context);
  const held = holds(context);
  const abstained = held.filter((entry) => entry.outcome === 'abstained');
  const suppressed = held.filter((entry) => entry.outcome === 'suppressed');
  // A rule that abstained was not judged, and saying so is the point: a count that
  // included it would describe a measurement nobody made.
  const judgedCount = ASSISTANT_SMELLS.length - unjudged.length - abstained.length;

  // Only class A contributes. A smell is class A when it is `discriminating` — reviewed, with human
  // false-positive evidence and machine positive evidence. Everything else is reported, reported
  // *as what it is*, and charged to nothing: `descriptive` (real information, specificity too low to
  // charge), `shadow` (not validated, or dependent on input nothing supplies), `hypothesis`, and
  // `deprecated-candidate` (the code stays, the claim does not).
  //
  // The alternative — shrinking a demoted rule's weight until it hardly matters — would leave the
  // score composed of evidence of four different maturities and answer "what does this number mean"
  // with "several things". See benchmarks/external/RULE_STATUS_DECISION.md.
  const classOf = (ruleId: string): string => getAssistantSmell(ruleId)?.scoring ?? 'discriminating';
  const isContributing = (ruleId: string): boolean => classOf(ruleId) === 'discriminating';

  const contributions = smells
    .filter((finding) => isContributing(finding.canonicalRuleId ?? finding.ruleId))
    .map((finding) => {
      const ruleId = finding.canonicalRuleId ?? finding.ruleId;
      const smell = getAssistantSmell(ruleId);
      const weight = (finding.severity / 5) * finding.confidence;
      return {
        label: ruleId,
        value: Number(weight.toFixed(4)),
        weight: finding.severity,
        evidence: finding.evidence[0]?.text.slice(0, 80) ?? finding.message,
        severity: smell?.severity ?? finding.severity,
      };
    });

  /** Reported smells that charge nothing, with the class that explains why. */
  const unscored = smells
    .filter((finding) => !isContributing(finding.canonicalRuleId ?? finding.ruleId))
    .map((finding) => {
      const ruleId = finding.canonicalRuleId ?? finding.ruleId;
      return { label: ruleId, class: classOf(ruleId), note: getAssistantSmell(ruleId)?.scoringNote };
    });

  const penalty = contributions.reduce((total, entry) => total + entry.value, 0);
  const behaviorScore = ran ? clampScore(1 - penalty / BEHAVIOR_PENALTY_BUDGET) : 1;

  return {
    behaviorScore,
    unmeasured: !ran,
    judgedCount,
    unjudged,
    abstained,
    suppressed,
    findings: smells,
    rationale: {
      score: 'behaviorScore',
      summary: ran
        ? summarise(smells.length, penalty, judgedCount, unjudged, unscored, held)
        : 'Not measured: the assistant-behaviour layer did not run.',
      // The contract of the number, printed wherever the number is: a behaviorScore is the sum over
      // these rules and nothing else.
      contributors: contributions.map((entry) => entry.label),
      contributions: contributions
        .map(({ severity: _severity, ...entry }) => entry)
        .sort((a, b) => b.value - a.value),
      unscored,
      ...(abstained.length > 0
        ? {
            abstained: abstained.map((entry) => ({
              label: entry.ruleId,
              reason: entry.reason,
              state: entry.state,
              source: entry.source,
            })),
          }
        : {}),
      ...(suppressed.length > 0
        ? {
            suppressed: suppressed.map((entry) => ({
              label: entry.ruleId,
              reason: entry.reason,
              state: entry.state,
              source: entry.source,
            })),
          }
        : {}),
    },
  };
}

function summarise(
  smellCount: number,
  penalty: number,
  judgedCount: number,
  unjudged: readonly AssistantSmellId[],
  unscored: ReadonlyArray<{ label: string; class: string }> = [],
  held: readonly BehaviorRuleHold[] = [],
): string {
  const budget = `budget ${BEHAVIOR_PENALTY_BUDGET}`;
  const judged = `${judgedCount} of ${ASSISTANT_SMELLS.length} behaviours judgeable`;
  const caveat =
    unjudged.length === 0
      ? ''
      : `; ${unjudged.join(' and ')} could not be judged without the user turn`;
  const reported =
    unscored.length === 0
      ? ''
      : `; reported and not charged: ${[...new Set(unscored.map((entry) => `${entry.label} (${entry.class})`))].join(', ')}`;
  // Named with the state that decided it. "Not evaluated" and "evaluated and found
  // nothing" must never print the same way.
  const undecided = held
    .map((entry) => `${entry.ruleId} ${entry.outcome} on ${entry.state} advice permission`)
    .join(', ');
  const undecidedText = undecided.length === 0 ? '' : `; ${undecided}`;

  if (smellCount === 0) {
    return `No assistant smell found among ${judged}${caveat}${reported}${undecidedText}.`;
  }
  return `${smellCount} assistant smell(s) found, total penalty ${penalty.toFixed(3)} against ${budget}; ${judged}${caveat}${reported}${undecidedText}.`;
}

/**
 * Behaviour issues for the validation surface: what is still wrong with the
 * rewrite, phrased as something an agent can act on.
 */
export function behaviorIssues(assessment: BehaviorAssessment): ValidationIssue[] {
  return assessment.findings.map((finding) => ({
    kind: 'behavior-violation' as const,
    severity: finding.severity,
    message: `Assistant behaviour survived the rewrite: ${finding.message}`,
    ...(finding.evidence[0]?.text ? { evidence: finding.evidence[0].text } : {}),
    score: 'behaviorScore' as const,
  }));
}

/**
 * Compare two replies' behaviour, which is what `validate` actually wants to
 * know: did the rewrite make the behaviour better, worse, or leave it alone?
 */
export interface BehaviorComparison {
  readonly before: BehaviorAssessment;
  readonly after: BehaviorAssessment;
  /** Positive means the rewrite behaved more like a person. */
  readonly delta: number;
  readonly regression: boolean;
}

/** A rewrite that loses this much behaviour score is a regression, not a trade-off. */
export const BEHAVIOR_REGRESSION_TOLERANCE = 0.05;

export function compareBehavior(
  before: BehaviorAssessment,
  after: BehaviorAssessment,
): BehaviorComparison {
  const delta = after.behaviorScore - before.behaviorScore;
  return {
    before,
    after,
    delta,
    regression: delta < -BEHAVIOR_REGRESSION_TOLERANCE,
  };
}
