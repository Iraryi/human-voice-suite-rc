/**
 * Extraction tests for the `judetelan/ai-humanizer` adapter.
 *
 * The subject here is a licence restriction, not just a parser. The upstream
 * absorbed eleven of its forty-six rules verbatim from `hardikpandya/stop-slop`
 * without carrying Hardik Pandya's copyright notice, so the adapter has to
 * import exactly the thirty-five it holds clean title to and drop the rest
 * *entirely* — not with empty fields, not with an explanatory note.
 *
 * These tests are the enforcement. They run against the pinned clone and are
 * skipped on a fresh checkout where `.upstream-cache` is empty by design.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { parseAiHumanizer } from '../src/upstream/adapters/ai-humanizer/parse.js';
import { AI_HUMANIZER_SIGNATURES } from '../src/upstream/adapters/ai-humanizer/signatures.js';
import { resolveProjectRoot } from '../src/upstream/manifest.js';
import { isKnownSignature } from '../src/rules/canonical/signatures.js';
import type { ExtractionResult } from '../src/upstream/extract/types.js';

const projectRoot = resolveProjectRoot();
const clonePath = path.join(projectRoot, '.upstream-cache', 'ai-humanizer');

/** The ids `scripts/registry/rules.mjs:148` marks as stop-slop-derived. */
const EXCLUDED_IDS = [
  'false-agency',
  'rhetorical-setup',
  'negative-listing',
  'vague-declarative',
  'meta-commentary',
  'emphasis-crutch',
  'dramatic-fragmentation',
  'adverb-filler',
  'lazy-extremes',
  'passive-voice',
  'wh-opener',
] as const;

/** The thirty-five the adapter is allowed to import. */
const PERMITTED_IDS = [
  'em-dash-overuse',
  'banned-vocab',
  'ai-openers',
  'marketing-buzzword',
  'hedging',
  'aphoristic-cadence',
  'rule-of-three',
  'numbered-section-markers',
  'exclamation-spam',
  'emoji-decoration',
  'wordy-connectives',
  'weasel-attribution',
  'copula-avoidance',
  'chatbot-closer',
  'rlhf-artifacts',
  'reasoning-chain-leak',
  'acknowledgment-loop',
  'conclusion-fluff',
  'business-jargon',
  'plays-a-role',
  'ing-trailers',
  'llm-artifact-leak',
  'smart-punctuation-leak',
  'bold-label-list',
  'excessive-structure',
  'uniform-rhythm',
  'low-lexical-diversity',
  'comma-splice-rhythm',
  'paragraph-uniformity',
  'contraction-absence',
  'gpt-tics',
  'claude-tics',
  'gemini-tics',
  'grok-tics',
  'deepseek-tics',
] as const;

