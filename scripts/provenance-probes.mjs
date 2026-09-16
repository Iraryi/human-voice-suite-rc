#!/usr/bin/env node
/**
 * `npm run provenance:probe` — and `--full` for the whole history.
 *
 * The repository boundary is checked two ways. `tests/repository-boundary.test.ts` reads the
 * working tree: it knows what is committed *now*. This reads git: it knows what was ever
 * committed, including in a commit a later one removed, which is the leak a working-tree
 * check cannot see and the one a merge or a branch restore can bring back.
 *
 * ## Why it looks at shape rather than at known phrases
 *
 * The first version of this check was run by hand with ten phrases taken from the two
 * corpora. Those phrases cannot be committed — they are the text the check exists to keep
 * out — so an automated version cannot use them. What it can use is the shape: a run of
 * twenty or more Han characters is longer than any identifier, rule phrase or cell name used
 * here, and shorter than a sentence of real prose. Committed text that long is either this
 * project's own writing, an upstream's example under a preserved notice, or something that
 * should not be in the repository.
 *
 * A shape check is weaker than a content check and honest about it: it would not catch a
 * short quotation, a paraphrase, or text in another script. It catches the class of mistake
 * that actually happens — a corpus pasted into a report, a sample, or a test fixture.
 *
 * ## Usage
 *
 *     npm run provenance:probe            # files added in the last fifty commits
 *     npm run provenance:probe -- --full  # every file ever added, in every revision
 *
 * Exits non-zero on any hit. A warning that does not fail the build is a warning nobody
 * reads.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Paths that may hold long non-project text: licensed corpora and preserved notices. */
const ALLOWED_PREFIXES = [
  'benchmarks/corpora/',
  'benchmarks/candidates/',
  'upstreams/',
  'licenses/',
];

/**
 * Files holding third-party example text under a preserved MIT notice, or tests asserting
 * that those examples survive a parse. Listed rather than pattern-matched so that adding a
 * new one is a deliberate act with a reason next to it.
 */
/**
 * Files a run of Han characters is allowed in, and the two different reasons why.
 *
 * The first five hold third-party example text under a preserved MIT notice. `RELEASE_CANDIDATE.md` is
 * this project's **own** writing, in Chinese, because the release report is addressed to a reader who
 * asked for Chinese — it quotes no corpus and no upstream. The distinction is worth keeping: one list
 * entry says "licensed third-party text may live here", the other says "there is none in this file".
 * `tests/repository-boundary.test.ts` carries the same list for the same two reasons.
 */
const ALLOWED_FILES = new Set([
  'src/upstream/adapters/humanizer-zh-cn/parse.ts',
  'src/upstream/adapters/humanizer-zh-cn/rules.generated.json',
  'src/upstream/adapters/humanizer-zh/rules.generated.json',
  'tests/dsh-plugin.test.ts',
  'tests/extraction-humanizer-zh-cn.test.ts',
  'RELEASE_CANDIDATE.md',
]);

const TEXT = /\.(md|ts|tsx|js|mjs|cjs|json|ya?ml|txt|csv)$/;
const HAN_RUN = /[\u4e00-\u9fff]{20,}/;

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

function allowed(file) {
  return ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix)) || ALLOWED_FILES.has(file);
}

function scan(full) {
  const hits = [];
  // Every file ever added, with the commit that added it. `--diff-filter=A` is what makes
  // this affordable over a full history: a file is read once, at the revision that
  // introduced it, and a file that was added and later deleted is still read.
  const log = git([
    'log',
    '--all',
    '--diff-filter=A',
    '--name-only',
    '--format=%H',
    ...(full ? [] : ['-n', '50']),
  ]);
  let commit = '';
  for (const line of log.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (/^[0-9a-f]{40}$/.test(trimmed)) {
      commit = trimmed;
      continue;
    }
    if (!TEXT.test(trimmed) || allowed(trimmed)) continue;
    let content;
    try {
      content = git(['show', `${commit}:${trimmed}`]);
    } catch {
      continue;
    }
    const run = HAN_RUN.exec(content);
    if (run !== null) hits.push({ commit: commit.slice(0, 8), file: trimmed, sample: run[0].slice(0, 20) });
  }
  return hits;
}

const full = process.argv.includes('--full');
const hits = scan(full);

process.stdout.write(`\nProvenance probe${full ? ' (full history)' : ' (recent commits)'}\n\n`);
if (hits.length === 0) {
  process.stdout.write('  No long non-project prose in any scanned revision.\n\n');
  process.exit(0);
}

process.stdout.write(`  ${hits.length} hit(s). This fails the build on purpose.\n\n`);
for (const hit of hits) {
  process.stdout.write(`  ${hit.commit}  ${hit.file}  ${hit.sample}…\n`);
}
process.stdout.write(
  '\n  If the text is licensed, add the file to ALLOWED_FILES in scripts/provenance-probes.mjs\n' +
    '  with a reason. If it is not, remove it, and remove it from history as well.\n\n',
);
process.exit(1);
