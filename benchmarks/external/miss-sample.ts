#!/usr/bin/env node
/**
 * `npm run miss:sample` and `npm run miss:report`
 *
 * The miss analysis. The behaviour layer is precise and low-recall: on the paired
 * control it caught 4.8% of unconstrained machine continuations and 1.6% of
 * contract-generated ones. The question this file exists to ask is what is in the rest:
 *
 * > Of the machine replies no rule fires on, how many are in fact perfectly human-like,
 * > and how many still read as an assistant in a way the rules do not cover?
 *
 * ## How the sample is drawn
 *
 * From the frozen 2,000-item paired control. For each machine arm, every item whose
 * continuation tripped **no rule at all** is a candidate — which is also what a
 * `behaviorScore` of 1.000 means, since a score below it requires a finding. The draw is
 * a stable hash of the item id and the arm, so it is reproducible without a seed file,
 * and it is checked: the tool re-scans every sampled continuation and refuses to write a
 * sample that turns out to have a finding.
 *
 * ## Why the labels are not in this file
 *
 * The sampled text is LCCC-derived and is read locally. `sample` writes it to
 * `.external-corpora/paired/miss-sample.jsonl`, which is gitignored. The labels are
 * written beside it and `report` renders counts only — no reply, no context and no
 * quotation of either appears in `MISS_ANALYSIS.md`.
 *
 * ## What the labels are for
 *
 * They are **observations**, in the strict sense: a list of ways a reply can still read
 * as an assistant while every rule stays silent. They are not rules, they do not change
 * any rule, and a candidate only becomes a rule after it is reproduced on text this
 * project may ship. See `benchmarks/external/README.md`.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createToolkit } from '../../src/dsh/tools/runtime.js';
import { PROVENANCE_LABEL, EXCEPTION_LABEL } from './labels.js';
import { CONDITIONS } from './conditions.js';
import type { Condition } from './conditions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PAIRED = path.join(ROOT, '.external-corpora', 'paired');
const SAMPLE = path.join(PAIRED, 'miss-sample.jsonl');
const LABELS = path.join(PAIRED, 'miss-labels.jsonl');
const OUT = path.join(ROOT, 'benchmarks', 'external', 'MISS_ANALYSIS.md');

/** Continuations to draw per arm. */
export const PER_ARM = 40;

/**
 * The phenomena an uncaught reply may still exhibit.
 *
 * The first group is the list the analysis was commissioned with: behaviours a reader
 * notices in a reply that no rule fires on. The second group was added **after** reading
 * the sample, and only for shapes that appeared repeatedly and that the first group had
 * no name for. Adding them afterwards is the honest order — a label invented before the
 * reading would have found whatever it was written to find.
 *
 * Every one of these is a description of something a person notices. None is a detector.
 */
export const PHENOMENA = [
  ['unnecessary_explanation', 'Explains something the conversation did not ask to have explained'],
  ['problem_solving', 'Turns a casual remark into a problem to be solved'],
  ['topic_closing', 'Closes the topic off, where a person would leave it open'],
  ['too_safe_neutral', 'So safe and neutral that it commits to nothing'],
  ['no_stance', 'No concrete position, preference or personal reaction'],
  ['task_shaped', 'Every sentence serves the answering task rather than the exchange'],
  ['no_banter', 'Does not pick up the bit, the joke or the pragmatic cue'],
  ['unasked_background', 'Volunteers background nobody asked for'],
  ['info_delivery', 'Information delivered rather than said to a person'],
  ['templated_agreement', 'Agreement in the shape of a template'],
  ['regular_emotion', 'An emotional response that is too even to be felt'],
  ['over_coherent', 'So complete and self-consistent that nothing is left unsaid'],
  ['reads_human', 'None of the above: read as a person, not as an assistant'],
  ['other', 'Something else, named in the note'],
] as const;

/**
 * Coverage shapes: what the uncaught replies did that the watched vocabulary does not.
 *
 * These are the answer to the question the commission actually asks — not "is this
 * reply bad" but "what does it do that nothing in the suite looks for". Each names a
 * behaviour the suite already has a rule *about*, in a form the rule does not watch.
 */
export const COVERAGE_SHAPES = [
  ['unrequested_advice', 'Advice, instruction or caution nobody asked for, in words the advice markers do not watch'],
  ['counselling_register', 'Validates, normalises and gives permission, the way a counsellor does'],
  ['markerless_agreement', 'Agrees in a shape the agreement markers do not watch'],
  ['aphoristic_wrapup', 'Ends on a general truth or maxim rather than on the thing being discussed'],
] as const;

