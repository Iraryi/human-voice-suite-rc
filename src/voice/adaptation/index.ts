/**
 * Voice adaptation: blending, drift detection, and hazard neutralisation.
 *
 * Hazard neutralisation is the load-bearing part. Two of the eight imported
 * author voices carry material that must not survive import:
 *
 * 1. **`lixiaolai.md` rule 6 instructs inventing plausible specific numbers when
 *    a real one is unavailable** — *"If you don't have a real number, invent a
 *    plausible specific one rather than hedging."* Every other part of this
 *    project depends on not fabricating detail, and the rewrite contract's
 *    preservation rules exist to make invention impossible. Importing that
 *    instruction would teach the suite to do the one thing it forbids. It is
 *    removed, and the removal is recorded rather than silent.
 * 2. **The eight profiles describe writing as a named living author.** MIT covers
 *    the text; it does not settle publicity or personality rights. The suite's
 *    decision is that it imports *measurable habits and craft instructions*, never
 *    a persona claim, so any instruction that tells the model to be someone is
 *    dropped. A profile is a target, not a disguise.
 *
 * Neutralisation returns what it removed. A silent filter is indistinguishable
 * from a filter that removed the wrong thing.
 */

import type { DistributionSummary, VoiceProfile, WritingVoiceFeatures } from '../types.js';
import { VOICE_PROFILE_SCHEMA_VERSION } from '../types.js';
import { assertValidProfile } from '../profile/index.js';

export const AREA = 'voice.adaptation';
export const TARGET_PHASE = 6;

export interface HazardPattern {
  readonly id: string;
  readonly reason: string;
  readonly pattern: RegExp;
}

/**
 * The hazard vocabulary.
 *
 * Patterns are matched case-insensitively against imported prose and are kept
 * narrow on purpose: a filter that removes too much takes the craft instruction
 * with it, and the craft instruction is the reason for importing at all.
 */
export const HAZARD_PATTERNS: readonly HazardPattern[] = [
  {
    id: 'fabricated-data',
    reason:
      'instructs inventing numbers or facts, which contradicts the no-invention rule every other layer depends on',
    // The upstream wording is "invent a plausible specific one rather than
    // hedging" — the object is the pronoun `one`, not the word `number`, so a
    // pattern that only lists nouns misses the exact sentence this rule exists
    // for. The pronoun forms are therefore part of the pattern, and a test pins
    // that sentence.
    pattern:
      /invent (?:a |an |the )?(?:(?:plausible|fake|specific|convincing|made[- ]up|new)\s+)*(?:number|numbers|data|statistic|statistics|figure|figures|detail|details|example|examples|quote|quotes|one|ones|it)\b|make up (?:a |the )?(?:number|numbers|data|statistics|facts?|quote|quotes|one)|fabricat\w*|编造|虚构|捏造|杜撰|假数据|编个数字|编一个数据/i,
  },
  {
    id: 'invented-citation',
    reason: 'instructs inventing citations or sources, which cannot be verified by a reader',
    pattern:
      /invent (?:a |the )?(?:citation|citations|source|sources|reference|references)|fake (?:citation|citations|source|sources)|伪造(?:引用|出处|来源)/i,
  },
  {
    id: 'persona-claim',
    reason:
      'tells the model to write as a named person, which is a publicity question MIT does not settle; the suite imports habits, not a persona',
    // Written without the `i` flag on purpose. `write as X` has to require a
    // capitalised name or a Chinese character, and case-folding the whole pattern
    // would make it match "write as a summary" — throwing away the craft
    // instruction along with the persona claim. So the literal phrases appear in
    // both cases instead.
    pattern:
      /You are writing in the voice of|you are writing in the voice of|must read like an authentic passage|Must read like an authentic passage|write (?:exactly )?(?:as|like) (?:if you were )?[A-Z\u4e00-\u9fff]|Write (?:exactly )?(?:as|like) (?:if you were )?[A-Z\u4e00-\u9fff]|冒充|扮演[^，。]{0,6}(?:本人|的声音)|以[^，。]{0,8}本人的(?:身份|口吻)/,
  },
  {
    id: 'detector-evasion',
    reason:
      'promises to defeat AI detection, which is a claim this project refuses to make and cannot support',
    pattern: /(?:bypass|defeat|evade|beat|fool) (?:the )?(?:ai )?(?:detector|detectors|detection)|绕过(?:AI)?检测|骗过(?:AI)?检测/i,
  },
];

