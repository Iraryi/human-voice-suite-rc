/**
 * Adapter: op7418/Humanizer-zh
 *
 * RESEARCH ONLY. This repository is a near-literal Chinese translation of
 * blader/humanizer v2.1.0, reproducing all 24 pattern headings, watched lists,
 * examples and the process section, while shipping only its own copyright line.
 * Siqi Chen's notice appears nowhere in the repository.
 *
 * The project brief is unambiguous about what to do here: content that cannot
 * be safely copied stays a research reference. Nothing from this upstream may
 * enter a distributed artefact. Where its content is wanted, it must be taken
 * from blader/humanizer instead, so that provenance and attribution stay clean.
 *
 * Two items are nonetheless additive and may be re-derived rather than copied:
 * a five-dimension scoring rubric and a voice/personality section.
 */

import type { UpstreamAdapter } from '../../types.js';

export const op7418Adapter: UpstreamAdapter = {
  id: 'op7418-humanizer-zh',
  upstream: 'op7418/Humanizer-zh',
  integration: 'research-only',
  status: 'planned',
  targetPhase: 3,
  capabilities: [
    {
      kind: 'rules',
      description:
        'Not importable. A translation of blader v2.1.0 whose copyright notice was not retained.',
    },
    {
      kind: 'strategies',
      description:
        'A five-dimension scoring rubric and a voice/personality section, worth re-deriving from scratch rather than copying.',
    },
  ],
  description:
    'Research only. Read it to understand how the Chinese lineage diverged at v2.1.0, and to see a ' +
    'scoring rubric the English upstream does not have. Copy nothing into a distributed artefact. ' +
    'Equivalent capability should be sourced from blader/humanizer, which holds the copyright.',
};
