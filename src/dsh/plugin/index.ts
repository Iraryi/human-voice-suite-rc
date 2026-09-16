/**
 * DeepSeek Harness plugin declaration.
 *
 * The runnable plugin is `src/dsh/plugin/server.ts`, inserted into a profile by
 * `cordis.patch.yml`. This module is the *declaration*: the id DSH sees, the
 * capabilities, the tool names and the composition rules the plugin must respect.
 * A test asserts that this list and the registrations in `server.ts` cannot drift
 * apart, so the declaration cannot claim a capability the code does not have.
 *
 * Installed into the `web` profile on this machine with:
 *
 * ```bash
 * dsh plugin --profile web add link:<path to this repository>
 * ```
 *
 * `link:` rather than `file:`, because the plugin reads its committed rule
 * extractions from the checkout — the installed plugin and the source tree are
 * the same thing, which is what makes an edit and a reload one step instead of
 * two. `docs/dsh-plugin.md` is the operator's guide.
 */

export interface DshPluginDescriptor {
  /** Plugin id as DSH will see it. */
  readonly id: string;
  readonly displayName: string;
  readonly description: string;
  readonly status: 'planned' | 'ready';
  readonly targetPhase: number;
  /** Capabilities this plugin exposes. Never upstream names. */
  readonly capabilities: readonly string[];
  /** Tool names registered by this plugin. */
  readonly tools: readonly string[];
  /** Runtime requirements, checked by the build. */
  readonly runtime: {
    readonly node: string;
    readonly dependencies: readonly string[];
  };
  /** What a caller must do to make this plugin live, stated rather than implied. */
  readonly registration: string;
}

export const DSH_PLUGIN: DshPluginDescriptor = {
  id: 'human-voice-suite',
  displayName: 'Human Voice Suite',
  description:
    'Multi-source natural-language human voice, de-AI writing, personal voice learning, chat behaviour fitting and result validation for DeepSeek Harness.',
  status: 'ready',
  targetPhase: 4,
  capabilities: ['scan', 'rewrite', 'voice', 'chat', 'validate', 'profile'],
  tools: [
    'human_voice_scan',
    'human_voice_prepare',
    'human_voice_voice',
    'human_voice_chat',
    'human_voice_validate',
    'human_voice_profile',
  ],
  runtime: {
    node: '>=22.0.0',
    dependencies: [],
  },
  registration:
    'dsh plugin --profile <profile> add link:<path to this repository>. The CLI appends ' +
    'this package to dsh.profile.bundles automatically because it declares ' +
    'dsh.bundle.patch. The tools are live from the next session boot; a session ' +
    'already running keeps the tools it started with.',
};

/**
 * Composition rules the plugin must respect.
 *
 * These are stated as data because Phase 4 wires the real plugin and the
 * quickest way to break the design is to violate one of these casually.
 */
export const DSH_PLUGIN_CONSTRAINTS: readonly string[] = [
  'Expose capabilities, never upstreams. No run_blader, no run_judetelan, no run_humanizer_zh.',
  'Never call another language model. human_voice_prepare returns a contract; the calling agent performs the rewrite.',
  'Never report a single blended "human score". Report antiAIScore, voiceScore, behaviorScore and preservationScore separately.',
  'Never modify an upstream clone. Upstreams are read-only inputs.',
  'Never let a rule from one upstream be charged more than once. Collapse to canonical rules before scoring.',
  'Never present local capability as upstream capability, or the reverse.',
];
