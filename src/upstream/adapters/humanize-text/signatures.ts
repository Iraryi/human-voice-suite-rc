/**
 * `lynote-ai/humanize-text` rule id to canonical signature.
 *
 * The upstream is Python, not a Markdown skill, so its rules have no numbers to
 * key on. Each id here is a slug this adapter *derives* from the source symbol
 * or statement it came from, and the derivation is stated per rule in
 * `parse.ts` and repeated in the rule's `notes` so the generated data carries
 * it. The slugs are version-scoped to the pinned commit; a restructuring
 * upstream would change them, which is exactly the signal a reviewer wants.
 *
 * Slug derivation (deterministic, not invented per rule):
 *
 * - `vocab-replacement` — the method name `_replace_ai_vocabulary` and the
 *   module constant `AI_VOCAB_REPLACEMENTS` (`postprocess.py:6`, `:47`).
 * - `rhythm-merge-short-sentences` — the method name
 *   `_disrupt_sentence_rhythm` plus the one thing it actually does: merge two
 *   consecutive short sentences (`postprocess.py:55-74`).
 * - `rhythm-alternate-lengths` — the leading instruction of
 *   `LLMRewriteProcessor.REWRITE_PROMPTS[0]`, "Rewrite the following text with
 *   dramatically varied sentence lengths" (`llm_rewriter.py:16-18`).
 * - `vocab-formal-to-everyday` — the leading instruction of `REWRITE_PROMPTS[1]`,
 *   "replace any formal or academic vocabulary with everyday equivalents"
 *   (`llm_rewriter.py:20-22`).
 *
 * Every signature below already exists in `CANONICAL_SIGNATURES`; nothing was
 * added to the vocabulary for this adapter. See the report for what was
 * deliberately *not* mapped because it has no implementation upstream.
 *
 * Scope note that matters for dedupe: this upstream's default execution path is
 * a four-stage **remote** translation chain (LLM -> LLM -> Google -> Niutrans).
 * It is intentionally absent from this map, from `parse.ts` and therefore from
 * the extracted rules. A remote chain that needs three services is a strategy
 * decision, not a tell.
 */
export const HUMANIZE_TEXT_SIGNATURES: Readonly<Record<string, string>> = {
  // postprocess.py: AI-ish word -> plain replacement, and the same idea again in
  // the LLM prompt: "Replace formal/AI-typical vocabulary with natural
  // alternatives" (docs/techniques.md:71). One tell, two implementations.
  'vocab-replacement': 'lexical.ai_vocabulary',
  'vocab-formal-to-everyday': 'lexical.ai_vocabulary',

  // postprocess.py:55-74. The rule is rhythm, not punctuation, so it lands on
  // uniform_rhythm. The em-dash the merge *inserts* (`postprocess.py:67`) is a
  // separate, already-catalogued tell and is recorded as a note on this rule
  // rather than charged as a rule of its own.
  'rhythm-merge-short-sentences': 'rhythm.uniform_rhythm',

  // llm_rewriter.py:16-18 and :24-26. Same category as the merge above: the
  // upstream names the problem as "uniform length" and the fix as variation.
  'rhythm-alternate-lengths': 'rhythm.uniform_rhythm',
};
