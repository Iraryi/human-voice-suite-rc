#!/usr/bin/env node
/**
 * `npm run paired:generate`
 *
 * Prepare the generation work, then merge and validate what came back.
 *
 * ## The three conditions
 *
 * A single "machine" bucket would answer the wrong question. What matters is not
 * only whether the rules separate human from machine, but whether they can see the
 * *difference between two machines* — an unconstrained assistant and one answering
 * under this project's contract.
 *
 * | Condition | What the generator is told |
 * | --- | --- |
 * | `plain` | Answer the conversation. Nothing else. The unconstrained assistant. |
 * | `default` | Answer the conversation under this suite's own chat contract: the preamble from `human_voice_prepare` and its prohibition list, verbatim. |
 * | `post` | Take the `plain` answer and rewrite it under the same contract. The suite's actual pipeline shape — draft, then apply the contract — and the condition that says whether the rules can see a rewrite. |
 *
 * `default` and `post` use the *real* contract text, extracted from the code rather
 * than paraphrased here, so the experiment measures the suite rather than my summary
 * of it.
 *
 * ## Fairness
 *
 * Every chunk carries the same `brief` for its condition: the same task framing, the
 * same output rules, the same length guidance. Generators differ in nothing but the
 * context they are given. The chunk file is the unit of work, so the brief travels
 * with it and cannot drift between agents.
 *
 * ## The boundary
 *
 * Chunks contain LCCC text and live in `.external-corpora/`. Machine replies are
 * saved there too, for internal evaluation. A machine positive sample may only be
 * committed after being reconstructed without LCCC context.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createToolkit } from '../../src/dsh/tools/runtime.js';
import { PROVENANCE_LABEL, EXCEPTION_LABEL } from './labels.js';
import { CONDITIONS } from './conditions.js';
import type { Condition } from './conditions.js';
import { censusOf, selectStratified } from './selection.js';
import { MAX_REPLY, MIN_REPLY, isRefusal } from './reply-rules.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAIRED = path.join(ROOT, '.external-corpora', 'paired');
const CHUNKS = path.join(PAIRED, 'chunks');
const OUT = path.join(PAIRED, 'out');

export { CONDITIONS, type Condition } from './conditions.js';
export { MAX_REPLY, MIN_REPLY, REFUSAL, isRefusal } from './reply-rules.js';

interface Item {
  readonly id: string;
  readonly context: string;
  readonly userTurn: string;
  readonly humanReply: string;
  readonly strata: Record<string, string>;
}

function loadItems(view: string, limit: number): Item[] {
  const file = path.join(PAIRED, `${view}.jsonl`);
  if (!existsSync(file)) {
    throw new Error(`No ${view} view at ${file}. Run \`npm run paired:sample\` first.`);
  }
  const items = readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Item);
  // Not `slice(0, limit)`: the view is written cell by cell, so its head is one
  // stratum. See selection.ts.
  return selectStratified(items, limit);
}

/**
 * The generator brief, per condition.
 *
 * Written once, here, so the instructions are data rather than something each agent
 * improvises.
 */
async function briefs(): Promise<Record<Condition, string>> {
  const toolkit = await createToolkit({ projectRoot: ROOT });
  // The real contract for a Chinese chat turn, taken from the capability layer.
  const prepared = await toolkit.prepare({ text: '在吗？', mode: 'chat' });
  const prohibitions = prepared.contract.forbidden.map((line) => `- ${line}`).join('\n');

  const output =
    'Output rules: reply with the message text only. No explanation, no preamble, no ' +
    'quotation marks around it, no label. Reply in Chinese, the language of the conversation. ' +
    'Length: whatever a person would actually send in this conversation — one line if that is ' +
    'enough, a few short lines if not. Never more than 120 characters.';

  return {
    plain: [
      'You are a helpful assistant in a chat conversation.',
      'Read the conversation below and write the next message, as the person who has been replying.',
      '',
      output,
    ].join('\n'),
    default: [
      'You are answering a chat conversation.',
      'Read the conversation below and write the next message, as the person who has been replying.',
      '',
      'Answer under this contract, which is the complete list of things not to do:',
      '',
      prohibitions,
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
      output,
    ].join('\n'),
  };
}

interface Chunk {
  readonly condition: Condition;
  readonly index: number;
  readonly brief: string;
  readonly items: ReadonlyArray<{
    readonly id: string;
    readonly conversation: string;
    readonly draft?: string;
  }>;
  readonly outputFile: string;
}

function conversationFor(item: Item): string {
  const lines = item.context.length > 0 ? `${item.context}\n` : '';
  return `${lines}${item.userTurn}`;
}

