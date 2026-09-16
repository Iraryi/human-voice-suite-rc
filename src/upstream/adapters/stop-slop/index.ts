/**
 * Adapter: hardikpandya/stop-slop
 *
 * RESEARCH ONLY for now, with a small targeted extraction planned for Phase 3.
 *
 * It is a curated list of banned phrases and structures — genuinely
 * machine-extractable material. But roughly nine tenths of it already reaches
 * the suite indirectly, because judetelan/ai-humanizer absorbed it verbatim and
 * credits it, and because dsh-humanizer and op7418 also credit it. Treating
 * stop-slop as an independent discovery would double-count.
 *
 * Its absolutist rules ("kill all adverbs", "no em dashes at all") also
 * conflict with blader's deliberate "weak alone" suppression policy, so
 * importing its prose would increase false positives.
 */

import type { UpstreamAdapter } from '../../types.js';

export const stopSlopAdapter: UpstreamAdapter = {
  id: 'stop-slop',
  upstream: 'hardikpandya/stop-slop',
  integration: 'research-only',
  status: 'planned',
  targetPhase: 3,
  capabilities: [
    {
      kind: 'rules',
      description:
        'A banned-phrase list and a banned-structure list, both machine-extractable, but largely already present via ai-humanizer.',
    },
    {
      kind: 'rules',
      description:
        'A small number of genuinely unique items: formulaic constructions, narrator-from-a-distance, and a few literal phrases.',
    },
  ],
  description:
    'Research only as a package. Phase 3 should extract only the residual items that ai-humanizer did not ' +
    'absorb, and attach them to the existing ai-humanizer-derived rules with a dual source reference. ' +
    'Do not import its prose rules wholesale: they conflict with the suppression policy the rest of the ' +
    'corpus depends on.',
};
