/**
 * `humanizer-zh-cn` rule extraction.
 *
 * The clone is a pinned input, so these tests check two different things:
 *
 * 1. The parse itself — 33 contiguous patterns, no warnings, every rule mapped.
 * 2. That the Chinese content survives verbatim. A parser that silently drops
 *    the 留意 list or mangles a 改前/改后 pair still returns 33 rules, and the
 *    only way to notice is to pin the exact text.
 *
 * The reuse count is pinned for the same reason. It is the number that keeps the
 * lineage collapsing at dedupe time; if a future edit maps a Chinese pattern
 * onto a fresh signature, that count moves and the test says so.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { parseHumanizerZhCn } from '../src/upstream/adapters/humanizer-zh-cn/parse.js';
import { HUMANIZER_ZH_CN_SIGNATURES } from '../src/upstream/adapters/humanizer-zh-cn/signatures.js';
import { BLADER_SIGNATURES } from '../src/upstream/adapters/blader/signatures.js';
import { isKnownSignature } from '../src/rules/canonical/signatures.js';
import { toRuleCandidates } from '../src/upstream/extract/types.js';
import type { ExtractedRule, ExtractionResult } from '../src/upstream/extract/types.js';
import { resolveProjectRoot } from '../src/upstream/manifest.js';

const projectRoot = resolveProjectRoot();
const clonePath = path.join(projectRoot, '.upstream-cache', 'humanizer-zh-cn');
const skillPath = path.join(clonePath, 'SKILL.md');

const PATTERN_COUNT = 33;

/**
 * Patterns whose signature is also used by a blader pattern. Fixed at 21 by the
 * mapping: 12 Chinese patterns stand alone, either because they are localised
 * tells that no English pattern covers or because they are Chinese-only.
 */
const REUSED_BLADER_SIGNATURE_COUNT = 21;

const bladerSignatures = new Set(Object.values(BLADER_SIGNATURES));

let result: ExtractionResult;

function ruleAt(ruleNumber: number): ExtractedRule {
  const found = result.rules.find((rule) => rule.upstreamRuleId === String(ruleNumber));
  expect(found, `rule ${String(ruleNumber)} is missing from the extraction`).toBeDefined();
  return found as ExtractedRule;
}

function skillLine(line: number): string {
  return readFileSync(skillPath, 'utf8').split(/\r?\n/)[line - 1] ?? '';
}

