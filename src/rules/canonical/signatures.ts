/**
 * The canonical signature vocabulary.
 *
 * This is the controlled vocabulary that makes cross-upstream deduplication
 * work. Every adapter maps its upstream's own rule identifiers onto ids from
 * this list. Two upstreams that detect the same tell must choose the **same**
 * signature here, which is what collapses a lineage into one rule with several
 * sources instead of several rules that deduct several times.
 *
 * Why not pattern numbers: "avoid dashes" is pattern 8 in `blader` v3.0.0,
 * 13 in `op7418`, 14 in `humanizer-zh-cn` and 6 in `ai-zixun`. Numbers are not
 * comparable across the corpus. See `UPSTREAM_INVENTORY.md` §2.
 *
 * Why a controlled list rather than free naming: three adapters written
 * independently will otherwise invent `structural.inflated_significance`,
 * `lexical.inflated_claims` and `structural.significance_inflation` for one
 * tell, and deduplication silently fails. Adding a signature here is cheap;
 * discovering the failure later is not.
 */

import { isValidId } from '../../shared/types.js';

export type RuleCategory =
  | 'structural'
  | 'lexical'
  | 'rhythm'
  | 'formatting'
  | 'assistant'
  | 'chat'
  | 'chinese'
  | 'stylometry';

export interface SignatureSpec {
  readonly id: string;
  readonly category: RuleCategory;
  readonly languages: readonly string[];
  /** What the tell is, in one line. */
  readonly means: string;
  /**
   * Set when the lineage's own suppression policy is authoritative for this
   * tell, overriding the per-upstream weak-alone vote.
   *
   * `blader/humanizer` marks five of its patterns `*weak alone*` and explains
   * why in each case. The other upstreams state the same tells without the
   * caveat, so a vote would outvote the one source that thought about false
   * positives. Dash overuse is the clearest example: blader says "one dash is
   * weak alone; a text full of them is not", which is exactly the nuance a plain
   * majority loses.
   */
  readonly weakAlone?: boolean;
}

const EN = ['en'] as const;
const ZH = ['zh'] as const;
const BOTH = ['en', 'zh'] as const;

function sig(
  id: string,
  category: RuleCategory,
  languages: readonly string[],
  means: string,
): SignatureSpec {
  return { id, category, languages, means };
}

/**
 * A signature the lineage's own policy marks weak alone.
 *
 * The four below are `blader/humanizer` patterns 9, 10, 11 and 21 — four of the
 * five its own text marks `*weak alone*`. Nothing is added to this set on
 * intuition.
 *
 * The fifth, pattern 8 (dashes), is deliberately **not** here, and the reason is
 * the upstream's own wording. Its note reads: *"Many editors and journalists use
 * dashes, so one dash is weak alone; a text full of them is not."* That is a
 * condition, not a caveat, and the detector implements it — `MIN_DASHES = 3`
 * plus a per-1000 rate. Marking the rule weak alone on top demanded
 * corroboration for a finding that had already established the thing the
 * upstream says removes the weakness. Phase 8 measured the cost: two
 * model-generated samples with four dashes in a short reply were discarded for
 * want of corroboration, and no human-written sample was ever affected. See
 * `docs/phase-8-rule-changes.md` change 7.
 */
function weakSig(
  id: string,
  category: RuleCategory,
  languages: readonly string[],
  means: string,
): SignatureSpec {
  return { id, category, languages, means, weakAlone: true };
}

/**
 * The vocabulary.
 *
 * Grouped by category. A signature is only added when a real rule in the corpus
 * needs it — this is not a wish list.
 */
