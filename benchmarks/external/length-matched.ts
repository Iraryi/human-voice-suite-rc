#!/usr/bin/env node
/**
 * `npm run length:prepare` / `npm run length:merge`
 *
 * Axis 1 of the coverage phase: **the length-matched machine condition**.
 *
 * ## The confound this exists to remove
 *
 * The paired control generated machine replies of 12–20 characters against human replies of
 * 38. Every behaviour rule needs room to fire, so the comparison was partly a comparison of
 * reply length. `chat.over_completeness` needs a reply of more than four sentences and not
 * one of the 6,000 machine continuations had five: it never had a fair chance, so its
 * silence on the machine side said nothing about its direction.
 *
 * This axis gives the same kind of prompt to a model that has been told how much room it
 * has — not what to say, only how long the message would be. The question it answers:
 *
 * > If the machine has the same expressive room as the person did, do the behaviour rules
 * > still fire only on the machine?
 *
 * ## The buckets
 *
 * Taken from the **human** reply, so the machine is asked for the room the person used:
 *
 * | Bucket | Human reply |
 * | --- | --- |
 * | `xs` | under 10 characters |
 * | `short` | 10 to 19 |
 * | `medium` | 20 to 59 |
 * | `long` | 60 or more |
 * | `multi` | five sentences or more, whatever its length — the case `chat.over_completeness` needs |
 *
 * `multi` takes precedence over the length buckets, because the rule that motivates this
 * axis is about sentence count and not about characters.
 *
 * ## The three arms here
 *
 * | Arm | What the generator is told |
 * | --- | --- |
 * | `plain` | Answer the conversation. Nothing else. The unconstrained baseline for *these* items. |
 * | `matched` | Answer the conversation, in the room the person had. |
 * | `post` | Rewrite the `matched` answer under the suite's chat contract. |
 *
 * `post` rewrites the matched draft rather than the plain one, deliberately: the paired
 * control found the rewrite step had nothing to do on 12-character drafts, so measuring it
 * again on the same short drafts would measure the same nothing.
 *
 * ## The boundary
 *
 * Chunks carry LCCC context and live in `.external-corpora/`. Nothing here is committed
 * except counts.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createToolkit } from '../../src/dsh/tools/runtime.js';
import { PROVENANCE_LABEL, EXCEPTION_LABEL } from './labels.js';
import { MAX_REPLY, MIN_REPLY, isRefusal } from './reply-rules.js';
import { censusOf, selectStratified } from './selection.js';
import { sessions, sourceFiles, toItem } from './lccc-source.js';
import type { PairedItem } from './lccc-source.js';
import { BUCKETS, LENGTH_HINT, bucketOf } from './length-buckets.js';
import type { Bucket } from './length-buckets.js';

export { BUCKETS, MULTI_SENTENCES, LENGTH_HINT, bucketOf } from './length-buckets.js';
export type { Bucket } from './length-buckets.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAIRED = path.join(ROOT, '.external-corpora', 'paired');
const VALID = path.join(ROOT, '.external-corpora', 'length');
const CHUNKS = path.join(VALID, 'chunks');
const OUT = path.join(VALID, 'out');

/** The arms of this axis. `post` rewrites `matched`, not `plain`. */
export const ARMS = ['plain', 'matched', 'post'] as const;
export type Arm = (typeof ARMS)[number];

export interface LengthItem {
  readonly id: string;
  readonly context: string;
  readonly userTurn: string;
  readonly humanReply: string;
  readonly strata: Record<string, string>;
  readonly bucket: Bucket;
}

interface Chunk {
  readonly axis: 'length-matched';
  readonly arm: Arm;
  readonly bucket: Bucket | 'mixed';
  readonly index: number;
  readonly brief: string;
  readonly items: ReadonlyArray<{ readonly id: string; readonly conversation: string; readonly draft?: string }>;
  readonly outputFile: string;
}

function readBalancedView(): Array<Omit<LengthItem, 'bucket'>> {
  const file = path.join(PAIRED, 'balanced.jsonl');
  if (!existsSync(file)) {
    throw new Error('No balanced view. Run `npm run paired:sample` first.');
  }
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Omit<LengthItem, 'bucket'>);
}

/**
 * Draw `perBucket` items per length bucket.
 *
 * Drawing by bucket rather than by cell is what makes the length-conditioned rate
 * computable at all: `multi` is 0.7% of the balanced view, so a plain round-robin draw of
 * a few hundred items produces a handful of the one bucket `chat.over_completeness` needs.
 * Oversampling is safe here **because every rate this axis reports is a rate within a
 * bucket**; the population weights are what the frozen paired control is for.
 *
 * The common buckets come from the part of the balanced view the frozen run did not use.
 * `multi` cannot: only twelve such items are left there, so it is drawn from the corpus
 * itself, excluding everything the balanced view holds so that no prompt is measured twice.
 */
