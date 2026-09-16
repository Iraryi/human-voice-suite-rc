/**
 * The DeepSeek Harness plugin entry point.
 *
 * This is the module `cordis.patch.yml` inserts, and it is the only file in the
 * project that talks to DSH. Three things shape how it is written.
 *
 * **No imports from DSH.** `defineTool` and the Schemastery config helpers live
 * in `@deepseek-ai/dsh-*` packages that a profile resolves from the DSH
 * installation, not from this package. Declaring them as dependencies would mean
 * an install that reaches the network and a version that can drift out of step
 * with the running harness. `ToolDefinition` is therefore constructed as a plain
 * object with plain JSON Schema — which is what those helpers compile down to
 * anyway — and the context is typed by the local `DshToolContext` interface
 * below rather than by an import.
 *
 * **The toolkit is built once, lazily.** `createToolkit()` reads seven committed
 * extraction files and runs deduplication; doing that per call would make the
 * first tool call slow and every later one wasteful.
 *
 * **The tools expose capabilities, never upstreams.** There is no `run_blader`.
 * Provenance appears inside a result, which is where it belongs.
 *
 * `docs/dsh-plugin.md` is the operator's guide: what each tool does, how to
 * install it, and what it deliberately does not do.
 */

import { createToolkit } from '../tools/runtime.js';
import type { Toolkit } from '../tools/runtime.js';
import { measureSmellsDetailed, unjudgedSmells } from '../../behavior/assistant-smell/index.js';
import { isAdvicePermission } from '../../behavior/permission/index.js';
import type { AdvicePermission } from '../../behavior/permission/index.js';
import { resolveDataFile, resolveProjectRoot } from '../../upstream/manifest.js';
import { VoiceProfileStore, resolveProfileScope } from '../../voice/profile/index.js';
import type { VoiceProfile, VoiceProfileKind } from '../../voice/types.js';
import { learnFingerprint } from '../../voice/fingerprint/index.js';
import { profileFromFingerprint } from '../../voice/profile/index.js';
import { findHazards } from '../../voice/adaptation/index.js';
import path from 'node:path';
import { readFileSync } from 'node:fs';

/** Cordis plugin name. Must match the `name` in `cordis.patch.yml`. */
export const name = 'human-voice-suite';

/**
 * Services this plugin needs before `apply` runs. `tools` is the registry the
 * six capabilities register on; nothing else is required, because the suite
 * never calls another model and never touches the session log.
 */
export const inject = ['tools'];

/** One text block, the only content shape these tools produce. */
export interface DshTextBlock {
  readonly type: 'text';
  readonly text: string;
}

/**
 * A tool definition as DSH's registry accepts it.
 *
 * Structurally compatible with `ToolDefinition` from `@deepseek-ai/dsh-tools`;
 * declared here so this package needs no dependency on it.
 */
export interface DshToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  readonly output: {
    readonly schema: Record<string, unknown>;
    render(args: Record<string, unknown>, value: unknown): DshTextBlock[];
  };
  execute(
    args: Record<string, unknown>,
    exec: unknown,
  ): Promise<unknown>;
}

/** The slice of the Cordis context this plugin uses. */
export interface DshToolContext {
  tools: {
    register(definition: DshToolDefinition): () => void;
  };
}

export interface HumanVoiceSuiteConfig {
  /** Override the project root. Defaults to `HVS_PROJECT_ROOT`, then the package root. */
  readonly projectRoot?: string;
  /** Where voice profiles are stored. Defaults to `<projectRoot>/profiles`. */
  readonly profileDir?: string;
  /** Register the tools disabled, for a profile that wants the layer present but off. */
  readonly enabled?: boolean;
}

/** What every tool returns alongside its own payload, so a caller can see the cost. */
interface BaseOutput {
  readonly scores?: Record<string, number>;
  readonly unmeasured?: string[];
  readonly note: string;
}

let toolkitPromise: Promise<Toolkit> | undefined;

function toolkitFor(projectRoot: string): Promise<Toolkit> {
  toolkitPromise ??= createToolkit({ projectRoot });
  return toolkitPromise;
}

function text(value: string): DshTextBlock[] {
  return [{ type: 'text', text: value }];
}

/** JSON Schema for the four scores, shared by every tool that reports them. */
const SCORES_SCHEMA = {
  type: 'object',
  properties: {
    antiAIScore: { type: 'number' },
    voiceScore: { type: 'number' },
    behaviorScore: { type: 'number' },
    preservationScore: { type: 'number' },
  },
} as const;

