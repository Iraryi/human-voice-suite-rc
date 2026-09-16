/**
 * The canonical rule registry and cross-upstream deduplication.
 *
 * These tests defend the single most important property in the project: a tell
 * claimed by several upstreams occupies one slot and is charged once.
 */

import { describe, expect, it } from 'vitest';

import { CanonicalRuleRegistry, upstreamKey } from '../src/rules/canonical/registry.js';
import {
  combineSeverity,
  crossUpstreamMerges,
  dedupeRuleCandidates,
} from '../src/rules/dedupe/dedupe.js';
import { buildSeedRegistry, seedRuleCandidates } from '../src/rules/canonical/seed.js';
import { buildProvenanceReport } from '../src/rules/provenance/provenance.js';
import { isLocalOnly, LOCAL_UPSTREAM } from '../src/rules/provenance/types.js';
import type { RuleCandidate } from '../src/rules/types.js';

function candidate(overrides: Partial<RuleCandidate> & { signature: string }): RuleCandidate {
  return {
    upstreamRuleId: '1',
    upstream: 'blader/humanizer',
    category: 'structural',
    languages: ['en'],
    description: 'a tell',
    severity: 3,
    ...overrides,
  };
}

describe('dedupeRuleCandidates', () => {
  it('collapses claims that share a signature into one rule with every source kept', () => {
    const result = dedupeRuleCandidates([
      candidate({ signature: 'structural.foo', upstream: 'blader/humanizer', upstreamRuleId: '13' }),
      candidate({ signature: 'structural.foo', upstream: 'humanizer-zh-cn', upstreamRuleId: '1' }),
      candidate({ signature: 'structural.foo', upstream: 'ai-zixun/humanizer-zh', upstreamRuleId: '3' }),
    ]);

    expect(result.rules).toHaveLength(1);
    expect(result.inputCount).toBe(3);
    expect(result.collapsedCount).toBe(2);

    const rule = result.rules[0]!;
    expect(rule.id).toBe('structural.foo');
    expect(rule.sources).toHaveLength(3);
    expect(rule.sources.map((s) => s.upstream)).toEqual([
      'blader/humanizer',
      'humanizer-zh-cn',
      'ai-zixun/humanizer-zh',
    ]);
    expect(result.merges[0]!.crossUpstream).toBe(true);
  });

  it('keeps distinct signatures apart', () => {
    const result = dedupeRuleCandidates([
      candidate({ signature: 'structural.foo' }),
      candidate({ signature: 'structural.bar' }),
    ]);
    expect(result.rules).toHaveLength(2);
    expect(result.collapsedCount).toBe(0);
  });

  it('unions languages across sources', () => {
    const result = dedupeRuleCandidates([
      candidate({ signature: 'x.y', languages: ['en'] }),
      candidate({ signature: 'x.y', languages: ['zh'] }),
    ]);
    expect(result.rules[0]!.languages.sort()).toEqual(['en', 'zh']);
  });

  it('records a category conflict instead of silently picking a winner', () => {
    const result = dedupeRuleCandidates([
      candidate({ signature: 'x.y', category: 'lexical', upstream: 'a/b' }),
      candidate({ signature: 'x.y', category: 'rhythm', upstream: 'c/d' }),
    ]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]!.field).toBe('category');
    expect(result.conflicts[0]!.values).toHaveLength(2);
  });

  it('rejects a signature that is not dotted snake_case', () => {
    expect(() => dedupeRuleCandidates([candidate({ signature: 'Not A Signature' })])).toThrow(
      /dotted snake_case/,
    );
  });

  it('folds a non-canonical signature through the alias map', () => {
    const result = dedupeRuleCandidates(
      [
        candidate({ signature: 'structural.old_name' }),
        candidate({ signature: 'structural.new_name' }),
      ],
      { signatureAliases: { 'structural.old_name': 'structural.new_name' } },
    );
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]!.id).toBe('structural.new_name');
    expect(result.rules[0]!.sources).toHaveLength(2);
  });

  it('applies the severity policy it is given', () => {
    const claims = [
      candidate({ signature: 'x.y', severity: 2 }),
      candidate({ signature: 'x.y', severity: 5 }),
      candidate({ signature: 'x.y', severity: 3 }),
    ];
    expect(dedupeRuleCandidates(claims, { severityPolicy: 'max' }).rules[0]!.severity).toBe(5);
    expect(dedupeRuleCandidates(claims, { severityPolicy: 'median' }).rules[0]!.severity).toBe(3);
    expect(dedupeRuleCandidates(claims, { severityPolicy: 'mean' }).rules[0]!.severity).toBe(3);
  });
});

