/**
 * Protected content extraction and preservation checking.
 *
 * A rewrite that improves the prose but mangles a URL, a file path, a version
 * number or a quotation has made the document worse. This layer extracts
 * everything that must survive, and then verifies that it did.
 *
 * Original to Human Voice Suite (`human-voice-suite/local`).
 */

import type { PreserveDirective } from '../../rewrite/types.js';
import type { ValidationIssue } from '../types.js';
import { clampScore } from '../types.js';

type Kind = PreserveDirective['kind'];

interface Extractor {
  readonly kind: Kind;
  readonly pattern: RegExp;
  readonly exact: boolean;
  /** Strip the matched delimiters before recording the value. */
  readonly trim?: (match: string) => string;
}

/**
 * Order matters. Code fences are extracted first and their spans are masked so
 * that a URL inside a code block is not counted twice.
 */
const EXTRACTORS: readonly Extractor[] = [
  {
    kind: 'code-block',
    pattern: /```[\s\S]*?```/g,
    exact: true,
  },
  {
    kind: 'inline-code',
    pattern: /`[^`\n]+`/g,
    exact: true,
    trim: (match) => match.replace(/^`|`$/g, ''),
  },
  {
    kind: 'url',
    pattern: /https?:\/\/[^\s<>()"'`\u3002\uff0c\uff09]+/g,
    exact: true,
  },
  {
    kind: 'citation',
    pattern: /(?:doi:\s*10\.\d{4,9}\/\S+|arXiv:\s*\d{4}\.\d{4,5}|\[\d{1,3}\])/gi,
    exact: true,
  },
  {
    kind: 'date',
    pattern: /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?Z?)?\b/g,
    exact: true,
  },
  {
    kind: 'path',
    pattern:
      /(?:[A-Za-z]:\\[^\s"'<>|*?\n]+|(?:\.{0,2}\/)?(?:[\w.@-]+\/)+[\w.@-]+\.[A-Za-z0-9]{1,8}|\b[\w@-]+\.(?:md|markdown|ts|tsx|js|mjs|cjs|jsx|json|jsonl|toml|ya?ml|py|rs|go|java|rb|sh|bash|zsh|ps1|bat|cmd|txt|csv|tsv|html?|css|scss|less|sql|lock|cfg|ini|conf|env|xml|svg|png|jpe?g|gif|pdf)\b)/gi,
    exact: true,
  },
  {
    // Commit hashes and digests. Requires at least one digit and one letter, so
    // words such as "defaced" are not mistaken for a hash.
    kind: 'identifier',
    pattern:
      /\b(?=[0-9a-f]{7,64}\b)(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]+\b/g,
    exact: true,
  },
  {
    kind: 'quotation',
    pattern: /(?:\u201c[^\u201d\n]{2,200}\u201d|\u300c[^\u300d\n]{2,200}\u300d|"[^"\n]{2,200}")/g,
    exact: false,
    trim: (match) => match.replace(/^[\u201c\u300c"]|[\u201d\u300d"]$/g, ''),
  },
  {
    // Multi-word proper nouns, plus Chinese book-title marks. Each word after
    // the first must be separated by horizontal whitespace: without that
    // requirement the quantifier backtracks and splits a single ALL-CAPS token
    // into two "words", which would report UPSTREAM_UPDATE_REPORT.md as a name.
    //
    // Horizontal whitespace, not `\s`. Phase 8 fix: `\s` matches a newline, so a
    // heading line and the first capitalised word of the paragraph under it were
    // captured as one name — `"Strategic Negotiations And Global Partnerships
    // The"`. That artefact then behaved as a protected item that almost no honest
    // rewrite can keep, and it drove `preservationScore` to 0.00 on a candidate
    // that preserved everything real. A heading is not a proper noun.
    kind: 'proper-noun',
    pattern:
      /(?:\b[A-Z][a-zA-Z0-9]*(?:[ \t]+(?:(?:of|the|and|for|de|van|von)[ \t]+)?[A-Z][a-zA-Z0-9]*){1,5}|\u300a[^\u300b\n]{1,60}\u300b)/g,
    exact: true,
    trim: stripLeadingSentenceStarter,
  },
  {
    // Identifiers: dotted, snake_case, camelCase and CONSTANT_CASE.
    //
    // The negative lookbehind is a Phase 8 fix. Without it the camelCase branch
    // matched from the second letter of a word, because `[a-z]+` cannot start at
    // the capital: "OpenClaw" was captured as `penClaw` and "GitHub" as `itHub`.
    // A fragment can never be "kept" by a rewrite that legitimately drops the
    // word, so it silently depressed `preservationScore` for a correct rewrite.
    kind: 'identifier',
    pattern:
      /(?<![A-Za-z0-9_$])(?:[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)+|[a-z][a-z0-9]*(?:_[a-z0-9]+)+|[A-Za-z][a-z0-9]*(?:[A-Z][a-z0-9]+)+|[A-Z]{2,}_[A-Z0-9_]+)/g,
    exact: true,
  },
  {
    kind: 'number',
    pattern:
      /(?<![\w.])(?:v)?\d+(?:[.,]\d+)*(?:\s?%|\s?(?:ms|s|kg|km|MB|GB|KB|px|em|rem))?(?![\w])/g,
    exact: true,
    // A leading `v` is a version prefix, not part of the quantity.
    trim: (match) => match.replace(/^[vV]/, ''),
  },
];

/** Characters that make a digit run part of an identifier rather than a quantity. */
const NOISE_VALUES = new Set(['0', '1', '2']);

/**
 * Kinds that are read from the raw text and whose spans are then hidden from
 * every other extractor. Without this, a URL's path would also be picked up as
 * a filesystem path and counted twice.
 */
const SELF_MASKING: ReadonlySet<Kind> = new Set<Kind>(['code-block', 'inline-code', 'url']);

const URL_PATTERN = /https?:\/\/[^\s<>()"'`\u3002\uff0c\uff09]+/g;

/**
 * Words that are capitalised only because they begin a sentence. Without this
 * list, "As Siqi Chen wrote" is extracted as the proper noun "As Siqi Chen".
 */
const SENTENCE_STARTERS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'it', 'its',
  'in', 'on', 'at', 'by', 'for', 'from', 'with', 'without', 'to', 'of',
  'and', 'but', 'or', 'nor', 'if', 'as', 'so', 'than', 'then',
  'when', 'while', 'after', 'before', 'because', 'since', 'although', 'though',
  'however', 'therefore', 'thus', 'meanwhile', 'there', 'here',
  'we', 'you', 'they', 'he', 'she', 'i', 'my', 'our', 'your', 'their', 'his', 'her',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did',
  'not', 'no', 'yes', 'all', 'any', 'some', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'such', 'only', 'own', 'same', 'also', 'just',
  'can', 'will', 'would', 'should', 'could', 'may', 'might', 'must',
  'run', 'use', 'see', 'note', 'given', 'consider', 'please', 'once', 'if',
]);

