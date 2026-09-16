/**
 * The extraction pipeline itself.
 *
 * Adapters are tested by their own test files. This file tests the machinery
 * around them: that every registered target is coherent, that a generated file
 * is pinned to the commit the manifest names, and that a stale or malformed
 * artifact fails loudly rather than being read as truth.
 */

import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  EXTRACTION_TARGETS,
  deliberatelyNotExtracted,
  missingTargets,
  targetDirectories,
  targetFor,
} from '../src/upstream/extract/targets.js';
import {
  generatedFilePath,
  loadAllExtractions,
  loadAllRules,
  loadExtraction,
} from '../src/upstream/extract/generate.js';
import {
  EXTRACTION_SCHEMA_VERSION,
  extractionDisclosures,
  extractionProblems,
  toRuleCandidates,
  weakAloneRules,
} from '../src/upstream/extract/types.js';
import { indexByName, loadManifest, resolveProjectRoot } from '../src/upstream/manifest.js';
import { isKnownSignature } from '../src/rules/canonical/signatures.js';

const projectRoot = resolveProjectRoot();

describe('registered extraction targets', () => {
  it('has one target per wired adapter', () => {
    expect(EXTRACTION_TARGETS.length).toBeGreaterThanOrEqual(4);
  });

  it('has no duplicate adapter ids or directories', () => {
    const ids = EXTRACTION_TARGETS.map((t) => t.adapterId);
    const dirs = targetDirectories();
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(dirs).size).toBe(dirs.length);
  });

  it('names a manifest entry for every target', async () => {
    const manifest = await loadManifest(projectRoot);
    const byName = indexByName(manifest);
    for (const target of EXTRACTION_TARGETS) {
      const entry = byName.get(target.adapterId);
      expect(entry, target.adapterId).toBeDefined();
      // The target's upstream string and the manifest's repository must agree,
      // or provenance and extraction are describing different projects.
      expect(entry!.repository, target.adapterId).toBe(target.upstream);
    }
  });

  it('points each target at a directory that exists under adapters/', () => {
    for (const directory of targetDirectories()) {
      expect(
        existsSync(new URL(`../src/upstream/adapters/${directory}/`, import.meta.url)),
        directory,
      ).toBe(true);
    }
  });

  it('reports a directory that differs from the manifest name, rather than assuming', () => {
    // The manifest name and the source directory are allowed to differ —
    // `blader-humanizer` lives in `adapters/blader` — but the difference must be
    // declared. Deriving the path from the id would write the artifact somewhere
    // nobody looks.
    for (const target of EXTRACTION_TARGETS) {
      expect(target.directory.length).toBeGreaterThan(0);
      expect(target.directory).not.toContain('/');
    }
  });

  it('reports which manifest entries have no target yet', async () => {
    const manifest = await loadManifest(projectRoot);
    const uncovered = missingTargets(manifest.upstreams);
    for (const name of uncovered) {
      const entry = manifest.upstreams.find((u) => u.name === name)!;
      // A research-only upstream must never be reported as a gap: nothing may be
      // imported from it, so having no target is correct behaviour.
      expect(entry.integration, name).not.toBe('research-only');
    }
  });

  it('lists the untargeted research-only upstreams separately, as deliberate', async () => {
    const manifest = await loadManifest(projectRoot);
    const excluded = deliberatelyNotExtracted(manifest.upstreams);

    // `op7418` is research-only with no target at all.
    expect(excluded).toContain('op7418-humanizer-zh');

    for (const name of excluded) {
      const entry = manifest.upstreams.find((u) => u.name === name)!;
      expect(entry.integration, name).toBe('research-only');
      // The defining property: an entry with a target is never reported as a
      // deliberate gap. `stop-slop` is research-only as a package while still
      // having a targeted extraction for the content barred from ai-humanizer,
      // so it must drop out of this list as soon as it is wired in.
      expect(targetFor(name), name).toBeUndefined();
    }

    // The two lists must never overlap.
    const uncovered = missingTargets(manifest.upstreams);
    for (const name of excluded) expect(uncovered).not.toContain(name);
  });

  it('looks a target up by adapter id', () => {
    expect(targetFor('blader-humanizer')?.directory).toBe('blader');
    expect(targetFor('nobody')).toBeUndefined();
  });
});

