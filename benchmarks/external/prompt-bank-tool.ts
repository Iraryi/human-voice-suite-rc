#!/usr/bin/env node
/**
 * `npm run bank:prepare` / `npm run bank:merge` / `npm run bank:report`
 *
 * Axis 2 of the coverage phase: **contexts LCCC does not contain**.
 *
 * ## Why a second set of prompts, when 2,600 LCCC contexts were already measured
 *
 * Because LCCC is one distribution. It is casual Weibo conversation, and most of what makes
 * an assistant an assistant — explaining, advising, summarising, reassuring, correcting,
 * structuring — is pulled out by situations that distribution rarely contains. A rule that
 * never fires on LCCC is not therefore a rule that never fires; it may be a rule that was
 * never asked.
 *
 * This is a **machine-behaviour stress test**, not a separation experiment. There is no
 * licence-clean human corpus for these situations, and writing one by hand would make the
 * result look like a human/machine comparison when it would only be a comparison with my
 * own idea of how a person answers.
 *
 * ## The arms
 *
 * The same three as the paired control, so the results sit beside each other: `plain`
 * unconstrained, `default` under the contract, `post` rewriting the plain answer.
 *
 * ## The boundary
 *
 * These prompts are original to this project and MIT. The machine replies derived from them
 * may be committed, because nothing in them comes from a corpus this project cannot ship —
 * which is why this experiment can be published in full where the paired control cannot.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createToolkit } from '../../src/dsh/tools/runtime.js';
import { buildBriefs } from './briefs.js';
import { PROVENANCE_LABEL, EXCEPTION_LABEL } from './labels.js';
import { MAX_REPLY, MIN_REPLY, isRefusal } from './reply-rules.js';
import { CATEGORIES, PROMPTS, categoryOf } from './prompt-bank.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DIR = path.join(ROOT, '.external-corpora', 'bank');
const CHUNKS = path.join(DIR, 'chunks');
const OUT = path.join(DIR, 'out');
const REPORT = path.join(HERE, 'PROMPT_BANK.md');

export const ARMS = ['plain', 'default', 'post'] as const;
export type Arm = (typeof ARMS)[number];

interface Chunk {
  readonly axis: 'prompt-bank';
  readonly arm: Arm;
  readonly category: string;
  readonly brief: string;
  readonly items: ReadonlyArray<{ readonly id: string; readonly conversation: string; readonly draft?: string }>;
  readonly outputFile: string;
}

function conversationFor(prompt: { context: string; userTurn: string }): string {
  return prompt.context.length > 0 ? `${prompt.context}\n${prompt.userTurn}` : prompt.userTurn;
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

async function prepare(options: { only: Arm | null }): Promise<number> {
  // 300 rather than the paired control's 120: a chat-sized ceiling would suppress the
  // long-form register this axis exists to observe. See the note in `briefs.ts`.
  const templates = await buildBriefs(ROOT, 300);
  mkdirSync(CHUNKS, { recursive: true });
  mkdirSync(OUT, { recursive: true });

  const drafts = existingAnswers('plain');
  const arms = options.only ? [options.only] : ARMS;
  let written = 0;
  const reused: Record<string, number> = {};

  for (const arm of arms) {
    const have = existingAnswers(arm);
    let relevant = PROMPTS.filter((prompt) => !have.has(prompt.id));
    if (arm === 'post') relevant = relevant.filter((prompt) => drafts.has(prompt.id));
    reused[arm] = PROMPTS.length - relevant.length;

    for (const category of CATEGORIES) {
      const slice = relevant.filter((prompt) => prompt.category === category.id);
      if (slice.length === 0) continue;
      const chunk: Chunk = {
        axis: 'prompt-bank',
        arm,
        category: `${category.id} — ${category.label}`,
        brief: templates[arm],
        items: slice.map((prompt) => ({
          id: prompt.id,
          conversation: conversationFor(prompt),
          ...(arm === 'post' ? { draft: drafts.get(prompt.id)! } : {}),
        })),
        outputFile: `.external-corpora/bank/out/${arm}-${category.id}.jsonl`,
      };
      writeFileSync(
        path.join(CHUNKS, `${arm}-${category.id}.json`),
        `${JSON.stringify(chunk, null, 1)}\n`,
        'utf8',
      );
      written += 1;
    }
  }

  process.stdout.write(
    `\nPrepared ${written} chunk(s) for ${PROMPTS.length} prompt(s) in ${CATEGORIES.length} categor(y|ies)${
      options.only ? ` (arm: ${options.only})` : ` x ${ARMS.length} arm(s)`
    }.\n` +
      `  chunks : ${path.relative(ROOT, CHUNKS).split('\\').join('/')}\n` +
      `  reused : ${arms.map((arm) => `${arm} ${reused[arm] ?? 0}`).join(', ')} already answered\n` +
      `  drafts : ${drafts.size} plain answer(s) available for post\n`,
  );
  return 0;
}

function merge(): number {
  const expected = new Set(PROMPTS.map((prompt) => prompt.id));
  const counts: Record<Arm, { accepted: number; missing: number; refused: number; bad: number }> = {
    plain: { accepted: 0, missing: 0, refused: 0, bad: 0 },
    default: { accepted: 0, missing: 0, refused: 0, bad: 0 },
    post: { accepted: 0, missing: 0, refused: 0, bad: 0 },
  };
  const rows: Array<{ id: string; arm: Arm; category: string; text: string }> = [];
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
      if (id.length === 0 || !expected.has(id)) {
        counts[arm].bad += 1;
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
      rows.push({ id, arm, category: categoryOf(id.split('-').slice(1, -1).join('-')).id, text });
      counts[arm].accepted += 1;
    }
  }

  for (const prompt of PROMPTS) {
    for (const arm of ARMS) if (!seen.has(`${arm}\u0000${prompt.id}`)) counts[arm].missing += 1;
  }

  writeFileSync(
    path.join(DIR, 'generated.jsonl'),
    `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`,
    'utf8',
  );
  writeFileSync(
    path.join(DIR, 'manifest.json'),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        axis: 'prompt-bank',
        prompts: PROMPTS.length,
        categories: CATEGORIES.length,
        arms: ARMS,
        licence: 'prompts original to this project, MIT; machine replies derived from them may be committed',
        provenance: PROVENANCE_LABEL,
        exception: EXCEPTION_LABEL,
        accepted: rows.length,
        perArm: counts,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  process.stdout.write('\nPrompt-bank merge\n\n');
  process.stdout.write(
    `  ${'arm'.padEnd(10)}${'accepted'.padStart(10)}${'missing'.padStart(9)}${'refused'.padStart(9)}${'rejected'.padStart(10)}\n`,
  );
  for (const arm of ARMS) {
    const row = counts[arm];
    process.stdout.write(
      `  ${arm.padEnd(10)}${String(row.accepted).padStart(10)}${String(row.missing).padStart(9)}${String(row.refused).padStart(9)}${String(row.bad).padStart(10)}\n`,
    );
  }
  return rows.length === 0 ? 1 : 0;
}

/**
 * What a reader noticed, and where.
 *
 * Counted by reading all 336 answers once, in the order they were generated. One reader,
 * one pass: these are observations and the counts are of the sample, not rates about the
 * world. Each one is a behaviour the suite has no rule for, or has a rule for that does
 * not watch this form — which is the distinction that decides what to do about it.
 */
