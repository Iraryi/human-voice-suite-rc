/**
 * Turning an upstream's "watch for" list into matchable phrases.
 *
 * This is fiddlier than it looks, and getting it wrong is how a detector ends up
 * either missing rules or firing on ordinary prose. The corpus mixes separators
 * freely: `blader` pattern 1 uses semicolons but pattern 12 uses commas, and
 * pattern 12 contains a semicolon *inside parentheses* that must not split
 * anything. Some entries are literal phrases, some are construction templates
 * such as `not X but Y`, and some carry a parenthetical caveat that changes the
 * match.
 */

import type { PhraseKind, WatchPhrase } from './types.js';

/** Markers that mean an entry is a construction, not a string to match. */
const TEMPLATE_MARKERS: readonly RegExp[] = [
  /\b[X-ZN]\b/, // X, Y, Z, N as standalone tokens
  /\[[^\]]+\]/, // [date], [Your Name]
  /\.\.\./,
  /\u2026/, // …
  /[\u3014\u27e8]/, // 〔 ⟨
];

/** Trailing sentence punctuation the upstream added to a list. */
const TRAILING = /[\s\u3002\uff0e.;;,]+$/;
const LEADING = /^[\s\u3001,;]+/;

/** Paired quotation marks whose contents must never be split. */
const QUOTE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['\u201c', '\u201d'], // curly double
  ['\u2018', '\u2019'], // curly single
  ['\u300c', '\u300d'], // corner brackets
  ['\u300e', '\u300f'], // white corner brackets
];

/**
 * Split on separators that are outside parentheses, brackets and quotations.
 *
 * `gate/gated/gating (figurative; keep technical uses)` is one entry, not two,
 * because its semicolon sits inside parentheses.
 *
 * Quotations matter just as much. `humanizer-zh-cn` writes lists such as
 * `"第一、第二、第三"` where the enumeration comma is *inside* the quoted example
 * and splitting on it produces two broken fragments. Straight quotes are not
 * tracked because an apostrophe makes their pairing ambiguous.
 */
export function splitOutsideParens(text: string, separators: readonly string[]): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let quote: string | undefined;

  for (const ch of text) {
    if (quote !== undefined) {
      current += ch;
      if (ch === quote) quote = undefined;
      continue;
    }

    const opened = QUOTE_PAIRS.find(([open]) => open === ch);
    if (opened) {
      quote = opened[1];
      current += ch;
      continue;
    }

    if (ch === '(' || ch === '\uff08' || ch === '[' || ch === '\u3010') depth += 1;
    if (ch === ')' || ch === '\uff09' || ch === ']' || ch === '\u3011') depth = Math.max(0, depth - 1);

    if (depth === 0 && separators.includes(ch)) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }

  // An unterminated quote must not swallow the rest of the list.
  parts.push(current);

  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

const SEMICOLONS = [';', '\uff1b'] as const;
const COMMAS = [',', '\uff0c', '\u3001'] as const;

/**
 * Words that mean a comma fragment continues the previous one rather than
 * starting a new entry.
 *
 * This exists because two real shapes conflict:
 *
 * - `not just, not only, or not merely X, but Y` is ONE construction. Splitting
 *   it on commas yields fragments such as `not just`, which would then match
 *   ordinary English prose and cause false positives.
 * - `delve, crucial, not X but Y` is THREE entries, one of which happens to
 *   begin with `not`. Gluing them together loses two watched phrases.
 *
 * The separating signal is that in the first case **every** fragment after the
 * first is a continuation, and in the second case only the last one is. So a
 * group is kept whole only under that stronger condition, and otherwise its
 * fragments are taken as separate entries.
 */
const CONTINUATION_PREFIXES: readonly RegExp[] = [
  /^(?:not|nor|or|and|but|than|rather)\b/i,
  /^it'?s\b/i,
  /^isn'?t\b/i,
  /^doesn'?t\b/i,
  /^the same\b/i,
];

function continuesPrevious(fragment: string): boolean {
  const text = fragment.trim();
  return CONTINUATION_PREFIXES.some((pattern) => pattern.test(text));
}

/**
 * Segment a watched list into entries.
 *
 * Semicolons separate unconditionally. Within a group, commas separate, except
 * when the group is a single construction whose every fragment after the first
 * continues the one before it.
 */
export function segmentWatchList(raw: string): string[] {
  const groups = splitOutsideParens(raw, SEMICOLONS);
  const entries: string[] = [];

  for (const group of groups) {
    const fragments = splitOutsideParens(group, COMMAS);
    if (fragments.length <= 1) {
      entries.push(group);
      continue;
    }

    const tail = fragments.slice(1);
    const isOneConstruction = containsTemplateMarker(group) && tail.every(continuesPrevious);
    if (isOneConstruction) entries.push(group);
    else entries.push(...fragments);
  }

  return entries.map(cleanPhrase).filter((entry) => entry.length > 0);
}

export function containsTemplateMarker(text: string): boolean {
  return TEMPLATE_MARKERS.some((pattern) => pattern.test(text));
}

/** Strip markup and list punctuation the upstream added. */
export function cleanPhrase(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/^[*_]+|[*_]+$/g, '')
    .replace(LEADING, '')
    .replace(TRAILING, '')
    .trim();
}

/**
 * Pull a trailing parenthetical caveat out of an entry.
 *
 * `gate/gated/gating (figurative; keep technical uses)` becomes the phrase
 * `gate/gated/gating` plus the note, because the caveat is a scope restriction
 * the detector has to honour, not part of the match.
 */
