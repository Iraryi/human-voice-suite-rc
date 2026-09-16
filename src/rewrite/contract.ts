/**
 * Building and rendering the Human Voice Contract.
 *
 * `human_voice_prepare` produces one of these and hands it to the DSH agent
 * that is already running. It does not call a model of its own. The contract is
 * therefore the entire interface between the suite and the rewrite: if it is
 * unclear, the rewrite is bad, so rendering is treated as a first-class
 * concern rather than a debug convenience.
 */

import type { Language, TextMode } from '../shared/types.js';
import { REWRITE_CONTRACT_SCHEMA_VERSION } from './types.js';
import type {
  ContractBuildInput,
  ContractRuleDirective,
  HumanVoiceContract,
  PreserveDirective,
  ValidationRequirement,
} from './types.js';
import type { Finding } from '../detector/types.js';
import { ASSISTANT_SMELLS } from '../behavior/types.js';

export const DEFAULT_VALIDATION: readonly ValidationRequirement[] = [
  {
    id: 'semantic.preserved',
    description:
      'Every claim in the original must still be present and still mean the same thing. No new facts.',
    score: 'preservationScore',
    minimum: 0.9,
  },
  {
    id: 'protected.intact',
    description:
      'Code, URLs, paths, identifiers, numbers, dates, quotations and proper nouns must survive unchanged.',
    score: 'preservationScore',
    minimum: 1,
  },
  {
    id: 'anti-ai.improved',
    description: 'The rewritten text must fire fewer canonical rules than the draft did.',
    score: 'antiAIScore',
    minimum: 0.7,
  },
  {
    id: 'voice.matched',
    description:
      'If a voice profile was supplied, the rewrite must move towards it rather than away.',
    score: 'voiceScore',
    minimum: 0.6,
  },
  {
    id: 'behavior.clean',
    description:
      'No assistant smell may survive: no mirroring, no auto summary, no unsolicited offer, no forced positivity.',
    score: 'behaviorScore',
    minimum: 0.8,
  },
];

/**
 * Hard prohibitions that apply to every rewrite. These come from the suite's
 * own behaviour research and from the upstreams' "do not invent detail" rule.
 */
export const UNIVERSAL_FORBIDDEN: readonly string[] = [
  'Do not add facts, examples, numbers or details that were not in the source text.',
  'Do not summarise the source text back to the reader.',
  'Do not open by restating the request or the source text.',
  'Do not close by offering further help, or by inviting follow-up questions.',
  'Do not add encouragement, praise or uplift.',
  'Do not add background, history or caveats that the source text did not carry.',
  'Do not add headings, bullet lists or bold emphasis that the source text did not have.',
  'Do not replace specific words with vaguer ones to sound more natural.',
];

export function buildContract(input: ContractBuildInput): HumanVoiceContract {
  return {
    schemaVersion: REWRITE_CONTRACT_SCHEMA_VERSION,
    contractId: makeContractId(input),
    createdAt: new Date().toISOString(),
    language: input.language,
    mode: input.mode,
    strategyId: input.strategyId,
    objective: input.objective,
    ...(input.voiceProfileId ? { voiceProfileId: input.voiceProfileId } : {}),
    ...(input.behaviorBaselineId ? { behaviorBaselineId: input.behaviorBaselineId } : {}),
    rules: input.rules ?? [],
    preserve: input.preserve ?? [],
    forbidden: [...UNIVERSAL_FORBIDDEN, ...(input.forbidden ?? [])],
    required: input.required ?? [],
    budget: {
      // Section 18 permits at most one retry. This is a hard ceiling.
      maxRewritePasses: 2,
      maxValidationRetries: 1,
    },
    validation: input.validation ?? DEFAULT_VALIDATION,
  };
}

/** Turn scan findings into contract directives, one per canonical rule. */
export function directivesFromFindings(
  findings: readonly Finding[],
  guidanceFor: (ruleId: string) => string | undefined,
): ContractRuleDirective[] {
  return findings.map((finding) => {
    const ruleId = finding.canonicalRuleId ?? finding.ruleId;
    return {
      ruleId,
      category: finding.category,
      severity: finding.severity,
      guidance:
        guidanceFor(ruleId) ??
        `Rewrite the passage so this tell is absent, without losing any information: ${finding.message}`,
      triggeredBy: [
        {
          detectorId: finding.detectorId,
          upstream: finding.upstream,
          ...(finding.canonicalRuleId ? { canonicalRuleId: finding.canonicalRuleId } : {}),
          message: finding.message,
          severity: finding.severity,
        },
      ],
    };
  });
}