/**
 * Drop a leading sentence-initial common word, and reject the match entirely
 * when too little is left to be a multi-word name.
 */
function stripLeadingSentenceStarter(match: string): string {
  if (match.startsWith('\u300a')) return match;
  const words = match.split(/\s+/);
  if (words.length >= 2 && SENTENCE_STARTERS.has((words[0] ?? '').toLowerCase())) {
    words.shift();
  }
  return words.length >= 2 ? words.join(' ') : '';
}

/**
 * True when a match sits on a heading.
 *
 * Phase 8 fix. A title-cased heading is a capitalised sequence, so
 * `## Strategic Negotiations And Global Partnerships` was extracted as a proper
 * noun — and a rewrite whose entire job is to remove AI title-case formatting was
 * then forbidden from touching the title.
 *
 * Two shapes count, because models emit both. The Markdown shape is `#`-prefixed.
 * The other is a line that contains nothing but capitalised words —
 * `Challenges and Legacy` on a line of its own, which is a stock section heading
 * and not a name. A bare name on a line of its own is therefore not extracted; a
 * name *inside* prose still is, which is where names actually carry meaning.
 *
 * Numbers, URLs, code and identifiers inside a heading stay protected: this
 * excludes the heading from the *proper-noun* pass only.
 */
export function isHeadingLine(text: string, index: number): boolean {
  const lineStart = text.lastIndexOf('\n', index - 1) + 1;
  const lineEnd = text.indexOf('\n', index);
  const line = text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd).trim();

  if (/^#{1,6}\s/.test(line)) return true;

  const words = line.split(/\s+/).filter((word) => word.length > 0);
  if (words.length < 2 || words.length > 6) return false;
  if (/[.,;:!?\u2014\u3002\uff0c\uff01\uff1f]$/.test(line)) return false;
  return words.every((word) => /^(?:[A-Z][a-zA-Z0-9'\u2019-]*|of|the|and|for|de|van|von)$/.test(word));
}

export interface ExtractOptions {
  /** Skip the low-signal `number` kind, which is noisy on prose. */
  readonly includeNumbers?: boolean;
  readonly includeProperNouns?: boolean;
  /** Extract heading text as protected content. Off by default; see `isHeadingLine`. */
  readonly includeHeadings?: boolean;
}

/**
 * Extract everything that must survive a rewrite.
 *
 * The result is deduplicated, ordered by first appearance, and carries an
 * occurrence count so a rewrite that keeps one of three mentions is caught.
 */
export function extractProtectedContent(
  text: string,
  options: ExtractOptions = {},
): PreserveDirective[] {
  const includeNumbers = options.includeNumbers ?? true;
  const includeProperNouns = options.includeProperNouns ?? true;
  const includeHeadings = options.includeHeadings ?? false;

  const masked = mask(text);
  const found = new Map<string, { kind: Kind; exact: boolean; count: number; order: number }>();
  let order = 0;

  for (const extractor of EXTRACTORS) {
    if (extractor.kind === 'number' && !includeNumbers) continue;
    if (extractor.kind === 'proper-noun' && !includeProperNouns) continue;

    const haystack = SELF_MASKING.has(extractor.kind) ? text : masked;

    const pattern = new RegExp(extractor.pattern.source, extractor.pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(haystack)) !== null) {
      const raw = match[0];
      const value = extractor.trim ? extractor.trim(raw) : raw;
      const cleaned = value.trim();
      if (cleaned.length === 0) continue;
      if (extractor.kind === 'number' && NOISE_VALUES.has(cleaned)) continue;
      // A heading is what a rewrite is allowed to change; see `isHeadingLine`.
      if (
        extractor.kind === 'proper-noun' &&
        !includeHeadings &&
        isHeadingLine(haystack, match.index)
      ) {
        continue;
      }

      const key = `${extractor.kind}\u0000${cleaned}`;
      const existing = found.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        found.set(key, {
          kind: extractor.kind,
          exact: extractor.exact,
          count: 1,
          order: order++,
        });
      }
      if (match.index === pattern.lastIndex) pattern.lastIndex += 1;
    }
  }

  return [...found.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, meta]) => ({
      kind: meta.kind,
      value: key.slice(key.indexOf('\u0000') + 1),
      occurrences: meta.count,
      exact: meta.exact,
    }));
}

