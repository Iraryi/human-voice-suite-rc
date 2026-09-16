/**
 * The structural features of "the reply turned this into an action plan".
 *
 * ## FROZEN
 *
 * These patterns were calibrated against the sixty `plain` replies of the calibration set and then
 * **frozen**. The blind set (`SOLUTION_MODE_BLIND.md`, twenty-four situations from domains the
 * calibration twenty never touched) was generated afterwards and run once, and **no pattern here
 * may be changed in response to what it produced**. Changing one turns that batch into a second
 * calibration set, and a third set would have to be written before any claim could be made. The
 * rule lives in this header rather than in a document because this is the file somebody would edit.
 *
 * Frozen at: 29 of 38 calibration plans recalled, 0 of 22 non-plans flagged.
 * Blind run: 23 of 24 obvious plans found, 0 of 24 complaints flagged, 0 of 24 in the gray zone
 * on the `default` arm.
 *
 * ## Why structure and not a word list
 *
 * `chat.unsolicited_advice` watches five phrases. On HelpSteer3 a **loose** probe — a sequence
 * marker or two enumerated steps, plus a modal — finds a procedure in 34.6% of machine responses
 * and the rule fires on 2.9% of them, which is what a lexical detector looks like when the
 * behaviour is expressed some other way. That 34.6% is an upper bound, not a measurement, and it
 * is quoted nowhere as a rate.
 *
 * The sharper version of the same finding is in the blind set: **62 of 216 replies are shaped like
 * an action plan and not one of them contains any of the five watched phrases**, so the lexical
 * rule catches none of them and could not have. Widening the phrase list does not fix that: the
 * next paraphrase is always one edit away, and every added phrase is a phrase that will eventually
 * fire on ordinary writing.
 *
 * So this file describes the *shape* of a solution-mode reply rather than its vocabulary. The
 * features are the ones the analysis was asked to look for, each measurable on a string, none of
 * them a rule. They are counted on machine replies and on human replies and the counts compared;
 * only then is a detector worth writing, and it goes into shadow mode first.
 *
 * ## What each feature is, and what it cannot see
 *
 * All of them are surface features of one reply with no user turn, because that is what makes
 * them comparable across a corpus, a prompt bank and a chat log. The judgement they support is
 * "this reply is shaped like a plan"; whether the plan was *wanted* is a property of the
 * conversation, and is supplied by the caller through the variant or the user turn.
 */

/** A clause break. Used to decide whether a form opens a clause rather than sitting mid-flow. */
const CLAUSE_BOUNDARY = /[。！？!?…；;,\n，、：:]/;

/**
 * Verbs that name something a person can *do about* a situation.
 *
 * This list is the one place a lexicon is unavoidable, and it is deliberately small: it exists to
 * answer "does this clause start with an action", not "is this reply about advice". The decision
 * that matters is composite — how many clauses open with one of these, whether they are ordered,
 * whether a condition selects between them — and a reply is not a plan because a word in this
 * list appears in it. That is what the calibration set is for, and the first version of these
 * features is what happens when a lexicon is trusted on its own.
 */
const ACTION_VERB =
  /^(?:打|拨打|打个|找|找个|找一?下|联系|问|问一?下|询问|查|查一?下|查询|看|看一?下|判断|分清|处理|花|拆|转|重复|练|撑|记|记下|摆|立|拿|报|投诉|举报|申诉|申请|提交|寄|邮寄|起诉|报警|准备|整理|记录|保存|留存|留好|留一?下|留|拍|截图|录音|存|换|退|退货|买|约|发|写|带|试|试试|停|关|开|调|装|卸|清|修|送|催|谈|沟通|协商|搬|挂|卖|借|还|核对|对比|算一?下|计算|导出|备份|重启|更新|卸载|安装|去医院|看医生|挂号|检查|咨询|反馈|确认|明确|固定|减少|避免)/;

/**
 * Lead-ins that make the clause an instruction whatever verb follows.
 *
 * `先看电池健康度`, `先判断是局部磨还是鞋型不合`, `直接找物业` — the ordering word is what carries
 * the instruction, and requiring a verb from the list after it misses the ordinary way people
 * write a step. This is the "bare verb opening" the analysis named, and it is a relation rather
 * than a longer word list.
 */
const LEAD_IN = /^(?:先|再|然后|接着|直接|最好|提前|赶紧|立刻|马上|尽快|去|一定|务必|记得|试试|不妨)[\u4e00-\u9fff]/;

/** "把 X 过一遍": the object-first imperative, which never opens with a verb at all. */
const BA_CONSTRUCTION = /把[^，。！？!?]{1,10}(?:过|看|记|留|写|发|发到|整理|保存|拍|截图|录音|换|退|查|算|保存好|留好|备份)/;

/**
 * Negative imperatives.
 *
 * Counted, and deliberately **not** part of the plan composite: "别较真，也别往心里去" is advice, and
 * it is also what people say to each other. A reply made of prohibitions is not a procedure, and
 * treating one as a step is what made an earlier version fire on two of the complaints.
 */
const NEGATIVE_IMPERATIVE = /(?:^|[。！？!?…；;,\n，、：:])\s*(?:别|不要|不用)/g;

/** Ordering markers, which turn clauses into a sequence. */
const ORDERING = /先|再|然后|接着|其次|最后|之后|接下来|第一步|第二步|第三步|首先/g;

/** Condition then action: "do A; if that fails, do B". The action is required, not just 就. */
const CONDITIONAL =
  /(?:如果|要是|实在不行|不行的话|不行|没用|没用的话|不还|不退|不办|拖着|再不|万一|否则|大不了)[^。！？!?]{0,24}(?:就|再|直接|可以)?(?:打|拨打|找|联系|问|查|报|投诉|举报|申诉|申请|提交|起诉|报警|走|换|退|催|谈|留|准备|整理|去医院|挂号|检查)/;

