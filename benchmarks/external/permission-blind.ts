/**
 * The permission blind set: user turns only, hand-labelled, written to break the layer.
 *
 * ## Why turns and not replies
 *
 * `A` reads the user's turn. Validating it against generated replies would mix the two questions
 * this project just separated, so this set carries no replies at all: thirty user turns, each
 * labelled with the permission a reader would say it grants, and nothing else.
 *
 * ## Boundary cases by design
 *
 * The turns are chosen to be the ones that make a three-way classifier look silly — rhetorical
 * questions, dropped subjects, colloquial help requests, pure emotion, requests for evaluation,
 * a proposed action asking for a verdict, "what would you do", and fragments that mean nothing
 * without the message before them. Several are marked `UNCERTAIN` on purpose, because a layer that
 * never abstains is a layer that is guessing.
 *
 * **`UNCERTAIN` is a correct answer, not a miss.** The scoring below counts it separately and
 * never rewards forcing a grey turn into `LOW` or `HIGH`.
 *
 * ## Frozen once read
 *
 * As with the action-plan blind set: the layer may be looked at against this set while it is being
 * built, and once it is frozen nothing may change in response to what these produce.
 */

export interface PermissionCase {
  readonly id: string;
  readonly userTurn: string;
  readonly context?: string;
  /** What a reader says the turn grants. `UNCERTAIN` where a reader genuinely cannot decide. */
  readonly label: Permission;
  /** Which boundary this case is here to test. */
  readonly boundary: string;
}

import type { Permission } from './permission.js';

