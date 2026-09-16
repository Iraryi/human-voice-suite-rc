/**
 * `npm run advice:permission`
 *
 * What the advice-permission gate does to `chat.unsolicited_advice`, measured.
 *
 * ## The question
 *
 * Before Phase B the rule applied whenever `requestKind` did not contain `advice`, and
 * nothing ever populated `requestKind`. So every rate this project published for the rule
 * described it **with its permission gate disabled**, and the nineteen "legitimate advice
 * after permission" replies in the lexical-only cell were evidence of a missing wire, not
 * of a wrong concept.
 *
 * The wire now exists: `advicePermission` is `granted`, `absent` or `unknown`, and the rule
 * is suppressed, deciding, or abstaining accordingly. This tool measures what that does to
 * the 2,000-item paired baseline and to the committed corpus.
 *
 * ## The four outcomes, kept apart
 *
 * | Outcome | What happened |
 * | --- | --- |
 * | `absent` + fired | the turn has positive evidence it invited nothing, and the five phrases are present |
 * | `absent` + quiet | the same evidence, and the phrases are not present |
 * | `granted` + suppressed | the turn invited advice, so there was nothing unsolicited to find |
 * | `unknown` + abstained | nobody established the permission, so the rule did not decide |
 *
 * An abstention is **not** a negative result and is not counted as one anywhere below. A
 * suppression is **not** a no-match either.
 *
 * ## The reproduction check, and why it is first
 *
 * `--force-absent` runs the same measurement with the permission forced to `absent` on every
 * turn. That is the old behaviour, and the per-arm counts must reproduce the published paired
 * numbers (0 human, 32 plain, 14 default, 22 post). If they do not, the measurement path
 * differs from the one those numbers came from and nothing else in this report is comparable.
 * The check is the reason this report can claim the only thing that changed is the gate.
 *
 * ## What it reads
 *
 * The paired corpus lives in `.external-corpora/paired/`, is LCCC-derived, and never enters
 * git. Only counts are written here.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { measureSmellsDetailed } from '../../src/behavior/assistant-smell/index.js';
import { advicePermissionFromSolution } from '../../src/behavior/permission/index.js';
import type { AdvicePermission } from '../../src/behavior/permission/index.js';
import { loadCorpus } from '../lib/corpus.js';
import type { Sample } from '../lib/corpus.js';
import { CONDITIONS } from './conditions.js';
import type { Condition } from './conditions.js';
import { permissionOf } from './permission.js';
import type { Permission } from './permission.js';
import { selectStratified } from './selection.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAIRED = path.join(ROOT, '.external-corpora', 'paired');
const OUT = path.join(ROOT, 'benchmarks', 'external', 'ADVICE_PERMISSION.md');

const RULE = 'chat.unsolicited_advice';
const HUMAN = 'human' as const;
type Arm = typeof HUMAN | Condition;
const ARMS: readonly Arm[] = [HUMAN, ...CONDITIONS];

/** The published per-arm firing counts, from `PAIRED_CONTROL.md`, with the gate disabled. */
const PUBLISHED: Readonly<Record<Arm, number>> = { human: 0, plain: 32, default: 14, post: 22 };

/** The balanced view's selection size, matching the paired control's `--limit`. */
const PAIRED_LIMIT = 2000;

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

/** The gate outcomes, which are four and not two. */
type Outcome = 'fired' | 'quiet' | 'suppressed' | 'abstained';

interface Cell {
  readonly state: AdvicePermission;
  readonly outcome: Outcome;
}

interface Tally {
  readonly cells: Map<string, number>;
  /** A v1's own four states, from the user turns. */
  readonly levels: Map<Permission, number>;
  total: number;
}

function key(state: AdvicePermission, outcome: Outcome): string {
  return `${state}\u0000${outcome}`;
}

function outcomeOf(sample: Sample | { userTurn: string }, reply: string, state: AdvicePermission): Outcome {
  const measured = measureSmellsDetailed(reply, { userTurn: sample.userTurn, advicePermission: state });
  if (measured.suppressed.some((entry) => entry.id === RULE)) return 'suppressed';
  if (measured.abstained.some((entry) => entry.id === RULE)) return 'abstained';
  return measured.smells.some((smell) => smell.id === RULE) ? 'fired' : 'quiet';
}

function record(tally: Tally, state: AdvicePermission, outcome: Outcome): void {
  tally.total += 1;
  const k = key(state, outcome);
  tally.cells.set(k, (tally.cells.get(k) ?? 0) + 1);
}

function count(tally: Tally, state: AdvicePermission, outcome: Outcome): number {
  return tally.cells.get(key(state, outcome)) ?? 0;
}

function pct(value: number, total: number): string {
  return total === 0 ? '—' : `${((value / total) * 100).toFixed(1)}%`;
}

