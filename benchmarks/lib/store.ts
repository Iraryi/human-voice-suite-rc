/**
 * Stored runs.
 *
 * A run is a file, not a number in a console. `benchmarks/README.md` §5 requires
 * that every published figure be reproducible from a stored run, and requires the
 * corpus hash in the output, so a run that cannot say which corpus it measured is
 * refused here.
 *
 * `runs/` is gitignored: runs are large and repeatable. `BENCHMARK_RESULTS.md` is
 * committed, and it records the hash of the run it was rendered from.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import type { AblationConfig } from './configs.js';
import type { SampleResult } from './score.js';

export interface RunMeta {
  readonly suiteVersion: string;
  readonly corpusHash: string;
  readonly corpusRoot: string;
  readonly byCategory: Readonly<Record<string, number>>;
  readonly byProvenance: Readonly<Record<string, number>>;
  readonly thin: readonly string[];
  readonly unpopulated: ReadonlyArray<{ readonly category: string; readonly reason: string }>;
  /**
   * Chat samples with no user turn, where two of the ten behaviours cannot be
   * judged. Carried into the run so the report can disclose a weaker measurement
   * rather than let `behaviorScore` look fully earned.
   */
  readonly partialBehavior: readonly string[];
  readonly configs: ReadonlyArray<Pick<AblationConfig, 'id' | 'label' | 'question'>>;
  readonly startedAt: string;
  readonly finishedAt: string;
  /** Where recorded candidate rewrites came from, when there were any. */
  readonly candidatesDir?: string;
  readonly ruleCount: number;
  readonly note: string;
}

export interface StoredRun {
  readonly meta: RunMeta;
  readonly results: readonly SampleResult[];
  /** File name inside `runs/`, for citing. */
  readonly file: string;
}

export function runsDirectory(root: string): string {
  return join(root, 'runs');
}

export function saveRun(root: string, meta: RunMeta, results: readonly SampleResult[]): string {
  const directory = runsDirectory(root);
  mkdirSync(directory, { recursive: true });
  const stamp = meta.finishedAt.replace(/[:.]/g, '-');
  const file = `${stamp}-${meta.corpusHash.slice(7, 15)}.json`;
  writeFileSync(join(directory, file), `${JSON.stringify({ meta, results }, null, 1)}\n`, 'utf8');
  return file;
}

export function loadRun(root: string, file?: string): StoredRun {
  const directory = runsDirectory(root);
  if (!existsSync(directory)) {
    throw new Error(`no runs at ${directory}. Run \`npm run bench:run\` first.`);
  }
  const chosen =
    file ??
    readdirSync(directory)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .at(-1);
  if (!chosen) throw new Error(`${directory} holds no runs. Run \`npm run bench:run\` first.`);

  const parsed = JSON.parse(readFileSync(join(directory, chosen), 'utf8')) as {
    meta: RunMeta;
    results: SampleResult[];
  };
  if (typeof parsed.meta?.corpusHash !== 'string') {
    throw new Error(`${chosen} has no corpus hash. A run whose corpus is unknown compared with nothing.`);
  }
  return { meta: parsed.meta, results: parsed.results, file: chosen };
}

export function listRuns(root: string): string[] {
  const directory = runsDirectory(root);
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort();
}
