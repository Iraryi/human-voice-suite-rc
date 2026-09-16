/**
 * Adapter: judetelan/ai-humanizer
 *
 * The richest source of genuinely executable detection logic in the corpus: a
 * rule registry, a lexical engine, a stylometry engine and a lexicon module,
 * all plain ESM JavaScript.
 *
 * Provenance note, and a hard import restriction:
 *
 * This upstream absorbed a substantial part of hardikpandya/stop-slop verbatim —
 * eleven of its forty-six rules, stop-slop's scoring rubric, its business-jargon
 * swap table and several phrase lists — and credits it in prose only. Hardik
 * Pandya's MIT notice is nowhere in the tree. It also credits an unidentifiable
 * project behind a broken URL, uses CC BY-SA material from Wikipedia without
 * share-alike attribution, and names five further repositories with no licence
 * text at all.
 *
 * Therefore ONLY the upstream's own original rules may be imported. The
 * stop-slop-derived content must be imported from stop-slop instead, which
 * holds clean MIT title, and then attributed to both. `IMPORT_EXCLUSIONS` below
 * lists exactly what is barred, so the restriction is machine-checkable rather
 * than a comment somebody might miss.
 */

import type { UpstreamAdapter } from '../../types.js';

export const aiHumanizerAdapter: UpstreamAdapter = {
  id: 'ai-humanizer',
  upstream: 'judetelan/ai-humanizer',
  integration: 'executable-detector',
  status: 'planned',
  targetPhase: 2,
  capabilities: [
    { kind: 'rules', description: 'A structured rule registry with per-rule weights and watched lists.' },
    { kind: 'detectors', description: 'Lexical engine plus a stylometry engine, runnable offline.' },
    { kind: 'detectors', description: 'Replacement lexicons and banned-word lists usable as-is.' },
  ],
  description:
    'Executable detector project and the richest source of runnable detection logic in the corpus: a ' +
    'declarative rule registry, a lexical engine, a stylometry engine and a lexicon module, all ' +
    'dependency-free ESM that runs offline. Import only its original rules. The stop-slop-derived ' +
    'content is barred by IMPORT_EXCLUSIONS and must be taken from stop-slop instead, then attributed ' +
    'to both so that deduplication collapses the pair rather than counting it twice.',
};

/**
 * Content barred from import, with the reason.
 *
 * The upstream's own MIT licence is clean; the problem is content it took from
 * elsewhere without carrying the required notices. The project brief's rule for
 * this situation is that the code may be read but must not be copied, so the
 * equivalent capability is sourced from whichever repository actually holds
 * clear title.
 */
export const IMPORT_EXCLUSIONS: readonly { readonly what: string; readonly reason: string }[] = [
  {
    what: 'The 11 rules marked "Absorbed from stop-slop" in scripts/registry/rules.mjs',
    reason:
      'Verbatim stop-slop content without Hardik Pandya\'s MIT notice. Import from hardikpandya/stop-slop, which holds clean title.',
  },
  {
    what: 'scripts/lexicons.mjs JARGON_SWAPS (the 11-row business jargon table)',
    reason: 'Reproduced row-for-row from stop-slop references/phrases.md without the required notice.',
  },
  {
    what: 'The Directness / Rhythm / Trust / Authenticity / Density scoring rubric',
    reason: 'Copied from stop-slop\'s scoring table. Re-derive rather than copy.',
  },
  {
    what: 'The VAGUE_DECLARATIVE, EMPHASIS_CRUTCH, META_COMMENTARY, RHETORICAL_SETUP, ADVERB_FILLER and LAZY_EXTREMES phrase lists',
    reason: 'Verbatim stop-slop phrase lists. Import from stop-slop.',
  },
  {
    what: 'Anything attributed to "impeccable"',
    reason: 'Cited behind a broken URL (https://github.com/) with no licence, so permission cannot be verified.',
  },
  {
    what: 'Patterns credited to Wikipedia "Signs of AI writing"',
    reason: 'That source is CC BY-SA and no share-alike attribution accompanies the reuse.',
  },
  {
    what: 'Content credited to harshaneel/humanize, unslop, brandonwise/humanizer, no-ai-slop and avoid-slop',
    reason: 'No licence text, copyright line or per-item provenance is recorded for any of them.',
  },
];
