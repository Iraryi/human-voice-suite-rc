/**
 * Reading LCCC-base, and the strata derived from it.
 *
 * Separated from `paired-sample.ts` when a second experiment needed the same reader.
 * Importing a file that runs a command-line tool runs the tool, which has broken this
 * pipeline three times now, so the reader lives where nothing else happens on import.
 *
 * Everything here is derived from the corpus locally and none of it is committed.
 */

import { createReadStream, existsSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

export const DATA = path.join(ROOT, '.external-corpora', 'lccc');

export function bucket(value: number, cuts: readonly number[], labels: readonly string[]): string {
  for (let index = 0; index < cuts.length; index += 1) {
    if (value < cuts[index]!) return labels[index]!;
  }
  return labels[labels.length - 1]!;
}

/** Length strata, in characters. Wide cuts, because the point is separation not precision. */
export const USER_LENGTH_CUTS = [20, 60] as const;
export const USER_LENGTH_LABELS = ['short', 'medium', 'long'] as const;
export const REPLY_LENGTH_CUTS = [20, 60] as const;
export const REPLY_LENGTH_LABELS = ['short', 'medium', 'long'] as const;
export const CONTEXT_LENGTH_CUTS = [60, 200] as const;
export const CONTEXT_LENGTH_LABELS = ['none', 'short', 'medium', 'long'] as const;

/**
 * Sentences, by the suite's own splitter.
 *
 * Not a local re-implementation, and the difference is not cosmetic: a splitter that
 * ignored newlines found 38 replies of five sentences or more in 30,000 sessions where the
 * suite's found 448. A bucket defined by one splitter and a rule that fires on another
 * measures nothing.
 */
export { splitSentences } from '../../src/shared/text.js';

/**
 * Turn type, by surface form.
 *
 * Deliberately shallow. A real classifier is not available and would not be
 * trustworthy at this granularity, so the categories are the ones a regex can defend:
 * a question, an emotional remark, a very short throwaway, and everything else.
 */
export function classifyType(userTurn: string): 'question' | 'emotion' | 'chitchat' | 'statement' {
  const text = userTurn.trim();
  if (/[？?]$/.test(text) || /(?:吗|呢|吧)[？?]?$/.test(text)) return 'question';
  if (/(?:哈哈|笑死|呜呜|唉|哎|难过|开心|生气|无语|离谱|emo|😂|😅|🤣|😭)/.test(text)) return 'emotion';
  if (text.length < 12) return 'chitchat';
  return 'statement';
}

export interface PairedItem {
  readonly id: string;
  readonly split: string;
  readonly kind: 'single' | 'multi';
  /** Preceding turns, joined for the generator. */
  readonly context: string;
  /** The last turn before the reply: the pair's first half. */
  readonly userTurn: string;
  /** The human continuation: the pair's second half, and the control. */
  readonly humanReply: string;
  readonly strata: {
    readonly kind: string;
    readonly contextLength: string;
    readonly userLength: string;
    readonly replyLength: string;
    readonly type: string;
  };
}

export async function* sessions(
  file: string,
  split: string,
): AsyncGenerator<{ split: string; utterances: string[] }> {
  const lines = createInterface({
    input: createReadStream(file).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (line.trim().length === 0) continue;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const utterances = Object.keys(parsed)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => parsed[key])
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim());
    if (utterances.length >= 2) yield { split, utterances };
  }
}

export function toItem(split: string, index: number, utterances: readonly string[]): PairedItem {
  const userTurn = utterances[utterances.length - 2]!;
  const humanReply = utterances[utterances.length - 1]!;
  const context = utterances.slice(0, -2).join('\n');
  return {
    id: `lccc-${split}-${String(index).padStart(6, '0')}`,
    split,
    kind: utterances.length === 2 ? 'single' : 'multi',
    context,
    userTurn,
    humanReply,
    strata: {
      kind: utterances.length === 2 ? 'single' : 'multi',
      contextLength: bucket(context.length, CONTEXT_LENGTH_CUTS, CONTEXT_LENGTH_LABELS),
      userLength: bucket(userTurn.length, USER_LENGTH_CUTS, USER_LENGTH_LABELS),
      replyLength: bucket(humanReply.length, REPLY_LENGTH_CUTS, REPLY_LENGTH_LABELS),
      type: classifyType(userTurn),
    },
  };
}

/** Files that exist on this machine, in the order they are read. */
export function sourceFiles(splits: readonly string[]): Array<{ split: string; file: string }> {
  return splits
    .map((split) => ({ split, file: path.join(DATA, `lccc_base_${split}.jsonl.gz`) }))
    .filter((entry) => existsSync(entry.file));
}

export { ROOT };
