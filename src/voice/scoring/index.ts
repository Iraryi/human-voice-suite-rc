/**
 * Voice scoring.
 *
 * One number, `voiceScore`, answering one question: how close is this text to
 * the target voice? The dimensions are weighted and every weight is declared, so
 * a disagreement with the answer can be traced to a dimension rather than to the
 * mood of an opaque model.
 *
 * Three rules shape the design.
 *
 * **Unmeasured is not the same as good.** Every dimension reports `measured`.
 * A text with one paragraph has no paragraph-length distribution to compare, and
 * a chat profile compared against prose has no reply length to compare. Those
 * dimensions are excluded from the average and listed, so a thin comparison
 * cannot masquerade as a perfect match.
 *
 * **Distance is measured in the profile's own spread.** A writer whose sentences
 * vary by twenty tokens should not be flagged for varying, exactly as the
 * stylometry detector already does with `VOICE_SIGMA_TOLERANCE`. The same
 * principle is applied to every dimension here.
 *
 * **The score never overrules the anti-AI layer.** A text can be a perfect voice
 * match and still be full of tells; that is why the two numbers are reported
 * separately and never blended.
 */

import { splitSentences, tokenize } from '../../shared/text.js';
import type { Language, TextMode } from '../../shared/types.js';
import { measureSmells } from '../../behavior/assistant-smell/index.js';
import { clampScore } from '../../validation/types.js';
import type { ScoreRationale } from '../../validation/types.js';
import type { VoiceProfile } from '../types.js';
import {
  contentUnits,
  emojiCount,
  extractFingerprint,
  punctuationRates,
  splitMessages,
} from '../fingerprint/index.js';

export const AREA = 'voice.scoring';
export const TARGET_PHASE = 6;

export interface VoiceDimension {
  /** Stable id, so a report can compare runs. */
  readonly name: string;
  /** 0..1, higher is closer. */
  readonly score: number;
  readonly weight: number;
  readonly measured: boolean;
  /** One line saying what was compared with what. */
  readonly detail: string;
}

export interface VoiceComparison {
  /**
   * 0..1. Higher is closer to the profile. `1` with `unmeasured: true` means
   * nothing was compared, not that the match was perfect.
   */
  readonly voiceScore: number;
  readonly unmeasured: boolean;
  readonly dimensions: readonly VoiceDimension[];
  readonly rationale: ScoreRationale;
}

/**
 * Dimension weights.
 *
 * Sentence length and punctuation carry the most weight because they are the
 * most stable habits and the cheapest to measure honestly. Vocabulary carries
 * substantial weight but is discounted on short texts, where a writer simply has
 * not had room to use their own words.
 */
export const DIMENSION_WEIGHTS = {
  sentenceLength: 0.25,
  burstiness: 0.15,
  punctuation: 0.2,
  paragraphLength: 0.1,
  signatureVocabulary: 0.2,
  avoidVocabulary: 0.15,
  chatReplyLength: 0.1,
  chatEmoji: 0.05,
  chatBurst: 0.05,
  chatPunctuation: 0.05,
  behaviorAgreement: 0.05,
  behaviorOffer: 0.05,
} as const;

/**
 * Below this many content units, the vocabulary dimensions are excluded: at forty
 * units the absence of a signature word says more about the length of the text
 * than about the writer.
 */
export const MIN_UNITS_FOR_VOCABULARY = 40;

/** A text needs at least this many paragraphs before paragraph length means anything. */
export const MIN_PARAGRAPHS = 3;

/**
 * Distance-to-score curve.
 *
 * Inside the tolerance the dimension is a full match: a habit is a range, not a
 * point. Beyond it the score decays as `1 / (1 + excess)`, so being twice the
 * tolerance away costs half the dimension and being far away never quite reaches
 * zero — a text is never *infinitely* unlike a person.
 */
export function toleranceScore(distance: number, tolerance: number): number {
  if (!Number.isFinite(distance)) return 0;
  if (tolerance <= 0) return distance === 0 ? 1 : 1 / (1 + distance);
  const excess = Math.max(0, distance - tolerance) / tolerance;
  return clampScore(1 / (1 + excess));
}

/** How far apart two rate distributions are, scale-free and in 0..1. */
export function rateDistance(
  a: Readonly<Record<string, number>>,
  b: Readonly<Record<string, number>>,
): { distance: number; shared: number } {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let difference = 0;
  let total = 0;
  let shared = 0;
  for (const key of keys) {
    const left = a[key] ?? 0;
    const right = b[key] ?? 0;
    difference += Math.abs(left - right);
    total += left + right;
    if (left > 0 && right > 0) shared += 1;
  }
  if (total === 0) return { distance: 0, shared: 0 };
  return { distance: difference / total, shared };
}

