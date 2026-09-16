/**
 * Voice fingerprint extraction.
 *
 * One extractor, two callers. Learning a profile from samples and measuring a
 * candidate text against a profile must use the *same* measurement, or the
 * distance means nothing. So there is one function here and both sides call it.
 *
 * What it measures is deliberately narrow. A fingerprint records habits that can
 * be counted — sentence and paragraph length, burstiness, punctuation rates,
 * habitual vocabulary, message fragmentation, emoji rate — and refuses to invent
 * a number for anything it cannot count. Nothing here is a persona, and nothing
 * here is a judgement: extraction says what the text does, `scoring` says how far
 * that is from a target.
 *
 * Two upstream lessons are applied rather than inherited:
 *
 * - `lynote-ai/dsh-humanizer`'s 25-field fingerprint computes 10 fields it never
 *   scores. Dead features are not imported here; every field this extractor
 *   produces is consumed by `compareToProfile`.
 * - `lynote-ai/humanize-text` ships statistical anchors with no corpus behind
 *   them. Anything needing a "typical" value takes it from a profile and reports
 *   "unmeasured" when there is no profile, rather than from a constant nobody can
 *   defend.
 */

import { computeTextStats, detectLanguage, isCjkChar, splitSentences, tokenize } from '../../shared/text.js';
import type { TextStats } from '../../shared/text.js';
import type { Language, TextMode } from '../../shared/types.js';
import { compareText } from '../../shared/order.js';
import type {
  ChatVoiceFeatures,
  DistributionSummary,
  WritingVoiceFeatures,
} from '../types.js';

export const AREA = 'voice.fingerprint';
export const TARGET_PHASE = 6;

/**
 * Below this many sentences the length distribution is noise, and a profile
 * learned from it will flag every real text as deviant. Extraction still
 * returns the numbers; `sampleCount` carries how thin they are so the scorer can
 * discount them instead of trusting them.
 */
export const THIN_SAMPLE_SENTENCES = 5;

/** The marks worth counting. Anything rarer than this is not a habit. */
export const PUNCTUATION_MARKS: readonly string[] = [
  '\u3002', // 。
  '\uff0c', // ，
  '\u3001', // 、
  '\uff1b', // ；
  '\uff1a', // ：
  '\uff01', // ！
  '\uff1f', // ？
  '\u2026', // …
  '\u2014', // —
  '\u201c', // “
  '.',
  ',',
  ';',
  ':',
  '!',
  '?',
  '...',
  '—',
  '-',
  '"',
  "'",
  '(',
  ')',
];

/**
 * Function words. Excluding them is what makes "signature vocabulary" mean
 * something: 的 and `the` are habits of the language, not of the writer.
 */
const STOPWORDS = new Set([
  // Chinese
  '的', '了', '是', '在', '我', '你', '他', '她', '它', '们', '这', '那', '有', '和', '与',
  '就', '也', '都', '而', '但', '不', '很', '会', '要', '把', '被', '给', '对', '从', '到',
  '个', '一', '上', '下', '里', '中', '着', '过', '呢', '吧', '啊', '吗', '哦', '嗯',
  '一个', '我们', '你们', '他们', '因为', '所以', '如果', '但是', '然后', '什么', '怎么',
  '还是', '或者', '以及', '这个', '那个', '可以', '没有', '自己', '已经', '就是', '不是',
  '时候', '这样', '那样', '一些', '一样', '可能', '应该', '需要', '觉得', '知道', '看到',
  // English
  'the', 'and', 'for', 'that', 'this', 'with', 'you', 'not', 'are', 'but', 'have', 'has',
  'was', 'were', 'its', "it's", 'from', 'they', 'them', 'their', 'there', 'what', 'when',
  'which', 'who', 'will', 'would', 'can', 'could', 'should', 'into', 'than', 'then', 'some',
  'such', 'only', 'also', 'just', 'more', 'most', 'much', 'very', 'been', 'being', 'does',
  'did', 'doing', 'about', 'because', 'while', 'where', 'here', 'each', 'other', 'onto',
  'over', 'under', 'after', 'before', 'between', 'these', 'those', 'your', 'our', 'out',
]);

/** Shorthand a person types and an assistant does not. Presence, not rate. */
export const SHORTHAND_MARKERS: Readonly<Record<string, readonly string[]>> = {
  zh: ['233', '2333', 'hhh', 'hhhh', 'xswl', 'yyds', 'www', 'emmm', 'awsl', 'tql', 'orz'],
  en: ['lol', 'lmao', 'btw', 'imo', 'imho', 'tbh', 'afaik', 'iirc', 'fwiw', 'tldr', 'wrt'],
  unknown: [],
};

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu;

