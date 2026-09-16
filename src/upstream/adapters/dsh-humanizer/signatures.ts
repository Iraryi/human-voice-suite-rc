/**
 * `lynote-ai/dsh-humanizer` rule id to canonical signature.
 *
 * The upstream states each rule's `id` explicitly (`src/core/rules.ts:19-25`),
 * so unlike `blader` this map is keyed by a name rather than by a number, and
 * the names are stable within v0.1.0. Every signature below already exists in
 * `CANONICAL_SIGNATURES`; nothing new is added here.
 *
 * The point of the map is that a rule from this upstream and a rule from the
 * markdown skills that detect the same tell must land on the same id, so dedupe
 * collapses the lineage instead of charging one problem twice. Where a mapping
 * is an approximation rather than an identity, the reason is recorded as a
 * comment here and restated in each rule's `notes` by the parser.
 *
 * Cross-references checked while choosing:
 *
 * - `blader/humanizer` §4 "Staged run-up before the point" (`SKILL.md:109`) and
 *   `ai-humanizer` `ai-openers` "Throat-clearing openers"
 *   (`scripts/registry/rules.mjs:31-34`) are the same tell as this upstream's
 *   empty openers, so all of them belong on `structural.staged_runup`.
 * - `blader/humanizer` §9 "Stacked qualifiers" (`SKILL.md:168`) is the same
 *   tell as `hedge-en` / `hedge-zh`.
 * - `ai-humanizer` `wordy-connectives` (`rules.mjs:72-75`) is the English
 *   transition tell; `lexical.translationese_connective` is the Chinese one.
 * - `ai-humanizer` `conclusion-fluff` (`rules.mjs:107-110`) is the ending tell
 *   shared by `summary-ending-en` and `summary-ending-zh`.
 * - `ai-humanizer` `rule-of-three` (`rules.mjs:52-55`) and `blader` §6 "Forced
 *   triads" (`SKILL.md:139`) are the same tell as `mechanical-parallel-zh`.
 */
export const DSH_HUMANIZER_SIGNATURES: Readonly<Record<string, string>> = {
  // ---- empty openers (upstream category `empty-opener`) ----------------
  // Both halves file a scene-setting run-up under a different id, and the
  // upstream splits them by language rather than by tell. One signature, so the
  // pair collapses into one rule carrying both languages.
  'empty-opener-en': 'structural.staged_runup',
  'empty-opener-zh': 'structural.staged_runup',

  // ---- cliches ---------------------------------------------------------
  // The English list is ordinary model vocabulary (`delve into`, `seamless`),
  // which is exactly `lexical.ai_vocabulary`. The Chinese list is 互联网黑话
  // (`赋能`, `抓手`, `闭环`), which `chinese.boilerplate_phrase` describes.
  'cliche-en': 'lexical.ai_vocabulary',
  'cliche-zh': 'chinese.boilerplate_phrase',

  // ---- hedging ---------------------------------------------------------
  // Both hedge rules are the `blader` §9 tell. The upstream counts a single
  // occurrence rather than a stack, so the match is weaker than the canonical
  // meaning implies; the parser records that, and marks both `weakAlone`.
  'hedge-en': 'lexical.stacked_qualifiers',
  'hedge-zh': 'lexical.stacked_qualifiers',

  // ---- transitions -----------------------------------------------------
  // English line-initial connectives are multi-word where one word would do.
  // The Chinese set is the translated-connective register (`^此外，`,
  // `^与此同时，`), which is the same tell as `lexical.translationese_connective`
  // rather than the English wordy-connective one.
  'transition-en': 'lexical.wordy_connectives',
  'transition-zh': 'lexical.translationese_connective',

  // ---- summary endings -------------------------------------------------
  // Both restate the piece in a closing paragraph. The Chinese rule also
  // carries slogan closes (`让我们携手`, `希望通过`), which lean towards
  // `structural.universal_positive_ending`; that is a partial second tell, not
  // a reason to split the rule. Recorded in the parser's notes.
  'summary-ending-en': 'assistant.conclusion_fluff',
  'summary-ending-zh': 'assistant.conclusion_fluff',

  // ---- mechanical parallelism -----------------------------------------
  // 整齐排比句: four patterns that fire on a three-part parallel frame
  // (`一是 … 二是 … 三是`). Same tell as `blader` §6 and `ai-humanizer`
  // `rule-of-three`.
  'mechanical-parallel-zh': 'rhythm.forced_triad',

  // ---- over-explaining -------------------------------------------------
  // The adapter flagged a real gap here: no canonical signature said
  // "tautological restatement". `lexical.filler_phrase` was the closest fit but
  // it also carries blader's filler tells, so mapping here would have merged two
  // different problems. `lexical.restatement` was added to the vocabulary in
  // response, and both language halves point at it so they still collapse.
  'over-explain-en': 'lexical.restatement',
  'over-explain-zh': 'lexical.restatement',
};