describe('the weak-alone vote', () => {
  // Upstreams use "weak alone" for three different things, so the merge is a
  // per-upstream vote rather than a union. A union suppressed five of six real
  // findings on a plainly AI-flavoured paragraph.
  const claim = (upstream: string, weakAlone: boolean) =>
    candidate({ signature: 'x.y', upstream, upstreamRuleId: upstream, weakAlone });

  it('is not weak alone when most upstreams consider the tell conclusive', () => {
    const result = dedupeRuleCandidates([
      claim('a/one', false),
      claim('b/two', false),
      claim('c/three', true),
    ]);
    expect(result.rules[0]!.weakAlone).toBeUndefined();
    expect(result.rules[0]!.weakAloneSources).toEqual(['c/three']);
  });

  it('is weak alone when most upstreams vote for it', () => {
    const result = dedupeRuleCandidates([
      claim('a/one', false),
      claim('b/two', true),
      claim('c/three', true),
    ]);
    expect(result.rules[0]!.weakAlone).toBe(true);
    expect(result.rules[0]!.weakAloneSources).toEqual(['b/two', 'c/three']);
  });

  it('breaks a tie towards weak alone', () => {
    const result = dedupeRuleCandidates([claim('a/one', false), claim('b/two', true)]);
    expect(result.rules[0]!.weakAlone).toBe(true);
  });

  it('stays weak alone when a single upstream says so and no other claims the tell', () => {
    // This is the case the policy exists for: blader marks a pattern weak alone
    // and nothing else in the corpus states it.
    const result = dedupeRuleCandidates([claim('blader/humanizer', true)]);
    expect(result.rules[0]!.weakAlone).toBe(true);
  });

  it('counts an upstream once however many rules it contributes', () => {
    // An upstream with five rules collapsing into one signature must not get
    // five votes.
    const result = dedupeRuleCandidates([
      claim('a/one', false),
      claim('b/two', true),
      claim('b/two', true),
      claim('b/two', true),
      claim('b/two', true),
    ]);
    // Two upstreams, one vote each: a tie, which goes to weak alone.
    expect(result.rules[0]!.weakAlone).toBe(true);
    expect(result.rules[0]!.weakAloneSources).toEqual(['b/two']);
  });

  it('records the dissenters, not only the winners', () => {
    const result = dedupeRuleCandidates([
      claim('blader/humanizer', true),
      claim('judetelan/ai-humanizer', false),
      claim('ai-zixun/humanizer-zh', false),
    ]);
    expect(result.rules[0]!.weakAlone).toBeUndefined();
    expect(result.rules[0]!.weakAloneSources).toEqual(['blader/humanizer']);
  });
});

describe('combineSeverity', () => {
  it('clamps into the 1..5 band', () => {
    expect(combineSeverity([0, 0], 'mean')).toBe(1);
    expect(combineSeverity([9, 9], 'max')).toBe(5);
  });

  it('defaults to 3 when no upstream stated a severity', () => {
    expect(combineSeverity([], 'max')).toBe(3);
  });
});

