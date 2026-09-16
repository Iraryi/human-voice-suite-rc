/**
 * `npm run advice:annotate [-- --write|--check]`
 *
 * Records, per corpus sample, the advice permission its user turn carries.
 *
 * ## Why a corpus annotation rather than a live read
 *
 * `chat.unsolicited_advice` cannot judge itself. Its gate needs a permission state, and
 * the state is a property of the **user turn**, which only the caller has. Until Phase B
 * the rule read `requestKind`, nothing populated it, and absence in that list was read as
 * "the user asked for nothing" on every sample this project ever measured.
 *
 * The suite now takes the state as a three-valued input. A benchmark corpus is exactly
 * the place to record it: the sample is the input, the permission is part of what the
 * input *is*, and putting it in the front matter means a run can be reproduced from the
 * repository rather than from a machine's local state.
 *
 * ## What writes what
 *
 * The state is read from the frozen solution-permission layer **A v1**
 * (`permission.ts`), mapped through the phase-B adapter (`HIGH` → `granted`,
 * `LOW` → `absent`, `MEDIUM` and `UNCERTAIN` → `unknown`). This tool does not
 * classify anything itself; it transcribes A v1 and refuses to guess.
 *
 * - `--check` fails when a sample's committed state differs from what A v1 reads now,
 *   which is what catches a corpus drifting away from the layer that annotated it.
 * - `--write` rewrites the front matter in place.
 * - no flag prints the table and changes nothing.
 *
 * ## What it does not do
 *
 * It does not touch a sample without a `user_turn`, because there is no turn to read.
 * It does not invent `absent` for a turn A v1 declines to decide: `MEDIUM` and
 * `UNCERTAIN` become `unknown`, and the rule abstains on those samples. That is the
 * design working, not a gap to close.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadCorpus } from '../lib/corpus.js';
import type { Sample } from '../lib/corpus.js';
import { advicePermissionFromSolution } from '../../src/behavior/permission/index.js';
import type { AdvicePermission } from '../../src/behavior/permission/index.js';
import { permissionOf } from './permission.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..');

/** The state A v1 reads out of a sample's user turn, or undefined when there is no turn. */
export function readPermission(sample: Sample): AdvicePermission | undefined {
  if (sample.userTurn === undefined || sample.userTurn.trim().length === 0) return undefined;
  return advicePermissionFromSolution(permissionOf({ userTurn: sample.userTurn })).advicePermission;
}

interface Row {
  readonly sample: Sample;
  readonly read: AdvicePermission | undefined;
  readonly committed: AdvicePermission | undefined;
  readonly aV1: string;
}

function rows(samples: readonly Sample[]): Row[] {
  return samples
    .filter((sample) => sample.userTurn !== undefined && sample.userTurn.trim().length > 0)
    .map((sample) => ({
      sample,
      read: readPermission(sample),
      committed: sample.advicePermission,
      aV1: permissionOf({ userTurn: sample.userTurn as string }).permission,
    }));
}

/**
 * Insert or replace `advice_permission` in a sample's front matter.
 *
 * Written immediately after the whole `user_turn` entry, so the state sits beside the
 * turn it describes. "After the whole entry" is the part that needs care: `user_turn` is
 * a YAML block scalar in most samples, so its value is the *indented lines below it*, and
 * inserting at the next line would put the new key inside the turn's text. The body is
 * untouched either way: the corpus hash covers the body and the turn, and this tool must
 * not be able to change either.
 */
export function withPermission(text: string, state: AdvicePermission): string {
  const lines = text.split('\n');
  const start = lines.findIndex((line, index) => index === 0 && line.trim() === '---');
  const end = lines.findIndex((line, index) => index > start && line.trim() === '---');
  if (start === -1 || end === -1) {
    throw new Error('sample has no front matter block; refusing to guess where to write');
  }

  const kept = lines
    .slice(start + 1, end)
    .filter((line) => !/^advice_permission\s*:/.test(line));

  const turnAt = kept.findIndex((line) => /^user_turn\s*:/.test(line));
  let insertAt = kept.length;
  if (turnAt !== -1) {
    insertAt = turnAt + 1;
    // A block scalar (`|`, `>`, with any chomping indicator) owns every line indented
    // under its key. `user_turn: |` is not an inline value even though `|` is not a space.
    const blockScalar = /:\s*[|>][-+]?\d*\s*$/.test(kept[turnAt] as string);
    if (blockScalar) {
      while (insertAt < kept.length && /^\s+\S/.test(kept[insertAt] as string)) insertAt += 1;
    }
  }
  kept.splice(insertAt, 0, `advice_permission: ${state}`);
  return [...lines.slice(0, start + 1), ...kept, ...lines.slice(end)].join('\n');
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
  const write = argv.includes('--write');
  const check = argv.includes('--check');
  const corpus = loadCorpus(path.join(ROOT, 'benchmarks'));
  const annotated = rows(corpus.samples);

  const absent = annotated.filter((row) => row.read === 'absent');
  const granted = annotated.filter((row) => row.read === 'granted');
  const unknown = annotated.filter((row) => row.read === 'unknown');
  const drift = annotated.filter((row) => row.committed !== row.read);

  const out: string[] = [];
  out.push('Advice permission annotation');
  out.push('');
  out.push(
    `${annotated.length} sample(s) carry a user turn; ${corpus.samples.length - annotated.length} do not and are left alone.`,
  );
  out.push('');
  out.push('| Sample | A v1 | advice_permission | committed |');
  out.push('| --- | --- | --- | --- |');
  for (const row of annotated) {
    const committed = row.committed ?? '(none)';
    const flag = row.committed === row.read ? '' : ' ← **drift**';
    out.push(`| \`${row.sample.id}\` | \`${row.aV1}\` | \`${row.read}\` | \`${committed}\`${flag} |`);
  }
  out.push('');
  out.push(
    `Read: ${granted.length} granted, ${absent.length} absent, ${unknown.length} unknown. ` +
      'A v1 deciding nothing on a turn is recorded as `unknown`, and the rule abstains on those samples.',
  );

  process.stdout.write(`${out.join('\n')}\n`);

  if (check) {
    if (drift.length > 0) {
      process.stderr.write(
        `\n${drift.length} sample(s) drifted from A v1: ${drift.map((row) => row.sample.id).join(', ')}.\n` +
          'Run `npm run advice:annotate -- --write` and re-run the affected benchmarks.\n',
      );
      return 1;
    }
    process.stdout.write('\nEvery committed advice_permission matches what A v1 reads.\n');
    return 0;
  }

  if (write) {
    for (const row of annotated) {
      if (row.read === undefined || row.committed === row.read) continue;
      const file = path.join(ROOT, 'benchmarks', row.sample.path);
      writeFileSync(file, withPermission(readFileSync(file, 'utf8'), row.read));
    }
    process.stdout.write(`\nWrote ${drift.length} sample(s).\n`);
  }

  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
