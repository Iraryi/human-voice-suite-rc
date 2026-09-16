#!/usr/bin/env node
/**
 * `npm run bench:ablation`
 *
 * Reads a stored run and answers the questions `benchmarks/README.md` §3 lists,
 * one row at a time. Prints deltas between configurations rather than levels,
 * because a level on its own says nothing about which layer produced it.
 *
 * The four scores are always reported separately. Where a layer improves one and
 * degrades another, the delta table shows both and no aggregate hides it.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIGS, configById } from './lib/configs.js';
import { CATEGORIES, NOISE_FLOOR } from './lib/corpus.js';
import { loadRun } from './lib/store.js';
import type { StoredRun } from './lib/store.js';
import {
  CONTROL_PROVENANCE,
  SUBJECT_CATEGORY,
  cellFor,
  flaggedHumanRules,
  tallyRules,
  testHypothesis,
  valuesFor,
} from './lib/stats.js';
import type { ScoreName } from '../src/validation/types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const SCORES: readonly ScoreName[] = [
  'antiAIScore',
  'behaviorScore',
  'voiceScore',
  'preservationScore',
];

interface Options {
  readonly runFile?: string;
  readonly json: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  let runFile: string | undefined;
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--run': {
        const value = argv[index + 1];
        if (!value) throw new Error('--run requires a file name');
        runFile = value;
        index += 1;
        break;
      }
      case '--json':
        json = true;
        break;
      case '-h':
      case '--help':
        process.stdout.write(
          [
            'Usage: npm run bench:ablation [options]',
            '',
            'Reads a stored run and reports what each layer contributes.',
            '',
            'Options:',
            '  --run FILE   Use this run instead of the most recent one',
            '  --json       Print JSON instead of prose',
            '  -h, --help   Show this help',
            '',
          ].join('\n'),
        );
        process.exit(0);
        break;
      default:
        if (arg !== undefined && arg.startsWith('-')) throw new Error(`Unknown option ${arg}`);
    }
  }
  return { ...(runFile ? { runFile } : {}), json };
}

function mean(values: readonly number[]): number | undefined {
  return values.length === 0 ? undefined : values.reduce((a, b) => a + b, 0) / values.length;
}

function fmt(value: number | undefined): string {
  return value === undefined ? '  n/a' : value.toFixed(2).padStart(5);
}

function signed(value: number | undefined): string {
  if (value === undefined) return '  n/a';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`.padStart(5);
}

/** Column headings short enough to fit, long enough to be unambiguous. */
function short(score: ScoreName): string {
  return score.replace('Score', '');
}

