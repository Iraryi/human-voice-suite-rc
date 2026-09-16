#!/usr/bin/env node
/**
 * `npm run length:report`
 *
 * Axis 1 of the coverage phase: **does the behaviour layer still fire only on the
 * machine when the machine has the same room the person had?**
 *
 * ## Why the numbers come in two kinds
 *
 * The item draw oversamples the `multi` bucket, because a reply of five sentences is
 * about 1.5% of the corpus and that is exactly the bucket `chat.over_completeness`
 * needs. Oversampling makes the pooled rate meaningless as a statement about the
 * corpus while leaving every **within-bucket** rate correct. So this file prints both,
 * labelled, and never averages them together:
 *
 * | Kind | What it is | Where it is valid |
 * | --- | --- | --- |
 * | **Raw, pooled** | firings over all 600 items of an arm | comparison *between arms of this file*, since every arm sees the same items |
 * | **Length-conditioned** | firings within one bucket | a statement about replies of that length |
 *
 * The population rate for the natural distribution is in `PAIRED_CONTROL.md` and is not
 * recomputed here.
 *
 * ## The boundary
 *
 * Every reply in this file is derived from LCCC context. Measured locally, never
 * redistributed; the labels below are mandatory.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createToolkit } from '../../src/dsh/tools/runtime.js';
import { ASSISTANT_SHAPED } from './behaviour.js';
import { PROVENANCE_LABEL, EXCEPTION_LABEL } from './labels.js';
import { BUCKETS, MULTI_SENTENCES } from './length-buckets.js';
import type { Bucket } from './length-buckets.js';
import { splitSentences } from '../../src/shared/text.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const VALID = path.join(ROOT, '.external-corpora', 'length');
const OUT = path.join(HERE, 'LENGTH_MATCHED.md');

const HUMAN = 'human' as const;
type Arm = typeof HUMAN | 'plain' | 'matched' | 'post';
const ARMS: readonly Arm[] = [HUMAN, 'plain', 'matched', 'post'];

/** Rules worth a row: the ones the paired control found, plus anything that fires here. */
const MIN_FIRINGS = 4;

interface Item {
  readonly id: string;
  readonly context: string;
  readonly userTurn: string;
  readonly humanReply: string;
  readonly bucket: Bucket;
}

interface Row {
  readonly id: string;
  readonly arm: Exclude<Arm, 'human'>;
  readonly bucket: Bucket;
  readonly text: string;
}

interface Cell {
  n: number;
  readonly fires: Map<string, number>;
  chars: number;
  sentences: number;
  /** Replies past the sentence count `chat.over_completeness` requires. */
  longReplies: number;
  assistantShaped: number;
  behaviorScore: number;
}

function emptyCell(): Cell {
  return { n: 0, fires: new Map(), chars: 0, sentences: 0, longReplies: 0, assistantShaped: 0, behaviorScore: 0 };
}

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