const FINDINGS_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      ruleId: { type: 'string' },
      family: { type: 'string' },
      severity: { type: 'integer' },
      confidence: { type: 'number' },
      upstream: { type: 'string' },
      message: { type: 'string' },
      evidence: { type: 'array', items: { type: 'string' } },
    },
  },
} as const;

function languageArg(value: unknown): 'zh' | 'en' | 'unknown' | undefined {
  return value === 'zh' || value === 'en' || value === 'unknown' ? value : undefined;
}

function modeArg(value: unknown): 'chat' | 'prose' | 'formal' | 'technical' | 'public' | 'unknown' | undefined {
  return value === 'chat' ||
    value === 'prose' ||
    value === 'formal' ||
    value === 'technical' ||
    value === 'public' ||
    value === 'unknown'
    ? value
    : undefined;
}

function stringArg(value: unknown, field: string, required = true): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  if (required) throw new Error(`${field} is required and must be a non-empty string.`);
  return undefined;
}

/**
 * The advice permission, or nothing at all.
 *
 * An unrecognised value resolves to `undefined` rather than to a state, so a
 * malformed argument cannot become `absent` and accuse a reply of advice nobody
 * ruled out. The schema declares the three states; this is the guard behind it.
 */
function advicePermissionArg(value: unknown): AdvicePermission | undefined {
  return isAdvicePermission(value) ? value : undefined;
}

/**
 * Register the six capabilities on the DSH tool registry.
 *
 * Each tool's `execute` returns a canonical value that its `output.schema`
 * declares, and each value is derived from a real module — no tool returns a
 * placeholder.
 */
