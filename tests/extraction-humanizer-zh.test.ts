/**
 * `ai-zixun/humanizer-zh` extraction.
 *
 * The upstream is not a `blader` localisation: it ships 13 Chinese patterns in
 * `references/patterns.md` and eight normative "Core Rules" in `SKILL.md`. Both
 * are parsed, and both namespaces are asserted separately — the pattern numbers
 * and the `core-N` ids must never collide.
 *
 * The integration assertions need the pinned clone, so they are skipped on a
 * fresh checkout where `.upstream-cache` is empty. The signature-map assertions
 * run everywhere.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseHumanizerZh } from '../src/upstream/adapters/humanizer-zh/parse.js';
import {
  HUMANIZER_ZH_CORE_SIGNATURES,
  HUMANIZER_ZH_PATTERN_SIGNATURES,
  HUMANIZER_ZH_SIGNATURES,
  RESTATED_HUMANIZER_ZH_CORE_RULES,
  UNMAPPED_HUMANIZER_ZH_RULES,
} from '../src/upstream/adapters/humanizer-zh/signatures.js';
import { extractionProblems } from '../src/upstream/extract/types.js';
import { CANONICAL_SIGNATURES, isKnownSignature } from '../src/rules/canonical/signatures.js';
import { resolveProjectRoot } from '../src/upstream/manifest.js';

const projectRoot = resolveProjectRoot();
const clonePath = path.join(projectRoot, '.upstream-cache', 'humanizer-zh');
const clonePresent = existsSync(clonePath);

/** The number of patterns the upstream promises. A change here means a re-map. */
const EXPECTED_PATTERNS = 13;

/** The eight `### N.` rules under `## Core Rules` in SKILL.md. */
const EXPECTED_CORE_RULES = 8;

/** The phrase lists of pattern 1, verbatim from `references/patterns.md:23-26`. */
const PATTERN_1_PHRASES = [
  '不是……而是……',
  '不仅……还……',
  '不再只是……而是开始……',
  'X 并不意味着 Y，而是意味着 Z',
];

describe('humanizer-zh signature map', () => {
  it('maps every canonical signature it names', () => {
    for (const [id, signature] of Object.entries(HUMANIZER_ZH_SIGNATURES)) {
      expect(isKnownSignature(signature), `${id} -> ${signature}`).toBe(true);
    }
  });

  it('covers all thirteen patterns and no more', () => {
    expect(Object.keys(HUMANIZER_ZH_PATTERN_SIGNATURES).sort((a, b) => Number(a) - Number(b))).toEqual(
      Array.from({ length: EXPECTED_PATTERNS }, (_, index) => String(index + 1)),
    );
  });

  it('reuses an English signature only where the tell is genuinely the same', () => {
    // 1, 3, 4, 7, 8, 9, 12 and 13 detect tells the English lineage already names.
    expect(HUMANIZER_ZH_PATTERN_SIGNATURES['1']).toBe('structural.negation_contrast');
    expect(HUMANIZER_ZH_PATTERN_SIGNATURES['3']).toBe('structural.inflated_significance');
    expect(HUMANIZER_ZH_PATTERN_SIGNATURES['4']).toBe('structural.one_line_closer');
    expect(HUMANIZER_ZH_PATTERN_SIGNATURES['7']).toBe('chinese.officialese');
    expect(HUMANIZER_ZH_PATTERN_SIGNATURES['8']).toBe('lexical.stacked_qualifiers');
    expect(HUMANIZER_ZH_PATTERN_SIGNATURES['13']).toBe('lexical.aphorism_dressing');
    // The Chinese-only tells stay inside the `chinese.*` and `structural.*` zh ids.
    expect(HUMANIZER_ZH_PATTERN_SIGNATURES['2']).toBe('lexical.translationese_connective');
    expect(HUMANIZER_ZH_PATTERN_SIGNATURES['9']).toBe('structural.opening_body_ending_disconnect');
    expect(HUMANIZER_ZH_PATTERN_SIGNATURES['10']).toBe('structural.article_level_rewrite_template');
    expect(HUMANIZER_ZH_PATTERN_SIGNATURES['11']).toBe('structural.enumeration_padding');
  });

  it('namespaces the Core Rules so they cannot collide with pattern numbers', () => {
    for (const id of Object.keys(HUMANIZER_ZH_CORE_SIGNATURES)) {
      expect(id).toMatch(/^core-[1-8]$/);
      expect(HUMANIZER_ZH_PATTERN_SIGNATURES[id]).toBeUndefined();
    }
  });

  it('resolved every signature gap instead of leaving a fallback in the map', () => {
    // This adapter originally reported five Core Rules with no canonical
    // signature. Three were genuine gaps — quote and terminology conventions,
    // and extreme-conclusion policing — and the vocabulary was extended to name
    // them. The other two are restatements of patterns, so they are excluded
    // rather than imported under a signature that could never deduplicate.
    expect(Object.keys(UNMAPPED_HUMANIZER_ZH_RULES).sort()).toEqual([
      'core-6',
      'core-7',
      'core-8',
    ]);
    for (const id of Object.keys(UNMAPPED_HUMANIZER_ZH_RULES)) {
      expect(HUMANIZER_ZH_CORE_SIGNATURES[id], id).toBeDefined();
    }
    expect([...RESTATED_HUMANIZER_ZH_CORE_RULES]).toEqual(['core-1', 'core-2']);
    for (const id of RESTATED_HUMANIZER_ZH_CORE_RULES) {
      expect(HUMANIZER_ZH_CORE_SIGNATURES[id], id).toBeUndefined();
    }
  });

  it('uses only ids that exist in the canonical vocabulary', () => {
    const known = new Set(CANONICAL_SIGNATURES.map((spec) => spec.id));
    for (const [id, signature] of Object.entries(HUMANIZER_ZH_CORE_SIGNATURES)) {
      expect(known.has(signature), `${id} -> ${signature}`).toBe(true);
    }
  });
});

