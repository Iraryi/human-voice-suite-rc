/**
 * Adapter: blader/humanizer
 *
 * The common ancestor. Twenty-five numbered patterns in five sections at
 * v3.0.0. Pure Markdown, so it must be PARSED into rules, never pasted into a
 * prompt as a whole document.
 */

import type { UpstreamAdapter } from '../../types.js';

export const bladerAdapter: UpstreamAdapter = {
  id: 'blader-humanizer',
  upstream: 'blader/humanizer',
  integration: 'markdown-skill',
  status: 'planned',
  targetPhase: 2,
  capabilities: [
    {
      kind: 'rules',
      description:
        'Twenty-five numbered patterns in five sections (A staging, B rhythm, C inflation, D formatting, E leftovers), plus a "weak alone" suppression policy.',
    },
    { kind: 'benchmarks', description: 'Before/after example pairs embedded in each pattern.' },
  ],
  description:
    'The English origin of the lineage. Every pattern is a heading of the form "### N. Title", which makes ' +
    'mechanical extraction reliable. Parse plan: split on H2 section headings, then H3 pattern headings, ' +
    'then read "Watch for" / "Rule" / "Before" / "After" bold labels and the blockquote examples. ' +
    'Split watched lists on semicolons OUTSIDE parentheses and never on commas. ' +
    'The "weak alone" patterns (8, 9, 10, 11, 21) must become a suppression layer rather than ordinary ' +
    'detectors, or the suite will over-fire.',
};
