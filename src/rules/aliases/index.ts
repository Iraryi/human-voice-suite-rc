/**
 * The alias layer.
 *
 * Two jobs, both about making sure a tell is counted once.
 *
 * `phrase-ownership` decides which rule owns a watched phrase when several
 * claim it. `rule-aliases` resolves the many spellings a rule can be referred
 * to by — an upstream's own identifier, a legacy name, a pattern number at a
 * pinned revision — onto one canonical id.
 */

export * from './phrase-ownership.js';
export * from './rule-aliases.js';

export const AREA = 'rules.aliases';
export const TARGET_PHASE = 3;
