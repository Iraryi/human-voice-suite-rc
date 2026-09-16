/**
 * `ai-zixun/humanizer-zh` rule id to canonical signature.
 *
 * This upstream is **not** a translation of `blader/humanizer`. It acknowledges
 * blader as inspiration only, keeps its own 13-pattern taxonomy in
 * `references/patterns.md`, and adds eight normative "Core Rules" in `SKILL.md`.
 * The mapping below is version-scoped to the pinned commit `f75f1ac9` (v1.3.0),
 * exactly like `blader/signatures.ts`, because the numbers carry no meaning
 * outside it.
 *
 * Two namespaces live in this one map, and they never collide:
 *
 * - `'1'` .. `'13'` — the numbered patterns in `references/patterns.md`.
 * - `'core-1'` .. `'core-8'` — the numbered `### N.` rules under the
 *   `## Core Rules` heading in `SKILL.md`. The `core-` prefix is load-bearing:
 *   without it, Core Rules 1 to 8 would collide with patterns 1 to 8.
 *
 * Where a pattern detects a tell the English lineage already names, it reuses
 * the English signature so the two collapse at dedupe time. Where the tell is
 * genuinely Chinese, it takes a `chinese.*` id. The per-rule reasoning is in
 * `parse.ts` and beside each entry below; the short version is:
 *
 * - 1, 3, 4, 5, 8, 9, 12 and 13 detect tells the English lineage already names —
 *   blader 1, 13, 2, 19, 9, 25, 13's stock section and 3 — so they reuse the
 *   English id and collapse at dedupe time.
 * - 2, 6, 7, 10 and 11 are Chinese-only: translationese connectives, quote and
 *   dash width, officialese, article-level rewrite templates and numbered
 *   enumeration. Four of the five land on a `chinese.*` id and the other two on
 *   the `zh`-only `structural.*` ids.
 *
 * Rules deliberately left unmapped are listed in `UNMAPPED_HUMANIZER_ZH_RULES`
 * below and reported rather than guessed at.
 */

/**
 * `references/patterns.md` pattern number -> canonical signature.
 *
 * All 13 are mapped, so no pattern falls back to an `upstream.*` id.
 */
export const HUMANIZER_ZH_PATTERN_SIGNATURES: Readonly<Record<string, string>> = {
  // 1 reuses the English id: 机械对照句 is the `不是……而是……` frame, i.e. the
  // same tell as blader 1 "Not X but Y". Blader's own text says the formula
  // appears in every language, so the frame is one tell, not two.
  '1': 'structural.negation_contrast',
  // 2 is the Chinese translationese connective, not the English multi-word
  // connective of blader 21, so it takes the `zh` signature instead.
  '2': 'lexical.translationese_connective',
  '3': 'structural.inflated_significance',
  // 4 is the slogan close, the same shape as blader 2 "one-line closers".
  '4': 'structural.one_line_closer',
  // 5 is the Chinese habit of `粗体小标题 + 冒号 + 解释` bullets, which is
  // exactly blader 19's labeled list.
  '5': 'formatting.bold_label_list',
  '6': 'chinese.punctuation_width',
  '7': 'chinese.officialese',
  // 8 is blader 9 "stacked qualifiers" seen from both ends: the hedge and the
  // overclaim are the same failure to state scope.
  '8': 'lexical.stacked_qualifiers',
  // 9, 10 and 11 are Chinese-only: the vocabulary's `opening_body_ending_disconnect`,
  // `article_level_rewrite_template` and `enumeration_padding` are all `zh`.
  '9': 'structural.opening_body_ending_disconnect',
  '10': 'structural.article_level_rewrite_template',
  '11': 'structural.enumeration_padding',
  // 12 is a stock forward-looking close, the "Future Outlook" variant of
  // blader 13's stock section, not a one-line closer.
  '12': 'structural.stock_challenges_outlook',
  // 13 rides on blader 3's `aphorism_dressing`: 本质上 / 归根结底 / 真正重要的是
  // are the Chinese forms of "at its core / what really matters".
  '13': 'lexical.aphorism_dressing',
};

