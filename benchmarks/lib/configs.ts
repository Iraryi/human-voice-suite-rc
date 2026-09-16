/**
 * The ablation configurations.
 *
 * Section 21 of the brief requires ablation, and the reason is simple: a
 * benchmark that only ever tests the full stack cannot tell a layer that helps
 * from a layer that does nothing, or from a layer that actively hurts. Each
 * configuration here switches a layer off **in the real code path** — by handing
 * `scan` a shorter family list — rather than by reimplementing the scanner with
 * the layer removed. A benchmark that measures a reimplementation measures the
 * reimplementation.
 */

import type { DetectorFamily } from '../../src/detector/types.js';

/** Lexical, structural, rhythm and the language-specific families. */
export const PROSE_FAMILIES: readonly DetectorFamily[] = [
  'lexical',
  'structural',
  'rhythm',
  'chinese',
  'english',
];

/** The stylometry family, which is where distance from a voice profile is measured. */
export const VOICE_FAMILIES: readonly DetectorFamily[] = ['stylometry'];

/** The assistant-behaviour family. */
export const BEHAVIOR_FAMILIES: readonly DetectorFamily[] = ['assistant'];

export interface AblationConfig {
  readonly id: string;
  readonly label: string;
  /** What this row of the table is meant to settle. */
  readonly question: string;
  readonly families: readonly DetectorFamily[];
  /** Attach a voice profile learned from the corpus' human samples. */
  readonly voice: boolean;
  /** Supply the conversation, without which half the behaviour engine cannot judge. */
  readonly conversation: boolean;
  /** Use a recorded candidate rewrite, which is the only way preservationScore is measurable. */
  readonly candidate: boolean;
}

export const CONFIGS: readonly AblationConfig[] = [
  {
    id: 'baseline',
    label: 'baseline',
    question:
      'What does the suite report with every layer switched off? This row exists so the other rows cannot quietly double-count: it is the empty measurement they are compared against.',
    families: [],
    voice: false,
    conversation: false,
    candidate: false,
  },
  {
    id: 'anti-ai',
    label: '+anti-ai',
    question: 'Does tell removal do anything measurable at all?',
    families: PROSE_FAMILIES,
    voice: false,
    conversation: false,
    candidate: false,
  },
  {
    id: 'voice',
    label: '+voice',
    question: 'What does a target profile see that the tell detectors do not?',
    families: VOICE_FAMILIES,
    voice: true,
    conversation: false,
    candidate: false,
  },
  {
    id: 'behavior',
    label: '+behavior',
    question:
      'Does the behaviour engine see the case a lexical detector calls clean? This is the row that justifies the project.',
    families: BEHAVIOR_FAMILIES,
    voice: false,
    conversation: true,
    candidate: false,
  },
  {
    id: 'anti-ai+voice',
    label: '+anti-ai+voice',
    question: 'Does voice matching add anything once tells are gone, or is it decoration?',
    families: [...PROSE_FAMILIES, ...VOICE_FAMILIES],
    voice: true,
    conversation: false,
    candidate: false,
  },
  {
    id: 'anti-ai+behavior',
    label: '+anti-ai+behavior',
    question:
      'Do the two layers measure different problems, or the same one twice? Their scores are reported separately precisely so this row can answer.',
    families: [...PROSE_FAMILIES, ...BEHAVIOR_FAMILIES],
    voice: false,
    conversation: true,
    candidate: false,
  },
  {
    id: 'full',
    label: 'full',
    question:
      'Everything at once, plus preservation when a candidate rewrite has been recorded. Does the whole exceed the parts, and does validation over-edit?',
    families: [...PROSE_FAMILIES, ...VOICE_FAMILIES, ...BEHAVIOR_FAMILIES],
    voice: true,
    conversation: true,
    candidate: true,
  },
];

export function configById(id: string): AblationConfig | undefined {
  return CONFIGS.find((config) => config.id === id);
}

export function configIds(): string[] {
  return CONFIGS.map((config) => config.id);
}
