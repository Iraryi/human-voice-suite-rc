/**
 * `hardikpandya/stop-slop` rule id to canonical signature.
 *
 * The upstream has no rule ids of its own. It is 7 files of prose: a phrase list
 * (`references/phrases.md`), a structure list (`references/structures.md`), five
 * before/after pairs (`references/examples.md`) and a prompt (`SKILL.md`). The
 * ids below are therefore *derived* from the headings, with the same rule that
 * `humanize-text` uses for its derived id (`vocab-replacement` -> the constant
 * `AI_VOCAB_REPLACEMENTS`): the id is a slug of the thing the upstream named, so
 * `## Throat-Clearing Openers` becomes `phrase-throat-clearing-openers`.
 *
 * Every value is an existing id from `src/rules/canonical/signatures.ts`. No new
 * signature was added and none was invented here; nothing in this adapter falls
 * back to `unmappedSignature`.
 *
 * Why this map matters more than most
 * -----------------------------------
 * This upstream is `research-only` as a package because roughly nine tenths of it
 * reaches the suite already, absorbed verbatim by `judetelan/ai-humanizer` with
 * only a prose credit (`scripts/registry/rules.mjs:148`, `README.md:290-294`).
 * The signatures here are chosen to **collide on purpose** with the
 * `AI_HUMANIZER_SIGNATURES` values for the eleven rules that upstream marks as
 * absorbed, so dedupe collapses the pair into one rule with two sources rather
 * than charging one problem twice. See `parse.ts` for which rules are inherited
 * and which are stop-slop-only.
 *
 * Three gaps this adapter reported, since filled
 * ----------------------------------------------
 * This adapter mapped three genuinely unique tells onto the nearest existing
 * signature and reported the imprecision rather than inventing ids, which is the
 * documented procedure. The vocabulary owner then added the missing signatures,
 * so all three now point at exact fits. The history is kept because it is the
 * clearest evidence that the report-don't-invent rule works:
 *
 *   - `structure-narrator-from-a-distance`: was `lexical.vague_attribution`, now
 *     `structural.narrator_from_a_distance`. `ai-humanizer`'s own `README.md:293`
 *     claims to have absorbed this heading, but it has no rule id and no lexicon
 *     entry for it, so the heading is stop-slop-only and deserves its own id.
 *   - `structure-formulaic-constructions`: was `structural.staged_runup`, now
 *     `structural.formulaic_construction`. "By the time X, I was Y" is a reusable
 *     narrative template, not a staged run-up. The heading's second row
 *     ("X that isn't Y") is a negation contrast and stays mapped by
 *     `structure-binary-contrasts`.
 *   - `phrase-telling-instead-of-showing`: was `lexical.aphorism_dressing`, now
 *     `lexical.telling_not_showing`. Announcing a difficulty instead of
 *     demonstrating it is not the same as dressing an ordinary point as a hidden
 *     truth, and merging the two lost the distinction.
 *
 * One remaining near fit, deliberately left
 * -----------------------------------------
 *   - `phrase-meta-commentary` uses `lexical.meta_commentary`, which is exact.
 *     But the "announcement of significance" family is still split across
 *     `lexical.meta_commentary`, `lexical.telling_not_showing` and
 *     `lexical.aphorism_dressing`. Recorded so the split is a decision, not an
 *     accident.
 *
 * Two ids appear twice, deliberately
 * ----------------------------------
 * The upstream splits its adverb content across two files — `phrases.md:53-73`
 * ("Kill all adverbs") and `structures.md:134` ("All adverbs (-ly words ...)") —
 * so `phrase-adverbs` and `structure-word-patterns` share
 * `lexical.adverb_filler`. Same for em-dashes: `structures.md:125` states the
 * absolute ban and is one row of `structure-rhythm-patterns`
 * (`rhythm.dash_overuse`), while `SKILL.md:25,43` repeats it as a checklist item.
 * A repeated similarity is not a second discovery, and `toRuleCandidates` keys
 * on the signature, so the duplicate is visible at dedupe time instead of
 * silently double-counting. `parse.ts` marks both pairs with a cross-reference
 * note.
 */
export const STOP_SLOP_SIGNATURES: Readonly<Record<string, string>> = {
  // -- references/phrases.md, one rule per category heading (9) --------------
  'phrase-throat-clearing-openers': 'structural.staged_runup',
  'phrase-emphasis-crutches': 'structural.staged_candor',
  'phrase-business-jargon': 'lexical.business_jargon',
  'phrase-adverbs': 'lexical.adverb_filler',
  'phrase-filler-phrases': 'lexical.wordy_connectives',
  'phrase-meta-commentary': 'lexical.meta_commentary',
  'phrase-performative-emphasis': 'lexical.emphasis_crutch',
  'phrase-telling-instead-of-showing': 'lexical.telling_not_showing',
  'phrase-vague-declaratives': 'lexical.vague_declarative',

  // -- references/structures.md, one rule per heading (11) ------------------
  'structure-binary-contrasts': 'structural.negation_contrast',
  'structure-negative-listing': 'rhythm.negative_listing',
  'structure-dramatic-fragmentation': 'structural.one_line_closer',
  'structure-rhetorical-setups': 'lexical.rhetorical_setup',
  'structure-formulaic-constructions': 'structural.formulaic_construction',
  'structure-false-agency': 'lexical.false_agency',
  'structure-narrator-from-a-distance': 'structural.narrator_from_a_distance',
  'structure-passive-voice': 'lexical.passive_and_subjectless',
  'structure-sentence-starters-to-avoid': 'structural.staged_candor',
  'structure-rhythm-patterns': 'rhythm.uniform_rhythm',
  'structure-word-patterns': 'lexical.adverb_filler',
};

/**
 * The phrase category each rule id came from, kept for locators and for the
 * report a reader of the generated file gets.
 *
 * `phrases.md` splits its categories between plain bullet lists (`- "really"`)
 * and a table with a replacement column (`| Avoid | Use instead |`), so the
 * category is the only place the shape is recorded.
 */
export const STOP_SLOP_PHRASE_CATEGORIES: Readonly<Record<string, string>> = {
  'phrase-throat-clearing-openers': 'Throat-Clearing Openers',
  'phrase-emphasis-crutches': 'Emphasis Crutches',
  'phrase-business-jargon': 'Business Jargon',
  'phrase-adverbs': 'Adverbs',
  'phrase-filler-phrases': 'Filler phrases',
  'phrase-meta-commentary': 'Meta-Commentary',
  'phrase-performative-emphasis': 'Performative Emphasis',
  'phrase-telling-instead-of-showing': 'Telling Instead of Showing',
  'phrase-vague-declaratives': 'Vague Declaratives',
};
