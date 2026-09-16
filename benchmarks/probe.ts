#!/usr/bin/env node
/**
 * `npm run bench:probe`
 *
 * Why did a rule fire on that sample? This prints the measurements behind a
 * finding — per-dimension voice scores, the findings themselves, and what the
 * suppression policy dropped — so that a threshold can be argued from numbers
 * instead of from intuition.
 *
 * Phase 8 exists because the benchmark showed rules firing far more often than
 * the tells they name occur. Changing a threshold without this tool means
 * guessing, and a guess recorded in a commit message is indistinguishable from a
 * regression six months later.
 *
 * Usage:
 *   npm run bench:probe -- --sample zh-prose-0007
 *   npm run bench:probe -- --rule rhythm.repeated_openings
 *   npm run bench:probe -- --rule stylometry.fingerprint_punctuation --dimensions
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createToolkit } from '../src/dsh/tools/runtime.js';
import { compareToProfile } from '../src/voice/scoring/index.js';
import { loadCorpus } from './lib/corpus.js';
import { learnProfileFor } from './lib/profile.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const BENCH = path.join(ROOT, 'benchmarks');

interface Options {
  readonly sampleId?: string;
  readonly ruleId?: string;
  readonly dimensions: boolean;
  readonly limit: number;
}

function parseArgs(argv: readonly string[]): Options {
  let sampleId: string | undefined;
  let ruleId: string | undefined;
  let dimensions = false;
  let limit = 10;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--sample': {
        sampleId = argv[index + 1];
        if (!sampleId) throw new Error('--sample requires an id');
        index += 1;
        break;
      }
      case '--rule': {
        ruleId = argv[index + 1];
        if (!ruleId) throw new Error('--rule requires an id');
        index += 1;
        break;
      }
      case '--dimensions':
        dimensions = true;
        break;
      case '--limit': {
        const value = Number(argv[index + 1]);
        if (!Number.isFinite(value)) throw new Error('--limit requires a number');
        limit = value;
        index += 1;
        break;
      }
      case '-h':
      case '--help':
        process.stdout.write(
          [
            'Usage: npm run bench:probe -- [options]',
            '',
            'Options:',
            '  --sample ID     Explain one sample',
            '  --rule ID       Show every sample a rule fired on',
            '  --dimensions    Print per-dimension voice scores',
            '  --limit N       How many samples to probe (default 10)',
            '  -h, --help      Show this help',
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
    ...(sampleId ? { sampleId } : {}),
    ...(ruleId ? { ruleId } : {}),
    dimensions,
    limit,
  };
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  const corpus = loadCorpus(BENCH);

  const selected = options.ruleId
    ? []
    : corpus.samples.filter((sample) => !options.sampleId || sample.id === options.sampleId);
  if (!options.ruleId && selected.length === 0) {
    process.stderr.write(`No sample matches ${options.sampleId}. Known ids:\n`);
    for (const sample of corpus.samples) process.stderr.write(`  ${sample.id}\n`);
    return 1;
  }

  const toolkit = await createToolkit({ projectRoot: ROOT });

  const probe = async (sample: (typeof corpus.samples)[number]): Promise<boolean> => {
    const profile = learnProfileFor(corpus, sample);
    const scanned = await toolkit.scan({
      text: sample.body,
      language: sample.language === 'unknown' ? undefined : sample.language,
      mode: sample.mode,
      ...(profile ? { voiceProfile: profile } : {}),
      ...(sample.userTurn !== undefined ? { conversation: { userTurn: sample.userTurn } } : {}),
    });

    const matching = options.ruleId
      ? scanned.canonicalFindings.filter(
          (finding) => (finding.canonicalRuleId ?? finding.ruleId) === options.ruleId,
        )
      : scanned.canonicalFindings;

    if (options.ruleId && matching.length === 0) return false;

    process.stdout.write(
      `\n=== ${sample.id} (${sample.category}, ${sample.language}, ${sample.provenance})\n`,
    );
    process.stdout.write(`    ${sample.source}\n`);

    if (options.dimensions && profile) {
      const comparison = compareToProfile(sample.body, profile, { mode: sample.mode });
      process.stdout.write(`    profile ${profile.id}, voiceScore ${comparison.voiceScore.toFixed(3)}\n`);
      for (const dimension of comparison.dimensions) {
        process.stdout.write(
          `      ${dimension.measured ? ' ' : '-'} ${dimension.name.padEnd(20)}` +
            `${dimension.score.toFixed(3)}  w=${dimension.weight}  ${dimension.detail}\n`,
        );
      }
    }

    for (const finding of (options.ruleId ? matching : scanned.canonicalFindings)) {
      process.stdout.write(
        `    [${finding.family}] ${finding.canonicalRuleId ?? finding.ruleId} ` +
          `sev=${finding.severity} conf=${finding.confidence} — ${finding.message}\n`,
      );
      for (const evidence of finding.evidence.slice(0, 3)) {
        process.stdout.write(`        "${evidence.text.slice(0, 120)}"\n`);
      }
    }

    if (scanned.suppressed.length > 0) {
      process.stdout.write(`    suppressed by policy: ${scanned.suppressed.length}\n`);
      for (const entry of scanned.suppressed.slice(0, 3)) {
        process.stdout.write(
          `        ${entry.finding.canonicalRuleId ?? entry.finding.ruleId}: ${entry.reason}\n`,
        );
      }
    }

    process.stdout.write(
      `    scores: antiAI ${scanned.scores.antiAIScore.toFixed(3)} ` +
        `behaviour ${scanned.scores.behaviorScore.toFixed(3)} ` +
        `voice ${scanned.scores.voiceScore.toFixed(3)}` +
        (scanned.scores.unmeasured && scanned.scores.unmeasured.length > 0
          ? ` (unmeasured: ${scanned.scores.unmeasured.join(', ')})`
          : '') +
        '\n',
    );

    return true;
  };

  if (options.ruleId) {
    let shown = 0;
    for (const sample of corpus.samples) {
      if (shown >= options.limit) break;
      if (await probe(sample)) shown += 1;
    }
    if (shown === 0) process.stdout.write(`\n${options.ruleId} fired on no sample.\n`);
    return 0;
  }

  for (const sample of selected) await probe(sample);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`bench:probe failed: ${String(error)}\n`);
    process.exit(1);
  });
