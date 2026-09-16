/**
 * Text utilities shared by detectors.
 *
 * Chinese and English need different segmentation, so nothing here assumes
 * whitespace-delimited words.
 */

import type { Language } from './types.js';

const CJK_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x3400, 0x4dbf], // CJK Extension A
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0xf900, 0xfaff], // CJK Compatibility Ideographs
  [0x3040, 0x30ff], // Hiragana + Katakana
  [0xac00, 0xd7af], // Hangul syllables
];

const CJK_PUNCTUATION = new Set([
  '\u3002', // 。
  '\uff0c', // ，
  '\uff01', // ！
  '\uff1f', // ？
  '\uff1b', // ；
  '\uff1a', // ：
  '\u3001', // 、
  '\u201c', // “
  '\u201d', // ”
  '\u2018', // ‘
  '\u2019', // ’
  '\u300c', // 「
  '\u300d', // 」
  '\u300e', // 『
  '\u300f', // 』
  '\u2026', // …
  '\u2014', // —
]);

const SENTENCE_TERMINATORS = new Set([
  '.', '!', '?', '\n',
  '\u3002', '\uff01', '\uff1f', '\uff1b', '\u2026',
]);

export function isCjkCodePoint(cp: number): boolean {
  for (const [start, end] of CJK_RANGES) {
    if (cp >= start && cp <= end) return true;
  }
  return false;
}

export function isCjkChar(ch: string): boolean {
  const cp = ch.codePointAt(0);
  return cp === undefined ? false : isCjkCodePoint(cp);
}

export function isCjkPunctuation(ch: string): boolean {
  return CJK_PUNCTUATION.has(ch);
}

export function countCjkChars(text: string): number {
  let n = 0;
  for (const ch of text) {
    if (isCjkChar(ch)) n += 1;
  }
  return n;
}

export function countLatinLetters(text: string): number {
  let n = 0;
  for (const ch of text) {
    if (/[A-Za-z]/.test(ch)) n += 1;
  }
  return n;
}

/**
 * Cheap language heuristic. It is intentionally conservative: when the signal
 * is weak it returns `unknown` rather than guessing, because guessing wrong
 * sends text down the wrong detector set.
 */
export function detectLanguage(text: string): Language {
  const cjk = countCjkChars(text);
  const latin = countLatinLetters(text);
  const total = cjk + latin;
  if (total === 0) return 'unknown';
  const cjkRatio = cjk / total;
  if (cjkRatio >= 0.5) return 'zh';
  if (cjkRatio <= 0.05) return 'en';
  return 'unknown';
}

/**
 * Split text into sentences. Terminators are kept on the sentence they close
 * so that rhythm measurements can see punctuation habits.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let current = '';
  for (const ch of text) {
    current += ch;
    if (SENTENCE_TERMINATORS.has(ch)) {
      const trimmed = current.trim();
      if (trimmed.length > 0) out.push(trimmed);
      current = '';
    }
  }
  const tail = current.trim();
  if (tail.length > 0) out.push(tail);
  return out;
}

/**
 * Word-ish tokens. Latin runs split on non-letters; each CJK character counts
 * as one token, which is the conventional approximation for Chinese.
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let latin = '';
  for (const ch of text) {
    if (/[A-Za-z0-9']/.test(ch)) {
      latin += ch;
      continue;
    }
    if (latin.length > 0) {
      tokens.push(latin.toLowerCase());
      latin = '';
    }
    if (isCjkChar(ch)) tokens.push(ch);
  }
  if (latin.length > 0) tokens.push(latin.toLowerCase());
  return tokens;
}

/** Normalise text for phrase matching: collapse whitespace, unify quotes. */
export function normalizeForMatch(text: string): string {
  return text
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u300c\u300d]/g, '"')
    .replace(/[\u300e\u300f]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export interface TextStats {
  readonly charCount: number;
  readonly cjkCharCount: number;
  readonly tokenCount: number;
  readonly sentenceCount: number;
  readonly paragraphCount: number;
  readonly averageSentenceTokens: number;
  readonly sentenceTokenStdDev: number;
  /** Burstiness: standard deviation of sentence length, normalised. */
  readonly burstiness: number;
}

export function computeTextStats(text: string): TextStats {
  const sentences = splitSentences(text);
  const tokens = tokenize(text);
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);

  const lengths = sentences.map((s) => Math.max(1, tokenize(s).length));
  const mean = lengths.length === 0 ? 0 : lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance =
    lengths.length === 0
      ? 0
      : lengths.reduce((acc, len) => acc + (len - mean) ** 2, 0) / lengths.length;
  const stdDev = Math.sqrt(variance);

  return {
    charCount: text.length,
    cjkCharCount: countCjkChars(text),
    tokenCount: tokens.length,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    averageSentenceTokens: mean,
    sentenceTokenStdDev: stdDev,
    burstiness: mean === 0 ? 0 : stdDev / mean,
  };
}
