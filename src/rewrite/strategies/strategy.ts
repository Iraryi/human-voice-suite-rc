/**
 * Strategy selection.
 *
 * The project brief is explicit that strategy must be chosen by deterministic
 * conditions, not by an agent improvising a plan at runtime. So this is a
 * first-match-wins rule table, and the rationale is recorded in the result so
 * a surprising choice can be traced rather than guessed at.
 */

import type { Language, TextMode } from '../../shared/types.js';
import type { TextStats } from '../../shared/text.js';
import type { DetectorFamily } from '../../detector/types.js';

export type PipelineStage =
  | 'mode-detection'
  | 'behavior-baseline'
  | 'voice-profile'
  | 'draft'
  | 'unified-scan'
  | 'strategy-selection'
  | 'voice-contract'
  | 'behavior-contract'
  | 'rewrite'
  | 'validation'
  | 'retry-once';

export const FULL_PIPELINE: readonly PipelineStage[] = [
  'mode-detection',
  'draft',
  'unified-scan',
  'strategy-selection',
  'voice-contract',
  'behavior-contract',
  'rewrite',
  'validation',
  'retry-once',
];

/**
 * The fast path from section 18. A short chat turn must not pay for the full
 * pipeline; there is no draft, no scan and no retry.
 */
export const FAST_PATH_PIPELINE: readonly PipelineStage[] = [
  'mode-detection',
  'behavior-baseline',
  'voice-profile',
  'rewrite',
];

export interface Strategy {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly fastPath: boolean;
  readonly detectorFamilies: readonly DetectorFamily[];
  /** Canonical rule categories that matter for this strategy. */
  readonly ruleCategories: readonly string[];
  /** Upstream adapter ids whose rules dominate this strategy. */
  readonly adapters: readonly string[];
  readonly useVoiceProfile: boolean;
  readonly useBehaviorBaseline: boolean;
  readonly pipeline: readonly PipelineStage[];
  /** Why this strategy was chosen, filled in by `selectStrategy`. */
  readonly rationale: string;
}

export interface StrategyInput {
  readonly language: Language;
  readonly mode: TextMode;
  readonly textStats?: TextStats;
  readonly hasVoiceProfile?: boolean;
  readonly voiceProfileId?: string;
  readonly turnCount?: number;
  /** Overrides the length-based fast-path decision when supplied. */
  readonly isShortTurn?: boolean;
}

/** Character count below which a chat turn counts as short. */
export const SHORT_TURN_MAX_CHARS = 240;

interface StrategyRule {
  readonly id: string;
  readonly matches: (input: StrategyInput) => boolean;
  readonly build: (input: StrategyInput) => Omit<Strategy, 'rationale'> & { rationale: string };
}

function isShort(input: StrategyInput): boolean {
  if (input.isShortTurn !== undefined) return input.isShortTurn;
  const chars = input.textStats?.charCount ?? 0;
  return chars > 0 && chars <= SHORT_TURN_MAX_CHARS;
}

