/**
 * `holygeek00/humanizer-zh-cn` pattern number to canonical signature.
 *
 * The upstream keeps blader's 33-pattern numbering from the v2.9.1 baseline and
 * its own `LOCALIZATION.md` says the English patterns were replaced by
 * "functional equivalents" rather than translated, so a number match is not a
 * tell match. Every entry below was decided from the pattern's own 留意 list,
 * 问题 text and 改前/改后 pair, never from the position in the list.
 *
 * The rule for reusing an English id: the Chinese pattern must catch the same
 * tell, so that deduplication collapses the pair into one rule with two sources
 * instead of charging the same problem twice. 29 of the 33 do. The remaining
 * four are tells that exist only in Chinese prose and get their own ids:
 *
 * - 7  (抽象动词) and 30 (以修改过程为中心) — the canonical vocabulary carries
 *   `structural.abstract_verb_swallows_action`, `structural.enumeration_padding`,
 *   `structural.opening_body_ending_disconnect` and
 *   `structural.article_level_rewrite_template` for exactly this localisation.
 * - 19 (全角半角与引号混用) and 26 (四字词和成语连用) — `chinese.punctuation_width`
 *   and `chinese.idiom_stacking`, the two Chinese-only tells the adapter
 *   description calls out.
 *
 * `chinese.result_clause_stacking` is deliberately NOT used for pattern 3. The
 * id's own meaning is "从而/进而/助力 bolted onto a fact", which is what 3 does,
 * but pattern 3 is the localisation of blader's shallow `-ing` riders: both bolt
 * an unevidenced effect onto a statement that is already complete. Keeping
 * `lexical.ing_trailers` is what makes the lineage collapse; the Chinese-only id
 * stays free for a future pattern that really is a result-clause list.
 *
 * Version-scoped, like every other map here: the manifest pins
 * `401e372eeb1a91045d15ec21c2d13b9d0f7842ea` and this map applies to it alone.
 */
export const HUMANIZER_ZH_CN_SIGNATURES: Readonly<Record<string, string>> = {
  // 空泛拔高意义 / 用名气和媒体名单代替信息 / 句尾伪分析
  '1': 'structural.inflated_significance',
  '2': 'lexical.borrowed_authority',
  '3': 'lexical.ing_trailers',

  // 宣传稿和广告腔 / 模糊归因 / 万能结尾段落
  '4': 'lexical.sales_language',
  '5': 'lexical.vague_attribution',
  '6': 'structural.stock_challenges_outlook',

  // 抽象动词和回避判断句
  '7': 'structural.abstract_verb_swallows_action',
  '8': 'lexical.copula_avoidance',

  // 机械对照和三段式
  '9': 'structural.negation_contrast',
  '10': 'rhythm.forced_triad',

  // 指代、范围和主体
  '11': 'lexical.synonym_rotation',
  '12': 'structural.false_range',
  '13': 'lexical.passive_and_subjectless',

  // 标点、加粗、清单和标题
  '14': 'rhythm.dash_overuse',
  '15': 'formatting.bold_decoration',
  '16': 'formatting.bold_label_list',
  '17': 'formatting.decorative_headings',
  '18': 'formatting.emoji_decoration',
  '19': 'chinese.punctuation_width',

  // 聊天机器人残留和知识边界
  '20': 'assistant.chatbot_residue',
  '21': 'assistant.knowledge_limit_disclaimer',
  '22': 'assistant.sycophancy',

  // 冗余、限定和收尾
  '23': 'lexical.filler_phrase',
  '24': 'lexical.stacked_qualifiers',
  '25': 'structural.universal_positive_ending',

  // 成语、权威口吻和预告式开场
  '26': 'chinese.idiom_stacking',
  '27': 'lexical.aphorism_dressing',
  '28': 'structural.staged_runup',

  // 标题重复、写修改过程和短句连击
  '29': 'structural.heading_restated',
  '30': 'structural.writes_about_previous_version',
  '31': 'structural.one_line_closer',

  // 空洞比喻和假装坦诚
  '32': 'lexical.aphorism_dressing',
  '33': 'structural.staged_candor',
};

/**
 * The section heading that owns the numbered patterns.
 *
 * `SKILL.md` has other H2 sections (调用模式, 执行流程, 来源) whose bodies hold no
 * patterns, so the parser scopes itself to this one rather than trusting that
 * every `###` in the document is a rule.
 */
export const HUMANIZER_ZH_CN_PATTERN_SECTION = '中文 AI 写作常见模式';

/**
 * The heading the suppression policy is written under.
 *
 * The upstream does not mark individual patterns as needing corroboration the
 * way blader does with `*weak alone*`; it states the policy once, for all 33.
 * See `parse.ts` for how that is carried into `weakAlone`.
 */
export const HUMANIZER_ZH_CN_SUPPRESSION_SECTION = '避免误伤';
