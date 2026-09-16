/**
 * Stylometry detector family.
 *
 * Two detectors, with different readiness, and the difference is stated rather
 * than hidden.
 *
 * **Statistical** runs now. It wraps the port of `lynote-ai/humanize-text`'s
 * offline detector — the only part of that upstream which needs no network and
 * no model — and reports its two signals against the canonical rules that
 * already name them, so they collapse with the phrase detectors instead of
 * double-charging.
 *
 * **Voice distance** needs a target to measure against. The measurement code is
 * here and runs as soon as a scan is given a `voiceProfile`; without one there is
 * nothing to be close to or far from, so it reports nothing rather than inventing
 * a baseline. Learning profiles is Phase 6.
 */

import {
  STATISTICAL_ANCHORS,
  statisticalFeatures,
} from '../../upstream/adapters/humanize-text/statistical.js';
import { computeTextStats } from '../../shared/text.js';
import type { Detector, DetectionContext, Finding } from '../types.js';
import { catalogForFamily } from '../catalog.js';
import type { DetectorSlot } from '../catalog.js';
import { compareToProfile } from '../../voice/scoring/index.js';
import type { VoiceDimension } from '../../voice/scoring/index.js';

export const FAMILY = 'stylometry' as const;
export const TARGET_PHASE = 2;
export const PLANNED_SLOTS: readonly DetectorSlot[] = catalogForFamily(FAMILY);

/**
 * Below this many words the three statistical features are dominated by sample
 * noise. The upstream reports a confident-looking number for a two-sentence
 * input; this detector declines to, because a finding that cannot be trusted is
 * worse than no finding — it still costs score.
 */
export const MIN_WORDS = 150;
export const MIN_TYPES = 40;

/**
 * How far a measurement may sit from the profile before it counts.
 *
 * Expressed in standard deviations of the profile's own distribution, so a
 * person who naturally varies a lot is not penalised for varying.
 */
export const VOICE_SIGMA_TOLERANCE = 1.5;

