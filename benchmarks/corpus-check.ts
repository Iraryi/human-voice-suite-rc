#!/usr/bin/env node
/**
 * `npm run bench:check`
 *
 * Validates the corpus without running anything: front matter, licences,
 * provenance, id uniqueness, chat samples with a user turn, and the categories
 * that are unpopulated and why. Exits non-zero on any problem, because a corpus
 * that loads with warnings produces a run nobody can trust.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CATEGORIES, NOISE_FLOOR, loadCorpus } from './lib/corpus.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
/** The directory holding `corpora/` and `runs/`. */
const BENCH = path.join(ROOT, 'benchmarks');

interface Options {
  readonly only: readonly string[];
  readonly json: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  const only: string[] = [];
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--category': {
        const value = argv[index + 1];
        if (!value) throw new Error('--category requires a name');
        only.push(value);
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
            'Usage: npm run bench:check [options]',
            '',
            'Validates benchmarks/corpora without running a measurement.',
            '',
            'Options:',
            '  --category NAME  Only this category (repeatable)',
            '  --json           Print JSON',
            '  -h, --help       Show this help',
            '',
          ].join('\n'),
        );
        process.exit(0);
        break;
      default:
        if (arg !== undefined && arg.startsWith('-')) throw new Error(`Unknown option ${arg}`);
    }
  }
  return { only, json };
}

function main(): number {
  const options = parseArgs(process.argv.slice(2));
  const corpus = loadCorpus(BENCH, options.only.length > 0 ? { only: options.only } : {});

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          hash: corpus.hash,
          samples: corpus.samples.length,
          byCategory: corpus.byCategory,
          byProvenance: corpus.byProvenance,
          languages: countLanguages(corpus),
          thin: corpus.thin,
          unpopulated: corpus.unpopulated,
          partialBehavior: corpus.partialBehavior,
        },
        null,
        2,
      )}\n`,
    );
    return 0;
  }

  process.stdout.write('\nCorpus\n\n');
  process.stdout.write(`  hash       : ${corpus.hash}\n`);
  process.stdout.write(`  samples    : ${corpus.samples.length}\n`);
  process.stdout.write(
    `  provenance : ${Object.entries(corpus.byProvenance).map(([key, value]) => `${key} ${value}`).join(', ')}\n\n`,
  );

  process.stdout.write(`  ${'category'.padEnd(24)}${'n'.padStart(4)}  provenance\n`);
  for (const category of CATEGORIES) {
    const count = corpus.byCategory[category] ?? 0;
    const rows = corpus.samples.filter((sample) => sample.category === category);
    const provenance = [...new Set(rows.map((row) => row.provenance))].sort().join(', ');
    const mark = count === 0 ? ' (unpopulated)' : count < NOISE_FLOOR ? ' (thin)' : '';
    process.stdout.write(
      `  ${category.padEnd(24)}${String(count).padStart(4)}  ${provenance}${mark}\n`,
    );
  }

  for (const entry of corpus.unpopulated) {
    process.stdout.write(`\n  ${entry.category} is unpopulated: ${entry.reason}\n`);
  }
  if (corpus.thin.length > 0) {
    process.stdout.write(
      `\n  ${corpus.thin.length} categor(y|ies) below the ${NOISE_FLOOR}-sample noise floor: ${corpus.thin.join(', ')}\n` +
        '  Runs are still recorded; the report names the shortfall rather than averaging it away.\n',
    );
  }

  const languages = countLanguages(corpus);
  process.stdout.write(`\n  languages  : ${Object.entries(languages).map(([k, v]) => `${k} ${v}`).join(', ')}\n`);

  // The disclosure has to reach a reader, not just sit in a field. A chat sample
  // with no user turn is measured on eight of the ten behaviours, and that is a
  // weaker result than the score alone suggests.
  if (corpus.partialBehavior.length > 0) {
    process.stdout.write(
      `\n  ${corpus.partialBehavior.length} chat sample(s) have no user_turn, so mirroring and\n` +
        '  over-completeness cannot be judged in them and their behaviorScore rests on the other\n' +
        `  eight behaviours: ${corpus.partialBehavior.join(', ')}\n`,
    );
  }

  process.stdout.write('\nThe corpus is valid.\n');
  return 0;
}

function countLanguages(corpus: { readonly samples: readonly { readonly language: string }[] }): Record<string, number> {
  const out: Record<string, number> = {};
  for (const sample of corpus.samples) {
    out[sample.language] = (out[sample.language] ?? 0) + 1;
  }
  return out;
}

try {
  process.exit(main());
} catch (error) {
  process.stderr.write(`bench:check failed: ${String(error)}\n`);
  process.exit(1);
}
