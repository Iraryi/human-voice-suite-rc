/**
 * Building the registry from what has actually been extracted.
 *
 * Phase 1 proved deduplication with a hand-written seed. Phase 2 replaces it
 * with the real pipeline: committed `rules.generated.json` files, run through
 * deduplication. These tests check the real artifact, not a fixture.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildRegistryFromExtractions,
  registryStats,
} from '../src/rules/canonical/load.js';
import { generatedFilePath, loadExtraction } from '../src/upstream/extract/generate.js';
import { resolveProjectRoot } from '../src/upstream/manifest.js';
import { EXTRACTION_SCHEMA_VERSION } from '../src/upstream/extract/types.js';
import { toRuleCandidates, extractionProblems, weakAloneRules } from '../src/upstream/extract/types.js';
import { createLexicalDetector } from '../src/detector/lexical/rule-driven.js';
import { scan } from '../src/detector/scan.js';
import { createDefaultDetectors } from '../src/detector/registry.js';

const projectRoot = resolveProjectRoot();
const bladerFile = generatedFilePath('blader', projectRoot);
const extracted = existsSync(bladerFile);

describe('the committed blader extraction', () => {
  it('exists and declares the current schema version', async () => {
    const file = await loadExtraction('blader', projectRoot);
    expect(file).not.toBeNull();
    expect(file!.schemaVersion).toBe(EXTRACTION_SCHEMA_VERSION);
    expect(file!.result.upstream).toBe('blader/humanizer');
  });

  it('records the commit the rules were read from', async () => {
    const file = await loadExtraction('blader', projectRoot);
    expect(file!.result.sourceCommit).toMatch(/^[0-9a-f]{40}$/);
  });

  it('produces no warnings and no unmapped signatures', async () => {
    const file = await loadExtraction('blader', projectRoot);
    expect(extractionProblems(file!.result)).toEqual([]);
  });
});

describe('rule shape coming out of extraction', () => {
  it('carries the upstream number as the rule id, so findings stay traceable', async () => {
    const file = await loadExtraction('blader', projectRoot);
    const ids = file!.result.rules.map((r) => r.upstreamRuleId);
    expect(ids).toEqual(Array.from({ length: 25 }, (_, i) => String(i + 1)));
  });

  it('marks exactly the five weak-alone patterns the upstream marks', async () => {
    const file = await loadExtraction('blader', projectRoot);
    const weak = weakAloneRules(file!.result).map((r) => r.upstreamRuleId).sort((a, b) => Number(a) - Number(b));
    expect(weak).toEqual(['8', '9', '10', '11', '21']);
  });

  it('keeps watched phrases and classifies them', async () => {
    const file = await loadExtraction('blader', projectRoot);
    const total = file!.result.rules.reduce((sum, r) => sum + r.watchPhrases.length, 0);
    expect(total).toBeGreaterThan(150);
    for (const rule of file!.result.rules) {
      for (const phrase of rule.watchPhrases) {
        expect(['literal', 'template', 'reference']).toContain(phrase.kind);
        expect(phrase.text.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the chatbot-residue phrases that a group-level template check would lose', async () => {
    const file = await loadExtraction('blader', projectRoot);
    const rule = file!.result.rules.find((r) => r.upstreamRuleId === '22')!;
    const literal = rule.watchPhrases.filter((p) => p.kind === 'literal').map((p) => p.text);
    expect(literal).toContain('I hope this helps');
    expect(literal).toContain('Great question!');
    expect(literal).toContain('let me know');
  });

  it('gives every rule a locator and a severity in range', async () => {
    const file = await loadExtraction('blader', projectRoot);
    for (const rule of file!.result.rules) {
      expect(rule.locator).toMatch(/^SKILL\.md:\d+$/);
      expect(rule.severity).toBeGreaterThanOrEqual(1);
      expect(rule.severity).toBeLessThanOrEqual(5);
      expect(rule.rewriteGuidance.length).toBeGreaterThan(20);
    }
  });

  it('converts to rule candidates without losing the watched phrases', async () => {
    const file = await loadExtraction('blader', projectRoot);
    const candidates = toRuleCandidates(file!.result);
    const withPhrases = candidates.filter((c) => (c.watchPhrases?.length ?? 0) > 0);
    expect(withPhrases.length).toBeGreaterThan(10);
    const weak = candidates.filter((c) => c.weakAlone === true);
    expect(weak).toHaveLength(5);
  });
});

describe('registry built from extractions', () => {
  it('carries watched phrases through deduplication onto the canonical rule', async () => {
    const { registry } = await buildRegistryFromExtractions({ projectRoot });
    const rule = registry.get('lexical.ai_vocabulary');
    expect(rule).toBeDefined();
    expect(rule!.watchPhrases?.length ?? 0).toBeGreaterThan(20);
  });

  it('decides weak alone by an upstream vote, not by any single source', async () => {
    const { registry } = await buildRegistryFromExtractions({ projectRoot });

    // `humanize-text` marks its vocabulary rule weak alone; blader and
    // ai-humanizer state the same tell without the caveat. Three upstreams beat
    // one, so the merged rule is NOT weak alone. Taking the union here once
    // suppressed five of six real findings on a plainly AI-flavoured paragraph.
    const vocabulary = registry.get('lexical.ai_vocabulary')!;
    expect(vocabulary.weakAlone).toBeUndefined();
    expect(vocabulary.weakAloneSources).toContain('lynote-ai/humanize-text');

    // A rule whose upstream note carries an *exception* is a different case.
    // `rhythm.dash_overuse` used to be asserted weak alone here, and Phase 8
    // removed it for blader's own reason: "one dash is weak alone; a text full of
    // them is not" is a condition, and the detector implements it. The claim is
    // still recorded in `weakAloneSources`; the override is what went. See
    // `docs/phase-8-rule-changes.md` change 7.
    const dash = registry.get('rhythm.dash_overuse')!;
    expect(dash.weakAlone).toBeUndefined();
    expect(dash.weakAloneSources).toContain('blader/humanizer');
  });

  it('keeps the four weak-alone patterns blader marks without an exception', async () => {
    const { registry } = await buildRegistryFromExtractions({ projectRoot });
    const fromBlader = registry
      .list()
      .filter((rule) => rule.sources.some((s) => s.upstream === 'blader/humanizer'));
    const weak = fromBlader
      .filter((rule) => rule.weakAlone === true)
      .map((rule) => rule.sources.find((s) => s.upstream === 'blader/humanizer')?.ruleId)
      .filter((id): id is string => id !== undefined)
      .map(Number)
      .sort((a, b) => a - b);
    // blader patterns 9, 10, 11 and 21 — the four whose notes say "weak alone"
    // without an exception. A superset is acceptable, because another upstream
    // may mark the same tell weak alone too.
    for (const expected of [9, 10, 11, 21]) {
      expect(weak, `blader pattern ${expected}`).toContain(expected);
    }
    expect(weak, 'blader pattern 8').not.toContain(8);
  });

  it('resolves an upstream pattern number to the canonical rule', async () => {
    const { registry } = await buildRegistryFromExtractions({ projectRoot });
    expect(registry.resolveUpstreamRule('blader/humanizer', '13')?.id).toBe(
      'structural.inflated_significance',
    );
  });

  it('reports problems rather than failing silently', async () => {
    const { problems } = await buildRegistryFromExtractions({ projectRoot });
    expect(Array.isArray(problems)).toBe(true);
  });
});

describe('end to end: registry, detector, suppression, scan', () => {
  const SAMPLE = [
    "Let's dive into how caching works. Here's what you need to know.",
    "This is not just about speed; it's about scale.",
    'The system stands as a testament to careful design, showcasing the enduring power of robust engineering.',
    "Moreover, it's crucial to delve into the intricate tapestry of modern infrastructure.",
    'Great question! I hope this helps. Let me know if you would like more.',
  ].join('\n\n');

  it('finds real tells in real text', async () => {
    const { registry } = await buildRegistryFromExtractions({ projectRoot });
    const result = await scan(SAMPLE, {
      registry,
      detectors: createDefaultDetectors(),
      mode: 'prose',
    });

    const rules = result.canonicalFindings.map((f) => f.canonicalRuleId);
    expect(rules).toContain('lexical.ai_vocabulary');
    expect(rules).toContain('structural.staged_runup');
    expect(rules).toContain('assistant.chatbot_residue');
    // Every implemented family that applies to English runs. The Chinese
    // typography detector is skipped, because it declares `zh` only.
    expect(result.detectorsRun).toEqual([
      'lexical.watched_phrases',
      'structural.templates',
      'structural.document_shape',
      'rhythm.distribution',
      'english.construction',
      'stylometry.statistical',
      'stylometry.voice_distance',
      'stylometry.fingerprint_features',
      'assistant.smells',
    ]);
    expect(result.detectorsRun).not.toContain('chinese.typography');
  });

  it('attributes each finding to the family that found it', async () => {
    const { registry } = await buildRegistryFromExtractions({ projectRoot });
    const result = await scan(
      [
        "Let's dive into caching. Here's what you need to know.",
        'This is not just about speed; it is about scale and it matters a great deal more than that.',
        'The system stands as a testament to careful design, showcasing the enduring power of robust engineering.',
        "Moreover, it is crucial to delve into the intricate tapestry of modern infrastructure work.",
      ].join('\n\n'),
      { registry, detectors: createDefaultDetectors() },
    );

    for (const finding of result.canonicalFindings) {
      expect(['lexical', 'structural', 'rhythm', 'chinese', 'english', 'stylometry', 'assistant'])
        .toContain(finding.family);
      expect(finding.detectorId.length).toBeGreaterThan(0);
    }
    // The template detector and the lexical detector together cover both the
    // vocabulary and the shape of the tells.
    const detectors = new Set(result.findings.map((f) => f.detectorId));
    expect(detectors.has('lexical.watched_phrases')).toBe(true);
    expect(detectors.has('structural.templates') || detectors.has('rhythm.distribution')).toBe(true);
  });

  it('charges one tell once even though the detector saw several phrases', async () => {
    const { registry } = await buildRegistryFromExtractions({ projectRoot });
    const result = await scan('It is crucial, pivotal, robust and vibrant.', {
      registry,
      detectors: createDefaultDetectors(),
      // Suppression is off here so the assertion is about collapsing, not about
      // the policy. The policy has its own tests.
      disableSuppression: true,
    });
    const vocabulary = result.canonicalFindings.filter(
      (f) => f.canonicalRuleId === 'lexical.ai_vocabulary',
    );
    expect(vocabulary).toHaveLength(1);
    expect(vocabulary[0]!.message).toMatch(/watched phrase hit/);
  });

  it('suppresses a weak-alone rule when nothing corroborates it', async () => {
    const { registry } = await buildRegistryFromExtractions({ projectRoot });
    // `data-driven` is in blader pattern 10, which the upstream marks weak alone.
    const result = await scan('The methodology is data-driven.', {
      registry,
      detectors: createDefaultDetectors(),
    });
    const ruleId = 'formatting.hyphenated_pairs';
    expect(result.findings.some((f) => f.canonicalRuleId === ruleId)).toBe(true);
    expect(result.canonicalFindings.some((f) => f.canonicalRuleId === ruleId)).toBe(false);
    expect(result.suppressed.length).toBeGreaterThan(0);
  });

  it('lets a weak-alone rule through once other rules corroborate it', async () => {
    const { registry } = await buildRegistryFromExtractions({ projectRoot });
    const text = [
      'The methodology is data-driven and the framework is long-term.',
      'It stands as a testament to the enduring power of robust engineering.',
      'Moreover, it is crucial to delve into the intricate tapestry of modern work.',
    ].join('\n\n');
    const result = await scan(text, { registry, detectors: createDefaultDetectors() });
    expect(
      result.canonicalFindings.some((f) => f.canonicalRuleId === 'formatting.hyphenated_pairs'),
    ).toBe(true);
  });

  it('reports a lower antiAIScore as more rules fire', async () => {
    const { registry } = await buildRegistryFromExtractions({ projectRoot });
    const clean = await scan('The cat sat on the mat.', {
      registry,
      detectors: createDefaultDetectors(),
    });
    const dirty = await scan(SAMPLE, { registry, detectors: createDefaultDetectors() });
    expect(clean.scores.antiAIScore).toBe(1);
    expect(dirty.scores.antiAIScore).toBeLessThan(1);
  });

  it('never emits a blended score, even with real detectors running', async () => {
    const { registry } = await buildRegistryFromExtractions({ projectRoot });
    const result = await scan(SAMPLE, { registry, detectors: createDefaultDetectors() });
    const serialised = JSON.stringify(result.scores);
    for (const key of ['humanScore', 'humanPercentage', 'aiProbability', 'blendedScore']) {
      expect(serialised).not.toContain(`"${key}"`);
    }
  });
});

describe('registry statistics', () => {
  it('reports a defensible contribution table', async () => {
    const { stats, build } = await registryStats({ projectRoot });
    expect(stats.ruleCount).toBe(build.registry.size);
    expect(stats.watchPhraseCount).toBeGreaterThan(0);
    expect(stats.weakAloneRuleCount).toBeGreaterThanOrEqual(5);
    for (const entry of stats.upstreamContribution) {
      expect(entry.upstream.length).toBeGreaterThan(0);
      expect(entry.exclusive + entry.shared).toBeGreaterThan(0);
    }
  });

  it('shows that most of the corpus is shared rather than independent', async () => {
    // This is the number that justifies the whole design. Every upstream that
    // forks or absorbs another shows a large `shared` count, and a large shared
    // count is exactly what would have been double-charged without dedupe.
    const { stats } = await registryStats({ projectRoot });
    const fork = stats.upstreamContribution.find(
      (entry) => entry.upstream === 'holygeek00/humanizer-zh-cn',
    );
    expect(fork).toBeDefined();
    expect(fork!.shared).toBeGreaterThan(fork!.exclusive);
  });
});

// The detector must not be reachable without the committed data.
describe.skipIf(extracted)('when no extraction has been run', () => {
  it('says so', async () => {
    const { problems } = await buildRegistryFromExtractions({ projectRoot });
    expect(problems.join('\n')).toMatch(/No extraction has been run/);
  });
});

void path;
void createLexicalDetector;
