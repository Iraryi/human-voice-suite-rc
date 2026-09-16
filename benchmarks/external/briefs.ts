/**
 * The generator briefs, shared by the experiments that use them.
 *
 * Extracted so the prompt bank can use the *same* task framing as the paired control: if
 * the two used different briefs, a difference between their results could be the brief.
 * The strings are the paired control's, unchanged — that experiment's chunks were written
 * from them and its results are frozen against them.
 *
 * There is no model in this suite. These are instructions for the harness agents that
 * perform generation, and they live in the repository so that two agents cannot differ in
 * anything except the context they are handed.
 */

import { createToolkit } from '../../src/dsh/tools/runtime.js';

export type BriefArm = 'plain' | 'default' | 'post';

/** The chat contract's prohibitions, read from the capability layer rather than paraphrased. */
export async function prohibitions(projectRoot: string): Promise<string> {
  const toolkit = await createToolkit({ projectRoot });
  const prepared = await toolkit.prepare({ text: '在吗？', mode: 'chat' });
  return prepared.contract.forbidden.map((line) => `- ${line}`).join('\n');
}

export function outputRules(maxChars = 120): string {
  return (
    'Output rules: reply with the message text only. No explanation, no preamble, no ' +
    'quotation marks around it, no label. Reply in Chinese, the language of the conversation. ' +
    'Length: whatever a person would actually send in this conversation — one line if that is ' +
    `enough, a few short lines if not. Never more than ${maxChars} characters.`
  );
}

/**
 * @param maxChars The length ceiling the brief states. The paired control's briefs said 120
 *   and its results are frozen against that text, so 120 is the default; the prompt bank
 *   raises it, because how much a situation pulls out of a model is part of what that axis
 *   measures and a chat-sized ceiling would suppress exactly the long-form register it is
 *   looking for.
 */
export async function buildBriefs(
  projectRoot: string,
  maxChars = 120,
): Promise<Record<BriefArm, string>> {
  const forbidden = await prohibitions(projectRoot);
  const output = outputRules(maxChars);

  return {
    plain: [
      'You are a helpful assistant in a chat conversation.',
      'Read the conversation below and write the next message, as the person who has been replying.',
      '',
      output,
    ].join('\n'),
    default: [
      'You are answering a chat conversation.',
      'Read the conversation below and write the next message, as the person who has been replying.',
      '',
      'Answer under this contract, which is the complete list of things not to do:',
      '',
      forbidden,
      '',
      output,
    ].join('\n'),
    post: [
      'You are revising a draft reply in a chat conversation.',
      'The conversation is below, then a draft reply. Rewrite the draft so it keeps every claim it',
      'makes and adds nothing, while obeying this contract — the complete list of things not to do:',
      '',
      forbidden,
      '',
      output,
    ].join('\n'),
  };
}
