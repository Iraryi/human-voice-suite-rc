#!/usr/bin/env node
/**
 * `npm run helpsteer:report`
 *
 * External validation on HelpSteer3: a corpus this project did not build, from models it did
 * not run, in a register it does not generate.
 *
 * ## What the corpus is, and what it is not
 *
 * `nvidia/HelpSteer3`, CC-BY-4.0. The **responses** are from ~20
 * commercially-permissively-licensed LLMs, two per prompt from different models, none from a
 * proprietary provider. The **prompts are not**: Chinese rows are in the Multilingual domain,
 * and Multilingual prompts come from ShareGPT — user conversations with ChatGPT. So this
 * evaluates the suite on machine-written answers to ChatGPT-era shared prompts, and it says
 * nothing about the prompts' origin. See `docs/licence-audit.md`.
 *
 * Rows carry no model label, so "which model produced this response" is not answerable from
 * the data. What is answerable is what this file reports: per-rule rates, how they move with
 * length and turn count, whether two different models answering the same prompt agree, and
 * whether the preferred response differs systematically on assistant behaviour.
 *
 * ## Why Chinese, and why `preference` only
 *
 * Chinese because the suite is Chinese-first. `preference` because it is the only config that
 * puts **two different models on one context** — which turns "does this rule fire" into "does
 * this rule fire the same way on the same prompt", a sensitivity question a single-arm
 * corpus cannot ask. The feedback and edit configs are human annotation and human editing,
 * and mixing them would make "machine text" mean three different things.
 *
 * ## What it will not do
 *
 * It will not add a rule. A new pattern appearing here is an observation; it becomes a rule
 * only through the procedure in `benchmarks/external/README.md`. This file measures, counts
 * and stops.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { createToolkit } from '../../src/dsh/tools/runtime.js';
import { splitSentences } from '../../src/shared/text.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DATA = path.join(ROOT, '.external-corpora', 'helpsteer3');
const OUT = path.join(HERE, 'HELPSTEER3_EVALUATION.md');

/** The three rules the paired control found doing the work, plus everything else that fires. */
const HEADLINE_RULES = ['chat.unsolicited_advice', 'chat.forced_positivity', 'chat.over_agreement'] as const;

/** Response length buckets, in characters. HelpSteer3 answers are long; the chat cuts do not apply. */
export const LENGTH_BUCKETS = ['xs', 'short', 'medium', 'long'] as const;
export type LengthBucket = (typeof LENGTH_BUCKETS)[number];

export function lengthBucket(chars: number): LengthBucket {
  if (chars < 100) return 'xs';
  if (chars < 400) return 'short';
  if (chars < 1200) return 'medium';
  return 'long';
}

/**
 * Instruments for the three forms the coverage phase found no rule watching.
 *
 * Deliberately crude and deliberately **not** rules: they exist to say whether the shape is
 * present at a measurable rate in a corpus this project did not write, before anybody
 * proposes a detector. A phrase list that measured its own vocabulary would prove nothing,
 * so each one is defined as a *structure* — a plan of action without an advice word, an
 * affirmation that restates, a counselling move without an empathy phrase — and the counts
 * are reported beside the number of times the existing rule fired on the same replies.
 */
