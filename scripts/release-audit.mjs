#!/usr/bin/env node
/**
 * `npm run release:audit`
 *
 * The checks a release needs that a test suite does not perform: what is in the repository
 * that should not be, what is claimed in it that is no longer true, and what a stranger
 * would find in it that the author cannot see.
 *
 * ## Why this is separate from the test suite
 *
 * The suite checks behaviour. These check the *artefact*: a machine's home directory in a
 * committed path, a token in a fixture, a stale claim in a report that a later phase
 * withdrew, a score that reads as a probability. None of them would fail a test, and all of
 * them would embarrass a release.
 *
 * ## What it cannot prove
 *
 * It is a text scan. It cannot prove a licence is compatible, only that the repository does
 * not claim more than the licences support. It cannot prove no third-party text is present,
 * only that nothing matches the shapes third-party text takes here — a paraphrase would
 * pass. `tests/repository-boundary.test.ts` and `scripts/provenance-probes.mjs` cover the
 * other two thirds of that question, by file location and by git history.
 *
 * Every check prints its finding rather than only a verdict, because "audit failed" is not
 * something a reader can act on.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const TEXT_EXTENSIONS = /\.(md|ts|mjs|cjs|js|json|ya?ml|txt|html|css)$/;
const MAX_BYTES = 1024 * 1024;

/** Files that legitimately contain the patterns below, named with the reason. */
const EXEMPT = new Map([
  ['scripts/release-audit.mjs', 'this file names every pattern it searches for'],
  ['docs/licence-audit.md', 'the audit that quotes the boundaries it checks'],
  ['src/validation/types.ts', 'the forbidden-score key list, which has to spell them out'],
  ['tests/registry-load.test.ts', 'the test that asserts the forbidden keys never appear in output'],
  ['tests/release-audit.test.ts', 'the test that asserts this scan is not vacuous'],
]);

const CHECKS = [];
function check(name, fn) {
  CHECKS.push({ name, fn });
}

function tracked() {
  return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function read(relative) {
  return readFileSync(path.join(ROOT, relative), 'utf8');
}

/** Lines of a file matching a pattern, with 1-based line numbers, capped for legibility. */
function grep(relative, pattern, limit = 6) {
  const hits = [];
  const lines = read(relative).split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (pattern.test(line)) hits.push(`${relative}:${index + 1}: ${line.trim().slice(0, 140)}`);
    if (hits.length >= limit) break;
  }
  return hits;
}

const files = tracked();
const textFiles = files.filter((file) => TEXT_EXTENSIONS.test(file) && !EXEMPT.has(file));

// ---------------------------------------------------------------------------------------
// 1. Nothing local, nothing enormous
// ---------------------------------------------------------------------------------------
check('tracks nothing local, generated or oversized', () => {
  const forbiddenPrefixes = [
    '.external-corpora/',
    '.upstream-cache/',
    'profiles/',
    'benchmarks/runs/',
    'node_modules/',
    'dist/',
    'coverage/',
  ];
  const forbiddenNames = [/^\.env/, /author-voices\.generated\.json$/, /\.local$/, /\.tmp-/];
  const findings = [];
  for (const file of files) {
    if (forbiddenPrefixes.some((prefix) => file.startsWith(prefix))) {
      findings.push(`${file}: local-only material is tracked`);
    }
    if (forbiddenNames.some((pattern) => pattern.test(path.basename(file)))) {
      findings.push(`${file}: matches a name that must not be committed`);
    }
  }
  for (const file of files) {
    const size = statSync(path.join(ROOT, file)).size;
    if (size > MAX_BYTES) findings.push(`${file}: ${(size / 1024 / 1024).toFixed(2)} MiB is over the 1 MiB cap`);
  }
  return findings;
});

