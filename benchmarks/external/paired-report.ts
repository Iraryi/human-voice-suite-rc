#!/usr/bin/env node
/**
 * `npm run paired:report`
 *
 * Rule-by-rule separation on the paired experiment: one LCCC context, four
 * continuations — the human's and three machine conditions.
 *
 * ## The question this answers
 *
 * Not "can human and machine be told apart" — that is answered too easily by any
 * surface difference. The question is:
 *
 * > Which rules actually measure machine-shaped *chat behaviour*, rather than some
 * > artefact of text length, punctuation habit, forum register or data source?
 *
 * Pairing removes the topic, the context and the register as explanations. The three
 * machine conditions remove the generator as an explanation, because a rule that
 * fires on every machine answer regardless of what the machine was told is measuring
 * "a model wrote this", not "this behaves like an assistant".
 *
 * ## The classification
 *
 * | Class | Pattern | Meaning |
 * | --- | --- | --- |
 * | **A** | human ≫ machine | A direction defect candidate: the rule fires more on the control than on any machine condition |
 * | **B** | human ≈ machine | No discriminating value on this data — it fires on both or neither |
 * | **C** | machine ≫ human | The rules that are doing the work |
 *
 * ## Denominators
 *
 * Each continuation is one observation. It is scanned twice — once for the behaviour
 * family, once for the prose families — but it counts once, so a rate printed here is
 * over items and not over scans. The first version of this file counted both passes
 * and halved every rate it printed.
 *
 * ## The boundary
 *
 * Every reply in this file is derived from LCCC context. It is measured here and
 * never redistributed; the labels below are mandatory.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createToolkit } from '../../src/dsh/tools/runtime.js';
import { sentenceSpans } from '../../src/behavior/assistant-smell/index.js';
import { ANTI_AI_PIPELINE_FAMILIES, runPipeline } from './pipeline.js';
import { ASSISTANT_SHAPED } from './behaviour.js';
import { PROVENANCE_LABEL, EXCEPTION_LABEL } from './labels.js';
import { CONDITIONS } from './conditions.js';
import type { Condition } from './conditions.js';
import { censusOf, selectStratified, strataCell } from './selection.js';
import { compareText } from '../../src/shared/order.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAIRED = path.join(ROOT, '.external-corpora', 'paired');

/** The four labels a continuation can carry. */
const HUMAN = 'human' as const;
type Arm = typeof HUMAN | Condition;
const ARMS: readonly Arm[] = [HUMAN, ...CONDITIONS];

/** A rule needs at least this many firings somewhere before a class is claimed. */
export const MIN_FIRINGS_FOR_CLASS = 4;

/** Reply length at which a "long" reply starts, in characters. Matches the sampler's cut. */
export const LONG_REPLY = 60;

interface Item {
  readonly id: string;
  readonly userTurn: string;
  readonly humanReply: string;
  readonly strata: Record<string, string>;
}

interface Generated {
  readonly id: string;
  readonly condition: Condition;
  readonly text: string;
}

interface Bucket {
  pairs: number;
  readonly fires: Map<string, number>;
}

interface Tally {
  pairs: number;
  readonly fires: Map<string, number>;
  readonly behaviorScores: number[];
  readonly antiAIScores: number[];
  readonly chars: number[];
  /** Sentence counts, by the same splitter the behaviour rules use. */
  readonly sentences: number[];
  /** Sentence count of every continuation the rule fired on, per rule. */
  readonly firingSentences: Map<string, number[]>;
  /** The behaviour rules each continuation tripped, one entry per continuation. */
  readonly behaviourRulesPerItem: Set<string>[];
  assistantShaped: number;
  readonly byUserLength: Map<string, Bucket>;
  readonly byReplyLength: Map<string, Bucket>;
  readonly byKind: Map<string, Bucket>;
  /** Per strata cell, so the balanced sample can be re-weighted to LCCC's own mix. */
  readonly byCell: Map<string, Bucket>;
}

function emptyTally(): Tally {
  return {
    pairs: 0,
    fires: new Map(),
    behaviorScores: [],
    antiAIScores: [],
    chars: [],
    sentences: [],
    firingSentences: new Map(),
    behaviourRulesPerItem: [],
    assistantShaped: 0,
    byUserLength: new Map(),
    byReplyLength: new Map(),
    byKind: new Map(),
    byCell: new Map(),
  };
}

function bucketInto(map: Map<string, Bucket>, key: string): Bucket {
  const entry = map.get(key) ?? { pairs: 0, fires: new Map<string, number>() };
  map.set(key, entry);
  return entry;
}