export interface NeutralisationResult {
  readonly profile: VoiceProfile;
  readonly removed: ReadonlyArray<{
    readonly hazard: string;
    readonly reason: string;
    readonly text: string;
    readonly field: string;
  }>;
}

/**
 * Every free-text field an imported profile can carry *instructions* in.
 *
 * `notes` is deliberately excluded. Notes are documentation — they do not reach
 * the rewrite contract — and the removal record itself quotes the hazard it
 * removed, so scanning notes would make neutralisation destroy its own audit
 * trail on the second run.
 */
function proseFields(profile: VoiceProfile): ReadonlyArray<readonly [string, string]> {
  const out: Array<readonly [string, string]> = [];
  for (const [index, directive] of (profile.directives ?? []).entries()) {
    out.push([`directives[${index}]`, directive]);
  }
  if (profile.writing) {
    for (const [index, term] of profile.writing.toneMarkers.entries()) {
      out.push([`writing.toneMarkers[${index}]`, term]);
    }
    for (const [index, term] of profile.writing.rhetoricalDevices.entries()) {
      out.push([`writing.rhetoricalDevices[${index}]`, term]);
    }
    for (const [index, term] of profile.writing.avoidVocabulary.entries()) {
      out.push([`writing.avoidVocabulary[${index}]`, term]);
    }
  }
  return out;
}

/** The hazards present in a profile, without changing it. */
export function findHazards(
  profile: VoiceProfile,
): ReadonlyArray<{ hazard: string; reason: string; text: string; field: string }> {
  const found: Array<{ hazard: string; reason: string; text: string; field: string }> = [];
  for (const [field, text] of proseFields(profile)) {
    for (const { id, reason, pattern } of HAZARD_PATTERNS) {
      if (pattern.test(text)) found.push({ hazard: id, reason, text, field });
    }
  }
  return found;
}

/**
 * Drop every instruction that matches a hazard pattern.
 *
 * Idempotent: running it on a cleaned profile removes nothing further, which a
 * test asserts, because an import pipeline that is not idempotent cannot be
 * re-run safely.
 */
export function neutraliseHazards(profile: VoiceProfile): NeutralisationResult {
  const removed: Array<NeutralisationResult['removed'][number]> = [];
  const keep = (items: readonly string[], field: string): string[] =>
    items.filter((item) => {
      for (const { id, reason, pattern } of HAZARD_PATTERNS) {
        if (pattern.test(item)) {
          removed.push({ hazard: id, reason, text: item, field });
          return false;
        }
      }
      return true;
    });

  const directives = keep(profile.directives ?? [], 'directives');
  const writing: WritingVoiceFeatures | undefined = profile.writing
    ? {
        ...profile.writing,
        toneMarkers: keep(profile.writing.toneMarkers, 'writing.toneMarkers'),
        rhetoricalDevices: keep(
          profile.writing.rhetoricalDevices,
          'writing.rhetoricalDevices',
        ),
        avoidVocabulary: keep(profile.writing.avoidVocabulary, 'writing.avoidVocabulary'),
      }
    : undefined;

  const cleaned: VoiceProfile = {
    ...profile,
    ...(writing ? { writing } : {}),
    ...(directives.length > 0 ? { directives } : {}),
  };
  if (directives.length === 0) {
    delete (cleaned as { directives?: readonly string[] }).directives;
  }

  return { profile: cleaned, removed };
}

/**
 * Neutralise and record, which is what import calls.
 *
 * The record goes into `notes`, so a reader of the generated profile can see
 * what was taken out without reading the importer.
 */
export function neutraliseAndRecord(profile: VoiceProfile): VoiceProfile {
  const { profile: cleaned, removed } = neutraliseHazards(profile);
  if (removed.length === 0) return cleaned;

  const lines = removed.map(
    (entry) => `  - [${entry.hazard}] ${entry.field}: ${entry.text.slice(0, 160)}`,
  );
  const note = [
    cleaned.notes ?? '',
    `Hazards removed at import (${removed.length}):`,
    ...lines,
    'The removed instructions are not carried anywhere; the pattern list is HAZARD_PATTERNS in src/voice/adaptation/index.ts.',
  ]
    .filter((line) => line.length > 0)
    .join('\n');

  const result: VoiceProfile = { ...cleaned, notes: note };
  return result;
}

// ---------------------------------------------------------------------------
// Blending
// ---------------------------------------------------------------------------

/**
 * Blend two distributions.
 *
 * Means and spreads pool exactly; the shape is approximated, which is the same
 * approximation `learnFingerprint` makes and is recorded in `sampleCount`.
 */
