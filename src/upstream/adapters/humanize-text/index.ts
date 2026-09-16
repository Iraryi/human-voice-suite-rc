/**
 * Adapter: lynote-ai/humanize-text
 *
 * A Python pipeline whose documented methodologies are more valuable than its
 * default execution path. Its production "standard" path is a remote
 * four-stage translation chain that needs three separate network services, so
 * it must NOT become the suite's default strategy.
 *
 * Its one always-on asset is the dependency-free statistical detector.
 */

import type { UpstreamAdapter } from '../../types.js';

export const humanizeTextAdapter: UpstreamAdapter = {
  id: 'humanize-text',
  upstream: 'lynote-ai/humanize-text',
  integration: 'methodology',
  status: 'planned',
  targetPhase: 2,
  capabilities: [
    {
      kind: 'detectors',
      description:
        'A zero-dependency statistical detector (type-token ratio, sentence-length variation, hapax ratio) that runs offline.',
    },
    {
      kind: 'strategies',
      description:
        'Methodology catalogue: translation chain, multi-turn LLM rewriting, detection-guided feedback loop, mixed engine.',
    },
    { kind: 'rules', description: 'A vocabulary replacement map and rhythm rules extracted from its docs.' },
  ],
  description:
    'Python reference project. Take the offline statistical detector as a real detector, and take the ' +
    'methodologies as strategy definitions that stay off the default path because they need API keys and ' +
    'network access. Its documented-but-unimplemented techniques must be excluded, not transcribed.',
};
