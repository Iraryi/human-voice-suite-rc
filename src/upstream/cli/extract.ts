#!/usr/bin/env node
/**
 * `npm run upstream:extract`
 *
 * Parses each registered upstream clone into `rules.generated.json` and reports
 * what it could not handle. Extraction problems are printed and cause a non-zero
 * exit, because an unmapped signature silently disables deduplication for that
 * rule and the failure is invisible downstream.
 */

import path from 'node:path';

import { loadManifest, resolveProjectRoot } from '../manifest.js';
import { runExtraction } from '../extract/generate.js';
import { deliberatelyNotExtracted, missingTargets } from '../extract/targets.js';
import { extractionProblems } from '../extract/types.js';

interface Options {
  readonly projectRoot: string;
  readonly only: readonly string[];
  readonly quiet: boolean;
  readonly allowProblems: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  const projectRoot = resolveProjectRoot();
  const only: string[] = [];
  let quiet = false;
  let allowProblems = false;
  let root = projectRoot;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--only': {
        const value = argv[index + 1];
        if (!value) throw new Error('--only requires an adapter id');
        only.push(value);
        index += 1;
        break;
      }
      case '--project-root': {
        const value = argv[index + 1];
        if (!value) throw new Error('--project-root requires a path');
        root = path.resolve(value);
        index += 1;
        break;
      }
      case '--allow-problems':
        allowProblems = true;
        break;
      case '-q':
      case '--quiet':
        quiet = true;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg !== undefined && arg.startsWith('-')) throw new Error(`Unknown option ${arg}`);
    }
  }

  return { projectRoot: root, only, quiet, allowProblems };
}

function printHelp(): void {
  process.stdout.write(
    [
      'Usage: npm run upstream:extract [options]',
      '',
      'Parses pinned upstream clones into committed rules.generated.json files.',
      '',
      'Options:',
      '  --only ID           Extract just this adapter.',
      '  --project-root DIR  Treat DIR as the project root.',
      '  --allow-problems    Exit 0 even when a rule has no signature mapping.',
      '  -q, --quiet         Print only the summary.',
      '  -h, --help          Show this help.',
      '',
      'Upstream clones are read-only inputs. Nothing is ever written to them.',
      '',
    ].join('\n'),
  );
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  const log = options.quiet ? () => {} : (m: string) => process.stdout.write(`  ${m}\n`);

  process.stdout.write('Upstream extraction\n');
  const run = await runExtraction({
    projectRoot: options.projectRoot,
    ...(options.only.length > 0 ? { only: options.only } : {}),
    logger: log,
  });

  const manifest = await loadManifest(options.projectRoot);
  const uncovered = missingTargets(manifest.upstreams);
  const researchOnly = deliberatelyNotExtracted(manifest.upstreams);

  process.stdout.write('\n');
  let totalRules = 0;
  let totalDisclosures = 0;
  for (const [adapterId, result] of run.results) {
    totalRules += result.rules.length;
    const weak = result.rules.filter((r) => r.weakAlone).length;
    const disclosures = result.disclosures?.length ?? 0;
    totalDisclosures += disclosures;
    process.stdout.write(
      `${adapterId.padEnd(22)} ${String(result.rules.length).padStart(3)} rules` +
        `  ${String(weak).padStart(2)} weak-alone` +
        `  ${String(result.warnings.length).padStart(2)} warnings` +
        `  ${String(disclosures).padStart(2)} disclosures` +
        `  @${result.sourceCommit.slice(0, 10)}\n`,
    );
  }

  process.stdout.write(`\n${totalRules} rules extracted from ${run.results.size} upstream(s)\n`);
  process.stdout.write(`${run.written.length} file(s) written\n`);

  if (totalDisclosures > 0 && !options.quiet) {
    process.stdout.write(
      `\n${totalDisclosures} deliberate disclosure(s) recorded. These are decisions, not defects:\n`,
    );
    for (const [adapterId, result] of run.results) {
      for (const note of result.disclosures ?? []) {
        process.stdout.write(`  [${adapterId}] ${truncate(note, 150)}\n`);
      }
    }
  }

  if (uncovered.length > 0) {
    process.stdout.write(
      `\nNo extraction target yet: ${uncovered.join(', ')}\n` +
        'These upstreams are registered but not wired in.\n',
    );
  }

  if (researchOnly.length > 0) {
    process.stdout.write(
      `\nNot extracted by design: ${researchOnly.join(', ')}\n` +
        'Research-only upstreams have no target, because nothing may be imported from them.\n',
    );
  }

  if (run.problems.length > 0) {
    process.stdout.write(`\n${run.problems.length} problem(s):\n`);
    for (const problem of run.problems) process.stdout.write(`  - ${problem}\n`);
    if (!options.allowProblems) {
      process.stdout.write(
        '\nUnmapped signatures disable deduplication for those rules. Fix the mapping, or\n' +
          'pass --allow-problems if this is a deliberate intermediate state.\n',
      );
      return 1;
    }
  }

  process.stdout.write('\nNo upstream clone was modified.\n');
  return 0;
}

void extractionProblems;

function truncate(text: string, limit: number): string {
  const flat = text.replace(/\s+/g, ' ');
  return flat.length <= limit ? flat : `${flat.slice(0, limit - 3)}...`;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`upstream:extract failed: ${String(error)}\n`);
    process.exit(1);
  });