/**
 * Behaviour directives for chat mode, derived from the assistant smell
 * taxonomy. Only smells that are actually applicable to the mode are emitted.
 */
export function behaviorDirectives(mode: TextMode): string[] {
  if (mode !== 'chat') return [];
  return ASSISTANT_SMELLS.filter((smell) => smell.severity >= 3).map(
    (smell) => `${smell.labelZh} / ${smell.label}: ${smell.rewriteGuidance}`,
  );
}

export interface ContractWithPreservation {
  readonly contract: HumanVoiceContract;
  readonly preserve: readonly PreserveDirective[];
}

/**
 * Render the contract as the instruction block handed to the executing agent.
 *
 * Plain language, imperative, ordered by what matters. No JSON dump: an agent
 * reads prose better than it reads a serialised object, and the contract is
 * meant to be obeyed rather than parsed.
 */
export function renderContractForAgent(contract: HumanVoiceContract): string {
  const lines: string[] = [];

  lines.push('# Human voice contract');
  lines.push('');
  lines.push(`Contract: \`${contract.contractId}\` (schema ${contract.schemaVersion})`);
  lines.push(`Language: ${contract.language} | Mode: ${contract.mode} | Strategy: ${contract.strategyId}`);
  if (contract.voiceProfileId) lines.push(`Voice profile: ${contract.voiceProfileId}`);
  if (contract.behaviorBaselineId) lines.push(`Behaviour baseline: ${contract.behaviorBaselineId}`);
  lines.push('');
  lines.push('## Objective');
  lines.push('');
  lines.push(contract.objective);
  lines.push('');

  if (contract.rules.length > 0) {
    lines.push('## Fix these, in this order');
    lines.push('');
    lines.push('Highest severity first. Fixing a high-severity rule matters more than polishing a low one.');
    lines.push('');
    const ordered = [...contract.rules].sort((a, b) => b.severity - a.severity);
    ordered.forEach((rule, index) => {
      lines.push(`${index + 1}. **${rule.ruleId}** (severity ${rule.severity}) — ${rule.guidance}`);
      for (const trigger of rule.triggeredBy) {
        lines.push(`   - detected by \`${trigger.detectorId}\` from \`${trigger.upstream}\`: ${trigger.message}`);
      }
    });
    lines.push('');
  }

  if (contract.required.length > 0) {
    lines.push('## Do this');
    lines.push('');
    for (const item of contract.required) lines.push(`- ${item}`);
    lines.push('');
  }

  lines.push('## Never do this');
  lines.push('');
  for (const item of contract.forbidden) lines.push(`- ${item}`);
  lines.push('');

  if (contract.preserve.length > 0) {
    lines.push('## Preserve exactly');
    lines.push('');
    lines.push('These must appear in the output unchanged, character for character:');
    lines.push('');
    for (const item of contract.preserve) {
      const marker = item.exact ? 'exact' : 'meaning';
      lines.push(`- \`${item.value}\` (${item.kind}, ${marker})`);
    }
    lines.push('');
  }

  lines.push('## Budget');
  lines.push('');
  lines.push(
    `At most ${contract.budget.maxRewritePasses} rewrite passes and ${contract.budget.maxValidationRetries} validation retry. ` +
      'If validation still fails after that, return the best attempt and say what failed.',
  );
  lines.push('');

  lines.push('## How this will be checked');
  lines.push('');
  for (const requirement of contract.validation) {
    const minimum = requirement.minimum === undefined ? '' : ` (minimum ${requirement.minimum})`;
    lines.push(`- **${requirement.id}**${minimum}: ${requirement.description}`);
  }
  lines.push('');
  lines.push(
    'Scores are reported separately. There is no single "human score", and you must not claim one.',
  );
  lines.push('');

  return `${lines.join('\n')}\n`;
}

/**
 * Monotonic suffix. A timestamp alone is not enough: two contracts built in the
 * same millisecond would collide, and a contract id has to be quotable in a
 * report without being ambiguous.
 */
let contractSequence = 0;

function makeContractId(input: ContractBuildInput): string {
  contractSequence += 1;
  return [
    'hvc',
    input.language,
    input.mode,
    input.strategyId,
    Date.now().toString(36),
    contractSequence.toString(36),
  ].join('-');
}
