/**
 * `blader/humanizer` pattern number to canonical signature.
 *
 * The upstream numbers its 25 patterns from 1. Those numbers are stable within
 * v3.0.0 but mean nothing outside it — `op7418` translates the same lineage at
 * v2.1.0 with 24 patterns and `humanizer-zh-cn` forks it at v2.9.1 with 33 — so
 * the map is version-scoped and the manifest pins the commit it applies to.
 *
 * Every signature here is chosen so that the Chinese localisations of the same
 * tell land on the identical id. That is what makes the lineage collapse at
 * dedupe time instead of charging one problem three times.
 */
export const BLADER_SIGNATURES: Readonly<Record<string, string>> = {
  // A. Staging instead of stating
  '1': 'structural.negation_contrast',
  '2': 'structural.one_line_closer',
  '3': 'lexical.aphorism_dressing',
  '4': 'structural.staged_runup',
  '5': 'structural.arguing_with_no_one',

  // B. Rhythm by rule
  '6': 'rhythm.forced_triad',
  '7': 'rhythm.repeated_openings',
  '8': 'rhythm.dash_overuse',
  '9': 'lexical.stacked_qualifiers',
  '10': 'formatting.hyphenated_pairs',
  '11': 'lexical.passive_and_subjectless',

  // C. Inflation and borrowed authority
  '12': 'lexical.ai_vocabulary',
  '13': 'structural.inflated_significance',
  '14': 'lexical.vague_attribution',
  '15': 'lexical.ing_trailers',
  '16': 'lexical.sales_language',
  '17': 'lexical.borrowed_authority',
  '18': 'lexical.copula_avoidance',

  // D. Formatting by rule
  '19': 'formatting.bold_decoration',
  '20': 'formatting.decorative_headings',
  '21': 'formatting.curly_quotes',

  // E. Leftovers from the chat and the draft
  '22': 'assistant.chatbot_residue',
  '23': 'assistant.knowledge_limit_disclaimer',
  '24': 'structural.heading_restated',
  '25': 'structural.writes_about_previous_version',
};

/** The section headings, kept for locators and for reporting. */
export const BLADER_SECTIONS: Readonly<Record<string, string>> = {
  A: 'Staging instead of stating',
  B: 'Rhythm by rule',
  C: 'Inflation and borrowed authority',
  D: 'Formatting by rule',
  E: 'Leftovers from the chat and the draft',
};
