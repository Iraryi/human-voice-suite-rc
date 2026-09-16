import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

/**
 * The repository boundary, checked rather than asserted in prose.
 *
 * This project measures text it may not redistribute, which means the boundary between
 * "measured locally" and "committed" is a property of the repository, not a habit. These
 * checks are what a licence audit would do by hand: they are cheap enough to run on every
 * push, which is the only way the boundary survives a later commit.
 *
 * See `docs/licence-audit.md` for the audit these implement and for what they cannot prove.
 */
function tracked(): string[] {
  return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

const files = tracked();

describe('the repository boundary', () => {
  it('has files to check, so the test is not vacuous', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('tracks nothing that is meant to stay on this machine', () => {
    const forbidden = [
      '.external-corpora/',
      'profiles/',
      'benchmarks/runs/',
      '.upstream-cache/',
    ];
    const leaked = files.filter((file) => forbidden.some((prefix) => file.startsWith(prefix)));
    expect(leaked, `these are gitignored local material:\n${leaked.join('\n')}`).toEqual([]);
  });

  it('gives every corpus sample a licence and a provenance', () => {
    // Samples are named like their ids, lower case; README.md and the placeholder that
    // marks the empty category are prose about the corpus, not samples in it.
    const samples = files.filter(
      (file) =>
        file.startsWith('benchmarks/corpora/') &&
        /\/[a-z0-9-]+\.md$/.test(file),
    );
    expect(samples.length).toBeGreaterThan(50);
    const missing: string[] = [];
    for (const file of samples) {
      const text = readFileSync(path.join(ROOT, file), 'utf8');
      for (const key of ['licence', 'provenance']) {
        const match = new RegExp(`^${key}:\\s*(.+)$`, 'm').exec(text);
        if (match === null || match[1]!.trim().length === 0) missing.push(`${file} (${key})`);
      }
    }
    expect(missing, `a corpus sample without a licence cannot be published:\n${missing.join('\n')}`).toEqual([]);
  });

  it('keeps unlicensed third-party prose out of everything else', () => {
    // A run of twenty Han characters is longer than any identifier, rule phrase or cell
    // name, and shorter than a sentence of real prose. Text that long, committed
    // elsewhere in the repository, is either this project's own writing, an upstream's
    // example under a preserved notice, or something that should not be here.
    const allowedPrefixes = [
      'benchmarks/corpora/',
      'benchmarks/candidates/',
      'upstreams/',
      'licenses/',
    ];
    // Two different reasons a file is exempt, and they are not the same reason.
    //
    // 1. `tests/dsh-plugin.test.ts` and `tests/extraction-humanizer-zh-cn.test.ts` hold third-party
    //    example text under a preserved MIT notice and assert that it survives a parse. The generated
    //    voice profiles used to be listed here too; they are no longer in the repository at all, which
    //    is why the entry is gone rather than moved. See docs/licence-audit.md.
    // 2. `RELEASE_CANDIDATE.md` is this project's **own** writing, in Chinese, because the release
    //    report is addressed to a reader who asked for Chinese. It quotes no corpus and no upstream:
    //    the run of Han characters is an author's sentence, which is exactly the false positive this
    //    heuristic produces on a Chinese document. The distinction matters — reason 1 says "licensed
    //    third-party text may live here", reason 2 says "this file has no third-party text in it".
    const allowedFiles = new Set([
      'src/upstream/adapters/humanizer-zh-cn/parse.ts',
      'src/upstream/adapters/humanizer-zh-cn/rules.generated.json',
      'src/upstream/adapters/humanizer-zh/rules.generated.json',
      'tests/dsh-plugin.test.ts',
      'tests/extraction-humanizer-zh-cn.test.ts',
      'RELEASE_CANDIDATE.md',
    ]);
    const offenders: string[] = [];
    for (const file of files) {
      if (allowedPrefixes.some((prefix) => file.startsWith(prefix))) continue;
      if (allowedFiles.has(file)) continue;
      if (!/\.(md|ts|json|ya?ml|txt)$/.test(file)) continue;
      const text = readFileSync(path.join(ROOT, file), 'utf8');
      const run = /[\u4e00-\u9fff]{20,}/.exec(text);
      if (run !== null) offenders.push(`${file}: ${run[0].slice(0, 24)}…`);
    }
    expect(offenders, `long Chinese prose outside the licensed corpora:\n${offenders.join('\n')}`).toEqual([]);
  });
});