/** A message boundary inside a chat sample. */
export const MESSAGE_SEPARATOR = '<!-- msg -->';

export function summariseDistribution(values: readonly number[]): DistributionSummary {
  if (values.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, sampleCount: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
      : (sorted[mid] ?? 0);
  return {
    mean: round(mean),
    median: round(median),
    stdDev: round(Math.sqrt(variance)),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    sampleCount: values.length,
  };
}

function round(value: number): number {
  return Number(value.toFixed(4));
}

/** Marks per 1000 characters, which is scale-free and comparable across samples. */
export function punctuationRates(text: string): Record<string, number> {
  const per1000 = text.length === 0 ? 0 : 1000 / text.length;
  const rates: Record<string, number> = {};
  for (const mark of PUNCTUATION_MARKS) {
    let count = 0;
    let cursor = text.indexOf(mark);
    while (cursor !== -1) {
      count += 1;
      cursor = text.indexOf(mark, cursor + mark.length);
    }
    if (count > 0) rates[mark] = round(count * per1000);
  }
  return rates;
}

/**
 * The units a writer's vocabulary is made of: Latin words, and Chinese bigrams.
 *
 * Single Chinese characters are too coarse — 的 and 了 are excluded as
 * stopwords, and most remaining single characters are shared by every writer of
 * the language. Bigrams are the smallest unit that can carry a habit.
 */
export function contentUnits(text: string): string[] {
  const units: string[] = [];
  const raw = tokenize(text);
  for (let i = 0; i < raw.length; i += 1) {
    const token = raw[i] ?? '';
    if (token.length > 1) {
      if (!STOPWORDS.has(token)) units.push(token);
      continue;
    }
    if (!isCjkChar(token)) continue;
    const next = raw[i + 1];
    if (next !== undefined && next.length === 1 && isCjkChar(next)) {
      const bigram = token + next;
      if (!STOPWORDS.has(bigram) && !STOPWORDS.has(token) && !STOPWORDS.has(next)) {
        units.push(bigram);
      }
    }
  }
  return units;
}

/** How many signature terms are worth carrying. Beyond this they stop being a signature. */
export const SIGNATURE_VOCABULARY_LIMIT = 40;

/** A term has to recur to be a habit rather than an accident. */
export const SIGNATURE_MIN_COUNT = 2;

export function signatureVocabulary(
  text: string,
  limit = SIGNATURE_VOCABULARY_LIMIT,
): string[] {
  const counts = new Map<string, number>();
  for (const unit of contentUnits(text)) {
    counts.set(unit, (counts.get(unit) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= SIGNATURE_MIN_COUNT)
    .sort((a, b) => b[1] - a[1] || compareText(a[0], b[0]))
    .slice(0, limit)
    .map(([unit]) => unit);
}

/** Paragraph token lengths, skipping blank paragraphs and headings. */
export function paragraphLengths(text: string): number[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0 && !paragraph.startsWith('#'))
    .map((paragraph) => Math.max(1, tokenize(paragraph).length));
}

export function extractWritingFeatures(text: string): WritingVoiceFeatures {
  const stats = computeTextStats(text);
  const lengths = splitSentences(text).map((sentence) => Math.max(1, tokenize(sentence).length));

  return {
    sentenceLength: summariseDistribution(lengths),
    paragraphLength: summariseDistribution(paragraphLengths(text)),
    burstiness: round(stats.burstiness),
    punctuationRates: punctuationRates(text),
    signatureVocabulary: signatureVocabulary(text),
    // Unlike the other fields, this one cannot be learned from positive samples
    // at all: a writer's habits do not say what they never write. It is declared
    // by the profile author, or derived from a negative sample set, and it is
    // empty rather than guessed.
    avoidVocabulary: [],
    toneMarkers: [],
    rhetoricalDevices: [],
  };
}

/** Split a chat sample into the messages a person actually sent. */
export function splitMessages(text: string): string[] {
  const parts = text
    .split(MESSAGE_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : [text.trim()];
}

export function emojiCount(text: string): number {
  return [...text.matchAll(EMOJI)].length;
}

export function extractChatFeatures(text: string): ChatVoiceFeatures {
  const messages = splitMessages(text);
  const lengths = messages.map((message) => message.length);
  const questionMessages = messages.filter((message) => /[?\uff1f]/.test(message)).length;
  const emojis = messages.reduce((total, message) => total + emojiCount(message), 0);

  const markers = SHORTHAND_MARKERS[detectLanguage(text)] ?? [];
  const typoAndShorthandHabits = markers.filter((marker) =>
    new RegExp(`(?:^|[^A-Za-z0-9])${marker}(?:$|[^A-Za-z0-9])`, 'i').test(text),
  );

  const chatPunctuation: Record<string, number> = {};
  const per100 = text.length === 0 ? 0 : 100 / text.length;
  for (const mark of ['\u3002', '\uff0c', '\uff01', '\uff1f', '~', '\uff5e', '.', ',', '!', '?']) {
    let count = 0;
    let cursor = text.indexOf(mark);
    while (cursor !== -1) {
      count += 1;
      cursor = text.indexOf(mark, cursor + mark.length);
    }
    if (count > 0) chatPunctuation[mark] = round(count * per100);
  }

  return {
    replyLength: summariseDistribution(lengths),
    // 1 message → 0, 2 → 0.5, 4 → 0.75. A person who fires four short messages in
    // a row is not the same writer as one who composes a paragraph, and this is
    // the only field in the corpus that can tell them apart.
    burstMessaging: messages.length <= 1 ? 0 : round((messages.length - 1) / messages.length),
    rhetoricalQuestionRate: round(questionMessages / messages.length),
    emojiRate: round(emojis / messages.length),
    punctuationInChat: chatPunctuation,
    typoAndShorthandHabits,
  };
}

export interface FingerprintExtraction {
  readonly language: Language;
  readonly mode: TextMode;
  readonly stats: TextStats;
  readonly writing: WritingVoiceFeatures;
  /** Present when the sample is chat, or when a caller asks for it explicitly. */
  readonly chat?: ChatVoiceFeatures;
  readonly messages: readonly string[];
  /** True when the sample is too short for its distributions to mean much. */
  readonly thin: boolean;
}

export interface FingerprintExtractOptions {
  readonly language?: Language;
  readonly mode?: TextMode;
  readonly includeChat?: boolean;
}

export function extractFingerprint(
  text: string,
  options: FingerprintExtractOptions = {},
): FingerprintExtraction {
  const stats = computeTextStats(text);
  const language = options.language ?? detectLanguage(text);
  const mode = options.mode ?? 'unknown';
  const messages = splitMessages(text);
  const chat = options.includeChat || mode === 'chat' ? extractChatFeatures(text) : undefined;

  return {
    language,
    mode,
    stats,
    writing: extractWritingFeatures(text),
    ...(chat ? { chat } : {}),
    messages,
    thin: stats.sentenceCount < THIN_SAMPLE_SENTENCES,
  };
}

/**
 * Learn one fingerprint from several samples.
 *
 * Lengths are pooled, because a distribution learned from ten samples should
 * hold every sentence those samples contain rather than ten averages. Rates are
 * weighted by sample length so a long sample is not outvoted by a short one.
 */
export function learnFingerprint(
  samples: readonly { readonly text: string; readonly mode?: TextMode }[],
  options: FingerprintExtractOptions = {},
): FingerprintExtraction | undefined {
  const extractions = samples
    .filter((sample) => sample.text.trim().length > 0)
    .map((sample) =>
      extractFingerprint(sample.text, {
        ...options,
        ...(sample.mode ? { mode: sample.mode } : {}),
        includeChat: options.includeChat ?? true,
      }),
    );

  const first = extractions[0];
  if (!first) return undefined;

  const sentenceLengths: number[] = [];
  const paragraphLengthsAll: number[] = [];
  const weightedPunctuation = new Map<string, number>();
  let totalChars = 0;
  let charCount = 0;
  let cjkCharCount = 0;
  let tokenCount = 0;
  let sentenceCount = 0;
  let paragraphCount = 0;

  for (const extraction of extractions) {
    sentenceLengths.push(
      ...expandDistribution(extraction.writing.sentenceLength),
    );
    paragraphLengthsAll.push(
      ...expandDistribution(extraction.writing.paragraphLength),
    );
    for (const [mark, rate] of Object.entries(extraction.writing.punctuationRates)) {
      weightedPunctuation.set(
        mark,
        (weightedPunctuation.get(mark) ?? 0) + rate * extraction.stats.charCount,
      );
    }
    totalChars += extraction.stats.charCount;
    charCount += extraction.stats.charCount;
    cjkCharCount += extraction.stats.cjkCharCount;
    tokenCount += extraction.stats.tokenCount;
    sentenceCount += extraction.stats.sentenceCount;
    paragraphCount += extraction.stats.paragraphCount;
  }

  const punctuation: Record<string, number> = {};
  if (totalChars > 0) {
    for (const [mark, value] of weightedPunctuation) {
      punctuation[mark] = round(value / totalChars);
    }
  }

  const burstiness =
    extractions.reduce((total, extraction) => total + extraction.writing.burstiness, 0) /
    extractions.length;

  const mergedStats: TextStats = {
    charCount,
    cjkCharCount,
    tokenCount,
    sentenceCount,
    paragraphCount,
    averageSentenceTokens: round(
      sentenceLengths.length === 0
        ? 0
        : sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length,
    ),
    sentenceTokenStdDev: summariseDistribution(sentenceLengths).stdDev,
    burstiness: round(burstiness),
  };

  const chat = extractions.some((extraction) => extraction.chat !== undefined)
    ? mergeChat(extractions)
    : undefined;

  return {
    language: first.language,
    mode: first.mode,
    stats: mergedStats,
    writing: {
      sentenceLength: summariseDistribution(sentenceLengths),
      paragraphLength: summariseDistribution(paragraphLengthsAll),
      burstiness: round(burstiness),
      punctuationRates: punctuation,
      signatureVocabulary: mergeVocabulary(extractions),
      avoidVocabulary: [],
      toneMarkers: [],
      rhetoricalDevices: [],
    },
    ...(chat ? { chat } : {}),
    messages: extractions.flatMap((extraction) => extraction.messages),
    thin: sentenceLengths.length < THIN_SAMPLE_SENTENCES,
  };
}

/**
 * Rebuild approximate samples from a distribution, for pooling.
 *
 * A `DistributionSummary` is a summary, so pooling throws away the shape. This
 * reconstructs a symmetric sample with the recorded mean and spread, which is
 * enough for a pooled mean and is honest about being an approximation — the
 * profile keeps `sampleCount`, so a reader can see how much was summarised.
 */
function expandDistribution(distribution: DistributionSummary): number[] {
  if (distribution.sampleCount === 0) return [];
  const out: number[] = [];
  const half = Math.floor(distribution.sampleCount / 2);
  for (let i = 0; i < half; i += 1) out.push(Math.max(1, distribution.mean - distribution.stdDev));
  for (let i = 0; i < distribution.sampleCount - half; i += 1) {
    out.push(Math.max(1, distribution.mean + distribution.stdDev));
  }
  return out;
}

function mergeVocabulary(extractions: readonly FingerprintExtraction[]): string[] {
  const scores = new Map<string, number>();
  for (const extraction of extractions) {
    const size = extraction.writing.signatureVocabulary.length;
    extraction.writing.signatureVocabulary.forEach((term, index) => {
      // Rank-weighted, so a term characteristic of one sample but absent from the
      // others does not become a signature of the profile.
      scores.set(term, (scores.get(term) ?? 0) + (size - index));
    });
  }
  const threshold = Math.max(1, Math.ceil(extractions.length / 2));
  return [...scores.entries()]
    .filter(([, score]) => score >= threshold)
    .sort((a, b) => b[1] - a[1] || compareText(a[0], b[0]))
    .slice(0, SIGNATURE_VOCABULARY_LIMIT)
    .map(([term]) => term);
}

function mergeChat(extractions: readonly FingerprintExtraction[]): ChatVoiceFeatures {
  const withChat = extractions.filter(
    (extraction): extraction is FingerprintExtraction & { chat: ChatVoiceFeatures } =>
      extraction.chat !== undefined,
  );
  const replyLengths = withChat.flatMap((extraction) =>
    extraction.messages.map((message) => message.length),
  );
  const average = (pick: (chat: ChatVoiceFeatures) => number): number =>
    withChat.length === 0
      ? 0
      : round(
          withChat.reduce((total, extraction) => total + pick(extraction.chat), 0) /
            withChat.length,
        );

  const habits = new Set<string>();
  const punctuation: Record<string, number> = {};
  for (const extraction of withChat) {
    for (const habit of extraction.chat.typoAndShorthandHabits) habits.add(habit);
    for (const [mark, rate] of Object.entries(extraction.chat.punctuationInChat)) {
      punctuation[mark] = round(Math.max(punctuation[mark] ?? 0, rate));
    }
  }

  return {
    replyLength: summariseDistribution(replyLengths),
    burstMessaging: average((chat) => chat.burstMessaging),
    rhetoricalQuestionRate: average((chat) => chat.rhetoricalQuestionRate),
    emojiRate: average((chat) => chat.emojiRate),
    punctuationInChat: punctuation,
    typoAndShorthandHabits: [...habits].sort(),
  };
}
