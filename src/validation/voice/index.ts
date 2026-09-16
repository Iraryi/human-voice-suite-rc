/**
 * Voice validation.
 *
 * `validate` needs to know one thing the raw score cannot tell it: did the
 * rewrite move *towards* the target voice or away from it? A rewrite that scores
 * 0.62 against a profile is not good news if the original scored 0.81 — the
 * anti-AI pass improved the prose and flattened the writer.
 *
 * So this compares two measurements, not one, and reports the difference as a
 * regression when it is larger than the tolerance. Nothing here is blended into
 * another score: `voiceScore` is the rewritten text's distance from the target,
 * exactly as the voice layer defines it.
 */

import { compareToProfile } from '../../voice/scoring/index.js';
import type { VoiceComparison } from '../../voice/scoring/index.js';
import type { VoiceProfile } from '../../voice/types.js';
import type { Language, TextMode } from '../../shared/types.js';
import type { ValidationIssue } from '../types.js';

export const AREA = 'validation.voice';
export const TARGET_PHASE = 6;

/**
 * How far the voice score may fall before the rewrite is treated as a
 * regression rather than as noise. The same tolerance the behaviour layer uses,
 * and for the same reason: a rewrite is allowed to move a little.
 */
export const VOICE_REGRESSION_TOLERANCE = 0.05;

export interface VoiceValidation {
  readonly original: VoiceComparison;
  readonly rewritten: VoiceComparison;
  /** The rewritten text's score against the profile. */
  readonly voiceScore: number;
  /** Positive means the rewrite moved towards the target. */
  readonly delta: number;
  readonly regression: boolean;
  /** Dimensions that got further from the target, worst first. */
  readonly worsened: readonly string[];
  readonly issues: readonly ValidationIssue[];
}

export interface VoiceValidationInput {
  readonly original: string;
  readonly rewritten: string;
  readonly profile: VoiceProfile;
  readonly language?: Language;
  readonly mode?: TextMode;
}

export function validateVoice(input: VoiceValidationInput): VoiceValidation {
  const options = {
    ...(input.language ? { language: input.language } : {}),
    ...(input.mode ? { mode: input.mode } : {}),
  };

  const before = compareToProfile(input.original, input.profile, options);
  const after = compareToProfile(input.rewritten, input.profile, options);

  // A comparison that measured nothing cannot report a regression. Saying
  // "the rewrite moved away from the voice" when no dimension was measurable
  // would be inventing a finding.
  const comparable = !before.unmeasured && !after.unmeasured;
  const delta = comparable ? after.voiceScore - before.voiceScore : 0;
  const regression = comparable && delta < -VOICE_REGRESSION_TOLERANCE;

  const worsened = comparable
    ? after.dimensions
        .map((dimension) => {
          const prior = before.dimensions.find((entry) => entry.name === dimension.name);
          return prior && dimension.measured && prior.measured
            ? { name: dimension.name, drop: prior.score - dimension.score, detail: dimension.detail }
            : undefined;
        })
        .filter(
          (entry): entry is { name: string; drop: number; detail: string } =>
            entry !== undefined && entry.drop > VOICE_REGRESSION_TOLERANCE,
        )
        .sort((a, b) => b.drop - a.drop)
        .map((entry) => `${entry.name} (${entry.drop.toFixed(2)} worse: ${entry.detail})`)
    : [];

  const issues: ValidationIssue[] = [];
  if (regression) {
    issues.push({
      kind: 'voice-mismatch',
      severity: delta < -0.2 ? 4 : 3,
      message:
        `The rewrite moved away from ${input.profile.id}: voiceScore fell from ` +
        `${before.voiceScore.toFixed(2)} to ${after.voiceScore.toFixed(2)}. ` +
        (worsened.length > 0 ? `Worse on ${worsened.join('; ')}.` : ''),
      ...(worsened[0] ? { evidence: worsened[0] } : {}),
      score: 'voiceScore',
    });
  } else if (!comparable) {
    issues.push({
      kind: 'voice-mismatch',
      severity: 1,
      message:
        `voiceScore could not be measured against ${input.profile.id}: ` +
        `${after.unmeasured ? after.rationale.summary : before.rationale.summary}`,
      score: 'voiceScore',
    });
  }

  return {
    original: before,
    rewritten: after,
    voiceScore: after.voiceScore,
    delta,
    regression,
    worsened,
    issues,
  };
}
