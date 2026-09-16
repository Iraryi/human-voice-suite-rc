/**
 * Adapter: holygeek00/humanizer-zh-cn
 *
 * The best-behaved member of the Chinese lineage. It is a true fork of
 * blader/humanizer pinned at the 2.9.1 baseline (33 patterns), it keeps Siqi
 * Chen's copyright notice, and it enforces that attribution in its own
 * validator.
 *
 * Compatibility hazard: upstream `main` has since moved to v3.0.0 with 25
 * patterns, so this fork is one generation behind by construction.
 */

import type { UpstreamAdapter } from '../../types.js';

export const humanizerZhCnAdapter: UpstreamAdapter = {
  id: 'humanizer-zh-cn',
  upstream: 'holygeek00/humanizer-zh-cn',
  integration: 'markdown-skill',
  status: 'planned',
  targetPhase: 2,
  capabilities: [
    {
      kind: 'rules',
      description:
        'Thirty-three Chinese patterns, plus a false-positive suppression section and Chinese-specific rules absent upstream (mixed full-width/half-width punctuation, four-character idiom stacking).',
    },
    { kind: 'localization', description: 'An explicit upstream-to-Chinese rule mapping table.' },
    { kind: 'rules', description: 'A five-question jargon diagnostic usable as methodology.' },
  ],
  description:
    'Preferred Chinese rule source. Same lineage as blader, so its rules must be sourced to BOTH ' +
    'upstreams and collapsed by deduplication rather than counted twice. Its localization mapping table ' +
    'is the only explicit derivation record in the corpus and should be imported as provenance data.',
};