export function apply(ctx: DshToolContext, config: HumanVoiceSuiteConfig = {}): void {
  if (config.enabled === false) return;

  const projectRoot = config.projectRoot ?? resolveProjectRoot();
  const profileDir = config.profileDir ?? path.join(projectRoot, 'profiles');
  const kit = (): Promise<Toolkit> => toolkitFor(projectRoot);

  // ---- scan ---------------------------------------------------------------
  ctx.tools.register({
    name: 'human_voice_scan',
    description:
      'Scan text for AI writing tells and report them as canonical rules with severity, evidence and upstream provenance. ' +
      'Reports four scores separately and never a blended one: antiAIScore (prose tells), voiceScore (distance from a voice profile, ' +
      'only when one is supplied), behaviorScore (chat behaviour, only when a conversation is supplied) and preservationScore ' +
      '(only when comparing two texts). Scores listed in `unmeasured` were not measured and must not be quoted as results.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The text to scan.' },
        language: { type: 'string', enum: ['zh', 'en', 'unknown'], description: 'Force a language instead of detecting it.' },
        mode: {
          type: 'string',
          enum: ['chat', 'prose', 'formal', 'technical', 'public'],
          description: 'Text mode. Decides which detectors and thresholds apply.',
        },
        userTurn: {
          type: 'string',
          description:
            'The turn this text replies to. Needed for the two behaviours that are relationships between turns (mirroring and over-completeness).',
        },
        advicePermission: {
          type: 'string',
          enum: ['granted', 'absent', 'unknown'],
          description:
            'Whether the user turn invited advice: `granted` (it did), `absent` (clear evidence it did not), `unknown` (no evidence). ' +
            'Omit it unless you know: the default is `unknown`, and `chat.unsolicited_advice` then abstains and says so instead of reporting a clean result. ' +
            '`absent` requires positive evidence — a user turn that merely does not mention advice is `unknown`, not `absent`.',
        },
        maxFindings: { type: 'integer', description: 'Upper bound on returned findings. Defaults to 500.' },
      },
      required: ['text'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          scores: SCORES_SCHEMA,
          unmeasured: { type: 'array', items: { type: 'string' } },
          findings: FINDINGS_SCHEMA,
          byFamily: { type: 'object' },
          suppressedCount: { type: 'integer' },
          abstained: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ruleId: { type: 'string' },
                state: { type: 'string' },
                reason: { type: 'string' },
              },
            },
            description:
              'Behaviour rules that were evaluated and declined to decide. Not a finding, and not a pass.',
          },
          detectorsRun: { type: 'array', items: { type: 'string' } },
          note: { type: 'string' },
        },
        required: ['scores', 'unmeasured', 'findings', 'note'],
      },
      render: (_args, value) => {
        const out = value as {
          scores: Record<string, number>;
          unmeasured: string[];
          findings: Array<{ ruleId: string; family: string; severity: number; message: string }>;
        };
        const lines = [
          `antiAIScore ${out.scores['antiAIScore']?.toFixed(2)}` +
            (out.unmeasured.includes('antiAIScore') ? ' (not measured)' : '') +
            `, ${out.findings.length} finding(s)`,
        ];
        for (const finding of out.findings.slice(0, 20)) {
          lines.push(`  [${finding.family}] ${finding.ruleId} (sev ${finding.severity}) — ${finding.message}`);
        }
        if (out.findings.length > 20) lines.push(`  … ${out.findings.length - 20} more`);
        if (out.unmeasured.length > 0) lines.push(`Not measured: ${out.unmeasured.join(', ')}`);
        return text(lines.join('\n'));
      },
    },
    async execute(args) {
      const language = languageArg(args['language']);
      const mode = modeArg(args['mode']);
      const userTurn = stringArg(args['userTurn'], 'userTurn', false);
      const advicePermission = advicePermissionArg(args['advicePermission']);
      const scanned = await (
        await kit()
      ).scan({
        text: stringArg(args['text'], 'text')!,
        ...(language ? { language } : {}),
        ...(mode ? { mode } : {}),
        ...(typeof args['maxFindings'] === 'number' ? { maxFindings: args['maxFindings'] } : {}),
        ...(userTurn || advicePermission
          ? {
              conversation: {
                ...(userTurn ? { userTurn } : {}),
                ...(advicePermission ? { advicePermission } : {}),
              },
            }
          : {}),
      });

      const base = scanned.scores.antiAIScore;
      return {
        scores: {
          antiAIScore: base,
          voiceScore: scanned.scores.voiceScore,
          behaviorScore: scanned.scores.behaviorScore,
          preservationScore: scanned.scores.preservationScore,
        },
        unmeasured: [...(scanned.scores.unmeasured ?? [])],
        findings: scanned.canonicalFindings.slice(0, 200).map((finding) => ({
          ruleId: finding.canonicalRuleId ?? finding.ruleId,
          family: finding.family,
          severity: finding.severity,
          confidence: Number(finding.confidence.toFixed(3)),
          upstream: finding.upstream,
          message: finding.message,
          evidence: finding.evidence.slice(0, 3).map((span) => span.text.slice(0, 200)),
        })),
        byFamily: { ...scanned.byFamily },
        suppressedCount: scanned.suppressed.length,
        abstained: scanned.behaviorAbstained.map((entry) => ({
          ruleId: entry.ruleId,
          state: entry.state,
          reason: entry.reason,
        })),
        detectorsRun: [...scanned.detectorsRun],
        note:
          `${scanned.detectorsRun.length} detector(s) ran over ${scanned.stats.charCount} characters; ` +
          `${scanned.suppressed.length} finding(s) were dropped by the suppression policy and are not scored. ` +
          'A finding is charged to at most one score, and a finding from a rule that has not been validated charges nothing at all: ' +
          'the rationale for each score names the rules it is the sum over, so a finding list is not a score and its length is not a severity. ' +
          'The four numbers never double-count a tell. ' +
          'A rule listed in `abstained` was evaluated and declined to decide: it is neither a finding nor a pass.',
      } satisfies BaseOutput & Record<string, unknown>;
    },
  });

  // ---- prepare ------------------------------------------------------------
  ctx.tools.register({
    name: 'human_voice_prepare',
    description:
      'Produce the rewrite contract for a draft: the canonical rules to satisfy, the content that must survive verbatim, the prohibitions, ' +
      'and the single permitted retry. THIS TOOL DOES NOT REWRITE AND CALLS NO MODEL — it returns instructions for you to execute. ' +
      'Scan first if you want to see the findings; this tool returns the contract the rewrite has to satisfy.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The draft to be rewritten.' },
        mode: { type: 'string', enum: ['chat', 'prose', 'formal', 'technical', 'public'], description: 'Target mode.' },
        objective: { type: 'string', description: 'What the rewrite is for, in one line.' },
        profileId: { type: 'string', description: 'Voice profile to aim for, e.g. user/chat.' },
      },
      required: ['text'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          strategy: { type: 'string' },
          preamble: { type: 'string' },
          instructions: { type: 'string' },
          ruleCount: { type: 'integer' },
          preserveCount: { type: 'integer' },
          antiAIScore: { type: 'number' },
          note: { type: 'string' },
        },
        required: ['strategy', 'instructions', 'antiAIScore', 'note'],
      },
      render: (_args, value) =>
        text((value as { instructions: string }).instructions),
    },
    async execute(args) {
      const mode = modeArg(args['mode']);
      const objective = stringArg(args['objective'], 'objective', false);
      const profileId = stringArg(args['profileId'], 'profileId', false);
      const profile = profileId ? profileFromStore(profileDir, profileId) : undefined;

      const prepared = await (
        await kit()
      ).prepare({
        text: stringArg(args['text'], 'text')!,
        ...(mode ? { mode } : {}),
        ...(objective ? { objective } : {}),
        ...(profileId ? { profileId } : {}),
        ...(profile ? { voiceProfile: profile } : {}),
      });

      return {
        strategy: prepared.strategy.id,
        preamble: prepared.preamble,
        instructions: prepared.rendered,
        ruleCount: prepared.contract.rules.length,
        preserveCount: prepared.contract.preserve.length,
        antiAIScore: prepared.scan.scores.antiAIScore,
        note:
          'Execute this contract yourself, in one pass, then call human_voice_validate on the result. ' +
          'The contract permits one retry and no more; validate says whether it is worth spending.',
      };
    },
  });

  // ---- validate -----------------------------------------------------------
  ctx.tools.register({
    name: 'human_voice_validate',
    description:
      'Compare a rewrite against its original and report four separate scores: antiAIScore (tells still present), ' +
      'preservationScore (protected content that survived), voiceScore (distance from a profile, when one is supplied) and ' +
      'behaviorScore (chat behaviour, when the user turn is supplied). Also reports whether the single permitted retry is worth spending. ' +
      'A score in `unmeasured` was not measured — never quote it as a pass.',
    parameters: {
      type: 'object',
      properties: {
        original: { type: 'string', description: 'The source text.' },
        rewritten: { type: 'string', description: 'The rewritten text.' },
        language: { type: 'string', enum: ['zh', 'en', 'unknown'], description: 'Force a language.' },
        mode: { type: 'string', enum: ['chat', 'prose', 'formal', 'technical', 'public'], description: 'Text mode.' },
        profileId: { type: 'string', description: 'Voice profile to score against.' },
        userTurn: { type: 'string', description: 'The user turn the rewritten text replies to.' },
      },
      required: ['original', 'rewritten'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          scores: SCORES_SCHEMA,
          unmeasured: { type: 'array', items: { type: 'string' } },
          retryRecommended: { type: 'boolean' },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                kind: { type: 'string' },
                severity: { type: 'integer' },
                message: { type: 'string' },
                score: { type: 'string' },
              },
            },
          },
          summary: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['scores', 'unmeasured', 'retryRecommended', 'summary', 'note'],
      },
      render: (_args, value) => {
        const out = value as { summary: string; retryRecommended: boolean };
        return text(`${out.summary}\nRetry recommended: ${out.retryRecommended ? 'yes' : 'no'}.`);
      },
    },
    async execute(args) {
      const language = languageArg(args['language']);
      const mode = modeArg(args['mode']);
      const profileId = stringArg(args['profileId'], 'profileId', false);
      const userTurn = stringArg(args['userTurn'], 'userTurn', false);
      const profile = profileId ? profileFromStore(profileDir, profileId) : undefined;

      const validated = await (
        await kit()
      ).validate({
        original: stringArg(args['original'], 'original')!,
        rewritten: stringArg(args['rewritten'], 'rewritten')!,
        ...(language ? { language } : {}),
        ...(mode ? { mode } : {}),
        ...(profile ? { voiceProfile: profile } : {}),
        ...(userTurn ? { conversation: { userTurn } } : {}),
      });

      return {
        scores: {
          antiAIScore: validated.scores.antiAIScore,
          voiceScore: validated.scores.voiceScore,
          behaviorScore: validated.scores.behaviorScore,
          preservationScore: validated.scores.preservationScore,
        },
        unmeasured: [...(validated.scores.unmeasured ?? [])],
        retryRecommended: validated.retryRecommended,
        issues: validated.issues.slice(0, 50).map((issue) => ({
          kind: issue.kind,
          severity: issue.severity,
          message: issue.message,
          score: issue.score,
        })),
        summary: validated.summary,
        note:
          'preservationScore covers URLs, code, paths, numbers, names and quotations that must survive verbatim. ' +
          'A score below 1 there is a lost fact, not a style difference.',
      };
    },
  });

  // ---- chat ---------------------------------------------------------------
  ctx.tools.register({
    name: 'human_voice_chat',
    description:
      'Assess a chat reply for the ten assistant behaviours: mirroring, over-agreement, unsolicited advice, auto summary, ' +
      'unsolicited offers, over-completeness, explaining the obvious, forced positivity, mechanical empathy and unrequested background. ' +
      'Pass the user turn: without it, mirroring and over-completeness are relationships the engine cannot judge, and it says so ' +
      'rather than reporting a clean result.',
    parameters: {
      type: 'object',
      properties: {
        reply: { type: 'string', description: 'The assistant reply to assess.' },
        userTurn: { type: 'string', description: 'The preceding user message.' },
        advicePermission: {
          type: 'string',
          enum: ['granted', 'absent', 'unknown'],
          description:
            'Whether the user turn invited advice: `granted`, `absent`, or `unknown`. ' +
            '`chat.unsolicited_advice` is suppressed when the user asked for advice, allowed to decide when there is positive evidence they did not, ' +
            'and abstains when nobody can say. Omitting it means `unknown`, which is not the same as `absent`.',
        },
        requestKind: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Legacy. What the user actually asked for. Listing `advice` grants advice permission; not listing it grants nothing, because a list assembled ' +
            'without analysing the turn is not evidence that the user asked for nothing. Prefer `advicePermission`.',
        },
      },
      required: ['reply'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          behaviorScore: { type: 'number' },
          smells: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                severity: { type: 'integer' },
                message: { type: 'string' },
                evidence: { type: 'array', items: { type: 'string' } },
              },
            },
          },
          unjudged: { type: 'array', items: { type: 'string' } },
          abstained: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                state: { type: 'string' },
                reason: { type: 'string' },
              },
            },
          },
          suppressed: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                state: { type: 'string' },
                reason: { type: 'string' },
              },
            },
          },
          note: { type: 'string' },
        },
        required: ['behaviorScore', 'smells', 'unjudged', 'abstained', 'suppressed', 'note'],
      },
      render: (_args, value) => {
        const out = value as {
          behaviorScore: number;
          smells: Array<{ id: string; message: string }>;
          unjudged: string[];
          abstained: Array<{ id: string; state: string }>;
          suppressed: Array<{ id: string; state: string }>;
        };
        const lines = [`behaviorScore ${out.behaviorScore.toFixed(2)}`];
        for (const smell of out.smells) lines.push(`  ${smell.id} — ${smell.message}`);
        if (out.unjudged.length > 0) lines.push(`Could not judge: ${out.unjudged.join(', ')}`);
        for (const entry of out.abstained) {
          lines.push(`Abstained: ${entry.id} — advice permission ${entry.state}, so it is neither a finding nor a pass`);
        }
        for (const entry of out.suppressed) {
          lines.push(`Suppressed: ${entry.id} — advice permission ${entry.state}`);
        }
        return text(lines.join('\n'));
      },
    },
    async execute(args) {
      const reply = stringArg(args['reply'], 'reply')!;
      const userTurn = stringArg(args['userTurn'], 'userTurn', false);
      const advicePermission = advicePermissionArg(args['advicePermission']);
      const requestKind = Array.isArray(args['requestKind'])
        ? (args['requestKind'] as unknown[]).filter((value): value is string => typeof value === 'string')
        : undefined;

      const conversation = {
        ...(userTurn ? { userTurn } : {}),
        ...(advicePermission ? { advicePermission } : {}),
        ...(requestKind ? { requestKind } : {}),
      };

      const scanned = await (
        await kit()
      ).scan({
        text: reply,
        mode: 'chat',
        families: ['assistant'],
        ...(Object.keys(conversation).length > 0 ? { conversation } : {}),
      });

      // Measured separately so the unjudged list comes from the same taxonomy
      // the detector used rather than from a second copy of the rule.
      const measured = measureSmellsDetailed(reply, conversation);

      return {
        behaviorScore: scanned.scores.behaviorScore,
        smells: measured.smells.map((smell) => ({
          id: smell.id,
          severity: smell.severity,
          message: smell.message,
          evidence: smell.evidence.slice(0, 3).map((span) => span.text.slice(0, 200)),
        })),
        unjudged: [...unjudgedSmells(conversation)],
        abstained: measured.abstained.map((entry) => ({
          id: entry.id,
          state: entry.state,
          reason: entry.reason,
        })),
        suppressed: measured.suppressed.map((entry) => ({
          id: entry.id,
          state: entry.state,
          reason: entry.reason,
        })),
        note:
          'A behaviour finding is charged to behaviorScore and never to antiAIScore: a reply can be lexically clean and still ' +
          'behave like an assistant, which is the case this layer exists for. A rule listed in `abstained` was evaluated and ' +
          'declined to decide — that is not a negative result, and reading it as one would report an unmeasured rule as clean.',
      };
    },
  });

  // ---- voice --------------------------------------------------------------
  ctx.tools.register({
    name: 'human_voice_voice',
    description:
      'Work with voice profiles. `list` and `get` read the profile store; `import` lists the eight author voices shipped with the suite ' +
      '(opt-in craft profiles, not personas); `score` measures text against a profile and returns the per-dimension breakdown. ' +
      'Dimensions with nothing to compare are reported as unmeasured rather than scored perfect.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'get', 'import', 'score'], description: 'What to do.' },
        profileId: { type: 'string', description: 'Profile to act on, e.g. user/chat or author/fengtang.' },
        text: { type: 'string', description: 'Text to score against the profile. Required for `score`.' },
        mode: { type: 'string', enum: ['chat', 'prose', 'formal', 'technical', 'public'], description: 'Text mode for scoring.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          action: { type: 'string' },
          profiles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                owner: { type: 'string' },
                kind: { type: 'string' },
                languages: { type: 'array', items: { type: 'string' } },
                hasWriting: { type: 'boolean' },
                hasChat: { type: 'boolean' },
                hasBehavior: { type: 'boolean' },
                exampleCount: { type: 'integer' },
              },
            },
          },
          profile: { type: 'object' },
          voiceScore: { type: 'number' },
          dimensions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                score: { type: 'number' },
                weight: { type: 'number' },
                measured: { type: 'boolean' },
                detail: { type: 'string' },
              },
            },
          },
          note: { type: 'string' },
        },
        required: ['action', 'note'],
      },
      render: (_args, value) => {
        const out = value as {
          action: string;
          profiles?: Array<{ id: string; kind: string }>;
          voiceScore?: number;
          dimensions?: Array<{ name: string; score: number; measured: boolean }>;
        };
        if (out.profiles) {
          return text(out.profiles.map((profile) => `${profile.id} (${profile.kind})`).join('\n'));
        }
        if (out.dimensions) {
          return text(
            [
              `voiceScore ${out.voiceScore?.toFixed(2)}`,
              ...out.dimensions.map(
                (dimension) =>
                  `  ${dimension.measured ? ' ' : '-'} ${dimension.name}: ${dimension.score.toFixed(2)}`,
              ),
            ].join('\n'),
          );
        }
        return text(`${out.action} complete`);
      },
    },
    async execute(args) {
      const action = stringArg(args['action'], 'action')!;
      const store = new VoiceProfileStore(profileDir);

      if (action === 'list') {
        const profiles = store.list();
        return {
          action,
          profiles,
          note:
            profiles.length === 0
              ? `No profiles in ${profileDir}. Build one with human_voice_profile, or list the imported author voices with action: import.`
              : `${profiles.length} profile(s) in ${profileDir}.`,
        };
      }

      if (action === 'import') {
        const imported = loadImportedAuthorVoices(projectRoot);
        return {
          action,
          profiles: imported.map(summariseProfileShape),
          note:
            `${imported.length} author voice profile(s) shipped with the suite, parsed from ai-zixun/humanizer-zh under MIT. ` +
            'They carry craft instructions and no statistical features, so they never contribute to voiceScore. ' +
            'They are opt-in: the suite applies none of them unless you name one.',
        };
      }

      if (action === 'get') {
        const id = stringArg(args['profileId'], 'profileId')!;
        const profile = store.get(id) ?? loadImportedAuthorVoices(projectRoot).find((entry) => entry.id === id);
        if (!profile) throw new Error(`No profile ${id} in ${profileDir}, and it is not one of the imported author voices.`);
        return { action, profile, note: `Profile ${id}, owner ${profile.owner}.` };
      }

      if (action === 'score') {
        const id = stringArg(args['profileId'], 'profileId')!;
        const profile = store.get(id) ?? loadImportedAuthorVoices(projectRoot).find((entry) => entry.id === id);
        if (!profile) throw new Error(`No profile ${id} in ${profileDir}, and it is not one of the imported author voices.`);
        const mode = modeArg(args['mode']);
        const { compareToProfile } = await import('../../voice/scoring/index.js');
        const comparison = compareToProfile(stringArg(args['text'], 'text')!, profile, {
          ...(mode ? { mode } : {}),
        });
        return {
          action,
          voiceScore: comparison.voiceScore,
          dimensions: comparison.dimensions.map((dimension) => ({
            name: dimension.name,
            score: Number(dimension.score.toFixed(4)),
            weight: dimension.weight,
            measured: dimension.measured,
            detail: dimension.detail,
          })),
          note: comparison.unmeasured
            ? `Not measured: nothing in ${id} could be compared with this text.`
            : comparison.rationale.summary,
        };
      }

      throw new Error(`Unknown action ${JSON.stringify(action)}. Known: list, get, import, score.`);
    },
  });

  // ---- profile ------------------------------------------------------------
  ctx.tools.register({
    name: 'human_voice_profile',
    description:
      'Learn a voice profile from writing samples and manage the scoped profile set. Profiles are scoped, not global: ' +
      'user/chat and user/formal are different voices and averaging them describes nobody. ' +
      'Pass samples that are genuinely yours; the more there are, the more dimensions become measurable.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['build', 'save', 'list', 'delete'], description: 'What to do.' },
        scope: { type: 'string', enum: ['chat', 'formal', 'technical', 'public'], description: 'Which voice this is.' },
        samples: { type: 'array', items: { type: 'string' }, description: 'Sample texts to learn from. Required for `build`.' },
        language: { type: 'string', enum: ['zh', 'en'], description: 'Language of the samples.' },
        profileId: { type: 'string', description: 'Profile to act on. Defaults to user/<scope>.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          action: { type: 'string' },
          profile: { type: 'object' },
          profiles: { type: 'array', items: { type: 'object' } },
          dimensionsMeasured: { type: 'array', items: { type: 'string' } },
          dimensionsUnmeasured: { type: 'array', items: { type: 'string' } },
          note: { type: 'string' },
        },
        required: ['action', 'note'],
      },
      render: (_args, value) => {
        const out = value as {
          action: string;
          dimensionsMeasured?: string[];
          dimensionsUnmeasured?: string[];
          profile?: { id?: string };
        };
        if (out.action === 'build' || out.action === 'save') {
          return text(
            [
              `${out.action === 'save' ? 'Saved' : 'Built'} ${out.profile?.id ?? ''}`,
              `Measurable: ${(out.dimensionsMeasured ?? []).join(', ') || 'nothing'}`,
              `Not measurable: ${(out.dimensionsUnmeasured ?? []).join(', ') || 'nothing'}`,
            ].join('\n'),
          );
        }
        return text(`${out.action} complete`);
      },
    },
    async execute(args) {
      const action = stringArg(args['action'], 'action')!;
      const store = new VoiceProfileStore(profileDir);

      if (action === 'list') {
        const profiles = store.list();
        return { action, profiles, note: `${profiles.length} profile(s) in ${profileDir}.` };
      }

      if (action === 'delete') {
        const id = stringArg(args['profileId'], 'profileId')!;
        const { existsSync, unlinkSync } = await import('node:fs');
        const file = path.join(profileDir, `${id.replace(/\//g, '__')}.json`);
        if (!existsSync(file)) throw new Error(`No profile ${id} in ${profileDir}.`);
        unlinkSync(file);
        return { action, note: `Deleted ${id}.` };
      }

      if (action === 'build' || action === 'save') {
        const samples = Array.isArray(args['samples'])
          ? (args['samples'] as unknown[]).filter((value): value is string => typeof value === 'string')
          : [];
        if (samples.length === 0) throw new Error('samples is required for build: pass at least one text.');

        const scope = stringArg(args['scope'], 'scope', false) ?? 'chat';
        const language = args['language'] === 'en' ? 'en' : args['language'] === 'zh' ? 'zh' : undefined;
        const id = stringArg(args['profileId'], 'profileId', false) ?? `user/${scope}`;

        const extraction = learnFingerprint(
          samples.map((sample) => ({ text: sample, mode: scope === 'chat' ? 'chat' : 'prose' })),
          { ...(language ? { language } : {}), includeChat: scope === 'chat' },
        );
        if (!extraction) throw new Error('None of the samples contained any text to learn from.');

        const kind: VoiceProfileKind = scope === 'chat' ? 'chat' : 'writing';
        const profile = profileFromFingerprint(extraction, {
          id,
          owner: 'user',
          kind,
          sources: [
            {
              upstream: 'human-voice-suite/local',
              ruleId: id,
              locator: 'human_voice_profile',
              note: `Learned from ${samples.length} sample(s) supplied by the caller at ${new Date().toISOString()}.`,
            },
          ],
          avoidVocabulary: [],
          notes:
            'Learned from samples supplied in this session. avoidVocabulary cannot be learned from positive samples: ' +
            'a writer\'s own text does not say what they never write, so declare it by editing the stored JSON.',
        });

        const measured: string[] = [];
        const unmeasured: string[] = [];
        if (profile.writing) {
          (profile.writing.sentenceLength.sampleCount > 0 ? measured : unmeasured).push('sentenceLength');
          (Object.keys(profile.writing.punctuationRates).length > 0 ? measured : unmeasured).push('punctuation');
          (profile.writing.signatureVocabulary.length > 0 ? measured : unmeasured).push('signatureVocabulary');
          (profile.writing.paragraphLength.sampleCount > 0 ? measured : unmeasured).push('paragraphLength');
        }
        if (profile.chat) {
          (profile.chat.replyLength.sampleCount > 0 ? measured : unmeasured).push('chatReplyLength');
          measured.push('chatEmoji', 'chatBurst');
        }

        if (action === 'save') store.save(profile);
        return {
          action,
          profile: profile as unknown as Record<string, unknown>,
          dimensionsMeasured: measured,
          dimensionsUnmeasured: unmeasured,
          note:
            action === 'save'
              ? `Saved to ${profileDir}.`
              : 'Not saved. Call again with action: save to keep it, or pass profileId to overwrite an existing one.',
        };
      }

      throw new Error(`Unknown action ${JSON.stringify(action)}. Known: build, save, list, delete.`);
    },
  });

  // ---- a tool the brief forbids -------------------------------------------
  // Kept as a runtime guard rather than a comment: if a future edit registers a
  // per-upstream tool by accident, this fails the plugin load rather than
  // shipping a surface the project forbids.
  const forbidden = /^run_|^(blader|judetelan|humanizer_zh|stop_slop|lynote)_/;
  for (const toolName of ['human_voice_scan', 'human_voice_prepare', 'human_voice_validate', 'human_voice_chat', 'human_voice_voice', 'human_voice_profile']) {
    if (forbidden.test(toolName)) {
      throw new Error(`Tool ${toolName} exposes an upstream. The surface exposes capabilities only.`);
    }
  }
}