const RULES: readonly StrategyRule[] = [
  // ---- personal voice wins over everything else when a profile is loaded ----
  {
    id: 'personal-voice-chat',
    matches: (input) => input.hasVoiceProfile === true && input.mode === 'chat',
    build: () => ({
      id: 'personal-voice-chat',
      label: 'Personal voice, chat',
      description:
        'The user has a learned chat profile. Their own voice and behaviour outrank any generic humanizer.',
      fastPath: true,
      detectorFamilies: ['assistant'],
      ruleCategories: ['chat'],
      adapters: ['dsh-humanizer'],
      useVoiceProfile: true,
      useBehaviorBaseline: true,
      pipeline: FAST_PATH_PIPELINE,
      rationale:
        'A loaded chat voice profile is the strongest available signal, and chat turns take the fast path.',
    }),
  },
  {
    id: 'personal-voice-writing',
    matches: (input) => input.hasVoiceProfile === true,
    build: () => ({
      id: 'personal-voice-writing',
      label: 'Personal voice, writing',
      description:
        'Learned writing voice plus local extensions, with upstream rules used only for tell removal.',
      fastPath: false,
      detectorFamilies: ['structural', 'lexical', 'rhythm', 'stylometry'],
      ruleCategories: ['structural', 'lexical', 'rhythm'],
      adapters: ['dsh-humanizer', 'blader-humanizer'],
      useVoiceProfile: true,
      useBehaviorBaseline: false,
      pipeline: FULL_PIPELINE,
      rationale:
        'A loaded writing profile outranks generic humanizers, but tell removal still runs and stylometry now has a target to measure against.',
    }),
  },

  // ---- chat ----
  {
    id: 'zh-chat',
    matches: (input) => input.mode === 'chat' && input.language === 'zh' && isShort(input),
    build: () => ({
      id: 'zh-chat',
      label: 'Chinese chat, short turn',
      description:
        'Behaviour Engine first, voice profile second, Chinese humanizer rules only as a light lexical pass.',
      fastPath: true,
      detectorFamilies: ['assistant'],
      ruleCategories: ['chat'],
      adapters: ['humanizer-zh'],
      useVoiceProfile: true,
      useBehaviorBaseline: true,
      pipeline: FAST_PATH_PIPELINE,
      rationale:
        'Short Chinese chat turn: behaviour and voice matter, prose shape does not. Running the full pipeline here would be waste.',
    }),
  },
  {
    id: 'en-chat',
    matches: (input) => input.mode === 'chat' && input.language === 'en' && isShort(input),
    build: () => ({
      id: 'en-chat',
      label: 'English chat, short turn',
      description: 'Behaviour Engine first, voice profile second, no prose pipeline.',
      fastPath: true,
      detectorFamilies: ['assistant'],
      ruleCategories: ['chat'],
      adapters: [],
      useVoiceProfile: true,
      useBehaviorBaseline: true,
      pipeline: FAST_PATH_PIPELINE,
      rationale: 'Short English chat turn: same reasoning as the Chinese fast path.',
    }),
  },
  {
    id: 'chat-long-turn',
    matches: (input) => input.mode === 'chat',
    build: () => ({
      id: 'chat-long-turn',
      label: 'Chat, long turn',
      description:
        'Behaviour baseline plus assistant-smell detection plus a light anti-AI pass, without the full prose pipeline.',
      fastPath: false,
      detectorFamilies: ['assistant', 'lexical'],
      ruleCategories: ['chat', 'lexical'],
      adapters: ['humanizer-zh'],
      useVoiceProfile: true,
      useBehaviorBaseline: true,
      pipeline: [
        'mode-detection',
        'behavior-baseline',
        'voice-profile',
        'unified-scan',
        'behavior-contract',
        'rewrite',
        'validation',
      ],
      rationale:
        'The turn is long enough to carry assistant smells, but it is still chat, so prose structural rules stay off.',
    }),
  },

  // ---- long-form writing ----
  {
    id: 'zh-prose',
    matches: (input) =>
      input.language === 'zh' && (input.mode === 'prose' || input.mode === 'unknown'),
    build: () => ({
      id: 'zh-prose',
      label: 'Chinese long-form prose',
      description:
        'Chinese humanizer rules plus structural rules plus the detector engine, then voice and behaviour contracts.',
      fastPath: false,
      detectorFamilies: ['structural', 'lexical', 'rhythm', 'chinese'],
      ruleCategories: ['structural', 'lexical', 'rhythm', 'chinese', 'chat'],
      adapters: ['humanizer-zh', 'blader-humanizer', 'ai-humanizer'],
      useVoiceProfile: true,
      useBehaviorBaseline: false,
      pipeline: FULL_PIPELINE,
      rationale:
        'Chinese prose needs the Chinese-specific detectors, and it also inherits structural rules from the English lineage.',
    }),
  },
  {
    id: 'en-prose',
    matches: (input) =>
      input.language === 'en' && (input.mode === 'prose' || input.mode === 'unknown'),
    build: () => ({
      id: 'en-prose',
      label: 'English long-form prose',
      description: 'Structural and lexical rules plus the detector engine.',
      fastPath: false,
      detectorFamilies: ['structural', 'lexical', 'rhythm', 'english'],
      ruleCategories: ['structural', 'lexical', 'rhythm', 'english', 'chat'],
      adapters: ['blader-humanizer', 'ai-humanizer'],
      useVoiceProfile: true,
      useBehaviorBaseline: false,
      pipeline: FULL_PIPELINE,
      rationale: 'English prose is the best-covered case; no Chinese-specific detectors apply.',
    }),
  },
  {
    id: 'formal',
    matches: (input) => input.mode === 'formal',
    build: (input) => ({
      id: 'formal',
      label: 'Formal writing',
      description:
        'Conservative tell removal only. Formal register legitimately uses some patterns that read as AI tells in prose.',
      fastPath: false,
      detectorFamilies: ['lexical', 'rhythm', 'assistant'],
      ruleCategories: ['lexical', 'rhythm', 'chat'],
      adapters: input.language === 'zh' ? ['humanizer-zh'] : ['blader-humanizer'],
      useVoiceProfile: true,
      useBehaviorBaseline: false,
      pipeline: FULL_PIPELINE,
      rationale:
        'Formal register suppresses structural rewriting: passive voice and hedges are often correct here, so only lexical and rhythm tells are acted on.',
    }),
  },
  {
    id: 'technical',
    matches: (input) => input.mode === 'technical',
    build: () => ({
      id: 'technical',
      label: 'Technical writing',
      description:
        'Protect identifiers and code aggressively; act only on lexical and assistant tells.',
      fastPath: false,
      detectorFamilies: ['lexical', 'assistant'],
      ruleCategories: ['lexical', 'chat'],
      adapters: ['blader-humanizer'],
      useVoiceProfile: true,
      useBehaviorBaseline: false,
      pipeline: FULL_PIPELINE,
      rationale:
        'Technical text has a high cost of being wrong. Structural and rhythm rewriting is disabled because it can damage precision.',
    }),
  },
  {
    id: 'public',
    matches: (input) => input.mode === 'public',
    build: (input) => ({
      id: 'public',
      label: 'Public-facing writing',
      description: 'Balanced: tell removal plus voice matching, with a strict preservation budget.',
      fastPath: false,
      detectorFamilies: ['structural', 'lexical', 'rhythm', 'assistant', 'chinese', 'english'],
      ruleCategories: ['structural', 'lexical', 'rhythm', 'chat', 'chinese', 'english'],
      adapters:
        input.language === 'zh'
          ? ['humanizer-zh', 'blader-humanizer', 'ai-humanizer']
          : ['blader-humanizer', 'ai-humanizer'],
      useVoiceProfile: true,
      useBehaviorBaseline: false,
      pipeline: FULL_PIPELINE,
      rationale: 'Public writing gets the broadest detector set.',
    }),
  },
];