export const CANONICAL_SIGNATURES: readonly SignatureSpec[] = [
  // ---------------------------------------------------------------- structural
  sig('structural.negation_contrast', 'structural', BOTH,
    'The "not X but Y" frame used as a default, rather than for a real contrast.'),
  sig('structural.one_line_closer', 'structural', BOTH,
    'A short dramatic sentence used as a paragraph or section closer.'),
  sig('structural.staged_runup', 'structural', BOTH,
    'Announcing the point, or staging a moment of candor, instead of making the point.'),
  sig('structural.staged_candor', 'structural', BOTH,
    'A standalone "honestly", "look" or "the thing is" before a routine claim.'),
  sig('structural.arguing_with_no_one', 'structural', BOTH,
    'Rebutting an objection, or rejecting an option, that appears nowhere in the text.'),
  sig('structural.inflated_significance', 'structural', BOTH,
    'An ordinary fact dressed as pivotal, legacy-making or trend-defining.'),
  sig('structural.stock_challenges_outlook', 'structural', BOTH,
    'The boilerplate "challenges and outlook" section, or a generic future-looking close.'),
  sig('structural.universal_positive_ending', 'structural', BOTH,
    'An uplifting send-off paragraph that carries no information.'),
  sig('structural.heading_restated', 'structural', BOTH,
    'A heading followed by a one-line paragraph that restates it.'),
  sig('structural.writes_about_previous_version', 'structural', EN,
    'Documentation that describes what the text replaced rather than current behaviour.'),
  sig('structural.abstract_verb_swallows_action', 'structural', ZH,
    'An abstract verb that hides the concrete action being described.'),
  sig('structural.false_range', 'structural', BOTH,
    'A "from X to Y" span that sounds comprehensive but binds nothing.'),
  sig('structural.formulaic_construction', 'structural', EN,
    'A sentence built from a reusable template rather than from the content: "By the time X, I was Y", "X that isn\'t Y".'),
  sig('structural.narrator_from_a_distance', 'structural', EN,
    'The narrator describing events from a detached altitude instead of taking part in them.'),
  sig('structural.enumeration_padding', 'structural', ZH,
    'Numbered enumeration used to pad out a whole piece rather than to organise it.'),
  sig('structural.opening_body_ending_disconnect', 'structural', ZH,
    'Opening, body and ending that do not connect to each other.'),
  sig('structural.article_level_rewrite_template', 'structural', ZH,
    'A rewrite carried out at the level of the article template rather than its content.'),

  // ------------------------------------------------------------------- rhythm
  sig('rhythm.forced_triad', 'rhythm', BOTH,
    'Groups of three produced by rule rather than by content, including parallel triads.'),
  sig('rhythm.repeated_openings', 'rhythm', BOTH,
    'Consecutive sentences starting with the same word or construction.'),
  // `sig`, not `weakSig`: the upstream's condition for this pattern is overuse,
  // and the detector is what establishes it. See the note on `weakSig` above.
  sig('rhythm.dash_overuse', 'rhythm', BOTH,
    'Dashes used as the universal connector: not one dash, which the upstream calls weak alone, but a text full of them, which it does not.'),
  sig('rhythm.uniform_rhythm', 'rhythm', BOTH,
    'Sentence length so uniform that the prose has no burstiness.'),
  sig('rhythm.comma_splice_rhythm', 'rhythm', EN,
    'Clauses joined by commas where a full stop belongs.'),
  sig('rhythm.negative_listing', 'rhythm', EN,
    'Listing what something is not before revealing what it is.'),

  // ------------------------------------------------------------------ lexical
  sig('lexical.ai_vocabulary', 'lexical', BOTH,
    'Words that spike in model prose. Substitution, not deletion.'),
  sig('lexical.aphorism_dressing', 'lexical', BOTH,
    'An ordinary point dressed as a hidden truth or an aphorism.'),
  weakSig('lexical.stacked_qualifiers', 'lexical', BOTH,
    'Qualifiers and hedges stacked until the statement says nothing.'),
  sig('lexical.vague_attribution', 'lexical', BOTH,
    'Attribution to an unnamed authority: "experts say", "据悉", "studies show".'),
  sig('lexical.ing_trailers', 'lexical', EN,
    'A trailing -ing clause that adds no information.'),
  sig('lexical.sales_language', 'lexical', BOTH,
    'Advertising register applied to something that is not an advertisement.'),
  sig('lexical.borrowed_authority', 'lexical', BOTH,
    'Attention, awards or media mentions listed in place of information.'),
  sig('lexical.copula_avoidance', 'lexical', BOTH,
    'Avoiding "is", "are" and "has" in favour of inflated substitutes.'),
  sig('lexical.synonym_rotation', 'lexical', BOTH,
    'The same thing called by a different name on each mention.'),
  sig('lexical.filler_phrase', 'lexical', BOTH,
    'Phrases that occupy space without carrying meaning.'),
  sig('lexical.restatement', 'lexical', BOTH,
    'Restating what was just said in different words, adding nothing. Distinct from filler, which carries no content at all.'),
  sig('lexical.telling_not_showing', 'lexical', EN,
    'Naming an emotional or evaluative state instead of showing the detail that would produce it.'),
  sig('lexical.business_jargon', 'lexical', EN,
    'Corporate vocabulary used where a plain verb would do.'),
  sig('lexical.adverb_filler', 'lexical', EN,
    'Adverbs that intensify without adding information.'),
  sig('lexical.lazy_extremes', 'lexical', EN,
    'Absolute words such as "every", "always" and "never" used loosely.'),
  sig('lexical.meta_commentary', 'lexical', EN,
    'The text commenting on its own structure or on the act of writing it.'),
  sig('lexical.emphasis_crutch', 'lexical', EN,
    'Stock devices that demand attention instead of earning it.'),
  sig('lexical.vague_declarative', 'lexical', EN,
    'A declarative sentence with no identifiable subject or claim.'),
  sig('lexical.false_agency', 'lexical', EN,
    'Inanimate abstractions performing human actions: "the decision emerges".'),
  sig('lexical.rhetorical_setup', 'lexical', EN,
    'A question posed only to be answered in the next sentence.'),
  weakSig('lexical.passive_and_subjectless', 'lexical', BOTH,
    'Passive voice, or a dropped subject, where naming the actor would be clearer. Weak alone.'),
  sig('lexical.wordy_connectives', 'lexical', EN,
    'Multi-word connectives where a short one would do.'),
  sig('lexical.low_lexical_diversity', 'lexical', EN,
    'Vocabulary so repetitive that the text reads as generated.'),
  sig('lexical.translationese_connective', 'lexical', ZH,
    'Connectives that read as translated from English.'),
  sig('lexical.provider_tic', 'lexical', EN,
    'A habit specific to one model family rather than to models in general.'),

  // --------------------------------------------------------------- formatting
  sig('formatting.bold_decoration', 'formatting', BOTH,
    'Bold applied to every item rather than to what matters.'),
  sig('formatting.bold_label_list', 'formatting', BOTH,
    'Vertical lists where every item carries a bold label and a colon.'),
  sig('formatting.decorative_headings', 'formatting', BOTH,
    'Title-case headings, emoji or arrows used as decoration.'),
  weakSig('formatting.hyphenated_pairs', 'formatting', EN,
    'Compound adjectives hyphenated everywhere by rule.'),
  weakSig('formatting.curly_quotes', 'formatting', BOTH,
    'Curly quotation marks where the target format uses straight ones. Weak alone.'),
  sig('formatting.quote_convention', 'formatting', BOTH,
    'Quotation conventions mixed, or full-width and half-width marks interleaved.'),
  sig('formatting.emoji_decoration', 'formatting', BOTH,
    'Emoji used as structure or decoration.'),
  sig('formatting.exclamation_spam', 'formatting', BOTH,
    'Exclamation marks at several times the human rate, used to manufacture enthusiasm.'),
  sig('formatting.excessive_structure', 'formatting', BOTH,
    'More headings and lists than the content can justify.'),
  sig('formatting.smart_punctuation_leak', 'formatting', BOTH,
    'Smart punctuation or zero-width characters leaking from an editor.'),
  sig('formatting.numbered_section_markers', 'formatting', BOTH,
    'Mechanical numbered markers used as a substitute for structure.'),

  // ---------------------------------------------------------------- assistant
  sig('assistant.chatbot_residue', 'assistant', BOTH,
    'Greetings, praise, offers or closings from a chat interface left in the text.'),
  sig('assistant.knowledge_limit_disclaimer', 'assistant', BOTH,
    'Statements about where the model knowledge ends, or a guess filling the gap.'),
  sig('assistant.sycophancy', 'assistant', BOTH,
    'Flattery or reflexive agreement with the reader.'),
  sig('assistant.rlhf_artifacts', 'assistant', EN,
    'Tells left by preference tuning.'),
  sig('assistant.reasoning_chain_leak', 'assistant', EN,
    'Visible reasoning or planning text that should not have reached the reader.'),
  sig('assistant.acknowledgment_loop', 'assistant', EN,
    'Restating the request before answering it.'),
  sig('assistant.conclusion_fluff', 'assistant', EN,
    'A concluding paragraph that restates the answer.'),
  sig('assistant.llm_artifact_leak', 'assistant', BOTH,
    'Tool or citation artefacts: citeturn, oaicite, tracking parameters, placeholders.'),
  sig('assistant.unsolicited_advice', 'assistant', BOTH,
    'Advice or next steps the reader did not ask for.'),

  // --------------------------------------------------------------------- chat
  // The ten assistant smells. Ids match `src/behavior/types.ts` exactly, so a
  // finding and a taxonomy entry are the same rule, not two.
  sig('chat.mirrors_user', 'chat', BOTH, 'Restates the user turn before responding.'),
  sig('chat.over_agreement', 'chat', BOTH, 'Agrees reflexively, often with an intensifier.'),
  sig('chat.unsolicited_advice', 'chat', BOTH, 'Appends advice nobody asked for.'),
  sig('chat.auto_summary', 'chat', BOTH, 'Closes by summarising.'),
  sig('chat.unsolicited_offer', 'chat', BOTH, 'Volunteers further assistance.'),
  sig('chat.over_completeness', 'chat', BOTH, 'Covers branches the user did not ask about.'),
  sig('chat.explains_obvious', 'chat', BOTH, 'Explains what the user just used correctly.'),
  sig('chat.forced_positivity', 'chat', BOTH, 'Inserts praise or uplift the situation does not call for.'),
  sig('chat.mechanical_empathy', 'chat', BOTH, 'Opens with a formulaic acknowledgement of feeling.'),
  sig('chat.unrequested_background', 'chat', BOTH, 'Supplies history or caveats nobody asked for.'),

  // ------------------------------------------------------------------ chinese
  sig('chinese.result_clause_stacking', 'chinese', ZH,
    'Stacked result clauses such as 从而/进而/助力 bolted onto a fact.'),
  sig('chinese.idiom_stacking', 'chinese', ZH,
    'Four-character idioms and set phrases used in runs.'),
  sig('chinese.officialese', 'chinese', ZH,
    'Official-document register applied where it does not belong.'),
  sig('chinese.punctuation_width', 'chinese', ZH,
    'Full-width and half-width punctuation mixed in one document.'),
  sig('chinese.boilerplate_phrase', 'chinese', ZH,
    'Chinese boilerplate that appears in generated text far more than in written text.'),
  sig('chinese.noteworthy_filler', 'chinese', ZH,
    'Filler openers that announce significance instead of stating it, led by 值得注意的是.'),
  sig('chinese.translationese', 'chinese', ZH,
    'The register of Chinese translated from English: 的的不休, 被字句 overuse, light-verb constructions, abstract-noun suffixes and pronouns where Chinese would omit them.'),

  // ---------------------------------------------------------------- stylometry
  // This project's own measurement, and the only signature here with no upstream
  // behind it. It was missing from the vocabulary until a test asserting that
  // every rule resolves caught the drift — which is the whole reason the
  // vocabulary is a closed list rather than a naming convention.
  sig('stylometry.distribution_distance', 'stylometry', BOTH,
    'The text sits further from the target voice profile than the profile\u2019s own spread allows, across sentence length and burstiness.'),
  sig('stylometry.fingerprint_sentence_length', 'stylometry', BOTH,
    'Sentence length sits outside the target profile\u2019s own spread, measured on the pooled distribution the profile was learned from.'),
  sig('stylometry.fingerprint_punctuation', 'stylometry', BOTH,
    'Punctuation habits differ from the target profile: the marks a writer reaches for, and how often, measured per 1000 characters.'),
  sig('stylometry.fingerprint_vocabulary', 'stylometry', BOTH,
    'The writer\u2019s own recurring vocabulary is absent, or terms the profile records as avoided appear.'),
  sig('chinese.punctuation_convention', 'chinese', ZH,
    'Chinese punctuation and typography conventions applied inconsistently: quote style, long dashes, colon density, spacing around English terms.'),
  sig('chinese.terminology_consistency', 'chinese', ZH,
    'Terms, abbreviations and dates written inconsistently across one document.'),
  sig('structural.extreme_conclusion', 'structural', BOTH,
    'An absolute conclusion such as "完全取代" or "彻底结束", or a guess about motive presented as a finding.'),
];

