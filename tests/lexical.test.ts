/**
 * The rule-driven lexical detector.
 *
 * One detector serves every upstream because it reads watched phrases from the
 * canonical rules rather than from any one repository. These tests pin the
 * properties that make that safe: only literal phrases are matched, Chinese is
 * matched without word boundaries, and a phrase the upstream restricted by scope
 * is matched with lower confidence rather than at full strength.
 */

import { describe, expect, it } from 'vitest';

import {
  MAX_EVIDENCE_PER_RULE,
  buildPhrasePatterns,
  createLexicalDetector,
  expandVariants,
} from '../src/detector/lexical/rule-driven.js';
import { CanonicalRuleRegistry } from '../src/rules/canonical/registry.js';
import type { CanonicalRule } from '../src/rules/types.js';
import type { Finding } from '../src/detector/types.js';

function rule(overrides: Partial<CanonicalRule> & { id: string }): CanonicalRule {
  return {
    category: overrides.id.split('.')[0] ?? 'lexical',
    languages: ['en'],
    description: 'a tell',
    rewriteGuidance: 'fix it',
    severity: 3,
    sources: [{ upstream: 'test/upstream', ruleId: overrides.id }],
    aliases: [],
    ...overrides,
  };
}

function registryWith(rules: readonly CanonicalRule[]): CanonicalRuleRegistry {
  return new CanonicalRuleRegistry(rules);
}

describe('expandVariants', () => {
  it('splits a slash-separated variant list', () => {
    expect(expandVariants('gate/gated/gating')).toEqual(['gate', 'gated', 'gating']);
    expect(expandVariants('intricate/intricacies')).toEqual(['intricate', 'intricacies']);
  });

  it('leaves a phrase with no slash alone', () => {
    expect(expandVariants('deep dive')).toEqual(['deep dive']);
  });

  it('trims the parts and drops empties', () => {
    expect(expandVariants(' a / b / ')).toEqual(['a', 'b']);
  });
});

describe('buildPhrasePatterns', () => {
  const registry = registryWith([
    rule({
      id: 'lexical.ai_vocabulary',
      languages: ['en', 'zh'],
      watchPhrases: [
        { text: 'deep dive', kind: 'literal', match: 'deep dive' },
        { text: 'gate/gated/gating', kind: 'literal', match: 'gate/gated/gating' },
        { text: 'not X but Y', kind: 'template', match: 'not X but Y' },
        { text: 'key', kind: 'reference', match: 'key' },
        { text: 'highlight', kind: 'literal', match: 'highlight', note: 'verb' },
      ],
    }),
    rule({
      id: 'chinese.noteworthy_filler',
      languages: ['zh'],
      watchPhrases: [{ text: '\u503c\u5f97\u6ce8\u610f\u7684\u662f', kind: 'literal', match: '\u503c\u5f97\u6ce8\u610f\u7684\u662f' }],
    }),
  ]);

  it('uses only literal phrases', () => {
    const patterns = buildPhrasePatterns(registry.list(), 'en');
    const texts = patterns.map((p) => p.phrase.text);
    expect(texts).toContain('deep dive');
    expect(texts).not.toContain('not X but Y');
    expect(texts).not.toContain('key');
  });

  it('filters by language', () => {
    const english = buildPhrasePatterns(registry.list(), 'en').map((p) => p.ruleId);
    expect(english).not.toContain('chinese.noteworthy_filler');

    const chinese = buildPhrasePatterns(registry.list(), 'zh').map((p) => p.ruleId);
    expect(chinese).toContain('chinese.noteworthy_filler');
    // A rule declared for both languages is used for both.
    expect(chinese).toContain('lexical.ai_vocabulary');
  });

  it('lowers confidence for a phrase the upstream restricted by scope', () => {
    const patterns = buildPhrasePatterns(registry.list(), 'en');
    const noted = patterns.find((p) => p.phrase.note === 'verb');
    const plain = patterns.find((p) => p.phrase.text === 'deep dive');
    expect(noted!.confidence).toBeLessThan(plain!.confidence);
  });
});