function report(run: StoredRun, json: boolean): void {
  const { meta, results } = run;
  const categories = CATEGORIES.filter((category) => (meta.byCategory[category] ?? 0) > 0);
  const configs = CONFIGS.filter((config) =>
    meta.configs.some((entry) => entry.id === config.id),
  );

  const payload: Record<string, unknown> = {
    run: run.file,
    corpusHash: meta.corpusHash,
    samples: results.length,
    byCategory: meta.byCategory,
    byProvenance: meta.byProvenance,
    thin: meta.thin,
    unpopulated: meta.unpopulated,
    rows: [] as unknown[],
    hypothesis: [] as unknown[],
    falsePositives: [] as unknown[],
  };
  const rows = payload['rows'] as unknown[];
  const hypothesis = payload['hypothesis'] as unknown[];
  const falsePositives = payload['falsePositives'] as unknown[];

  if (!json) {
    process.stdout.write(`\nAblation — ${run.file}\n`);
    process.stdout.write(`corpus ${meta.corpusHash}\n`);
    process.stdout.write(
      `${results.length} measurements over ${Object.values(meta.byCategory).reduce((a, b) => a + b, 0)} samples and ${configs.length} configurations\n`,
    );
    if (meta.thin.length > 0) {
      process.stdout.write(
        `\nBelow the ${NOISE_FLOOR}-sample noise floor: ${meta.thin.join(', ')}.\n` +
          'Differences in these categories are not evidence of anything. They are printed so that nobody\n' +
          'has to take the aggregate on trust.\n',
      );
    }

    process.stdout.write('\nWhat each layer adds, by configuration pair\n');
  }

  const additive: ReadonlyArray<readonly [string, string]> = [
    ['baseline', 'anti-ai'],
    ['baseline', 'voice'],
    ['baseline', 'behavior'],
    ['anti-ai', 'anti-ai+voice'],
    ['anti-ai', 'anti-ai+behavior'],
    ['anti-ai+behavior', 'full'],
  ];

  for (const [from, to] of additive) {
    const before = configById(from);
    const after = configById(to);
    if (!before || !after) continue;
    if (!configs.some((c) => c.id === from) || !configs.some((c) => c.id === to)) continue;

    const row: Record<string, unknown> = { from, to, cells: {} as Record<string, unknown> };
    const cellsOut = row['cells'] as Record<string, unknown>;

    if (!json) {
      process.stdout.write(`\n  ${before.label} → ${after.label}\n`);
      process.stdout.write(`    ${after.question}\n\n`);
      process.stdout.write(
        `    ${'category'.padEnd(22)}${SCORES.map((score) => short(score).padStart(11)).join('')}\n`,
      );
    }

    for (const category of categories) {
      const cells: Record<string, unknown> = {};
      const rendered: string[] = [];
      for (const score of SCORES) {
        const a = valuesFor(results, from, score, (r) => r.category === category);
        const b = valuesFor(results, to, score, (r) => r.category === category);
        const ma = a.length === 0 ? undefined : mean(a);
        const mb = b.length === 0 ? undefined : mean(b);

        if (ma !== undefined && mb !== undefined) {
          const delta = mb - ma;
          cells[score] = { delta: Number(delta.toFixed(4)) };
          rendered.push(signed(delta).padStart(11));
        } else if (mb !== undefined) {
          // The `from` layer did not measure this score at all, so there is no
          // delta to report. A score a layer *introduces* can only be shown as a
          // level; printing 0 would say the layer changed nothing when in fact it
          // was the first to look.
          cells[score] = { introduced: Number(mb.toFixed(4)) };
          rendered.push(`${mb.toFixed(2)} new`.padStart(11));
        } else if (ma !== undefined) {
          cells[score] = { withdrawn: Number(ma.toFixed(4)) };
          rendered.push(`${ma.toFixed(2)} gone`.padStart(11));
        } else {
          cells[score] = null;
          rendered.push('—'.padStart(11));
        }
      }
      cellsOut[category] = cells;
      if (!json) process.stdout.write(`    ${category.padEnd(22)}${rendered.join('')}\n`);
    }
    rows.push(row);
  }

  if (!json) {
    process.stdout.write(
      '\n    A number is a delta. "new" means the first configuration measured that score and the\n' +
        '    second did not, so only a level exists; "gone" is the reverse. "—" means neither did.\n' +
        '    The baseline row is almost all "new" by construction: with every layer switched off,\n' +
        '    there is nothing to compare against, which is the point of having it.\n',
    );
  }

  if (!json) {
    process.stdout.write('\n\nThe hard case\n\n');
    process.stdout.write(
      `  AI pretending to be casual (${meta.byCategory[SUBJECT_CATEGORY] ?? 0} samples) against every\n` +
        `  human-written sample in the corpus (${meta.byProvenance[CONTROL_PROVENANCE] ?? 0} samples).\n` +
        '  Separation is the probability that a random subject sample scores above a random control\n' +
        '  sample: 0.50 means the score cannot tell them apart at all.\n\n',
    );
    process.stdout.write(
      `  ${'configuration'.padEnd(18)}${'score'.padEnd(16)}${'subject'.padStart(8)}${'control'.padStart(9)}${'separation'.padStart(12)}\n`,
    );
  }

  for (const config of configs) {
    for (const score of ['antiAIScore', 'behaviorScore'] as const) {
      const test = testHypothesis(results, config, score);
      if (test.subject.n === 0 || test.control.n === 0) continue;
      hypothesis.push({
        config: config.id,
        score,
        subjectMean: Number(test.subject.mean.toFixed(4)),
        controlMean: Number(test.control.mean.toFixed(4)),
        separation: test.separation === undefined ? null : Number(test.separation.toFixed(4)),
        subjectN: test.subject.n,
        controlN: test.control.n,
      });
      if (!json) {
        process.stdout.write(
          `  ${config.label.padEnd(18)}${score.padEnd(16)}${test.subject.mean.toFixed(2).padStart(8)}` +
            `${test.control.mean.toFixed(2).padStart(9)}` +
            `${(test.separation?.toFixed(2) ?? 'n/a').padStart(12)}\n`,
        );
      }
    }
  }

  const humanFlags = flaggedHumanRules(results, 'full');
  if (!json) {
    process.stdout.write('\n\nRules that fired on human-written samples\n\n');
    if (humanFlags.length === 0) {
      process.stdout.write('  None. No rule fired on any human-written sample under `full`.\n');
    } else {
      process.stdout.write(
        '  These are false positives, listed by name. A count could not be acted on.\n\n',
      );
      for (const tally of humanFlags) {
        process.stdout.write(
          `  ${tally.ruleId.padEnd(46)}${String(tally.firings).padStart(3)}  ${tally.samples.join(', ')}\n`,
        );
      }
    }
  }
  for (const tally of humanFlags) {
    falsePositives.push({
      ruleId: tally.ruleId,
      family: tally.family,
      humanSamples: tally.firings,
      samples: tally.samples,
    });
  }

  if (!json) {
    const tallies = tallyRules(results, 'full');
    process.stdout.write('\n\nEvery rule that fired under `full`\n\n');
    if (tallies.length === 0) {
      process.stdout.write('  Nothing fired.\n');
    } else {
      process.stdout.write(
        `  ${'rule'.padEnd(46)}${'n'.padStart(3)}  categories\n`,
      );
      for (const tally of tallies) {
        process.stdout.write(
          `  ${tally.ruleId.padEnd(46)}${String(tally.firings).padStart(3)}  ${tally.categories.join(', ')}\n`,
        );
      }
      process.stdout.write(
        `\n  ${tallies.length} of ${meta.ruleCount} canonical rules fired somewhere in the corpus.\n` +
          `  ${meta.ruleCount - tallies.length} rules produced no finding on any sample. That is not necessarily a\n` +
          '  defect — a rule can be right and simply not be exercised by this corpus — but an unexercised rule\n' +
          '  is untested against real text, and the count belongs in the record.\n',
      );
    }

    const preservation = configs.some((config) =>
      SCORES.includes('preservationScore') &&
      categories.some(
        (category) => cellFor(results, config, category).preservationScore.unmeasured === 0,
      ),
    );
    if (!preservation) {
      process.stdout.write(
        '\n\npreservationScore was not measured anywhere.\n\n' +
          '  It needs two texts: an original and a candidate rewrite. This run had no recorded candidates,\n' +
          '  so the fourth score is absent rather than perfect, and no claim is made about it.\n' +
          '  Pass `--candidates DIR` to `npm run bench:run` to measure it.\n',
      );
    }
  }

  if (json) process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function main(): number {
  const options = parseArgs(process.argv.slice(2));
  const run = loadRun(path.join(ROOT, 'benchmarks'), options.runFile);
  report(run, options.json);
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  process.stderr.write(`bench:ablation failed: ${String(error)}\n`);
  process.exit(1);
}
