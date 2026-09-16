#!/usr/bin/env node
/**
 * `npm run bench:run`
 *
 * Runs every ablation configuration against every sample and stores the result in
 * `benchmarks/runs/`. Prints the configuration × category matrix and the rule
 * tallies, so a run that produced nothing surprising is visible immediately.
 *
 * Options that matter:
 *   --category NAME    only this category
 *   --config ID        only this configuration
 *   --candidates DIR   recorded candidate rewrites, enabling preservationScore
 *   --json             print the summary as JSON instead of a table
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { createToolkit } from '../src/dsh/tools/runtime.js';
import { version as VERSION } from '../src/version.js';
import { CONFIGS, configById } from './lib/configs.js';
import { CATEGORIES, NOISE_FLOOR, loadCorpus } from './lib/corpus.js';
import type { Corpus } from './lib/corpus.js';
import { learnProfileFor } from './lib/profile.js';
import { runAll } from './lib/score.js';
import type { SampleResult } from './lib/score.js';
import { cellFor, flaggedHumanRules, tallyRules } from './lib/stats.js';
import { saveRun } from './lib/store.js';
import type { RunMeta } from './lib/store.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
/** The directory holding `corpora/` and `runs/`. */
const BENCH = path.join(ROOT, 'benchmarks');

interface Options {
  readonly categories: readonly string[];
  readonly configs: readonly string[];
  readonly candidatesDir?: string;
  readonly json: boolean;
  readonly quiet: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  const categories: string[] = [];
  const configs: string[] = [];
  let candidatesDir: string | undefined;
  let json = false;
  let quiet = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--category': {
        const value = argv[index + 1];
        if (!value) throw new Error('--category requires a name');
        if (!(CATEGORIES as readonly string[]).includes(value)) {
          throw new Error(`unknown category ${value}; known: ${CATEGORIES.join(', ')}`);
        }
        categories.push(value);
        index += 1;
        break;
      }
      case '--config': {
        const value = argv[index + 1];
        if (!value) throw new Error('--config requires an id');
        if (!configById(value)) throw new Error(`unknown config ${value}`);
        configs.push(value);
        index += 1;
        break;
      }
      case '--candidates': {
        const value = argv[index + 1];
        if (!value) throw new Error('--candidates requires a directory');
        candidatesDir = path.resolve(value);
        index += 1;
        break;
      }
      case '--json':
        json = true;
        break;
      case '-q':
      case '--quiet':
        quiet = true;
        break;
      case '-h':
      case '--help':
        process.stdout.write(
          [
            'Usage: npm run bench:run [options]',
            '',
            'Runs the ablation matrix and stores it under benchmarks/runs/.',
            '',
            'Options:',
            '  --category NAME    Only this category (repeatable)',
            '  --config ID        Only this configuration (repeatable)',
            '  --candidates DIR   Recorded candidate rewrites, <sample-id>.md',
            '  --json             Print JSON instead of a table',
            '  -q, --quiet        Store the run and print only the header',
            '  -h, --help         Show this help',
            '',
            'No model is called. The harness measures; it never rewrites.',
            '',
          ].join('\n'),
        );
        process.exit(0);
        break;
      default:
        if (arg !== undefined && arg.startsWith('-')) throw new Error(`Unknown option ${arg}`);
    }
  }

  return {
    categories,
    configs,
    ...(candidatesDir ? { candidatesDir } : {}),
    json,
    quiet,
  };
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

function num(value: number, unmeasured = 0, width = 7): string {
  const text = unmeasured > 0 ? `${value.toFixed(2)}*${unmeasured}` : value.toFixed(2);
  return pad(text, width);
}