async function loadItems(options: { perBucket: number; offset: number }): Promise<LengthItem[]> {
  const view = readBalancedView();
  const inView = new Set(view.map((item) => item.id));
  // `offset` skips the items the frozen paired control already used, so the two experiments
  // never measure the same prompt and neither result has to explain the other.
  const window = selectStratified(view, options.offset + options.perBucket * BUCKETS.length).slice(
    options.offset,
  );

  const byBucket = new Map<Bucket, LengthItem[]>();
  for (const bucket of BUCKETS) byBucket.set(bucket, []);
  for (const item of window) {
    const bucket = bucketOf(item.humanReply);
    const list = byBucket.get(bucket)!;
    if (list.length < options.perBucket) list.push({ ...item, bucket });
  }

  const short = BUCKETS.filter((bucket) => (byBucket.get(bucket) ?? []).length < options.perBucket);
  if (short.length > 0) {
    for (const { split, file } of sourceFiles(['valid', 'test'])) {
      let index = 0;
      for await (const session of sessions(file, split)) {
        index += 1;
        const item = toItem(split, index, session.utterances);
        if (inView.has(item.id)) continue;
        const bucket = bucketOf(item.humanReply);
        if (!short.includes(bucket)) continue;
        const list = byBucket.get(bucket)!;
        if (list.length >= options.perBucket) continue;
        list.push({ ...item, bucket });
      }
      if (short.every((bucket) => (byBucket.get(bucket) ?? []).length >= options.perBucket)) break;
    }
  }

  return BUCKETS.flatMap((bucket) => byBucket.get(bucket) ?? []);
}

async function briefs(): Promise<Record<Arm, string>> {
  const toolkit = await createToolkit({ projectRoot: ROOT });
  const prepared = await toolkit.prepare({ text: '在吗？', mode: 'chat' });
  const prohibitions = prepared.contract.forbidden.map((line) => `- ${line}`).join('\n');

  const output =
    'Output rules: reply with the message text only. No explanation, no preamble, no ' +
    'quotation marks around it, no label. Reply in Chinese, the language of the conversation. ' +
    'Never more than 120 characters.';

  return {
    plain: [
      'You are a helpful assistant in a chat conversation.',
      'Read the conversation below and write the next message, as the person who has been replying.',
      '',
      output,
    ].join('\n'),
    matched: [
      'You are answering a chat conversation.',
      'Read the conversation below and write the next message, as the person who has been replying.',
      '',
      'How much room you have is given below. It is about length only, not about what to say, and it is the',
      'room the other person had. Do not pad, do not explain, do not add anything to fill it.',
      '',
      output,
    ].join('\n'),
    post: [
      'You are revising a draft reply in a chat conversation.',
      'The conversation is below, then a draft reply. Rewrite the draft so it keeps every claim it',
      'makes and adds nothing, while obeying this contract — the complete list of things not to do:',
      '',
      prohibitions,
      '',
      'Keep the rewrite about as long as the draft.',
      '',
      output,
    ].join('\n'),
  };
}

function conversationFor(item: LengthItem): string {
  const lines = item.context.length > 0 ? `${item.context}\n` : '';
  return `${lines}${item.userTurn}`;
}

function existingAnswers(arm: Arm): Map<string, string> {
  const rows = new Map<string, string>();
  const files = existsSync(OUT)
    ? readdirSync(OUT).filter((name) => name.startsWith(`${arm}-`) && name.endsWith('.jsonl'))
    : [];
  for (const file of files) {
    for (const line of readFileSync(path.join(OUT, file), 'utf8').split('\n')) {
      if (line.trim().length === 0) continue;
      let parsed: { id?: unknown; text?: unknown };
      try {
        parsed = JSON.parse(line) as { id?: unknown; text?: unknown };
      } catch {
        continue;
      }
      if (typeof parsed.id !== 'string' || typeof parsed.text !== 'string') continue;
      const text = parsed.text.trim();
      if (text.length < MIN_REPLY || text.length > MAX_REPLY) continue;
      if (isRefusal(text)) continue;
      rows.set(parsed.id, text);
    }
  }
  return rows;
}

