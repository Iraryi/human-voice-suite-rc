/**
 * Upstream revisions and what a pattern number means at each of them.
 *
 * The single most dangerous assumption in this corpus is that pattern 12 means
 * the same thing everywhere. It does not. `blader/humanizer` published 33
 * numbered patterns at v2.9.1 and renumbered to 25 at v3.0.0, and the Chinese
 * repositories were built against revisions from before either — one at the
 * v2.9.1 baseline, one at v2.1.0. "Avoid dashes" is pattern 14 at v2.9.1 and
 * pattern 8 at v3.0.0.
 *
 * So a bare number is not an identifier. This module turns
 * `(revision, number)` into something comparable, and it is why the canonical
 * registry keys on signatures rather than on numbers.
 *
 * The titles below are transcribed from the git history of the pinned clones and
 * are checked against it by `tests/compatibility.test.ts`. They are not copied
 * from anywhere else and not reconstructed from memory.
 */

import { BLADER_SIGNATURES } from '../../upstream/adapters/blader/signatures.js';

export type BladerRevision = 'v2.1.0' | 'v2.9.1' | 'v3.0.0';

export const AREA = 'compatibility.upstream-version';
export const TARGET_PHASE = 3;

export interface RevisionPin {
  readonly revision: BladerRevision;
  /** Full commit SHA when it can be resolved from a clone, else null. */
  readonly commit: string | null;
  /** How many numbered patterns this revision has. */
  readonly patternCount: number;
  /** Whether the revision is reachable in the clones this project keeps. */
  readonly available: boolean;
  readonly notes: string;
}

export const BLADER_REVISIONS: readonly RevisionPin[] = [
  {
    revision: 'v2.1.0',
    commit: null,
    patternCount: 24,
    available: false,
    notes:
      'Not present in the blader clone: the tag does not exist there and the commit is not an ' +
      'ancestor of HEAD, so the pattern list cannot be verified. The count comes from ' +
      'op7418/Humanizer-zh, which declares itself a translation of this revision and ships 24 ' +
      'patterns. Recorded as unverified rather than reconstructed.',
  },
  {
    revision: 'v2.9.1',
    commit: '523374dee72d67c7b2b5f858ea0094ffda49c3ac',
    patternCount: 33,
    available: true,
    notes:
      'The baseline holygeek00/humanizer-zh-cn pins. The commit is reachable from both the upstream ' +
      'clone and the fork, and its 33 titles are identical to the v2.9.1 tag, so the pin is v2.9.1. ' +
      'It is not the upstream HEAD: v3.0.0 has since renumbered and regrouped the list.',
  },
  {
    revision: 'v3.0.0',
    commit: '9862685f575c65a8247f90369951df1b3416e3d6',
    patternCount: 25,
    available: true,
    notes:
      'The pinned upstream HEAD. Regrouped into five lettered sections and renumbered. Five ' +
      'patterns are marked "weak alone".',
  },
];

/** The 33 pattern titles of the v2.9.1 baseline, verbatim from its SKILL.md. */
export const BLADER_V291_TITLES: readonly string[] = [
  'Undue Emphasis on Significance, Legacy, and Broader Trends',
  'Undue Emphasis on Notability and Media Coverage',
  'Superficial Analyses with -ing Endings',
  'Promotional and Advertisement-like Language',
  'Vague Attributions and Weasel Words',
  'Outline-like "Challenges and Future Prospects" Sections',
  'Overused "AI Vocabulary" Words',
  'Avoidance of "is"/"are" (Copula Avoidance)',
  'Negative Parallelisms and Tailing Negations',
  'Rule of Three Overuse',
  'Elegant Variation (Synonym Cycling)',
  'False Ranges',
  'Passive Voice and Subjectless Fragments',
  'Em Dashes (and En Dashes): Cut Them',
  'Overuse of Boldface',
  'Inline-Header Vertical Lists',
  'Title Case in Headings',
  'Emojis',
  'Curly Quotation Marks',
  'Collaborative Communication Artifacts',
  'Knowledge-Cutoff Disclaimers and Speculative Gap-Filling',
  'Sycophantic/Servile Tone',
  'Filler Phrases',
  'Excessive Hedging',
  'Generic Positive Conclusions',
  'Hyphenated Word Pair Overuse',
  'Persuasive Authority Tropes',
  'Signposting and Announcements',
  'Fragmented Headers',
  'Diff-Anchored Writing',
  'Manufactured Punchlines and Staccato Drama',
  'Aphorism Formulas',
  'Conversational Rhetorical Openers',
];

/**
 * v2.9.1 number to canonical signature.
 *
 * Numbers 6, 11, 12, 19, 22, 23, 25 and 32 have no direct v3.0.0 counterpart:
 * v3.0.0 either folded them into a broader pattern or dropped them. Where the
 * tell survives under a different heading the signature is shared, so the two
 * revisions still collapse onto one rule.
 */
