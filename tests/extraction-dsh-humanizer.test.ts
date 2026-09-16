/**
 * Extraction tests for `lynote-ai/dsh-humanizer`.
 *
 * Integration tests against a pinned clone, so they are skipped on a fresh
 * checkout where `.upstream-cache` is empty by design. Everything asserted here
 * was read out of the clone at commit 9314b95d0b1ba663331f47f0a8ea006b6dc5f509.
 *
 * Two number corrections are recorded rather than smoothed over:
 *
 * 1. The upstream has **184** pattern strings, not the 175 the inventory report
 *    states (`upstreams/reports/dsh-humanizer.md:104`). The report's own
 *    per-rule counts (`:126-138`) sum to 184, and an independent scan of the
 *    committed compiled `lib/core/rules.js` also gives 184. The "175" total is
 *    stale. This file asserts 184 and documents the gap instead of deleting
 *    nine patterns to fit the wrong figure.
 * 2. The report lists `cliche-en` with 34 patterns in one place and 36 in
 *    another; the file and the compiled output both hold 36.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { resolveProjectRoot } from '../src/upstream/manifest.js';
import { parseDshHumanizer } from '../src/upstream/adapters/dsh-humanizer/parse.js';
import { DSH_HUMANIZER_SIGNATURES } from '../src/upstream/adapters/dsh-humanizer/signatures.js';
import { isKnownSignature, CANONICAL_SIGNATURES } from '../src/rules/canonical/signatures.js';
import type { ExtractedRule, ExtractionResult } from '../src/upstream/extract/types.js';

const projectRoot = resolveProjectRoot();
const clonePath = path.join(projectRoot, '.upstream-cache', 'dsh-humanizer');

/**
 * The upstream's own per-rule pattern counts, transcribed from
 * `upstreams/reports/dsh-humanizer.md:126-138` and verified against the source
 * and the compiled `lib/core/rules.js`.
 */
const UPSTREAM_PATTERN_COUNTS: Readonly<Record<string, number>> = {
  'empty-opener-en': 23,
  'empty-opener-zh': 12,
  'cliche-en': 36,
  'cliche-zh': 28,
  'hedge-en': 16,
  'hedge-zh': 9,
  'transition-en': 16,
  'transition-zh': 11,
  'summary-ending-en': 7,
  'summary-ending-zh': 11,
  'mechanical-parallel-zh': 4,
  'over-explain-en': 6,
  'over-explain-zh': 5,
};

const REPORTED_TOTAL = 175;
const ACTUAL_TOTAL = Object.values(UPSTREAM_PATTERN_COUNTS).reduce((n, count) => n + count, 0);

const RULE_ORDER = [
  'empty-opener-en',
  'empty-opener-zh',
  'cliche-en',
  'cliche-zh',
  'hedge-en',
  'hedge-zh',
  'transition-en',
  'transition-zh',
  'summary-ending-en',
  'summary-ending-zh',
  'mechanical-parallel-zh',
  'over-explain-en',
  'over-explain-zh',
] as const;

const EXPECTED_SEVERITY: Readonly<Record<string, number>> = {
  'empty-opener-en': 3,
  'empty-opener-zh': 3,
  'cliche-en': 2,
  'cliche-zh': 2,
  'hedge-en': 1,
  'hedge-zh': 1,
  'transition-en': 2,
  'transition-zh': 2,
  'summary-ending-en': 3,
  'summary-ending-zh': 3,
  'mechanical-parallel-zh': 3,
  'over-explain-en': 2,
  'over-explain-zh': 2,
};

const EXPECTED_SIGNATURES: Readonly<Record<string, string>> = {
  'empty-opener-en': 'structural.staged_runup',
  'empty-opener-zh': 'structural.staged_runup',
  'cliche-en': 'lexical.ai_vocabulary',
  'cliche-zh': 'chinese.boilerplate_phrase',
  'hedge-en': 'lexical.stacked_qualifiers',
  'hedge-zh': 'lexical.stacked_qualifiers',
  'transition-en': 'lexical.wordy_connectives',
  'transition-zh': 'lexical.translationese_connective',
  'summary-ending-en': 'assistant.conclusion_fluff',
  'summary-ending-zh': 'assistant.conclusion_fluff',
  'mechanical-parallel-zh': 'rhythm.forced_triad',
  'over-explain-en': 'lexical.restatement',
  'over-explain-zh': 'lexical.restatement',
};

