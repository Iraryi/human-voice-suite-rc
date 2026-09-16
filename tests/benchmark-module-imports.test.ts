import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const BENCH = path.join(ROOT, 'benchmarks');

function walk(directory: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

const files = walk(BENCH);
const sources = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]));

/**
 * Modules another benchmark module imports.
 *
 * These are the ones whose import must not do anything: importing `paired-generate.ts` for
 * its condition list ran the generator's command line, and the same mistake has now been
 * made four times — twice with a condition list, once with a refusal pattern, once with a
 * bucket list. Each time it printed a usage message and called `process.exit`, which is
 * how a report silently becomes a no-op.
 */
function importedTargets(): string[] {
  const targets = new Set<string>();
  for (const [file, source] of sources) {
    for (const line of source.split('\n')) {
      // `import type` is erased at compile time, so a type-only edge is not a runtime
      // import and importing the target is not something that can happen by accident.
      if (/^\s*import\s+type\b/.test(line)) continue;
      const match = /from\s+'(\.[^']+)\.js'/.exec(line);
      if (match === null) continue;
      const resolved = path.resolve(path.dirname(file), `${match[1]}.ts`);
      if (sources.has(resolved)) targets.add(resolved);
    }
  }
  return [...targets].sort();
}

const targets = importedTargets();

describe('importing a benchmark module has no side effects', () => {
  it('finds modules that are imported, so the test is not vacuous', () => {
    expect(targets.length).toBeGreaterThan(3);
  });

  it.each(targets.map((file) => [path.relative(ROOT, file), file] as const))(
    '%s',
    (relative, file) => {
      // A command-line tool that does its work on import prints its usage here and exits
      // non-zero; a module that only defines things prints nothing.
      const run = (): string =>
        execFileSync(
          process.execPath,
          [
            '--import',
            'tsx',
            '--input-type=module',
            '-e',
            `await import(${JSON.stringify(pathToFileURL(file).href)})`,
          ],
          {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 120_000,
          },
        );
      let stdout = '';
      try {
        stdout = run();
      } catch (error) {
        const failure = error as { stdout?: string; stderr?: string; status?: number };
        throw new Error(
          `importing ${relative} exited ${String(failure.status)}; it must not run anything on import.\n` +
            `${(failure.stdout ?? '').slice(0, 400)}${(failure.stderr ?? '').slice(0, 400)}`,
        );
      }
      expect(stdout.trim(), `${relative} printed on import`).toBe('');
    },
    180_000,
  );
});