const OBSERVATIONS: ReadonlyArray<{
  readonly shape: string;
  readonly where: string;
  readonly count: string;
  readonly watched: string;
}> = [
  {
    shape: 'fixer_reflex',
    where: 'A complaint is answered with a numbered plan of action — who to call, what to say, which complaint channel to use.',
    count: '`complains` `plain` 8/8, `default` 0/8',
    watched: '`chat.unsolicited_advice` caught 1 of the 8.',
  },
  {
    shape: 'complaint_restatement',
    where: 'The same complaint, said back in the complainer\'s voice with the feeling left in — joining rather than repairing.',
    count: '`complains` `default` 8/8',
    watched: 'Nothing. It is the shape the contract produces instead.',
  },
  {
    shape: 'reframe_then_question',
    where: 'Self-deprecation is answered with a diagnosis ("it is not that you are stupid, it is a missing prerequisite") and then an invitation to work on it.',
    count: '`self-deprecation` `plain` 8/8',
    watched: '`chat.forced_positivity` caught 1, and nothing watches the reframe.',
  },
  {
    shape: 'question_only_reply',
    where: 'The same situation answered with a question and nothing else ("why do you say that"). The contract\'s shape here.',
    count: '`self-deprecation` `default` 8/8',
    watched: 'Nothing, and on this reading it is the more human of the two.',
  },
  {
    shape: 'unrequested_addendum',
    where: 'An explanation ends with one more fact nobody asked for, marked as an aside ("by the way, at dusk…").',
    count: '`explain-concept` `plain` 3/8, `wrong-judgement` `plain` 2/8',
    watched: 'Nothing. `chat.over_completeness` needs the ratio, and an aside does not move it.',
  },
  {
    shape: 'provenance_claim',
    where: 'A correction arrives with a small history of the wrong belief — where it came from, what studies found.',
    count: '`wrong-judgement` `plain` 3/8',
    watched: 'Nothing.',
  },
  {
    shape: 'numeric_scaffold',
    where: 'Advice organised by count: three things to check, two questions to ask, the three parts that matter.',
    count: '`asks-advice` `plain` 5/8, `asks-decision` `plain` 4/8',
    watched: 'Nothing directly; the enumeration is prose, not formatting.',
  },
  {
    shape: 'compact_verdict',
    where: 'A decision answered in a clipped verdict with its reason attached ("hotpot." / "delete it. keeping it is for opening it again in a few days.").',
    count: '`asks-decision` `default` 3/8',
    watched: 'Nothing. This is the contract over-correcting in the other direction.',
  },
];

