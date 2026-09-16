/**
 * Unified scan behaviour.
 *
 * The important assertions here are about restraint: one tell collapsed from
 * three upstreams must cost one penalty, and the scan must never produce a
 * blended "human score".
 */

import { describe, expect, it } from 'vitest';

import {
  ANTI_AI_PENALTY_BUDGET,
  collapseToCanonical,
  resolveFinding,
  scan,
  scoreAntiAI,
} from '../src/detector/scan.js';
import type { Detector, Finding } from '../src/detector/types.js';
import { buildSeedRegistry } from '../src/rules/canonical/seed.js';
import { FORBIDDEN_BLENDED_SCORE_KEYS, assertNoBlendedScore } from '../src/validation/types.js';

const { registry } = buildSeedRegistry();

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'structural.inflated_significance',
    upstream: 'blader/humanizer',
    detectorId: 'test.detector',
    category: 'structural',
    family: 'structural',
    severity: 4,
    languages: ['en', 'zh'],
    message: 'inflated significance',
    evidence: [{ start: 0, end: 5, text: 'hello' }],
    confidence: 1,
    ...overrides,
  };
}

function fakeDetector(findings: Finding[], id = 'test.detector'): Detector {
  return {
    id,
    upstream: 'human-voice-suite/local',
    family: 'structural',
    languages: ['en', 'zh', 'unknown'],
    status: 'ready',
    description: 'test double',
    detect: () => findings,
  };
}

describe('resolveFinding', () => {
  it('resolves an upstream-local rule id to its canonical rule', () => {
    const resolved = resolveFinding(finding({ ruleId: '13' }), registry);
    expect(resolved.canonicalRuleId).toBe('structural.inflated_significance');
  });

  it('resolves by upstream when the id alone is ambiguous', () => {
    // Pattern 1 means different things in different upstreams, so the upstream
    // has to participate in the lookup.
    const blader = resolveFinding(
      finding({ ruleId: '1', upstream: 'blader/humanizer' }),
      registry,
    );
    expect(blader.canonicalRuleId).toBe('structural.negation_contrast');

    const zhCn = resolveFinding(finding({ ruleId: '1', upstream: 'humanizer-zh-cn' }), registry);
    expect(zhCn.canonicalRuleId).toBe('structural.inflated_significance');
  });

  it('leaves an unknown rule alone rather than guessing', () => {
    const unknown = finding({ ruleId: 'nobody.knows', upstream: 'x/y' });
    expect(resolveFinding(unknown, registry).canonicalRuleId).toBeUndefined();
  });
});

describe('collapseToCanonical', () => {
  it('charges one tell once even when three upstreams reported it', () => {
    const collapsed = collapseToCanonical([
      finding({ upstream: 'blader/humanizer', ruleId: '13', canonicalRuleId: 'structural.inflated_significance' }),
      finding({ upstream: 'humanizer-zh-cn', ruleId: '1', canonicalRuleId: 'structural.inflated_significance' }),
      finding({ upstream: 'ai-zixun/humanizer-zh', ruleId: '3', canonicalRuleId: 'structural.inflated_significance' }),
    ]);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]!.evidence.length).toBeGreaterThan(0);
  });

  it('keeps the strongest claim and merges the evidence', () => {
    const collapsed = collapseToCanonical([
      finding({ canonicalRuleId: 'x.y', severity: 2, confidence: 0.5, evidence: [{ start: 0, end: 1, text: 'a' }] }),
      finding({ canonicalRuleId: 'x.y', severity: 5, confidence: 0.9, evidence: [{ start: 5, end: 6, text: 'b' }] }),
    ]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]!.severity).toBe(5);
    expect(collapsed[0]!.evidence.map((e) => e.text)).toEqual(['a', 'b']);
  });
});

