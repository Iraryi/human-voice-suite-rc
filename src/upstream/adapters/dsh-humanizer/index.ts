/**
 * Adapter: lynote-ai/dsh-humanizer
 *
 * The only upstream that is already a DeepSeek Harness plugin, and the source
 * of the voice-fingerprint concept the suite generalises. Licence is
 * BSD-3-Clause, which is compatible with this project but imposes a notice
 * obligation that `THIRD_PARTY_NOTICES.md` must honour.
 */

import type { UpstreamAdapter } from '../../types.js';

export const dshHumanizerAdapter: UpstreamAdapter = {
  id: 'dsh-humanizer',
  upstream: 'lynote-ai/dsh-humanizer',
  integration: 'voice-profile',
  status: 'planned',
  targetPhase: 2,
  capabilities: [
    { kind: 'voice-profiles', description: 'Writing-fingerprint extraction, storage and comparison.' },
    { kind: 'detectors', description: 'Rule-based analysis and a scoring model over the text.' },
    { kind: 'rules', description: 'Its own rule set, modelled on blader, stop-slop and humanizer-zh.' },
    { kind: 'strategies', description: 'Render/contract output shaped for a DSH agent.' },
  ],
  description:
    'TypeScript DSH plugin with a voice fingerprint, a rule registry, a renderer and a score. ' +
    'Its fingerprint is the starting point for the unified VoiceProfile, extended with the chat and ' +
    'conversation-behaviour dimensions that a writing fingerprint does not cover.',
};