type Phenomenon = (typeof PHENOMENA)[number][0];

interface Item {
  readonly id: string;
  readonly context: string;
  readonly userTurn: string;
  readonly humanReply: string;
}

interface Generated {
  readonly id: string;
  readonly condition: Condition;
  readonly text: string;
}

/** Stable hash, so the draw is reproducible from the data alone. */
function hash(value: string): number {
  let h = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function readJsonl<T>(file: string): T[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

function requireFiles(files: readonly (readonly [string, string])[]): boolean {
  for (const [file, hint] of files) {
    if (!existsSync(file)) {
      process.stderr.write(`Missing ${path.relative(ROOT, file)}. Run \`${hint}\` first.\n`);
      return false;
    }
  }
  return true;
}

async function sample(): Promise<number> {
  if (
    !requireFiles([
      [path.join(PAIRED, 'firings.json'), 'npm run paired:report'],
      [path.join(PAIRED, 'generated.jsonl'), 'npm run paired:generate -- merge'],
      [path.join(PAIRED, 'balanced.jsonl'), 'npm run paired:sample'],
    ])
  ) {
    return 1;
  }

  const firings = JSON.parse(readFileSync(path.join(PAIRED, 'firings.json'), 'utf8')) as {
    perItem: Record<string, Record<string, string[]>>;
  };
  const generated = readJsonl<Generated>(path.join(PAIRED, 'generated.jsonl'));
  const items = new Map(readJsonl<Item>(path.join(PAIRED, 'balanced.jsonl')).map((item) => [item.id, item]));
  const textOf = new Map(generated.map((row) => [`${row.condition}\u0000${row.id}`, row.text]));
  const measuredIds = Object.keys(firings.perItem);

  const toolkit = await createToolkit({ projectRoot: ROOT });
  const rows: Array<Record<string, unknown>> = [];
  const coverage: Array<{ arm: Condition; total: number; silent: number }> = [];

  for (const arm of CONDITIONS) {
    // The population is what was measured, not everything the view holds: the balanced
    // view is larger than the frozen run, and an item outside it has no continuation.
    const candidates = measuredIds
      .filter((id) => (firings.perItem[id]?.[arm] ?? []).length === 0)
      .sort((a, b) => hash(`${arm}\u0000${a}`) - hash(`${arm}\u0000${b}`));
    coverage.push({ arm, total: measuredIds.length, silent: candidates.length });

    for (const id of candidates.slice(0, PER_ARM)) {
      const item = items.get(id)!;
      const reply = textOf.get(`${arm}\u0000${id}`)!;
      // The criterion is "no rule fired"; it is checked rather than assumed, because a
      // miss analysis drawn from the wrong population is worse than none.
      const scanned = await toolkit.scan({
        text: reply,
        mode: 'chat',
        families: ['assistant'],
        conversation: { userTurn: item.userTurn },
      });
      if (scanned.canonicalFindings.length > 0 || scanned.scores.behaviorScore < 1) {
        process.stderr.write(`  skipped ${id}/${arm}: it does fire\n`);
        continue;
      }
      rows.push({
        id,
        arm,
        context: item.context,
        userTurn: item.userTurn,
        humanReply: item.humanReply,
        reply,
      });
    }
    process.stderr.write(`  ${arm}: ${candidates.length}/${items.size} silent, ${PER_ARM} drawn\n`);
  }

  writeFileSync(SAMPLE, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
  process.stdout.write('\nMiss sample\n\n');
  for (const row of coverage) {
    process.stdout.write(
      `  ${row.arm.padEnd(8)} ${String(row.silent).padStart(5)}/${row.total} silent (${((row.silent / row.total) * 100).toFixed(1)}%)\n`,
    );
  }
  process.stdout.write(`\n  ${rows.length} row(s) written to ${path.relative(ROOT, SAMPLE).split('\\').join('/')} (gitignored)\n`);
  process.stdout.write('  Label them into miss-labels.jsonl, then run `npm run miss:report`.\n\n');
  return 0;
}

interface LabelRow {
  readonly id: string;
  readonly arm: Condition;
  readonly labels: readonly string[];
  readonly note?: string;
}

function report(): number {
  if (!existsSync(SAMPLE)) {
    process.stderr.write('No sample. Run `npm run miss:sample` first.\n');
    return 1;
  }
  const sampleRows = readJsonl<Record<string, unknown>>(SAMPLE);
  if (!existsSync(LABELS)) {
    process.stderr.write(
      `No ${path.relative(ROOT, LABELS)}. Label the sample first — the report is counts, and counts of nothing are not a report.\n`,
    );
    return 1;
  }
  const labels = readJsonl<LabelRow>(LABELS);
  const known = new Set<string>([...PHENOMENA, ...COVERAGE_SHAPES].map(([id]) => id));
  const unknown = new Set<string>();
  for (const row of labels) for (const label of row.labels) if (!known.has(label)) unknown.add(label);
  if (unknown.size > 0) {
    process.stderr.write(`Unknown label(s): ${[...unknown].join(', ')}\n`);
    return 1;
  }

  const byArm = new Map<string, LabelRow[]>();
  for (const row of labels) {
    const list = byArm.get(row.arm) ?? [];
    list.push(row);
    byArm.set(row.arm, list);
  }

  const lines: string[] = [];
  const push = (...text: string[]): void => {
    for (const line of text) lines.push(line);
  };
  const pct = (value: number): string => `${(value * 100).toFixed(1)}%`;

  push(
    '# Miss analysis: what the rules do not catch',
    '',
    '<!-- Generated by `npm run miss:report`. Counts only: no source text. -->',
    '',
    '```text',
    PROVENANCE_LABEL,
    EXCEPTION_LABEL,
    '```',
    '',
    '## The question',
    '',
    'The paired control (`PAIRED_CONTROL.md`) shows the behaviour layer is precise and low-recall: three rules',
    'separate machine chat from human chat and never fire on a human continuation, but between them they catch',
    'only 1.6%–4.5% of machine replies depending on the condition. This file asks what is in the other 95%.',
    '',
    '> Of the machine replies no rule fires on, how many are in fact perfectly human-like, and how many still',
    '> read as an assistant in a way the rules do not cover?',
    '',
    '## Method',
    '',
    `For each machine arm of the frozen 2,000-item paired control, every continuation that tripped no rule at`,
    'all was a candidate — which is the same as `behaviorScore` 1.000, since any finding reduces it. The draw is',
    `a stable hash of item id and arm, ${PER_ARM} per arm, and every sampled continuation is re-scanned before it`,
    'is written: one that turns out to have a finding is dropped rather than quietly measured as a miss.',
    '',
    'The sampled text is LCCC-derived and was read locally. It is not reproduced here, and neither is any',
    'quotation from it. Labels are observations, not rules: a phenomenon listed below is a thing a reader',
    'notices, and nothing in the suite changes because of it. A candidate becomes a rule only after it is',
    'reproduced on text this project may ship, by the procedure in `benchmarks/external/README.md`.',
    '',
    '## How much is uncaught',
    '',
    '| Arm | Silent continuations | Share |',
    '| --- | --- | --- |',
  );

  const silent: Record<string, number> = { plain: 1904, default: 1965, post: 1926 };
  const firings = existsSync(path.join(PAIRED, 'firings.json'))
    ? (JSON.parse(readFileSync(path.join(PAIRED, 'firings.json'), 'utf8')) as {
        items: number;
        perItem: Record<string, Record<string, string[]>>;
      })
    : null;
  if (firings !== null) {
    for (const arm of CONDITIONS) {
      const count = Object.values(firings.perItem).filter((entry) => (entry[arm] ?? []).length === 0).length;
      silent[arm] = count;
      push(`| \`${arm}\` | ${count} | ${pct(count / firings.items)} |`);
    }
  } else {
    for (const arm of CONDITIONS) push(`| \`${arm}\` | ${silent[arm]} | — |`);
  }

  push(
    '',
    '## What was found in the sample',
    '',
    `| Phenomenon | ${CONDITIONS.map((arm) => `\`${arm}\``).join(' | ')} | Total |`,
    `| --- | ${CONDITIONS.map(() => '---').join(' | ')} | --- |`,
  );
  for (const [id, description] of PHENOMENA) {
    const counts = CONDITIONS.map(
      (arm) => (byArm.get(arm) ?? []).filter((row) => row.labels.includes(id)).length,
    );
    push(`| \`${id}\` — ${description} | ${counts.join(' | ')} | ${counts.reduce((a, b) => a + b, 0)} |`);
  }

  push(
    '',
    '### Coverage shapes',
    '',
    'Added after reading the sample, for what the first list had no name for. Each one is a behaviour the',
    'suite already has a rule about, in a form that rule does not watch — which is the gap between "the rule is',
    'wrong" and "the rule is not looking here".',
    '',
    `| Shape | ${CONDITIONS.map((arm) => `\`${arm}\``).join(' | ')} | Total |`,
    `| --- | ${CONDITIONS.map(() => '---').join(' | ')} | --- |`,
  );
  for (const [id, description] of COVERAGE_SHAPES) {
    const counts = CONDITIONS.map(
      (arm) => (byArm.get(arm) ?? []).filter((row) => row.labels.includes(id)).length,
    );
    push(`| \`${id}\` — ${description} | ${counts.join(' | ')} | ${counts.reduce((a, b) => a + b, 0)} |`);
  }

  const totalLabelled = labels.length;
  const humanLike = labels.filter((row) => row.labels.includes('reads_human')).length;
  const shapeIds = new Set<string>(COVERAGE_SHAPES.map(([id]) => id));
  const assistantish = labels.filter((row) => !row.labels.includes('reads_human'));
  const withShape = assistantish.filter((row) => row.labels.some((label) => shapeIds.has(label))).length;
  push(
    '',
    `**${totalLabelled} continuation(s) labelled.** ${humanLike} of them (${pct(humanLike / Math.max(1, totalLabelled))}) read as a`,
    `person rather than as an assistant. The other ${assistantish.length} (${pct(assistantish.length / Math.max(1, totalLabelled))}) still read as an assistant with no rule firing,`,
    `and **${withShape} of those ${assistantish.length}** do it in one of the coverage shapes below — a behaviour the suite already`,
    'has a rule about, in a form the rule does not watch.',
    '',
    'Read the second table as the actionable one. The first says what a reader notices; the second says which',
    'of those are a *rule looking in the wrong place* rather than a missing rule: advice that carries none of',
    'the advice words, agreement that carries none of the agreement words, a counselling register with no',
    'mechanical-empathy phrase in it. Those are the candidates worth reproducing first, because the rule already',
    'exists and only the trigger is short.',
    '',
  );

  const notes = labels.filter((row) => typeof row.note === 'string' && row.note.length > 0);
  if (notes.length > 0) {
    push(
      '## Notes from the sample',
      '',
      ...notes.slice(0, 40).map((row) => `- \`${row.id}\`/\`${row.arm}\`: ${row.note}`),
      '',
    );
  }

  push(
    '## What this file is not',
    '',
    '1. **Not a measurement with an error bar.** One reader labelled a sample drawn from one corpus in one',
    '   register. The counts are the sample, and the sample is 40 per arm.',
    '2. **Not rule proposals.** A phenomenon here is a description of what a reader noticed. Turning one into a',
    '   detector requires the reproduction procedure, and none of these has been through it.',
    '3. **Not evidence that the rules are wrong.** A rule that fires on 1% of machine replies and never on human',
    '   ones is correct as far as it goes. This file is about coverage, not correctness.',
    '',
    '## Reproducing it',
    '',
    '```bash',
    'npm run miss:sample     # draws the sample, checks it, writes it locally',
    '# label .external-corpora/paired/miss-labels.jsonl',
    'npm run miss:report',
    '```',
    '',
    `Generated ${new Date().toISOString()} from ${sampleRows.length} sampled continuation(s).`,
    '',
  );

  writeFileSync(OUT, `${lines.join('\n')}\n`, 'utf8');
  process.stdout.write('\nMiss analysis\n\n');
  process.stdout.write(`  labelled : ${totalLabelled}\n`);
  process.stdout.write(`  reads as human : ${humanLike} (${pct(humanLike / Math.max(1, totalLabelled))})\n`);
  process.stdout.write(`  written to ${path.relative(ROOT, OUT).split('\\').join('/')}\n`);
  return 0;
}

async function main(): Promise<number> {
  const command = process.argv[2];
  if (command === 'sample') return sample();
  if (command === 'report') return report();
  process.stdout.write(
    [
      'Usage: npm run miss:sample | npm run miss:report',
      '',
      '  sample   Draw the uncaught continuations and check them',
      '  report   Render MISS_ANALYSIS.md from the labels',
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
    process.stderr.write(`miss analysis failed: ${String(error)}\n`);
    process.exit(1);
  });

export type { Phenomenon };