export function createStylometryDetectors(): Detector[] {
  return [
    {
      id: 'stylometry.statistical',
      upstream: 'lynote-ai/humanize-text',
      family: 'stylometry',
      languages: ['en'],
      status: 'ready',
      description:
        'Type-token ratio, hapax ratio and sentence-length variation, reported against the canonical rules that already name those tells.',
      detect(text: string, context: DetectionContext): Finding[] {
        const registry = context.rules;
        const features = statisticalFeatures(text);
        if (!features) return [];

        // The port is English-only: its sentence splitter keys on `.!?`, so a
        // Chinese document collapses to one sentence and the measurement is
        // meaningless. Decline rather than report a number nobody should trust.
        if (context.language === 'zh') return [];
        if (features.words < MIN_WORDS || features.types < MIN_TYPES) return [];

        const findings: Finding[] = [];

        // ---- lexical diversity ----------------------------------------------
        const diversityRule = registry?.get('lexical.low_lexical_diversity');
        if (diversityRule) {
          const ttrScore = Math.max(
            0,
            Math.min(1, (STATISTICAL_ANCHORS.ttr - features.ttr) / STATISTICAL_ANCHORS.width),
          );
          const hapaxScore = Math.max(
            0,
            Math.min(
              1,
              (STATISTICAL_ANCHORS.hapax - features.hapaxRatio) / STATISTICAL_ANCHORS.width,
            ),
          );
          if ((ttrScore + hapaxScore) / 2 >= 0.5) {
            findings.push({
              ruleId: diversityRule.id,
              canonicalRuleId: diversityRule.id,
              upstream: 'lynote-ai/humanize-text',
              detectorId: 'stylometry.statistical',
              category: 'lexical',
              family: 'stylometry',
              severity: diversityRule.severity,
              languages: ['en'],
              message:
                `Type-token ratio ${features.ttr.toFixed(3)} against the upstream's ${STATISTICAL_ANCHORS.ttr} anchor, ` +
                `hapax ratio ${features.hapaxRatio.toFixed(3)} against ${STATISTICAL_ANCHORS.hapax}, ` +
                `over ${features.types} types in ${features.words} words.`,
              evidence: [],
              // The upstream's own comment block calls these anchors unanchored,
              // so the finding carries that uncertainty rather than hiding it.
              confidence: 0.45,
            });
          }
        }

        // ---- sentence-length variation --------------------------------------
        const rhythmRule = registry?.get('rhythm.uniform_rhythm');
        if (rhythmRule) {
          const cvScore = Math.max(
            0,
            Math.min(1, (STATISTICAL_ANCHORS.cv - features.cv) / STATISTICAL_ANCHORS.width),
          );
          if (cvScore >= 0.6) {
            findings.push({
              ruleId: rhythmRule.id,
              canonicalRuleId: rhythmRule.id,
              upstream: 'lynote-ai/humanize-text',
              detectorId: 'stylometry.statistical',
              category: 'rhythm',
              family: 'stylometry',
              severity: rhythmRule.severity,
              languages: ['en'],
              message: `Sentence-length coefficient of variation ${features.cv.toFixed(3)} across ${features.sentences} sentences, against the upstream's ${STATISTICAL_ANCHORS.cv} anchor.`,
              evidence: [],
              confidence: 0.45,
            });
          }
        }

        return findings;
      },
    },
    {
      id: 'stylometry.voice_distance',
      upstream: 'human-voice-suite/local',
      family: 'stylometry',
      languages: ['en', 'zh', 'unknown'],
      status: 'ready',
      description:
        'Distance between the text and a target voice profile. Reports nothing until a scan supplies a profile, because without a target there is no distance to measure.',
      detect(text: string, context: DetectionContext): Finding[] {
        const profile = context.voiceProfile;
        if (!profile?.writing) return [];

        const stats = computeTextStats(text);
        const rule = context.rules?.get('stylometry.distribution_distance');
        if (!rule) return [];

        const expected = profile.writing.sentenceLength;
        if (expected.sampleCount === 0) return [];

        // Measured in the profile's own spread, so a naturally varied writer is
        // not flagged for varying.
        const spread = expected.stdDev > 0 ? expected.stdDev : Math.max(1, expected.mean * 0.3);
        const deviation = Math.abs(stats.averageSentenceTokens - expected.mean) / spread;

        if (deviation < VOICE_SIGMA_TOLERANCE) return [];

        const burstinessGap = Math.abs(stats.burstiness - profile.writing.burstiness);

        return [
          {
            ruleId: rule.id,
            canonicalRuleId: rule.id,
            upstream: 'human-voice-suite/local',
            detectorId: 'stylometry.voice_distance',
            category: 'stylometry',
            family: 'stylometry',
            severity: rule.severity,
            languages: profile.languages.length > 0 ? [...profile.languages] : ['unknown'],
            message:
              `Mean sentence length ${stats.averageSentenceTokens.toFixed(1)} against the profile's ` +
              `${expected.mean.toFixed(1)} (${deviation.toFixed(1)} standard deviations, tolerance ${VOICE_SIGMA_TOLERANCE}); ` +
              `burstiness gap ${burstinessGap.toFixed(2)}.`,
            evidence: [],
            // A distance from one profile is not a verdict, and the profile may
            // itself be thin.
            confidence: expected.sampleCount >= 20 ? 0.6 : 0.35,
          },
        ];
      },
    },
    {
      id: 'stylometry.fingerprint_features',
      upstream: 'human-voice-suite/local',
      family: 'stylometry',
      languages: ['en', 'zh', 'unknown'],
      status: 'ready',
      description:
        'Per-habit distance from a target voice profile: sentence length, punctuation and vocabulary, each named separately so a report can say which habit is off rather than only that something is.',
      detect(text: string, context: DetectionContext): Finding[] {
        const profile = context.voiceProfile;
        // Without a profile there is no target. The upstream fingerprint records
        // 25 fields whether or not anyone has a baseline to compare them with;
        // reporting a deviation from a baseline nobody supplied would be
        // inventing the baseline.
        if (!profile?.writing) return [];

        const comparison = compareToProfile(text, profile, {
          language: context.language,
          mode: context.mode,
        });
        const findings: Finding[] = [];

        for (const dimension of comparison.dimensions) {
          if (!dimension.measured) continue;
          const ruleId = RULE_FOR_DIMENSION[dimension.name];
          if (!ruleId) continue;
          const rule = context.rules?.get(ruleId);
          if (!rule) continue;

          const deficit = 1 - dimension.score;
          if (deficit < thresholdFor(dimension.name)) continue;

          // The vocabulary rule names two different things, and they are not
          // equally strong evidence. A text that uses none of the writer's own
          // words may simply be about something else; a text that uses a term the
          // profile records as avoided is a positive observation. Phase 8 split
          // them, because the benchmark showed the rule firing 21 times on 56
          // samples at severity 3 with the two cases indistinguishable in the
          // message — including on four human-written samples.
          const isAvoidance = dimension.name === 'avoidVocabulary';
          findings.push({
            ruleId,
            canonicalRuleId: ruleId,
            upstream: 'human-voice-suite/local',
            detectorId: 'stylometry.fingerprint_features',
            category: 'stylometry',
            family: 'stylometry',
            severity: isAvoidance ? Math.min(5, rule.severity + 1) : Math.max(1, rule.severity - 1),
            languages: profile.languages.length > 0 ? [...profile.languages] : ['unknown'],
            message: isAvoidance
              ? `A term this writer never uses appears: ${dimension.detail}.`
              : `None of this writer's recurring vocabulary appears: ${dimension.detail}. Weak evidence on its own — the text may simply be about something else.`,
            evidence: [],
            confidence: confidenceFor(deficit, dimension, isAvoidance),
          });
        }

        return findings;
      },
    },
  ];
}