export function splitNote(text: string): { text: string; note?: string } {
  const match = /^(.*?)\s*[(\uff08]([^)\uff09]+)[)\uff09]\s*$/.exec(text);
  if (!match) return { text };
  const body = (match[1] ?? '').trim();
  const note = (match[2] ?? '').trim();
  if (body.length === 0 || note.length === 0) return { text };
  return { text: body, note };
}

/** Enough characters to be worth matching. CJK carries more per character. */
const MIN_LATIN_LENGTH = 4;
const MIN_CJK_LENGTH = 2;

/**
 * A watched list sometimes contains an explanatory clause rather than a phrase.
 * `blader` pattern 1 ends with "treat the equivalent construction the same way",
 * which is advice to the reader, not something to match. Anything this long is
 * prose, so it is recorded as a reference and never matched.
 */
const MAX_LATIN_WORDS = 12;

function isMostlyCjk(text: string): boolean {
  let cjk = 0;
  let total = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    total += 1;
    if (ch.codePointAt(0)! >= 0x3000) cjk += 1;
  }
  return total > 0 && cjk / total >= 0.5;
}

/**
 * Classify one entry.
 *
 * `reference` is the honest answer for anything too short or too generic to
 * match safely. Those entries are kept in the generated data because a human
 * should see them, but the detector must not use them.
 */
/**
 * Words too common to be a tell on their own.
 *
 * Applied at extraction time and again at match time, because adapters that
 * classify their own phrases bypass `classifyPhrase`. `just` sitting in
 * `stop-slop`'s adverb list reached the detector as a matchable phrase and fired
 * on ordinary English.
 */
const COMMON_WORDS = new Set([
  'the', 'and', 'or', 'but', 'so', 'very', 'really', 'just', 'also', 'key',
  'deep', 'look', 'well', 'even', 'only', 'much', 'many', 'more', 'most',
  'some', 'such', 'then', 'than', 'that', 'this', 'with', 'from', 'have',
  'has', 'had', 'not', 'now', 'out', 'all', 'any', 'can', 'may', 'might',
]);

/**
 * Chinese phrases that are ordinary vocabulary however long they are.
 *
 * The length rule below draws its line at three characters, on the reasoning that
 * "three characters is the shortest length at which a Chinese phrase starts to be
 * specific". Real text disagrees: three is also the length of plenty of everyday
 * words, and two of them were measured firing on human writing.
 *
 * `大概率` (in all likelihood) and `这件事` (this matter) belong to
 * `assistant.knowledge_limit_disclaimer` and `lexical.aphorism_dressing`. On 738
 * genuine human replies fetched from a public API they accounted for four of the
 * eighteen firings — a bare colloquial hedge standing in for a rule about *dressing
 * up a gap in the sources*, and a noun phrase standing in for a rule about
 * *aphorism dressing*.
 *
 * Only phrases with a measurement behind them are listed. `不排除` sits in the same
 * rule as `大概率` and is the same kind of word, and it is deliberately absent: it
 * fired zero times, and a list that grows by reasoning from a class rather than
 * from an observation is how the length rule got here.
 */
const COMMON_CJK_PHRASES = new Set(['大概率', '这件事']);

export function isTooCommonToMatch(text: string): boolean {
  const bare = cleanPhrase(text);
  if (bare.length === 0) return true;
  // A single two-character Chinese word is almost always ordinary vocabulary:
  // 可能 (possibly), 认为 (believe), 表示 (indicate).
  if (isMostlyCjk(bare) && [...bare].length < MIN_CJK_MATCH_LENGTH) return true;
  if (COMMON_CJK_PHRASES.has(bare)) return true;
  return COMMON_WORDS.has(bare.toLowerCase());
}

/**
 * Shortest Chinese phrase a detector may match.
 *
 * Higher than the extraction minimum on purpose. Extraction keeps two-character
 * entries so the generated data is a faithful record of what the upstream said;
 * the detector declines to match them, because doing so fires on ordinary
 * vocabulary. `抓手` is lost as a match here, which is the price of not firing on
 * `可能`.
 */
export const MIN_CJK_MATCH_LENGTH = 3;

export function classifyPhrase(text: string): PhraseKind {
  if (containsTemplateMarker(text)) return 'template';
  const bare = cleanPhrase(text);
  const cjk = isMostlyCjk(bare);
  const minimum = cjk ? MIN_CJK_LENGTH : MIN_LATIN_LENGTH;
  if ([...bare].length < minimum) return 'reference';
  if (!cjk && bare.split(/\s+/).length > MAX_LATIN_WORDS) return 'reference';
  if (COMMON_WORDS.has(bare.toLowerCase())) return 'reference';
  return 'literal';
}

/**
 * Parse a watched list into phrases.
 *
 * Every entry is retained. Templates and references are labelled rather than
 * dropped, so the generated data shows what the upstream actually said and the
 * detector can filter on `kind`.
 */
export function parseWatchList(raw: string): WatchPhrase[] {
  return segmentWatchList(raw).map((entry) => {
    const { text, note } = splitNote(entry);
    const kind = classifyPhrase(text);
    const cleaned = cleanPhrase(text);
    return {
      text: cleaned,
      kind,
      match: kind === 'literal' ? cleaned.toLowerCase() : cleaned,
      ...(note ? { note } : {}),
    };
  });
}

/** Only the phrases a lexical detector may match on. */
export function matchablePhrases(phrases: readonly WatchPhrase[]): WatchPhrase[] {
  return phrases.filter((phrase) => phrase.kind === 'literal');
}