/**
 * Compare punctuation as a *mix* rather than as a set of rates.
 *
 * Phase 8 fix, driven by the benchmark. The raw rate distance above charged a
 * text for every mark the profile uses and the text does not — which for a
 * one-line chat reply is nearly all of them, because the text had no room to use
 * them. `stylometry.fingerprint_punctuation` consequently fired on 43 of 56
 * corpus samples, including 7 human-written ones. A rule that fires on
 * three-quarters of everything is a fire alarm nobody reads.
 *
 * The measure here asks a fairer question in two parts:
 *
 * 1. **Mix.** Of the marks this text *did* use, are they in the proportion the
 *    writer uses them in? Total-variation distance over renormalised shares,
 *    restricted to the marks present in the text. Length-independent by
 *    construction: the shares sum to one whatever the length.
 * 2. **Density.** How much punctuation in total, against the profile's own
 *    density for the same marks. One scalar, with a wide tolerance, because
 *    punctuation density genuinely varies with register.
 *
 * The mix carries most of the weight. It is the part that says "this writer
 * reaches for 破折号 where you reach for 逗号", which is a habit; density alone is
 * often just a different genre.
 */
export const PUNCTUATION_MIX_WEIGHT = 0.75;

export interface PunctuationComparison {
  readonly score: number;
  readonly mixDistance: number;
  readonly densityRatio: number;
  readonly marksCompared: number;
  readonly detail: string;
}

export function comparePunctuation(
  measured: Readonly<Record<string, number>>,
  profile: Readonly<Record<string, number>>,
): PunctuationComparison {
  const used = Object.keys(measured).filter((mark) => (measured[mark] ?? 0) > 0);
  if (used.length === 0) {
    return {
      score: 1,
      mixDistance: 0,
      densityRatio: 1,
      marksCompared: 0,
      detail: 'the text uses no punctuation at all, so there is no habit to compare',
    };
  }

  // Shares over the marks the text actually used. A mark the writer uses but this
  // text does not is not evidence about this text.
  const measuredTotal = used.reduce((total, mark) => total + (measured[mark] ?? 0), 0);
  const profileTotal = used.reduce((total, mark) => total + (profile[mark] ?? 0), 0);

  let mixDistance: number;
  if (profileTotal === 0) {
    // The profile shows none of these marks. That is a real difference, but it is
    // one observation rather than a distance, so it is scored as a half rather
    // than as a total mismatch.
    mixDistance = 0.5;
  } else {
    let difference = 0;
    for (const mark of used) {
      difference += Math.abs((measured[mark] ?? 0) / measuredTotal - (profile[mark] ?? 0) / profileTotal);
    }
    mixDistance = difference / 2;
  }

  const allProfileMarks = Object.values(profile).reduce((total, rate) => total + rate, 0);
  const allMeasuredMarks = Object.values(measured).reduce((total, rate) => total + rate, 0);
  const profileDensity = allProfileMarks === 0 ? 0 : allProfileMarks;
  const densityRatio = profileDensity === 0 ? 1 : allMeasuredMarks / profileDensity;
  const densityDistance = Math.abs(Math.log(Math.max(densityRatio, 1e-6)));

  const mixScore = clampScore(1 - mixDistance * 2);
  const densityScore = toleranceScore(densityDistance, Math.log(2));
  const score = clampScore(
    PUNCTUATION_MIX_WEIGHT * mixScore + (1 - PUNCTUATION_MIX_WEIGHT) * densityScore,
  );

  return {
    score,
    mixDistance: Number(mixDistance.toFixed(4)),
    densityRatio: Number(densityRatio.toFixed(4)),
    marksCompared: used.length,
    detail:
      `mix ${(mixDistance * 100).toFixed(0)}% apart over ${used.length} mark(s) the text uses; ` +
      `density ${densityRatio.toFixed(2)}× the profile's`,
  };
}

export interface CompareOptions {
  readonly language?: Language;
  readonly mode?: TextMode;
}