/**
 * Answers already written for a condition, by id.
 *
 * Only rows that would survive the merge count: a text that is too short, too long
 * or a refusal is not an answer, and leaving it out means it gets generated again
 * rather than being counted as done.
 */
function existingAnswers(condition: Condition): Map<string, string> {
  const rows = new Map<string, string>();
  const files = existsSync(OUT)
    ? readdirSync(OUT).filter((name) => name.startsWith(`${condition}-`) && name.endsWith('.jsonl'))
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
  view: string;
  chunkSize: number;
  limit: number;
  only: Condition | null;
}): Promise<number> {
  const items = loadItems(options.view, options.limit);
  const templates = await briefs();
  mkdirSync(CHUNKS, { recursive: true });
  mkdirSync(OUT, { recursive: true });

  // `post` rewrites the `plain` answer, so its chunks need those answers as drafts.
  // They are read from the merged `plain` output rather than generated fresh, which
  // is what makes `post` a rewrite condition rather than a third independent sample.
  const drafts = new Map<string, string>();
  if (options.only !== 'default' && options.only !== 'plain') {
    for (const [id, text] of existingAnswers('plain')) drafts.set(id, text);
    if (drafts.size === 0) {
      throw new Error(
        'No plain drafts found in the output directory. Generate the `plain` condition first: `post` ' +
          'is a rewrite of it, and generating it independently would make it a third sample rather ' +
          'than the pipeline it is meant to measure.',
      );
    }
  }

  const conditions = options.only ? [options.only] : CONDITIONS;
  let written = 0;
  const reused: Record<string, number> = {};
  for (const condition of conditions) {
    // Answers already in the output directory are not generated twice. An earlier
    // run drew a different selection, so this is what keeps a larger run from
    // paying again for the items it happens to share with the smaller one.
    const have = existingAnswers(condition);
    const relevant = items
      .filter((item) => (condition === 'post' ? drafts.has(item.id) : true))
      .filter((item) => !have.has(item.id));
    reused[condition] = items.length - relevant.length;
    for (let start = 0; start < relevant.length; start += options.chunkSize) {
      const slice = relevant.slice(start, start + options.chunkSize);
      const index = Math.floor(start / options.chunkSize);
      // The file name carries the first item id, not just a chunk number. A later run
      // draws a different selection, so a number-only name would make its output
      // overwrite the previous run's — which is how the first scaled run silently
      // destroyed the twenty-six answers it had decided to reuse.
      const stamp = slice[0]!.id.replace(/[^A-Za-z0-9-]/g, '');
      const outputFile = `.external-corpora/paired/out/${condition}-${String(index).padStart(4, '0')}-${stamp}.jsonl`;
      const chunk: Chunk = {
        condition,
        index,
        brief: templates[condition],
        items: slice.map((item) => ({
          id: item.id,
          conversation: conversationFor(item),
          ...(condition === 'post' ? { draft: drafts.get(item.id)! } : {}),
        })),
        outputFile,
      };
      writeFileSync(
        path.join(CHUNKS, `${condition}-${String(index).padStart(4, '0')}-${stamp}.json`),
        `${JSON.stringify(chunk, null, 1)}\n`,
        'utf8',
      );
      written += 1;
    }
  }
  process.stdout.write(
    `\nPrepared ${written} chunk(s) for ${items.length} item(s)${
      options.only ? ` (condition: ${options.only})` : ` x ${CONDITIONS.length} condition(s)`
    }.\n` +
      `  strata  : ${Object.keys(censusOf(items)).length} cell(s) covered, round-robin\n` +
      `  chunks  : ${path.relative(ROOT, CHUNKS).split('\\').join('/')}\n` +
      `  output  : ${path.relative(ROOT, OUT).split('\\').join('/')}\n` +
      `  reused  : ${conditions.map((condition) => `${condition} ${reused[condition] ?? 0}`).join(', ')} already answered\n` +
      `  drafts  : ${drafts.size} plain answer(s) available for post\n` +
      `\nEach chunk is one unit of work: read it, generate, write the output file named inside it.\n`,
  );
  return 0;
}

interface MergedRow {
  readonly id: string;
  readonly condition: Condition;
  readonly text: string;
  readonly chars: number;
}

/**
 * Merge and validate what the generators wrote.
 *
 * Rejections are reported by reason and counted, never silently dropped: a condition
 * with a 40% refusal rate is a fact about the experiment, not noise to be tidied away.
 */