/**
 * Replace self-masking spans — code and URLs — with spaces of identical length
 * so that extractors looking at prose do not re-discover tokens those rules
 * already cover.
 */
function mask(text: string): string {
  const spans: Array<[number, number]> = [];

  const collect = (pattern: RegExp): void => {
    const scanner = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = scanner.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (spans.some(([s, e]) => start >= s && end <= e)) continue;
      spans.push([start, end]);
      if (scanner.lastIndex === match.index) scanner.lastIndex += 1;
    }
  };

  collect(/```[\s\S]*?```/g);
  collect(/`[^`\n]+`/g);
  collect(URL_PATTERN);

  if (spans.length === 0) return text;

  spans.sort((a, b) => a[0] - b[0]);
  let out = '';
  let cursor = 0;
  for (const [start, end] of spans) {
    out += text.slice(cursor, start);
    out += ' '.repeat(end - start);
    cursor = end;
  }
  out += text.slice(cursor);
  return out;
}

export interface PreservationCheck {
  readonly preservationScore: number;
  readonly issues: readonly ValidationIssue[];
  readonly kept: readonly PreserveDirective[];
  readonly lost: readonly PreserveDirective[];
  readonly altered: readonly PreserveDirective[];
  /**
   * How many protected items the original contained.
   *
   * Zero means the score is 1 because there was nothing to preserve, not because
   * everything survived — the same distinction `VoiceScoreSet.unmeasured` draws.
   * A caller that cannot tell the two apart will quote a check that never ran.
   */
  readonly itemCount: number;
}

/**
 * Check that everything extracted from the original survived the rewrite.
 *
 * `exact` items must appear verbatim. Non-exact items (quotations) only need to
 * keep their distinctive content, so they are checked by normalised substring.
 */
export function checkPreservation(
  original: readonly PreserveDirective[],
  rewritten: string,
): PreservationCheck {
  const issues: ValidationIssue[] = [];
  const kept: PreserveDirective[] = [];
  const lost: PreserveDirective[] = [];
  const altered: PreserveDirective[] = [];

  const normalisedRewritten = normalise(rewritten);

  for (const directive of original) {
    const actualCount = countOccurrences(rewritten, directive.value, directive.exact);
    if (actualCount === 0) {
      const presentLoosely = normalisedRewritten.includes(normalise(directive.value));
      if (directive.exact) {
        (presentLoosely ? altered : lost).push(directive);
        issues.push({
          kind: presentLoosely ? 'protected-content-altered' : 'protected-content-lost',
          severity: directive.kind === 'identifier' || directive.kind === 'number' ? 5 : 4,
          message: presentLoosely
            ? `${directive.kind} was changed: ${truncate(directive.value)}`
            : `${directive.kind} was dropped: ${truncate(directive.value)}`,
          evidence: directive.value,
          score: 'preservationScore',
        });
      } else {
        lost.push(directive);
        issues.push({
          kind: 'protected-content-lost',
          severity: 3,
          message: `${directive.kind} was dropped: ${truncate(directive.value)}`,
          evidence: directive.value,
          score: 'preservationScore',
        });
      }
      continue;
    }

    if (actualCount < directive.occurrences) {
      altered.push(directive);
      issues.push({
        kind: 'protected-content-altered',
        severity: directive.kind === 'identifier' ? 4 : 2,
        message: `${directive.kind} appeared ${directive.occurrences}x but only ${actualCount}x afterwards: ${truncate(directive.value)}`,
        evidence: directive.value,
        score: 'preservationScore',
      });
      continue;
    }

    kept.push(directive);
  }

  const total = original.length;
  const preservationScore =
    total === 0 ? 1 : clampScore(kept.length / total - 0.05 * altered.length / Math.max(1, total));

  return { preservationScore, issues, kept, lost, altered, itemCount: total };
}

function countOccurrences(haystack: string, needle: string, exact: boolean): number {
  if (needle.length === 0) return 0;
  if (exact) {
    let count = 0;
    let index = haystack.indexOf(needle);
    while (index !== -1) {
      count += 1;
      index = haystack.indexOf(needle, index + needle.length);
    }
    return count;
  }
  const target = normalise(needle);
  if (target.length === 0) return 0;
  const source = normalise(haystack);
  let count = 0;
  let index = source.indexOf(target);
  while (index !== -1) {
    count += 1;
    index = source.indexOf(target, index + target.length);
  }
  return count;
}

function normalise(text: string): string {
  return text
    .replace(/[\u201c\u201d\u300c\u300d]/g, '"')
    .replace(/[\u2018\u2019\u300e\u300f]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value: string): string {
  return value.length <= 60 ? value : `${value.slice(0, 57)}...`;
}
