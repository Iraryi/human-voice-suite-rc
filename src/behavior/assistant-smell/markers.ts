/**
 * The assistant-smell markers.
 *
 * Ten behaviours, each with the surface forms that betray it, in both scripts.
 *
 * Everything here is original to Human Voice Suite. The upstreams contribute
 * nothing to this layer — no repository in the corpus models chat behaviour at
 * all, which is the gap the project exists to fill. The lists were written from
 * the detection hints in `src/behavior/types.ts`, which were themselves written
 * from observed model behaviour rather than copied from a word list.
 *
 * Two properties matter for a marker list like this.
 *
 * **It must be specific.** A marker that fires on ordinary conversation is worse
 * than no marker. `好的` is how people agree; `确实` deployed as a standalone
 * opener before a restatement is the tell. Where a form is ambiguous it is
 * recorded and the detector is told to require context, rather than dropped and
 * forgotten.
 *
 * **It must say what it cannot see.** Several of the ten are not lexical at all —
 * mirroring is a relationship between two turns and over-completeness is a ratio
 * — so their markers are supporting evidence and the detector does the rest.
 */

import type { AssistantSmellId } from '../types.js';

export interface SmellMarker {
  /** The surface form, as it appears in text. */
  readonly text: string;
  readonly languages: readonly string[];
  /**
   * True when the form is ordinary on its own and only a tell in position — an
   * opener, a closer, or immediately before a restatement.
   */
  readonly needsPosition?: boolean;
  readonly note?: string;
}

const ZH = ['zh'] as const;
const EN = ['en'] as const;

function zh(text: string, needsPosition = false): SmellMarker {
  return { text, languages: ZH, ...(needsPosition ? { needsPosition: true } : {}) };
}

function en(text: string, needsPosition = false): SmellMarker {
  return { text, languages: EN, ...(needsPosition ? { needsPosition: true } : {}) };
}

/**
 * Markers per smell.
 *
 * Ordered by how certain each form is: the detector reports the first match and
 * carries the count, so a list where the strongest form comes first gives the
 * better message when several fire.
 */