async function prepare(options: {
  perBucket: number;
  offset: number;
  chunkSize: number;
  only: Arm | null;
}): Promise<number> {
  const items = await loadItems({ perBucket: options.perBucket, offset: options.offset });
  const templates = await briefs();
  mkdirSync(CHUNKS, { recursive: true });
  mkdirSync(OUT, { recursive: true });

  const drafts = existingAnswers('matched');
  const arms = options.only ? [options.only] : ARMS;
  let written = 0;
  const reused: Record<string, number> = {};

  for (const arm of arms) {
    const have = existingAnswers(arm);
    const relevant = items
      .filter((item) => (arm === 'post' ? drafts.has(item.id) : true))
      .filter((item) => !have.has(item.id));
    reused[arm] = items.length - relevant.length;

    // Chunked by bucket, not by index: one chunk is one brief, and the brief carries the
    // room this item has. A mixed chunk would need a brief per item and stop being a brief.
    for (const bucket of BUCKETS) {
      const inBucket = relevant.filter((item) => item.bucket === bucket);
      for (let start = 0; start < inBucket.length; start += options.chunkSize) {
        const slice = inBucket.slice(start, start + options.chunkSize);
        const index = Math.floor(start / options.chunkSize);
        const brief =
          arm === 'matched' ? `${templates.matched}\n${LENGTH_HINT[bucket]}` : templates[arm];
        const stamp = slice[0]!.id.replace(/[^A-Za-z0-9-]/g, '');
        const chunk: Chunk = {
          axis: 'length-matched',
          arm,
          bucket,
          index,
          brief,
          items: slice.map((item) => ({
            id: item.id,
            conversation: conversationFor(item),
            ...(arm === 'post' ? { draft: drafts.get(item.id)! } : {}),
          })),
          outputFile: `.external-corpora/length/out/${arm}-${bucket}-${String(index).padStart(3, '0')}-${stamp}.jsonl`,
        };
        writeFileSync(
          path.join(CHUNKS, `${arm}-${bucket}-${String(index).padStart(3, '0')}-${stamp}.json`),
          `${JSON.stringify(chunk, null, 1)}\n`,
          'utf8',
        );
        written += 1;
      }
    }
  }

  const counts = new Map<Bucket, number>();
  for (const item of items) counts.set(item.bucket, (counts.get(item.bucket) ?? 0) + 1);
  process.stdout.write(
    `\nPrepared ${written} chunk(s) for ${items.length} item(s)${
      options.only ? ` (arm: ${options.only})` : ` x ${ARMS.length} arm(s)`
    }.\n` +
      `  buckets : ${BUCKETS.map((bucket) => `${bucket} ${counts.get(bucket) ?? 0}`).join(', ')}\n` +
      `  strata  : ${Object.keys(censusOf(items)).length} cell(s) covered, starting at item ${options.offset + 1}\n` +
      `  chunks  : ${path.relative(ROOT, CHUNKS).split('\\').join('/')}\n` +
      `  reused  : ${arms.map((arm) => `${arm} ${reused[arm] ?? 0}`).join(', ')} already answered\n` +
      `  drafts  : ${drafts.size} matched answer(s) available for post\n` +
      `\nEach chunk is one unit of work: read it, generate, write the output file named inside it.\n`,
  );
  return 0;
}