describe.skipIf(!existsSync(clonePath))('ai-humanizer rule extraction', () => {
  let result: ExtractionResult;

  beforeEach(async () => {
    result = await parseAiHumanizer(clonePath);
  });

  it('extracts exactly the 35 permitted rules out of 46 declared', async () => {
    const registry = await readFile(
      path.join(clonePath, 'scripts/registry/rules.mjs'),
      'utf8',
    );
    const declared = registry.match(/^\s+id:\s*'([^']+)'/gm) ?? [];
    expect(declared).toHaveLength(46);

    expect(result.rules).toHaveLength(35);
    expect(declared.length - EXCLUDED_IDS.length).toBe(result.rules.length);
    expect([...result.rules.map((rule) => rule.upstreamRuleId)].sort()).toEqual(
      [...PERMITTED_IDS].sort(),
    );
  });

  it('omits every stop-slop-derived rule id by name, in any field', () => {
    const serialised = JSON.stringify(result);
    for (const id of EXCLUDED_IDS) {
      expect(result.rules.some((rule) => rule.upstreamRuleId === id), id).toBe(false);
      // Absent, not merely unnamed: no note, quote or watch phrase may carry it.
      expect(serialised).not.toContain(`"${id}"`);
    }
  });

  it('keeps the stop-slop boundary positional, so a rename cannot smuggle one in', async () => {
    const registry = await readFile(
      path.join(clonePath, 'scripts/registry/rules.mjs'),
      'utf8',
    );
    expect(registry).toMatch(/Absorbed from stop-slop \(editorial tells\)/);

    // 1-based line of the marker comment, compared against 1-based locators.
    const markerLine =
      registry.split('\n').findIndex((line) => /Absorbed from stop-slop/.test(line)) + 1;
    expect(markerLine).toBe(148);

    const barredBlocks = result.rules.filter((rule) => {
      const line = Number.parseInt(rule.locator.split(':')[1] ?? '0', 10);
      return line > markerLine && line < 205;
    });
    // The eleven barred rule objects sit between the marker and the next
    // section banner, and none of them may appear.
    expect(barredBlocks).toEqual([]);

    const afterMarker = result.rules
      .filter((rule) => Number.parseInt(rule.locator.split(':')[1] ?? '0', 10) > markerLine)
      .map((rule) => rule.upstreamRuleId)
      .sort();
    expect(afterMarker).toEqual(
      [
        'uniform-rhythm',
        'low-lexical-diversity',
        'comma-splice-rhythm',
        'paragraph-uniformity',
        'contraction-absence',
        'gpt-tics',
        'claude-tics',
        'gemini-tics',
        'grok-tics',
        'deepseek-tics',
      ].sort(),
    );
  });

  it('carries no content from the stop-slop JARGON_SWAPS table', async () => {
    const lexicons = await readFile(path.join(clonePath, 'scripts/lexicons.mjs'), 'utf8');
    const table = /export const JARGON_SWAPS = \{([\s\S]*?)\n\};/.exec(lexicons);
    expect(table).not.toBeNull();

    const rows = [...(table?.[1] ?? '').matchAll(/'([^']+)':\s*'([^']+)'/g)];
    expect(rows).toHaveLength(11);

    const watched = new Set(
      result.rules.flatMap((rule) => rule.watchPhrases.map((phrase) => phrase.text.toLowerCase())),
    );
    // Every watched phrase as a JSON string, so membership is exact rather than
    // a substring search: `leverage` legitimately sits inside `leveraging`.
    const serialisedPhrases = new Set(
      result.rules.flatMap((rule) =>
        rule.watchPhrases.map((phrase) => JSON.stringify(phrase.text)),
      ),
    );

    for (const row of rows) {
      const key = row[1] ?? '';
      const replacement = row[2] ?? '';
      // A bare key overlap is not evidence of the table: `unpack` is also a
      // BANNED_VOCAB entry, from this upstream's own word list. What would be
      // evidence is the table's *replacement pair*, which exists nowhere else.
      expect(serialisedPhrases.has(JSON.stringify(replacement)), `JARGON_SWAPS row ${key}`).toBe(
        false,
      );
      expect(watched.has(replacement.toLowerCase())).toBe(false);
    }

    // The adapter must never even name the barred table.
    expect(JSON.stringify(result)).not.toContain('JARGON_SWAPS');

    // `business-jargon` is the permitted rule that owns this area, and it must
    // be drawing on BUSINESS_JARGON, not on the barred swap table.
    const jargon = result.rules.find((rule) => rule.upstreamRuleId === 'business-jargon');
    expect(jargon?.detection).toContain('BUSINESS_JARGON');
    expect(watched.has('thought leadership')).toBe(true);
  });

  it('maps every rule onto a real canonical signature', () => {
    expect(result.rules).toHaveLength(35);
    for (const rule of result.rules) {
      expect(rule.signatureMapped, rule.upstreamRuleId).toBe(true);
      expect(isKnownSignature(rule.signature), `${rule.upstreamRuleId} -> ${rule.signature}`).toBe(true);
      expect(rule.signature).not.toMatch(/^upstream\./);
      expect(AI_HUMANIZER_SIGNATURES[rule.upstreamRuleId]).toBe(rule.signature);
    }
    expect(Object.keys(AI_HUMANIZER_SIGNATURES)).toHaveLength(35);
  });

  it('reports no warnings', () => {
    expect(result.warnings).toEqual([]);
  });

  it('keeps a description and its watched list verbatim', () => {
    const banned = result.rules.find((rule) => rule.upstreamRuleId === 'banned-vocab');
    expect(banned).toBeDefined();
    expect(banned?.description).toBe(
      'Words that spike in AI prose (delve, leverage, robust, seamless). Swap for plainer, more specific words.',
    );
    expect(banned?.quote).toBe(banned?.description);
    expect(banned?.locator).toBe('scripts/registry/rules.mjs:26');
    expect(banned?.severity).toBe(3);
    expect(banned?.weakAlone).toBe(false);

    const heard = banned?.watchPhrases.map((phrase) => phrase.text) ?? [];
    expect(heard).toContain('delve');
    expect(heard).toContain('rich tapestry');
    expect(heard).toHaveLength(98);
    expect(banned?.watchPhrases.every((phrase) => phrase.kind === 'literal')).toBe(true);
    expect(banned?.watchPhrases.find((phrase) => phrase.text === 'delve')?.match).toBe('delve');
  });

  it('preserves an escaped apostrophe exactly as the upstream wrote it', () => {
    const closer = result.rules.find((rule) => rule.upstreamRuleId === 'chatbot-closer');
    expect(closer?.quote).toContain('"I hope this helps", "feel free to", "you\'re absolutely right"');
    expect(closer?.watchPhrases.map((phrase) => phrase.text)).toContain("you're absolutely right");
  });

  it('scores the weight-12 artifact leak at 5 and records the upstream fields', () => {
    const leak = result.rules.find((rule) => rule.upstreamRuleId === 'llm-artifact-leak');
    expect(leak?.severity).toBe(5);
    expect(leak?.notes?.join(' ')).toContain('weight 12');
    expect(leak?.notes?.join(' ')).toContain('severity "warning"');
    expect(leak?.signature).toBe('assistant.llm_artifact_leak');
  });

  it('marks the five provider-gated rules weak and off by default', () => {
    const gated = result.rules.filter((rule) => /^[a-z]+-tics$/.test(rule.upstreamRuleId));
    expect(gated).toHaveLength(5);
    for (const rule of gated) {
      expect(rule.weakAlone, rule.upstreamRuleId).toBe(true);
      expect(rule.notes?.join(' ')).toMatch(/Provider-gated upstream on "\w+": off unless/);
      expect(rule.signature).toBe('lexical.provider_tic');
    }
  });

  it('records upstream weight and severity for every rule', () => {
    for (const rule of result.rules) {
      expect(rule.notes?.join(' '), rule.upstreamRuleId).toMatch(/Upstream severity "\w+", weight/);
    }
  });

  it('reads the multi-line rule with an object weight without losing the marketing value', () => {
    const buzz = result.rules.find((rule) => rule.upstreamRuleId === 'marketing-buzzword');
    expect(buzz?.locator).toBe('scripts/registry/rules.mjs:36');
    expect(buzz?.notes?.join(' ')).toContain('{ default: 4, marketing: 8 }');
    expect(buzz?.severity).toBe(4);
    expect(buzz?.watchPhrases).toHaveLength(46);
  });

  it('classifies a placeholder as a template rather than a literal to match', () => {
    const leak = result.rules.find((rule) => rule.upstreamRuleId === 'llm-artifact-leak');
    expect(leak?.watchPhrases).toHaveLength(0);
    expect(leak?.detection).toContain('No lexicon array upstream');
  });

  it('leaves no ruled content unmapped or unlocatable', () => {
    for (const rule of result.rules) {
      expect(rule.locator, rule.upstreamRuleId).toMatch(/^scripts\/registry\/rules\.mjs:\d+$/);
      expect(rule.description.length, rule.upstreamRuleId).toBeGreaterThan(20);
      expect(rule.rewriteGuidance.length, rule.upstreamRuleId).toBeGreaterThan(0);
      expect(rule.severity, rule.upstreamRuleId).toBeGreaterThanOrEqual(1);
      expect(rule.severity, rule.upstreamRuleId).toBeLessThanOrEqual(5);
    }
  });
});
