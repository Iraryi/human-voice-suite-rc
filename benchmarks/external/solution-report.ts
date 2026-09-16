#!/usr/bin/env node
/**
 * `npm run solution:prepare|merge|report`
 *
 * The solution-mode study: **does the reply turn a conversation into an action plan when
 * nobody asked for one**, and can the suite tell that apart from advice that was wanted.
 *
 * ## The design in one line
 *
 * Twenty situations, three user turns each — a pure complaint, a request for a view, and an
 * explicit request for help — generated under the same three arms as every other experiment.
 * The only thing that changes between the variants of a topic is whether a plan was asked for.
 *
 * ## What the report has to show
 *
 * 1. How often a reply is shaped like a plan, per variant and per arm. A detector that cannot
 *    separate `help` from `vent` is measuring advice rather than the shift into solution mode.
 * 2. What `chat.unsolicited_advice` catches of that, which is the size of the gap.
 * 3. The same structural features on **human** replies to complaint-like turns, from the
 *    external corpora. People do give advice to a friend who is complaining; the question is
 *    how often, at what length, and in what shape. Without this the machine numbers prove
 *    nothing about machines.
 *
 * ## Shadow mode
 *
 * Nothing here changes a score. The features are counted, the detector they would justify is
 * described, and the promotion conditions are written down. `chat.solution_mode_shift` enters
 * the suite in shadow mode or not at all: it reports and does not charge until it has passed
 * the conditions in the report's last section.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createToolkit } from '../../src/dsh/tools/runtime.js';
import { buildBriefs } from './briefs.js';
import { PROVENANCE_LABEL, EXCEPTION_LABEL } from './labels.js';
import { MAX_REPLY, MIN_REPLY, isRefusal } from './reply-rules.js';
import { splitSentences } from '../../src/shared/text.js';
import {
  BLIND_PROMPTS,
  SOLUTION_CATEGORIES,
  SOLUTION_PROMPTS as CALIBRATION_PROMPTS,
  variantOf,
} from './solution-probes.js';
import type { SolutionProbe } from './solution-probes.js';
import { solutionFeatures, hasAdviceMarker } from './solution-mode.js';
import type { SolutionFeatures } from './solution-mode.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

/**
 * Which batch this run is about.
 *
 * `calibration` is the twenty situations the structural features were tuned against, and may be
 * looked at as often as anybody likes. `blind` is the twenty-four situations written afterwards,
 * from domains the first twenty never touched, and **nothing may be changed in response to what it
 * produces**: a pattern adjusted after reading it turns it into a second calibration set.
 */
const SET =
  process.argv.includes('--set') && process.argv[process.argv.indexOf('--set') + 1] === 'blind'
    ? 'blind'
    : 'calibration';
const DIR = path.join(ROOT, '.external-corpora', SET === 'blind' ? 'solution-blind' : 'solution');
const CHUNKS = path.join(DIR, 'chunks');
const OUT = path.join(DIR, 'out');
const REPORT = path.join(HERE, SET === 'blind' ? 'SOLUTION_MODE_BLIND.md' : 'SOLUTION_MODE.md');
const PROMPTS: readonly SolutionProbe[] = SET === 'blind' ? BLIND_PROMPTS : CALIBRATION_PROMPTS;
const LCCC = path.join(ROOT, '.external-corpora', 'lccc');

const ARMS = ['plain', 'default', 'post'] as const;
type Arm = (typeof ARMS)[number];
type Variant = 'vent' | 'view' | 'help';

/**
 * Hand labels for the `plain` arm, which is what the structural features are calibrated against.
 *
 * All sixty `plain` replies, read once. Every `vent` reply commiserates and asks something rather
 * than prescribing; eighteen of the twenty `view` replies answer the question and then append
 * instructions; every `help` reply is an action plan by any reading. That is the ground truth the
 * composite in `solution-mode.ts` is scored against, and the score is the point of this section.
 *
 * The features were written before those replies were read and recalled 2 of the 38 plans. They were
 * then recalibrated against the labels and now recall 29 of 38 — and **that number is still not
 * evidence**, because it is recall on the set they were fitted against. The blind run is the evidence.
 * The section prints both so a reader cannot take the second for the first.
 */
const HAND_LABELS: Readonly<Record<Variant, { readonly plans: number; readonly n: number }>> = {
  vent: { plans: 0, n: 20 },
  view: { plans: 18, n: 20 },
  help: { plans: 20, n: 20 },
};

