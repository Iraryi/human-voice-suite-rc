/**
 * The template compiler.
 *
 * Extraction labels some watched entries `template` — constructions such as
 * `not X but Y` that cannot be matched as strings. Until they compile, eighteen
 * of blader's entries are dead data and the suite sees the vocabulary of AI
 * prose but none of its shape.
 *
 * Every case below is one of the four bugs that were found while building this,
 * so a regression here is a regression in something that was actually wrong.
 */

import { describe, expect, it } from 'vitest';

import {
  buildTemplatePatterns,
  compileTemplate,
  splitTemplate,
  templatesFor,
} from '../src/detector/shared/template.js';
import { CanonicalRuleRegistry } from '../src/rules/canonical/registry.js';
import type { CanonicalRule } from '../src/rules/types.js';

function matches(template: string, text: string): boolean {
  const regex = compileTemplate(template);
  if (!regex) return false;
  regex.lastIndex = 0;
  return regex.test(text);
}

describe('splitTemplate', () => {
  it('recognises a standalone capital letter as a slot', () => {
    expect(splitTemplate('not X but Y').map((p) => p.kind)).toEqual([
      'literal',
      'placeholder',
      'literal',
      'placeholder',
    ]);
  });

  it('tells a bracketed slot apart from a bracketed list of alternatives', () => {
    // Phase 8 separated these two, because they are not the same thing:
    // `as of [date]` is a slot and `likely [grew up, studied, began]` is the
    // upstream enumerating the verbs it means.
    const slots = (template: string): string[] =>
      splitTemplate(template).map((piece) => piece.kind);

    expect(slots('as of [date]')).toEqual(['literal', 'placeholder']);
    expect(slots('likely [grew up, studied, began]')).toEqual(['literal', 'alternation']);
  });

  it('recognises an ellipsis slot in both scripts', () => {
    expect(splitTemplate('\u4e0d\u662f\u2026\u2026\u800c\u662f\u2026\u2026').map((p) => p.kind)).toEqual([
      'literal',
      'placeholder',
      'literal',
      'placeholder',
    ]);
    expect(splitTemplate('Want me to...?').map((p) => p.kind)).toEqual([
      'literal',
      'placeholder',
      'literal',
    ]);
  });

  it('does not treat a letter inside a word as a slot', () => {
    expect(splitTemplate('Example text').every((p) => p.kind === 'literal')).toBe(true);
  });
});

describe('compileTemplate rejects what is not matchable', () => {
  it('rejects an entry that describes a construction instead of stating one', () => {
    // `the reversed form X rather than Y` is the upstream explaining a tell. A
    // pattern compiled from it would only fire on prose about the tell.
    expect(compileTemplate('the reversed form X rather than Y')).toBeNull();
    expect(compileTemplate('a clipped negative tail ("..., no guessing")')).toBeNull();
  });

  it('rejects an empty entry and a single character', () => {
    expect(compileTemplate('')).toBeNull();
    expect(compileTemplate('   ')).toBeNull();
    expect(compileTemplate('X')).toBeNull();
  });

  it('rejects a pattern that would match everything', () => {
    const regex = compileTemplate('X 是 Y');
    // Two Chinese literals are below the minimum literal content, so this does
    // not compile at all rather than matching every sentence with those words.
    expect(regex).toBeNull();
  });
});

describe('compileTemplate: a trailing slot is kept', () => {
  it('does not collapse to a bare literal prefix', () => {
    // Dropping the trailing slot left `as of `, which matches any sentence
    // containing those two words. The slot must stay.
    expect(matches('as of [date]', 'As of 2026 the rules changed.')).toBe(true);
    expect(matches('as of [date]', 'The list is as follows.')).toBe(false);
  });

  it('keeps `likely [slot]` from matching the bare word', () => {
    expect(matches('likely [grew up, studied, began]', 'She likely grew up nearby.')).toBe(true);
    expect(matches('likely [grew up, studied, began]', 'That is likely.')).toBe(false);
  });
});

describe('compileTemplate: whitespace belongs to the boundary', () => {
  it('matches with no space before the slot, as in Want me to...?', () => {
    // The upstream writes `Want me to...?` with no space, so a literal reading
    // of the literal segments finds a space where the text has one and fails.
    expect(matches('Want me to...?', 'Want me to expand on any section?')).toBe(true);
  });

  it('matches across a Chinese slot even though the template is spaced', () => {
    // `让 X 成为可能` is written with spaces; Chinese prose has none.
    expect(matches('\u8ba9 X \u6210\u4e3a\u53ef\u80fd', '\u8fd9\u9879\u6280\u672f\u8ba9\u534f\u4f5c\u6210\u4e3a\u53ef\u80fd\u3002')).toBe(
      true,
    );
  });
});

describe('compileTemplate: bundled variants', () => {
  it('compiles a stop-slop table cell holding two alternatives', () => {
    const template = 'Not because X. Because Y." / "Not because X, but because Y.';
    expect(matches(template, 'Not because it failed. Because it never started.')).toBe(true);
    expect(matches(template, 'Not because it failed, but because it never started.')).toBe(true);
  });
});

