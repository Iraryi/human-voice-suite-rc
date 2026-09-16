/**
 * Solution permission: how much room the user's turn gave for a plan.
 *
 * ## The two questions
 *
 * `solution-mode.ts` answers **B**: is this reply shaped like an action plan? It says nothing
 * about whether anybody wanted one. This file answers **A**: did the user's turn invite a
 * solution, invite only a judgement, or invite nothing?
 *
 * The two are deliberately separate. A plan where a plan was asked for is a good answer; the same
 * plan where nobody asked is the behaviour under study; and a detector that folds the two into one
 * pattern measures advice, which is not a tell.
 *
 * ## Four states, and why not three
 *
 * The experiment's three variants have known truth values. Real turns do not: one sentence often
 * carries a complaint, a rhetorical question, a request for a view and half a request for help at
 * once. Forcing those into three buckets would recreate exactly the error this project spent a
 * phase removing, so the layer has four states and **`UNCERTAIN` is a first-class result, not a
 * failure**:
 *
 * | State | Meaning |
 * | --- | --- |
 * | `HIGH` | Asks for advice, a method, steps, options or help with solving it |
 * | `MEDIUM` | Asks for a judgement, an evaluation or a side — not for a course of action |
 * | `LOW` | Shares, states or vents, with positive evidence of that stance and no request |
 * | `UNCERTAIN` | The turn does not carry enough to decide, or carries contradictory signals |
 *
 * ## Why `LOW` needs positive evidence
 *
 * Absence of a request is **not** evidence of `LOW`. Chinese chat omits subjects, verbs and whole
 * clauses, and "算了，不说了" requests nothing while "今天真是够够的" asks for nothing either — but so
 * does a fragment whose other half was in the previous message. Defining `LOW` as "no help words
 * found" would classify every elliptical turn as an invitation-free statement, which is how a
 * detector ends up accusing people of being asked nothing.
 *
 * So `LOW` requires a *completed* sharing stance: a venting marker, or a陈述 that closes itself
 * with terminal punctuation and no interrogative, and no request evidence anywhere.
 *
 * ## Status: shadow
 *
 * Nothing here is scored. This layer reports; it does not change `behaviorScore`, `voiceScore` or
 * any benchmark verdict, and it will not until the promotion conditions in `SOLUTION_MODE.md` are
 * met. The goal is precision and abstention, not coverage: a large `UNCERTAIN` share is the
 * intended outcome for genuinely ambiguous turns.
 */

export type Permission = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNCERTAIN';

export interface PermissionReading {
  readonly permission: Permission;
  /** Which signals fired, so a reader can disagree with the reading rather than the verdict. */
  readonly signals: readonly string[];
}

/**
 * Signals that the user asked for a solution.
 *
 * Recorded separately rather than as one pattern, because the interesting disagreements later are
 * between the sub-types: a `how` request, an `options` request and a `should I` request are all
 * `HIGH` and they are not the same act.
 */
const HIGH_SIGNALS: ReadonlyArray<readonly [string, RegExp]> = [
  ['how', /怎么办|咋办|怎办|咋整|怎么整|怎么处理|如何处理|怎么弄|怎么搞|怎么做|如何做|该怎么|怎么解决/i],
  ['method', /有什么办法|有啥办法|有没有办法|有什么好办法|办法没有|求个办法|有什么招|有没有什么办法|有什么建议|给点建议|建议一下|求建议/i],
  ['steps', /流程|步骤|下一步|怎么开始|从哪开始|从哪儿开始|从哪下手|教我|指导一下|给个思路|给个方向|给我个思路|给我个方向|什么思路/i],
  ['help', /帮我|帮忙|替我|麻烦你|求你|救我|支个招|出个主意|拿个主意|你替我拿个主意/i],
  ['options', /选哪个|哪个好|推荐一?下?|有什么推荐|两种方案|哪个方案/i],
  ['decision', /该不该|要不要|去不去|买不买|换不换|辞不辞|值不值得/i],
  ['wording', /怎么(?:跟|和|对)[^，。？?]{0,6}说|怎么说比较好|该怎么说|怎么开口/i],
  ['what_would_you_do', /换你你(?:会)?(?:怎么办|怎么做|怎么选|干啥|做什么)|要是你你(?:会)?(?:怎么办|怎么做|怎么选)|你是我你(?:会)?(?:怎么办|怎么做)/i],
];

/** Signals that the user asked for a judgement, not for a course of action. */
const MEDIUM_SIGNALS: ReadonlyArray<readonly [string, RegExp]> = [
  ['view', /你怎么看|你咋看|你怎么想|你觉得|你认为呢|你说呢|你怎么认为|你说这(?:事|种事|个事)?|你说他|你说她|你说(?:是|还|为什么|怎么|会)/i],
  ['evaluation', /是不是很|是不是挺|算不算|正常吗|合理吗|过分吗|有病|离谱|有问题吗|有道理吗|对不对|气不气|服不服|是不是(?:根本)?(?:没人管|没人管得了|不正常|不合适|我错|有问题|太|过分|离谱)|还是(?:纯粹在闹|题目不对|系统的问题|熬夜)/i],
  ['side', /站哪边|你站谁|支持谁|谁对谁错/i],
  ['self_doubt', /我是不是太|是不是我错|我是不是想多了|我是不是敏感/i],
];