function profileFromStore(profileDir: string, id: string): VoiceProfile | undefined {
  const store = new VoiceProfileStore(profileDir);
  return store.get(id);
}

/** The shape `human_voice_voice list` reports, derived from a profile. */
function summariseProfileShape(profile: VoiceProfile): {
  id: string;
  owner: string;
  kind: string;
  languages: string[];
  hasWriting: boolean;
  hasChat: boolean;
  hasBehavior: boolean;
  exampleCount: number;
} {
  return {
    id: profile.id,
    owner: profile.owner,
    kind: profile.kind,
    languages: [...profile.languages],
    hasWriting: profile.writing !== undefined,
    hasChat: profile.chat !== undefined,
    hasBehavior: profile.behavior !== undefined,
    exampleCount: profile.examples?.length ?? 0,
  };
}

/**
 * The voice profiles a user can write in: the committed demonstration profile, plus the
 * imported author voices **if this checkout has generated them**.
 *
 * The imported profiles are not distributed with the project — they are prose about named
 * living writers, and shipping them would make this repository a distributor of eight
 * named-author imitators. `npm run voice:import` writes them into `.external-corpora/`,
 * which is gitignored, and this function picks them up from there when they exist.
 *
 * `src/voice/import/demo-voice.json` is committed instead: written for this repository,
 * imitating nobody, so that the profile, import and generation paths have something to run
 * against on a fresh checkout.
 *
 * The hazard check runs on whatever is loaded. A generated file that has drifted is exactly
 * the case it catches: `npm run voice:check` catches drift at build time, and this catches it
 * at call time, which is the only moment that matters if someone edits the JSON by hand.
 */