const STATES: readonly AdvicePermission[] = ['granted', 'absent', 'unknown'];
const OUTCOMES: readonly Outcome[] = ['fired', 'quiet', 'suppressed', 'abstained'];

function emptyTally(): Tally {
  return { cells: new Map(), levels: new Map(), total: 0 };
}

interface PairedResult {
  readonly arms: Map<Arm, Tally>;
  readonly items: number;
  readonly forced: Map<Arm, number>;
}

function measurePaired(forceAbsent: boolean): PairedResult {
  // The same view and the same selection the paired control used: `balanced`, 2,000 items,
  // round-robin over the strata cells. Selecting differently would make the reproduction
  // check below meaningless, which is the one thing this tool has to get right.
  const viewItems = readFileSync(path.join(PAIRED, 'balanced.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Item);
  const items = selectStratified(viewItems, PAIRED_LIMIT);
  const generated = readFileSync(path.join(PAIRED, 'generated.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Generated);

  const byItem = new Map<string, Map<Condition, string>>();
  for (const row of generated) {
    const entry = byItem.get(row.id) ?? new Map<Condition, string>();
    entry.set(row.condition, row.text);
    byItem.set(row.id, entry);
  }

  const arms = new Map<Arm, Tally>(ARMS.map((arm) => [arm, emptyTally()]));
  const forced = new Map<Arm, number>(ARMS.map((arm) => [arm, 0]));

  let usable = 0;
  for (const item of items) {
    const machine = byItem.get(item.id);
    if (machine === undefined || !CONDITIONS.every((condition) => machine.has(condition))) continue;
    usable += 1;

    const reading = permissionOf({ userTurn: item.userTurn });
    const mapped = advicePermissionFromSolution(reading);
    arms.get(HUMAN)!.levels.set(reading.permission, (arms.get(HUMAN)!.levels.get(reading.permission) ?? 0) + 1);

    for (const arm of ARMS) {
      const text = arm === HUMAN ? item.humanReply : machine.get(arm)!;
      // `--force-absent` is the pre-Phase-B behaviour: the rule always decided.
      const state: AdvicePermission = forceAbsent ? 'absent' : mapped.advicePermission;
      const outcome = outcomeOf(item, text, state);
      record(arms.get(arm)!, state, outcome);
      if (outcome === 'fired') forced.set(arm, (forced.get(arm) ?? 0) + 1);
    }
  }

  return { arms, items: usable, forced };
}

function corpusTally(): { readonly tally: Tally; readonly samples: number } {
  const corpus = loadCorpus(path.join(ROOT, 'benchmarks'));
  const tally = emptyTally();
  let samples = 0;
  for (const sample of corpus.samples) {
    if (sample.userTurn === undefined || sample.userTurn.trim().length === 0) continue;
    samples += 1;
    const state = sample.advicePermission ?? 'unknown';
    record(tally, state, outcomeOf(sample, sample.body, state));
  }
  return { tally, samples };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
  const check = argv.includes('--check');
  const forceAbsent = argv.includes('--force-absent');

  if (!existsSync(path.join(PAIRED, 'natural.jsonl'))) {
    process.stderr.write(
      `No paired corpus at ${path.relative(ROOT, PAIRED)}. It is LCCC-derived and local-only; see benchmarks/external/README.md.\n`,
    );
    return 1;
  }

  // Two passes: one with the permission forced to `absent` everywhere — the pre-Phase-B
  // behaviour — and one with the gate live. The first exists to prove the second is measured
  // the same way the published numbers were.
  const reproduced = measurePaired(true);
  const paired = measurePaired(false);
  const corpus = corpusTally();

  const lines: string[] = [];
  const push = (...text: string[]): void => {
    for (const line of text) lines.push(line);
  };

  push(
    '# Advice permission: what the gate does',
    '',
    '<!-- Generated by `npm run advice:permission`. Do not edit by hand. -->',
    '',
    '`chat.unsolicited_advice` has a permission gate. Until Phase B nothing populated it, so every',
    'rate this project published for the rule describes it **with the gate disabled** — those numbers',
    'stay quoted with that qualifier. This document is the measurement *with* the gate.',
    '',
    'The rule remains `shadow`: it reports and charges nothing. Nothing below moves `behaviorScore`,',
    'and `BENCHMARK_RESULTS.md` records the same fact for the committed corpus.',
    '',
    'Four outcomes are kept apart, and two of them are not results:',
    '',
    '| Outcome | What happened |',
    '| --- | --- |',
    '| `fired` | permission `absent` and the five watched phrases are present |',
    '| `quiet` | permission `absent` and the phrases are not present |',
    '| `suppressed` | permission `granted`, so the rule was ruled out before evaluation |',
    '| `abstained` | permission `unknown`, so the rule did not decide |',
    '',
    '**An abstention is not a negative result and a suppression is not a no-match.** Neither is',
    'counted as `quiet` anywhere in this document.',
    '',
    '## 1. The measurement path reproduces the published numbers',
    '',
    `With the permission forced to \`absent\` on every turn — the pre-Phase-B behaviour, where the rule`,
    'always decided — the per-arm firing counts are:',
    '',
    '| Arm | Published (gate disabled) | Reproduced |',
    '| --- | --- | --- |',
  );
  for (const arm of ARMS) {
    const actual = reproduced.forced.get(arm) ?? 0;
    const expected = PUBLISHED[arm];
    push(`| \`${arm}\` | ${expected} | ${actual}${actual === expected ? '' : ' **≠**'} |`);
  }
  const reproducedAll = ARMS.every((arm) => (reproduced.forced.get(arm) ?? 0) === PUBLISHED[arm]);
  push(
    '',
    reproducedAll
      ? 'Every arm reproduces. The only thing that changed between the published numbers and the ones below is the gate.'
      : '**The reproduction fails.** The measurement path differs from the one the published numbers came from, so the tables below are not comparable with them.',
    '',
    `The paired baseline is ${paired.items} item(s) with all three machine conditions present. An arm's`,
    '`n` below is the same for every arm, because the pair is the item: only who wrote the continuation differs.',
    '',
    '## 2. What A v1 reads on the human user turns',
    '',
    'A v1 is the frozen solution-permission layer, and it is the only producer of a `granted` or `absent`',
    'state in this pipeline. Its coverage is therefore the gate\'s coverage, and this table is the ceiling on',
    'everything in section 3.',
    '',
    '| A v1 | Turns | `advicePermission` |',
    '| --- | --- | --- |',
  );
  const levelToState: Readonly<Record<Permission, AdvicePermission>> = {
    HIGH: 'granted',
    LOW: 'absent',
    MEDIUM: 'unknown',
    UNCERTAIN: 'unknown',
  };
  const humanTally = paired.arms.get(HUMAN)!;
  for (const level of ['HIGH', 'MEDIUM', 'LOW', 'UNCERTAIN'] as const) {
    const turns = humanTally.levels.get(level) ?? 0;
    push(`| \`${level}\` | ${turns} (${pct(turns, paired.items)}) | \`${levelToState[level]}\` |`);
  }
  const granted = humanTally.levels.get('HIGH') ?? 0;
  const medium = humanTally.levels.get('MEDIUM') ?? 0;
  push(
    '',
    `**A v1 granted permission ${granted} time(s) in ${paired.items} and asked for a judgement ${medium} time(s).**`,
    'LCCC is casual Weibo chatter, where people share and vent rather than ask for methods, and A v1 was',
    'built to be conservative: `HIGH` needs a request signal and `LOW` needs a stance that closes itself.',
    'The consequence for the gate is concrete and worth stating plainly — **on this baseline the rule was',
    'never suppressed and never saw a judgement request.** The `granted` and `MEDIUM` paths are exercised by',
    'the integration regression in `tests/behavior-advice-permission.test.ts` and by the two `granted`',
    'samples in section 4, not by these 2,000 turns.',
    '',
    `The abstention rate here is ${pct(humanTally.levels.get('UNCERTAIN') ?? 0, paired.items)}. That is the layer working as`,
    'designed on a distribution it does not cover, and it is the honest ceiling on what the rule can report:',
    '**the gate does not make the rule quieter by being right, it makes it quieter by declining to decide.**',
    '',
  );

  push(
    '## 3. The gate, per arm',
    '',
    '| Arm | n | `absent` + fired | `absent` + quiet | `granted` + suppressed | `unknown` + abstained |',
    '| --- | --- | --- | --- | --- | --- |',
  );
  for (const arm of ARMS) {
    const tally = paired.arms.get(arm)!;
    push(
      `| \`${arm}\` | ${tally.total} | ${count(tally, 'absent', 'fired')} (${pct(count(tally, 'absent', 'fired'), tally.total)}) | ` +
        `${count(tally, 'absent', 'quiet')} (${pct(count(tally, 'absent', 'quiet'), tally.total)}) | ` +
        `${count(tally, 'granted', 'suppressed')} (${pct(count(tally, 'granted', 'suppressed'), tally.total)}) | ` +
        `${count(tally, 'unknown', 'abstained')} (${pct(count(tally, 'unknown', 'abstained'), tally.total)}) |`,
    );
  }
  push('');

  const decided = ARMS.map((arm) => {
    const tally = paired.arms.get(arm)!;
    return { arm, fired: count(tally, 'absent', 'fired'), decided: count(tally, 'absent', 'fired') + count(tally, 'absent', 'quiet') };
  });
  const humanTurns = paired.items;
  const grantedShare = (humanTally.levels.get('HIGH') ?? 0) / Math.max(1, humanTurns);
  const absentShare = (humanTally.levels.get('LOW') ?? 0) / Math.max(1, humanTurns);

  push(
    '',
    `The rule reached a verdict on ${(absentShare * 100).toFixed(1)}% of human turns (permission \`absent\`) and was`,
    `ruled out on ${(grantedShare * 100).toFixed(1)}% (permission \`granted\`). On the rest it abstained.`,
    '',
    '#### Firing rate on the share the rule decided',
    '',
    'The abstained share is in no denominator below: it is not a quiet reply and it is not a firing.',
    '',
    '| Arm | Fired on the decided share |',
    '| --- | --- |',
  );
  for (const entry of decided) {
    push(`| \`${entry.arm}\` | ${entry.fired}/${entry.decided} (${pct(entry.fired, entry.decided)}) |`);
  }
  push(
    '',
    'The human arm is the false-positive column: the rule fired on it',
    `${count(humanTally, 'absent', 'fired')} time(s) out of ${decided.find((entry) => entry.arm === HUMAN)?.decided ?? 0} decided turn(s).`,
    'That is the number that separates this rule from a rule that fires on advice in general.',
    '',
    '## 4. The committed corpus',
    '',
    `The 2,000-item baseline is LCCC-derived and local. The committed corpus is the reproducible half:`,
    `${corpus.samples} sample(s) carry a user turn, and each records its \`advice_permission\` in the front`,
    'matter, read from A v1 by `npm run advice:annotate` and verified by `advice:annotate --check`.',
    '',
    '| `advicePermission` | Samples | Fired | Quiet | Suppressed | Abstained |',
    '| --- | --- | --- | --- | --- | --- |',
  );
  for (const state of STATES) {
    const fired = count(corpus.tally, state, 'fired');
    const quiet = count(corpus.tally, state, 'quiet');
    const suppressed = count(corpus.tally, state, 'suppressed');
    const abstained = count(corpus.tally, state, 'abstained');
    push(
      `| \`${state}\` | ${fired + quiet + suppressed + abstained} | ${fired} | ${quiet} | ${suppressed} | ${abstained} |`,
    );
  }
  push(
    '',
    'Samples with permission `unknown` are the ones A v1 declined to decide, and **every one of them is an',
    'English turn**: A v1\'s signals are Chinese constructions and it has none for English, so an English',
    'turn is undecidable by construction rather than by judgement. The advice rule abstains on all of them,',
    'which is why the rule appears in `BENCHMARK_RESULTS.md` under "which rules declined to decide" and only',
    'partly in the firing table.',
    '',
    'The two `granted` samples are the ones that exercise suppression in a real corpus run: the rule is',
    'ruled out before evaluation, and that shows up in the run file as a `behaviorSuppressed` entry rather',
    'than as a rule that found nothing.',
    '',
    '## 5. What this does and does not establish',
    '',
    '- **Does**: the gate is wired, the three states are reachable from the frozen layer, and the',
    '  measurement path is the same one the published numbers came from.',
    '- **Does not**: validate the rule under its new behaviour. The old data cannot do that, because the',
    '  rule\'s operational meaning changed when the gate went live. The rule stays `shadow`, and a promotion',
    '  would need its own blind review.',
    '- **Does not**: give `chat.unsolicited_advice` a precision figure under `absent`. The `fired` counts',
    '  above are counts, not precision: whether the advice was genuinely uninvited is a question for a',
    '  hand review, and the nineteen legitimate-after-permission replies in the lexical-only cell say the',
    '  phrase list is not the whole story.',
    '- **Does not**: generalise A v1 past Chinese. Every English turn abstains.',
    '',
  );

  const rendered = lines.join('\n');
  if (check) {
    const existing = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    // The run file name is not part of this document, so a rerun is byte-comparable.
    if (existing !== rendered) {
      process.stderr.write('ADVICE_PERMISSION.md is stale. Run `npm run advice:permission` without --check.\n');
      return 1;
    }
    process.stdout.write('ADVICE_PERMISSION.md is current.\n');
    return 0;
  }

  writeFileSync(OUT, rendered);
  process.stdout.write(`Wrote ${path.relative(ROOT, OUT)}.\n`);
  for (const arm of ARMS) {
    const tally = paired.arms.get(arm)!;
    process.stdout.write(
      `  ${arm.padEnd(9)} fired ${count(tally, 'absent', 'fired')}, quiet ${count(tally, 'absent', 'quiet')}, ` +
        `suppressed ${count(tally, 'granted', 'suppressed')}, abstained ${count(tally, 'unknown', 'abstained')}\n`,
    );
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