/**
 * Which canonical rule each measurable dimension reports against.
 *
 * A dimension with no entry here is measured for the score and produces no
 * finding: a number the report cannot act on is not worth a deduction.
 */
export const RULE_FOR_DIMENSION: Readonly<Record<string, string>> = {
  sentenceLength: 'stylometry.fingerprint_sentence_length',
  punctuation: 'stylometry.fingerprint_punctuation',
  signatureVocabulary: 'stylometry.fingerprint_vocabulary',
  avoidVocabulary: 'stylometry.fingerprint_vocabulary',
};

const DIMENSION_LABEL: Readonly<Record<string, string>> = {
  sentenceLength: 'Sentence length',
  burstiness: 'Sentence-length variation',
  punctuation: 'Punctuation habit',
  paragraphLength: 'Paragraph length',
  signatureVocabulary: 'Signature vocabulary',
  avoidVocabulary: 'Avoided vocabulary',
  chatReplyLength: 'Reply length',
  chatEmoji: 'Emoji rate',
  chatBurst: 'Burst messaging',
  behaviorAgreement: 'Agreement rate',
  behaviorOffer: 'Closing offer',
};

/** How far below a full match a dimension must be before it is reported. */
export const FINGERPRINT_TOLERANCE = 0.3;

/**
 * Per-dimension report thresholds.
 *
 * Phase 8 raised the vocabulary bar and kept sentence length where it was,
 * because the benchmark showed what each dimension does on real text. Sentence
 * length is a stable measurement: a text whose mean sits far outside the
 * profile's spread is genuinely unlike the writer. Vocabulary absence is not —
 * a text can miss every one of a writer's habitual words and still be by that
 * writer, because vocabulary follows the subject. So it has to clear a higher bar
 * before it is worth a deduction.
 */
export const DIMENSION_THRESHOLDS: Readonly<Record<string, number>> = {
  sentenceLength: FINGERPRINT_TOLERANCE,
  punctuation: 0.5,
  signatureVocabulary: 0.6,
  avoidVocabulary: 0.3,
};

export function thresholdFor(dimension: string): number {
  return DIMENSION_THRESHOLDS[dimension] ?? FINGERPRINT_TOLERANCE;
}

/**
 * Confidence tracks how much of the profile is behind the comparison. A profile
 * learned from five sentences should not produce a confident finding about a
 * habit, and the difference is stated rather than averaged away.
 */
function confidenceFor(deficit: number, dimension: VoiceDimension, isAvoidance: boolean): number {
  const depth = Math.min(1, deficit);
  const base = 0.35 + depth * 0.35;
  // An avoided term is a positive observation; an absent one is an absence.
  const observed = isAvoidance ? 0.2 : 0;
  // The vocabulary dimensions are the noisiest at short lengths, and the
  // comparison already declines them below forty content units.
  const penalty = dimension.name.toLowerCase().includes('vocabulary') ? 0.1 : 0;
  return Number(Math.max(0.2, base + observed - penalty).toFixed(2));
}

/** Slots this family owns that are implemented. */
export function readySlots(): DetectorSlot[] {
  return PLANNED_SLOTS.filter((slot) => slot.status === 'ready');
}
