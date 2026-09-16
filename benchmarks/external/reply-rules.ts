/**
 * What counts as a reply, for the paired experiment.
 *
 * Separate from the tool that uses it so that importing the definitions does not run a
 * command-line tool — the same reason `conditions.ts` exists.
 */

/** Shortest and longest reply the merge will accept, in characters. */
export const MIN_REPLY = 2;
export const MAX_REPLY = 300;

/**
 * Meta-commentary and refusals.
 *
 * A generator that answers "抱歉，我无法参与" has not produced a machine reply, it has
 * declined to. Those rows are counted and dropped rather than measured, because
 * scoring a refusal as assistant behaviour would corrupt the thing being measured.
 *
 * The pattern is deliberately narrow about the apology. `抱歉` is one of the most
 * common openers in Chinese chat — "抱歉抱歉，刚才没看到" is a real reply, and an
 * earlier version of this file dropped one exactly like it by matching the bare
 * prefix. An apology only counts as a refusal when it is followed by the refusal
 * itself.
 */
export const REFUSAL = new RegExp(
  [
    // 抱歉 / 对不起 + the refusal
    '^(?:很|非常|实在)?抱歉[，,。！!：:]?\\s*(?:我)?(?:不能|无法|不可以|没办法|恕难|不便)',
    '^对不起[，,。！!：:]?\\s*(?:我)?(?:不能|无法|不可以|没办法|恕难|不便)',
    // a persona announcement
    '^作为(?:一个)?(?:AI|人工智能|语言模型|助手|聊天机器人)',
    // a first-person refusal, with or without an apology
    '^我(?:无法|不能)(?:回答|参与|继续|提供|帮|完成)',
    '^(?:很|非常)?抱歉[，,。！!：:]?\\s*我(?:无法|不能)(?:回答|参与|继续|提供|帮|完成)',
    // the shape of an answer that has stopped being a chat message
    '^无法回答',
    '^以下(?:是|为)',
    '^希望(?:这|以上)',
  ].join('|'),
);

export function isRefusal(text: string): boolean {
  return REFUSAL.test(text);
}