export const PERMISSION_CALIBRATION_CASES: readonly PermissionCase[] = [
  // ---- HIGH: a solution was asked for -------------------------------------
  { id: 'p-high-colloquial', userTurn: '这咋整啊', label: 'HIGH', boundary: 'colloquial help request with no formal words' },
  { id: 'p-high-should-i', userTurn: '我要不要去投诉', label: 'HIGH', boundary: 'a proposed action asking for a verdict' },
  { id: 'p-high-what-would-you-do', userTurn: '换你你会怎么办', label: 'HIGH', boundary: 'asks for the other person\'s course of action' },
  { id: 'p-high-any-way', userTurn: '有没有什么办法能快点', label: 'HIGH', boundary: 'method request' },
  { id: 'p-high-help-me-look', userTurn: '帮我看看这事儿怎么处理', label: 'HIGH', boundary: 'explicit help request plus method' },
  { id: 'p-high-who-to-ask', userTurn: '该找谁啊，教教我', label: 'HIGH', boundary: 'steps plus teaching request' },
  { id: 'p-high-how-to-say', userTurn: '怎么跟他说比较好', label: 'HIGH', boundary: 'asks for the wording of the action' },
  { id: 'p-high-where-to-start', userTurn: '能不能给我个思路，从哪下手', label: 'HIGH', boundary: 'asks for a starting point' },
  { id: 'p-high-process', userTurn: '流程是什么，我下一步做啥', label: 'HIGH', boundary: 'process and next step' },
  { id: 'p-high-pick-one', userTurn: '两个方案选哪个，你替我拿个主意', label: 'HIGH', boundary: 'options plus an explicit request to decide' },

  // ---- MEDIUM: a judgement was asked for ----------------------------------
  { id: 'p-med-is-he-sick', userTurn: '你说他是不是有病', label: 'MEDIUM', boundary: 'asks for an evaluation of a person' },
  { id: 'p-med-outrageous', userTurn: '这事儿是不是挺离谱的', label: 'MEDIUM', boundary: 'asks for a verdict on the situation' },
  { id: 'p-med-am-i-right', userTurn: '你觉得我这样想对不对', label: 'MEDIUM', boundary: 'asks for a judgement on their own view' },
  { id: 'p-med-would-you-be-angry', userTurn: '换你你气不气', label: 'MEDIUM', boundary: 'asks for the other person\'s reaction, not their action' },
  { id: 'p-med-too-much', userTurn: '这算不算过分', label: 'MEDIUM', boundary: 'asks for a norm judgement' },
  { id: 'p-med-too-sensitive', userTurn: '我是不是太敏感了', label: 'MEDIUM', boundary: 'self-doubt asking for a verdict' },
  { id: 'p-med-normal', userTurn: '你说这正常吗', label: 'MEDIUM', boundary: 'asks whether this is normal' },
  { id: 'p-med-what-do-you-think', userTurn: '你怎么看这件事', label: 'MEDIUM', boundary: 'the plain view request' },

  // ---- LOW: something was shared, and nothing was asked --------------------
  { id: 'p-low-fed-up', userTurn: '我真服了', label: 'LOW', boundary: 'pure emotion, no question' },
  { id: 'p-low-third-time', userTurn: '又改了，第三次', label: 'LOW', boundary: 'dropped subject, statement only' },
  { id: 'p-low-rhetorical', userTurn: '这也能怪我？', label: 'LOW', boundary: 'rhetorical question, which is venting rather than asking' },
  { id: 'p-low-dismissed', userTurn: '排了两小时，一句话给我打发了。', label: 'LOW', boundary: 'a completed account with feeling' },
  { id: 'p-low-never-mind', userTurn: '算了，不说了', label: 'LOW', boundary: 'explicitly declining to ask for anything' },
  { id: 'p-low-enough', userTurn: '今天真是够够的', label: 'LOW', boundary: 'a closing statement of mood' },
  { id: 'p-low-dont-want-to-go', userTurn: '我不想去。', label: 'LOW', boundary: 'a decision already made and stated' },
  { id: 'p-low-thats-it', userTurn: '房子没了，钱也退了，就这样吧。', label: 'LOW', boundary: 'an account closed by the speaker' },

  // ---- UNCERTAIN: genuinely undecidable on the turn alone ------------------
  { id: 'p-unc-now-what', userTurn: '那现在呢', label: 'UNCERTAIN', boundary: 'means nothing without the previous message' },
  { id: 'p-unc-then-what', userTurn: '然后呢', label: 'UNCERTAIN', boundary: 'continuation marker' },
  { id: 'p-unc-you-say', userTurn: '你说呢', label: 'UNCERTAIN', boundary: 'a challenge, not a request for a view about anything' },
  { id: 'p-unc-is-that-it', userTurn: '就这？', label: 'UNCERTAIN', boundary: 'disappointment with no content' },
  { id: 'p-unc-fine', userTurn: '行吧', label: 'UNCERTAIN', boundary: 'an acknowledgement that could precede anything' },
  { id: 'p-unc-ellipsis', userTurn: '……', label: 'UNCERTAIN', boundary: 'nothing at all' },

  // ---- The same turn with context that changes what it grants -------------
  {
    id: 'p-ctx-now-what-bare',
    userTurn: '那现在呢',
    label: 'UNCERTAIN',
    boundary: 'the fragment, alone',
  },
  {
    id: 'p-ctx-now-what-context',
    userTurn: '那现在呢',
    context: '合同签了，钱付了，对方一直不发货，消息也不回。',
    label: 'HIGH',
    boundary: 'the same fragment after an unfinished problem, which asks what to do about it',
  },
  {
    id: 'p-ctx-you-say-bare',
    userTurn: '你说呢',
    label: 'UNCERTAIN',
    boundary: 'the fragment, alone',
  },
  {
    id: 'p-ctx-you-say-context',
    userTurn: '你说呢',
    context: '他借了我的钱，说好上个月还，现在提都不提。',
    label: 'MEDIUM',
    boundary: 'the same fragment after a situation, which asks for a view on it',
  },
];

/**
 * The blind set: written after the layer was built, read once, and not tuned against.
 *
 * The cases above were read while the signals were being chosen, which makes them calibration no
 * matter what they were called. These twenty are the ones that decide whether the layer goes into
 * shadow mode, and the same rule applies to them: **if a signal changes in response to what they
 * produce, they become calibration and a third set has to be written.**
 *
 * They lean on boundaries the first set did not: sarcasm, a question that is a complaint, two
 * intents in one turn, a request for facts rather than for help, an instruction aimed at the
 * assistant, and a turn that explicitly asks for permission rather than for advice.
 */