describe('createLexicalDetector', () => {
  /**
   * The detector interface allows a promise, so a caller has to await. Our
   * implementation is synchronous, and awaiting a non-promise is harmless.
   */
  async function detect(
    text: string,
    language: string,
    rules: readonly CanonicalRule[],
  ): Promise<Finding[]> {
    const registry = registryWith(rules);
    const result = await createLexicalDetector().detect(text, {
      language: language as 'en',
      mode: 'prose',
      rules: registry,
    });
    return [...result];
  }

  it('returns nothing without a registry, rather than guessing', async () => {
    const result = await createLexicalDetector().detect('delve', {
      language: 'en',
      mode: 'prose',
    });
    expect([...result]).toEqual([]);
  });

  it('matches a literal phrase and reports evidence spans', async () => {
    const findings = await detect('We should delve into the details.', 'en', [
      rule({
        id: 'lexical.ai_vocabulary',
        watchPhrases: [{ text: 'delve', kind: 'literal', match: 'delve' }],
      }),
    ]);

    expect(findings).toHaveLength(1);
    const finding = findings[0]!;
    expect(finding.ruleId).toBe('lexical.ai_vocabulary');
    expect(finding.canonicalRuleId).toBe('lexical.ai_vocabulary');
    expect(finding.evidence[0]!.text).toBe('delve');
    expect(finding.evidence[0]!.start).toBe(10);
    expect(finding.message).toMatch(/1 watched phrase hit/);
  });

  it('matches whole words only for Latin text', async () => {
    const rules = [
      rule({
        id: 'lexical.ai_vocabulary',
        watchPhrases: [{ text: 'delve', kind: 'literal', match: 'delve' }],
      }),
    ];
    expect(await detect('delved into it', 'en', rules)).toHaveLength(0);
    expect(await detect('delve into it', 'en', rules)).toHaveLength(1);
  });

  it('matches Chinese as a substring, because Chinese has no word boundaries', async () => {
    const rules = [
      rule({
        id: 'chinese.noteworthy_filler',
        languages: ['zh'],
        watchPhrases: [
          { text: '\u503c\u5f97\u6ce8\u610f\u7684\u662f', kind: 'literal', match: '\u503c\u5f97\u6ce8\u610f\u7684\u662f' },
        ],
      }),
    ];
    expect(
      await detect('\u503c\u5f97\u6ce8\u610f\u7684\u662f\uff0c\u6570\u636e\u663e\u793a\u2026\u2026', 'zh', rules),
    ).toHaveLength(1);
  });

  it('matches every slash variant', async () => {
    const rules = [
      rule({
        id: 'lexical.ai_vocabulary',
        watchPhrases: [{ text: 'gate/gated/gating', kind: 'literal', match: 'gate/gated/gating' }],
      }),
    ];
    expect(await detect('the gated path', 'en', rules)).toHaveLength(1);
  });

  it('produces one finding per rule however many phrases hit', async () => {
    const rules = [
      rule({
        id: 'lexical.ai_vocabulary',
        watchPhrases: [
          { text: 'delve', kind: 'literal', match: 'delve' },
          { text: 'crucial', kind: 'literal', match: 'crucial' },
          { text: 'pivotal', kind: 'literal', match: 'pivotal' },
        ],
      }),
    ];
    const findings = await detect('It is crucial, pivotal and we delve in.', 'en', rules);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.message).toMatch(/3 watched phrase hit/);
  });

  it('caps the evidence it carries', async () => {
    const rules = [
      rule({
        id: 'lexical.ai_vocabulary',
        watchPhrases: [{ text: 'delve', kind: 'literal', match: 'delve' }],
      }),
    ];
    const text = Array.from({ length: 20 }, () => 'delve').join(' and ');
    const findings = await detect(text, 'en', rules);
    expect(findings[0]!.evidence.length).toBe(MAX_EVIDENCE_PER_RULE);
    expect(findings[0]!.message).toMatch(/20 watched phrase hit/);
  });

  it('attributes the finding to the rule\u2019s own source upstream', async () => {
    const rules = [
      rule({
        id: 'lexical.ai_vocabulary',
        sources: [{ upstream: 'blader/humanizer', ruleId: '12' }],
        watchPhrases: [{ text: 'delve', kind: 'literal', match: 'delve' }],
      }),
    ];
    expect((await detect('delve', 'en', rules))[0]!.upstream).toBe('blader/humanizer');
  });

  it('honours the exclude list', async () => {
    const rules = [
      rule({
        id: 'lexical.ai_vocabulary',
        watchPhrases: [{ text: 'delve', kind: 'literal', match: 'delve' }],
      }),
    ];
    const registry = registryWith(rules);
    const excluded = await createLexicalDetector({
      excludeRuleIds: new Set(['lexical.ai_vocabulary']),
    }).detect('delve', { language: 'en', mode: 'prose', rules: registry });
    expect([...excluded]).toEqual([]);
  });

  it('carries the rule severity and category onto the finding', async () => {
    const rules = [
      rule({
        id: 'lexical.ai_vocabulary',
        severity: 4,
        watchPhrases: [{ text: 'delve', kind: 'literal', match: 'delve' }],
      }),
    ];
    const finding = (await detect('delve', 'en', rules))[0]!;
    expect(finding.severity).toBe(4);
    expect(finding.category).toBe('lexical');
    expect(finding.family).toBe('lexical');
  });
});
