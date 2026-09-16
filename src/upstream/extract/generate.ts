/**
 * The extraction runner.
 *
 * Adapters parse a pinned clone; the result is written to
 * `<adapter>/rules.generated.json` and committed. That gives the published
 * package its rules with provenance attached and without needing the clone at
 * run time, and it means every rule change shows up as a reviewable diff.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadManifest, resolveDataFile, resolveProjectRoot } from '../manifest.js';
import { localHead } from '../git.js';
import { EXTRACTION_SCHEMA_VERSION, extractionProblems } from './types.js';
import type { ExtractedRule, ExtractionFile, ExtractionResult } from './types.js';
import { EXTRACTION_TARGETS, targetFor } from './targets.js';
import type { ExtractionTarget } from './targets.js';

/** Where the extractor *writes*. Always the checkout layout: this is a build step. */
export function generatedFilePath(directory: string, projectRoot: string): string {
  return path.join(projectRoot, 'src', 'upstream', 'adapters', directory, 'rules.generated.json');
}

/**
 * Where a reader *finds* it: under `src/` in a checkout, under `dist/` — which
 * replaces `src/` rather than sitting beside it — in an installed package. See
 * `resolveDataFile`.
 */
export function generatedFileForRead(directory: string, projectRoot: string): string {
  return resolveDataFile(
    path.join('upstream', 'adapters', directory, 'rules.generated.json'),
    projectRoot,
  );
}

export interface RunExtractionOptions {
  readonly projectRoot?: string;
  /** Restrict to these adapter ids. Default: every registered target. */
  readonly only?: readonly string[];
  readonly logger?: (message: string) => void;
}

export interface ExtractionRun {
  readonly results: ReadonlyMap<string, ExtractionResult>;
  readonly written: readonly string[];
  readonly problems: readonly string[];
}

/**
 * Parse every target and write its generated file.
 *
 * A target whose clone is missing is reported rather than skipped silently: the
 * generated file already on disk is still valid, and the caller needs to know it
 * was not refreshed.
 */
export async function runExtraction(options: RunExtractionOptions = {}): Promise<ExtractionRun> {
  const projectRoot = options.projectRoot ?? resolveProjectRoot();
  const log = options.logger ?? (() => {});
  const manifest = await loadManifest(projectRoot);
  const cacheDir = path.resolve(projectRoot, manifest.cacheDir);

  const targets = options.only
    ? options.only.map((id) => {
        const target = targetFor(id);
        if (!target) throw new Error(`No extraction target registered for ${JSON.stringify(id)}`);
        return target;
      })
    : [...EXTRACTION_TARGETS];

  const results = new Map<string, ExtractionResult>();
  const written: string[] = [];
  const problems: string[] = [];

  for (const target of targets) {
    const entry = manifest.upstreams.find((u) => u.name === target.adapterId);
    if (!entry) {
      problems.push(`${target.adapterId}: no manifest entry, so the commit cannot be pinned`);
      continue;
    }

    const repoPath = path.join(cacheDir, target.adapterId);
    if (!existsSync(repoPath)) {
      problems.push(
        `${target.adapterId}: no clone at ${repoPath}; the generated file was not refreshed`,
      );
      continue;
    }

    log(`extracting ${target.upstream}`);
    const parsed = await target.parse(repoPath);

    // The commit comes from the clone, not from the manifest, so a mismatch is
    // visible rather than assumed away.
    const head = (await localHead(repoPath)) ?? '';
    const result: ExtractionResult = { ...parsed, sourceCommit: head };
    results.set(target.adapterId, result);

    if (head !== entry.commit) {
      problems.push(
        `${target.adapterId}: extracted from ${head.slice(0, 10)} but the manifest pins ` +
          `${entry.commit.slice(0, 10)}. Update the manifest or re-check out the pin.`,
      );
    }

    for (const problem of extractionProblems(result)) problems.push(`${target.adapterId}: ${problem}`);

    const file = generatedFilePath(target.directory, projectRoot);
    await mkdir(path.dirname(file), { recursive: true });
    const payload: ExtractionFile = { schemaVersion: EXTRACTION_SCHEMA_VERSION, result };
    await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    written.push(file);
  }

  return { results, written, problems };
}

/** Read an adapter's committed extraction. Returns null when it is not built yet. */
export async function loadExtraction(
  directory: string,
  projectRoot: string = resolveProjectRoot(),
): Promise<ExtractionFile | null> {
  const file = generatedFileForRead(directory, projectRoot);
  if (!existsSync(file)) return null;
  const raw: unknown = JSON.parse(await readFile(file, 'utf8'));
  const parsed = raw as Partial<ExtractionFile>;
  if (parsed.schemaVersion !== EXTRACTION_SCHEMA_VERSION || !parsed.result) {
    throw new Error(
      `Generated file ${file} has schema ${String(parsed.schemaVersion)}; ` +
        `expected ${EXTRACTION_SCHEMA_VERSION}. Re-run npm run upstream:extract.`,
    );
  }
  return parsed as ExtractionFile;
}

/** Rules from every adapter whose generated file exists. */
export async function loadAllExtractions(
  projectRoot: string = resolveProjectRoot(),
): Promise<Map<string, ExtractionResult>> {
  const out = new Map<string, ExtractionResult>();
  for (const target of EXTRACTION_TARGETS) {
    const file = await loadExtraction(target.directory, projectRoot);
    if (file) out.set(target.adapterId, file.result);
  }
  return out;
}

/** Every extracted rule across every adapter, with its owning adapter id. */
export interface LoadedRule {
  readonly adapterId: string;
  readonly rule: ExtractedRule;
}

export async function loadAllRules(
  projectRoot: string = resolveProjectRoot(),
): Promise<LoadedRule[]> {
  const extractions = await loadAllExtractions(projectRoot);
  const out: LoadedRule[] = [];
  for (const [adapterId, result] of extractions) {
    for (const rule of result.rules) out.push({ adapterId, rule });
  }
  return out;
}

export type { ExtractionTarget };