export const BLADER_V291_SIGNATURES: Readonly<Record<string, string>> = {
  '1': 'structural.inflated_significance',
  '2': 'lexical.borrowed_authority',
  '3': 'lexical.ing_trailers',
  '4': 'lexical.sales_language',
  '5': 'lexical.vague_attribution',
  '6': 'structural.stock_challenges_outlook',
  '7': 'lexical.ai_vocabulary',
  '8': 'lexical.copula_avoidance',
  '9': 'structural.negation_contrast',
  '10': 'rhythm.forced_triad',
  '11': 'lexical.synonym_rotation',
  '12': 'structural.false_range',
  '13': 'lexical.passive_and_subjectless',
  '14': 'rhythm.dash_overuse',
  '15': 'formatting.bold_decoration',
  '16': 'formatting.bold_label_list',
  '17': 'formatting.decorative_headings',
  '18': 'formatting.emoji_decoration',
  '19': 'formatting.curly_quotes',
  '20': 'assistant.chatbot_residue',
  '21': 'assistant.knowledge_limit_disclaimer',
  '22': 'assistant.sycophancy',
  '23': 'lexical.filler_phrase',
  '24': 'lexical.stacked_qualifiers',
  '25': 'structural.universal_positive_ending',
  '26': 'formatting.hyphenated_pairs',
  '27': 'lexical.aphorism_dressing',
  '28': 'structural.staged_runup',
  '29': 'structural.heading_restated',
  '30': 'structural.writes_about_previous_version',
  '31': 'structural.one_line_closer',
  '32': 'lexical.aphorism_dressing',
  '33': 'structural.staged_candor',
};

/**
 * Where the v2.9.1 baseline and its Chinese localization differ.
 *
 * `holygeek00/humanizer-zh-cn` is the best-behaved member of the lineage: it
 * keeps the upstream notice, enforces it in its own validator, and localises
 * rather than retranslates. It is still not 1:1 at every number, and the two
 * places where it is not are recorded so a rule imported from the fork is never
 * silently attributed to the upstream pattern it does not come from.
 */
export interface LocalizationDivergence {
  readonly number: number;
  readonly upstream: string;
  readonly localized: string;
  readonly note: string;
}

export const HUMANIZER_ZH_CN_DIVERGENCES: readonly LocalizationDivergence[] = [
  {
    number: 7,
    upstream: 'Overused "AI Vocabulary" Words',
    localized: '抽象动词吞掉具体动作',
    note:
      'The fork retargeted this slot from a vocabulary list to abstract verbs that hide the ' +
      'concrete action. It is not a translation of the upstream pattern, so its signature is ' +
      '`structural.abstract_verb_swallows_action` rather than `lexical.ai_vocabulary`.',
  },
  {
    number: 19,
    upstream: 'Curly Quotation Marks',
    localized: '全角半角与引号混用',
    note:
      'Broadened from curly quotes specifically to full-width and half-width marks mixed, a ' +
      'Chinese typography tell the English revision has no pattern for. Its signature is ' +
      '`chinese.punctuation_width` rather than `formatting.curly_quotes`.',
  },
];

/** Resolve a pattern number at a revision to a canonical signature. */
export function signatureAtRevision(
  revision: BladerRevision,
  patternNumber: number | string,
): string | undefined {
  const key = String(patternNumber);
  switch (revision) {
    case 'v3.0.0':
      return BLADER_SIGNATURES[key];
    case 'v2.9.1':
      return BLADER_V291_SIGNATURES[key];
    case 'v2.1.0':
      // The revision cannot be read from the clones, so nothing is claimed.
      return undefined;
  }
}

/**
 * The number the same tell carries at another revision — the question a
 * migration actually has to answer.
 *
 * Returns undefined rather than guessing when the tell has no counterpart there,
 * because a wrong number is worse than no number.
 */
export function translatePatternNumber(
  from: BladerRevision,
  to: BladerRevision,
  patternNumber: number | string,
): string | undefined {
  if (from === to) return String(patternNumber);
  const signature = signatureAtRevision(from, patternNumber);
  if (signature === undefined) return undefined;
  const target = from === 'v3.0.0' ? BLADER_V291_SIGNATURES : BLADER_SIGNATURES;
  return Object.entries(target).find(([, value]) => value === signature)?.[0];
}

export function revisionPin(revision: BladerRevision): RevisionPin | undefined {
  return BLADER_REVISIONS.find((pin) => pin.revision === revision);
}

/** Every revision that can actually be checked against a clone. */
export function verifiableRevisions(): BladerRevision[] {
  return BLADER_REVISIONS.filter((pin) => pin.available).map((pin) => pin.revision);
}

/** Total numbers that persist across the renumbering, and those that do not. */
export function renumberingSummary(): {
  readonly carried: readonly { readonly signature: string; readonly v291: string; readonly v300: string }[];
  readonly droppedAtV300: readonly { readonly v291: string; readonly signature: string }[];
  readonly addedAtV300: readonly { readonly v300: string; readonly signature: string }[];
} {
  const carried: { signature: string; v291: string; v300: string }[] = [];
  const droppedAtV300: { v291: string; signature: string }[] = [];
  const addedAtV300: { v300: string; signature: string }[] = [];

  const v300BySignature = new Map<string, string>();
  for (const [number, signature] of Object.entries(BLADER_SIGNATURES)) {
    if (!v300BySignature.has(signature)) v300BySignature.set(signature, number);
  }

  const v291Signatures = new Set<string>();
  for (const [number, signature] of Object.entries(BLADER_V291_SIGNATURES)) {
    v291Signatures.add(signature);
    const v300 = v300BySignature.get(signature);
    if (v300 === undefined) droppedAtV300.push({ v291: number, signature });
    else carried.push({ signature, v291: number, v300 });
  }

  for (const [signature, v300] of v300BySignature) {
    if (!v291Signatures.has(signature)) addedAtV300.push({ v300, signature });
  }

  return { carried, droppedAtV300, addedAtV300 };
}