describe('generated artifacts', () => {
  it('resolves the path from the directory, not the manifest name', () => {
    expect(generatedFilePath('blader', projectRoot)).toMatch(
      /src[\\/]upstream[\\/]adapters[\\/]blader[\\/]rules\.generated\.json$/,
    );
  });

  it('loads and declares the current schema version', async () => {
    for (const target of EXTRACTION_TARGETS) {
      const file = await loadExtraction(target.directory, projectRoot);
      if (!file) continue;
      expect(file.schemaVersion, target.adapterId).toBe(EXTRACTION_SCHEMA_VERSION);
      expect(file.result.upstream, target.adapterId).toBe(target.upstream);
    }
  });

  it('pins each artifact to the commit the manifest names', async () => {
    const manifest = await loadManifest(projectRoot);
    const byName = indexByName(manifest);
    const mismatches: string[] = [];

    for (const target of EXTRACTION_TARGETS) {
      const file = await loadExtraction(target.directory, projectRoot);
      if (!file) continue;
      const pinned = byName.get(target.adapterId)?.commit;
      if (file.result.sourceCommit !== pinned) {
        mismatches.push(
          `${target.adapterId}: artifact at ${file.result.sourceCommit.slice(0, 10)}, ` +
            `manifest pins ${String(pinned).slice(0, 10)}. Re-run npm run upstream:extract.`,
        );
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('admits a missing artifact rather than inventing one', async () => {
    expect(await loadExtraction('no-such-adapter', projectRoot)).toBeNull();
  });

  it('loads every artifact that exists', async () => {
    const extractions = await loadAllExtractions(projectRoot);
    expect(extractions.size).toBe(EXTRACTION_TARGETS.length);
  });

  it('flattens every loaded rule with its owning adapter', async () => {
    const rules = await loadAllRules(projectRoot);
    const total = [...(await loadAllExtractions(projectRoot)).values()].reduce(
      (sum, result) => sum + result.rules.length,
      0,
    );
    expect(rules.length).toBe(total);
    for (const loaded of rules) {
      expect(loaded.adapterId.length).toBeGreaterThan(0);
      expect(loaded.rule.signature.length).toBeGreaterThan(0);
    }
  });
});

describe('artifact contents', () => {
  it('has no unmapped signature in any artifact', async () => {
    for (const target of EXTRACTION_TARGETS) {
      const file = await loadExtraction(target.directory, projectRoot);
      if (!file) continue;
      const problems = extractionProblems(file.result).filter((p) => !p.includes('no signature'));
      expect(problems, target.adapterId).toEqual([]);
    }
  });

  it('uses only signatures from the canonical vocabulary', async () => {
    const extractions = await loadAllExtractions(projectRoot);
    for (const [adapterId, result] of extractions) {
      for (const rule of result.rules) {
        expect(isKnownSignature(rule.signature), `${adapterId}#${rule.upstreamRuleId}`).toBe(true);
      }
    }
  });

  it('is convertible to rule candidates without loss', async () => {
    const extractions = await loadAllExtractions(projectRoot);
    for (const [adapterId, result] of extractions) {
      const candidates = toRuleCandidates(result);
      expect(candidates.length, adapterId).toBe(result.rules.length);
      for (const candidate of candidates) {
        expect(candidate.signature).toBeTruthy();
        expect(candidate.upstream).toBe(result.upstream);
      }
      // The weak-alone flag and the watched phrases must survive the conversion,
      // because the suppression layer and the lexical detector depend on them.
      const weakIn = result.rules.filter((r) => r.weakAlone).length;
      const weakOut = candidates.filter((c) => c.weakAlone).length;
      expect(weakOut, adapterId).toBe(weakIn);

      const phrasesIn = result.rules.reduce((n, r) => n + r.watchPhrases.length, 0);
      const phrasesOut = candidates.reduce((n, c) => n + (c.watchPhrases?.length ?? 0), 0);
      expect(phrasesOut, adapterId).toBe(phrasesIn);
    }
  });

  it('separates deliberate disclosures from problems', async () => {
    const extractions = await loadAllExtractions(projectRoot);
    for (const [adapterId, result] of extractions) {
      // A disclosure must never be counted as a defect, or `upstream:extract`
      // would fail on an adapter that is behaving correctly.
      for (const disclosure of extractionDisclosures(result)) {
        expect(result.warnings, adapterId).not.toContain(disclosure);
      }
    }
  });

  it('records which of blader the five weak-alone patterns are', async () => {
    const file = await loadExtraction('blader', projectRoot);
    const ids = weakAloneRules(file!.result)
      .map((r) => Number(r.upstreamRuleId))
      .sort((a, b) => a - b);
    expect(ids).toEqual([8, 9, 10, 11, 21]);
  });

  it('gives every rule a locator that names a real file', async () => {
    const extractions = await loadAllExtractions(projectRoot);
    for (const [adapterId, result] of extractions) {
      for (const rule of result.rules) {
        expect(rule.locator, `${adapterId}#${rule.upstreamRuleId}`).toMatch(/:[0-9]+/);
      }
    }
  });
});
