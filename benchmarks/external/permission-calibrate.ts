#!/usr/bin/env node
/**
 * `npm run permission:calibrate`
 *
 * Score the permission layer against two things:
 *
 * 1. **The known-truth variants** of the solution-mode calibration bank: `vent` is `LOW`, `view` is
 *    `MEDIUM`, `help` is `HIGH`, by construction. This is where the layer is built.
 * 2. **The permission blind set** (`permission-blind.ts`): user turns only, hand-labelled, written
 *    afterwards and full of boundary cases. This is what decides whether the layer is worth putting
 *    into shadow mode, and nothing may be changed in response to it.
 *
 * The report counts `UNCERTAIN` separately and never folds it into a wrong answer. A layer that
 * abstains on a genuinely ambiguous turn is behaving; a layer that guesses `LOW` because it found
 * no help words is the failure this design exists to avoid.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { permissionOf } from './permission.js';
import type { Permission } from './permission.js';
import { PERMISSION_BLIND_CASES, PERMISSION_CALIBRATION_CASES } from './permission-blind.js';
import { SOLUTION_PROMPTS, variantOf } from './solution-probes.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const GENERATED = path.join(ROOT, '.external-corpora', 'solution', 'generated.jsonl');

const STATES: readonly Permission[] = ['LOW', 'MEDIUM', 'HIGH', 'UNCERTAIN'];

/** What the experiment's variants mean, by construction. */
const TRUTH: Record<string, Permission> = { vent: 'LOW', view: 'MEDIUM', help: 'HIGH' };

interface Tally {
  readonly rows: Map<Permission, Map<Permission, number>>;
  abstained: number;
  total: number;
}

function emptyTally(): Tally {
  return { rows: new Map(STATES.map((state) => [state, new Map(STATES.map((s) => [s, 0]))])), abstained: 0, total: 0 };
}

function record(tally: Tally, truth: Permission, said: Permission): void {
  tally.total += 1;
  if (said === 'UNCERTAIN') tally.abstained += 1;
  const row = tally.rows.get(truth)!;
  row.set(said, (row.get(said) ?? 0) + 1);
}

function print(title: string, tally: Tally): void {
  process.stdout.write(`\n${title}\n\n`);
  process.stdout.write(`  ${'truth'.padEnd(11)}${STATES.map((state) => state.padStart(11)).join('')}\n`);
  for (const truth of STATES) {
    const row = tally.rows.get(truth)!;
    const cells = STATES.map((said) => String(row.get(said) ?? 0).padStart(11)).join('');
    process.stdout.write(`  ${truth.padEnd(11)}${cells}\n`);
  }
  const decided = tally.total - tally.abstained;
  process.stdout.write(
    `\n  n ${tally.total}, abstained ${tally.abstained} (${((tally.abstained / Math.max(1, tally.total)) * 100).toFixed(0)}%), ` +
      `decided ${decided}\n`,
  );
}

function main(): number {
  if (!existsSync(GENERATED)) {
    process.stderr.write('No solution-mode calibration set. Run `npm run solution:prepare` and `solution:merge`.\n');
    return 1;
  }

  // The turns of the calibration bank, whose permission is known from the variant.
  const calibrationTruth = new Map<string, Permission>();
  for (const prompt of SOLUTION_PROMPTS) {
    const variant = variantOf(prompt.id);
    const truth = TRUTH[variant];
    if (truth !== undefined) calibrationTruth.set(prompt.userTurn, truth);
  }

  const calibration = emptyTally();
  const calibrationWrong: string[] = [];
  for (const [turn, truth] of calibrationTruth) {
    const reading = permissionOf({ userTurn: turn }).permission;
    record(calibration, truth, reading);
    if (reading !== truth) calibrationWrong.push(`${truth} read as ${reading}: ${turn}`);
  }
  print('Against the known-truth variants (calibration bank)', calibration);
  if (calibrationWrong.length > 0) {
    process.stdout.write('\n  Every disagreement, so it can be read rather than counted:\n');
    for (const line of calibrationWrong) process.stdout.write(`    ${line}\n`);
  }

  const blind = emptyTally();
  const wrong: string[] = [];
  for (const testCase of PERMISSION_CALIBRATION_CASES) {
    const reading = permissionOf({
      userTurn: testCase.userTurn,
      ...(testCase.context === undefined ? {} : { context: testCase.context }),
    });
    record(blind, testCase.label, reading.permission);
    if (reading.permission !== testCase.label) {
      wrong.push(`${testCase.id}: said ${reading.permission}, labelled ${testCase.label} [${reading.signals.join(' ')}]`);
    }
  }
  print('Against the permission calibration cases (read while the signals were chosen)', blind);

  const final = emptyTally();
  const finalWrong: string[] = [];
  for (const testCase of PERMISSION_BLIND_CASES) {
    const reading = permissionOf({
      userTurn: testCase.userTurn,
      ...(testCase.context === undefined ? {} : { context: testCase.context }),
    });
    record(final, testCase.label, reading.permission);
    if (reading.permission !== testCase.label) {
      finalWrong.push(`${testCase.id}: said ${reading.permission}, labelled ${testCase.label} [${reading.signals.join(' ')}]`);
    }
  }
  print('Against the permission blind set (written afterwards, read once)', final);
  if (finalWrong.length > 0) {
    process.stdout.write('\n  Every disagreement, so it can be read rather than counted:\n');
    for (const line of finalWrong) process.stdout.write(`    ${line}\n`);
  }

  if (wrong.length > 0) {
    process.stdout.write('\n  Every disagreement, so it can be read rather than counted:\n');
    for (const line of wrong) process.stdout.write(`    ${line}\n`);
  }
  process.stdout.write(
    '\n  UNCERTAIN counts as an answer, not a miss: a layer that abstains on an ambiguous turn is\n' +
      '  behaving, and a layer that guesses LOW because it found no help words is the failure this\n' +
      '  design exists to avoid.\n\n',
  );
  return 0;
}

process.exit(main());
