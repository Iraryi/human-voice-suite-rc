#!/usr/bin/env node
/**
 * `npm run solution:calibrate`
 *
 * Score the structural features against the hand labels on the calibration set.
 *
 * ## What this is for
 *
 * The features in `solution-mode.ts` were written before the replies were read, and in that state they
 * recalled 2 of 38 plans. They were since recalibrated against these labels and recall 29 of 38 — which
 * is why this tool exists rather than the older habit of widening a pattern until the number looked
 * right: it prints the confusion matrix per permission level, so a change can be judged by what it fixes
 * and what it breaks, and by what it does on the blind set, rather than by how the new pattern reads.
 *
 * ## What the labels are
 *
 * The `plain` arm of the sixty-prompt calibration set, read once by hand:
 *
 * | Variant | Permission | Plans in the forty replies... |
 * | --- | --- | --- |
 * | `vent` | none (`negative control`) | none. Every reply commiserates and asks something. |
 * | `view` | gray zone | eighteen of twenty. The two that are not are named below. |
 * | `help` | asked for (`positive permission`) | all twenty. |
 *
 * These are **calibration** labels. They may be looked at as often as anybody likes while the
 * features are being built, which is exactly why they can never be the evidence that the features
 * work: that needs a blind set, generated after the patterns are frozen. See
 * `SOLUTION_MODE.md` §7.
 *
 * ## The two questions, kept apart
 *
 * The tool reports recall on replies that are plans and false positives on replies that are not,
 * because "can this tell a plan from a non-plan" is a different question from "can this tell
 * whether the plan was invited". The permission level is a property of the user turn and is
 * reported as a column, never folded into the structural test.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { solutionFeatures } from './solution-mode.js';
import { SOLUTION_PROMPTS, variantOf } from './solution-probes.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const GENERATED = path.join(ROOT, '.external-corpora', 'solution', 'generated.jsonl');

/**
 * The two `view` replies that are not action plans.
 *
 * `credit-bill` gives a view and a mild practice rather than a procedure; `relatives-salary`
 * gives a reading of the relatives and one line of advice. Both are judgement calls, which is
 * what a gray zone is, and they are named rather than counted so that a reader can disagree with
 * them specifically.
 */
const NOT_A_PLAN = new Set(['smp-credit-bill-view', 'smp-relatives-salary-view']);

export function handLabel(id: string): boolean {
  return variantOf(id) !== 'vent' && !NOT_A_PLAN.has(id);
}

interface Row {
  readonly id: string;
  readonly arm: string;
  readonly text: string;
}

function main(): number {
  if (!existsSync(GENERATED)) {
    process.stderr.write('No calibration set. Run `npm run solution:prepare` and `solution:merge`.\n');
    return 1;
  }
  const rows = readFileSync(GENERATED, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Row)
    .filter((row) => row.arm === 'plain');

  const byVariant = new Map<string, { tp: number; fn: number; fp: number; tn: number; missed: string[]; spurious: string[] }>();
  for (const row of rows) {
    const variant = variantOf(row.id);
    const entry =
      byVariant.get(variant) ?? { tp: 0, fn: 0, fp: 0, tn: 0, missed: [], spurious: [] };
    const truth = handLabel(row.id);
    const said = solutionFeatures(row.text).isPlan;
    if (truth && said) entry.tp += 1;
    else if (truth && !said) {
      entry.fn += 1;
      entry.missed.push(row.id.replace('smp-', ''));
    } else if (!truth && said) {
      entry.fp += 1;
      entry.spurious.push(row.id.replace('smp-', ''));
    } else entry.tn += 1;
    byVariant.set(variant, entry);
  }

  const pct = (value: number): string => `${(value * 100).toFixed(0)}%`;
  process.stdout.write('\nStructural features against the calibration labels (plain arm)\n\n');
  process.stdout.write(
    `  ${'permission'.padEnd(10)}${'variant'.padEnd(8)}${'recall'.padStart(9)}${'precision'.padStart(11)}${'FP'.padStart(5)}${'TN'.padStart(5)}\n`,
  );
  let tp = 0;
  let fn = 0;
  let fp = 0;
  let tn = 0;
  for (const variant of ['vent', 'view', 'help']) {
    const entry = byVariant.get(variant);
    if (entry === undefined) continue;
    tp += entry.tp;
    fn += entry.fn;
    fp += entry.fp;
    tn += entry.tn;
    const recall = entry.tp + entry.fn === 0 ? '—' : `${entry.tp}/${entry.tp + entry.fn} ${pct(entry.tp / (entry.tp + entry.fn))}`;
    const precision =
      entry.tp + entry.fp === 0 ? '—' : `${entry.tp}/${entry.tp + entry.fp} ${pct(entry.tp / (entry.tp + entry.fp))}`;
    const permission = variant === 'vent' ? 'none' : variant === 'view' ? 'gray' : 'asked';
    process.stdout.write(
      `  ${permission.padEnd(10)}${variant.padEnd(8)}${recall.padStart(9)}${precision.padStart(11)}${String(entry.fp).padStart(5)}${String(entry.tn).padStart(5)}\n`,
    );
    if (entry.missed.length > 0) process.stdout.write(`      missed: ${entry.missed.join(', ')}\n`);
    if (entry.spurious.length > 0) process.stdout.write(`      false  : ${entry.spurious.join(', ')}\n`);
  }
  process.stdout.write(
    `\n  overall: recall ${tp}/${tp + fn} (${pct(tp / Math.max(1, tp + fn))}), ` +
      `false positives ${fp}/${fp + tn} (${pct(fp / Math.max(1, fp + tn))})\n`,
  );
  process.stdout.write(
    '\n  Recall here is on the calibration set, which the patterns may be tuned against. It is not\n' +
      '  evidence that they work: that is what the blind set is for.\n\n',
  );
  return 0;
}

process.exit(main());