export const SMELL_MARKERS: Readonly<Record<AssistantSmellId, readonly SmellMarker[]>> = {
  'chat.mirrors_user': [
    // Mirrored openers. The construction is the tell, not the words.
    zh('\u4f60\u63d0\u5230'),
    zh('\u4f60\u8bf4\u7684\u662f'),
    zh('\u6b63\u5982\u4f60\u6240\u8bf4'),
    zh('\u636e\u4f60\u6240\u8bf4'),
    en('you mentioned'),
    en('you said that'),
    en('as you noted'),
    en('based on what you described'),
    en('you are asking about'),
  ],

  'chat.over_agreement': [
    zh('\u786e\u5b9e', true),
    zh('\u6ca1\u9519', true),
    zh('\u8bf4\u5f97\u5bf9', true),
    zh('\u5b8c\u5168\u540c\u610f', true),
    zh('\u4f60\u8bf4\u5f97\u5f88\u5bf9', true),
    en('absolutely', true),
    en('exactly', true),
    en('you are absolutely right'),
    en('you are right', true),
    en('that is a great point'),
  ],

  'chat.unsolicited_advice': [
    zh('\u5efa\u8bae\u4f60'),
    zh('\u4f60\u53ef\u4ee5\u8bd5\u8bd5'),
    zh('\u4e0d\u59a8'),
    zh('\u8bb0\u5f97'),
    zh('\u6700\u597d\u662f'),
    en('it is worth'),
    en("it's worth"),
    en('you may want to'),
    en('you might want to'),
    en('consider '),
    en('make sure to'),
  ],

  'chat.auto_summary': [
    zh('\u603b\u4e4b'),
    zh('\u603b\u7684\u6765\u8bf4'),
    zh('\u603b\u7ed3\u4e00\u4e0b'),
    zh('\u7efc\u4e0a\u6240\u8ff0'),
    zh('\u7efc\u4e0a'),
    en('in summary'),
    en('in short'),
    en('to sum up'),
    en('to summarise'),
    en('to summarize'),
    en('in conclusion'),
    en('all in all'),
  ],

  'chat.unsolicited_offer': [
    zh('\u8fd8\u6709\u4ec0\u4e48\u53ef\u4ee5\u5e2e\u4f60'),
    zh('\u5982\u679c\u8fd8\u6709\u95ee\u9898'),
    zh('\u968f\u65f6\u544a\u8bc9\u6211'),
    zh('\u6b22\u8fce\u968f\u65f6\u95ee\u6211'),
    zh('\u5e0c\u671b\u8fd9\u4e9b\u5bf9\u4f60\u6709\u5e2e\u52a9'),
    zh('\u9700\u8981\u6211\u518d'),
    en('let me know if'),
    en('hope this helps'),
    en('hope that helps'),
    en('feel free to ask'),
    en('would you like me to'),
    en('want me to'),
    en('should i continue'),
  ],

  'chat.over_completeness': [
    // The tell is a ratio rather than a form, so these are the shapes that carry
    // it: a structurally complete answer where a sentence was asked for.
    zh('\u4e00\u65b9\u9762', true),
    zh('\u53e6\u4e00\u65b9\u9762', true),
    zh('\u9700\u8981\u6ce8\u610f\u7684\u662f', true),
    en('on the one hand', true),
    en('on the other hand', true),
    en('there are several', true),
    en('it depends on', true),
  ],

  'chat.explains_obvious': [
    zh('\u6240\u8c13'),
    zh('\u610f\u601d\u662f\u6307'),
    zh('\u7b80\u5355\u6765\u8bf4'),
    zh('\u6362\u53e5\u8bdd\u8bf4'),
    en('in other words'),
    en('that is to say'),
    en('which means that'),
    en('simply put'),
    en('to put it another way'),
  ],

  'chat.forced_positivity': [
    zh('\u5f88\u68d2'),
    zh('\u5389\u5bb3'),
    zh('\u52a0\u6cb9'),
    zh('\u4f60\u5df2\u7ecf\u505a\u5f97\u5f88\u597d'),
    zh('\u8fd9\u4e2a\u60f3\u6cd5\u5f88\u597d'),
    en('great question'),
    en('excellent question'),
    en('that is a great'),
    en("that's a great"),
    en('you have got this'),
    en('well done'),
  ],

  'chat.mechanical_empathy': [
    zh('\u6211\u7406\u89e3\u4f60\u7684\u611f\u53d7'),
    zh('\u6211\u7406\u89e3\u4f60\u7684\u5fc3\u60c5'),
    zh('\u8fd9\u786e\u5b9e\u8ba9\u4eba\u5f88\u6cae\u4e27'),
    zh('\u542c\u8d77\u6765\u4f60'),
    zh('\u80fd\u7406\u89e3\u4f60\u7684\u96be\u5904'),
    en('i understand how you feel'),
    en('i understand how frustrating'),
    en('that sounds really'),
    en('it sounds like you are going through'),
    en('i can imagine how'),
  ],

  'chat.unrequested_background': [
    zh('\u503c\u5f97\u4e00\u63d0\u7684\u662f'),
    zh('\u503c\u5f97\u6ce8\u610f\u7684\u662f'),
    zh('\u987a\u4fbf\u8bf4\u4e00\u4e0b'),
    zh('\u9700\u8981\u8bf4\u660e\u7684\u662f'),
    zh('\u80cc\u666f\u662f\u8fd9\u6837\u7684'),
    zh('\u8865\u5145\u4e00\u70b9'),
    // The staged pivot. A throwaway remark is answered by widening the frame
    // instead of by replying to it, which is the clearest sign that the answer
    // was composed rather than said.
    zh('\u4ece\u53e6\u4e00\u4e2a\u89d2\u5ea6\u6765\u770b'),
    zh('\u4ece\u53e6\u4e00\u4e2a\u89d2\u5ea6\u770b'),
    zh('\u6362\u4e2a\u89d2\u5ea6\u770b'),
    zh('\u4ece\u66f4\u5b8f\u89c2\u7684\u89d2\u5ea6'),
    zh('\u8fd9\u80cc\u540e\u5176\u5b9e\u53cd\u6620\u4e86'),
    zh('\u5f80\u5f80\u5c31\u85cf\u5728'),
    en('it is worth noting'),
    en("it's worth noting"),
    en('worth mentioning'),
    en('by the way'),
    en('bear in mind that'),
    en('for context'),
    en('looking at the bigger picture'),
    en('on a broader level'),
  ],
};

/** Every marker a smell watches, flattened, for a report or a test. */
export function markersFor(smellId: AssistantSmellId): readonly SmellMarker[] {
  return SMELL_MARKERS[smellId] ?? [];
}

export function markerCount(): number {
  return Object.values(SMELL_MARKERS).reduce((sum, list) => sum + list.length, 0);
}

/** Smells whose tell is not a form at all, so a marker list cannot carry them. */
export const STRUCTURAL_SMELLS: readonly AssistantSmellId[] = [
  'chat.mirrors_user',
  'chat.over_completeness',
  'chat.auto_summary',
];