/** Last-resort strategy so selection is total and never throws. */
const FALLBACK: Strategy = {
  id: 'default',
  label: 'Default',
  description: 'No specific condition matched; use the full pipeline with every available layer.',
  fastPath: false,
  detectorFamilies: ['structural', 'lexical', 'rhythm', 'assistant'],
  ruleCategories: ['structural', 'lexical', 'rhythm', 'chat'],
  adapters: ['blader-humanizer', 'ai-humanizer', 'humanizer-zh'],
  useVoiceProfile: true,
  useBehaviorBaseline: false,
  pipeline: FULL_PIPELINE,
  rationale:
    'Language or mode was unknown, so no specialised strategy could be justified. The full pipeline runs and the unknown language is surfaced as a caveat.',
};

export function selectStrategy(input: StrategyInput): Strategy {
  for (const rule of RULES) {
    if (rule.matches(input)) return rule.build(input);
  }
  return FALLBACK;
}

export function strategyIds(): string[] {
  return [...RULES.map((rule) => rule.id), FALLBACK.id];
}

/**
 * Infer the text mode from shape when the caller did not declare one.
 * Deterministic and conservative: ambiguity resolves to `unknown` rather than
 * to a guess that would silently pick the wrong strategy.
 */
export function inferMode(text: string, declared?: TextMode): TextMode {
  if (declared && declared !== 'unknown') return declared;
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'unknown';
  const questionMarks = (trimmed.match(/[?？]/g) ?? []).length;
  const codeFence = trimmed.includes('```');
  const codeInline = /`[^`\n]+`/.test(trimmed);
  if (codeFence || codeInline) return 'technical';
  if (trimmed.length <= SHORT_TURN_MAX_CHARS && questionMarks > 0) return 'chat';
  return 'unknown';
}
