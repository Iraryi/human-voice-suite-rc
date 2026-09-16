#!/usr/bin/env node
/**
 * `npm run bench:compare -- --before FILE --after FILE`
 *
 * Compares two stored runs over the samples they have in common, and reports what
 * changed per rule, per score and per sample.
 *
 * This exists because a rule change has to be *proved*, not asserted. Phase 8
 * changed three rules on the strength of the benchmark's output; without this
 * tool the claim "the fix reduced false positives" would rest on two runs over
 * two slightly different corpora, which is not a comparison. Restricting to the
 * common sample ids is what makes the difference attributable to the code.
 *
 * The output always says how many samples were excluded and why, because a silent
 * intersection is how a comparison flatters itself.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listRuns, loadRun } from './lib/store.js';
import type { StoredRun } from './lib/store.js';
import type { SampleResult } from './lib/score.js';
import type { ScoreName } from '../src/validation/types.js';
import { compareText } from '../src/shared/order.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BENCH = path.resolve(HERE);

interface Options {
  readonly before?: string;
  readonly after?: string;
  readonly config: string;
  readonly rule?: string;
  readonly limit: number;
  readonly json: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  let before: string | undefined;
  let after: string | undefined;
  let config = 'full';
  let rule: string | undefined;
  let limit = 25;
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = (): string => {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      index += 1;
      return value;
    };
    switch (arg) {
      case '--before':
        before = next();
        break;
      case '--after':
        after = next();
        break;
      case '--config':
        config = next();
        break;
      case '--rule':
        rule = next();
        break;
      case '--limit':
        limit = Number(next());
        break;
      case '--json':
        json = true;
        break;
      case '-h':
      case '--help':
        process.stdout.write(
          [
            'Usage: npm run bench:compare -- [options]',
            '',
            'Options:',
            '  --before FILE   The earlier run (default: second most recent)',
            '  --after FILE    The later run (default: most recent)',
            '  --config ID     Which configuration to compare (default: full)',
            '  --rule ID       Focus on one rule',
            '  --limit N       How many changed samples to list (default: 25)',
            '  --json          Print JSON',
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
    ...(before ? { before } : {}),
    ...(after ? { after } : {}),
    config,
    ...(rule ? { rule } : {}),
    limit,
    json,
  };
}

const SCORES: readonly ScoreName[] = [
  'antiAIScore',
  'voiceScore',
  'behaviorScore',
  'preservationScore',
];

function index(results: readonly SampleResult[], config: string): Map<string, SampleResult> {
  const map = new Map<string, SampleResult>();
  for (const row of results) {
    if (row.configId !== config) continue;
    map.set(row.sampleId, row);
  }
  return map;
}

function rulesOf(row: SampleResult | undefined): Set<string> {
  return new Set((row?.findings ?? []).map((finding) => finding.ruleId));
}

function main(): number {
  const options = parseArgs(process.argv.slice(2));
  const files = listRuns(BENCH);
  if (files.length < 2 && !(options.before && options.after)) {
    process.stderr.write(
      `Need two runs to compare; ${BENCH}/runs holds ${files.length}.\n` +
        'Run `npm run bench:run` before and after the change.\n',
    );
    return 1;
  }

  const beforeFile = options.before ?? files[files.length - 2];
  const afterFile = options.after ?? files[files.length - 1];
  if (!beforeFile || !afterFile) {
    process.stderr.write('Could not determine which runs to compare.\n');
    return 1;
  }

  const before: StoredRun = loadRun(BENCH, beforeFile);
  const after: StoredRun = loadRun(BENCH, afterFile);

  const beforeRows = index(before.results, options.config);
  const afterRows = index(after.results, options.config);

  const common = [...beforeRows.keys()].filter((id) => afterRows.has(id)).sort();
  const droppedFromBefore = [...beforeRows.keys()].filter((id) => !afterRows.has(id)).sort();
  const onlyInAfter = [...afterRows.keys()].filter((id) => !beforeRows.has(id)).sort();

  // ---- per rule ------------------------------------------------------------
  const beforeCounts = new Map<string, Set<string>>();
  const afterCounts = new Map<string, Set<string>>();
  for (const id of common) {
    for (const rule of rulesOf(beforeRows.get(id))) {
      if (!beforeCounts.has(rule)) beforeCounts.set(rule, new Set());
      beforeCounts.get(rule)!.add(id);
    }
    for (const rule of rulesOf(afterRows.get(id))) {
      if (!afterCounts.has(rule)) afterCounts.set(rule, new Set());
      afterCounts.get(rule)!.add(id);
    }
  }

  const allRules = [...new Set([...beforeCounts.keys(), ...afterCounts.keys()])].sort();
  const ruleDeltas = allRules
    .map((rule) => ({
      rule,
      before: beforeCounts.get(rule)?.size ?? 0,
      after: afterCounts.get(rule)?.size ?? 0,
    }))
    .map((entry) => ({ ...entry, delta: entry.after - entry.before }))
    .filter((entry) => (options.rule ? entry.rule === options.rule : entry.delta !== 0))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || compareText(a.rule, b.rule));

  // ---- per sample ----------------------------------------------------------
  interface SampleDelta {
    readonly sampleId: string;
    readonly provenance: string;
    readonly category: string;
    readonly scoreDeltas: Readonly<Record<string, number>>;
    readonly gained: readonly string[];
    readonly lost: readonly string[];
  }

  const sampleDeltas: SampleDelta[] = [];
  for (const id of common) {
    const a = beforeRows.get(id);
    const b = afterRows.get(id);
    if (!a || !b) continue;
    const scoreDeltas: Record<string, number> = {};
    for (const score of SCORES) {
      if (a.unmeasured.includes(score) || b.unmeasured.includes(score)) continue;
      const delta = b.scores[score] - a.scores[score];
      if (Math.abs(delta) > 1e-9) scoreDeltas[score] = Number(delta.toFixed(4));
    }
    const aRules = rulesOf(a);
    const bRules = rulesOf(b);
    const gained = [...bRules].filter((rule) => !aRules.has(rule)).sort();
    const lost = [...aRules].filter((rule) => !bRules.has(rule)).sort();
    if (Object.keys(scoreDeltas).length === 0 && gained.length === 0 && lost.length === 0) continue;
    sampleDeltas.push({
      sampleId: id,
      provenance: a.provenance,
      category: a.category,
      scoreDeltas,
      gained,
      lost,
    });
  }
  sampleDeltas.sort(
    (a, b) =>
      (options.rule ? 0 : b.lost.length + b.gained.length - (a.lost.length + a.gained.length)) ||
      compareText(a.sampleId, b.sampleId),
  );

  // ---- per score -----------------------------------------------------------
  const scoreMeans = SCORES.map((score) => {
    const values = (rows: Map<string, SampleResult>): number[] =>
      common
        .map((id) => rows.get(id))
        .filter((row): row is SampleResult => row !== undefined && !row.unmeasured.includes(score))
        .map((row) => row.scores[score]);
    const a = values(beforeRows);
    const b = values(afterRows);
    const mean = (list: number[]): number =>
      list.length === 0 ? 0 : list.reduce((x, y) => x + y, 0) / list.length;
    return {
      score,
      n: Math.min(a.length, b.length),
      before: Number(mean(a).toFixed(4)),
      after: Number(mean(b).toFixed(4)),
      delta: Number((mean(b) - mean(a)).toFixed(4)),
    };
  });

  const payload = {
    before: beforeFile,
    after: afterFile,
    config: options.config,
    corpusBefore: before.meta.corpusHash,
    corpusAfter: after.meta.corpusHash,
    sameCorpus: before.meta.corpusHash === after.meta.corpusHash,
    compared: common.length,
    onlyInBefore: droppedFromBefore,
    onlyInAfter,
    scores: scoreMeans,
    rules: ruleDeltas,
    samples: sampleDeltas,
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return 0;
  }

  process.stdout.write(`\nComparing configuration \`${options.config}\`\n\n`);
  process.stdout.write(`  before : ${beforeFile}\n           corpus ${before.meta.corpusHash}\n`);
  process.stdout.write(`  after  : ${afterFile}\n           corpus ${after.meta.corpusHash}\n\n`);
  process.stdout.write(`  samples compared  : ${common.length}\n`);
  if (!payload.sameCorpus) {
    process.stdout.write(
      '  the corpora differ. Only the samples present in both runs are compared, so the\n' +
        '  difference is attributable to the code — but a rule exercised only by a new sample\n' +
        '  will not appear below at all.\n',
    );
  }
  if (droppedFromBefore.length > 0) {
    process.stdout.write(`  only in before     : ${droppedFromBefore.length} (${droppedFromBefore.slice(0, 6).join(', ')}${droppedFromBefore.length > 6 ? ', …' : ''})\n`);
  }
  if (onlyInAfter.length > 0) {
    process.stdout.write(`  only in after      : ${onlyInAfter.length} (${onlyInAfter.slice(0, 6).join(', ')}${onlyInAfter.length > 6 ? ', …' : ''})\n`);
  }

  process.stdout.write('\nScores over the compared samples\n\n');
  process.stdout.write(`  ${'score'.padEnd(20)}${'n'.padStart(5)}${'before'.padStart(9)}${'after'.padStart(9)}${'delta'.padStart(9)}\n`);
  for (const entry of scoreMeans) {
    process.stdout.write(
      `  ${entry.score.padEnd(20)}${String(entry.n).padStart(5)}${entry.before.toFixed(2).padStart(9)}` +
        `${entry.after.toFixed(2).padStart(9)}${`${entry.delta >= 0 ? '+' : ''}${entry.delta.toFixed(2)}`.padStart(9)}\n`,
    );
  }

  process.stdout.write(`\nRules whose firing changed${options.rule ? ` (filtered to ${options.rule})` : ''}\n\n`);
  if (ruleDeltas.length === 0) {
    process.stdout.write('  None.\n');
  } else {
    process.stdout.write(`  ${'rule'.padEnd(46)}${'before'.padStart(7)}${'after'.padStart(7)}${'delta'.padStart(7)}\n`);
    for (const entry of ruleDeltas) {
      process.stdout.write(
        `  ${entry.rule.padEnd(46)}${String(entry.before).padStart(7)}${String(entry.after).padStart(7)}` +
          `${`${entry.delta >= 0 ? '+' : ''}${entry.delta}`.padStart(7)}\n`,
      );
    }
  }

  const human = sampleDeltas.filter((entry) => entry.provenance === 'human-written');
  process.stdout.write(
    `\nChanged samples: ${sampleDeltas.length}, of which ${human.length} are human-written\n\n`,
  );
  for (const entry of sampleDeltas.slice(0, options.limit)) {
    const scores = Object.entries(entry.scoreDeltas)
      .map(([score, delta]) => `${score} ${delta >= 0 ? '+' : ''}${delta.toFixed(3)}`)
      .join(', ');
    process.stdout.write(
      `  ${entry.sampleId.padEnd(20)}${entry.provenance.padEnd(17)}${scores}\n`,
    );
    if (entry.lost.length > 0) {
      process.stdout.write(`      no longer fires : ${entry.lost.join(', ')}\n`);
    }
    if (entry.gained.length > 0) {
      process.stdout.write(`      now fires       : ${entry.gained.join(', ')}\n`);
    }
  }
  if (sampleDeltas.length > options.limit) {
    process.stdout.write(`  … ${sampleDeltas.length - options.limit} more\n`);
  }
  process.stdout.write('');
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  process.stderr.write(`bench:compare failed: ${String(error)}\n`);
  process.exit(1);
}