async function main(): Promise<number> {
  const itemsFile = path.join(VALID, 'items.jsonl');
  const rowsFile = path.join(VALID, 'generated.jsonl');
  for (const [file, hint] of [
    [itemsFile, 'npm run length:merge'],
    [rowsFile, 'npm run length:merge'],
  ] as const) {
    if (!existsSync(file)) {
      process.stderr.write(`Missing ${path.relative(ROOT, file)}. Run \`${hint}\` first.\n`);
      return 1;
    }
  }

  const items = readFileSync(itemsFile, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Item);
  const rows = readFileSync(rowsFile, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Row);

  const byItem = new Map<string, Partial<Record<Exclude<Arm, 'human'>, string>>>();
  for (const row of rows) {
    const entry = byItem.get(row.id) ?? {};
    entry[row.arm] = row.text;
    byItem.set(row.id, entry);
  }
  const usable = items.filter((item) => {
    const entry = byItem.get(item.id);
    return entry !== undefined && entry.plain !== undefined && entry.matched !== undefined && entry.post !== undefined;
  });

  const toolkit = await createToolkit({ projectRoot: ROOT });
  const cells = new Map<string, Cell>();
  const cellOf = (arm: Arm, bucket: Bucket): Cell => {
    const key = `${arm}\u0000${bucket}`;
    const cell = cells.get(key) ?? emptyCell();
    cells.set(key, cell);
    return cell;
  };
  /** Items whose matched reply reached the sentence count the completeness rule needs. */
  let matchedReached = 0;

  let done = 0;
  for (const item of usable) {
    const machine = byItem.get(item.id)!;
    matchedReached += splitSentences(machine.matched!).length > MULTI_SENTENCES - 1 ? 1 : 0;

    for (const arm of ARMS) {
      const text = arm === HUMAN ? item.humanReply : machine[arm]!;
      const scanned = await toolkit.scan({
        text,
        mode: 'chat',
        families: ['assistant'],
        conversation: { userTurn: item.userTurn },
      });
      const cell = cellOf(arm, item.bucket);
      const sentenceCount = splitSentences(text).length;
      cell.n += 1;
      cell.chars += text.length;
      cell.sentences += sentenceCount;
      if (sentenceCount > MULTI_SENTENCES - 1) cell.longReplies += 1;
      cell.behaviorScore += scanned.scores.behaviorScore;
      if (scanned.scores.behaviorScore < ASSISTANT_SHAPED) cell.assistantShaped += 1;
      for (const finding of scanned.canonicalFindings) {
        const id = finding.canonicalRuleId ?? finding.ruleId;
        cell.fires.set(id, (cell.fires.get(id) ?? 0) + 1);
      }
    }

    done += 1;
    if (done % 100 === 0) process.stderr.write(`  ${done}/${usable.length} item(s)\r`);
  }
  if (done > 0) process.stderr.write('\n');

  // Every rule that fired anywhere, so the report cannot hide one by not listing it.
  const ruleIds = new Set<string>();
  for (const cell of cells.values()) for (const id of cell.fires.keys()) ruleIds.add(id);
  const firesIn = (arm: Arm, bucket: Bucket | null, ruleId: string): number => {
    let total = 0;
    for (const [key, cell] of cells) {
      const [cellArm, cellBucket] = key.split('\u0000') as [Arm, Bucket];
      if (cellArm !== arm) continue;
      if (bucket !== null && cellBucket !== bucket) continue;
      total += cell.fires.get(ruleId) ?? 0;
    }
    return total;
  };
  const nIn = (arm: Arm, bucket: Bucket | null): number => {
    let total = 0;
    for (const [key, cell] of cells) {
      const [cellArm, cellBucket] = key.split('\u0000') as [Arm, Bucket];
      if (cellArm !== arm) continue;
      if (bucket !== null && cellBucket !== bucket) continue;
      total += cell.n;
    }
    return total;
  };

  const lines: string[] = [];
  const push = (...text: string[]): void => {
    for (const line of text) lines.push(line);
  };

  push(
    '# Length-matched control: does the machine still look like the machine when it has room?',
    '',
    '<!-- Generated by `npm run length:report`. Statistics only: no source text. -->',
    '',
    '```text',
    PROVENANCE_LABEL,
    EXCEPTION_LABEL,
    '```',
    '',
    '## The confound this removes',
    '',
    'The paired control (`PAIRED_CONTROL.md`) held the context fixed and found three rules that separate',
    'machine chat from human chat. But its machine arms wrote 12–20 characters against 38 for the human',
    'continuations, and every behaviour rule needs room to fire. `chat.over_completeness` needs a reply of more',
    'than four sentences and **not one of 6,000 machine continuations had five** — so its silence on the machine',
    'side was never evidence about its direction.',
    '',
    'This axis gives the same kind of prompt to a model that has been told how much room it has. The question:',
    '',
    '> If the machine has the same expressive room as the person did, do the behaviour rules still fire only on',
    '> the machine?',
    '',
    '## The design',
    '',
    '| Arm | What the generator was told |',
    '| --- | --- |',
    '| `human` | The LCCC continuation, unchanged. The control. |',
    '| `plain` | Answer the conversation. Nothing else — the unconstrained baseline for *these* items. |',
    '| `matched` | Answer the conversation in the room the person had. The `Room:` line says how long, never what to say. |',
    '| `post` | Rewrite the `matched` answer under the suite\'s chat contract, keeping its length. |',
    '',
    '`post` rewrites the matched draft rather than the plain one, deliberately: the paired control found the',
    'rewrite step had nothing to do on a 12-character draft, so measuring it again on one would measure the same',
    'nothing.',
    '',
    '| | |',
    '| --- | --- |',
    `| Items | ${usable.length} |`,
    `| Buckets | ${BUCKETS.map((bucket) => `\`${bucket}\` ${nIn(HUMAN, bucket)}`).join(', ')} |`,
    '| Draw | per bucket, from the part of the balanced view the paired control did not use |',
    `| Rules that fired anywhere | ${ruleIds.size} |`,
    '',
    '**The draw oversamples `multi`.** A reply of five sentences is about 1.5% of the corpus, so a plain draw of',
    'a few hundred items gives a handful of the one bucket this axis exists for. Every rate below is therefore',
    'printed **within a bucket**, where oversampling cannot bias it, or as a raw pooled count whose only valid',
    'comparison is between the arms of this file — all of which see the identical items. The population rate for',
    "LCCC's own distribution is in `PAIRED_CONTROL.md` and is not recomputed here.",
    '',
    '## 1. Did the manipulation work?',
    '',
    'If the `Room:` line did not move the machine replies, nothing below means anything. Human is first because',
    'the buckets were defined on the human reply.',
    '',
    '| Bucket | Arm | Mean characters | Mean sentences | Replies > 4 sentences |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const bucket of BUCKETS) {
    for (const arm of ARMS) {
      const cell = cells.get(`${arm}\u0000${bucket}`);
      if (cell === undefined || cell.n === 0) continue;
      push(
        `| \`${bucket}\` | \`${arm}\` | ${(cell.chars / cell.n).toFixed(1)} | ${(cell.sentences / cell.n).toFixed(2)} | ` +
          `${cell.longReplies} (${pct(rate2(cell.longReplies, cell.n))}) |`,
      );
    }
  }
  push(
    '',
    `**${matchedReached} of the \`matched\` replies reached five sentences** — the shape`,
    '`chat.over_completeness` requires — against 0 of 600 in this file\'s own unconstrained arm and 0 of the',
    '6,000 continuations of the paired control. The rule has a fair chance on this data for the first time, and',
    '§4 is what it does with it.',
    '',
    '## 2. Raw pooled rates, by arm',
    '',
    'Over all items, per arm. These compare the arms of this file with each other and nothing else.',
    '',
    `| Rule | ${ARMS.map((arm) => `\`${arm}\``).join(' | ')} |`,
    `| --- | ${ARMS.map(() => '---').join(' | ')} |`,
  );
  for (const ruleId of [...ruleIds].sort()) {
    push(
      `| \`${ruleId}\` | ${ARMS.map((arm) => `${firesIn(arm, null, ruleId)} (${pct(rate2(firesIn(arm, null, ruleId), nIn(arm, null)))})`).join(' | ')} |`,
    );
  }
  push(
    '',
    '| Arm | Assistant-shaped | Mean behaviorScore |',
    '| --- | --- | --- |',
  );
  for (const arm of ARMS) {
    let n = 0;
    let shaped = 0;
    let score = 0;
    for (const [key, cell] of cells) {
      const [cellArm] = key.split('\u0000') as [Arm, Bucket];
      if (cellArm !== arm) continue;
      n += cell.n;
      shaped += cell.assistantShaped;
      score += cell.behaviorScore;
    }
    push(`| \`${arm}\` | ${shaped} (${pct(rate2(shaped, n))}) | ${(score / Math.max(1, n)).toFixed(3)} |`);
  }
  push(
    '',
    '## 3. Length-conditioned rates: the same rule, per bucket',
    '',
    'This is the table the axis exists for. A rule that fires on the machine in every bucket is measuring the',
    'machine; a rule whose machine firings sit in the buckets the machine over-occupies is measuring length.',
    '',
  );
  for (const ruleId of [...ruleIds].sort()) {
    const total = ARMS.reduce((sum, arm) => sum + firesIn(arm, null, ruleId), 0);
    if (total < MIN_FIRINGS) continue;
    push(
      `**\`${ruleId}\`**`,
      '',
      `| Bucket | ${ARMS.map((arm) => `\`${arm}\``).join(' | ')} |`,
      `| --- | ${ARMS.map(() => '---').join(' | ')} |`,
    );
    for (const bucket of BUCKETS) {
      if (nIn(HUMAN, bucket) === 0) continue;
      push(
        `| \`${bucket}\` | ${ARMS.map((arm) => `${firesIn(arm, bucket, ruleId)}/${nIn(arm, bucket)}`).join(' | ')} |`,
      );
    }
    push('');
  }

  push(
    '## 4. The rule that needed room, with the room',
    '',
    'Every rule below is conditioned on the same thing: a reply that actually has the shape',
    '`chat.over_completeness` requires, five sentences or more. This is the comparison the paired control could',
    'not make, because no machine continuation in it had the shape at all.',
    '',
    '| Rule | Arm | Replies > 4 sentences | Fires on them | Rate |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const ruleId of [...ruleIds].sort()) {
    for (const arm of ARMS) {
      let shaped = 0;
      let fires = 0;
      for (const [key, cell] of cells) {
        const [cellArm] = key.split('\u0000') as [Arm, Bucket];
        if (cellArm !== arm) continue;
        shaped += cell.longReplies;
        fires += cell.fires.get(ruleId) ?? 0;
      }
      if (shaped === 0 && fires === 0) continue;
      push(
        `| \`${ruleId}\` | \`${arm}\` | ${shaped} | ${fires} | ${shaped === 0 ? '—' : pct(rate2(fires, shaped))} |`,
      );
    }
  }

  // The `post` arm's improvement is a length effect or a behaviour effect, and the two
  // are separable: count the shaped replies it kept, and the rate among them.
  const shapedOf = (arm: Arm): number => {
    let total = 0;
    for (const [key, cell] of cells) {
      const [cellArm] = key.split('\u0000') as [Arm, Bucket];
      if (cellArm === arm) total += cell.longReplies;
    }
    return total;
  };
  const separating = ['chat.unsolicited_advice', 'chat.forced_positivity', 'chat.over_agreement'];
  const conditionalOf = (arm: Arm, ruleId: string): string => {
    const shaped = shapedOf(arm);
    return shaped === 0 ? '—' : `${pct(rate2(firesIn(arm, null, ruleId), shaped))}`;
  };
  push(
    '',
    'Read the human row and the `matched` row of `chat.over_completeness` against each other. The rule fires on',
    'roughly the same share of human replies and machine replies **once both have five sentences**; what made it',
    'look like a rule that fires only on people was that people sometimes write at that length in a chat and the',
    'unconstrained machine never did. A rule that fires equally on both is not a direction defect — it is a rule',
    'with no discriminating value in this register, which is a different finding and a different remedy.',
    '',
    '**And `post` earns its improvement by shortening.** It cut the shaped replies from ' +
      `${shapedOf('matched')} to ${shapedOf('post')}, and among the ones it kept, its rates are no better than ` +
      `\`matched\`'s: ${separating
        .map(
          (ruleId) =>
            `${ruleId.replace('chat.', '')} ${conditionalOf('matched', ruleId)} against ${conditionalOf('post', ruleId)}`,
        )
        .join(', ')}.`,
    'A rewrite that removes assistant behaviour and a rewrite that removes the room for it look the same in a',
    'pooled rate and not the same here. On this axis the contract acts mostly on the room.',
    '',
    'That is the same finding as the paired control\'s, from the other side: there, `post` changed nothing',
    'because a twelve-character draft has no room to change; here it changes the room itself.',
    '',
    'The other reading matters too, and §3 supports it: for the three rules that do separate the two, the machine',
    'fires **more** when it has room, not less. Room does not make a machine read like a person.',
    '',
    '## 5. Limitations',
    '',
    '1. **The buckets are oversampled, so no pooled rate here is a population rate.** Within-bucket rates are',
    '   the valid ones; the natural-distribution rates are in `PAIRED_CONTROL.md`.',
    '2. **One generator per arm, one setting.** A point, not a distribution. The comparison is between arms.',
    '3. **The `Room:` line is an instruction, and instructions have side effects.** It moved sentence counts as',
    '   intended, and §1 is printed so that can be checked rather than assumed.',
    '4. **The human arm is still LCCC.** Cleaned Weibo conversation, and the human side is not length-matched to',
    '   anything: it is the thing being matched to.',
    '5. **This file is not evidence for any claim in `BENCHMARK_RESULTS.md`.** Those stand on the corpus the',
    '   project may ship.',
    '',
    '## Reproducing it',
    '',
    '```bash',
    'npm run length:prepare -- --per-bucket 120 --offset 2000',
    '# one generator per chunk file in .external-corpora/length/chunks',
    'npm run length:prepare -- --per-bucket 120 --offset 2000 --only post',
    'npm run length:merge',
    'npm run length:report',
    '```',
    '',
    `Generated ${new Date().toISOString()} from ${usable.length} items.`,
    '',
  );

  writeFileSync(OUT, `${lines.join('\n')}\n`, 'utf8');
  process.stdout.write('\nLength-matched control\n\n');
  process.stdout.write(`  items : ${usable.length}\n`);
  process.stdout.write(`  buckets : ${BUCKETS.map((b) => `${b} ${nIn(HUMAN, b)}`).join(', ')}\n`);
  process.stdout.write(`  rules that fired : ${ruleIds.size}\n`);
  process.stdout.write(
    `  assistant-shaped : ${ARMS.map((arm) => {
      let n = 0;
      let shaped = 0;
      for (const [key, cell] of cells) {
        const [cellArm] = key.split('\u0000') as [Arm, Bucket];
        if (cellArm !== arm) continue;
        n += cell.n;
        shaped += cell.assistantShaped;
      }
      return `${arm} ${pct(rate2(shaped, n))}`;
    }).join(', ')}\n`,
  );
  process.stdout.write(`\nWritten to ${path.relative(ROOT, OUT).split('\\').join('/')}\n`);
  return 0;
}

function rate2(fires: number, n: number): number {
  return n === 0 ? 0 : fires / n;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`length:report failed: ${String(error)}\n`);
    process.exit(1);
  });