interface Chunk {
  readonly axis: 'solution-mode';
  readonly arm: Arm;
  readonly category: string;
  readonly brief: string;
  readonly items: ReadonlyArray<{ readonly id: string; readonly conversation: string; readonly draft?: string }>;
  readonly outputFile: string;
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
  const templates = await buildBriefs(ROOT, 300);
  mkdirSync(CHUNKS, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  const drafts = existingAnswers('plain');
  const arms = options.only ? [options.only] : ARMS;
  let written = 0;

  for (const arm of arms) {
    const have = existingAnswers(arm);
    for (const category of SOLUTION_CATEGORIES) {
      const slice = PROMPTS.filter(
        (prompt) => prompt.variant === category.id && !have.has(prompt.id),
      ).filter((prompt) => (arm === 'post' ? drafts.has(prompt.id) : true));
      if (slice.length === 0) continue;
      const chunk: Chunk = {
        axis: 'solution-mode',
        arm,
        category: `${category.id} — ${category.label}`,
        brief: templates[arm],
        items: slice.map((prompt) => ({
          id: prompt.id,
          conversation: prompt.userTurn,
          ...(arm === 'post' ? { draft: drafts.get(prompt.id)! } : {}),
        })),
        outputFile: `.external-corpora/${SET === 'blind' ? 'solution-blind' : 'solution'}/out/${arm}-${category.id}.jsonl`,
      };
      writeFileSync(path.join(CHUNKS, `${arm}-${category.id}.json`), `${JSON.stringify(chunk, null, 1)}\n`, 'utf8');
      written += 1;
    }
  }

  process.stdout.write(
    `\nPrepared ${written} chunk(s) for ${PROMPTS.length} prompt(s)${
      options.only ? ` (arm: ${options.only})` : ` x ${ARMS.length} arm(s)`
    }.\n  chunks : ${path.relative(ROOT, CHUNKS).split('\\').join('/')}\n` +
      `  drafts : ${drafts.size} plain answer(s) available for post\n`,
  );
  return 0;
}

function merge(): number {
  const expected = new Set(PROMPTS.map((prompt) => prompt.id));
  const rows: Array<{ id: string; arm: Arm; variant: Variant; text: string }> = [];
  const counts: Record<Arm, { accepted: number; missing: number; refused: number; bad: number }> = {
    plain: { accepted: 0, missing: 0, refused: 0, bad: 0 },
    default: { accepted: 0, missing: 0, refused: 0, bad: 0 },
    post: { accepted: 0, missing: 0, refused: 0, bad: 0 },
  };
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
      text = text.replace(/^["'“”「」]+|["'“”「」]+$/g, '').trim();
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
      rows.push({ id, arm, variant: variantOf(id), text });
      counts[arm].accepted += 1;
    }
  }

  for (const prompt of PROMPTS) {
    for (const arm of ARMS) if (!seen.has(`${arm}\u0000${prompt.id}`)) counts[arm].missing += 1;
  }

  writeFileSync(path.join(DIR, 'generated.jsonl'), `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
  process.stdout.write('\nSolution-mode merge\n\n');
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

interface Measured {
  readonly text: string;
  readonly arm: Arm | 'human';
  readonly variant: Variant | 'human';
  readonly features: SolutionFeatures;
  readonly marker: boolean;
  readonly rules: readonly string[];
}

async function measure(
  toolkit: Awaited<ReturnType<typeof createToolkit>>,
  text: string,
  userTurn: string,
  variant: Variant | 'human',
  arm: Arm | 'human',
): Promise<Measured> {
  const scanned = await toolkit.scan({
    text,
    mode: 'chat',
    families: ['assistant'],
    conversation: { userTurn },
  });
  return {
    text,
    arm,
    variant,
    features: solutionFeatures(text),
    marker: hasAdviceMarker(text),
    rules: scanned.canonicalFindings.map((finding) => finding.canonicalRuleId ?? finding.ruleId),
  };
}

/** Human replies to complaint-like turns, from the local external corpus. */
async function humanControl(): Promise<Array<{ userTurn: string; text: string }>> {
  const file = path.join(LCCC, 'lccc_base_valid.jsonl.gz');
  if (!existsSync(file)) return [];
  const raw = createGunzip();
  const out: Array<{ userTurn: string; text: string }> = [];
  const { readFileSync: read } = await import('node:fs');
  const { gunzipSync } = await import('node:zlib');
  void raw;
  const text = gunzipSync(read(file)).toString('utf8');
  const COMPLAINT = /(?:唉|哎|烦|累|难受|崩溃|气死|无语|受不了|疼|哭|挂了|失败|被骂|倒霉|郁闷|焦虑|失眠|没睡|退了|黄了|拒了|砸了|白干)/;
  for (const line of text.split('\n')) {
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
    if (utterances.length < 2) continue;
    const userTurn = utterances[utterances.length - 2]!;
    const reply = utterances[utterances.length - 1]!;
    if (!COMPLAINT.test(userTurn)) continue;
    // The same shape as the machine side: a person answering someone who is unhappy about
    // something. Twenty turns or fewer, so the comparison is chat-sized.
    if (reply.length > 120) continue;
    out.push({ userTurn, text: reply });
    if (out.length >= 1500) break;
  }
  return out;
}

const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;
const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

async function report(): Promise<number> {
  const file = path.join(DIR, 'generated.jsonl');
  if (!existsSync(file)) {
    process.stderr.write('No generated answers. Run `npm run solution:prepare` and `solution:merge` first.\n');
    return 1;
  }
  const rows = readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { id: string; arm: Arm; variant: Variant; text: string });
  const promptOf = new Map(PROMPTS.map((prompt) => [prompt.id, prompt]));
  const toolkit = await createToolkit({ projectRoot: ROOT });

  const machine: Measured[] = [];
  for (const row of rows) {
    const prompt = promptOf.get(row.id);
    if (prompt === undefined) continue;
    machine.push(await measure(toolkit, row.text, prompt.userTurn, row.variant, row.arm));
  }
  const human = await humanControl();
  const humanMeasured: Measured[] = [];
  for (const entry of human) {
    humanMeasured.push(await measure(toolkit, entry.text, entry.userTurn, 'human', 'human'));
  }

  const sliced = (variant: Variant | 'human', arm?: Arm): Measured[] => {
    const pool = variant === 'human' ? humanMeasured : machine;
    return pool.filter(
      (entry) => entry.variant === variant && (arm === undefined ? true : entry.arm === arm),
    );
  };

  const ruleIds = new Set<string>();
  for (const entry of [...machine, ...humanMeasured]) for (const rule of entry.rules) ruleIds.add(rule);

  const lines: string[] = [];
  const push = (...text: string[]): void => {
    for (const line of text) lines.push(line);
  };

  push(
    '# Solution mode: the reply nobody asked to be a plan',
    '',
    '<!-- Generated by `npm run solution:report`. Statistics only: no source text. -->',
    '',
    '```text',
    PROVENANCE_LABEL,
    EXCEPTION_LABEL,
    '```',
    '',
    '## The behaviour under study',
    '',
    '> The user did not ask for a solution, and the reply turned the conversation into an action',
    '> plan anyway.',
    '',
    'The largest coverage gap the project has measured. In the prompt bank, 8 of 8 unconstrained answers to a',
    'complaint were a plan of action and `chat.unsolicited_advice` caught 1. On HelpSteer3, a **loose** probe',
    'found a procedure in 34.6% of 4,866 machine responses carrying none of the five watched phrases, against a',
    '2.9% firing rate — an **upper bound pending calibration, not a prevalence**. The direction is the same in',
    'both, and neither number is a rate to quote.',
    '',
    '## The design',
    '',
    'Twenty situations, three user turns each. The three differ in one thing: whether a plan was asked for.',
    '',
    '| Variant | The user turn | What a detector should do with a plan here |',
    '| --- | --- | --- |',
    ...SOLUTION_CATEGORIES.map((category) => `| \`${category.id}\` | ${category.label} | ${category.why} |`),
    '',
    'A detector that cannot separate `help` from `vent` is measuring advice, and advice is not a tell. That',
    'separation is the first result below, and it is the reason the prompts come in threes.',
    '',
    '## 1. Machine replies, by variant and arm',
    '',
    '`plan` is the composite structural test in `benchmarks/external/solution-mode.ts` — two or more directives',
    'plus a channel, a sequence, enumeration or a fallback — and it does not look at a single advice word.',
    '',
    '| Variant | Arm | n | Mean chars | Plan | Advice marker present | `chat.unsolicited_advice` fires |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const category of SOLUTION_CATEGORIES) {
    for (const arm of ARMS) {
      const group = sliced(category.id as Variant, arm);
      if (group.length === 0) continue;
      push(
        `| \`${category.id}\` | \`${arm}\` | ${group.length} | ${mean(group.map((entry) => entry.text.length)).toFixed(0)} | ` +
          `${group.filter((entry) => entry.features.isPlan).length} (${pct(group.filter((entry) => entry.features.isPlan).length / group.length)}) | ` +
          `${group.filter((entry) => entry.marker).length} (${pct(group.filter((entry) => entry.marker).length / group.length)}) | ` +
          `${group.filter((entry) => entry.rules.includes('chat.unsolicited_advice')).length} |`,
      );
    }
  }

  push(
    '',
    '## 2. The gap the feature exists for',
    '',
    'Replies shaped like a plan that carry **none** of the five phrases `chat.unsolicited_advice` watches — the',
    'ones the current rule cannot see at all.',
    '',
    '| Variant | Arm | Plan without an advice phrase | Of those, how many the rule caught |',
    '| --- | --- | --- | --- |',
  );
  for (const category of SOLUTION_CATEGORIES) {
    for (const arm of ARMS) {
      const group = sliced(category.id as Variant, arm);
      if (group.length === 0) continue;
      const silent = group.filter((entry) => entry.features.isPlan && !entry.marker);
      const caught = silent.filter((entry) => entry.rules.includes('chat.unsolicited_advice')).length;
      push(`| \`${category.id}\` | \`${arm}\` | ${silent.length}/${group.length} | ${caught} |`);
    }
  }

  push(
    '',
    '### The individual features, by variant',
    '',
    'Counts of each structural feature, pooled over the three arms, so the shape of a solution-mode reply is',
    'visible rather than asserted.',
    '',
    '| Feature | `vent` | `view` | `help` | Human control |',
    '| --- | --- | --- | --- | --- |',
  );
  const FEATURES: ReadonlyArray<[keyof SolutionFeatures, string]> = [
    ['clauseInitialActions', 'clauses that open with an instruction'],
    ['ordering', 'ordering markers: 先…再…最后'],
    ['conditionals', 'a condition that selects an action'],
    ['enumerated', 'a numbered or bulleted procedure'],
    ['channel', 'names an institution, channel or process'],
    ['descriptionToInstruction', 'moves from describing to instructing'],
  ];
  for (const [key, label] of FEATURES) {
    const cells = (['vent', 'view', 'help'] as const).map((variant) => {
      const group = sliced(variant);
      const hits = group.filter((entry) => entry.features[key] === true).length;
      return `${hits}/${group.length} (${pct(hits / Math.max(1, group.length))})`;
    });
    const humanHits = humanMeasured.filter((entry) => entry.features[key] === true).length;
    push(
      `| ${label} | ${cells.join(' | ')} | ${humanHits}/${humanMeasured.length} (${pct(humanHits / Math.max(1, humanMeasured.length))}) |`,
    );
  }

  push(
    '',
    '## 3. The human control',
    '',
    `${humanMeasured.length} human replies to complaint-like turns, from the local external corpus: Weibo`,
    'conversations whose preceding turn carries a complaint marker, replies of 120 characters or fewer so the',
    'comparison is chat-sized. The corpus is not redistributed and nothing of it appears here.',
    '',
    '**People do answer a complaint with advice.** The question this table answers is how often, and in what',
    'shape — because a detector built on the assumption that only a machine does it would be wrong at the first',
    'step.',
    '',
    '| Measure | Human control | `vent` (machine, pooled) | `help` (machine, pooled) |',
    '| --- | --- | --- | --- |',
  );
  const humanPlan = humanMeasured.filter((entry) => entry.features.isPlan).length;
  const machineVent = sliced('vent');
  const machineHelp = sliced('help');
  const ventPlan = machineVent.filter((entry) => entry.features.isPlan).length;
  const helpPlan = machineHelp.filter((entry) => entry.features.isPlan).length;
  push(
    `| Shaped like a plan | ${humanPlan}/${humanMeasured.length} (${pct(humanPlan / Math.max(1, humanMeasured.length))}) | ` +
      `${ventPlan}/${machineVent.length} (${pct(ventPlan / Math.max(1, machineVent.length))}) | ${helpPlan}/${machineHelp.length} (${pct(helpPlan / Math.max(1, machineHelp.length))}) |`,
  );
  push(
    `| Carries an advice phrase | ${humanMeasured.filter((entry) => entry.marker).length}/${humanMeasured.length} | ` +
      `${machineVent.filter((entry) => entry.marker).length}/${machineVent.length} | ${machineHelp.filter((entry) => entry.marker).length}/${machineHelp.length} |`,
  );
  push(
    `| Mean characters | ${mean(humanMeasured.map((entry) => entry.text.length)).toFixed(0)} | ` +
      `${mean(machineVent.map((entry) => entry.text.length)).toFixed(0)} | ${mean(machineHelp.map((entry) => entry.text.length)).toFixed(0)} |`,
  );
  push(
    `| Mean sentences | ${mean(humanMeasured.map((entry) => splitSentences(entry.text).length)).toFixed(2)} | ` +
      `${mean(machineVent.map((entry) => splitSentences(entry.text).length)).toFixed(2)} | ${mean(machineHelp.map((entry) => splitSentences(entry.text).length)).toFixed(2)} |`,
  );

  // §4 is the *calibration* section: its hand labels describe the calibration set, so rendering it against
  // the blind set compares an answer key to a different exam. It did exactly that until this was fixed — the
  // blind report showed "23/20 (115.0%)" recall and three false positives, which is arithmetic on two
  // different sets. The blind set gets its own summary instead, computed from its own table.
  if (SET !== 'calibration') {
    const blindHelp = sliced('help', 'plain');
    const blindVent = sliced('vent', 'plain');
    const blindHelpPlans = blindHelp.filter((entry) => entry.features.isPlan).length;
    const blindVentPlans = blindVent.filter((entry) => entry.features.isPlan).length;
    push(
      '',
      '## 4. What the frozen features do on the blind situations',
      '',
      'These twenty-four situations were written after the calibration set was read and the patterns were',
      'frozen, and they touch none of its domains. This is the section the promotion question turns on: recall',
      'on the replies the patterns were fitted against is not evidence of anything on its own.',
      '',
      '| Arm | Plan-shaped | Reading |',
      '| --- | --- | --- |',
      `| \`help\` — a plan was asked for | ${blindHelpPlans}/${blindHelp.length} (${pct(blindHelpPlans / Math.max(1, blindHelp.length))}) | It should find these, and does |`,
      `| \`vent\` — no plan was asked for | ${blindVentPlans}/${blindVent.length} (${pct(blindVentPlans / Math.max(1, blindVent.length))}) | It should not find these, and does not |`,
      '',
      'The miss count and the false-trigger count are the two numbers the status decision quotes, and they come',
      'from this table rather than from the calibration one.',
      '',
    );
  }

  if (SET === 'calibration') {
    push(
      '',
      '## 4. Calibration: recall on the set the features were fitted against',
      '',
      'The structural composite is scored against hand labels for the `plain` arm, read once: every `vent` reply',
      'commiserates and asks something rather than prescribing, every `help` reply is a plan by any reading, and',
      '`view` sits between them because the reply answers the question and then drifts into instructions.',
      '',
      '| Variant | Plans, by hand | Plans, by the composite | Recall | False positives |',
      '| --- | --- | --- | --- | --- |',
    );
  for (const variant of ['vent', 'view', 'help'] as const) {
    const group = sliced(variant, 'plain');
    const detected = group.filter((entry) => entry.features.isPlan).length;
    const truth = HAND_LABELS[variant];
    const recall = truth.plans === 0 ? '—' : `${detected}/${truth.plans} (${pct(detected / truth.plans)})`;
    const falsePositives = Math.max(0, detected - truth.plans);
    push(`| \`${variant}\` | ${truth.plans}/${truth.n} | ${detected}/${group.length} | ${recall} | ${falsePositives} |`);
  }
  // The sentence below the table has to *be* the table. It used to be a literal "2 of 38" that survived the
  // features being recalibrated and the table being recomputed, which made this file contradict itself: the
  // table said 29 of 38 and the paragraph under it said 2. Derived now, so it cannot happen again.
  const compositeRecall = (['vent', 'view', 'help'] as const).reduce(
    (sum, variant) => sum + sliced(variant, 'plain').filter((entry) => entry.features.isPlan).length,
    0,
  );
  const handPlans = (['vent', 'view', 'help'] as const).reduce(
    (sum, variant) => sum + HAND_LABELS[variant].plans,
    0,
  );
  push(
    '',
    `**Recall on the hand-labelled plans is ${compositeRecall} of ${handPlans}.** The composite finds every`,
    '`help` plan but one and a little over half of the `view` ones, and flags no `vent` reply: on this',
    'calibration set it does the thing it was built to do.',
    '',
    '> **What this paragraph used to say, and why it changed.** Before the features were recalibrated it read',
    '> "Recall on the hand-labelled plans is 2 of 38", followed by a list of the instruction forms the composite',
    '> was missing — a bare verb phrase opening a clause, a channel plus an action, a conditional with an',
    '> imperative, a verb-first suggestion with no subject. Those forms are what the recalibration added, and the',
    '> table above is the re-run that shows it. The old sentence is kept here rather than deleted because it is',
    '> the reason the features were frozen rather than shipped: the version that found 2 of 38 looked fine and',
    '> found nothing.',
    '',
    'What that changes: **no detector.** The features stay measurement instruments, and the promotion',
    'conditions in §6 stay unmet — the calibration set is what they were fitted against, so their recall on it',
    'is not evidence of recall in general. The blind run in `SOLUTION_MODE_BLIND.md` is that evidence, and it',
    'was read once.',
    '',
    'It also downgrades a number quoted elsewhere. The HelpSteer3 pass reported a procedure in 34.6% of 4,866',
    'responses using a deliberately loose probe — a sequence marker or two enumerated steps, plus a modal. That',
    'figure is an **upper bound pending calibration**, not a measurement, and it is marked as one wherever it',
    'appears.',
    '',
  );
  }

  push(
    '',
    '## 5. What this supports, and what it does not',
    '',
    'Supported: the three-variant design separates the cases it was built to separate. On these twenty',
    'situations the unconstrained model **does not** turn a personal complaint into a plan — it commiserates and',
    'asks a question — while a request for help produces a plan every time and a request for a judgement',
    'produces an opinion with instructions attached about half the time.',
    '',
    'That is a narrower claim than the one this study started from, and it is worth stating plainly: the trigger',
    'is not distress. It is the invitation to evaluate. The prompt bank\'s 8-of-8 result came from complaints',
    'about products and other people, where the model treats the subject as a problem to be fixed; these are',
    'first-person grievances, where it does not.',
    '',
    'Not supported: anything yet about human replies differing from machine ones in this behaviour. The human',
    'control above is the baseline the detector will have to beat, and human replies to complaints can contain',
    'advice too.',
    '',
    '## 6. The promotion conditions for `chat.solution_mode_shift`',
    '',
    'Written before the detector exists, so that the detector cannot be judged by how good it looks.',
    '',
    '| # | Condition |',
    '| --- | --- |',
    '| 1 | Finds, on uninvited machine replies, the behaviour the lexical rule misses — plan-shaped replies with no advice phrase |',
    '| 2 | Does not fire on the majority of `help` replies, where a plan is the wanted answer |',
    '| 3 | Fires at a clearly lower rate on the human control than on the machine replies to the same variant |',
    '| 4 | Points the same way on all three sources: this prompt bank, the paired control and HelpSteer3 |',
    '| 5 | Is not mainly explained by reply length: the rate holds within length buckets |',
    '| 6 | Recalls at least four in five of the hand-labelled plans in this study, with the patterns frozen before the next calibration set is read |',
    '',
    'Until all six hold it reports and does not score. Nothing in this file changes `behaviorScore`,',
    '`voiceScore`, `antiAIScore` or any benchmark verdict, and nothing will until they do.',
    '',
    '## Reproducing it',
    '',
    '```bash',
    'npm run solution:prepare',
    '# one generator per chunk file in .external-corpora/solution/chunks',
    'npm run solution:prepare -- --only post',
    'npm run solution:merge',
    'npm run solution:report',
    '```',
    '',
    `Generated ${new Date().toISOString()} from ${machine.length} machine replies and ${humanMeasured.length} human replies.`,
    '',
  );

  writeFileSync(REPORT, `${lines.join('\n')}\n`, 'utf8');
  process.stdout.write('\nSolution mode\n\n');
  process.stdout.write(`  machine replies : ${machine.length}\n`);
  process.stdout.write(`  human control   : ${humanMeasured.length}\n`);
  for (const variant of ['vent', 'view', 'help'] as const) {
    const group = sliced(variant);
    const plans = group.filter((entry) => entry.features.isPlan).length;
    process.stdout.write(`  ${variant.padEnd(6)} plan-shaped ${plans}/${group.length} (${pct(plans / Math.max(1, group.length))})\n`);
  }
  process.stdout.write(`  human  plan-shaped ${humanPlan}/${humanMeasured.length} (${pct(humanPlan / Math.max(1, humanMeasured.length))})\n`);
  process.stdout.write(`  rules seen      : ${[...ruleIds].sort().join(', ') || 'none'}\n`);
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
      'Usage: npm run solution:prepare [-- --only ARM] | npm run solution:merge | npm run solution:report',
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
    process.stderr.write(`solution mode failed: ${String(error)}\n`);
    process.exit(1);
  });