describe.skipIf(!existsSync(clonePath))('humanizer-zh-cn extraction', () => {
  beforeAll(async () => {
    result = await parseHumanizerZhCn(clonePath);
  });

  it('extracts exactly 33 rules, numbered 1..33 with no gaps', () => {
    expect(result.rules).toHaveLength(PATTERN_COUNT);
    expect(result.rules.map((rule) => rule.upstreamRuleId)).toEqual(
      Array.from({ length: PATTERN_COUNT }, (_, index) => String(index + 1)),
    );
  });

  it('reports no warnings', () => {
    expect(result.warnings).toEqual([]);
  });

  it('maps every rule onto a canonical signature', () => {
    for (const rule of result.rules) {
      expect(rule.signatureMapped, `rule ${rule.upstreamRuleId} ${rule.signature}`).toBe(true);
      expect(isKnownSignature(rule.signature), rule.signature).toBe(true);
    }
  });

  it('claims the upstream identity and the pinned commit subject', () => {
    expect(result.upstream).toBe('holygeek00/humanizer-zh-cn');
    expect(result.sources).toEqual(['SKILL.md']);
  });

  it('keeps pattern 1 title, watched list and example verbatim', () => {
    const rule = ruleAt(1);

    expect(rule.title).toBe('空泛拔高意义');
    expect(rule.watchPhrases.map((phrase) => phrase.text)).toEqual([
      '标志着',
      '彰显了',
      '体现了',
      '具有里程碑意义',
      '注入新动能',
      '开启新篇章',
      '为……奠定基础',
      '推动……迈上新台阶',
    ]);
    // The two entries carrying `……` are constructions, not strings to match.
    expect(rule.watchPhrases.filter((phrase) => phrase.kind === 'literal')).toHaveLength(6);
    expect(rule.watchPhrases.filter((phrase) => phrase.kind === 'template')).toHaveLength(2);

    expect(rule.examples).toEqual([
      {
        before: '本次办公室搬迁标志着公司发展迈入全新阶段，为未来高质量发展奠定了坚实基础。',
        after: '公司搬了办公室。原文没有说明搬迁时间、原因或实际影响。',
      },
    ]);

    expect(rule.rewriteGuidance).toBe('把普通事实强行放进宏大叙事。');
    expect(rule.detection).toBe('Lexical. 6 literal watched phrase(s), 2 construction template(s).');
    expect(rule.locator).toBe('SKILL.md:48');
    expect(rule.quote).toBe('把普通事实强行放进宏大叙事。');
    expect(rule.signature).toBe('structural.inflated_significance');
    expect(rule.category).toBe('structural');
    expect(rule.weakAlone).toBe(false);
  });

  it('keeps the Chinese titles of every pattern verbatim and in order', () => {
    expect(result.rules.map((rule) => rule.title)).toEqual([
      '空泛拔高意义',
      '用名气和媒体名单代替信息',
      '句尾堆叠“从而/进而/助力”伪分析',
      '宣传稿和广告腔',
      '模糊归因和“据悉”',
      '“挑战与展望”模板',
      '抽象动词吞掉具体动作',
      '回避简单判断句',
      '“不仅……更……”和先否后肯滥用',
      '强凑三点和排比',
      '同义词轮换',
      '虚假的“从……到……”范围',
      '无主句和责任主体消失',
      '破折号、括号和补充说明过密',
      '加粗和重点标记过多',
      '“小标题：解释”式清单泛滥',
      '标题对仗和口号化',
      '表情符号装饰结构',
      '全角半角与引号混用',
      '聊天机器人残留',
      '知识边界免责声明与猜测补洞',
      '讨好和附和',
      '冗余套话',
      '过度限定',
      '万能正能量结尾',
      '四字词和成语连用',
      '权威口吻和“本质论”',
      '预告式开场和导航话术',
      '标题后重复标题',
      '以“修改过程”为中心写正文',
      '人造金句和短句连击',
      '空洞比喻和格言公式',
      '假装坦诚的反问开头',
    ]);
  });

  it('pairs 改前 with 改后 for every pattern that has one, and never leaks the trailing caveat', () => {
    for (const rule of result.rules) {
      for (const example of rule.examples) {
        expect(example.before.length, `rule ${rule.upstreamRuleId} before`).toBeGreaterThan(0);
        expect(example.after.length, `rule ${rule.upstreamRuleId} after`).toBeGreaterThan(0);
        // Pattern 14's scope caveat used to land inside its 改后 text.
        expect(example.after, `rule ${rule.upstreamRuleId} after`).not.toContain('不要一律删除破折号');
      }
    }

    expect(ruleAt(14).examples[0]?.after).toBe('这个功能减少了反复刷新，但没有完全解决问题。');
    expect(ruleAt(14).rewriteGuidance).toBe(
      '中文本可自然成句，却频繁用破折号制造戏剧停顿，或用括号塞入关键信息。',
    );

    // Patterns 16 and 29 quote their examples, and both sides must survive.
    expect(ruleAt(16).examples[0]).toEqual({
      before: '- 用户体验：用户体验得到显著提升。 - 性能表现：系统性能得到全面优化。 - 安全保障：安全保障进一步加强。',
      after: '新版本改善了使用体验、性能和安全性。原文没有提供具体改动或数据。',
    });
    expect(ruleAt(29).examples[0]?.before).toContain('交付风险是我们必须重视的问题。');
    expect(ruleAt(29).examples[0]?.after).toBe('## 交付风险 两家供应商都把到货时间推迟了一周。');
  });

  it('reads the 改法示例 list that pattern 23 uses instead of 问题', () => {
    const rule = ruleAt(23);

    expect(rule.watchPhrases).toEqual([]);
    expect(rule.examples).toEqual([]);
    expect(rule.rewriteGuidance).toContain('“在当前这个时间节点”改为“现在”。');
    expect(rule.rewriteGuidance).toContain('“值得注意的是，数据显示”改为“数据显示”。');
    expect(rule.detection).toBe(
      'No watched list upstream. The 改法示例 substitutions define the rewrite.',
    );
  });

  it('captures the scope caveat that patterns 14, 18, 19 and 24 put after the examples', () => {
    expect(ruleAt(24).rewriteGuidance).toBe(
      '不要把真实的不确定性删掉。区分证据有限的谨慎和没有内容的叠词。',
    );
    expect(ruleAt(18).examples[0]?.after).toBe('项目进展、发现和下周安排');
    expect(ruleAt(19).examples[0]?.after).toBe(
      '我们提出“用户第一”，并建立所谓的“增长闭环”。这些词没有说明实际改了什么。',
    );
    expect(ruleAt(19).notes?.some((note) => note.includes('scope caveat'))).toBe(true);
  });

  it('keeps quoted enumeration commas inside one entry', () => {
    const phrases = ruleAt(10).watchPhrases.map((phrase) => phrase.text);
    expect(phrases).toContain('“第一、第二、第三”无论内容是否适合');
    expect(phrases).toContain('“更快、更准、更智能”');
    expect(phrases).toContain('三组同构短语');
  });

  it('marks the two chat leftovers as the strongest band and the single-sighting tells lower', () => {
    expect(ruleAt(20).severity).toBe(5);
    expect(ruleAt(21).severity).toBe(5);
    for (const number of [1, 2, 3, 4, 5, 6]) {
      expect(ruleAt(number).severity, `rule ${String(number)}`).toBe(4);
    }
    // 13, 14 and 19 are the fields the suppression section names as ordinary alone.
    for (const number of [13, 14, 19]) {
      expect(ruleAt(number).severity, `rule ${String(number)}`).toBe(2);
    }
    for (const number of [7, 11, 24]) {
      expect(ruleAt(number).severity, `rule ${String(number)}`).toBe(3);
    }
  });

  it('does not import a weak-alone flag the upstream never sets', () => {
    // `humanizer-zh-cn` states its suppression policy once for the whole
    // document under 避免误伤; it has no per-pattern marker to honour.
    expect(result.rules.filter((rule) => rule.weakAlone)).toEqual([]);
  });

  it('locates every rule on its own upstream heading', () => {
    for (const rule of result.rules) {
      const match = /^SKILL\.md:(\d+)$/.exec(rule.locator);
      expect(match, rule.locator).not.toBeNull();
      const heading = skillLine(Number(match?.[1]));
      expect(heading, `rule ${rule.upstreamRuleId} locator`).toBe(
        `### ${rule.upstreamRuleId}. ${rule.title}`,
      );
    }
  });

  it('reuses a blader signature wherever the two lineages detect the same tell', () => {
    const reused = result.rules.filter((rule) => bladerSignatures.has(rule.signature));

    expect(reused).toHaveLength(REUSED_BLADER_SIGNATURE_COUNT);
    expect(REUSED_BLADER_SIGNATURE_COUNT).toBeGreaterThan(5);

    // The specified collapses: 1/6 -> inflated significance, 9 -> negation
    // contrast, 10 -> forced triad, 14 -> dash overuse, 15 -> bold decoration,
    // 20 -> chatbot residue, 21 -> knowledge-limit disclaimer, 24 -> stacked
    // qualifiers.
    const byNumber = (number: number): string => ruleAt(number).signature;
    expect(byNumber(1)).toBe('structural.inflated_significance');
    expect(byNumber(6)).toBe('structural.stock_challenges_outlook');
    expect(byNumber(9)).toBe('structural.negation_contrast');
    expect(byNumber(10)).toBe('rhythm.forced_triad');
    expect(byNumber(14)).toBe('rhythm.dash_overuse');
    expect(byNumber(15)).toBe('formatting.bold_decoration');
    expect(byNumber(20)).toBe('assistant.chatbot_residue');
    expect(byNumber(21)).toBe('assistant.knowledge_limit_disclaimer');
    expect(byNumber(24)).toBe('lexical.stacked_qualifiers');

    // And the four that stand alone, so a future edit cannot quietly fold them
    // into an English id they do not mean.
    expect(byNumber(7)).toBe('structural.abstract_verb_swallows_action');
    expect(byNumber(19)).toBe('chinese.punctuation_width');
    expect(byNumber(26)).toBe('chinese.idiom_stacking');
    expect(byNumber(30)).toBe('structural.writes_about_previous_version');
  });

  it('maps every pattern number, and only onto signatures that exist', () => {
    expect(Object.keys(HUMANIZER_ZH_CN_SIGNATURES)).toEqual(
      Array.from({ length: PATTERN_COUNT }, (_, index) => String(index + 1)),
    );
    for (const signature of Object.values(HUMANIZER_ZH_CN_SIGNATURES)) {
      expect(isKnownSignature(signature), signature).toBe(true);
    }
  });

  it('carries Chinese as the language of every rule', () => {
    for (const rule of result.rules) {
      expect(rule.languages, `rule ${rule.upstreamRuleId}`).toContain('zh');
    }
  });

  it('converts to rule candidates that keep the Chinese lineage tags', () => {
    const candidates = toRuleCandidates(result);

    expect(candidates).toHaveLength(PATTERN_COUNT);
    expect(candidates.every((candidate) => candidate.signature.length > 0)).toBe(true);
    expect(candidates[0]?.tags).toContain('zh');
    expect(candidates[0]?.upstream).toBe('holygeek00/humanizer-zh-cn');
  });
});