export function compareToProfile(
  text: string,
  profile: VoiceProfile,
  options: CompareOptions = {},
): VoiceComparison {
  const mode = options.mode ?? 'unknown';
  const extraction = extractFingerprint(text, {
    ...(options.language ? { language: options.language } : {}),
    mode,
    includeChat: mode === 'chat',
  });

  const dimensions: VoiceDimension[] = [];
  const writing = profile.writing;

  if (writing) {
    // ---- sentence length -------------------------------------------------
    const expected = writing.sentenceLength;
    if (expected.sampleCount > 0 && extraction.stats.sentenceCount > 0) {
      const spread = Math.max(expected.stdDev, expected.mean * 0.2, 1);
      const deviation = Math.abs(extraction.stats.averageSentenceTokens - expected.mean);
      dimensions.push({
        name: 'sentenceLength',
        score: toleranceScore(deviation, spread),
        weight: DIMENSION_WEIGHTS.sentenceLength,
        measured: true,
        detail: `mean ${extraction.stats.averageSentenceTokens.toFixed(1)} tokens against ${expected.mean.toFixed(1)} ± ${spread.toFixed(1)}`,
      });

      // ---- burstiness ----------------------------------------------------
      const burstTolerance = Math.max(0.12, Math.abs(writing.burstiness) * 0.4);
      dimensions.push({
        name: 'burstiness',
        score: toleranceScore(
          Math.abs(extraction.stats.burstiness - writing.burstiness),
          burstTolerance,
        ),
        weight: DIMENSION_WEIGHTS.burstiness,
        measured: true,
        detail: `burstiness ${extraction.stats.burstiness.toFixed(2)} against ${writing.burstiness.toFixed(2)} ± ${burstTolerance.toFixed(2)}`,
      });
    }

    // ---- punctuation -------------------------------------------------------
    const measuredPunctuation = punctuationRates(text);
    if (Object.keys(writing.punctuationRates).length > 0) {
      const punctuation = comparePunctuation(measuredPunctuation, writing.punctuationRates);
      dimensions.push({
        name: 'punctuation',
        score: punctuation.score,
        weight: DIMENSION_WEIGHTS.punctuation,
        measured: punctuation.marksCompared > 0,
        detail: punctuation.detail,
      });
    }

    // ---- paragraph length --------------------------------------------------
    const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0).length;
    if (writing.paragraphLength.sampleCount > 0 && paragraphs >= MIN_PARAGRAPHS) {
      const lengths = text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0 && !p.startsWith('#'))
        .map((p) => Math.max(1, tokenize(p).length));
      const mean = lengths.length === 0 ? 0 : lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const tolerance = Math.max(
        writing.paragraphLength.stdDev,
        writing.paragraphLength.mean * 0.25,
        1,
      );
      dimensions.push({
        name: 'paragraphLength',
        score: toleranceScore(Math.abs(mean - writing.paragraphLength.mean), tolerance),
        weight: DIMENSION_WEIGHTS.paragraphLength,
        measured: true,
        detail: `mean ${mean.toFixed(1)} tokens per paragraph against ${writing.paragraphLength.mean.toFixed(1)} ± ${tolerance.toFixed(1)}`,
      });
    }

    // ---- signature vocabulary ----------------------------------------------
    const units = contentUnits(text);
    if (writing.signatureVocabulary.length > 0 && units.length >= MIN_UNITS_FOR_VOCABULARY) {
      const present = new Set(units);
      const matched = writing.signatureVocabulary.filter((term) => present.has(term));
      // How many signature terms the text had room for. A 1000-unit text should
      // show more of them than a 50-unit one, and is held to that.
      const expectedTerms = Math.min(
        writing.signatureVocabulary.length,
        Math.max(3, Math.round(units.length / 25)),
      );
      const score = clampScore(matched.length / expectedTerms);
      dimensions.push({
        name: 'signatureVocabulary',
        score,
        weight: DIMENSION_WEIGHTS.signatureVocabulary,
        measured: true,
        detail: `${matched.length} of ${expectedTerms} expected signature term(s) present out of ${writing.signatureVocabulary.length} known`,
      });
    }

    // ---- avoided vocabulary -------------------------------------------------
    if (writing.avoidVocabulary.length > 0) {
      const hits = writing.avoidVocabulary.filter((term) => text.includes(term));
      dimensions.push({
        name: 'avoidVocabulary',
        score: hits.length === 0 ? 1 : clampScore(1 / (1 + hits.length)),
        weight: DIMENSION_WEIGHTS.avoidVocabulary,
        measured: true,
        detail:
          hits.length === 0
            ? 'none of the avoided terms appear'
            : `${hits.length} avoided term(s) appear: ${hits.slice(0, 5).join(', ')}`,
      });
    }
  }

  // ---- chat dimensions -------------------------------------------------------
  const chat = profile.chat;
  if (chat && mode === 'chat') {
    const messages = splitMessages(text);

    if (chat.replyLength.sampleCount > 0 && messages.length > 0) {
      const lengths = messages.map((message) => message.length);
      const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const tolerance = Math.max(chat.replyLength.stdDev, chat.replyLength.mean * 0.35, 10);
      dimensions.push({
        name: 'chatReplyLength',
        score: toleranceScore(Math.abs(mean - chat.replyLength.mean), tolerance),
        weight: DIMENSION_WEIGHTS.chatReplyLength,
        measured: true,
        detail: `mean reply ${mean.toFixed(0)} characters against ${chat.replyLength.mean.toFixed(0)} ± ${tolerance.toFixed(0)}`,
      });
    }

    const emojiRate = emojiCount(text) / Math.max(1, messages.length);
    dimensions.push({
      name: 'chatEmoji',
      score: toleranceScore(
        Math.abs(emojiRate - chat.emojiRate),
        Math.max(0.5, chat.emojiRate * 0.5),
      ),
      weight: DIMENSION_WEIGHTS.chatEmoji,
      measured: true,
      detail: `${emojiRate.toFixed(2)} emoji per message against ${chat.emojiRate.toFixed(2)}`,
    });

    if (messages.length > 1) {
      const burst = (messages.length - 1) / messages.length;
      dimensions.push({
        name: 'chatBurst',
        score: toleranceScore(Math.abs(burst - chat.burstMessaging), 0.34),
        weight: DIMENSION_WEIGHTS.chatBurst,
        measured: true,
        detail: `${messages.length} messages in a row (burstiness ${burst.toFixed(2)}) against ${chat.burstMessaging.toFixed(2)}`,
      });
    }
  }

  // ---- behaviour dimensions ----------------------------------------------------
  // Measured with the same smell taxonomy the behaviour engine uses, so the voice
  // layer cannot form a second opinion about agreement that contradicts the first.
  const behavior = profile.behavior;
  if (behavior && extraction.stats.sentenceCount > 0) {
    const measured = measureSmells(text);
    const clauses = Math.max(
      1,
      splitSentences(text).length + (text.match(/[,\uff0c;\uff1b:\uff1a]/g)?.length ?? 0),
    );

    const agreementHits = measured.find((smell) => smell.id === 'chat.over_agreement');
    const agreementRate = (agreementHits?.evidence.length ?? 0) / clauses;
    dimensions.push({
      name: 'behaviorAgreement',
      score: toleranceScore(
        Math.abs(agreementRate - behavior.agreementRate),
        Math.max(0.05, behavior.agreementRate),
      ),
      weight: DIMENSION_WEIGHTS.behaviorAgreement,
      measured: true,
      detail: `agreement markers on ${agreementRate.toFixed(3)} of ${clauses} clause(s) against the profile's ${behavior.agreementRate.toFixed(3)}`,
    });

    const offerHit = measured.some((smell) => smell.id === 'chat.unsolicited_offer') ? 1 : 0;
    // A single reply can only say present or absent, so the tolerance is a half:
    // a profile that offers help a third of the time is not violated by one reply
    // that offers it. Stated rather than hidden, because it is a coarse dimension.
    dimensions.push({
      name: 'behaviorOffer',
      score: toleranceScore(Math.abs(offerHit - behavior.unsolicitedOfferRate), 0.5),
      weight: DIMENSION_WEIGHTS.behaviorOffer,
      measured: true,
      detail: `closing offer ${offerHit === 1 ? 'present' : 'absent'} against an expected rate of ${behavior.unsolicitedOfferRate.toFixed(2)}`,
    });
  }

  const measuredDimensions = dimensions.filter((dimension) => dimension.measured);
  const weightTotal = measuredDimensions.reduce((total, dimension) => total + dimension.weight, 0);
  const weighted = measuredDimensions.reduce(
    (total, dimension) => total + dimension.score * dimension.weight,
    0,
  );
  const unmeasured = measuredDimensions.length === 0 || weightTotal === 0;
  const voiceScore = unmeasured ? 1 : clampScore(weighted / weightTotal);

  const skipped = dimensions.filter((dimension) => !dimension.measured).map((d) => d.name);
  const summary = unmeasured
    ? `Not measured: nothing in ${profile.id} could be compared with this text` +
      (options.mode === 'chat' ? ' in chat mode.' : '.')
    : `${measuredDimensions.length} dimension(s) compared against ${profile.id}, weighted ` +
      `${weightTotal.toFixed(2)} of ${Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0).toFixed(2)}` +
      (skipped.length > 0 ? `; not measured here: ${skipped.join(', ')}` : '') +
      '.';

  return {
    voiceScore,
    unmeasured,
    dimensions,
    rationale: {
      score: 'voiceScore',
      summary,
      contributions: measuredDimensions
        .map((dimension) => ({
          label: dimension.name,
          value: Number(dimension.score.toFixed(4)),
          weight: dimension.weight,
          evidence: dimension.detail,
        }))
        .sort((a, b) => b.weight - a.weight),
    },
  };
}