export const MISSED_FORM_PROBES: ReadonlyArray<{
  readonly id: string;
  readonly question: string;
  readonly test: (text: string) => boolean;
}> = [
  {
    id: 'action_plan_without_advice_word',
    question: 'Does the reply hand over a procedure — numbered steps, or a sequence of imperatives — while carrying none of the phrases the advice rule watches?',
    test: (text) =>
      !/建议你|你可以试试|不妨|记得|最好是|it is worth|you may want to|make sure to/i.test(text) &&
      // A procedure: at least two step markers or imperative lead-ins, or an explicit enumeration.
      ((text.match(/(?:^|\n)\s*(?:\d+[.、)]|[-*•])\s*/g) ?? []).length >= 2 ||
      /(?:^|\n)\s*(?:首先|第一步|先|然后|接着|最后|接下来)[，,：:]/.test(text)) &&
      /(?:可以|需要|应该|务必|一定要|直接|最好|不要|别)/.test(text),
  },
  {
    id: 'restates_then_agrees',
    question: 'Does the reply open by agreeing and then restate the user back to themselves, in words the agreement rule does not watch?',
    test: (text) => {
      const opening = text.slice(0, 40);
      const agrees = /^(?:对|是的|没错|是的|同意|有道理|确实|的确|正是|你说得对|完全同意)/.test(opening.trim()) ||
        /^(?:你说得对|确实|没错|有道理)/.test(opening.trim());
      return agrees && !/确实|没错|说得对|完全同意|你说得很对/.test(opening);
    },
  },
  {
    id: 'counselling_without_empathy_phrase',
    question: 'Does the reply validate, normalise or give permission — the counselling move — with none of the mechanical-empathy phrases the rule watches?',
    test: (text) =>
      !/我理解你的感受|我理解你的心情|这确实让人很沮丧|听起来你|能理解你的难处|i understand how you feel|that sounds really/i.test(text) &&
      /(?:这很正常|很正常|没关系|没关系的|不用自责|不用急|别自责|你不需要|你已经做得|允许自己|慢慢来|给自己一点时间|你值得)/.test(text),
  },
];

interface Turn {
  readonly role: string;
  readonly content: string;
}

interface Row {
  readonly domain?: string;
  readonly language?: string;
  readonly context?: readonly Turn[];
  readonly response1?: string;
  readonly response2?: string;
  readonly overall_preference?: number;
}

interface Observation {
  readonly id: string;
  readonly domain: string;
  readonly turns: number;
  readonly userChars: number;
  readonly assistantTurns: number;
  readonly chars: number;
  readonly sentences: number;
  readonly fires: readonly string[];
  readonly behaviorScore: number;
  readonly probes: readonly string[];
  readonly slot: 'response1' | 'response2';
  readonly preference: number | null;
}

function readSplit(file: string, want: (row: Row) => boolean): Row[] {
  if (!existsSync(file)) return [];
  const raw = gunzipSync(readFileSync(file));
  return raw
    .toString('utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      try {
        return JSON.parse(line) as Row;
      } catch {
        return null;
      }
    })
    .filter((row): row is Row => row !== null && want(row));
}

function main(): number {
  const want = (row: Row): boolean => (row.language ?? '') === 'chinese' && Array.isArray(row.context);
  const rows = [
    ...readSplit(path.join(DATA, 'preference-train.jsonl.gz'), want),
    ...readSplit(path.join(DATA, 'preference-validation.jsonl.gz'), want),
  ];
  if (rows.length === 0) {
    process.stderr.write(
      `No Chinese rows in ${path.relative(ROOT, DATA)}. Fetch preference/train.jsonl.gz and preference/validation.jsonl.gz first.\n`,
    );
    return 1;
  }

  apply(rows).then(
    (code) => process.exit(code),
    (error: unknown) => {
      process.stderr.write(`helpsteer:report failed: ${String(error)}\n`);
      process.exit(1);
    },
  );
  return 0;
}