async function report(): Promise<number> {
  const file = path.join(DIR, 'generated.jsonl');
  if (!existsSync(file)) {
    process.stderr.write('No generated answers. Run `npm run bank:prepare` and `npm run bank:merge` first.\n');
    return 1;
  }
  const rows = readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { id: string; arm: Arm; category: string; text: string });
  const byPrompt = new Map<string, Partial<Record<Arm, string>>>();
  for (const row of rows) {
    const entry = byPrompt.get(row.id) ?? {};
    entry[row.arm] = row.text;
    byPrompt.set(row.id, entry);
  }

  const toolkit = await createToolkit({ projectRoot: ROOT });
  const fires = new Map<string, number>();
  const chars = new Map<string, number[]>();
  const sentences = new Map<string, number[]>();
  const shaped = new Map<string, number>();
  const counts = new Map<string, number>();
  const { splitSentences } = await import('../../src/shared/text.js');

  for (const prompt of PROMPTS) {
    const entry = byPrompt.get(prompt.id);
    if (entry === undefined) continue;
    for (const arm of ARMS) {
      const text = entry[arm];
      if (text === undefined) continue;
      const key = `${prompt.category}\u0000${arm}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      const scanned = await toolkit.scan({
        text,
        mode: 'chat',
        families: ['assistant'],
        conversation: { userTurn: prompt.userTurn },
      });
      for (const finding of scanned.canonicalFindings) {
        const id = finding.canonicalRuleId ?? finding.ruleId;
        const ruleKey = `${prompt.category}\u0000${arm}\u0000${id}`;
        fires.set(ruleKey, (fires.get(ruleKey) ?? 0) + 1);
      }
      const list = chars.get(key) ?? [];
      list.push(text.length);
      chars.set(key, list);
      const sentenceList = sentences.get(key) ?? [];
      sentenceList.push(splitSentences(text).length);
      sentences.set(key, sentenceList);
      if (scanned.scores.behaviorScore < 0.75) shaped.set(key, (shaped.get(key) ?? 0) + 1);
    }
  }

  const ruleIds = new Set<string>();
  for (const key of fires.keys()) ruleIds.add(key.split('\u0000')[2]!);
  const mean = (values: readonly number[]): number =>
    values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

  const lines: string[] = [];
  const push = (...text: string[]): void => {
    for (const line of text) lines.push(line);
  };
  const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

  push(
    '# Prompt bank: the situations LCCC does not contain',
    '',
    '<!-- Generated by `npm run bank:report`. Statistics only: no source text. -->',
    '',
    '```text',
    'prompts original to this project, MIT',
    'machine replies derived from them may be committed',
    '```',
    '',
    '## Why this exists',
    '',
    'LCCC is one distribution: casual Weibo conversation. The situations that pull assistant behaviour out of a',
    'model — being confided in, being asked to explain, being told something plainly wrong — are not most of what',
    'that distribution contains. A rule that never fires on LCCC is not therefore a rule that never fires.',
    '',
    '## What this is not',
    '',
    '**Not a human/machine separation experiment.** There is no licence-clean human corpus for these situations,',
    'and writing one by hand would compare the machine with my own idea of how a person answers. This is a',
    'machine-behaviour stress test: it shows which situations pull which behaviours out of a model, and which of',
    'those behaviours no rule covers.',
    '',
    '| | |',
    '| --- | --- |',
    `| Prompts | ${PROMPTS.length} |`,
    `| Categories | ${CATEGORIES.length} |`,
    `| Arms | ${ARMS.map((arm) => `\`${arm}\``).join(', ')} — the same three as the paired control |`,
    `| Rules that fired anywhere | ${ruleIds.size} |`,
    '',
    '## 1. Which situations pull which behaviour',
    '',
    `Firings per category, per arm. | ${CATEGORIES.length} categories x ${ARMS.length} arms |`,
    '',
    `| Category | Arm | Fires | Rules | Mean chars | Mean sentences | Assistant-shaped |`,
    `| --- | --- | --- | --- | --- | --- | --- |`,
  );
  for (const category of CATEGORIES) {
    for (const arm of ARMS) {
      const key = `${category.id}\u0000${arm}`;
      const n = counts.get(key) ?? 0;
      if (n === 0) continue;
      const fired = [...ruleIds].filter((ruleId) => (fires.get(`${key}\u0000${ruleId}`) ?? 0) > 0);
      const total = fired.reduce((sum, ruleId) => sum + (fires.get(`${key}\u0000${ruleId}`) ?? 0), 0);
      push(
        `| \`${category.id}\` | \`${arm}\` | ${total} | ${fired.length === 0 ? '—' : fired.map((id) => `\`${id}\``).join(', ')} | ` +
          `${mean(chars.get(key) ?? []).toFixed(1)} | ${mean(sentences.get(key) ?? []).toFixed(2)} | ` +
          `${shaped.get(key) ?? 0}/${n} |`,
      );
    }
  }
  push(
    '',
    '## 2. Every rule, by category and arm',
    '',
    `| Rule | Category | ${ARMS.map((arm) => `\`${arm}\``).join(' | ')} |`,
    `| --- | --- | ${ARMS.map(() => '---').join(' | ')} |`,
  );
  for (const ruleId of [...ruleIds].sort()) {
    for (const category of CATEGORIES) {
      const cells = ARMS.map((arm) => {
        const key = `${category.id}\u0000${arm}`;
        const n = counts.get(key) ?? 0;
        if (n === 0) return '—';
        return `${fires.get(`${key}\u0000${ruleId}`) ?? 0}/${n}`;
      });
      if (cells.every((cell) => cell === '—' || cell.startsWith('0/'))) continue;
      push(`| \`${ruleId}\` | \`${category.id}\` | ${cells.join(' | ')} |`);
    }
  }
  push(
    '',
    '## 3. Observations, not rules',
    '',
    'Counted by reading all 336 answers once. One reader, one pass: these are observations and the counts are of',
    'the sample, not rates about the world. Each is a behaviour the suite has no rule for, or has a rule for that',
    'does not watch this form — the distinction that decides what to do about it. No text is quoted; the answers',
    'are machine-written from prompts this project owns, but the report is counts either way.',
    '',
    '| Shape | Count | Already watched by |',
    '| --- | --- | --- |',
    ...OBSERVATIONS.map(
      (entry) => `| \`${entry.shape}\` — ${entry.where} | ${entry.count} | ${entry.watched} |`,
    ),
    '',
    'The largest of these is the one the suite is least equipped for. **A complaint is answered with a plan of',
    'action in every unconstrained reply and none of the contract ones**, and the rule whose whole job that is',
    'caught one of the eight, because it watches for a handful of phrases (`建议你`, `你可以试试`, `不妨`, `记得`,',
    '`最好是`) and a plan of action does not have to use any of them. That is not a rule that is wrong. It is a',
    'rule looking at one door in a wall.',
    '',
    'The second largest is the same finding from the other side: the contract does not remove the pull to repair,',
    'it changes what repair looks like — from fixing the problem to agreeing about it. Neither shape is watched,',
    'and only one of them is assistant-like. **A rule cannot be written for this pair without deciding which of',
    'the two is the tell**, which is a question about the product and not about the detector.',
    '',
    'Two smaller ones are worth noting because they are the opposite of a coverage gap. `unrequested_addendum`',
    'and `provenance_claim` are assistant behaviour by any reading — an aside nobody asked for, a small lecture',
    'attached to a correction — and `chat.over_completeness` does not move for them because it counts sentences',
    'against the user turn and these add one. A rule that watched the *addendum* rather than the length would',
    'catch them, and that rule does not exist.',
    '',
    '## 4. Limitations',
    '',
    '1. **Machine only.** No human arm exists for these situations, and this file will not pretend otherwise.',
    '2. **Eight prompts per category.** Enough to see which situations pull which behaviour, not enough for a',
    '   rate with an error bar.',
    '3. **One generator per arm.** A point, not a distribution.',
    '4. **The prompts are mine.** They were written to be typical of each situation, which is not the same as',
    '   being sampled from one.',
    '',
    '## Reproducing it',
    '',
    '```bash',
    'npm run bank:prepare',
    '# one generator per chunk file in .external-corpora/bank/chunks',
    'npm run bank:prepare -- --only post',
    'npm run bank:merge',
    'npm run bank:report',
    '```',
    '',
    `Generated ${new Date().toISOString()} from ${rows.length} answers.`,
    '',
  );

  writeFileSync(REPORT, `${lines.join('\n')}\n`, 'utf8');
  process.stdout.write('\nPrompt bank\n\n');
  process.stdout.write(`  prompts : ${PROMPTS.length} in ${CATEGORIES.length} categories\n`);
  process.stdout.write(`  answers : ${rows.length}\n`);
  process.stdout.write(`  rules that fired : ${ruleIds.size}\n`);
  process.stdout.write(`\nWritten to ${path.relative(ROOT, REPORT).split('\\').join('/')}\n`);
  return 0;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const onlyArg = argv.includes('--only') ? (argv[argv.indexOf('--only') + 1] ?? '') : '';
  const only = (ARMS as readonly string[]).includes(onlyArg) ? (onlyArg as Arm) : null;

  if (command === 'prepare') return prepare({ only });
  if (command === 'merge') return merge();
  if (command === 'report') return report();
  process.stdout.write(
    [
      'Usage: npm run bank:prepare [-- --only ARM] | npm run bank:merge | npm run bank:report',
      '',
      '  prepare   Write one chunk file per category and arm',
      '  merge     Validate and combine what the generators wrote',
      '  report    Render PROMPT_BANK.md',
      '',
      `  ${EXCEPTION_LABEL}`,
      '',
    ].join('\n'),
  );
  return command === undefined ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`prompt bank failed: ${String(error)}\n`);
    process.exit(1);
  });
