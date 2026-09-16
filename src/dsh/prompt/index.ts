/**
 * The prompt payload.
 *
 * `renderContractForAgent` produces the body. What it cannot produce is the part
 * that depends on what kind of text this is: a chat reply and a technical
 * document need different opening instructions, and a strategy that turns
 * structural rewriting off needs to say so rather than leaving the agent to
 * infer it from an absent section.
 *
 * So this module is a preamble keyed on mode and strategy, prepended to the
 * contract. It is short on purpose — the contract carries the detail, and a
 * preamble that repeated it would be two instructions to keep in step.
 */

import type { TextMode } from '../../shared/types.js';
import type { Strategy } from '../../rewrite/strategies/strategy.js';
import type { HumanVoiceContract } from '../../rewrite/types.js';
import { renderContractForAgent } from '../../rewrite/contract.js';

export const AREA = 'dsh.prompt';
export const TARGET_PHASE = 4;

/** What the agent is being asked to do, in one line, per mode. */
const MODE_FRAMING: Readonly<Record<TextMode, string>> = {
  chat: 'Reply to the message. This is a conversation, not a document.',
  prose:
    'Rewrite the text. Every claim in the source must still be present, and no claim that is not in it may appear.',
  formal:
    'Rewrite the text without changing its register. Formal writing is allowed forms that read as tells elsewhere.',
  technical:
    'Rewrite the prose only. Identifiers, commands, paths, numbers and code must survive character for character.',
  public:
    'Rewrite the text for publication. It must carry every claim the source makes and nothing it does not.',
  unknown:
    'Rewrite the text so it reads as this writer\u2019s own, carrying every claim the source makes and no claim it does not.',
};

/**
 * What a strategy deliberately disables, stated rather than implied.
 *
 * An agent that is not told structural rewriting is off will do it anyway, and
 * for formal and technical text that is the wrong edit.
 */
const STRATEGY_CAVEATS: Readonly<Record<string, string>> = {
  formal:
    'Passive voice, hedges and qualifiers are often correct in this register. Only contradict them where they are clearly padding.',
  technical:
    'Do not restructure sentences to vary rhythm. Precision is worth more than prose shape here.',
  'chat-long-turn':
    'This is still a conversation. Do not add headings, lists or a concluding paragraph.',
};

export interface PromptPayload {
  readonly preamble: string;
  readonly body: string;
  readonly full: string;
}

/**
 * Build the payload for one contract.
 *
 * `body` is the rendered contract; `full` is the preamble plus the body, which
 * is what an agent should actually receive.
 */
export function buildPromptPayload(
  contract: HumanVoiceContract,
  strategy?: Pick<Strategy, 'id' | 'rationale'>,
): PromptPayload {
  const lines: string[] = [];

  lines.push('# Task');
  lines.push('');
  lines.push(MODE_FRAMING[contract.mode]);
  lines.push('');

  if (strategy) {
    lines.push(`Strategy: \`${strategy.id}\`. ${strategy.rationale}`);
    lines.push('');
  }

  const caveat = strategy ? STRATEGY_CAVEATS[strategy.id] : undefined;
  if (caveat) {
    lines.push(caveat);
    lines.push('');
  }

  lines.push(
    'You are performing the rewrite. No other model is involved: the contract below is the ' +
      'complete brief, and the tool that produced it does not write text.',
  );
  lines.push('');

  const preamble = lines.join('\n');
  const body = renderContractForAgent(contract);
  // A blank line between the two, or the contract's own heading runs straight on
  // from the preamble's last sentence and reads as one paragraph.
  return { preamble, body, full: `${preamble}\n${body}` };
}

/** The modes this module has framing for. Kept exported so a test can check it. */
export function framedModes(): TextMode[] {
  return Object.keys(MODE_FRAMING) as TextMode[];
}

export function strategyCaveat(strategyId: string): string | undefined {
  return STRATEGY_CAVEATS[strategyId];
}