describe('CanonicalRuleRegistry', () => {
  it('merges rather than rejects when the same id is added twice', () => {
    const registry = new CanonicalRuleRegistry();
    registry.add({
      id: 'a.b',
      category: 'x',
      languages: ['en'],
      description: 'one',
      rewriteGuidance: 'do a thing',
      severity: 2,
      sources: [{ upstream: 'one/one', ruleId: '7' }],
      aliases: [],
    });
    const second = registry.add({
      id: 'a.b',
      category: 'x',
      languages: ['zh'],
      description: 'one',
      rewriteGuidance: 'do a thing',
      severity: 4,
      sources: [{ upstream: 'two/two', ruleId: '9' }],
      aliases: ['a.legacy'],
    });

    expect(second.merged).toBe(true);
    expect(registry.size).toBe(1);
    const rule = registry.get('a.b')!;
    expect(rule.sources).toHaveLength(2);
    expect(rule.languages.sort()).toEqual(['en', 'zh']);
    // Merging keeps the strongest claim rather than the most recent.
    expect(rule.severity).toBe(4);
  });

  it('resolves an alias to its canonical rule', () => {
    const registry = new CanonicalRuleRegistry();
    registry.add({
      id: 'a.b',
      category: 'x',
      languages: ['en'],
      description: 'one',
      rewriteGuidance: 'do a thing',
      severity: 2,
      sources: [],
      aliases: ['a.old_name'],
    });
    expect(registry.get('a.old_name')?.id).toBe('a.b');
    expect(registry.resolveAlias('a.old_name')).toBe('a.b');
  });

  it('resolves an upstream-local rule id to the canonical rule that absorbed it', () => {
    const registry = new CanonicalRuleRegistry();
    registry.add({
      id: 'structural.negation_contrast',
      category: 'structural',
      languages: ['en', 'zh'],
      description: 'not X but Y',
      rewriteGuidance: 'say the affirmative',
      severity: 3,
      sources: [
        { upstream: 'blader/humanizer', ruleId: '1' },
        { upstream: 'humanizer-zh-cn', ruleId: '9' },
      ],
      aliases: [],
    });

    expect(
      registry.resolveUpstreamRule('blader/humanizer', '1')?.id,
    ).toBe('structural.negation_contrast');
    expect(
      registry.resolveUpstreamRule('humanizer-zh-cn', '9')?.id,
    ).toBe('structural.negation_contrast');
    expect(registry.resolveUpstreamRule('blader/humanizer', '99')).toBeUndefined();
    expect(upstreamKey('blader/humanizer', '1')).toBe('blader/humanizer#1');
  });

  it('rejects an invalid id', () => {
    expect(() =>
      new CanonicalRuleRegistry().add({
        id: 'Bad Id',
        category: 'x',
        languages: ['en'],
        description: 'd',
        rewriteGuidance: 'g',
        severity: 1,
        sources: [],
        aliases: [],
      }),
    ).toThrow(/dotted snake_case/);
  });

  it('round-trips through a snapshot', () => {
    const { registry } = buildSeedRegistry();
    const restored = CanonicalRuleRegistry.fromSnapshot(registry.toSnapshot());
    expect(restored.size).toBe(registry.size);
  });

  it('refuses a snapshot from an unknown schema version', () => {
    expect(() =>
      CanonicalRuleRegistry.fromSnapshot({
        schemaVersion: '99.0.0',
        generatedAt: '2026-01-01T00:00:00.000Z',
        rules: [],
      }),
    ).toThrow(/Unsupported rule registry schema/);
  });
});

describe('the Phase 1 seed set', () => {
  const { registry, dedupe } = buildSeedRegistry();

  it('collapses the blader lineage instead of counting it repeatedly', () => {
    const collapses = crossUpstreamMerges(dedupe);
    expect(collapses.length).toBeGreaterThanOrEqual(6);

    const inflated = registry.get('structural.inflated_significance')!;
    const upstreams = new Set(inflated.sources.map((s) => s.upstream));
    expect(upstreams.size).toBeGreaterThanOrEqual(3);

    // blader pattern 13, humanizer-zh-cn pattern 1 and ai-zixun pattern 3 are
    // one tell at three revisions plus one independent Chinese rule.
    expect(registry.resolveUpstreamRule('blader/humanizer', '13')?.id).toBe(
      'structural.inflated_significance',
    );
    expect(registry.resolveUpstreamRule('humanizer-zh-cn', '1')?.id).toBe(
      'structural.inflated_significance',
    );
  });

  it('records the stop-slop origin on the rule ai-humanizer absorbed', () => {
    const rule = registry.get('lexical.throat_clearing')!;
    const upstreams = rule.sources.map((s) => s.upstream);
    expect(upstreams).toContain('judetelan/ai-humanizer');
    expect(upstreams).toContain('hardikpandya/stop-slop');
  });

  it('labels assistant smells as local work, never as an upstream capability', () => {
    const mirroring = registry.get('chat.mirrors_user')!;
    expect(isLocalOnly(mirroring.sources)).toBe(true);
    expect(mirroring.sources[0]!.upstream).toBe(LOCAL_UPSTREAM);
  });

  it('leaves no seed claim uncollapsed that should have collapsed', () => {
    const candidates = seedRuleCandidates();
    const signatures = new Set(candidates.map((c) => c.signature));
    expect(registry.size).toBe(signatures.size);
  });
});

describe('buildProvenanceReport', () => {
  it('counts lineage collapses and local-only rules', () => {
    const { registry } = buildSeedRegistry();
    const report = buildProvenanceReport(registry.list(), '2026-09-16T00:00:00.000Z');

    expect(report.totalRules).toBe(registry.size);
    expect(report.crossUpstreamRuleCount).toBeGreaterThanOrEqual(6);
    expect(report.localOnlyRuleCount).toBeGreaterThanOrEqual(10);
    expect(report.upstreams.length).toBeGreaterThanOrEqual(4);

    const total = report.upstreams.reduce((sum, u) => sum + u.ruleCount, 0);
    expect(total).toBeGreaterThanOrEqual(report.totalRules);
  });
});
