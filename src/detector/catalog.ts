/**
 * The detector catalog.
 *
 * Phase 1 declares every detector slot the suite intends to have, with the
 * phase it lands in and the upstream it will be sourced from. Declaring them
 * as data means the scan tool can honestly report which layers were live for a
 * given run, instead of silently returning a thin result.
 *
 * Nothing here pretends to be implemented. `status: 'planned'` means exactly
 * that.
 */

import type { DetectorFamily, DetectorStatus } from './types.js';
import { LOCAL_UPSTREAM } from '../rules/provenance/types.js';

export interface DetectorSlot {
  readonly id: string;
  readonly family: DetectorFamily;
  readonly status: DetectorStatus;
  readonly targetPhase: number;
  readonly description: string;
  /**
   * Upstreams whose rules or code will feed this slot. `human-voice-suite/local`
   * marks capability that is ours, not inherited.
   */
  readonly sources: readonly string[];
}

export const DETECTOR_CATALOG: readonly DetectorSlot[] = [
  // ---- structural: shape of the document, independent of language ----
  {
    id: 'structural.heading_decoration',
    family: 'structural',
    status: 'ready',
    targetPhase: 2,
    description:
      'Decorative or redundant headings, and headings repeated in the first sentence beneath them.',
    sources: ['blader/humanizer'],
  },
  {
    id: 'structural.bold_decoration',
    family: 'structural',
    status: 'ready',
    targetPhase: 2,
    description: 'Bold used as decoration rather than for emphasis of a genuinely load-bearing phrase.',
    sources: ['blader/humanizer', 'judetelan/ai-humanizer'],
  },
  {
    id: 'structural.list_overuse',
    family: 'structural',
    status: 'ready',
    targetPhase: 2,
    description: 'Bulleted or numbered lists standing in for prose that should have been written out.',
    sources: ['blader/humanizer'],
  },
  {
    id: 'structural.one_line_closer',
    family: 'structural',
    status: 'ready',
    targetPhase: 2,
    description: 'A short dramatic sentence used as a paragraph or section closer.',
    sources: ['blader/humanizer'],
  },

  // ---- lexical: word and phrase level ----
  {
    id: 'lexical.watched_phrases',
    family: 'lexical',
    status: 'ready',
    targetPhase: 2,
    description:
      'Matches the literal watched phrases contributed by every extracted upstream. Reads them from the canonical rules rather than from any one repository, so adding an upstream needs no change here.',
    sources: [
      'blader/humanizer',
      'holygeek00/humanizer-zh-cn',
      'ai-zixun/humanizer-zh',
      'judetelan/ai-humanizer',
      'lynote-ai/dsh-humanizer',
      'lynote-ai/humanize-text',
      'hardikpandya/stop-slop',
    ],
  },
  {
    id: 'lexical.ai_vocabulary',
    family: 'lexical',
    status: 'ready',
    targetPhase: 2,
    description:
      'Overused AI vocabulary with deterministic replacements. Served by the same rule-driven detector as the other lexical slots: the vocabulary arrives as the watched phrases of the canonical rules rather than as a hand-maintained list.',
    sources: ['judetelan/ai-humanizer', 'lynote-ai/humanize-text', 'blader/humanizer'],
  },
  {
    id: 'lexical.banned_phrases',
    family: 'lexical',
    status: 'ready',
    targetPhase: 2,
    description:
      'Banned and discouraged phrases, including throat-clearing and emphasis crutches. Also served by the rule-driven detector.',
    sources: ['hardikpandya/stop-slop', 'judetelan/ai-humanizer'],
  },
  {
    id: 'lexical.hedge_and_qualifier',
    family: 'lexical',
    status: 'ready',
    targetPhase: 2,
    description:
      'Stacked qualifiers and hedges that weaken a statement without adding information. Served by the rule-driven detector.',
    sources: ['blader/humanizer', 'judetelan/ai-humanizer'],
  },

  // ---- rhythm: distributional shape of the prose ----
  {
    id: 'rhythm.burstiness',
    family: 'rhythm',
    status: 'ready',
    targetPhase: 2,
    description:
      'Sentence-length variability. Uniform sentence length is one of the strongest measurable AI tells.',
    sources: ['lynote-ai/humanize-text', 'judetelan/ai-humanizer'],
  },
  {
    id: 'rhythm.triad_reflex',
    family: 'rhythm',
    status: 'ready',
    targetPhase: 2,
    description: 'Forced triads and other enumerated groups produced by rule rather than by need.',
    sources: ['blader/humanizer'],
  },
  {
    id: 'rhythm.repeated_openings',
    family: 'rhythm',
    status: 'ready',
    targetPhase: 2,
    description: 'Consecutive sentences starting with the same word or construction.',
    sources: ['blader/humanizer'],
  },

  // ---- assistant: chat behaviour rather than prose shape ----
  {
    id: 'assistant.smell_taxonomy',
    family: 'assistant',
    status: 'ready',
    targetPhase: 5,
    description:
      'IMPLEMENTED. The ten assistant smells: mirroring, over-agreement, unsolicited advice, auto summary, unsolicited offer, over-completeness, explaining the obvious, forced positivity, mechanical empathy, unrequested background.',
    sources: [LOCAL_UPSTREAM],
  },
  {
    id: 'assistant.chatbot_residue',
    family: 'assistant',
    status: 'ready',
    targetPhase: 5,
    description: 'Chat residue that survived into the output: disclaimers, knowledge-limit hedges, draft talk.',
    sources: ['blader/humanizer', LOCAL_UPSTREAM],
  },
  {
    id: 'assistant.service_closing',
    family: 'assistant',
    status: 'ready',
    targetPhase: 5,
    description: 'Offers of further help and closing service formulas.',
    sources: [LOCAL_UPSTREAM],
  },

  // ---- stylometry: distance from a target voice ----
  {
    id: 'stylometry.distribution_distance',
    family: 'stylometry',
    status: 'ready',
    // The measurement ships in Phase 2. What is Phase 6 is *learning* the
    // profile it measures against, which is the separate slot below.
    targetPhase: 2,
    description:
      'Distance between the text and a voice profile across sentence length and burstiness, measured in the profile’s own spread. Reports nothing until a scan supplies a profile.',
    sources: ['lynote-ai/dsh-humanizer', 'lynote-ai/humanize-text'],
  },
  {
    id: 'stylometry.statistical',
    family: 'stylometry',
    status: 'ready',
    targetPhase: 2,
    description:
      'The offline statistical detector from lynote-ai/humanize-text: type-token ratio, hapax ratio and sentence-length variation, reported against the canonical rules that already name those tells. English-only, and it declines samples too short to measure.',
    sources: ['lynote-ai/humanize-text'],
  },
  {
    id: 'stylometry.fingerprint_features',
    family: 'stylometry',
    status: 'ready',
    targetPhase: 6,
    description:
      'Per-habit distance from a learned voice profile: sentence length, punctuation and vocabulary, each reported against its own canonical rule rather than as one opaque number. Reports nothing until a scan supplies a profile.',
    sources: ['lynote-ai/dsh-humanizer', LOCAL_UPSTREAM],
  },

  // ---- chinese-specific ----
  {
    id: 'chinese.translationese',
    family: 'chinese',
    status: 'ready',
    targetPhase: 8,
    description:
      'Translationese: Chinese that reads as translated English. The register (的的不休, 被字句 overuse, light-verb constructions, abstract-noun suffixes, redundant pronouns) is measured by `chinese.translationese`; the formulaic connectives are charged separately by `lexical.translationese_connective`, so neither tell is deducted twice. Phase 8 built this after the benchmark showed the slot had no detector answering to it.',
    sources: ['ai-zixun/humanizer-zh', 'holygeek00/humanizer-zh-cn', LOCAL_UPSTREAM],
  },
  {
    id: 'chinese.boilerplate_phrases',
    family: 'chinese',
    status: 'ready',
    targetPhase: 2,
    description: 'Chinese boilerplate and cliché phrases, including four-character idiom padding.',
    sources: ['ai-zixun/humanizer-zh', 'lynote-ai/humanize-text'],
  },
  {
    id: 'chinese.punctuation_habits',
    family: 'chinese',
    status: 'ready',
    targetPhase: 2,
    description:
      'Chinese punctuation conventions: full-width marks, 「」 versus curly quotes, and em-dash overuse.',
    sources: ['ai-zixun/humanizer-zh', 'blader/humanizer'],
  },

  // ---- english-specific ----
  {
    id: 'english.phrase_blacklist',
    family: 'english',
    status: 'ready',
    targetPhase: 2,
    description: 'English AI phrase blacklist and the constructions that carry it.',
    sources: ['blader/humanizer', 'judetelan/ai-humanizer', 'hardikpandya/stop-slop'],
  },
  {
    id: 'english.passive_and_subjectless',
    family: 'english',
    status: 'ready',
    targetPhase: 2,
    description: 'Passive voice and missing subjects where an actor should be named.',
    sources: ['blader/humanizer', 'hardikpandya/stop-slop'],
  },
];

export function catalogForFamily(family: DetectorFamily): DetectorSlot[] {
  return DETECTOR_CATALOG.filter((slot) => slot.family === family);
}

export function catalogByStatus(status: DetectorStatus): DetectorSlot[] {
  return DETECTOR_CATALOG.filter((slot) => slot.status === status);
}

/** Slots that are actually runnable right now. */
export function readySlots(): DetectorSlot[] {
  return catalogByStatus('ready');
}