function printMatrix(corpus: Corpus, results: readonly SampleResult[]): void {
  const categories = CATEGORIES.filter((category) => (corpus.byCategory[category] ?? 0) > 0);
  process.stdout.write('\nantiAIScore by configuration and category\n\n');
  process.stdout.write(`${pad('category', 22)}${pad('n', 4)}`);
  for (const config of CONFIGS) process.stdout.write(pad(config.label, 18));
  process.stdout.write('\n');

  for (const category of categories) {
    process.stdout.write(pad(category, 22));
    process.stdout.write(pad(String(corpus.byCategory[category] ?? 0), 4));
    for (const config of CONFIGS) {
      const cell = cellFor(results, config, category);
      process.stdout.write(pad(cell.antiAIScore.mean.toFixed(2), 18));
    }
    process.stdout.write('\n');
  }

  process.stdout.write('\nbehaviorScore by configuration and category\n\n');
  process.stdout.write(`${pad('category', 22)}${pad('n', 4)}`);
  for (const config of CONFIGS) process.stdout.write(pad(config.label, 18));
  process.stdout.write('\n');
  for (const category of categories) {
    process.stdout.write(pad(category, 22));
    process.stdout.write(pad(String(corpus.byCategory[category] ?? 0), 4));
    for (const config of CONFIGS) {
      const cell = cellFor(results, config, category);
      process.stdout.write(
        pad(
          cell.behaviorScore.unmeasured === cell.counts.samples
            ? '-'
            : cell.behaviorScore.mean.toFixed(2),
          18,
        ),
      );
    }
    process.stdout.write('\n');
  }
  process.stdout.write('\n* marks a score which was unmeasured for some samples.\n');
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();

  const corpus = loadCorpus(BENCH, options.categories.length > 0 ? { only: options.categories } : {});
  const configs = options.configs.length > 0
    ? CONFIGS.filter((config) => options.configs.includes(config.id))
    : CONFIGS;

  if (corpus.samples.length === 0) {
    process.stderr.write('The corpus is empty. Nothing to measure.\n');
    return 1;
  }

  const toolkit = await createToolkit({ projectRoot: ROOT });

  const results = await runAll(
    toolkit,
    corpus.samples,
    configs,
    {
      profileFor: (sample) => learnProfileFor(corpus, sample),
      ...(options.candidatesDir ? { candidatesDir: options.candidatesDir } : {}),
    },
    options.quiet || options.json
      ? undefined
      : (done, total) => {
          if (done % 20 === 0 || done === total) {
            process.stderr.write(`\r  ${done}/${total} measurements`);
          }
        },
  );
  if (!options.quiet && !options.json) process.stderr.write('\n');

  const meta: RunMeta = {
    suiteVersion: VERSION,
    corpusHash: corpus.hash,
    corpusRoot: path.relative(ROOT, join(corpus.root, 'corpora')).split('\\').join('/'),
    byCategory: corpus.byCategory,
    byProvenance: corpus.byProvenance,
    thin: corpus.thin,
    unpopulated: corpus.unpopulated,
    partialBehavior: corpus.partialBehavior,
    configs: configs.map((config) => ({
      id: config.id,
      label: config.label,
      question: config.question,
    })),
    startedAt,
    finishedAt: new Date().toISOString(),
    ...(options.candidatesDir
      ? { candidatesDir: path.relative(ROOT, options.candidatesDir).split('\\').join('/') }
      : {}),
    ruleCount: toolkit.registry.list().length,
    note:
      'No model was called. Each configuration measures the sample text as written; preservationScore is ' +
      'measured only where a recorded candidate rewrite exists.',
  };

  const file = saveRun(BENCH, meta, results);

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ meta, file, cells: summariseCells(corpus, results) }, null, 2)}\n`);
    return 0;
  }

  process.stdout.write(`\nHuman Voice Suite ${VERSION} — benchmark run\n\n`);
  process.stdout.write(`  corpus hash        : ${corpus.hash}\n`);
  process.stdout.write(`  samples            : ${corpus.samples.length}\n`);
  process.stdout.write(`  provenance         : ${Object.entries(corpus.byProvenance).map(([k, v]) => `${k} ${v}`).join(', ')}\n`);
  process.stdout.write(`  configurations     : ${configs.length}\n`);
  process.stdout.write(`  canonical rules    : ${meta.ruleCount}\n`);
  process.stdout.write(`  measurements       : ${results.length}\n`);
  if (corpus.thin.length > 0) {
    process.stdout.write(
      `  below ${NOISE_FLOOR} samples   : ${corpus.thin.join(', ')} — differences here are inside the noise\n`,
    );
  }
  for (const entry of corpus.unpopulated) {
    process.stdout.write(`  not populated      : ${entry.category} — ${entry.reason}\n`);
  }
  if (corpus.partialBehavior.length > 0) {
    process.stdout.write(
      `  partial behaviour  : ${corpus.partialBehavior.length} chat sample(s) with no user_turn, judged on 8 of 10 behaviours (${corpus.partialBehavior.join(', ')})\n`,
    );
  }
  process.stdout.write(`\nRun stored as benchmarks/runs/${file}\n`);

  if (!options.quiet) {
    printMatrix(corpus, results);

    const tallies = tallyRules(results, 'full');
    process.stdout.write(`\nRules that fired under \`full\`: ${tallies.length}\n`);
    for (const tally of tallies.slice(0, 15)) {
      process.stdout.write(
        `  ${pad(tally.ruleId, 44)}${pad(String(tally.firings), 4)} ${tally.categories.join(', ')}\n`,
      );
    }

    const falsePositives = flaggedHumanRules(results, 'full').filter((tally) =>
      tally.samples.some((sample) =>
        results.some((row) => row.sampleId === sample && row.provenance === 'human-written'),
      ),
    );
    if (falsePositives.length > 0) {
      process.stdout.write('\nRules that fired on human-written samples (false positives to review):\n');
      for (const tally of falsePositives.slice(0, 15)) {
        process.stdout.write(
          `  ${pad(tally.ruleId, 44)}${pad(String(tally.firings), 4)} ${tally.samples.join(', ')}\n`,
        );
      }
    }
    process.stdout.write('\nRun `npm run bench:report` to render BENCHMARK_RESULTS.md.\n');
  }

  return 0;
}

function summariseCells(corpus: Corpus, results: readonly SampleResult[]): unknown {
  const out: Record<string, Record<string, unknown>> = {};
  for (const config of CONFIGS) {
    const perCategory: Record<string, unknown> = {};
    out[config.id] = perCategory;
    for (const category of CATEGORIES) {
      if ((corpus.byCategory[category] ?? 0) === 0) continue;
      const cell = cellFor(results, config, category);
      // A cell where every sample was unmeasured has no mean. Printing 0 would
      // read as "the worst possible score" when it means "nothing was looked at".
      const asNumber = (summary: { readonly n: number; readonly mean: number }): number | null =>
        summary.n === 0 ? null : Number(summary.mean.toFixed(4));
      perCategory[category] = {
        n: cell.counts.samples,
        antiAIScore: asNumber(cell.antiAIScore),
        behaviorScore: asNumber(cell.behaviorScore),
        voiceScore: asNumber(cell.voiceScore),
        preservationScore: asNumber(cell.preservationScore),
        unmeasured: {
          antiAIScore: cell.antiAIScore.unmeasured,
          behaviorScore: cell.behaviorScore.unmeasured,
          voiceScore: cell.voiceScore.unmeasured,
          preservationScore: cell.preservationScore.unmeasured,
        },
        flagged: cell.flagged,
        assistantShaped: cell.assistantShaped,
      };
    }
  }
  return out;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`bench:run failed: ${String(error)}\n`);
    process.exit(1);
  });
