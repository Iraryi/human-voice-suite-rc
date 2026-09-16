/**
 * The DeepSeek Harness tool surface.
 *
 * Users see CAPABILITIES, never upstreams. There is no `run_blader`, no
 * `run_judetelan`, no `run_humanizer_zh`. Which upstream contributes to a given
 * call is an internal decision and is reported only as provenance inside the
 * result.
 *
 * Every tool here is implemented in `src/dsh/tools/runtime.ts` and registered by the DSH plugin entry point in `src/dsh/plugin/server.ts`. The declarations are kept in step with the plugin by a test that compares the two lists.
 */

export type Capability = 'scan' | 'rewrite' | 'voice' | 'chat' | 'validate' | 'profile';

export const CAPABILITIES: readonly Capability[] = [
  'scan',
  'rewrite',
  'voice',
  'chat',
  'validate',
  'profile',
];

/**
 * Tools that must never exist. Kept as data so a test can assert that no
 * per-upstream tool name has crept into the surface.
 */
export const FORBIDDEN_TOOL_PATTERNS: readonly RegExp[] = [
  /^run_/,
  /^human_voice_(blader|humanizer_zh|humanizer|judetelan|stop_slop|lynote)/,
  /^(blader|judetelan|humanizer_zh|stop_slop|lynote)_/,
];

export interface ToolParameter {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean' | 'string[]' | 'object';
  readonly required: boolean;
  readonly description: string;
}

export interface DshToolDescriptor {
  readonly name: string;
  readonly capability: Capability;
  readonly summary: string;
  readonly status: 'planned' | 'ready';
  readonly targetPhase: number;
  readonly parameters: readonly ToolParameter[];
  readonly returns: string;
  /** Upstreams that feed this tool. Internal only; never exposed as a tool. */
  readonly internalSources: readonly string[];
}

