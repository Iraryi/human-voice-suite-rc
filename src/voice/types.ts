/**
 * The unified voice model.
 *
 * The project brief requires that a profile is no longer just "average
 * sentence length, punctuation, vocabulary". A profile must also describe how
 * a person *behaves* in conversation: when they ask a follow-up question, when
 * they deliberately ignore a minor point, how long their replies run, whether
 * they fire several short messages in a row, how they correct themselves, and
 * how they jump topics.
 *
 * That is the difference between `WritingVoiceFeatures` and
 * `ConversationBehaviorFeatures` below.
 */

import type { SourceReference } from '../rules/provenance/types.js';

export const VOICE_PROFILE_SCHEMA_VERSION = '1.0.0';

/**
 * A profile is scoped, not global. The same person has a different voice in
 * chat than in formal writing, so `user/chat`, `user/formal`,
 * `user/technical` and `user/public` are four profiles, not one.
 */
export type VoiceProfileKind = 'writing' | 'chat' | 'conversation-behavior' | 'combined';

/** `user/chat`, `user/formal`, `author/fengtang`, ... */
export type VoiceProfileId = string;

export interface DistributionSummary {
  readonly mean: number;
  readonly median: number;
  readonly stdDev: number;
  readonly min: number;
  readonly max: number;
  readonly sampleCount: number;
}

export function emptyDistribution(): DistributionSummary {
  return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, sampleCount: 0 };
}

/** Classical writing-voice dimensions, matching what upstreams already offer. */
export interface WritingVoiceFeatures {
  readonly sentenceLength: DistributionSummary;
  readonly paragraphLength: DistributionSummary;
  /** Sentence-length variability. Low burstiness is a strong AI tell. */
  readonly burstiness: number;
  /** Punctuation marks per 1000 characters, keyed by the literal mark. */
  readonly punctuationRates: Readonly<Record<string, number>>;
  /** Preferred vocabulary, most characteristic first. */
  readonly signatureVocabulary: readonly string[];
  /** Words and phrases this voice never uses. */
  readonly avoidVocabulary: readonly string[];
  readonly toneMarkers: readonly string[];
  readonly rhetoricalDevices: readonly string[];
}

/** How a person writes in short-form chat. */
export interface ChatVoiceFeatures {
  readonly replyLength: DistributionSummary;
  /**
   * Tendency to split one thought across consecutive short messages.
   * 0 = always one message, 1 = almost always fragmented.
   */
  readonly burstMessaging: number;
  /** Tendency to answer with a question. 0..1. */
  readonly rhetoricalQuestionRate: number;
  readonly emojiRate: number;
  readonly punctuationInChat: Readonly<Record<string, number>>;
  readonly typoAndShorthandHabits: readonly string[];
}

/** How a person behaves across a conversation, independent of any one reply. */
export interface ConversationBehaviorFeatures {
  /**
   * How often the person asks a clarifying follow-up instead of answering.
   * 0..1.
   */
  readonly followUpQuestionRate: number;
  /** Situations in which this person asks a follow-up, described concretely. */
  readonly followUpTriggers: readonly string[];
  /**
   * How often the person silently drops a minor point raised by the other
   * side. A high value is a strong human signal; assistants almost never do it.
   */
  readonly topicOmissionRate: number;
  /** Kinds of points this person tends to skip. */
  readonly omissionTargets: readonly string[];
  /** How the person self-corrects: `inline`, `follow-up-message`, `edit`, `none`. */
  readonly selfCorrectionStyle: readonly string[];
  /** How abruptly the person changes subject. 0 = smooth, 1 = abrupt. */
  readonly topicJumpAbruptness: number;
  /** Signals the person uses to change subject. */
  readonly topicJumpMarkers: readonly string[];
  /**
   * How much agreement the person volunteers. High values are an assistant
   * tell; humans disagree or stay neutral more often.
   */
  readonly agreementRate: number;
  /** How often the person closes with an offer of further help. 0..1. */
  readonly unsolicitedOfferRate: number;
}

export interface VoiceExample {
  readonly text: string;
  readonly language: string;
  readonly mode?: string;
  readonly note?: string;
}

export interface VoiceProfile {
  readonly schemaVersion: string;
  readonly id: VoiceProfileId;
  /** `user` for a learned personal profile, or an upstream key for an imported one. */
  readonly owner: string;
  readonly kind: VoiceProfileKind;
  readonly languages: readonly string[];
  /** Where this profile came from, at rule-level provenance standards. */
  readonly sources: readonly SourceReference[];
  readonly writing?: WritingVoiceFeatures;
  readonly chat?: ChatVoiceFeatures;
  readonly behavior?: ConversationBehaviorFeatures;
  /**
   * Instructions that cannot be measured.
   *
   * An imported qualitative profile — `ai-zixun/humanizer-zh`'s eight author
   * voices are the example — describes habits in prose and ships no sample
   * passages, so no distribution can be learned from it. Those instructions are
   * carried here and reach the rewrite contract, and they contribute **nothing**
   * to `voiceScore`: a number cannot be derived from them, and inventing one
   * would make the score mean less than it claims to.
   */
  readonly directives?: readonly string[];
  readonly examples?: readonly VoiceExample[];
  readonly notes?: string;
}

export interface VoiceProfileSummary {
  readonly id: VoiceProfileId;
  readonly owner: string;
  readonly kind: VoiceProfileKind;
  readonly languages: readonly string[];
  readonly hasWriting: boolean;
  readonly hasChat: boolean;
  readonly hasBehavior: boolean;
  readonly exampleCount: number;
}

export function summariseProfile(profile: VoiceProfile): VoiceProfileSummary {
  return {
    id: profile.id,
    owner: profile.owner,
    kind: profile.kind,
    languages: profile.languages,
    hasWriting: profile.writing !== undefined,
    hasChat: profile.chat !== undefined,
    hasBehavior: profile.behavior !== undefined,
    exampleCount: profile.examples?.length ?? 0,
  };
}