describe('scoreAntiAI', () => {
  it('returns a perfect score when nothing fired', () => {
    const scores = scoreAntiAI([]);
    expect(scores.antiAIScore).toBe(1);
    expect(scores.rationales[0]!.summary).toBe('No detector fired.');
  });

  it('costs exactly one budget unit for one full-strength finding', () => {
    const scores = scoreAntiAI([finding({ severity: 5, confidence: 1 })]);
    expect(scores.antiAIScore).toBeCloseTo(1 - 1 / ANTI_AI_PENALTY_BUDGET, 6);
  });

  it('decreases monotonically as findings are added', () => {
    let previous = 1;
    for (let count = 1; count <= 6; count += 1) {
      const scores = scoreAntiAI(
        Array.from({ length: count }, (_, i) => finding({ canonicalRuleId: `r.${i}`, severity: 3 })),
      );
      expect(scores.antiAIScore).toBeLessThanOrEqual(previous);
      previous = scores.antiAIScore;
    }
  });

  it('never leaves the 0..1 range', () => {
    const scores = scoreAntiAI(
      Array.from({ length: 40 }, (_, i) => finding({ canonicalRuleId: `r.${i}`, severity: 5 })),
    );
    expect(scores.antiAIScore).toBeGreaterThanOrEqual(0);
    expect(scores.antiAIScore).toBeLessThanOrEqual(1);
  });

  it('reports the other three scores separately rather than fusing them', () => {
    const scores = scoreAntiAI([finding()]);
    expect(Object.keys(scores).sort()).toEqual(
      ['antiAIScore', 'behaviorScore', 'preservationScore', 'rationales', 'voiceScore'].sort(),
    );
  });

  it('exposes a per-contribution breakdown instead of a bare number', () => {
    const scores = scoreAntiAI([finding({ canonicalRuleId: 'a.b', severity: 4, confidence: 0.5 })]);
    const contributions = scores.rationales[0]!.contributions;
    expect(contributions).toHaveLength(1);
    expect(contributions[0]!.label).toBe('a.b');
    expect(contributions[0]!.value).toBeCloseTo((4 / 5) * 0.5, 6);
  });
});

describe('scan', () => {
  it('runs registered detectors and attributes findings to canonical rules', async () => {
    const result = await scan('Some AI-flavoured English prose.', {
      detectors: [fakeDetector([finding({ ruleId: '13', upstream: 'blader/humanizer' })])],
      registry,
      mode: 'prose',
    });

    expect(result.detectorsRun).toEqual(['test.detector']);
    expect(result.findings).toHaveLength(1);
    expect(result.canonicalFindings).toHaveLength(1);
    expect(result.canonicalFindings[0]!.canonicalRuleId).toBe('structural.inflated_significance');
    expect(result.language).toBe('en');
  });

  it('collapses a three-upstream report of one tell into a single deductible rule', async () => {
    const result = await scan('text', {
      detectors: [
        fakeDetector(
          [
            finding({ ruleId: '13', upstream: 'blader/humanizer' }),
            finding({ ruleId: '1', upstream: 'humanizer-zh-cn' }),
            finding({ ruleId: '3', upstream: 'ai-zixun/humanizer-zh' }),
          ],
          'multi',
        ),
      ],
      registry,
    });

    expect(result.canonicalFindings).toHaveLength(1);
    expect(result.scores.antiAIScore).toBeCloseTo(1 - (4 / 5) / ANTI_AI_PENALTY_BUDGET, 6);
  });

  it('skips detectors that do not cover the detected language', async () => {
    const zhOnly: Detector = {
      ...fakeDetector([finding()], 'zh.only'),
      languages: ['zh'],
    };
    const result = await scan('This is plainly English text.', {
      detectors: [zhOnly],
      language: 'en',
      registry,
    });
    expect(result.detectorsRun).toEqual([]);
    expect(result.findings).toEqual([]);
  });

  it('honours the finding ceiling', async () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      finding({ canonicalRuleId: `r.${i}`, ruleId: `r.${i}` }),
    );
    const result = await scan('text', { detectors: [fakeDetector(many)], registry, maxFindings: 5 });
    expect(result.findings.length).toBeLessThanOrEqual(5);
  });

  it('reports which catalog slots are still unimplemented', async () => {
    const result = await scan('text', { registry });
    // As of Phase 8 there are none: every slot in `DETECTOR_CATALOG` has a
    // detector behind it. The field stays because a scan has to be able to say
    // what it did not do, and the next planned slot will appear here.
    expect(result.detectorsPlanned).toEqual([]);
    expect(result.detectorsRun).toEqual([]);
  });

  it('produces no blended score key anywhere in the result', async () => {
    const result = await scan('text', { detectors: [fakeDetector([finding()])], registry });
    expect(() => assertNoBlendedScore(result.scores)).not.toThrow();
    const serialised = JSON.stringify(result.scores);
    for (const key of FORBIDDEN_BLENDED_SCORE_KEYS) {
      expect(serialised).not.toContain(`"${key}"`);
    }
  });
});

describe('assertNoBlendedScore', () => {
  it('rejects a fused human score wherever it appears', () => {
    for (const key of FORBIDDEN_BLENDED_SCORE_KEYS) {
      expect(() => assertNoBlendedScore({ [key]: 97 })).toThrow(/Blended score key/);
    }
  });

  it('accepts the four legitimate scores', () => {
    expect(() =>
      assertNoBlendedScore({
        antiAIScore: 0.8,
        voiceScore: 0.7,
        behaviorScore: 0.9,
        preservationScore: 1,
      }),
    ).not.toThrow();
  });
});