/** An institution, a channel or a process to go through. */
const CHANNEL =
  /(?:客服|投诉|申诉|12315|12345|95598|物业|居委会|街道办|平台|官方|热线|工单|举报|仲裁|起诉|律师|消协|住建|邮管局|市场监管|小额诉讼|支付令|流程|手续|材料|凭证|票据|截图|录音|证据|合同|条款)/;

/** Enumerated steps. */
const ENUMERATION = /(?:^|\n)\s*(?:\d+[.、)]|[一二三四五][、.]|[-*•])\s*/g;

/** A closing judgement that ends the topic rather than the message. */
const VERDICT_CLOSE = /(?:没得辩|没商量|别犹豫|早该|就是这样|只能这样|别无选择|必须的)/;

export interface SolutionFeatures {
  /** Clauses that open with an action verb — a subjectless imperative, which is the normal form. */
  readonly clauseInitialActions: number;
  /** Every action verb in the reply, wherever it sits. */
  readonly actionDensity: number;
  /** Ordering markers: 先…再…最后. */
  readonly ordering: number;
  /** Condition-then-action pairs. */
  readonly conditionals: number;
  /** Names an institution, channel or process. */
  readonly channel: boolean;
  /** A numbered or bulleted procedure. */
  readonly enumerated: boolean;
  /** Two or more second-person directives, with the pronoun present. */
  readonly directiveChain: boolean;
  /** The reply moves from describing to instructing. */
  readonly descriptionToInstruction: boolean;
  /** Introduces a next step that the user's turn never raised. Not computable here: see below. */
  readonly nextStepIntroduced: false;
  /** The composite: a reply shaped like a procedure. */
  readonly isPlan: boolean;
}

function count(text: string, pattern: RegExp): number {
  const scanner = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  let matches = 0;
  while (scanner.exec(text) !== null) matches += 1;
  return matches;
}

/** The clauses of a reply, trimmed, with empty ones dropped. */
function clauses(text: string): string[] {
  return text
    .split(new RegExp(CLAUSE_BOUNDARY.source))
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);
}

/**
 * Extract the features of one reply.
 *
 * `nextStepIntroduced` is always false and is kept in the shape on purpose: it needs the user
 * turn to compute, and this function deliberately does not take one. A caller that has the turn
 * computes it itself.
 */
export function solutionFeatures(text: string): SolutionFeatures {
  const trimmed = text.trim();
  const parts = clauses(trimmed);

  // Two kinds of action clause, and the distinction is the one that keeps a description from
  // reading as an instruction. A **strong** opener carries a lead-in or an object-first
  // construction, so it is an instruction whatever follows. A **weak** opener is a bare verb at
  // the start of a clause, which is also how a reply describes what somebody else did: `问完工资问对象`
  // is the relatives asking, not a step for the reader.
  const strong = parts.filter((clause) => LEAD_IN.test(clause) || BA_CONSTRUCTION.test(clause)).length;
  const weak = parts.filter((clause) => !LEAD_IN.test(clause) && !BA_CONSTRUCTION.test(clause) && ACTION_VERB.test(clause)).length;
  const opening = strong + weak;
  const density = count(trimmed, ACTION_VERB) + count(trimmed, BA_CONSTRUCTION);
  const ordering = count(trimmed, ORDERING);
  const conditionals = count(trimmed, CONDITIONAL);
  const channel = CHANNEL.test(trimmed);
  const steps = (trimmed.match(ENUMERATION) ?? []).length;
  const directives = count(trimmed, /(?:你|您)(?:可以|需要|应该|要|务必|一定|最好|直接|先|别|不要|记得|试试)/);
  const fallback = conditionals >= 1;

  // Description before instruction: something stated, then something told. The "switches from
  // empathy to execution" shape, and the one that reads worst in a chat.
  const firstAction = trimmed.search(ACTION_VERB);
  const describes = /(?:确实|的确|是很|挺|真的|唉|哎|哈|理解|难受|辛苦|不容易)/.test(
    firstAction <= 0 ? trimmed : trimmed.slice(0, firstAction),
  );
  const descriptionToInstruction = describes && firstAction > 0;

  // The composite, deliberately built from relations rather than from vocabulary: how many
  // clauses open with an instruction, whether those instructions are ordered or chosen between,
  // and whether the reply names a channel it is sending the reader down. A single bare-verb
  // clause and no structure around it is a description, not a plan.
  const isPlan =
    strong >= 2 ||
    (strong >= 1 && (channel || conditionals >= 1 || ordering >= 2)) ||
    (strong >= 1 && weak >= 1 && density >= 3) ||
    (ordering >= 2 && density >= 3) ||
    (channel && conditionals >= 1) ||
    (steps >= 2 && density >= 2);

  return {
    clauseInitialActions: opening,
    actionDensity: density,
    ordering,
    conditionals,
    channel,
    enumerated: steps >= 2,
    directiveChain: directives >= 2,
    descriptionToInstruction,
    nextStepIntroduced: false,
    isPlan,
  };
}

/** The five phrases `chat.unsolicited_advice` watches, for measuring what it misses. */
export const ADVICE_MARKERS =
  /建议你|你可以试试|不妨|记得|最好是|it is worth|it's worth|you may want to|you might want to|make sure to/i;

export function hasAdviceMarker(text: string): boolean {
  return ADVICE_MARKERS.test(text);
}

export { CLAUSE_BOUNDARY, VERDICT_CLOSE };