/**
 * Positive evidence that the turn is sharing something rather than asking for anything.
 *
 * Either half is enough: a marker of a stance, or a statement that closes itself with terminal
 * punctuation. Punctuation is unreliable in chat, so `burden` carries the weight for the sentences
 * that describe a recurring nuisance without any feeling-word at all — "已经第五天了", "一天要充三次",
 * "这周每天都干到十一点" are all statements a person makes to be heard, and none of them asks for
 * anything.
 *
 * What is *not* evidence is the absence of a request. See the header.
 */
const LOW_SIGNALS: ReadonlyArray<readonly [string, RegExp]> = [
  ['venting', /唉|哎|烦死|真烦|好烦|累死|好累|难受|崩溃|无语|服了|气死|受不了|郁闷|委屈|想哭|心态崩|够够的|算了|不说了|不想去|没意思|太难了|快疯|麻了|醉了|绝了|气人|烦人|慌|急死/i],
  ['rhetorical', /这也能|难道|凭什么|怎么没人|怎么就没人|至于吗|谁受得了/i],
  ['sharing', /我今天|我昨天|我刚刚|我刚|今天遇到|昨天遇到|跟你说个事|我跟你讲|分享一下/i],
  ['burden', /已经.{0,6}了|都.{0,4}(?:天|次|周|个月)了|天天|每天|一周|两周|第三次|第[四五]天|一直|又(?:改|来|涨|催|拖|推|说)|越来越|还没|每次/i],
  ['closing_statement', /[。！…]$/],
];

/** Turns whose meaning is in the previous message, or which carry nothing to decide on. */
const CONTEXT_DEPENDENT =
  /^(?:那|这|然后|接着|所以|现在)?(?:现在)?(?:呢|然后呢|怎么说|怎么办|咋办|你说呢|就这|行吧|好吧|哦|嗯|啊)?[？?。！…]*$/;

/** Interrogative surface forms. Their presence alone is not a request for anything. */
const QUESTION_FORM = /[？?]|吗|呢|吧|是不是|算不算|对不对|有没有|能不能|该不该|要不要|好不好|行不行/;

export interface PermissionInput {
  readonly userTurn: string;
  /** The preceding turns, when the caller has them. A fragment can flip state with context. */
  readonly context?: string;
}

/**
 * Read the permission a turn carries.
 *
 * Deliberately conservative. `HIGH` and `MEDIUM` need a signal; `LOW` needs a signal *and* a shape
 * that closes itself; anything else is `UNCERTAIN`, including the case where a request signal and
 * a venting signal appear together and the turn does not resolve which one leads.
 */
export function permissionOf(input: PermissionInput): PermissionReading {
  const turn = input.userTurn.trim();
  const context = (input.context ?? '').trim();
  if (turn.length === 0) return { permission: 'UNCERTAIN', signals: ['empty'] };

  const signals: string[] = [];
  const high = HIGH_SIGNALS.filter(([, pattern]) => pattern.test(turn)).map(([name]) => `high:${name}`);
  const medium = MEDIUM_SIGNALS.filter(([, pattern]) => pattern.test(turn)).map(([name]) => `medium:${name}`);
  const low = LOW_SIGNALS.filter(([, pattern]) => pattern.test(turn)).map(([name]) => `low:${name}`);
  signals.push(...high, ...medium, ...low);

  // A fragment that means nothing on its own: no event, no question, no stance. With a context it
  // may become decidable, and which way it goes depends on the fragment: `那现在呢` after an
  // unfinished problem asks what to do about it, `你说呢` after a situation asks for a view.
  const bare = turn.replace(/\s+/g, '');
  if (CONTEXT_DEPENDENT.test(bare)) {
    if (context.length === 0) return { permission: 'UNCERTAIN', signals: [...signals, 'fragment'] };
    const asksWhatNow = /现在呢|怎么办|咋办|咋整|然后呢|接下来呢|那呢/.test(bare);
    const asksForView = /你说呢|你觉得呢|你怎么看/.test(bare);
    if (asksWhatNow) return { permission: 'HIGH', signals: [...signals, 'fragment+context:what-now'] };
    if (asksForView) return { permission: 'MEDIUM', signals: [...signals, 'fragment+context:view'] };
    return { permission: 'UNCERTAIN', signals: [...signals, 'fragment+context'] };
  }

  // A request wins, and a decision request (`该不该`, `要不要`) counts as one: it asks what to do,
  // even though it names the action rather than the method.
  if (high.length > 0) return { permission: 'HIGH', signals };

  // A judgement request with venting attached is the gray zone this layer exists to keep gray.
  if (medium.length > 0) return { permission: 'MEDIUM', signals };

  // Sharing needs a stance or a statement that closes itself. Either is positive evidence that the
  // turn is telling rather than asking, which is what separates `LOW` from "no request found".
  const closes = LOW_SIGNALS.some(([name, pattern]) => name === 'closing_statement' && pattern.test(turn));
  const stance = LOW_SIGNALS.some(([name, pattern]) => name !== 'closing_statement' && pattern.test(turn));
  if ((stance || closes) && !QUESTION_FORM.test(turn)) {
    return { permission: 'LOW', signals };
  }

  return { permission: 'UNCERTAIN', signals };
}
