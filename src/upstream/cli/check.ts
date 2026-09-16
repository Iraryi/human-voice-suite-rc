#!/usr/bin/env node
/**
 * `npm run upstream:check`
 *
 * Checks every upstream for new commits, produces a diff report and writes
 * `UPSTREAM_UPDATE_REPORT.md`. It never modifies local code and it never
 * modifies an upstream clone beyond a read-only `git fetch`.
 */

import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import { resolveProjectRoot } from '../manifest.js';
import { renderUpdateReport, runUpstreamCheck } from '../sync.js';

interface CliOptions {
  readonly offline: boolean;
  readonly fetch: boolean;
  readonly projectRoot: string;
  readonly outFile: string;
  readonly quiet: boolean;
}

function parseArgs(argv: readonly string[]): CliOptions {
  const projectRoot = resolveProjectRoot();
  let offline = false;
  let fetch = true;
  let root = projectRoot;
  let outFile = path.join(projectRoot, 'UPSTREAM_UPDATE_REPORT.md');
  let quiet = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--offline':
        offline = true;
        fetch = false;
        break;
      case '--no-fetch':
        fetch = false;
        break;
      case '--quiet':
      case '-q':
        quiet = true;
        break;
      case '--project-root': {
        const value = argv[index + 1];
        if (!value) throw new Error('--project-root requires a path');
        root = path.resolve(value);
        outFile = path.join(root, 'UPSTREAM_UPDATE_REPORT.md');
        index += 1;
        break;
      }
      case '--out': {
        const value = argv[index + 1];
        if (!value) throw new Error('--out requires a path');
        outFile = path.resolve(value);
        index += 1;
        break;
      }
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (arg !== undefined && arg.startsWith('-')) {
          throw new Error(`Unknown option ${arg}`);
        }
    }
  }

  return { offline, fetch, projectRoot: root, outFile, quiet };
}

function printHelp(): void {
  process.stdout.write(
    [
      'Usage: npm run upstream:check [options]',
      '',
      'Options:',
      '  --offline           Report local clone state only. No network access.',
      '  --no-fetch          Do not fetch into clones; diffs may be unavailable.',
      '  --project-root DIR  Treat DIR as the project root.',
      '  --out FILE          Write the report to FILE.',
      '  -q, --quiet         Print only the summary.',
      '  -h, --help          Show this help.',
      '',
      'This command never modifies local source and never writes to an upstream.',
      '',
    ].join('\n'),
  );
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  const log = options.quiet ? () => {} : (message: string) => process.stdout.write(`  ${message}\n`);

  process.stdout.write(`Upstream check (${options.offline ? 'offline' : 'online'})\n`);
  const report = await runUpstreamCheck({
    projectRoot: options.projectRoot,
    offline: options.offline,
    fetch: options.fetch,
    logger: log,
  });

  const markdown = renderUpdateReport(report);
  await writeFile(options.outFile, markdown, 'utf8');

  const { summary } = report;
  process.stdout.write(
    [
      '',
      `Upstreams checked : ${summary.total}`,
      `Up to date        : ${summary.upToDate}`,
      `Updates available : ${summary.updateAvailable}`,
      `Clones missing    : ${summary.cloneMissing}`,
      `Remote unknown    : ${summary.remoteUnknown}`,
      `Licence alerts    : ${summary.licenseAlerts}`,
      `Rule changes      : ${summary.ruleChanges}`,
      '',
      `Report written to ${options.outFile}`,
      'No local code was modified.',
      '',
    ].join('\n'),
  );

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`upstream:check failed: ${String(error)}\n`);
    process.exit(1);
  });
