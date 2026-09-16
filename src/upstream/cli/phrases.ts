#!/usr/bin/env node
/**
 * `npm run phrases:report`
 *
 * Writes `PHRASE_OWNERSHIP.md`: every watched phrase more than one rule claims,
 * who owns it, who lost it, and whether a curated override decided it.
 *
 * The report exists so the decisions are reviewable. Ownership is what stops one
 * phrase producing two findings, and a mechanism that silently reassigns 79
 * phrases would be worse than the problem it solves.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { resolveProjectRoot } from '../manifest.js';
import { buildRegistryFromExtractions } from '../../rules/canonical/load.js';
import { buildPhraseIndex, matchablePhraseCount, phraseIndexStats } from '../../rules/dedupe/phrases.js';
import { validateOwnershipOverrides } from '../../rules/dedupe/phrases.js';
import { renderOwnershipReport } from '../../rules/dedupe/ownership-report.js';
import { PHRASE_OWNER_OVERRIDES, UNMATCHED_RULES } from '../../rules/aliases/phrase-ownership.js';

interface Options {
  readonly projectRoot: string;
  readonly out: string;
  readonly check: boolean;
  readonly quiet: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  const projectRoot = resolveProjectRoot();
  let out = path.join(projectRoot, 'PHRASE_OWNERSHIP.md');
  let check = false;
  let quiet = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--out': {
        const value = argv[index + 1];
        if (!value) throw new Error('--out requires a path');
        out = path.resolve(value);
        index += 1;
        break;
      }
      case '--check':
        check = true;
        break;
      case '-q':
      case '--quiet':
        quiet = true;
        break;
      case '-h':
      case '--help':
        process.stdout.write(
          [
            'Usage: npm run phrases:report [options]',
            '',
            'Writes PHRASE_OWNERSHIP.md, the review of every contested phrase.',
            '',
            'Options:',
            '  --out FILE   Write to FILE instead of PHRASE_OWNERSHIP.md',
            '  --check      Do not write; exit 1 if the file on disk is stale',
            '  -q, --quiet  Print only the summary',
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

  return { projectRoot, out, check, quiet };
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  const { registry, problems } = await buildRegistryFromExtractions({
    projectRoot: options.projectRoot,
  });

  const rules = registry.list();
  const index = buildPhraseIndex(rules);
  // A curated table that has stopped doing anything is how a curated table rots.
  // Both a stale entry and an unnecessary one are failures here.
  const overrideProblems = validateOwnershipOverrides(rules, PHRASE_OWNER_OVERRIDES);
  const stats = phraseIndexStats(index);
  const meta = new Map(
    rules.map((rule) => [
      rule.id,
      { category: rule.category, severity: rule.severity, phraseCount: matchablePhraseCount(rule) },
    ]),
  );

  // The timestamp is omitted in check mode so the file can be compared byte for
  // byte without a clock making it stale every second.
  const markdown = renderOwnershipReport(index, {
    ...(options.check ? { generatedAt: 'omitted in --check mode' } : {}),
    ruleMeta: meta,
  });

  if (options.check) {
    const existing = await import('node:fs/promises').then((fs) =>
      fs.readFile(options.out, 'utf8').catch(() => null),
    );
    if (existing === null) {
      process.stdout.write(`${options.out} does not exist. Run without --check to create it.\n`);
      return 1;
    }
    const normalise = (text: string): string =>
      text.replace(/^Generated: .*$/m, '').trim();
    if (normalise(existing) !== normalise(markdown)) {
      process.stdout.write(
        `${options.out} is stale. Run npm run phrases:report to regenerate it.\n`,
      );
      return 1;
    }
    process.stdout.write(`${options.out} is current.\n`);
    return 0;
  }

  await writeFile(options.out, markdown, 'utf8');

  if (!options.quiet) {
    process.stdout.write('Phrase ownership\n\n');
    process.stdout.write(`  distinct matchable phrases : ${stats.distinct}\n`);
    process.stdout.write(`  literal / template         : ${stats.literal} / ${stats.template}\n`);
    process.stdout.write(`  contested                  : ${stats.contested}\n`);
    process.stdout.write(`  settled by an override     : ${stats.overridden}\n`);
    process.stdout.write(`  duplicated within one rule : ${stats.selfDuplicates}\n`);
    process.stdout.write(`  findings avoided           : ${stats.findingsAvoided}\n`);
    if (index.excludedRules.length > 0) {
      process.stdout.write(`  rules that match nothing   : ${index.excludedRules.join(', ')}\n`);
      for (const ruleId of index.excludedRules) {
        process.stdout.write(`      ${UNMATCHED_RULES[ruleId]?.split('.')[0] ?? ''}.\n`);
      }
    }
    process.stdout.write(`\nReport written to ${options.out}\n`);
  }

  const failures = [...problems, ...overrideProblems];
  if (failures.length > 0) {
    process.stdout.write(`\n${failures.length} problem(s):\n`);
    for (const problem of failures) process.stdout.write(`  - ${problem}\n`);
    return 1;
  }

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`phrases:report failed: ${String(error)}\n`);
    process.exit(1);
  });