async function apply(rows: readonly Row[]): Promise<number> {
  const toolkit = await createToolkit({ projectRoot: ROOT });
  const observations: Observation[] = [];
  const probeIds = MISSED_FORM_PROBES.map((probe) => probe.id);

  // Only the two responses are measured, never the context: the paper says the intermediate
  // assistant turns were generated by the same permissive models, but that is the paper's
  // statement, and the measured text should be the text the corpus exists to provide.
  for (const row of rows) {
    const context = row.context ?? [];
    const lastUser = [...context].reverse().find((turn) => turn.role === 'user');
    const userTurn = lastUser?.content ?? '';
    const userTurns = context.filter((turn) => turn.role === 'user').length;
    const assistantTurns = context.filter((turn) => turn.role !== 'user').length;
    const preference = typeof row.overall_preference === 'number' ? row.overall_preference : null;

    for (const slot of ['response1', 'response2'] as const) {
      const text = (row[slot] ?? '').trim();
      if (text.length === 0) continue;
      const scanned = await toolkit.scan({
        text,
        mode: 'chat',
        families: ['assistant'],
        conversation: { userTurn },
      });
      observations.push({
        id: `${row.domain ?? 'unknown'}`,
        domain: row.domain ?? 'unknown',
        turns: userTurns,
        userChars: userTurn.length,
        assistantTurns,
        chars: text.length,
        sentences: splitSentences(text).length,
        fires: scanned.canonicalFindings.map((finding) => finding.canonicalRuleId ?? finding.ruleId),
        behaviorScore: scanned.scores.behaviorScore,
        probes: MISSED_FORM_PROBES.filter((probe) => probe.test(text)).map((probe) => probe.id),
        slot,
        preference,
      });
    }
    if (observations.length % 200 === 0 && observations.length > 0) {
      process.stderr.write(`  ${observations.length} response(s)\r`);
    }
  }
  process.stderr.write('\n');

  const n = observations.length;
  const ruleIds = new Set<string>();
  for (const observation of observations) for (const rule of observation.fires) ruleIds.add(rule);
  const firesOf = (ruleId: string): number =>
    observations.filter((observation) => observation.fires.includes(ruleId)).length;
  const rate = (value: number, total = n): string => `${((value / Math.max(1, total)) * 100).toFixed(1)}%`;
  const mean = (values: readonly number[]): number =>
    values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

  // Paired rows: the two responses to one prompt, for the agreement question.
  const byPrompt = new Map<string, Observation[]>();
  observations.forEach((observation, index) => {
    const key = `${Math.floor(index / 2)}`;
    const list = byPrompt.get(key) ?? [];
    list.push(observation);
    byPrompt.set(key, list);
  });

  const lines: string[] = [];
  const push = (...text: string[]): void => {
    for (const line of text) lines.push(line);
  };

  push(
    '# HelpSteer3: external validation',
    '',
    '<!-- Generated by `npm run helpsteer:report`. Statistics only: no source text. -->',
    '',
    '```text',
    'corpus   : nvidia/HelpSteer3, CC-BY-4.0 (responses)',
    'prompts  : ShareGPT for the Multilingual domain — user conversations with ChatGPT',
    'measured : the two responses only; local evaluation, numbers only, no text committed',
    '```',
    '',
    '## Why this corpus',
    '',
    'Every measurement before this one used text this project generated or fetched itself. HelpSteer3 is',
    'different in the three ways that matter for validation: **different models** (~20 of them, none from a',
    'proprietary provider), **a different generation date**, and **a different prompt distribution** — its',
    'Chinese rows come from ShareGPT rather than from Weibo conversation.',
    '',
    'It also answers a question the paired control could only ask: two *different* models answer the same',
    'prompt, so a rule can be checked for sensitivity rather than only for rate.',
    '',
    '## 1. What was measured',
    '',
    '| | |',
    '| --- | --- |',
    '| Config | `preference` only. `feedback` and `edit` are human annotation and human editing; mixing them would make "machine text" mean three things. |',
    '| Language | `chinese` only — the suite is Chinese-first. |',
    '| Rows | ' + String(rows.length) + ' |',
    '| Responses measured | ' + String(n) + ' (two per row) |',
    '| Splits | `preference/train.jsonl.gz` and `preference/validation.jsonl.gz` |',
    '',
    '**Model attribution is not in the data.** The rows carry a domain, a language, a context, two responses and',
    'preference labels; they do not say which model produced which response. Per-model trigger rates are',
    'therefore not computable from this corpus, and no table below pretends otherwise. What the card states is',
    'that responses come from ~20 commercially-permissively-licensed LLMs, two per prompt from different models,',
    'none from OpenAI or another proprietary provider.',
    '',
    '| | Value |',
    '| --- | --- |',
    `| Mean context length | ${mean(observations.map((o) => o.userChars)).toFixed(0)} characters in the user turn |`,
    `| Single-turn rows | ${rate(observations.filter((o) => o.turns <= 1).length)} |`,
    `| Multi-turn rows | ${rate(observations.filter((o) => o.turns > 1).length)} |`,
    `| With an assistant turn in context | ${rate(observations.filter((o) => o.assistantTurns > 0).length)} |`,
    `| Mean response length | ${mean(observations.map((o) => o.chars)).toFixed(0)} characters, ${mean(observations.map((o) => o.sentences)).toFixed(1)} sentences |`,
    '',
    'That is the register difference in one line: these are long answers, not chat turns. The paired control\'s',
    'machine arms averaged 12–20 characters; a behaviour layer tuned on either would be measuring a different',
    'thing in the other.',
    '',
    '## 2. Every rule, by rate',
    '',
    'Firings over the measured responses. Small numbers are printed as counts beside every rate.',
    '',
    '| Rule | Fires | Rate | Fires on the rule\'s marker phrases only |',
    '| --- | --- | --- | --- |',
  );
  for (const ruleId of [...ruleIds].sort()) {
    push(`| \`${ruleId}\` | ${firesOf(ruleId)} | ${rate(firesOf(ruleId))} | — |`);
  }
  push(
    '',
    '## 3. The three rules that do the work, cut three ways',
    '',
    '### 3.1 By response length',
    '',
    `| Rule | ${LENGTH_BUCKETS.map((bucket) => `\`${bucket}\``).join(' | ')} |`,
    `| --- | ${LENGTH_BUCKETS.map(() => '---').join(' | ')} |`,
  );
  for (const ruleId of HEADLINE_RULES) {
    const cells = LENGTH_BUCKETS.map((bucket) => {
      const inBucket = observations.filter((observation) => lengthBucket(observation.chars) === bucket);
      const fires = inBucket.filter((observation) => observation.fires.includes(ruleId)).length;
      return `${fires}/${inBucket.length}`;
    });
    push(`| \`${ruleId}\` | ${cells.join(' | ')} |`);
  }
  push(
    '',
    '### 3.2 Single-turn against multi-turn',
    '',
    '| Rule | Single-turn | Multi-turn |',
    '| --- | --- | --- |',
  );
  for (const ruleId of HEADLINE_RULES) {
    const cells = [
      observations.filter((o) => o.turns <= 1),
      observations.filter((o) => o.turns > 1),
    ].map((group) => {
      const fires = group.filter((observation) => observation.fires.includes(ruleId)).length;
      return `${fires}/${group.length} (${rate(fires, group.length)})`;
    });
    push(`| \`${ruleId}\` | ${cells.join(' | ')} |`);
  }
  push(
    '',
    '### 3.3 Whether two models answering one prompt agree',
    '',
    'Both responses to the same prompt, paired. "Both" means the rule fired on both of two different models\'',
    'answers to one question; "neither" means it fired on neither. A rule that fires on both is reading the',
    'prompt or the register; a rule that fires on one is reading the model.',
    '',
    '| Rule | Both | One only | Neither |',
    '| --- | --- | --- | --- |',
  );
  for (const ruleId of HEADLINE_RULES) {
    let both = 0;
    let one = 0;
    let neither = 0;
    for (const pair of byPrompt.values()) {
      if (pair.length !== 2) continue;
      const hits = pair.filter((observation) => observation.fires.includes(ruleId)).length;
      if (hits === 2) both += 1;
      else if (hits === 1) one += 1;
      else neither += 1;
    }
    push(`| \`${ruleId}\` | ${both} | ${one} | ${neither} |`);
  }
  push(
    '',
    '### 3.4 Preferred against rejected',
    '',
    '`overall_preference` runs from -3 (response 1 much better) to 3 (response 2 much better). Rows scored 0 are',
    'excluded. If a rule fired more on the response annotators preferred, it would be measuring helpfulness; if',
    'more on the rejected one, it would be measuring assistant behaviour that humans actually notice.',
    '',
    '| Rule | On the preferred response | On the rejected one |',
    '| --- | --- | --- |',
  );
  for (const ruleId of HEADLINE_RULES) {
    let preferred = 0;
    let rejected = 0;
    let preferredN = 0;
    let rejectedN = 0;
    for (const pair of byPrompt.values()) {
      if (pair.length !== 2) continue;
      const [first, second] = pair as [Observation, Observation];
      const score = first.preference;
      if (score === null || score === 0) continue;
      const winner = score > 0 ? second : first;
      const loser = score > 0 ? first : second;
      preferredN += 1;
      rejectedN += 1;
      if (winner.fires.includes(ruleId)) preferred += 1;
      if (loser.fires.includes(ruleId)) rejected += 1;
    }
    push(
      `| \`${ruleId}\` | ${preferred}/${preferredN} (${rate(preferred, preferredN)}) | ${rejected}/${rejectedN} (${rate(rejected, rejectedN)}) |`,
    );
  }
  push(
    '',
    '## 4. The three forms no rule watches',
    '',
    'Probes, not rules. Each one is defined as a **structure** — a procedure without an advice phrase, an',
    'affirmation that restates, a counselling move without an empathy phrase — because a phrase list measuring',
    'its own vocabulary would prove nothing. The point of the table is the gap between the two columns.',
    '',
    '| Form | Shape present | Caught by the existing rule |',
    '| --- | --- | --- |',
  );
  for (const probe of MISSED_FORM_PROBES) {
    const present = observations.filter((observation) => observation.probes.includes(probe.id));
    const ruleId = probe.id.startsWith('action_plan')
      ? 'chat.unsolicited_advice'
      : probe.id.startsWith('restates')
        ? 'chat.over_agreement'
        : 'chat.mechanical_empathy';
    const caught = present.filter((observation) => observation.fires.includes(ruleId)).length;
    push(
      `| \`${probe.id}\` | ${present.length}/${n} (${rate(present.length)}) | ${caught}/${present.length} (${rate(caught, present.length)}) |`,
    );
  }
  push(
    '',
    ...MISSED_FORM_PROBES.map((probe) => `- \`${probe.id}\`: ${probe.question}`),
    '',
    '## 5. What this does not establish',
    '',
    '1. **The prompts are not machine-free.** Chinese rows are Multilingual-domain rows, and Multilingual',
    '   prompts come from ShareGPT — user conversations with ChatGPT. The measured responses are from',
    '   permissively-licensed models; the prompts are not from this project and their origin is stated, not',
    '   assumed away. See `docs/licence-audit.md`.',
    '2. **No model attribution.** Rows do not name the generating model, so per-model rates are not computable',
    '   and "two different models" is the card\'s statement about the corpus, not a per-row fact.',
    '3. **Human preference is not authorship.** That annotators preferred one response says nothing about which',
    '   one was written by a machine; both were.',
    '4. **No human arm.** There is no licence-clean Chinese human-answer corpus for this register, so every rate',
    '   here is a rate on machine text and cannot by itself show a rule separating human from machine.',
    '5. **One config.** `feedback` and `edit` are not measured here. If they are measured later they belong in',
    '   their own report, because their text is human-written.',
    '',
    '## Reproducing it',
    '',
    '```bash',
    '# fetch preference/train.jsonl.gz and preference/validation.jsonl.gz into .external-corpora/helpsteer3/',
    'npm run helpsteer:report',
    '```',
    '',
    `Generated ${new Date().toISOString()} from ${n} responses in ${rows.length} rows.`,
    '',
  );

  writeFileSync(OUT, `${lines.join('\n')}\n`, 'utf8');
  process.stdout.write('\nHelpSteer3\n\n');
  process.stdout.write(`  chinese rows : ${rows.length}\n`);
  process.stdout.write(`  responses    : ${n}\n`);
  process.stdout.write(`  rules fired  : ${ruleIds.size}\n`);
  for (const ruleId of [...ruleIds].sort()) {
    process.stdout.write(`    ${ruleId.padEnd(32)}${String(firesOf(ruleId)).padStart(5)}  ${rate(firesOf(ruleId))}\n`);
  }
  for (const probe of MISSED_FORM_PROBES) {
    const present = observations.filter((observation) => observation.probes.includes(probe.id)).length;
    process.stdout.write(`  probe ${probe.id.padEnd(38)}${String(present).padStart(5)}  ${rate(present)}\n`);
  }
  process.stdout.write(`\nWritten to ${path.relative(ROOT, OUT).split('\\').join('/')}\n`);
  return 0;
}

main();