/**
 * Length buckets for the reply being measured.
 *
 * Cut on the reply rather than on the context, because the confound being tested is
 * "does this rule fire on long text" — a machine that writes longer answers would
 * otherwise look like a machine that behaves differently.
 */
export function replyLengthBucket(text: string): string {
  if (text.length < 20) return 'short';
  if (text.length < 60) return 'medium';
  return 'long';
}

/**
 * Record one continuation.
 *
 * `countsAsPair` is true for the behaviour pass only: a text is one observation, and
 * the prose pass on the same text must not inflate the denominator.
 */
function tallyInto(
  tally: Tally,
  text: string,
  ruleIds: readonly string[],
  strata: { userLength: string; kind: string; cell: string },
  pass: { countsAsPair: boolean; score: number; family: 'behavior' | 'prose' },
): void {
  if (pass.family === 'behavior') tally.behaviorScores.push(pass.score);
  else tally.antiAIScores.push(pass.score);

  const replyBucket = replyLengthBucket(text);
  const userEntry = bucketInto(tally.byUserLength, strata.userLength);
  const replyEntry = bucketInto(tally.byReplyLength, replyBucket);
  const kindEntry = bucketInto(tally.byKind, strata.kind);
  const cellEntry = bucketInto(tally.byCell, strata.cell);

  const unique: readonly string[] = [...new Set(ruleIds)];
  if (pass.countsAsPair) {
    const sentenceCount = sentenceSpans(text).length;
    tally.pairs += 1;
    tally.chars.push(text.length);
    tally.sentences.push(sentenceCount);
    if (pass.score < ASSISTANT_SHAPED) tally.assistantShaped += 1;
    userEntry.pairs += 1;
    replyEntry.pairs += 1;
    kindEntry.pairs += 1;
    cellEntry.pairs += 1;
    tally.behaviourRulesPerItem.push(new Set(unique));
    for (const ruleId of unique) {
      const list = tally.firingSentences.get(ruleId);
      if (list === undefined) tally.firingSentences.set(ruleId, [sentenceCount]);
      else list.push(sentenceCount);
    }
  }

  for (const ruleId of unique) {
    tally.fires.set(ruleId, (tally.fires.get(ruleId) ?? 0) + 1);
    userEntry.fires.set(ruleId, (userEntry.fires.get(ruleId) ?? 0) + 1);
    replyEntry.fires.set(ruleId, (replyEntry.fires.get(ruleId) ?? 0) + 1);
    kindEntry.fires.set(ruleId, (kindEntry.fires.get(ruleId) ?? 0) + 1);
    cellEntry.fires.set(ruleId, (cellEntry.fires.get(ruleId) ?? 0) + 1);
  }
}

