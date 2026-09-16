/**
 * Shared detector helpers.
 */

import type { DetectorFamily } from '../types.js';
import type { RuleCategory } from '../../rules/canonical/signatures.js';

/**
 * Map a rule category onto a detector family.
 *
 * The two taxonomies are deliberately not identical: `formatting` tells are
 * found by structural detectors (bold, headings, quotes), and `chat` tells are
 * assistant-behaviour findings. Keeping the mapping in one place stops a finding
 * from being attributed to a family that has no detector behind it.
 */
export function familyForCategory(category: string): DetectorFamily {
  switch (category as RuleCategory | string) {
    case 'structural':
      return 'structural';
    case 'lexical':
      return 'lexical';
    case 'rhythm':
      return 'rhythm';
    case 'formatting':
      return 'structural';
    case 'assistant':
      return 'assistant';
    case 'chat':
      return 'assistant';
    case 'chinese':
      return 'chinese';
    case 'stylometry':
      return 'stylometry';
    default:
      return 'structural';
  }
}

/** Count occurrences of a substring without a regular expression. */
export function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

/**
 * Density per 1000 characters.
 *
 * Rates, not counts. A long document with five dashes is not dash-heavy; a short
 * one with five is. The upstreams that state numeric thresholds all state them
 * per length for this reason.
 */
export function perThousand(count: number, charCount: number): number {
  if (charCount === 0) return 0;
  return (count / charCount) * 1000;
}

/** Collect the character offsets of every match of a global regex. */
export function matchSpans(
  text: string,
  pattern: RegExp,
  limit = 20,
): Array<{ start: number; end: number; text: string }> {
  const out: Array<{ start: number; end: number; text: string }> = [];
  const scanner = new RegExp(pattern.source, pattern.flags);
  let match: RegExpExecArray | null;
  while ((match = scanner.exec(text)) !== null && out.length < limit) {
    out.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
    if (scanner.lastIndex === match.index) scanner.lastIndex += 1;
  }
  return out;
}