// ---------------------------------------------------------------------------------------
// 2. No machine, no author
// ---------------------------------------------------------------------------------------
check('carries no absolute path, home directory or user name', () => {
  const patterns = [
    [/[A-Za-z]:\\\\?Users\\\\?[^\\\s"']+/g, 'a Windows home directory'],
    [/[A-Za-z]:\\Users\\[^\\\s"']+/g, 'a Windows home directory'],
    [/\/Users\/[A-Za-z0-9._-]+\//g, 'a macOS home directory'],
    [/\/home\/[A-Za-z0-9._-]+\//g, 'a Linux home directory'],
    [/AppData\\\\?Local/gi, 'a local application-data path'],
    [/AppData\\Local/gi, 'a local application-data path'],
  ];
  const findings = [];
  for (const file of textFiles) {
    const lines = read(file).split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      for (const [pattern, label] of patterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(lines[index]);
        if (match !== null) findings.push(`${file}:${index + 1}: ${label} — ${match[0].slice(0, 80)}`);
      }
    }
  }
  return findings;
});

// ---------------------------------------------------------------------------------------
// 3. No credential
// ---------------------------------------------------------------------------------------
check('carries no credential, token or key', () => {
  const patterns = [
    [/sk-[A-Za-z0-9_-]{20,}/, 'an OpenAI-shaped secret'],
    [/gh[pousr]_[A-Za-z0-9]{20,}/, 'a GitHub token'],
    [/AKIA[0-9A-Z]{16}/, 'an AWS access key id'],
    [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'a private key'],
    [/xox[baprs]-[A-Za-z0-9-]{10,}/, 'a Slack token'],
    [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./, 'a JSON Web Token'],
    [/(?:api[_-]?key|secret|password|passwd|token)\s*[:=]\s*["'][^"']{16,}["']/i, 'a hard-coded credential'],
  ];
  const findings = [];
  for (const file of textFiles) {
    const lines = read(file).split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      for (const [pattern, label] of patterns) {
        if (pattern.test(lines[index])) findings.push(`${file}:${index + 1}: ${label}`);
      }
    }
  }
  return findings;
});

// ---------------------------------------------------------------------------------------
// 4. Nothing staged that is ignored
// ---------------------------------------------------------------------------------------
check('has no tracked file that .gitignore excludes', () => {
  let ignored = '';
  try {
    ignored = execFileSync('git', ['ls-files', '--ignored', '--exclude-standard', '--cached'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
  } catch {
    return [];
  }
  return ignored
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((file) => `${file}: tracked but ignored, which means it was forced in`);
});

// ---------------------------------------------------------------------------------------
// 5. The licence says what it may say
// ---------------------------------------------------------------------------------------
check('does not extend its own licence to third-party text', () => {
  const findings = [];
  const licence = read('LICENSE');
  if (!/MIT License/i.test(licence)) findings.push('LICENSE: not an MIT licence');
  if (!/THIRD_PARTY_NOTICES\.md/.test(licence) && !/third[- ]party/i.test(licence)) {
    findings.push('LICENSE: does not point at the third-party notices');
  }
  const overclaims = [
    /MIT covers (?:all|the) third[- ]party/i,
    /third[- ]party (?:text|content|material)s? (?:is|are) MIT/i,
    /all (?:text|content) in this repository is MIT/i,
  ];
  for (const file of ['LICENSE', 'README.md', 'THIRD_PARTY_NOTICES.md', 'docs/licence-audit.md']) {
    if (!files.includes(file)) continue;
    for (const pattern of overclaims) {
      const hits = grep(file, pattern);
      findings.push(...hits.map((hit) => `${hit} — an overclaim about licence scope`));
    }
  }
  for (const file of ['THIRD_PARTY_NOTICES.md', 'benchmarks/external/README.md']) {
    if (!files.includes(file)) findings.push(`${file}: missing`);
  }
  return findings;
});

// ---------------------------------------------------------------------------------------
// 6. Withdrawn claims stay withdrawn
// ---------------------------------------------------------------------------------------
check('repeats no claim a later phase withdrew', () => {
  const findings = [];
  // Each entry is a claim that was measured and withdrawn. The pattern matches the claim
  // *asserted*, not the record of its withdrawal, so the files that document the withdrawal
  // pass on their own wording rather than through an exemption.
  const withdrawn = [
    [
      /`?chat\.unsolicited_advice`? is (?:a|the) lexical proxy/i,
      'the withdrawn "lexical proxy" claim',
    ],
    [/mirrors_user[^.]{0,40}(?:a |the )?validated (?:mirroring )?detector/i, 'the withdrawn mirrors_user claim'],
    [/auto_summary[^.]{0,30}(?:an? )?(?:AI |identity )?signal of AI/i, 'the withdrawn auto_summary identity claim'],
    [/over_completeness[^.]{0,30}identity evidence/i, 'the withdrawn over_completeness claim'],
    [/LOW\s*\+\s*PLAN[^.]{0,40}validated/i, 'the withdrawn LOW+PLAN validation'],
  ];
  for (const file of textFiles) {
    for (const [pattern, label] of withdrawn) {
      const hits = grep(file, pattern, 2);
      findings.push(...hits.map((hit) => `${hit} — ${label}`));
    }
  }

  // The 34.6% figure is not forbidden — it is a real measurement by a deliberately loose probe.
  // What was withdrawn is presenting it as a prevalence. So the check is per file: a file that
  // quotes the number has to say, in the same file, that it is an upper bound rather than a rate.
  const qualification = /upper bound|not a measurement|pending calibration|downgrade/i;
  for (const file of textFiles) {
    const text = read(file);
    if (!text.includes('34.6%')) continue;
    if (!qualification.test(text)) {
      findings.push(
        `${file}: quotes 34.6% without saying it is an upper bound pending calibration, which reads as a prevalence`,
      );
    }
  }
  return findings;
});

// ---------------------------------------------------------------------------------------
// 7. The old advice numbers keep their qualifier
// ---------------------------------------------------------------------------------------
check('qualifies every historical advice figure', () => {
  const findings = [];
  // A file that reports a firing rate for the rule has to say the gate was unwired. The test
  // is deliberately coarse: it looks for the rule's name next to a percentage, and requires
  // the qualifier somewhere in the same file.
  const reports = files.filter(
    (file) => file.endsWith('.md') && /(PAIRED_CONTROL|LENGTH_MATCHED|HELPSTEER3|COVERAGE_MATRIX|LEXICAL_ONLY|README|RULE_STATUS)/.test(file),
  );
  for (const file of reports) {
    const text = read(file);
    const mentionsRate = /chat\.unsolicited_advice[^\n]*\d+(?:\.\d+)?%/.test(text);
    if (!mentionsRate) continue;
    if (!/requestKind`? unpopulated|unpopulated `?requestKind|with its permission gate disabled|gate disabled/.test(text)) {
      findings.push(`${file}: quotes an advice rate without the requestKind-unpopulated qualifier`);
    }
  }
  return findings;
});

// ---------------------------------------------------------------------------------------
// 8. No blended score, anywhere
// ---------------------------------------------------------------------------------------
check('reports no blended score and no AI probability', () => {
  const findings = [];
  const forbidden = [
    /\bhumanScore\b/,
    /\bhumanPercentage\b/,
    /\bhumanLikeness\b/,
    /\boverallHumanScore\b/,
    /\baiProbability\b/,
    /\bblendedScore\b/,
    /\bpercentHuman\b/,
  ];
  for (const file of textFiles) {
    for (const pattern of forbidden) {
      const hits = grep(file, pattern, 4);
      findings.push(...hits.map((hit) => `${hit} — a blended or probabilistic score`));
    }
  }
  return findings;
});

// ---------------------------------------------------------------------------------------
// 9. behaviorScore contributors are class A
// ---------------------------------------------------------------------------------------
check('charges behaviorScore only to discriminating rules', () => {
  const findings = [];
  const taxonomy = read('src/behavior/types.ts');
  const validation = read('src/validation/behavior/index.ts');
  if (!/'discriminating' \| 'descriptive' \| 'shadow' \| 'hypothesis' \| 'deprecated-candidate'/.test(taxonomy)) {
    findings.push('src/behavior/types.ts: the five-class union is missing or renamed');
  }
  if (!/classOf\(ruleId\) === 'discriminating'/.test(validation) && !/=== 'discriminating'/.test(validation)) {
    findings.push('src/validation/behavior/index.ts: the score no longer filters on the class');
  }
  // A rule marked with a non-default class must carry the note that explains it.
  const blocks = taxonomy.split(/\n  \{\n/).slice(1);
  for (const block of blocks) {
    const id = /id: '([^']+)'/.exec(block)?.[1];
    if (id === undefined) continue;
    const klass = /scoring: '([^']+)'/.exec(block)?.[1];
    if (klass === undefined || klass === 'discriminating') continue;
    if (!/scoringNote:/.test(block)) findings.push(`src/behavior/types.ts: ${id} is ${klass} with no scoringNote`);
  }
  return findings;
});

// ---------------------------------------------------------------------------------------
// 10. The README is honest about what the project is
// ---------------------------------------------------------------------------------------
check('does not market the suite as an AI detector', () => {
  const findings = [];
  const readme = read('README.md');
  // A line that denies the claim is the opposite of the claim, so the negation is filtered per
  // line rather than the pattern being loosened: "not an AI detector" has to pass, "an AI
  // detector for Chinese text" has to fail.
  const claims = [
    /\bis (?:an? )?AI[- ]detector\b/i,
    /\bAI[- ]detector\b(?! that (?:also|does not|reads))/i,
    /we (?:can )?detect (?:whether|if) (?:text|a text) (?:was|is) (?:written by )?AI/i,
    /detects AI[- ]written text/i,
    /\bAI[- ]detection\b/i,
  ];
  const negation = /\bnot\b|\bnever\b|\bno\b|rather than|instead of/i;
  const lines = readme.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const pattern of claims) {
      if (pattern.test(line) && !negation.test(line)) {
        findings.push(`README.md:${index + 1}: ${line.trim().slice(0, 120)} — the suite is not an AI detector`);
      }
    }
  }
  // The README has to say both things a stranger needs: what the project is positioned as, and
  // what it is not. Either spelling of the positioning counts — the project writes it
  // "human-voice" in prose and "Human Voice Suite" in its title, and a check that insisted on the
  // hyphen would fail a document that says it correctly.
  const states = [/human-voice/i, /human voice/i];
  if (!states.some((pattern) => pattern.test(readme))) {
    findings.push('README.md: does not state the project\'s positioning ("human-voice")');
  }
  if (!/not an AI detector/i.test(readme)) {
    findings.push('README.md: does not state that the suite is not an AI detector');
  }
  return findings;
});

// ---------------------------------------------------------------------------------------

function main() {
  const only = process.argv.slice(2).filter((argument) => !argument.startsWith('--'));
  const results = [];
  for (const { name, fn } of CHECKS) {
    if (only.length > 0 && !only.some((needle) => name.includes(needle))) continue;
    let findings;
    try {
      findings = fn();
    } catch (error) {
      findings = [`the check itself failed: ${String(error)}`];
    }
    results.push({ name, findings });
  }

  const failed = results.filter((result) => result.findings.length > 0);
  process.stdout.write(`\nRelease audit — ${results.length} check(s) over ${files.length} tracked file(s)\n\n`);
  for (const result of results) {
    const status = result.findings.length === 0 ? 'ok  ' : 'FAIL';
    process.stdout.write(`  [${status}] ${result.name}\n`);
    for (const finding of result.findings.slice(0, 20)) process.stdout.write(`         ${finding}\n`);
    if (result.findings.length > 20) {
      process.stdout.write(`         … ${result.findings.length - 20} more\n`);
    }
  }
  process.stdout.write(
    failed.length === 0
      ? '\nEvery check passed. This is a text scan: see the header for what it cannot prove.\n'
      : `\n${failed.length} check(s) failed.\n`,
  );
  return failed.length === 0 ? 0 : 1;
}

process.exitCode = main();