export function blendDistributions(
  a: DistributionSummary,
  b: DistributionSummary,
  weightA: number,
): DistributionSummary {
  const total = a.sampleCount + b.sampleCount;
  if (total === 0) return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, sampleCount: 0 };
  if (a.sampleCount === 0) return { ...b };
  if (b.sampleCount === 0) return { ...a };

  const wa = clamp01(weightA);
  const wb = 1 - wa;
  const mean = a.mean * wa + b.mean * wb;
  // Law of total variance: within-group spread plus between-group spread. Using
  // only the weighted means would make a blend of two very different writers
  // look like one consistent writer, which is the opposite of the truth.
  const variance =
    wa * (a.stdDev ** 2 + (a.mean - mean) ** 2) + wb * (b.stdDev ** 2 + (b.mean - mean) ** 2);
  const median = a.median * wa + b.median * wb;

  return {
    mean: round(mean),
    median: round(median),
    stdDev: round(Math.sqrt(variance)),
    min: Math.min(a.min, b.min),
    max: Math.max(a.max, b.max),
    sampleCount: total,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

export interface BlendOptions {
  readonly id: string;
  readonly owner?: string;
  /** 0..1, how much of `a` the blend should keep. 0.5 is an even blend. */
  readonly weightA?: number;
}

/**
 * Blend two profiles of the same scope.
 *
 * Refuses to blend across languages or kinds: `user/chat` and `author/fengtang`
 * are not two samples of one thing, and averaging them would produce a profile
 * that is neither. Blending is for drift over time within one voice.
 */
export function blendProfiles(
  a: VoiceProfile,
  b: VoiceProfile,
  options: BlendOptions,
): VoiceProfile {
  if (a.kind !== b.kind) {
    throw new Error(
      `Cannot blend ${a.id} (${a.kind}) with ${b.id} (${b.kind}): different scopes describe different voices.`,
    );
  }
  const shared = a.languages.filter((language) => b.languages.includes(language));
  if (shared.length === 0) {
    throw new Error(
      `Cannot blend ${a.id} (${a.languages.join(', ')}) with ${b.id} (${b.languages.join(', ')}): no shared language.`,
    );
  }

  const weightA = options.weightA ?? 0.5;
  const writing: WritingVoiceFeatures | undefined =
    a.writing && b.writing
      ? {
          sentenceLength: blendDistributions(a.writing.sentenceLength, b.writing.sentenceLength, weightA),
          paragraphLength: blendDistributions(a.writing.paragraphLength, b.writing.paragraphLength, weightA),
          burstiness: round(a.writing.burstiness * clamp01(weightA) + b.writing.burstiness * (1 - clamp01(weightA))),
          punctuationRates: blendRates(a.writing.punctuationRates, b.writing.punctuationRates, weightA),
          signatureVocabulary: unionRanked(a.writing.signatureVocabulary, b.writing.signatureVocabulary),
          avoidVocabulary: [
            ...new Set([...a.writing.avoidVocabulary, ...b.writing.avoidVocabulary]),
          ],
          toneMarkers: [...new Set([...a.writing.toneMarkers, ...b.writing.toneMarkers])],
          rhetoricalDevices: [
            ...new Set([...a.writing.rhetoricalDevices, ...b.writing.rhetoricalDevices]),
          ],
        }
      : a.writing ?? b.writing;

  const blended: VoiceProfile = {
    schemaVersion: VOICE_PROFILE_SCHEMA_VERSION,
    id: options.id,
    owner: options.owner ?? a.owner,
    kind: a.kind,
    languages: shared,
    sources: [...a.sources, ...b.sources],
    ...(writing ? { writing } : {}),
    ...(a.chat && b.chat
      ? {
          chat: {
            replyLength: blendDistributions(a.chat.replyLength, b.chat.replyLength, weightA),
            burstMessaging: round(
              a.chat.burstMessaging * clamp01(weightA) + b.chat.burstMessaging * (1 - clamp01(weightA)),
            ),
            rhetoricalQuestionRate: round(
              a.chat.rhetoricalQuestionRate * clamp01(weightA) +
                b.chat.rhetoricalQuestionRate * (1 - clamp01(weightA)),
            ),
            emojiRate: round(
              a.chat.emojiRate * clamp01(weightA) + b.chat.emojiRate * (1 - clamp01(weightA)),
            ),
            punctuationInChat: blendRates(a.chat.punctuationInChat, b.chat.punctuationInChat, weightA),
            typoAndShorthandHabits: [
              ...new Set([...a.chat.typoAndShorthandHabits, ...b.chat.typoAndShorthandHabits]),
            ],
          },
        }
      : {}),
    ...(a.behavior && b.behavior
      ? {
          behavior: {
            followUpQuestionRate: mix(a.behavior.followUpQuestionRate, b.behavior.followUpQuestionRate, weightA),
            followUpTriggers: [...new Set([...a.behavior.followUpTriggers, ...b.behavior.followUpTriggers])],
            topicOmissionRate: mix(a.behavior.topicOmissionRate, b.behavior.topicOmissionRate, weightA),
            omissionTargets: [...new Set([...a.behavior.omissionTargets, ...b.behavior.omissionTargets])],
            selfCorrectionStyle: [...new Set([...a.behavior.selfCorrectionStyle, ...b.behavior.selfCorrectionStyle])],
            topicJumpAbruptness: mix(a.behavior.topicJumpAbruptness, b.behavior.topicJumpAbruptness, weightA),
            topicJumpMarkers: [...new Set([...a.behavior.topicJumpMarkers, ...b.behavior.topicJumpMarkers])],
            agreementRate: mix(a.behavior.agreementRate, b.behavior.agreementRate, weightA),
            unsolicitedOfferRate: mix(a.behavior.unsolicitedOfferRate, b.behavior.unsolicitedOfferRate, weightA),
          },
        }
      : {}),
    ...(a.directives || b.directives
      ? { directives: [...new Set([...(a.directives ?? []), ...(b.directives ?? [])])] }
      : {}),
    notes: `Blend of ${a.id} and ${b.id} at weight ${clamp01(weightA).toFixed(2)}.`,
  };

  assertValidProfile(blended);
  return blended;
}

function mix(a: number, b: number, weightA: number): number {
  return round(a * clamp01(weightA) + b * (1 - clamp01(weightA)));
}

function blendRates(
  a: Readonly<Record<string, number>>,
  b: Readonly<Record<string, number>>,
  weightA: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[key] = round((a[key] ?? 0) * clamp01(weightA) + (b[key] ?? 0) * (1 - clamp01(weightA)));
  }
  return out;
}