async function merge(options: { perBucket: number; offset: number }): Promise<number> {
  const items = await loadItems({ perBucket: options.perBucket, offset: options.offset });
  const expected = new Map(items.map((item) => [item.id, item]));
  const counts: Record<Arm, { accepted: number; missing: number; refused: number; bad: number }> = {
    plain: { accepted: 0, missing: 0, refused: 0, bad: 0 },
    matched: { accepted: 0, missing: 0, refused: 0, bad: 0 },
    post: { accepted: 0, missing: 0, refused: 0, bad: 0 },
  };
  const stale: Record<Arm, number> = { plain: 0, matched: 0, post: 0 };
  const rows: Array<{ id: string; arm: Arm; bucket: Bucket; text: string; chars: number }> = [];
  const seen = new Set<string>();

  for (const file of existsSync(OUT) ? readdirSync(OUT).filter((name) => name.endsWith('.jsonl')).sort() : []) {
    const arm = file.split('-')[0] as Arm;
    if (!ARMS.includes(arm)) continue;
    for (const line of readFileSync(path.join(OUT, file), 'utf8').split('\n')) {
      if (line.trim().length === 0) continue;
      let parsed: { id?: unknown; text?: unknown };
      try {
        parsed = JSON.parse(line) as { id?: unknown; text?: unknown };
      } catch {
        counts[arm].bad += 1;
        continue;
      }
      const id = typeof parsed.id === 'string' ? parsed.id : '';
      let text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
      if (id.length === 0) {
        counts[arm].bad += 1;
        continue;
      }
      if (!expected.has(id)) {
        stale[arm] += 1;
        continue;
      }
      text = text.replace(/^["'“”「」]+|["'“”「」]+$/g, '').replace(/^(?:回复|回答|消息)[:：]\s*/, '').trim();
      if (text.length < MIN_REPLY || text.length > MAX_REPLY) {
        counts[arm].bad += 1;
        continue;
      }
      if (isRefusal(text)) {
        counts[arm].refused += 1;
        continue;
      }
      const key = `${arm}\u0000${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ id, arm, bucket: expected.get(id)!.bucket, text, chars: text.length });
      counts[arm].accepted += 1;
    }
  }

  for (const item of items) {
    for (const arm of ARMS) {
      if (!seen.has(`${arm}\u0000${item.id}`)) counts[arm].missing += 1;
    }
  }

  const file = path.join(VALID, 'generated.jsonl');
  writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
  // The items themselves, because some of them were drawn from the corpus rather than
  // from the balanced view and the report cannot get them back from the view alone.
  writeFileSync(
    path.join(VALID, 'items.jsonl'),
    `${items.map((item) => JSON.stringify(item)).join('\n')}\n`,
    'utf8',
  );
  writeFileSync(
    path.join(VALID, 'manifest.json'),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        axis: 'length-matched',
        provenance: PROVENANCE_LABEL,
        exception: EXCEPTION_LABEL,
        boundary:
          'Machine replies derived from LCCC context. Internal evaluation only; not redistributable. ' +
          'A committed positive sample must be reconstructed without LCCC context.',
        arms: ARMS,
        buckets: BUCKETS,
        offset: options.offset,
        items: items.length,
        bucketCensus: (() => {
          const out: Record<string, number> = {};
          for (const item of items) out[item.bucket] = (out[item.bucket] ?? 0) + 1;
          return out;
        })(),
        accepted: rows.length,
        perArm: counts,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  process.stdout.write('\nLength-matched merge\n\n');
  process.stdout.write(
    `  ${'arm'.padEnd(10)}${'accepted'.padStart(10)}${'missing'.padStart(9)}${'refused'.padStart(9)}${'rejected'.padStart(10)}${'stale'.padStart(8)}\n`,
  );
  for (const arm of ARMS) {
    const row = counts[arm];
    process.stdout.write(
      `  ${arm.padEnd(10)}${String(row.accepted).padStart(10)}${String(row.missing).padStart(9)}${String(row.refused).padStart(9)}${String(row.bad).padStart(10)}${String(stale[arm]).padStart(8)}\n`,
    );
  }
  process.stdout.write(`\n  written to ${path.relative(ROOT, file).split('\\').join('/')}\n`);
  return rows.length === 0 ? 1 : 0;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const valueOf = (flag: string, fallback: string): string => {
    const index = argv.indexOf(flag);
    return index === -1 ? fallback : (argv[index + 1] ?? fallback);
  };
  const perBucket = Number(valueOf('--per-bucket', '120'));
  // The frozen paired control took the first 2,000 of the round-robin order; this axis
  // starts after them so no prompt is measured twice.
  const offset = Number(valueOf('--offset', '2000'));
  const chunkSize = Number(valueOf('--chunk-size', '30'));
  const onlyArg = valueOf('--only', '');
  const only = (ARMS as readonly string[]).includes(onlyArg) ? (onlyArg as Arm) : null;

  if (command === 'prepare') return prepare({ perBucket, offset, chunkSize, only });
  if (command === 'merge') return merge({ perBucket, offset });
  process.stdout.write(
    [
      'Usage: npm run length:prepare -- [options] | npm run length:merge -- [options]',
      '',
      '  prepare   Write one chunk file per unit of generation work',
      '  merge     Validate and combine what the generators wrote',
      '',
      'Options:',
      '  --per-bucket N   Items per length bucket (default 120)',
      '  --offset N       Items to skip, past the frozen paired control (default 2000)',
      '  --chunk-size N   Items per chunk (default 30)',
      '  --only ARM       Prepare one arm only: plain, matched or post',
      '',
      `  ${PROVENANCE_LABEL}`,
      `  ${EXCEPTION_LABEL}`,
      '',
    ].join('\n'),
  );
  return command === undefined ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`length-matched failed: ${String(error)}\n`);
    process.exit(1);
  });
