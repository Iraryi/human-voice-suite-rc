/**
 * Detector contracts.
 *
 * A detector is anything that can point at a span of text and say "this is a
 * tell". Upstream executable detectors arrive here through adapters; the
 * suite's own detectors are registered alongside them and are indistinguishable
 * to the caller.
 */

import type { Language, TextMode } from '../shared/types.js';
import type { CanonicalRuleRegistry } from '../rules/canonical/registry.js';
import type { VoiceProfile } from '../voice/types.js';
import type { ConversationContext } from '../behavior/types.js';

/**
 * Detector families map onto the directory layout under `src/detector/`.
 * `assistant` is the family that looks for assistant-shaped behaviour rather
 * than prose shape, and it is the one the upstreams handle worst.
 */
export type DetectorFamily =
  | 'structural'
  | 'lexical'
  | 'rhythm'
  | 'assistant'
  | 'stylometry'
  | 'chinese'
  | 'english';

export const DETECTOR_FAMILIES: readonly DetectorFamily[] = [
  'structural',
  'lexical',
  'rhythm',
  'assistant',
  'stylometry',
  'chinese',
  'english',
];

export interface FindingEvidence {
  /** Character offset into the analysed text, inclusive. */
  readonly start: number;
  /** Character offset into the analysed text, exclusive. */
  readonly end: number;
  readonly text: string;
}

export interface Finding {
  /** The rule id the detector fired. May be an upstream-local id. */
  readonly ruleId: string;
  /** Resolved canonical id, when the registry recognised `ruleId`. */
  readonly canonicalRuleId?: string;
  /** Which upstream this detection capability came from. */
  readonly upstream: string;
  readonly detectorId: string;
  readonly category: string;
  readonly family: DetectorFamily;
  readonly severity: number;
  readonly languages: readonly string[];
  readonly message: string;
  readonly evidence: readonly FindingEvidence[];
  /** 0..1. How sure the detector is. Never blended into the score silently. */
  readonly confidence: number;
}

export interface DetectionContext {
  readonly language: Language;
  readonly mode: TextMode;
  /** Optional BCP-47 tag for finer routing, e.g. `zh-Hans`. */
  readonly locale?: string;
  /**
   * When supplied, detectors resolve their findings to canonical rule ids so
   * that three same-lineage hits collapse into one scored rule.
   */
  readonly rules?: CanonicalRuleRegistry;
  /** Hard ceiling so one noisy detector cannot flood the output. */
  readonly maxFindings?: number;
  /**
   * The voice profile to measure against, when the caller has one.
   *
   * Optional by design: a stylometry detector with no target has no distance to
   * measure, so it reports nothing rather than inventing a baseline. See
   * `src/detector/stylometry/index.ts`.
   */
  readonly voiceProfile?: VoiceProfile;
  /**
   * The conversation the text sits in.
   *
   * Several assistant smells cannot be judged from one reply: mirroring is a
   * relationship between two turns and over-completeness is a ratio between the
   * question and the answer. A detector reports what it can justify without this
   * and no more, rather than guessing from the reply alone.
   */
  readonly conversation?: ConversationContext;
}

export type DetectorStatus = 'planned' | 'partial' | 'ready';

export interface Detector {
  readonly id: string;
  /** `human-voice-suite/local` for detectors this project wrote itself. */
  readonly upstream: string;
  readonly family: DetectorFamily;
  /** Languages this detector is meaningful for; `unknown` means agnostic. */
  readonly languages: readonly string[];
  readonly status: DetectorStatus;
  readonly description: string;
  detect(text: string, context: DetectionContext): Finding[] | Promise<Finding[]>;
}