/**
 * `SKILL.md` Core Rule number -> canonical signature.
 *
 * Only the three Core Rules whose own leading claim is already named in the
 * vocabulary are mapped: 3 (打散机械结构 -> enumeration), 4 (保持中文节奏 ->
 * uniform rhythm) and 5 (管住文章级结构 -> broken opening/body/ending). The
 * other five are normative upstream rules, but they describe Chinese-only
 * shapes — sentence-splitting translationese, formulaic closers on ordinary
 * claims, quote/dash/colon and terminology conventions, and extreme-conclusion
 * policing — for which `CANONICAL_SIGNATURES` has no id. They are left to
 * `unmappedSignature()` and reported; inventing an id here would defeat the
 * controlled vocabulary.
 *
 * Core Rules are compound by nature (each has two to six bullets), so a mapping
 * names the rule's leading claim, not every bullet. Core 4's secondary bullets
 * (missing subjects, empty value judgements at paragraph ends) belong to
 * `lexical.passive_and_subjectless` and `structural.one_line_closer`; the map
 * records the rule once, under its headline, so it is not counted twice.
 */
export const HUMANIZER_ZH_CORE_SIGNATURES: Readonly<Record<string, string>> = {
  'core-3': 'structural.enumeration_padding',
  'core-4': 'rhythm.uniform_rhythm',
  'core-5': 'structural.opening_body_ending_disconnect',
  // The three Core Rules that carry content no pattern states. This adapter
  // reported them as gaps and mapped them nowhere; the vocabulary owner then
  // added the three signatures, so each now has an exact fit.
  'core-6': 'chinese.punctuation_convention',
  'core-7': 'chinese.terminology_consistency',
  'core-8': 'structural.extreme_conclusion',
};

/**
 * Every mapping this adapter uses, both namespaces in one lookup.
 *
 * Kept as the single exported `Record` the adapter contract asks for, so a
 * reader can see the whole version-scoped map in one place.
 */
export const HUMANIZER_ZH_SIGNATURES: Readonly<Record<string, string>> = {
  ...HUMANIZER_ZH_PATTERN_SIGNATURES,
  ...HUMANIZER_ZH_CORE_SIGNATURES,
};

/**
 * Core Rules that exist upstream but have **no** canonical signature.
 *
 * Recorded here rather than silently dropped, so the gap is visible in code
 * review instead of only in a warning string. Each entry says what the rule
 * detects and why nothing in the vocabulary fits. The three mapped Core Rules
 * (3, 4, 5) are absent by design: their **leading** claim is named in the
 * vocabulary, but each also carries bullets that are not — 3's "turn a list
 * into prose", 4's "give the sentence a subject", 5's "reorder paragraphs".
 * Those secondary bullets are recorded in the map's own comment; the map
 * records a rule once, under its headline, so it is not counted twice.
 */
export const UNMAPPED_HUMANIZER_ZH_RULES: Readonly<Record<string, string>> = {
  'core-6':
    '标点与排版：引号样式、长破折号、冒号密度、英文术语分词与品牌大小写。' +
    '已由词汇表新增的 `chinese.punctuation_convention` 覆盖。',
  'core-7':
    '术语与日期统一：token/API 保持英文、PR 写作「代码审查」、日期写法。' +
    '已由词汇表新增的 `chinese.terminology_consistency` 覆盖。',
  'core-8':
    '控制判断强度：不下极端结论、不做无依据推断、先给机制再给判断。' +
    '已由词汇表新增的 `structural.extreme_conclusion` 覆盖。',
};

/**
 * Core Rules deliberately not imported, because importing them would make the
 * suite worse.
 *
 * Core Rule 1 and Core Rule 2 restate patterns extracted from the same upstream:
 * Core 1's 「对于……来说」 is pattern 2's watched phrase and its 不是……而是…… is
 * pattern 1's; Core 2's 赋能/颠覆 is pattern 3's vocabulary and 「这标志着……」 is
 * pattern 12's auto-closer. As separate rules they would carry different
 * signatures, so deduplication could not collapse them and one tell would be
 * charged twice.
 *
 * `parse.ts` excludes them and records the genuinely new content they carry as a
 * disclosure, so nothing is lost and nothing is double-counted.
 */
export const RESTATED_HUMANIZER_ZH_CORE_RULES: readonly string[] = ['core-1', 'core-2'];

/** Lookup for one rule id, or `undefined` when the rule is deliberately unmapped. */
export function humanizerZhSignature(upstreamRuleId: string): string | undefined {
  return HUMANIZER_ZH_SIGNATURES[upstreamRuleId];
}
