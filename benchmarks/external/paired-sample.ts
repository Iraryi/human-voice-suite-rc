#!/usr/bin/env node
/**
 * `npm run paired:sample`
 *
 * Draw a stratified set of **paired** items from LCCC-base: one context, two
 * replies — the human's, which already exists, and a machine's, which generation
 * adds.
 *
 * ## Why paired, and not "random human versus random machine"
 *
 * Comparing two independently drawn corpora measures the topic, the register, the
 * context length and the reply length all at once. Pairing holds every one of those
 * fixed: the same context, the same length pressure, the same subject, one human
 * continuation against one machine continuation. What is left is the thing being
 * asked about.
 *
 * ## The stratification
 *
 * Five dimensions, because each one is a plausible confound for a rule that claims
 * to detect machine *behaviour*:
 *
 * | Dimension | Why it is controlled |
 * | --- | --- |
 * | single-turn / multi-turn | over-completeness and mirroring are relationships, and a two-utterance session is the simplest relationship there is |
 * | user-input length | a short prompt invites a long answer from a human too |
 * | context length | a long context is a different task from a one-line prompt |
 * | human-reply length | a rule that fires on long replies would otherwise look like a rule that fires on machines |
 * | turn type | a question, a statement and an emotional remark are answered differently by everyone |
 *
 * Two views are written. `natural` keeps LCCC's own proportions, so a claim about
 * rates is a claim about the corpus. `balanced` allocates evenly across the strata,
 * so a claim about a *rule* is not really a claim about which stratum happens to be
 * common. Reporting one without the other would hide which of the two produced a
 * difference.
 *
 * ## The boundary
 *
 * The items contain LCCC text and stay in `.external-corpora/`, which is gitignored.
 * What may be committed is the generated *machine* reply — and only after
 * `paired:report` has shown it, and only for samples reconstructed without LCCC
 * context. See `benchmarks/external/README.md`.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(ROOT, '.external-corpora', 'paired');

import { PROVENANCE_LABEL, EXCEPTION_LABEL } from './labels.js';
import {
  CONTEXT_LENGTH_CUTS,
  CONTEXT_LENGTH_LABELS,
  REPLY_LENGTH_CUTS,
  REPLY_LENGTH_LABELS,
  USER_LENGTH_CUTS,
  USER_LENGTH_LABELS,
  bucket,
  classifyType,
  sessions,
  sourceFiles,
  toItem,
} from './lccc-source.js';
import type { PairedItem } from './lccc-source.js';
import { compareText } from '../../src/shared/order.js';

export { PROVENANCE_LABEL, EXCEPTION_LABEL };
export {
  CONTEXT_LENGTH_CUTS,
  CONTEXT_LENGTH_LABELS,
  REPLY_LENGTH_CUTS,
  REPLY_LENGTH_LABELS,
  USER_LENGTH_CUTS,
  USER_LENGTH_LABELS,
  bucket,
  classifyType,
  toItem,
};
export type { PairedItem };


interface Options {
  readonly perStratum: number;
  readonly naturalTotal: number;
  readonly splits: readonly string[];
  readonly quiet: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  let perStratum = 120;
  let naturalTotal = 2000;
  const splits: string[] = [];
  let quiet = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = (): string => {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      index += 1;
      return value;
    };
    switch (arg) {
      case '--per-stratum':
        perStratum = Number(next());
        break;
      case '--natural':
        naturalTotal = Number(next());
        break;
      case '--split': {
        const value = next();
        if (value !== 'valid' && value !== 'test') throw new Error('--split must be valid or test');
        splits.push(value);
        break;
      }
      case '-q':
      case '--quiet':
        quiet = true;
        break;
      case '-h':
      case '--help':
        process.stdout.write(
          [
            'Usage: npm run paired:sample [options]',
            '',
            'Draws stratified paired items: one LCCC context, one human reply, one machine reply to come.',
            'Writes to .external-corpora/paired/ (gitignored).',
            '',
            'Options:',
            '  --per-stratum N   Items per stratum cell in the balanced view (default 120)',
            '  --natural N       Size of the natural-distribution view (default 2000)',
            '  --split NAME      valid or test (repeatable; default both)',
            '  -q, --quiet       Print only the summary',
            '  -h, --help        Show this help',
            '',
            `  ${PROVENANCE_LABEL}`,
            `  ${EXCEPTION_LABEL}`,
            '',
          ].join('\n'),
        );
        process.exit(0);
        break;
      default:
        if (arg !== undefined && arg.startsWith('-')) throw new Error(`Unknown option ${arg}`);
    }
  }
  return { perStratum, naturalTotal, splits: splits.length > 0 ? splits : ['valid', 'test'], quiet };
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));

  const files = sourceFiles(options.splits);
  if (files.length === 0) {
    process.stderr.write('No LCCC data in .external-corpora/lccc. Fetch it first, see benchmarks/external/README.md.\n');
    return 1;
  }

  const all: PairedItem[] = [];
  const perSplit = new Map<string, number>();
  for (const { split, file } of files) {
    let index = 0;
    for await (const session of sessions(file, split)) {
      index += 1;
      all.push(toItem(split, index, session.utterances));
    }
    perSplit.set(split, index);
  }

  // Deterministic shuffle, then a stable sort by stratum: sampling must be
  // reproducible from the corpus alone, with no clock and no seed file.
  const shuffled = [...all].sort((a, b) => hash(a.id) - hash(b.id) || compareText(a.id, b.id));

  const cell = (item: PairedItem): string =>
    `${item.strata.kind}|${item.strata.userLength}|${item.strata.replyLength}|${item.strata.type}`;

  // ---- balanced: an even allocation across the cells that exist -----------
  const byCell = new Map<string, PairedItem[]>();
  for (const item of shuffled) {
    const key = cell(item);
    const list = byCell.get(key) ?? [];
    list.push(item);
    byCell.set(key, list);
  }
  const balanced: PairedItem[] = [];
  for (const [, items] of [...byCell.entries()].sort((a, b) => compareText(a[0], b[0]))) {
    balanced.push(...items.slice(0, options.perStratum));
  }

  // ---- natural: proportional to LCCC's own distribution ------------------
  const natural: PairedItem[] = [];
  const total = all.length;
  for (const [key, items] of [...byCell.entries()].sort((a, b) => compareText(a[0], b[0]))) {
    const share = Math.max(1, Math.round((items.length / Math.max(1, total)) * options.naturalTotal));
    natural.push(...items.slice(0, share));
    if (key.length === 0) continue;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const write = (name: string, items: readonly PairedItem[]): string => {
    const file = path.join(OUT_DIR, `${name}.jsonl`);
    writeFileSync(file, `${items.map((item) => JSON.stringify(item)).join('\n')}\n`, 'utf8');
    return file;
  };
  write('natural', natural);
  write('balanced', balanced);

  // The committable artefact: counts only, never a context or a reply.
  const census = (items: readonly PairedItem[]): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const item of items) {
      const key = cell(item);
      out[key] = (out[key] ?? 0) + 1;
    }
    return out;
  };
  const manifest = {
    generatedAt: new Date().toISOString(),
    source: 'LCCC-base (thu-coai/CDial-GPT, arXiv 2008.03946), held-out valid + test splits',
    provenance: PROVENANCE_LABEL,
    exception: EXCEPTION_LABEL,
    boundary:
      'Items contain third-party dialogue and stay in .external-corpora/. Only aggregate counts appear here. ' +
      'Any machine positive sample that a future commit depends on must be reconstructed without LCCC context.',
    splits: Object.fromEntries(perSplit),
    sessions: total,
    natural: { items: natural.length, census: census(natural) },
    balanced: { items: balanced.length, cells: byCell.size, census: census(balanced) },
    strata: {
      kind: ['single', 'multi'],
      userLength: { cuts: USER_LENGTH_CUTS, labels: USER_LENGTH_LABELS },
      replyLength: { cuts: REPLY_LENGTH_CUTS, labels: REPLY_LENGTH_LABELS },
      contextLength: { cuts: CONTEXT_LENGTH_CUTS, labels: CONTEXT_LENGTH_LABELS },
      type: ['question', 'emotion', 'chitchat', 'statement'],
    },
  };
  const manifestFile = path.join(OUT_DIR, 'manifest.json');
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  // The same census, in the repository. `.external-corpora/` is gitignored in full, so
  // the local copy above cannot be the one that ships: counts and cell names are what
  // makes the stratification checkable by a reader who has no access to the corpus.
  const censusFile = path.join(HERE, 'paired-census.json');
  writeFileSync(censusFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  if (!options.quiet) {
    process.stdout.write('\nPaired sample\n\n');
    process.stdout.write(`  sessions read      : ${total}\n`);
    process.stdout.write(`  strata cells       : ${byCell.size}\n`);
    process.stdout.write(`  natural view       : ${natural.length} items\n`);
    process.stdout.write(`  balanced view      : ${balanced.length} items\n`);
    process.stdout.write(`  written to         : ${path.relative(ROOT, OUT_DIR).split('\\').join('/')} (gitignored)\n\n`);
    const sizes = [...byCell.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 12);
    process.stdout.write(`  ${'cell'.padEnd(44)}${'available'.padStart(10)}${'balanced'.padStart(10)}\n`);
    for (const [key, items] of sizes) {
      process.stdout.write(`  ${key.padEnd(44)}${String(items.length).padStart(10)}${String(Math.min(items.length, options.perStratum)).padStart(10)}\n`);
    }
    process.stdout.write(`\n  census of the balanced view is in ${path.relative(ROOT, censusFile).split('\\').join('/')}, which is committed: counts only.\n`);
  }
  return 0;
}

/** A stable string hash, for the deterministic shuffle. */
function hash(value: string): number {
  let h = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    h ^= value.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`paired:sample failed: ${String(error)}\n`);
    process.exit(1);
  });