export function loadImportedAuthorVoices(projectRoot: string): VoiceProfile[] {
  const profiles: VoiceProfile[] = [];

  const demo = resolveDataFile(path.join('voice', 'import', 'demo-voice.json'), projectRoot);
  try {
    profiles.push(JSON.parse(readFileSync(demo, 'utf8')) as VoiceProfile);
  } catch {
    // A missing demonstration profile is a packaging defect, not a user error: it is
    // committed and `scripts/copy-runtime-data.mjs` copies it into the build.
  }

  const generated = path.join(
    projectRoot,
    '.external-corpora',
    'author-voices',
    'author-voices.generated.json',
  );
  try {
    const parsed = JSON.parse(readFileSync(generated, 'utf8')) as { profiles?: VoiceProfile[] };
    profiles.push(...(parsed.profiles ?? []));
  } catch {
    // Not generated locally. That is the default, and the tools still work.
  }

  const hazardous = profiles.flatMap((profile) =>
    findHazards(profile).map((hazard) => `${profile.id}: ${hazard.hazard}`),
  );
  if (hazardous.length > 0) {
    throw new Error(
      `The imported author voices carry ${hazardous.length} hazard(s): ${hazardous.join(', ')}. ` +
        'Run `npm run voice:import` to regenerate them from the pinned upstream.',
    );
  }
  return profiles;
}

/** Default profile directory, so the docs and the code cannot disagree. */
export function defaultProfileDir(projectRoot: string = resolveProjectRoot()): string {
  return path.join(projectRoot, 'profiles');
}

/** Where a scoped profile lives, for a caller that has a mode and a profile set. */
export function scopedProfileId(profiles: readonly VoiceProfile[], mode: string): string | undefined {
  return resolveProfileScope(profiles, { mode: mode as never }).profile?.id;
}