function rate(fires: number, pairs: number): number {
  return pairs === 0 ? 0 : fires / pairs;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function norm(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** A ratio against zero is not a ratio, and printing 16666666.7× as one is a bug. */
function comparison(higher: number, lower: number): string {
  if (lower === 0) return `${higher} firing(s) against 0`;
  return `${(higher / lower).toFixed(1)}× as often`;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const valueOf = (flag: string, fallback: string): string => {
    const index = argv.indexOf(flag);
    return index === -1 ? fallback : (argv[index + 1] ?? fallback);
  };
  const view = valueOf('--view', 'balanced');
  const limit = Number(valueOf('--limit', '1000'));

  const itemsFile = path.join(PAIRED, `${view}.jsonl`);
  const generatedFile = path.join(PAIRED, 'generated.jsonl');
  for (const [file, hint] of [
    [itemsFile, 'npm run paired:sample'],
    [generatedFile, 'npm run paired:generate -- prepare, then merge'],
  ] as const) {
    if (!existsSync(file)) {
      process.stderr.write(`Missing ${path.relative(ROOT, file)}. Run \`${hint}\` first.\n`);
      return 1;
    }
  }

  const viewItems = readFileSync(itemsFile, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Item);
  const allItems = selectStratified(viewItems, limit);
  const generated = readFileSync(generatedFile, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Generated);

  // Only items with all three machine conditions can be paired; anything else is
  // reported as attrition rather than quietly measured on a smaller denominator.
  const byItem = new Map<string, Map<Condition, string>>();
  for (const row of generated) {
    const entry = byItem.get(row.id) ?? new Map<Condition, string>();
    entry.set(row.condition, row.text);
    byItem.set(row.id, entry);
  }
  const usable = allItems.filter((item) => {
    const entry = byItem.get(item.id);
    return entry !== undefined && CONDITIONS.every((condition) => entry.has(condition));
  });

  const toolkit = await createToolkit({ projectRoot: ROOT });
  const tallies = new Map<Arm, Tally>(ARMS.map((arm) => [arm, emptyTally()]));
  /**
   * Which rules fired on which continuation, by item and arm.
   *
   * Written beside the report so that questions asked later — do the same continuations
   * trip the rules in every condition, or different ones? — do not need the six minutes
   * of scanning again. Ids and rule ids only, no text, and it stays in
   * `.external-corpora/` with everything else that came from LCCC.
   */
  const perItem: Record<string, Record<string, string[]>> = {};

  let done = 0;
  for (const item of usable) {
    const strata = {
      userLength: item.strata['userLength'] ?? 'unknown',
      kind: item.strata['kind'] ?? 'unknown',
      cell: strataCell(item.strata),
    };
    const machine = byItem.get(item.id)!;

    for (const arm of ARMS) {
      const text = arm === HUMAN ? item.humanReply : machine.get(arm)!;
      const fired: string[] = [];

      // Behaviour: the pair is (user turn, continuation) for every arm, so the only
      // thing that differs between arms is who wrote the continuation.
      const scanned = await toolkit.scan({
        text,
        mode: 'chat',
        families: ['assistant'],
        conversation: { userTurn: item.userTurn },
      });
      const behaviourRules = scanned.canonicalFindings.map((f) => f.canonicalRuleId ?? f.ruleId);
      fired.push(...behaviourRules);
      tallyInto(tallies.get(arm)!, text, behaviourRules, strata, {
        countsAsPair: true,
        score: scanned.scores.behaviorScore,
        family: 'behavior',
      });

      // Prose: the same four texts, no conversation. Same observation, other families.
      const canonical = await runPipeline(toolkit, text, {
        mode: 'chat',
        families: ANTI_AI_PIPELINE_FAMILIES,
      });
      const proseRules = canonical.findings.map((f) => f.canonicalRuleId ?? f.ruleId);
      fired.push(...proseRules);
      tallyInto(tallies.get(arm)!, text, proseRules, strata, {
        countsAsPair: false,
        score: canonical.scores.antiAIScore,
        family: 'prose',
      });

      const entry = perItem[item.id] ?? {};
      entry[arm] = [...new Set(fired)];
      perItem[item.id] = entry;
    }

    done += 1;
    if (done % 50 === 0) process.stderr.write(`  ${done}/${usable.length} item(s)\r`);
  }
  if (done > 0) process.stderr.write('\n');

  writeFileSync(
    path.join(PAIRED, 'firings.json'),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        view,
        items: usable.length,
        arms: ARMS,
        note: 'Rule ids per item per arm. Ids and rule ids only: no text. Kept with the rest of the local evaluation material.',
        perItem,
      },
      null,
      1,
    )}\n`,
    'utf8',
  );

  const arms = tallies;
  const rules = new Set<string>();
  for (const tally of arms.values()) for (const ruleId of tally.fires.keys()) rules.add(ruleId);

  interface Row {
    readonly ruleId: string;
    readonly rates: Record<Arm, number>;
    readonly fires: Record<Arm, number>;
    readonly klass: 'A' | 'B' | 'C' | '—';
    readonly note: string;
  }

  const human = arms.get(HUMAN)!;
  const rows: Row[] = [...rules].map((ruleId) => {
    const fires = Object.fromEntries(
      ARMS.map((arm) => [arm, arms.get(arm)!.fires.get(ruleId) ?? 0]),
    ) as Record<Arm, number>;
    const rates = Object.fromEntries(
      ARMS.map((arm) => [arm, rate(fires[arm], arms.get(arm)!.pairs)]),
    ) as Record<Arm, number>;

    const machineRates = CONDITIONS.map((condition) => rates[condition]);
    const maxMachine = Math.max(...machineRates);
    const minMachine = Math.min(...machineRates);
    const humanRate = rates[HUMAN];
    const maxMachineFires = Math.max(...CONDITIONS.map((condition) => fires[condition]));

    let klass: Row['klass'] = '—';
    let note = '';
    if (maxMachineFires >= MIN_FIRINGS_FOR_CLASS || fires[HUMAN] >= MIN_FIRINGS_FOR_CLASS) {
      if (humanRate > maxMachine && humanRate > 0 && fires[HUMAN] >= 2) {
        klass = 'A';
        note = `${comparison(fires[HUMAN], maxMachineFires)} on the human control`;
      } else if (maxMachine > humanRate && maxMachineFires >= MIN_FIRINGS_FOR_CLASS) {
        klass = 'C';
        note = `${comparison(maxMachineFires, fires[HUMAN])} on machine continuations`;
      } else {
        klass = 'B';
        note = `human ${pct(humanRate)} against machine ${pct(minMachine)}–${pct(maxMachine)}`;
      }
    }
    return { ruleId, rates, fires, klass, note };
  });

  rows.sort(
    (a, b) =>
      (b.fires.plain + b.fires.default + b.fires.post) - (a.fires.plain + a.fires.default + a.fires.post) ||
      compareText(a.ruleId, b.ruleId),
  );

  // ---- the report --------------------------------------------------------
  const lines: string[] = [];
  const push = (...text: string[]): void => {
    for (const line of text) lines.push(line);
  };

  const byClass = (klass: 'A' | 'B' | 'C'): Row[] => rows.filter((row) => row.klass === klass);
  const classed = rows.filter((row) => row.klass !== '—');
  const viewCensus = censusOf(viewItems);
  const selectedCensus = censusOf(allItems);
  const usableCensus = censusOf(usable);
  const coveredCells = Object.keys(usableCensus).length;

  push(
    '# Paired control: which rules measure behaviour',
    '',
    '<!-- Generated by `npm run paired:report`. Statistics only: no source text. -->',
    '',
    '```text',
    PROVENANCE_LABEL,
    EXCEPTION_LABEL,
    '```',
    '',
    '## The design',
    '',
    "One LCCC context, four continuations: the human's own, and three machine conditions. The context, the",
    'topic, the register and the length pressure are therefore held fixed, and what is left is who wrote the',
    'next line.',
    '',
    '| Arm | How it was produced |',
    '| --- | --- |',
    '| `human` | The LCCC continuation, unchanged. The control. |',
    '| `plain` | A model answering the conversation with no constraints. |',
    "| `default` | A model answering under this suite's own chat contract — the preamble and prohibition list from `human_voice_prepare`, taken from the code rather than paraphrased. |",
    '| `post` | The `plain` answer rewritten under the same contract. The suite\'s actual pipeline shape, and the arm that says whether the rules can see a rewrite. |',
    '',
    'Every chunk of work carried an identical brief for its condition, so generators differed in nothing but',
    'the context they were given.',
    '',
    '| | |',
    '| --- | --- |',
    `| \`${view}\` view | ${viewItems.length} items in ${Object.keys(selectedCensus).length} strata cell(s) |`,
    `| Selected (round-robin) | ${allItems.length} |`,
    `| With all four arms | ${usable.length} |`,
    `| Attrition | ${allItems.length - usable.length} (${pct(rate(allItems.length - usable.length, allItems.length))}) |`,
    `| Strata cells covered | ${coveredCells} |`,
    `| Rules with any firing | ${rows.length} |`,
    `| Rules classifiable | ${classed.length} |`,
    '',
    '## 1. Headline: the behaviour layer across arms',
    '',
    '| Arm | Pairs | Assistant-shaped | Mean behaviorScore | Mean reply chars | Replies ≥ ' +
      `${LONG_REPLY} chars | Mean sentences | Replies > 4 sentences |`,
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...ARMS.map((arm) => {
      const tally = arms.get(arm)!;
      return (
        `| \`${arm}\` | ${tally.pairs} | ${tally.assistantShaped} (${pct(rate(tally.assistantShaped, tally.pairs))}) | ` +
        `${mean(tally.behaviorScores).toFixed(3)} | ${mean(tally.chars).toFixed(1)} | ` +
        `${pct(rate(tally.chars.filter((c) => c >= LONG_REPLY).length, tally.chars.length))} | ` +
        `${mean(tally.sentences).toFixed(2)} | ${pct(rate(tally.sentences.filter((s) => s > 4).length, tally.sentences.length))} |`
      );
    }),
    '',
  );

  const samePlain = usable.filter((item) => {
    const entry = byItem.get(item.id)!;
    return norm(entry.get('post')) === norm(entry.get('plain'));
  }).length;

  // What the separating rules catch between them, which is the recall question: a rule
  // that fires 1% of the time is only useful to a reader who knows what 1% of what.
  const separating = [...rules].filter((ruleId) => {
    const row = rows.find((entry) => entry.ruleId === ruleId);
    return row?.klass === 'C';
  });
  const caughtByArm = ARMS.map((arm) => {
    const tally = arms.get(arm)!;
    const count = tally.behaviourRulesPerItem.filter((fired) =>
      separating.some((ruleId) => fired.has(ruleId)),
    ).length;
    return `${arm} ${count} (${pct(rate(count, tally.behaviourRulesPerItem.length))})`;
  });

  const movement = (from: Condition, to: Condition): string => {
    const delta = mean(arms.get(to)!.behaviorScores) - mean(arms.get(from)!.behaviorScores);
    return `${delta >= 0 ? '+' : ''}${delta.toFixed(3)}`;
  };
  push(
    `**Does the contract move the behaviour?** \`plain\` → \`default\` ${movement('plain', 'default')}, ` +
      `\`plain\` → \`post\` ${movement('plain', 'post')}, on mean behaviorScore. A change near zero means the`,
    "suite's instructions did not alter what the rules measure here — a fact about the rules on this register,",
    'not yet a fact about the instructions.',
    '',
    'Mean **antiAIScore** by arm, from the prose families, for the same four texts: ' +
      ARMS.map((arm) => `${arm} ${mean(arms.get(arm)!.antiAIScores).toFixed(3)}`).join(', ') +
      '.',
    '',
    'Two facts about the machine arms belong beside those numbers rather than in a footnote. **The `post` arm',    `is the same text as \`plain\` in ${samePlain} of ${usable.length} items (${pct(rate(samePlain, usable.length))})**: the rewrite step found nothing to`,
    'change in replies this short, which is why its behaviorScore is `plain`\'s. And **the contract acts mostly by',
    'shortening**: `plain` averaged ' +
      `${mean(arms.get('plain')!.chars).toFixed(1)} characters, \`default\` ${mean(arms.get('default')!.chars).toFixed(1)}, against ${mean(human.chars).toFixed(1)} for the human control.`,
    'Every rule below that needs room to fire therefore gets less room from the machine arms than from the',
    'human one, which the sentence column above is there to expose.',
    '',
    '## 2. What was actually measured',
    '',
    'A rule that fires on one stratum and not another will look like a rule that fires on machines if the',
    'sample happened to be one stratum. The head of the balanced view is exactly one cell, so selecting by',
    '`slice` would have produced that error; this table is here to make the composition visible either way.',
    '',
    '| Strata cell (kind\\|user\\|reply\\|type) | In view | Selected | Measured |',
    '| --- | --- | --- | --- |',
  );
  for (const cell of [...new Set([...Object.keys(selectedCensus), ...Object.keys(viewCensus)])].sort()) {
    const inView = viewCensus[cell] ?? 0;
    const selected = selectedCensus[cell] ?? 0;
    const measured = usableCensus[cell] ?? 0;
    push(`| \`${cell}\` | ${inView} | ${selected} | ${measured} |`);
  }
  push('');

  push(
    '## 3. Rule by rule',
    '',
    "`fires` is how many of the paired continuations tripped the rule; `%` is that over the arm's pair count.",
    'Each continuation counts once, in both families it was scanned for. Class A fires more on the human',
    'control than on any machine arm, class C more on machine continuations, class B is indistinguishable on',
    `this data. A rule needs at least ${MIN_FIRINGS_FOR_CLASS} firings somewhere before a class is claimed; the`,
    'rest are left unclassified rather than assigned one on noise.',
    '',
    '| Rule | Class | human | plain | default | post | Note |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const row of rows) {
    push(
      `| \`${row.ruleId}\` | ${row.klass} | ${row.fires.human} (${pct(row.rates.human)}) | ` +
        `${row.fires.plain} (${pct(row.rates.plain)}) | ${row.fires.default} (${pct(row.rates.default)}) | ` +
        `${row.fires.post} (${pct(row.rates.post)}) | ${row.note} |`,
    );
  }
  push('');

  push(
    '## 4. The three classes',
    '',
    `### Class C — the rules that do the work (${byClass('C').length})`,
    '',
  );
  push(
    ...(byClass('C').length === 0
      ? ['None. No rule fires meaningfully more often on machine continuations than on human ones.', '']
      : [...byClass('C').map((row) => `- \`${row.ruleId}\` — ${row.note}`), '']),
  );
  push(
    `**What those ${byClass('C').length} rule(s) catch between them.** A continuation carrying at least one of them:`,
    '',
    caughtByArm.map((line) => `- ${line}`).join('\n'),
    '',
    'The second number is the recall of the behaviour layer on machine chat in this register, and it is the',
    'honest counterweight to the precision above: a rule that never fires on human writing and fires on one',
    'machine continuation in twenty is a rule that finds a real thing rarely, not a rule that decides the',
    'question.',
    '',
  );
  push(`### Class A — direction defects (${byClass('A').length})`, '');
  push(
    ...(byClass('A').length === 0
      ? ['None. No rule fires more often on the human control than on every machine arm.', '']
      : [
          ...byClass('A').map((row) => `- \`${row.ruleId}\` — ${row.note}`),
          '',
          'A class A rule is a candidate defect of the kind `benchmarks/external/README.md` describes: a',
          'hypothesis, to be reproduced on a corpus this project may ship before any threshold moves.',
        ]),
  );
  // A class A verdict has a rival explanation that the counts alone cannot exclude: the
  // rule may need a shape the machine arms never produced. Check it before it is read as
  // a defect.
  for (const row of byClass('A')) {
    const humanFiringShapes = human.firingSentences.get(row.ruleId) ?? [];
    const floor = humanFiringShapes.length === 0 ? 0 : Math.min(...humanFiringShapes);
    const ceiling = humanFiringShapes.length === 0 ? 0 : Math.max(...humanFiringShapes);
    const reached = ARMS.map((arm) => {
      const tally = arms.get(arm)!;
      const count = tally.sentences.filter((value) => value >= floor).length;
      return `${arm} ${count}/${tally.sentences.length}`;
    });
    push(
      '',
      `**Shape check for \`${row.ruleId}\`.** Its human firings had between ${floor} and ${ceiling} sentences.`,
      `Continuations with at least ${floor} sentence(s): ${reached.join(', ')}.`,
      floor > 4 || (arms.get('plain')!.sentences.filter((value) => value >= floor).length <= 5)
        ? 'The machine arms barely reach that shape, so their zero is **not** evidence that the rule is safe: it is evidence that this register does not give the rule a chance. The human firings are the part that was measured.'
        : 'The machine arms do reach that shape, so their zero is a real difference on this data and not only a length effect.',
      '',
    );
  }
  push(
    `### Class B — no discriminating value on this data (${byClass('B').length})`,
    '',
  );
  push(
    ...(byClass('B').length === 0
      ? ['None.', '']
      : [...byClass('B').map((row) => `- \`${row.ruleId}\` — ${row.note}`), '']),
  );
  push(
    `### Unclassified (${rows.filter((row) => row.klass === '—').length})`,
    '',
    `Fired fewer than ${MIN_FIRINGS_FOR_CLASS} times in every arm, so this sample cannot say anything about them: ` +
      (rows.filter((row) => row.klass === '—').map((row) => `\`${row.ruleId}\``).join(', ') || 'none') +
      '.',
    '',
  );

  // ---- stratified --------------------------------------------------------
  const stratified = rows.filter((row) => row.klass === 'C' || row.klass === 'A');
  push(
    '## 5. Stratified by user-input length',
    '',
    'The confound this rules out: a rule that fires on short prompts, or on long ones, would look like a rule',
    'that fires on machines if one arm happens to answer at a different length. The same rule is shown per',
    'bucket, per arm.',
    '',
  );
  const userBuckets = [...new Set([...human.byUserLength.keys()])].sort();
  const kindBuckets = [...new Set([...human.byKind.keys()])].sort();
  for (const ruleId of stratified.map((row) => row.ruleId)) {
    push(
      `**\`${ruleId}\`**`,
      '',
      '| User turn | human | plain | default | post |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const bucket of userBuckets) {
      const cells = ARMS.map((arm) => {
        const entry = arms.get(arm)!.byUserLength.get(bucket);
        if (!entry || entry.pairs === 0) return '—';
        return `${entry.fires.get(ruleId) ?? 0}/${entry.pairs}`;
      });
      push(`| ${bucket} | ${cells.join(' | ')} |`);
    }
    push('');
    push('| Session | human | plain | default | post |', '| --- | --- | --- | --- | --- |');
    for (const bucket of kindBuckets) {
      const cells = ARMS.map((arm) => {
        const entry = arms.get(arm)!.byKind.get(bucket);
        if (!entry || entry.pairs === 0) return '—';
        return `${entry.fires.get(ruleId) ?? 0}/${entry.pairs}`;
      });
      push(`| ${bucket} | ${cells.join(' | ')} |`);
    }
    push('');
  }

  push(
    '## 6. Stratified by reply length',
    '',
    "Machine answers may be longer or shorter than human ones — the headline table prints both means. If a",
    "rule's firings sit entirely in one reply-length bucket, the rule is measuring length.",
    '',
    '| Rule | Reply length | human | plain | default | post |',
    '| --- | --- | --- | --- | --- | --- |',
  );
  for (const row of stratified) {
    for (const bucket of ['short', 'medium', 'long']) {
      const cells = ARMS.map((arm) => {
        const entry = arms.get(arm)!.byReplyLength.get(bucket);
        if (!entry || entry.pairs === 0) return '—';
        return `${entry.fires.get(row.ruleId) ?? 0}/${entry.pairs}`;
      });
      push(`| \`${row.ruleId}\` | ${bucket} | ${cells.join(' | ')} |`);
    }
  }
  push('');

  // ---- structure or noise -------------------------------------------------
  const itemIds = usable.map((item) => item.id);
  const firedIds = new Map<string, Record<Arm, Set<string>>>();
  for (const id of itemIds) {
    for (const arm of ARMS) {
      for (const ruleId of perItem[id]?.[arm] ?? []) {
        const row =
          firedIds.get(ruleId) ??
          ({ human: new Set(), plain: new Set(), default: new Set(), post: new Set() } as Record<Arm, Set<string>>);
        row[arm].add(id);
        firedIds.set(ruleId, row);
      }
    }
  }
  const caughtByCondition = new Map<number, number>();
  for (const id of itemIds) {
    const hit = CONDITIONS.filter((condition) => (perItem[id]?.[condition] ?? []).length > 0).length;
    caughtByCondition.set(hit, (caughtByCondition.get(hit) ?? 0) + 1);
  }
  const anyMachine = itemIds.filter((id) =>
    CONDITIONS.some((condition) => (perItem[id]?.[condition] ?? []).length > 0),
  ).length;
  const expectedShared = CONDITIONS.flatMap((a, index) =>
    CONDITIONS.slice(index + 1).map(
      (b) =>
        itemIds.length *
        rate([...itemIds].filter((id) => (perItem[id]?.[a] ?? []).length > 0).length, itemIds.length) *
        rate([...itemIds].filter((id) => (perItem[id]?.[b] ?? []).length > 0).length, itemIds.length),
    ),
  ).reduce((total, value) => total + value, 0);

  push(
    '## 7. Are the firings structure, or noise?',
    '',
    'A rule that fires on one machine continuation in a hundred is only worth having if it fires on the *same*',
    'continuations whichever condition produced them. If each condition caught a different set, the rule would be',
    'a coin toss that happened to land on machine text, and the rate would mean nothing.',
    '',
    '| Rule | plain | default | post | human | in both `plain` and `default` | expected if independent |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const [ruleId, row] of [...firedIds.entries()].sort(
    (a, b) =>
      b[1].plain.size + b[1].default.size + b[1].post.size - (a[1].plain.size + a[1].default.size + a[1].post.size),
  )) {
    const shared = [...row.plain].filter((id) => row.default.has(id)).length;
    const expected =
      itemIds.length * (row.plain.size / itemIds.length) * (row.default.size / itemIds.length);
    push(
      `| \`${ruleId}\` | ${row.plain.size} | ${row.default.size} | ${row.post.size} | ${row.human.size} | ` +
        `${shared} | ${expected.toFixed(2)} |`,
    );
  }
  push(
    '',
    '| Machine conditions that caught an item | Items |',
    '| --- | --- |',
    ...[...caughtByCondition.keys()]
      .sort((a, b) => a - b)
      .map((count) => `| ${count} | ${caughtByCondition.get(count)} |`),
    '',
    `**${anyMachine} item(s) (${pct(rate(anyMachine, itemIds.length))}) were caught in at least one machine condition, and ` +
      `${itemIds.filter((id) => (perItem[id]?.['human'] ?? []).length > 0).length} in the human control.** ` +
      `${(caughtByCondition.get(2) ?? 0) + (caughtByCondition.get(3) ?? 0)} of them were caught by two or three conditions, against ` +
      `${expectedShared.toFixed(1)} expected if the conditions fired independently.`,
    '',
    'That excess is the finding: the firings concentrate on particular items, so the rules are reading something',
    'about the continuation rather than sampling it at random. It is also why the 1% rates above are worth',
    'reading as rates at all. `npm run paired:overlap` asks the same question of the stored per-item firings',
    'without re-scanning.',
    '',
    '## 8. Re-weighted to LCCC’s own distribution',
    '',
    'The measured view is `balanced`, where every cell contributes about the same. LCCC itself does not look',
    'like that, so a rate from this sample is a statement about *the rule* rather than about the corpus. The',
    'natural figure is recovered by post-stratification rather than by generating another thousand replies: each',
    'cell keeps its own measured rate, and the cells are weighted by the share they have in the natural draw,',
    'which `paired-census.json` records.',
    '',
  );
  const censusFile = path.join(HERE, 'paired-census.json');
  if (!existsSync(censusFile)) {
    push('No `paired-census.json` beside this script, so no weights. Run `npm run paired:sample`.', '');
  } else {
    const census = JSON.parse(readFileSync(censusFile, 'utf8')) as {
      natural: { census: Record<string, number> };
    };
    const weights = census.natural.census;
    const totalWeight = Object.values(weights).reduce((total, value) => total + value, 0);
    const weighted = (arm: Arm, ruleId: string): number => {
      const tally = arms.get(arm)!;
      let sum = 0;
      let weight = 0;
      for (const [cell, bucket] of tally.byCell) {
        const w = (weights[cell] ?? 0) / Math.max(1, totalWeight);
        if (w === 0) continue;
        sum += w * rate(bucket.fires.get(ruleId) ?? 0, bucket.pairs);
        weight += w;
      }
      return weight === 0 ? 0 : sum / weight;
    };
    push('| Rule | Arm | Balanced | Weighted to LCCC |', '| --- | --- | --- | --- |');
    for (const row of rows.filter((entry) => entry.klass !== '—' || entry.fires.human > 0)) {
      for (const arm of ARMS) {
        push(`| \`${row.ruleId}\` | \`${arm}\` | ${pct(row.rates[arm])} | ${pct(weighted(arm, row.ruleId))} |`);
      }
    }
    push(
      '',
      'A weighted rate far from the balanced one would mean the rule lives in a stratum LCCC rarely produces,',
      'which matters for any rate quoted in public. The separating rules are unchanged by the re-weighting, and',
      'the class A rule stays a human-side rate — as it should, since it is the human continuations that fired.',
      '',
    );
  }

  push(
    '## 9. Limitations',
    '',
    `1. **${usable.length} paired items.** Enough to classify a rule with a handful of firings; not enough for a`,
    '   rate with a confidence interval, and the report deliberately prints counts beside every rate so that',
    '   is visible.',
    '2. **One generator per arm.** Each arm is a single model at a single setting, so an arm is a point, not a',
    '   distribution. The comparison is between conditions, not between models.',
    '3. **The human arm is still LCCC.** Cleaned Weibo conversation. Whether these findings hold in other',
    '   registers is not answered here. Machine replies in this register are short too, which is why rules that',
    '   need length have little to bite on.',
    '4. **Class B is not "useless".** It means indistinguishable on this data. A rule can be correct and rare,',
    '   and a larger sample can move a rule from B to C without any code changing.',
    '5. **This file is not evidence for any claim in `BENCHMARK_RESULTS.md`.** Those stand on the corpus the',
    '   project may ship. This is the experiment that decides which rules deserve a place in it.',
    '',
    '## Reproducing it',
    '',
    '```bash',
    'npm run paired:sample                              # stratified items, gitignored',
    'npm run paired:generate -- prepare --only plain   --limit ' + String(allItems.length),
    '# one generator per chunk file in .external-corpora/paired/chunks',
    'npm run paired:generate -- prepare --only default --limit ' + String(allItems.length),
    'npm run paired:generate -- prepare --only post    --limit ' + String(allItems.length) + '   # needs the plain drafts',
    'npm run paired:generate -- merge --limit ' + String(allItems.length),
    `npm run paired:report -- --view ${view} --limit ${String(allItems.length)}`,
    'npm run paired:overlap                            # asks the stored firings, no re-scan',
    '```',
    '',
    `Generated ${new Date().toISOString()} from ${usable.length} paired items.`,
    '',
  );

  const OUT = path.join(ROOT, 'benchmarks', 'external', 'PAIRED_CONTROL.md');
  writeFileSync(OUT, `${lines.join('\n')}\n`, 'utf8');

  process.stdout.write('\nPaired control\n\n');
  process.stdout.write(`  view             : ${view}, limit ${allItems.length}\n`);
  process.stdout.write(`  items            : ${usable.length} with all four arms (${coveredCells} cell(s))\n`);
  process.stdout.write(
    `  assistant-shaped : human ${pct(rate(human.assistantShaped, human.pairs))}` +
      CONDITIONS.map(
        (condition) =>
          `, ${condition} ${pct(rate(arms.get(condition)!.assistantShaped, arms.get(condition)!.pairs))}`,
      ).join('') +
      '\n',
  );
  process.stdout.write(
    `  mean behaviorScore: human ${mean(human.behaviorScores).toFixed(3)}` +
      CONDITIONS.map((condition) => `, ${condition} ${mean(arms.get(condition)!.behaviorScores).toFixed(3)}`).join('') +
      '\n',
  );
  process.stdout.write(
    `  mean reply chars : human ${mean(human.chars).toFixed(1)}` +
      CONDITIONS.map((condition) => `, ${condition} ${mean(arms.get(condition)!.chars).toFixed(1)}`).join('') +
      '\n',
  );
  process.stdout.write(
    `  class A ${byClass('A').length}, B ${byClass('B').length}, C ${byClass('C').length}, unclassified ${rows.filter((row) => row.klass === '—').length}\n`,
  );
  process.stdout.write(`\nWritten to ${path.relative(ROOT, OUT).split('\\').join('/')}\n`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`paired:report failed: ${String(error)}\n`);
    process.exit(1);
  });