/** Fast lookup, built once. */
export const SIGNATURE_INDEX: ReadonlyMap<string, SignatureSpec> = new Map(
  CANONICAL_SIGNATURES.map((spec) => [spec.id, spec]),
);

export function isKnownSignature(id: string): boolean {
  return SIGNATURE_INDEX.has(id);
}

export function signatureSpec(id: string): SignatureSpec | undefined {
  return SIGNATURE_INDEX.get(id);
}

/**
 * Thrown when an adapter maps a rule onto a signature that is not in the
 * vocabulary. Failing loudly here is the point: a typo in a signature map
 * silently disables deduplication for that rule.
 */
export class UnknownSignatureError extends Error {
  readonly signature: string;
  readonly context: string;
  constructor(signature: string, context: string) {
    super(
      `Unknown canonical signature ${JSON.stringify(signature)} in ${context}. ` +
        'Add it to CANONICAL_SIGNATURES in src/rules/canonical/signatures.ts, or fix the mapping.',
    );
    this.name = 'UnknownSignatureError';
    this.signature = signature;
    this.context = context;
  }
}

export function assertKnownSignature(id: string, context: string): void {
  if (!isValidId(id)) {
    throw new UnknownSignatureError(id, `${context} (not dotted snake_case)`);
  }
  if (!isKnownSignature(id)) {
    throw new UnknownSignatureError(id, context);
  }
}

/** The provisional signature for a rule an adapter has not mapped yet. */
export function unmappedSignature(upstreamSlug: string, upstreamRuleId: string): string {
  const safe = `${upstreamSlug}_${upstreamRuleId}`
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
  return `upstream.${safe.length === 0 ? 'unknown' : safe}`;
}

export function signaturesByCategory(): Map<RuleCategory, SignatureSpec[]> {
  const out = new Map<RuleCategory, SignatureSpec[]>();
  for (const spec of CANONICAL_SIGNATURES) {
    const bucket = out.get(spec.category);
    if (bucket) bucket.push(spec);
    else out.set(spec.category, [spec]);
  }
  return out;
}
