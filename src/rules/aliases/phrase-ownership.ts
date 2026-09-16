/**
 * Phrase ownership: the curated decisions.
 *
 * The default rule in `src/rules/dedupe/phrases.ts` is "the narrower rule wins",
 * measured as the fewest watched phrases. It is right most of the time and
 * visibly wrong for a specific class of phrase: a rule about *document shape*
 * often has a short watch list, so it out-ranks a *word list* rule that the
 * phrase actually belongs to. 值得注意的是 landed on `structural.enumeration_padding`
 * that way, which is a rule about numbering a whole article.
 *
 * So the default decides, the table below overrules it where the default is
 * wrong, and every entry carries its reason. That is the same shape as the rest
 * of the project: a deterministic mechanism, a curated exception list, and no
 * undocumented decisions.
 */

/**
 * Rules whose phrases are recorded but never matched.
 *
 * A rule earns a place here when matching its phrases would produce findings the
 * upstream itself does not produce.
 */
export const UNMATCHED_RULES: Readonly<Record<string, string>> = {
  'lexical.provider_tic':
    'The five provider tic sets in judetelan/ai-humanizer are gated off by default upstream: ' +
    'they only activate when a specific provider is named, which this suite has no context for. ' +
    'Their contents are generic phrases that overlap heavily with the vocabulary, connective and ' +
    'chatbot-residue rules — "i hope this helps", "a testament to", "enhance", "that said" — so ' +
    'matching them would report one phrase under two rules and attribute it to a provider that ' +
    'was never identified. The phrases stay in the extracted data, because that is what the ' +
    'upstream says, and this rule does not match on them.',
};

/**
 * Curated phrase ownership, keyed by the normalised phrase.
 *
 * Normalisation lowercases, collapses whitespace and strips edge punctuation, so
 * `Great question!` and `great question` are the same key. Each entry says which
 * rule should own the phrase and, in the comment, why the default was wrong.
 */
export const PHRASE_OWNER_OVERRIDES: Readonly<Record<string, string>> = {
  // ---- Chinese connectives that are not about enumeration -------------------
  // All three are listed in ai-zixun/humanizer-zh pattern 2, 翻译腔连接词, which is
  // exactly the rule they belong to. The default sent them to
  // `structural.enumeration_padding` — a rule about numbering an entire article —
  // purely because that rule watches fewer phrases.
  '\u503c\u5f97\u6ce8\u610f\u7684\u662f': 'lexical.translationese_connective',
  '\u4ece\u67d0\u79cd\u610f\u4e49\u4e0a\u8bf4': 'lexical.translationese_connective',
  '\u4e0e\u6b64\u540c\u65f6': 'lexical.translationese_connective',

  // ---- chatbot residue ------------------------------------------------------
  // No entry is needed for `Great question!` or `Certainly!`. With
  // `lexical.provider_tic` withdrawn from matching they have a single claimant,
  // and an override that agrees with the default is an entry that does nothing —
  // which `validateOwnershipOverrides` reports as a failure. They were listed
  // here while the provider-tic rule was still competing for them.

  // ---- staged openings that a conclusion rule had taken ---------------------
  // blader pattern 4 lists "Here's the thing" among its staged openers.
  "here's the thing": 'structural.staged_runup',

  // ---- bare -ing forms belong to the vocabulary, not to the clause rule -----
  // blader pattern 12 lists emphasizing, fostering and showcase as overused
  // words. Pattern 15 is about the shallow -ing *clause* — "..., showcasing how
  // these dishes integrated" — which is a structural shape, not a word. The
  // extracted entries here are single words, so the vocabulary rule is right.
  emphasizing: 'lexical.ai_vocabulary',
  showcasing: 'lexical.ai_vocabulary',
  highlighting: 'lexical.ai_vocabulary',
  fostering: 'lexical.ai_vocabulary',
  encompassing: 'lexical.ai_vocabulary',
  underscoring: 'lexical.ai_vocabulary',

  // ---- words that a provider-tic rule had taken -----------------------------
  // blader pattern 12 lists both as overused AI words.
  'in the realm of': 'lexical.ai_vocabulary',

  // ---- connectives that were being read as staged run-ups -------------------
  // blader pattern 12 lists "additionally"; these are discourse connectives, and
  // `structural.staged_runup` is about announcing a point before making it.
  additionally: 'lexical.ai_vocabulary',
  furthermore: 'lexical.ai_vocabulary',

  // ---- attribution to nobody -----------------------------------------------
  // "it is believed that", "experts argue" and "industry reports" name no source.
  // `lexical.passive_and_subjectless` is about the actor being hidden by grammar,
  // and `lexical.borrowed_authority` is about attention listed instead of
  // information; neither is this tell.
  'it is believed that': 'lexical.vague_attribution',
  'experts argue': 'lexical.vague_attribution',
  'industry reports': 'lexical.vague_attribution',

  // ---- connectives that landed on a structural rule -------------------------
  // "on the other hand" is a discourse connective; `assistant.rlhf_artifacts` is
  // about preference-tuning tells, which this is not.
  'on the other hand': 'lexical.wordy_connectives',
  // blader pattern 4 lists "needless to say" among its staged openers — a moment
  // of candour announced before a routine claim.
  'needless to say': 'structural.staged_runup',

  // ---- sales register --------------------------------------------------------
  // 引领 is advertising register applied to something that is not an
  // advertisement. The default read it as inflated significance.
  '\u5f15\u9886': 'lexical.sales_language',
};

/** Rules that match nothing, with the reason, for a report or a CLI listing. */
export function unmatchedRuleIds(): string[] {
  return Object.keys(UNMATCHED_RULES).sort();
}

export function unmatchedReason(ruleId: string): string | undefined {
  return UNMATCHED_RULES[ruleId];
}