function unionRanked(a: readonly string[], b: readonly string[]): string[] {
  const out: string[] = [];
  for (const term of [...a, ...b]) {
    if (!out.includes(term)) out.push(term);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Drift
// ---------------------------------------------------------------------------

export interface DriftReport {
  readonly drifted: boolean;
  readonly dimensions: ReadonlyArray<{
    readonly name: string;
    readonly baseline: number;
    readonly candidate: number;
    readonly standardDeviations: number;
  }>;
  readonly summary: string;
}

/** Beyond this many standard deviations a dimension has moved, not wobbled. */
export const DRIFT_SIGMA = 2;

/** Compare a newer profile against a baseline to see whether the voice moved. */
export function detectDrift(baseline: VoiceProfile, candidate: VoiceProfile): DriftReport {
  const dimensions: Array<DriftReport['dimensions'][number]> = [];
  const compare = (
    name: string,
    a: DistributionSummary | undefined,
    b: DistributionSummary | undefined,
  ): void => {
    if (!a || !b || a.sampleCount === 0 || b.sampleCount === 0) return;
    const spread = Math.max(a.stdDev, a.mean * 0.2, 1);
    dimensions.push({
      name,
      baseline: a.mean,
      candidate: b.mean,
      standardDeviations: round(Math.abs(b.mean - a.mean) / spread),
    });
  };

  compare('writing.sentenceLength', baseline.writing?.sentenceLength, candidate.writing?.sentenceLength);
  compare('writing.paragraphLength', baseline.writing?.paragraphLength, candidate.writing?.paragraphLength);
  compare('chat.replyLength', baseline.chat?.replyLength, candidate.chat?.replyLength);

  const driftedDimensions = dimensions.filter((d) => d.standardDeviations >= DRIFT_SIGMA);
  return {
    drifted: driftedDimensions.length > 0,
    dimensions,
    summary:
      dimensions.length === 0
        ? 'No comparable distribution: drift cannot be measured between these two profiles.'
        : driftedDimensions.length === 0
          ? `${dimensions.length} dimension(s) compared, none moved by ${DRIFT_SIGMA} standard deviations.`
          : `${driftedDimensions.map((d) => `${d.name} moved ${d.standardDeviations.toFixed(1)}σ`).join('; ')}.`,
  };
}
