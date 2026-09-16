/**
 * Adapter: ai-zixun/humanizer-zh
 *
 * The highest-value Chinese source for two separate reasons. It carries its own
 * eight-rule Chinese rule set — it is inspired by blader rather than translated
 * from it, so its rules are NOT redundant with the English lineage — and it
 * ships nine Chinese author voice profiles plus a corpus, which is the model
 * for the suite's unified VoiceProfile.
 */

import type { UpstreamAdapter } from '../../types.js';

export const humanizerZhAdapter: UpstreamAdapter = {
  id: 'humanizer-zh',
  upstream: 'ai-zixun/humanizer-zh',
  integration: 'markdown-skill',
  status: 'planned',
  targetPhase: 2,
  capabilities: [
    { kind: 'rules', description: 'Eight original Chinese rules plus a Chinese patterns reference.' },
    {
      kind: 'voice-profiles',
      description: 'Nine Chinese author voice profiles, plus a voice index.',
    },
    { kind: 'corpus', description: 'A Chinese corpus and a quick-pick subset for calibration.' },
  ],
  description:
    'Chinese Markdown skill with its own rule structure and a substantial voice library. The nine author ' +
    'profiles are the richest voice material in the corpus and must be parsed into structured ' +
    'VoiceProfile objects — the key question for Phase 2 is whether the nine share a common section ' +
    'schema, because that decides whether one parser suffices or nine are needed.',
};