/** Rules the upstream leaves unanchored: all seven Chinese rules and two others. */
const CHINESE_RULES = RULE_ORDER.filter((id) => id.endsWith('-zh'));

describe.skipIf(!existsSync(clonePath))('extraction: lynote-ai/dsh-humanizer', () => {
  let result: ExtractionResult;

  beforeAll(async () => {
    result = await parseDshHumanizer(clonePath);
  });

  function rule(id: string): ExtractedRule {
    const found = result.rules.find((candidate) => candidate.upstreamRuleId === id);
    expect(found, `rule ${id} was not extracted`).toBeDefined();
    return found!;
  }

  function texts(id: string): string[] {
    return rule(id).watchPhrases.map((phrase) => phrase.text);
  }

  it('extracts exactly 13 rules, in the upstream file order', () => {
    expect(result.rules).toHaveLength(13);
    expect(result.rules.map((r) => r.upstreamRuleId)).toEqual([...RULE_ORDER]);
  });

  it('reports the upstream and its source file', () => {
    expect(result.upstream).toBe('lynote-ai/dsh-humanizer');
    expect(result.sources).toEqual(['src/core/rules.ts']);
  });

  it('produces zero warnings', () => {
    expect(result.warnings).toEqual([]);
  });

  it('maps every rule onto a canonical signature', () => {
    for (const extracted of result.rules) {
      expect(extracted.signatureMapped, extracted.upstreamRuleId).toBe(true);
      expect(isKnownSignature(extracted.signature), extracted.signature).toBe(true);
    }
  });

  it('uses the intended signature for each of the 13 rules', () => {
    for (const [id, signature] of Object.entries(EXPECTED_SIGNATURES)) {
      expect(rule(id).signature, id).toBe(signature);
    }
  });

  it('covers exactly the 13 rule ids in its own signature map', () => {
    expect(Object.keys(DSH_HUMANIZER_SIGNATURES).sort()).toEqual([...RULE_ORDER].sort());
  });

  it('never invents a signature outside CANONICAL_SIGNATURES', () => {
    const known = new Set(CANONICAL_SIGNATURES.map((spec) => spec.id));
    for (const extracted of result.rules) {
      expect(known.has(extracted.signature), extracted.signature).toBe(true);
      expect(extracted.signature.startsWith('upstream.'), extracted.signature).toBe(false);
    }
  });

  describe('watched phrases', () => {
    it('extracts 184 pattern strings in total', () => {
      const total = result.rules.reduce((n, r) => n + r.watchPhrases.length, 0);
      expect(total).toBe(ACTUAL_TOTAL);
      expect(total).toBe(184);
    });

    it('reconciles the count with the upstream report, which is wrong', () => {
      // The report says 175 at :104 and then lists per-rule counts at :126-138
      // that sum to 184. Both this adapter and a scan of the committed compiled
      // lib/core/rules.js agree on 184, so the report's total is the claim that
      // fails, not the extraction.
      expect(REPORTED_TOTAL).toBe(175);
      expect(ACTUAL_TOTAL).toBe(184);
      expect(ACTUAL_TOTAL).not.toBe(REPORTED_TOTAL);
    });

    it('matches the upstream per-rule count for all 13 rules', () => {
      for (const [id, count] of Object.entries(UPSTREAM_PATTERN_COUNTS)) {
        expect(rule(id).watchPhrases.length, id).toBe(count);
      }
    });

    it('classifies every phrase as literal or template, never reference', () => {
      for (const extracted of result.rules) {
        for (const phrase of extracted.watchPhrases) {
          expect(['literal', 'template'], `${extracted.upstreamRuleId}: ${phrase.text}`).toContain(
            phrase.kind,
          );
        }
      }
    });

    it('keeps a lowercase match string for every literal phrase', () => {
      for (const extracted of result.rules) {
        for (const phrase of extracted.watchPhrases) {
          if (phrase.kind !== 'literal') continue;
          expect(phrase.match).toBe(phrase.text.toLowerCase());
        }
      }
    });

    it('records the upstream regex source for every template', () => {
      for (const extracted of result.rules) {
        for (const phrase of extracted.watchPhrases) {
          if (phrase.kind !== 'template') continue;
          expect(phrase.note, phrase.text).toMatch(/upstream regex source:/);
        }
      }
    });

    it('treats a plain-string pattern as literal and a regex as template', () => {
      const unleashers = rule('cliche-en').watchPhrases.find((p) => p.text === 'unleash');
      expect(unleashers?.kind).toBe('literal');

      const chineseWindow = rule('empty-opener-zh').watchPhrases.find((p) =>
        p.note?.includes('在这个.{0,12}的时代'),
      );
      expect(chineseWindow?.kind).toBe('template');
      expect(chineseWindow?.text).toBe('在这个\u2026的时代');

      const anchored = rule('transition-en').watchPhrases.find((p) => p.text === 'furthermore,');
      expect(anchored?.kind).toBe('template');
      expect(anchored?.note).toContain('anchored');
    });
  });

  describe('language attribution', () => {
    it('attributes seven rules to Chinese and six to English', () => {
      expect(CHINESE_RULES).toHaveLength(7);
      expect(RULE_ORDER.length - CHINESE_RULES.length).toBe(6);

      for (const id of RULE_ORDER) {
        const languages = rule(id).languages;
        if (id.endsWith('-zh')) expect(languages, id).toEqual(['zh']);
        else expect(languages, id).toEqual(['en']);
      }
    });

    it('lands 值得注意的是 on hedge-zh, where the upstream files it', () => {
      expect(texts('hedge-zh')).toContain('值得注意的是');
      // The transition rule claims the anchored variant only.
      expect(texts('transition-zh')).not.toContain('值得注意的是');
      expect(rule('transition-zh').watchPhrases.some((p) => p.note?.includes('^值得注意的是，'))).toBe(
        true,
      );
    });

    it('lands the Chinese empty openers on empty-opener-zh', () => {
      for (const phrase of ['众所周知', '显而易见', '在当今社会', '不难发现']) {
        expect(texts('empty-opener-zh'), phrase).toContain(phrase);
      }
    });

    it('lands the Chinese buzzwords on cliche-zh', () => {
      for (const phrase of ['赋能', '抓手', '闭环', '底层逻辑', '降本增效']) {
        expect(texts('cliche-zh'), phrase).toContain(phrase);
      }
    });

    it('lands the Chinese transitions on transition-zh', () => {
      for (const phrase of ['此外，', '与此同时，', '由此可见', '换言之']) {
        expect(texts('transition-zh'), phrase).toContain(phrase);
      }
    });

    it('lands the Chinese ending formulas on summary-ending-zh', () => {
      for (const phrase of ['综上所述', '总而言之', '归根结底', '让我们携手']) {
        expect(texts('summary-ending-zh'), phrase).toContain(phrase);
      }
    });

    it('lands the Chinese restatements on over-explain-zh', () => {
      for (const phrase of ['也就是说，', '换句话说，', '其核心在于']) {
        expect(texts('over-explain-zh'), phrase).toContain(phrase);
      }
    });

    it('finds no Chinese phrase on any English rule', () => {
      for (const id of RULE_ORDER.filter((candidate) => candidate.endsWith('-en'))) {
        for (const phrase of texts(id)) {
          expect(/[\u3000-\u9fff]/.test(phrase), `${id}: ${phrase}`).toBe(false);
        }
      }
    });
  });

  describe('mechanical-parallel is Chinese-only', () => {
    it('has exactly one rule for the category and it is Chinese', () => {
      const parallel = result.rules.filter((r) => r.category === 'rhythm');
      expect(parallel.map((r) => r.upstreamRuleId)).toEqual(['mechanical-parallel-zh']);
      expect(rule('mechanical-parallel-zh').languages).toEqual(['zh']);
    });

    it('carries the four parallel-frame patterns', () => {
      const phrases = rule('mechanical-parallel-zh').watchPhrases;
      expect(phrases).toHaveLength(4);
      expect(phrases.map((p) => p.text)).toEqual([
        '一方面\u2026另一方面',
        '首先\u2026其次\u2026再次',
        '不仅\u2026而且\u2026还',
        '一是\u2026二是\u2026三是',
      ]);
      expect(phrases.every((p) => p.kind === 'template')).toBe(true);
    });

    it('detects the category with no English rule at all', () => {
      expect(result.rules.filter((r) => r.upstreamRuleId.endsWith('-en') && r.category === 'rhythm')).toEqual(
        [],
      );
    });
  });

  describe('severity', () => {
    it('maps the upstream scale 3/2/1 onto 3/2/1, unchanged', () => {
      for (const [id, severity] of Object.entries(EXPECTED_SEVERITY)) {
        expect(rule(id).severity, id).toBe(severity);
      }
    });

    it('stays inside the suite band of 1..5', () => {
      for (const extracted of result.rules) {
        expect(extracted.severity).toBeGreaterThanOrEqual(1);
        expect(extracted.severity).toBeLessThanOrEqual(5);
      }
    });

    it('keeps the upstream severity in the notes so the mapping is auditable', () => {
      for (const extracted of result.rules) {
        const severityNote = extracted.notes?.find((note) => note.includes('Upstream severity'));
        expect(severityNote, extracted.upstreamRuleId).toBeDefined();
        expect(severityNote).toContain(`Upstream severity ${EXPECTED_SEVERITY[extracted.upstreamRuleId]} of 3`);
      }
    });

    it('marks exactly the two severity-1 hedge rules weak alone', () => {
      const weak = result.rules.filter((r) => r.weakAlone).map((r) => r.upstreamRuleId);
      expect(weak.sort()).toEqual(['hedge-en', 'hedge-zh']);
    });

    it('records the category for every rule', () => {
      const categories = new Set(result.rules.map((r) => r.category));
      expect(categories).toEqual(
        new Set(['structural', 'lexical', 'rhythm', 'assistant', 'chinese']),
      );
    });
  });

  describe('the broken ^ anchor', () => {
    it('counts 37 anchored patterns, the figure the provenance policy states', () => {
      const anchored = result.rules.flatMap((r) =>
        r.watchPhrases.filter((p) => p.note?.includes('anchored')),
      );
      expect(anchored).toHaveLength(37);
    });

    it('finds anchors only in transition and summary-ending rules', () => {
      const withAnchors = result.rules
        .filter((r) => r.watchPhrases.some((p) => p.note?.includes('anchored')))
        .map((r) => r.upstreamRuleId);
      expect(withAnchors).toEqual([
        'transition-en',
        'transition-zh',
        'summary-ending-en',
        'summary-ending-zh',
      ]);
    });

    it('says so in every affected rule detection string', () => {
      for (const id of ['transition-en', 'transition-zh', 'summary-ending-en', 'summary-ending-zh']) {
        expect(rule(id).detection, id).toContain('anchored ^');
        expect(rule(id).detection, id).toContain('without the m flag');
      }
    });

    it('notes the defect on every affected rule', () => {
      for (const id of ['transition-en', 'transition-zh', 'summary-ending-en', 'summary-ending-zh']) {
        const notes = (rule(id).notes ?? []).join(' ');
        expect(notes, id).toContain('no "m"');
        expect(notes, id).toContain('absolute position 0');
      }
    });

    it('gives the anchored pattern a detection string that names the mechanism', () => {
      expect(rule('transition-en').detection).toBe(
        'Lexical. 0 literal watched phrase(s), 16 construction/(regex) source(s). ' +
          '16 pattern(s) anchored ^ (upstream compiles without the m flag, so the anchor matches ' +
          'only at absolute position 0 of the input). Every pattern in this rule is anchored, so ' +
          'the rule fires only on a single-paragraph input.',
      );
      expect(rule('hedge-zh').detection).toBe('Lexical. 9 literal watched phrase(s).');
    });

    it('treats the unreachable rule as inert rather than deleting it', () => {
      // 16 of 16 transition-en patterns are anchored, so the rule can only fire
      // on a single-paragraph input. It is extracted with a signature and a
      // note, not dropped: an audit needs to see the defect in the data.
      expect(rule('transition-en').watchPhrases).toHaveLength(16);
      expect(rule('transition-en').signatureMapped).toBe(true);
    });
  });

  describe('provenance the reviewer needs', () => {
    it('gives every rule a locator at its `id:` line in the upstream file', () => {
      for (const extracted of result.rules) {
        expect(extracted.locator, extracted.upstreamRuleId).toMatch(/^src\/core\/rules\.ts:\d+$/);
      }
      expect(rule('empty-opener-en').locator).toBe('src/core/rules.ts:40');
      expect(rule('over-explain-zh').locator).toBe('src/core/rules.ts:305');
    });

    it('quotes the upstream note verbatim, bilingual where the upstream is', () => {
      expect(rule('empty-opener-en').quote).toBe(
        'Leads with a scene-setting formula instead of the actual point.',
      );
      expect(rule('hedge-zh').quote).toBe('Meaningless conservative qualifiers. 无意义的保守表述。');
      expect(rule('summary-ending-zh').quote).toBe(
        'Summary-style ending and slogan close. 总结式结尾与口号式收束。',
      );
    });

    it('uses the note as the description and says the guidance was derived', () => {
      for (const extracted of result.rules) {
        expect(extracted.description, extracted.upstreamRuleId).toBe(extracted.quote);
        const notes = (extracted.notes ?? []).join(' ');
        expect(notes, extracted.upstreamRuleId).toContain('rewriteGuidance was derived');
        expect(extracted.rewriteGuidance.length, extracted.upstreamRuleId).toBeGreaterThan(
          extracted.description.length,
        );
      }
    });

    it('records the upstream category and severity in the notes', () => {
      expect((rule('cliche-zh').notes ?? []).join(' ')).toContain('upstream category "cliche"');
      expect((rule('mechanical-parallel-zh').notes ?? []).join(' ')).toContain(
        'upstream category "mechanical-parallel"',
      );
    });

    it('carries no examples, because the upstream states none', () => {
      for (const extracted of result.rules) {
        expect(extracted.examples, extracted.upstreamRuleId).toEqual([]);
      }
    });

    it('has no title that is empty or an id', () => {
      for (const extracted of result.rules) {
        expect(extracted.title.length, extracted.upstreamRuleId).toBeGreaterThan(0);
      }
    });
  });

  describe('defects recorded rather than reproduced', () => {
    it('notes the verbatim phrase collision between hedge-zh and transition-zh', () => {
      const notes = (rule('hedge-zh').notes ?? []).join(' ');
      expect(notes).toContain('值得注意的是');
      expect(notes).toContain('another rule');
    });

    it('notes that two empty-opener-zh entries are not scene-setting', () => {
      const notes = (rule('empty-opener-zh').notes ?? []).join(' ');
      expect(notes).toContain('众所周知');
      expect(notes).toContain('near-duplicate');
    });

    it('notes that the over-explain gap was reported and then filled', () => {
      // The adapter flagged that no signature meant "restates what was just
      // said" and mapped to the nearest fit. `lexical.restatement` was added to
      // the vocabulary in response, so the note records both facts.
      for (const id of ['over-explain-en', 'over-explain-zh']) {
        const notes = (rule(id).notes ?? []).join(' ');
        expect(notes, id).toContain('no canonical signature');
        expect(notes, id).toContain('lexical.restatement');
      }
    });

    it('notes that the hedge rules measure one hedge, not a stack', () => {
      for (const id of ['hedge-en', 'hedge-zh']) {
        expect((rule(id).notes ?? []).join(' '), id).toContain('weak alone');
      }
    });

    it('notes the second tell inside summary-ending-zh', () => {
      const notes = (rule('summary-ending-zh').notes ?? []).join(' ');
      expect(notes).toContain('structural.universal_positive_ending');
    });
  });

  describe('determinism', () => {
    it('extracts the same rule data on a second run', async () => {
      const again = await parseDshHumanizer(clonePath);
      expect(again.rules).toEqual(result.rules);
      expect(again.warnings).toEqual(result.warnings);
    });
  });
});