export const DSH_TOOLS: readonly DshToolDescriptor[] = [
  {
    name: 'human_voice_scan',
    capability: 'scan',
    summary:
      'Scan text and report every AI tell found, as canonical rules with severities and upstream provenance. Fuses structural, lexical, rhythm, Chinese, English, assistant-behaviour and stylometry detectors. Ten detectors run against 87 canonical rules, and the tool is registered by the DSH plugin in src/dsh/plugin/server.ts.',
    status: 'ready',
    targetPhase: 4,
    parameters: [
      { name: 'text', type: 'string', required: true, description: 'The text to scan.' },
      {
        name: 'language',
        type: 'string',
        required: false,
        description: 'Force a language instead of detecting it. One of zh, en, unknown.',
      },
      {
        name: 'mode',
        type: 'string',
        required: false,
        description: 'chat, prose, formal, technical or public.',
      },
      {
        name: 'maxFindings',
        type: 'number',
        required: false,
        description: 'Upper bound on returned findings. Defaults to 500.',
      },
    ],
    returns:
      'Findings with severity, canonical rule id, contributing upstream, evidence spans, per-family and per-upstream counts, everything the suppression policy dropped and why, and the antiAIScore with its rationale.',
    internalSources: [
      'blader/humanizer',
      'judetelan/ai-humanizer',
      'ai-zixun/humanizer-zh',
      'lynote-ai/humanize-text',
      'lynote-ai/dsh-humanizer',
      'human-voice-suite/local',
    ],
  },
  {
    name: 'human_voice_prepare',
    capability: 'rewrite',
    summary:
      'Produce a HumanVoiceContract for the calling DSH agent to execute. This tool never calls another language model itself. The capability is implemented in `src/dsh/tools/runtime.ts` and registered by the DSH plugin.',
    status: 'ready',
    targetPhase: 4,
    parameters: [
      { name: 'text', type: 'string', required: true, description: 'The draft to be rewritten.' },
      { name: 'mode', type: 'string', required: false, description: 'Target mode.' },
      {
        name: 'profileId',
        type: 'string',
        required: false,
        description: 'Voice profile to aim for, e.g. user/chat.',
      },
    ],
    returns:
      'A HumanVoiceContract plus its rendered agent-facing instruction block, including rules, preserve list, prohibitions and the retry budget.',
    internalSources: ['human-voice-suite/local'],
  },
  {
    name: 'human_voice_voice',
    capability: 'voice',
    summary:
      'Inspect, import or compare voice profiles. Covers writing voice, chat voice and conversation behaviour.',
    status: 'ready',
    targetPhase: 6,
    parameters: [
      { name: 'action', type: 'string', required: true, description: 'list, get, import, compare or score.' },
      { name: 'profileId', type: 'string', required: false, description: 'Profile to act on.' },
      { name: 'text', type: 'string', required: false, description: 'Text to compare against a profile.' },
    ],
    returns: 'Profile summaries and the voiceScore with its rationale.',
    internalSources: ['lynote-ai/dsh-humanizer', 'ai-zixun/humanizer-zh', 'human-voice-suite/local'],
  },
  {
    name: 'human_voice_chat',
    capability: 'chat',
    summary:
      'Chat behaviour fitting. Reports assistant smells such as mirroring, over-agreement, auto summary and unsolicited offers, and returns the behaviour baseline a reply must satisfy.',
    status: 'ready',
    targetPhase: 5,
    parameters: [
      { name: 'reply', type: 'string', required: true, description: 'The assistant reply to assess.' },
      {
        name: 'userTurn',
        type: 'string',
        required: false,
        description: 'The preceding user message, needed to detect mirroring and over-agreement.',
      },
      {
        name: 'history',
        type: 'string[]',
        required: false,
        description: 'Recent turns, for conversation-level behaviour.',
      },
    ],
    returns: 'Assistant smell findings, the applicable behaviour baseline and the behaviorScore.',
    internalSources: ['human-voice-suite/local'],
  },
  {
    name: 'human_voice_validate',
    capability: 'validate',
    summary:
      'Compare a rewrite against its original. Reports semantic preservation, protected content survival, voice match, behaviour compliance and anti-AI improvement as four separate scores. Scores four separate dimensions; registered by the DSH plugin.',
    status: 'ready',
    targetPhase: 4,
    parameters: [
      { name: 'original', type: 'string', required: true, description: 'The source text.' },
      { name: 'rewritten', type: 'string', required: true, description: 'The rewritten text.' },
      {
        name: 'profileId',
        type: 'string',
        required: false,
        description: 'Voice profile to score against.',
      },
    ],
    returns:
      'Four separate scores with rationales, plus issues and whether the single permitted retry should be spent.',
    internalSources: ['human-voice-suite/local', 'lynote-ai/humanize-text'],
  },
  {
    name: 'human_voice_profile',
    capability: 'profile',
    summary:
      'Build a voice profile from writing samples, and manage the scoped profile set (user/chat, user/formal, user/technical, user/public).',
    status: 'ready',
    targetPhase: 6,
    parameters: [
      { name: 'action', type: 'string', required: true, description: 'build, save, load, list or delete.' },
      { name: 'scope', type: 'string', required: false, description: 'chat, formal, technical or public.' },
      { name: 'samples', type: 'string[]', required: false, description: 'Sample texts to learn from.' },
    ],
    returns: 'The resulting VoiceProfile and a summary of which dimensions were measurable.',
    internalSources: ['lynote-ai/dsh-humanizer', 'ai-zixun/humanizer-zh', 'human-voice-suite/local'],
  },
];

export function toolByName(name: string): DshToolDescriptor | undefined {
  return DSH_TOOLS.find((tool) => tool.name === name);
}

export function toolsByCapability(capability: Capability): DshToolDescriptor[] {
  return DSH_TOOLS.filter((tool) => tool.capability === capability);
}

/** Guard used by tests: no per-upstream tool may appear in the public surface. */
export function findUpstreamLeakingToolNames(
  names: readonly string[] = DSH_TOOLS.map((tool) => tool.name),
): string[] {
  return names.filter((name) => FORBIDDEN_TOOL_PATTERNS.some((pattern) => pattern.test(name)));
}