export const PERMISSION_BLIND_CASES: readonly PermissionCase[] = [
  // HIGH: something is being asked for
  { id: 'b-high-repair-quote', userTurn: '修一次要八百，我该不该答应', label: 'HIGH', boundary: 'a price and a decision request' },
  { id: 'b-high-two-intents', userTurn: '材料交了三次都被退回来，烦死了，你说我还能怎么弄', label: 'HIGH', boundary: 'venting and a request in one turn; the request leads' },
  { id: 'b-high-permission', userTurn: '我能不能直接报警', label: 'HIGH', boundary: 'asks permission to act, which is a request for a course of action' },
  { id: 'b-high-sarcasm', userTurn: '谢了，接下来我该找谁', label: 'HIGH', boundary: 'sarcastic opener followed by a real request' },
  { id: 'b-high-what-now', userTurn: '对方把我拉黑了，那接下来呢', label: 'HIGH', boundary: 'a fragment that carries the request because the problem is stated' },

  // MEDIUM: a judgement is being asked for
  { id: 'b-med-third-party', userTurn: '我同事天天甩锅，你说这人是不是有点问题', label: 'MEDIUM', boundary: 'asks for an evaluation of a third party' },
  { id: 'b-med-fair', userTurn: '扣我三天工资，这公平吗', label: 'MEDIUM', boundary: 'asks whether a treatment is fair' },
  { id: 'b-med-am-i-wrong', userTurn: '我拒绝了领导周末的安排，你觉得我做得对吗', label: 'MEDIUM', boundary: 'asks for a verdict on something already done' },
  { id: 'b-med-question-as-complaint', userTurn: '这种事怎么就没人管呢', label: 'MEDIUM', boundary: 'a question that is half a complaint, asking for agreement rather than a plan' },
  { id: 'b-med-should-i-feel-bad', userTurn: '我没去参加他婚礼，是不是不太好', label: 'MEDIUM', boundary: 'asks for a norm judgement on their own conduct' },

  // LOW: shared, with nothing asked
  { id: 'b-low-sarcasm', userTurn: '真是谢谢他们了。', label: 'LOW', boundary: 'sarcasm with no request, closed with punctuation' },
  { id: 'b-low-tired', userTurn: '今天从早忙到现在，饭都没吃', label: 'LOW', boundary: 'a statement of a day, no question, no marker word' },
  { id: 'b-low-declined', userTurn: '我拒绝了，就这样。', label: 'LOW', boundary: 'a decision taken and closed' },
  { id: 'b-low-mixed-feeling', userTurn: '说不上来什么感觉，反正不舒服', label: 'LOW', boundary: 'a feeling with no name and no question' },
  { id: 'b-low-quoted-advice', userTurn: '我妈说让我忍忍，我不想忍。', label: 'LOW', boundary: 'reports advice received; asks for nothing' },

  // UNCERTAIN: not enough on the turn alone
  { id: 'b-unc-fact-question', userTurn: '这个多少钱', label: 'UNCERTAIN', boundary: 'asks for a fact, which is neither a plan nor a judgement about a situation' },
  { id: 'b-unc-instruction', userTurn: '把上次那个链接再发我一遍', label: 'UNCERTAIN', boundary: 'an instruction to the assistant, not a permission level' },
  { id: 'b-unc-ok', userTurn: '嗯嗯', label: 'UNCERTAIN', boundary: 'acknowledgement' },
  { id: 'b-unc-partial', userTurn: '还是不太行', label: 'UNCERTAIN', boundary: 'a verdict on something not in the turn' },
  { id: 'b-unc-mixed', userTurn: '算了，你看着办吧', label: 'UNCERTAIN', boundary: 'delegates the decision without saying what it is about' },
];
