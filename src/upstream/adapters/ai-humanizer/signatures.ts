/**
 * Signature map for `judetelan/ai-humanizer`.
 *
 * Licence restriction, and why it shapes this file
 * ------------------------------------------------
 * The upstream's own code is MIT, but it absorbed eleven of its rules verbatim
 * from `hardikpandya/stop-slop` without carrying Hardik Pandya's copyright
 * notice. `scripts/registry/rules.mjs:148` marks the boundary with the comment
 * `// ── Absorbed from stop-slop (editorial tells) ──`, and the eleven rule
 * objects that follow it (lines 150-203) are barred by `IMPORT_EXCLUSIONS` in
 * `./index.ts`. That content is imported from the stop-slop adapter instead,
 * which holds clean title, so the shared signatures below intentionally appear
 * in **both** maps: identical signatures are what make deduplication collapse
 * the pair into one rule rather than counting it twice.
 *
 * Consequently this map covers exactly the **35 permitted rules** — the 26
 * rules before the boundary (lines 21-145) plus the 5 stylometry rules
 * (lines 207-230) and the 5 provider-gated tic sets (lines 234-257). The
 * following 11 ids must never appear here or in any extraction output:
 *
 *   false-agency, rhetorical-setup, negative-listing, vague-declarative,
 *   meta-commentary, emphasis-crutch, dramatic-fragmentation, adverb-filler,
 *   lazy-extremes, passive-voice, wh-opener
 *
 * Two further upstream lexicon arrays are withheld for the same reason even
 * though no rule id of theirs survives: `FALSE_AGENCY_NOUNS` and
 * `FALSE_AGENCY_VERBS` (`scripts/lexicons.mjs:199-208`), which are the matched
 * fragments of the barred `false-agency` detector. `JARGON_SWAPS`
 * (`scripts/lexicons.mjs:212-224`) is barred outright — it is stop-slop's
 * business-jargon table reproduced row for row.
 *
 * Every signature below was checked against the rule's own `description`, and
 * every value is an existing id from `src/rules/canonical/signatures.ts`. Two
 * suggestions from the brief were rejected because the rule text does not
 * support them:
 *
 *   - `exclamation-spam` -> `formatting.emoji_decoration`. The shared signature
 *     is not defensible: PUNCTUATION is not EMOJI, and the canonical vocabulary
 *     has no better fit, so the pair is recorded as a known collision.
 *   - `hedging` -> `lexical.stacked_qualifiers` (rather than a hedge-only
 *     signature) is kept, because that signature's own gloss is "Qualifiers and
 *     hedges stacked until the statement says nothing".
 *
 * No new signature was invented, and no rule fell back to `unmappedSignature`.
 */

/**
 * Rule id -> canonical signature.
 *
 * Keys are the upstream's own ids, verbatim, so `upstreamRuleId` in the
 * generated data and the key here can never drift apart unnoticed.
 */
export const AI_HUMANIZER_SIGNATURES: Readonly<Record<string, string>> = {
  // ── lexical / cadence / formatting (registry lines 21-145) ───────────────
  'em-dash-overuse': 'rhythm.dash_overuse',
  'banned-vocab': 'lexical.ai_vocabulary',
  'ai-openers': 'structural.staged_runup',
  'marketing-buzzword': 'lexical.sales_language',
  'hedging': 'lexical.stacked_qualifiers',
  'aphoristic-cadence': 'structural.negation_contrast',
  'rule-of-three': 'rhythm.forced_triad',
  'numbered-section-markers': 'formatting.numbered_section_markers',
  // The adapter flagged a real gap here: the vocabulary had no signature for
  // punctuation rate, so `exclamation-spam` was sharing `emoji-decoration`.
  // `formatting.exclamation_spam` was added to the vocabulary in response, and
  // the two are now distinct.
  'exclamation-spam': 'formatting.exclamation_spam',
  'emoji-decoration': 'formatting.emoji_decoration',
  'wordy-connectives': 'lexical.wordy_connectives',
  'weasel-attribution': 'lexical.vague_attribution',
  'copula-avoidance': 'lexical.copula_avoidance',
  'chatbot-closer': 'assistant.chatbot_residue',
  'rlhf-artifacts': 'assistant.rlhf_artifacts',
  'reasoning-chain-leak': 'assistant.reasoning_chain_leak',
  'acknowledgment-loop': 'assistant.acknowledgment_loop',
  'conclusion-fluff': 'assistant.conclusion_fluff',
  'business-jargon': 'lexical.business_jargon',
  'plays-a-role': 'lexical.copula_avoidance',
  'ing-trailers': 'lexical.ing_trailers',
  'llm-artifact-leak': 'assistant.llm_artifact_leak',
  'smart-punctuation-leak': 'formatting.smart_punctuation_leak',
  'bold-label-list': 'formatting.bold_label_list',
  'excessive-structure': 'formatting.excessive_structure',

  // ── stylometry (registry lines 207-230) ─────────────────────────────────
  'uniform-rhythm': 'rhythm.uniform_rhythm',
  'low-lexical-diversity': 'lexical.low_lexical_diversity',
  'comma-splice-rhythm': 'rhythm.comma_splice_rhythm',
  'paragraph-uniformity': 'rhythm.uniform_rhythm',
  'contraction-absence': 'lexical.copula_avoidance',

  // ── provider-gated tics (registry lines 234-257) ────────────────────────
  'gpt-tics': 'lexical.provider_tic',
  'claude-tics': 'lexical.provider_tic',
  'gemini-tics': 'lexical.provider_tic',
  'grok-tics': 'lexical.provider_tic',
  'deepseek-tics': 'lexical.provider_tic',
};
