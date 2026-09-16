/**
 * Validation and scoring.
 *
 * The suite reports FOUR separate scores and refuses to fuse them.
 *
 * A single "97% human" number is worse than useless: it hides which layer is
 * failing, it can be gamed, and it invites the reader to treat a heuristic as a
 * measurement. Four scores tell you whether anti-AI rewriting worked, whether
 * the voice matched, whether the behaviour matched, and whether the rewrite
 * destroyed the content — and those are genuinely different questions.
 */

import type { Finding } from '../detector/types.js';
import type { PreserveDirective } from '../rewrite/types.js';

export const SCORE_NAMES = [
  'antiAIScore',
  'voiceScore',
  'behaviorScore',
  'preservationScore',
] as const;

export type ScoreName = (typeof SCORE_NAMES)[number];

/**
 * Names that must never appear in suite output. Kept as a list so a test can
 * enforce the prohibition mechanically rather than relying on discipline.
 */
export const FORBIDDEN_BLENDED_SCORE_KEYS = [
  'humanScore',
  'humanPercentage',
  'humanLikeness',
  'overallHumanScore',
  'aiProbability',
  'blendedScore',
] as const;

export interface ScoreRationale {
  readonly score: ScoreName;
  /** 0..1. Where the score came from, in one line. */
  readonly summary: string;
  /**
   * Which rules this score is the sum over, and nothing else.
   *
   * `behaviorScore` admits class A only: reviewed constructs, with human false-positive evidence and
   * machine positive evidence. Naming them here is what lets a reader answer "what does this number
   * mean" without reading the taxonomy. Absent for scores that are not composed rule by rule.
   */
  readonly contributors?: readonly string[];
  /** Rules that were found and deliberately charged nothing, with the class that explains why. */
  readonly unscored?: ReadonlyArray<{
    readonly label: string;
    readonly class: string;
    readonly note?: string;
  }>;
  /**
   * Rules that were evaluated and declined to decide, with the state that stopped them.
   *
   * The third outcome, beside "found" and "not found". A context-dependent rule whose
   * evidence is missing abstains, and an abstention is neither a firing nor a pass:
   * `chat.unsolicited_advice` with `advicePermission: 'unknown'` is listed here, and a
   * reader who sees an empty finding list plus this entry knows the rule did not look,
   * not that it looked and found nothing.
   */
  readonly abstained?: ReadonlyArray<{
    readonly label: string;
    readonly reason: string;
    readonly state?: string;
    readonly source?: string;
  }>;
  /**
   * Rules that were ruled out before evaluation, with the evidence that ruled them out.
   *
   * Reported rather than dropped, so that "the gate said the user asked for this" is
   * distinguishable from "the detector matched nothing". These are not suppressions by
   * the upstream suppression policy; that list lives on the scan result.
   */
  readonly suppressed?: ReadonlyArray<{
    readonly label: string;
    readonly reason: string;
    readonly state?: string;
    readonly source?: string;
  }>;
  /** The individual contributions, so the number is never a black box. */
  readonly contributions: ReadonlyArray<{
    readonly label: string;
    readonly value: number;
    readonly weight: number;
    readonly evidence?: string;
  }>;
}

export interface VoiceScoreSet {
  /** 0..1. Higher is better: fewer surviving AI tells. */
  readonly antiAIScore: number;
  /** 0..1. Higher is better: closer to the target voice profile. */
  readonly voiceScore: number;
  /** 0..1. Higher is better: chat behaviour matches human norms. */
  readonly behaviorScore: number;
  /** 0..1. Higher is better: protected content survived intact. */
  readonly preservationScore: number;
  /**
   * Which scores had nothing to measure.
   *
   * This exists because `1` is ambiguous: "nothing was wrong" and "nothing was
   * looked at" are different claims, and a caller that cannot tell them apart
   * will read an unmeasured score as a pass. A score listed here is reported as
   * 1 by convention and must never be quoted as a result.
   */
  readonly unmeasured?: readonly ScoreName[];
  readonly rationales: readonly ScoreRationale[];
}

export interface ValidationIssue {
  readonly kind:
    | 'semantic-drift'
    | 'protected-content-lost'
    | 'protected-content-altered'
    | 'voice-mismatch'
    | 'behavior-violation'
    | 'anti-ai-regression'
    | 'fabricated-detail';
  readonly severity: number;
  readonly message: string;
  readonly evidence?: string;
  /** Which score this issue reduces. */
  readonly score: ScoreName;
}

export interface ValidationResult {
  readonly scores: VoiceScoreSet;
  readonly issues: readonly ValidationIssue[];
  /**
   * Whether section 18's single retry budget should be spent. Never more than
   * one retry is permitted.
   */
  readonly retryRecommended: boolean;
  readonly survivingFindings: readonly Finding[];
  readonly preserved: readonly PreserveDirective[];
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/**
 * Runtime guard against the blended score. Called on every produced score set
 * so that a future contributor cannot quietly add one.
 */
export function assertNoBlendedScore(value: object): void {
  for (const key of FORBIDDEN_BLENDED_SCORE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(
        `Blended score key ${JSON.stringify(key)} is forbidden. ` +
          'Human Voice Suite reports antiAIScore, voiceScore, behaviorScore and ' +
          'preservationScore separately and never fuses them.',
      );
    }
  }
}

export function emptyScoreSet(): VoiceScoreSet {
  return {
    antiAIScore: 1,
    voiceScore: 1,
    behaviorScore: 1,
    preservationScore: 1,
    unmeasured: [...SCORE_NAMES],
    rationales: [],
  };
}

/**
 * The prose families. These are what `antiAIScore` is allowed to charge for.
 *
 * The `assistant` family is excluded on purpose. Behaviour is a different
 * question from prose shape, it is scored separately, and charging for it twice
 * — once in `antiAIScore` and again in `behaviorScore` — would be exactly the
 * double-counting this project exists to remove. It would also destroy the one
 * reading the suite is built to produce: prose fine, behaviour machine-shaped.
 */
export const ANTI_AI_FAMILIES = [
  'structural',
  'lexical',
  'rhythm',
  'chinese',
  'english',
  'stylometry',
] as const;