function merge(options: { view: string; limit: number }): number {
  const items = loadItems(options.view, options.limit);
  const expected = new Map<string, Set<Condition>>();
  for (const item of items) {
    expected.set(item.id, new Set(CONDITIONS));
  }

  const rows: MergedRow[] = [];
  const counts: Record<Condition, { accepted: number; missing: number; refused: number; bad: number }> = {
    plain: { accepted: 0, missing: 0, refused: 0, bad: 0 },
    default: { accepted: 0, missing: 0, refused: 0, bad: 0 },
    post: { accepted: 0, missing: 0, refused: 0, bad: 0 },
  };
  /** Rows left over from an earlier, differently selected run. Not failures. */
  const stale: Record<Condition, number> = { plain: 0, default: 0, post: 0 };
  const seen = new Set<string>();

  for (const file of existsSync(OUT) ? readdirSync(OUT).filter((name) => name.endsWith('.jsonl')).sort() : []) {
    const condition = file.split('-')[0] as Condition;
    if (!CONDITIONS.includes(condition)) continue;
    for (const line of readFileSync(path.join(OUT, file), 'utf8').split('\n')) {
      if (line.trim().length === 0) continue;
      let parsed: { id?: unknown; text?: unknown };
      try {
        parsed = JSON.parse(line) as { id?: unknown; text?: unknown };
      } catch {
        counts[condition].bad += 1;
        continue;
      }
      const id = typeof parsed.id === 'string' ? parsed.id : '';
      let text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
      if (id.length === 0) {
        counts[condition].bad += 1;
        continue;
      }
      // An id this selection did not ask for is a leftover from an earlier draw,
      // reused harmlessly when the item is drawn again. That is not a bad reply.
      if (!expected.has(id)) {
        stale[condition] += 1;
        continue;
      }
      // Strip the wrappers a generator adds despite being asked not to. Counting
      // them as failures would be measuring obedience, not behaviour.
      text = text.replace(/^["'“”「」]+|["'“”「」]+$/g, '').replace(/^(?:回复|回答|消息)[:：]\s*/, '').trim();
      if (text.length < MIN_REPLY || text.length > MAX_REPLY) {
        counts[condition].bad += 1;
        continue;
      }
      if (isRefusal(text)) {
        counts[condition].refused += 1;
        continue;
      }
      const key = `${condition}\u0000${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ id, condition, text, chars: text.length });
      counts[condition].accepted += 1;
    }
  }

  for (const [id, conditions] of expected) {
    for (const condition of conditions) {
      if (!seen.has(`${condition}\u0000${id}`)) counts[condition].missing += 1;
    }
  }

  const file = path.join(PAIRED, 'generated.jsonl');
  writeFileSync(file, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');

  const manifest = {
    generatedAt: new Date().toISOString(),
    provenance: PROVENANCE_LABEL,
    exception: EXCEPTION_LABEL,
    boundary:
      'Machine replies derived from LCCC context. Internal evaluation only; not redistributable. ' +
      'A committed positive sample must be reconstructed without LCCC context.',
    conditions: CONDITIONS,
    items: items.length,
    strataCells: Object.keys(censusOf(items)).length,
    selection: 'round-robin across strata cells, see selection.ts',
    accepted: rows.length,
    perCondition: counts,
    staleFromEarlierSelection: stale,
  };
  writeFileSync(path.join(PAIRED, 'generated.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  process.stdout.write('\nGeneration merge\n\n');
  process.stdout.write(`  ${'condition'.padEnd(10)}${'accepted'.padStart(10)}${'missing'.padStart(9)}${'refused'.padStart(9)}${'rejected'.padStart(10)}${'stale'.padStart(8)}\n`);
  for (const condition of CONDITIONS) {
    const row = counts[condition];
    process.stdout.write(
      `  ${condition.padEnd(10)}${String(row.accepted).padStart(10)}${String(row.missing).padStart(9)}${String(row.refused).padStart(9)}${String(row.bad).padStart(10)}${String(stale[condition]).padStart(8)}\n`,
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
  const view = valueOf('--view', 'balanced');
  const chunkSize = Number(valueOf('--chunk-size', '25'));
  const limit = Number(valueOf('--limit', '1000'));
  const onlyArg = valueOf('--only', '');
  const only = (CONDITIONS as readonly string[]).includes(onlyArg) ? (onlyArg as Condition) : null;

  if (command === 'prepare') return prepare({ view, chunkSize, limit, only });
  if (command === 'merge') return merge({ view, limit });
  process.stdout.write(
    [
      'Usage: npm run paired:generate -- <prepare|merge> [options]',
      '',
      '  prepare   Write one chunk file per unit of generation work',
      '  merge     Validate and combine what the generators wrote',
      '',
      'Options:',
      '  --view NAME        balanced (default) or natural',
      '  --chunk-size N     Items per chunk (default 25)',
      '  --limit N          Items to use (default 1000)',
      '  --only CONDITION   Prepare one condition only: plain, default or post',
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
    process.stderr.write(`paired:generate failed: ${String(error)}\n`);
    process.exit(1);
  });