/**
 * Integration tests against the pinned clone. Skipped on a fresh checkout of
 * this repository, where `.upstream-cache` is empty by design.
 */
describe.skipIf(!clonePresent)('against the humanizer-zh clone', () => {
  const parse = async (): Promise<Awaited<ReturnType<typeof parseHumanizerZh>>> =>
    parseHumanizerZh(clonePath);

  it('extracts exactly 13 patterns numbered 1..13, with 目录 excluded', async () => {
    const result = await parse();
    const patterns = result.rules.filter((rule) => !rule.upstreamRuleId.startsWith('core-'));

    expect(patterns).toHaveLength(EXPECTED_PATTERNS);
    expect(patterns.map((rule) => rule.upstreamRuleId)).toEqual(
      Array.from({ length: EXPECTED_PATTERNS }, (_, index) => String(index + 1)),
    );
    // The `## 目录` table of contents lists the same 13 titles, but it carries no
    // heading number, so it must not appear as a fourteenth rule.
    expect(patterns.every((rule) => /^\d{1,3}$/.test(rule.upstreamRuleId))).toBe(true);
    expect(patterns.some((rule) => rule.title === '目录')).toBe(false);
    // Section 10's six `### N.` rewrite sub-paths are H3, not patterns.
    expect(patterns.some((rule) => rule.title.includes('把问题钉住'))).toBe(false);
  });

  it('extracts every pattern without a warning and with a mapped signature', async () => {
    const result = await parse();
    const patterns = result.rules.filter((rule) => !rule.upstreamRuleId.startsWith('core-'));

    for (const rule of patterns) {
      expect(rule.signatureMapped, `${rule.upstreamRuleId} ${rule.title}`).toBe(true);
      expect(rule.category.length).toBeGreaterThan(0);
      expect(rule.languages.length).toBeGreaterThan(0);
      expect(rule.severity).toBeGreaterThanOrEqual(1);
      expect(rule.severity).toBeLessThanOrEqual(5);
      expect(rule.locator).toMatch(/^references\/patterns\.md:\d+$/);
      expect(rule.quote?.length ?? 0).toBeGreaterThan(0);
      expect(rule.description.length).toBeGreaterThan(0);
      expect(rule.rewriteGuidance.length).toBeGreaterThan(0);
    }

    expect(result.warnings.filter((warning) => !warning.includes('Core Rule'))).toEqual([]);
  });

  it('preserves pattern 1 verbatim, title and watched phrases included', async () => {
    const result = await parse();
    const first = result.rules.find((rule) => rule.upstreamRuleId === '1');
    expect(first).toBeDefined();

    expect(first?.title).toBe('机械对照句');
    expect(first?.locator).toBe('references/patterns.md:19');
    expect(first?.watchPhrases.map((phrase) => phrase.text)).toEqual(PATTERN_1_PHRASES);
    // `不是……而是……` is a construction, not a string to match.
    expect(first?.watchPhrases.every((phrase) => phrase.kind === 'template')).toBe(true);
    expect(first?.description).toContain('这些句式不是不能用');
    expect(first?.examples).toHaveLength(1);
    expect(first?.examples[0]?.before).toContain('这不是一次普通的产品更新');
    expect(first?.examples[0]?.after).toContain('这次更新的重要性不在新功能本身');
  });

  it('keeps the watched phrases of every pattern in the upstream wording', async () => {
    const result = await parse();
    const phraseOf = (id: string): string[] =>
      (result.rules.find((rule) => rule.upstreamRuleId === id)?.watchPhrases ?? []).map(
        (phrase) => phrase.text,
      );

    expect(phraseOf('2')).toEqual([
      '对于……来说',
      '基于此',
      '围绕……展开',
      '从某种意义上说',
      '值得注意的是',
      '与此同时',
      '在这一背景下',
      '使得……得以……',
    ]);
    expect(phraseOf('3')).toEqual([
      '颠覆',
      '革命',
      '赋能',
      '重塑',
      '引领',
      '开启新篇章',
      '里程碑',
      '深远影响',
    ]);
    expect(phraseOf('4')).toEqual([
      '未来已经到来',
      '这只是开始',
      '行业将迎来新的篇章',
      '真正的变革才刚刚开始',
    ]);
    expect(phraseOf('7')).toEqual([
      '持续深化',
      '全面推进',
      '积极探索',
      '取得显著成效',
      '实现高质量发展',
      '打造闭环',
    ]);
    expect(phraseOf('12')).toEqual([
      '接下来要……',
      '下一步是……',
      '接下来的问题是……',
      '下一篇会讲到……',
    ]);
    expect(phraseOf('13')).toEqual([
      '本质上',
      '这件事',
      '真正重要的是',
      '归根结底',
      '说到底',
      '回到最初的那个问题',
    ]);
  });

  it('imports the six Core Rules that are not restatements of a pattern', async () => {
    const result = await parse();
    const core = result.rules.filter((rule) => rule.upstreamRuleId.startsWith('core-'));

    // Core Rules 1 and 2 are excluded on purpose: their headline claims restate
    // patterns extracted from the same upstream, and as separate rules they
    // would carry different signatures, so deduplication could not collapse them
    // and one tell would be charged twice.
    expect(core).toHaveLength(EXPECTED_CORE_RULES - RESTATED_HUMANIZER_ZH_CORE_RULES.length);
    expect(core.map((rule) => rule.upstreamRuleId)).toEqual([
      'core-3',
      'core-4',
      'core-5',
      'core-6',
      'core-7',
      'core-8',
    ]);
    expect(core.map((rule) => rule.title)).toEqual([
      '打散机械结构',
      '保持中文节奏',
      '管住文章级结构',
      '处理标点和排版',
      '统一常见术语和日期',
      '控制判断强度',
    ]);
    for (const rule of core) {
      expect(rule.locator).toMatch(/^SKILL\.md:\d+$/);
      // Core Rule 3 maps to an `en`+`zh` signature, so its language set comes
      // from the vocabulary rather than from the source file's language.
      expect(rule.languages.length).toBeGreaterThan(0);
      expect(rule.description.length).toBeGreaterThan(0);
      expect(rule.rewriteGuidance.length).toBeGreaterThan(0);
    }
  });

  it('never lets a Core Rule id collide with a pattern number', async () => {
    const result = await parse();
    const ids = result.rules.map((rule) => rule.upstreamRuleId);
    expect(new Set(ids).size).toBe(ids.length);

    const patterns = new Set(
      result.rules
        .filter((rule) => !rule.upstreamRuleId.startsWith('core-'))
        .map((rule) => rule.upstreamRuleId),
    );
    for (const rule of result.rules) {
      if (!rule.upstreamRuleId.startsWith('core-')) continue;
      expect(patterns.has(rule.upstreamRuleId)).toBe(false);
      expect(patterns.has(rule.upstreamRuleId.replace('core-', ''))).toBe(true);
    }
  });

  it('leaves no rule unmapped, so nothing is silently left out of deduplication', async () => {
    const result = await parse();
    const unmapped = result.rules.filter((rule) => !rule.signatureMapped);

    // This adapter originally reported five Core Rules with no canonical
    // signature. Three were real gaps and the vocabulary was extended to cover
    // them; the other two are restatements of patterns and are excluded rather
    // than imported under a fallback signature that could never deduplicate.
    expect(unmapped).toEqual([]);
    expect(extractionProblems(result)).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('records the two excluded Core Rules as a deliberate disclosure', async () => {
    const result = await parse();
    const disclosures = result.disclosures ?? [];

    expect(disclosures).toHaveLength(RESTATED_HUMANIZER_ZH_CORE_RULES.length);
    for (const id of RESTATED_HUMANIZER_ZH_CORE_RULES) {
      const number = id.replace('core-', '');
      expect(disclosures.some((note) => note.includes(`Core Rule ${number}`))).toBe(true);
    }
    // The reason must be the double-charging risk, not a parser limitation.
    expect(disclosures.join(' ')).toContain('charge one tell twice');
  });

  it('gives every signature a category from the vocabulary', async () => {
    const result = await parse();
    const categories = new Map(CANONICAL_SIGNATURES.map((spec) => [spec.id, spec.category]));
    for (const rule of result.rules) {
      if (!rule.signatureMapped) continue;
      expect(rule.category, rule.upstreamRuleId).toBe(categories.get(rule.signature));
    }
  });

  it('reads the pinned version and both source files', async () => {
    const result = await parse();
    expect(result.upstream).toBe('ai-zixun/humanizer-zh');
    expect(result.sources).toEqual(['references/patterns.md', 'SKILL.md']);
    // The extraction runner fills the commit in from the clone's git HEAD.
    expect(result.sourceCommit).toBe('');
    expect(result.extractedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
