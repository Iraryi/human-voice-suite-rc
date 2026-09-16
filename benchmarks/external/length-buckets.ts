/**
 * The length buckets, and what the generator is told about room.
 *
 * In its own module because `length-report.ts` needs the bucket list and importing
 * `length-matched.ts` for it runs that tool's command line instead. That is the fourth
 * time this pipeline has been bitten by a module that does something on import; the
 * constants now live where nothing happens, and `tests/benchmark-module-imports.test.ts`
 * is what stops the fifth.
 */

import { splitSentences } from '../../src/shared/text.js';

/** The length buckets, in the order they are reported. */
export const BUCKETS = ['xs', 'short', 'medium', 'long', 'multi'] as const;
export type Bucket = (typeof BUCKETS)[number];

/** Five sentences is where `chat.over_completeness` starts, so it is where `multi` starts. */
export const MULTI_SENTENCES = 5;

/**
 * What the generator is told about room.
 *
 * Deliberately about delivery and never about content: a hint that told the model to
 * "explain properly" or "be thorough" would be an instruction to behave like an assistant,
 * and the experiment would be measuring its own prompt.
 */
export const LENGTH_HINT: Record<Bucket, string> = {
  xs: 'Room: a few characters, the length of 嗯嗯 or 哈哈哈哈. No more.',
  short: 'Room: one short line, under twenty characters.',
  medium: 'Room: one line of twenty to sixty characters.',
  long: 'Room: a few sentences, sixty to a hundred and fifty characters in total.',
  multi:
    'Room: five or more short sentences in a row — the way a person sends a burst of short messages rather than one composed paragraph.',
};

/** The bucket a human reply belongs to. `multi` first: it is about sentences, not characters. */
export function bucketOf(humanReply: string): Bucket {
  if (splitSentences(humanReply).length >= MULTI_SENTENCES) return 'multi';
  const length = humanReply.length;
  if (length < 10) return 'xs';
  if (length < 20) return 'short';
  if (length < 60) return 'medium';
  return 'long';
}
