/**
 * Reading the upstream clones for provenance tests.
 *
 * A provenance test is only worth writing if the answer comes from the other
 * repositories rather than from a constant in the adapter under test. This module
 * is where that reading happens, so every adapter's provenance suite searches the
 * same corpus the same way.
 *
 * Not a test file itself: `vitest.config.ts:5` includes `tests/**\/*.test.ts`, so
 * anything else in this directory is a helper.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

/** Text-ish files worth searching. Binaries and images are skipped. */
const TEXT_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.txt',
  '.mjs',
  '.cjs',
  '.js',
  '.ts',
  '.tsx',
  '.json',
  '.yaml',
  '.yml',
  '.py',
  '.toml',
]);

/**
 * Every text file under a directory, skipping `.git` and `node_modules`.
 *
 * Read-only: this walks the clone cache and never writes into it.
 */
export async function clonePaths(root: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      out.push(full);
    }
  }

  if (!(await exists(root))) return out;
  await walk(root);
  return out.sort();
}

async function exists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

export interface CorpusText {
  /** Every clone concatenated, one file-cheaper read per caller. */
  readonly text: string;
  /** Clone directory name -> its text. */
  readonly byClone: ReadonlyMap<string, string>;
}

/**
 * The text of every clone in `.upstream-cache`, except the ones named.
 *
 * Excluding the upstream under test matters: a stop-slop phrase is trivially
 * present in stop-slop, so a uniqueness search that included it would never find
 * anything unique.
 */
export async function corpus(
  projectRoot: string,
  exclude: readonly string[] = [],
): Promise<CorpusText> {
  const cacheRoot = path.join(projectRoot, '.upstream-cache');
  const byClone = new Map<string, string>();
  const chunks: string[] = [];

  let names: string[] = [];
  try {
    names = (await readdir(cacheRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return { text: '', byClone };
  }

  for (const name of names) {
    if (exclude.includes(name)) continue;
    const files = await clonePaths(path.join(cacheRoot, name));
    const parts = await Promise.all(files.map((file) => readFile(file, 'utf8')));
    const text = parts.join('\n');
    byClone.set(name, text);
    chunks.push(text);
  }

  return { text: chunks.join('\n'), byClone };
}

/**
 * Search every clone except the excluded ones for each term.
 *
 * Matching is case-insensitive and whole-string: a term is either somewhere in a
 * clone or it is not. Hyphens and underscores are folded to spaces so that a term
 * spelled `adverb-filler` in one upstream and `adverb_filler` in another is one
 * term — the id spelling is not what a provenance claim is about.
 *
 * Returns the per-term list of clones that contained it, which is what a failure
 * message needs: "not unique, found in ai-humanizer and blader-humanizer".
 */
export async function searchEverywhere(
  projectRoot: string,
  exclude: readonly string[],
  terms: readonly string[],
): Promise<{ readonly text: string; readonly hits: ReadonlyMap<string, readonly string[]> }> {
  const { text, byClone } = await corpus(projectRoot, exclude);
  const folded = [...byClone.entries()].map(
    ([name, body]) => [name, body.toLowerCase().replace(/[_-]/g, ' ')] as const,
  );

  const hits = new Map<string, string[]>();
  for (const term of terms) {
    const needle = term.toLowerCase().replace(/[_-]/g, ' ');
    const found = folded.filter(([, body]) => body.includes(needle)).map(([name]) => name);
    hits.set(term, found);
  }

  return { text, hits };
}

/**
 * A vocabulary built for one upstream, with the two containment checks the
 * provenance tests need.
 *
 * Why not a plain `includes`: a bare substring test is wrong in both directions
 * on real upstream text. `everyone` sits inside `every single`, and a three-letter
 * adverb like `just` sits inside `justification`. So a single-word term is matched
 * against the set of word tokens, and a multi-word term is matched against the
 * text with word boundaries. Hyphens and underscores are folded to spaces on both
 * sides, and adjacent hyphenated tokens are additionally joined with a hyphen so a
 * construction written `the decision emerges` is found in text that spells it
 * `decision-emerges`.
 */
export interface Vocabulary {
  /** The folded full text of one upstream. */
  readonly text: string;
  /** Folded single-word tokens, for exact word matching. */
  readonly tokens: ReadonlySet<string>;
  /** True when a literal phrase occurs as a whole word or phrase. */
  contains(term: string): boolean;
  /** True when a construction template occurs, allowing hyphen joins. */
  containsTemplate(term: string): boolean;
}

/** Strip the markup a template row carries, so its words can be searched. */
function words(term: string): string[] {
  return term
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/["`*]/g, ' ')
    .replace(/[^a-z0-9\s'-]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

export function buildVocabulary(raw: string): Vocabulary {
  const text = raw.toLowerCase().replace(/[_-]/g, ' ').replace(/[\u2018\u2019]/g, "'");
  const tokens = new Set(text.match(/[a-z0-9']+/g) ?? []);
  // Hyphen-joined neighbours, which the folding above split apart.
  for (const pair of raw.toLowerCase().matchAll(/([a-z0-9]+)[_-]([a-z0-9]+)/g)) {
    tokens.add(`${pair[1]}-${pair[2]}`);
  }

  const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const join = (parts: readonly string[]): string => parts.map(escapeRegExp).join('[\\s_-]+');

  function contains(term: string): boolean {
    const parts = words(term);
    if (parts.length === 0) return false;
    if (parts.length === 1) return tokens.has(parts[0]!);
    return new RegExp(`(?<![a-z0-9'-])${join(parts)}(?![a-z0-9'-])`).test(text);
  }

  function containsTemplate(term: string): boolean {
    // A template is a shape, so its slots and punctuation are not part of what is
    // searched: `the decision emerges` has to be findable in text that writes it
    // `decision emerges`, with the article dropped.
    const parts = words(term.replace(/\[[^\]]*\]/g, ' '));
    const body = parts.filter((part) => !/^[xyzn]$/.test(part));
    if (body.length >= 2) {
      const pattern = new RegExp(`(?<![a-z0-9'-])${join(body)}(?![a-z0-9'-])`);
      if (pattern.test(text)) return true;
    }
    return contains(term);
  }

  return { text, tokens, contains, containsTemplate };
}