describe('compileTemplate: matching behaviour', () => {
  it('matches a real construction and not ordinary prose', () => {
    expect(matches('not X but Y', 'This is not a tool but a mirror.')).toBe(true);
    expect(matches('not X but Y', 'The cat sat on the mat.')).toBe(false);
  });

  it('matches the Chinese contrast frame', () => {
    expect(
      matches('\u4e0d\u662f\u2026\u2026\u800c\u662f\u2026\u2026', '\u8fd9\u4e0d\u662f\u4e00\u6b21\u66f4\u65b0\uff0c\u800c\u662f\u4e00\u6b21\u8f6c\u5411\u3002'),
    ).toBe(true);
    expect(
      matches('\u4e0d\u662f\u2026\u2026\u800c\u662f\u2026\u2026', '\u8fd9\u6b21\u66f4\u65b0\u7684\u8303\u56f4\u5f88\u6709\u9650\u3002'),
    ).toBe(false);
  });

  it('does not let a slot cross a sentence boundary', () => {
    expect(matches('X is the Y of Z', 'Symmetry is the language of trust.')).toBe(true);
    expect(matches('X is the Y of Z', 'One is here. The other of them is gone.')).toBe(false);
  });

  it('matches a plain literal that extraction happened to label a template', () => {
    // `in conclusion` sat in a list containing an ellipsis, so extraction called
    // it a template. It is a phrase, and it must still be matchable.
    expect(matches('in conclusion', 'In conclusion, the project shipped.')).toBe(true);
  });

  it('reads a bracketed list as alternatives, not as a wildcard slot', () => {
    // Phase 8. blader's list is "likely [grew up, studied, began]" — the verbs it
    // means, not a slot. Compiling it as a wildcard made `likely` plus anything a
    // match, and it produced a severity-5 false positive on a human-written
    // sample in the benchmark: "most likely to come next".
    expect(matches('likely [grew up, studied, began]', 'She likely grew up in a small town.')).toBe(
      true,
    );
    expect(matches('likely [grew up, studied, began]', 'The company likely began as a side project.')).toBe(
      true,
    );
    expect(
      matches('likely [grew up, studied, began]', 'whatever is most likely to come next'),
    ).toBe(false);
    expect(matches('likely [grew up, studied, began]', 'That outcome is likely.')).toBe(false);
  });

  it('still reads a single-token bracket as a slot', () => {
    // The other bracket form, and the reason the two cannot share a compile rule:
    // "as of [date]" means any date.
    expect(matches('as of [date]', 'As of March 2024 the rule stands.')).toBe(true);
    expect(matches('as of [date]', 'This is a fine sentence.')).toBe(false);
  });
});

describe('buildTemplatePatterns', () => {
  function rule(overrides: Partial<CanonicalRule> & { id: string }): CanonicalRule {
    return {
      category: overrides.id.split('.')[0] ?? 'structural',
      languages: ['en'],
      description: 'a tell',
      rewriteGuidance: 'fix it',
      severity: 3,
      sources: [{ upstream: 'test/upstream', ruleId: overrides.id }],
      aliases: [],
      ...overrides,
    };
  }

  it('compiles only template phrases, and reports what it skipped', () => {
    const rules = [
      rule({
        id: 'structural.negation_contrast',
        languages: ['en', 'zh'],
        watchPhrases: [
          { text: 'not X but Y', kind: 'template', match: 'not X but Y' },
          { text: 'delve', kind: 'literal', match: 'delve' },
          { text: 'the reversed form X rather than Y', kind: 'template', match: 'the reversed form X rather than Y' },
        ],
      }),
    ];
    const report = buildTemplatePatterns(rules, 'en');
    expect(report.compiled.map((c) => c.template)).toEqual(['not X but Y']);
    expect(report.skipped.map((s) => s.template)).toEqual(['the reversed form X rather than Y']);
  });

  it('filters by language', () => {
    const rules = [
      rule({
        id: 'structural.negation_contrast',
        languages: ['zh'],
        watchPhrases: [
          { text: '\u4e0d\u662f\u2026\u2026\u800c\u662f\u2026\u2026', kind: 'template', match: '' },
        ],
      }),
    ];
    expect(buildTemplatePatterns(rules, 'en').compiled).toEqual([]);
    expect(buildTemplatePatterns(rules, 'zh').compiled).toHaveLength(1);
  });

  it('caches per registry and language', () => {
    const registry = new CanonicalRuleRegistry([]);
    const first = templatesFor(registry, 'en');
    const second = templatesFor(registry, 'en');
    expect(first).toBe(second);
  });
});

describe('against the real registry', () => {
  it('compiles the majority of the corpus templates and skips only descriptions', async () => {
    const { buildRegistryFromExtractions } = await import('../src/rules/canonical/load.js');
    const { registry } = await buildRegistryFromExtractions();

    for (const language of ['en', 'zh']) {
      const report = buildTemplatePatterns(registry.list(), language);
      // The corpus carries far more constructions than descriptions, so a run
      // that skipped most of them would mean the compiler had regressed.
      expect(report.compiled.length, language).toBeGreaterThan(50);
      expect(report.compiled.length).toBeGreaterThan(report.skipped.length);
    }
  });

  it('compiles the specific constructions the inventory names', async () => {
    const { buildRegistryFromExtractions } = await import('../src/rules/canonical/load.js');
    const { registry } = await buildRegistryFromExtractions();
    const compiled = new Set(
      buildTemplatePatterns(registry.list(), 'zh')
        .compiled.concat(buildTemplatePatterns(registry.list(), 'en').compiled)
        .map((c) => c.template),
    );
    for (const template of [
      'not X but Y',
      '\u4e0d\u662f\u2026\u2026\u800c\u662f\u2026\u2026',
      '\u4e00\u65b9\u9762\u2026\u53e6\u4e00\u65b9\u9762',
      'Want me to...?',
      'as of [date]',
    ]) {
      expect(compiled, template).toContain(template);
    }
  });
});
