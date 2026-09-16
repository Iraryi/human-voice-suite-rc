/**
 * Chat behaviour engine — the part of the suite that upstream humanizers do
 * not cover.
 *
 * The upstreams mostly answer "does this *prose* sound like a person wrote
 * it". This layer answers a different question: "does this *reply behave* like
 * a person wrote it". A reply can be lexically casual, full of 哈哈 and 确实,
 * and still be unmistakably an assistant, because the behaviour is wrong: it
 * mirrors the user, agrees with everything, summarises what was just said,
 * offers more help, and explains things nobody asked about.
 *
 * Everything in this module is original to Human Voice Suite. It is attributed
 * to `human-voice-suite/local` and must never be presented as an upstream
 * capability.
 */

import { LOCAL_UPSTREAM } from '../rules/provenance/types.js';
import type { SourceReference } from '../rules/provenance/types.js';
import type { AdvicePermission, SolutionPermissionReading } from './permission/index.js';

/** How much a smell matters when it fires. */
export type AssistantSmellSeverity = 1 | 2 | 3 | 4 | 5;

/**
 * The ten smell identifiers, as a union.
 *
 * Written out rather than derived so a typo in a marker table is a compile
 * error, and so the ids appear in one place a reader can find.
 */
export type AssistantSmellId =
  | 'chat.mirrors_user'
  | 'chat.over_agreement'
  | 'chat.unsolicited_advice'
  | 'chat.auto_summary'
  | 'chat.unsolicited_offer'
  | 'chat.over_completeness'
  | 'chat.explains_obvious'
  | 'chat.forced_positivity'
  | 'chat.mechanical_empathy'
  | 'chat.unrequested_background';

export interface AssistantSmell {
  /** Canonical id. Always `chat.*` so the family is obvious in findings. */
  readonly id: AssistantSmellId;
  /** English label, used in reports. */
  readonly label: string;
  /** Chinese label, because the primary chat target is Chinese. */
  readonly labelZh: string;
  readonly severity: AssistantSmellSeverity;
  readonly description: string;
  /**
   * What the detector should look for. Written as a human-readable contract;
   * Phase 5 turns these into executable checks.
   */
  readonly detectionHint: string;
  /** What a rewrite must do instead. */
  readonly rewriteGuidance: string;
  readonly languages: readonly string[];
  /** Provenance. Always local for this taxonomy. */
  readonly sources: readonly SourceReference[];
  /**
   * Which class this smell belongs to, and therefore whether it may charge `behaviorScore`.
   *
   * `discriminating` (the default) is class A: the construct has been reviewed, there is human
   * false-positive evidence and there is machine positive evidence. **Only these contribute to the
   * score.** A total that mixes evidence of four different maturities does not mean one thing.
   *
   * | Value | Meaning | In `behaviorScore` |
   * | --- | --- | --- |
   * | `discriminating` | Reviewed, with evidence on both sides | yes |
   * | `descriptive` | Real information; specificity or per-item certainty is not enough to charge | no |
   * | `shadow` | A detector that is not validated, or that depends on input nothing supplies | no |
   * | `hypothesis` | A composition or a definition rather than a detector | no |
   * | `deprecated-candidate` | Construct validity not established; the code stays, the claim does not | no |
   *
   * See `benchmarks/external/RULE_STATUS_DECISION.md` for the decision behind each value.
   */
  readonly scoring?: 'discriminating' | 'descriptive' | 'shadow' | 'hypothesis' | 'deprecated-candidate';
  /** Why this smell is in that class. Required for everything except `discriminating`. */
  readonly scoringNote?: string;
}

function local(id: string): SourceReference {
  return { upstream: LOCAL_UPSTREAM, ruleId: id, locator: 'src/behavior/assistant-smell/taxonomy.ts' };
}

/**
 * The ten assistant smells the suite treats as first-class.
 *
 * Section 15 of the project brief names these directly. They are recorded here
 * as data rather than as prose so that detectors, contracts and benchmarks can
 * all reference the same identifiers.
 */
export const ASSISTANT_SMELLS: readonly AssistantSmell[] = [
  {
    id: 'chat.mirrors_user',
    label: 'Mirrors the user',
    labelZh: '复述用户',
    severity: 4,
    description:
      'The reply restates what the user just said before responding, instead of simply responding.',
    detectionHint:
      'Compare the opening clause against the preceding user turn. Flag high lexical or semantic overlap that adds no new information, especially openers shaped like "你提到……" / "You mentioned that……".',
    rewriteGuidance:
      'Delete the restatement. Answer directly. If a reference is genuinely needed, use a pronoun or a bare noun phrase.',
    languages: ['zh', 'en', 'unknown'],
    sources: [local('chat.mirrors_user')],
    scoring: 'deprecated-candidate',
    scoringNote:
      'Construct validity not established: 4 genuine mirroring against 2 in matched negatives, with 47 of 73 triggers being required entity reuse (REVIEW_RESULTS.md). The detection code stays; its claim does not.',
  },
  {
    id: 'chat.over_agreement',
    label: 'Over-agrees',
    labelZh: '过度认同',
    severity: 3,
    description:
      'The reply agrees with the user reflexively, often with an intensifier, even when the user said nothing that needs agreeing with.',
    detectionHint:
      'Flag agreement tokens (确实/没错/说得对/完全同意/absolutely/exactly/you are right) at a clause opening. The watched list is narrow; the condition is not checked, so agreement followed by a qualification still counts. That widens the rule rather than narrowing it, which is the safe direction, and the paired control measured 0 firings on 2,000 human continuations.',
    rewriteGuidance:
      'Keep at most one agreement token in a reply, and only when the user made a claim worth agreeing with. Otherwise state a position, add a condition, or stay neutral.',
    languages: ['zh', 'en', 'unknown'],
    sources: [local('chat.over_agreement')],
  },
  {
    id: 'chat.unsolicited_advice',
    label: 'Gives unsolicited advice',
    labelZh: '自动建议',
    severity: 4,
    description:
      'The reply appends advice, tips or next steps that the user did not ask for.',
    detectionHint:
      'Flag advice markers (建议你/你可以试试/不妨/记得/It is worth/You may want to/Consider) in replies whose user turn carried no invitation for advice. The invitation is read from `advicePermission`, a three-state field: `granted` suppresses the rule, `absent` lets it decide, and `unknown` makes it abstain rather than guess.',
    rewriteGuidance:
      'Remove advice unless it was requested. If a warning is genuinely necessary, state it once as fact, without a modal or an imperative.',
    languages: ['zh', 'en', 'unknown'],
    sources: [local('chat.unsolicited_advice')],
    scoring: 'shadow',
    scoringNote:
      'Its permission gate is now wired to the tri-state `advicePermission`, but every rate this project published for the rule was measured with the gate disabled and `requestKind` unpopulated (RULE_STATUS_DECISION.md); those numbers stay quoted with that qualifier. The rule remains shadow because the wired behaviour has not been blind-validated — plumbing is not validation — and because the concept still has 19 of 45 lexical-only firings that were legitimate advice after a request.',
  },
  {
    id: 'chat.auto_summary',
    label: 'Summarises automatically',
    labelZh: '自动总结',
    severity: 3,
    description:
      'The reply closes by summarising the conversation or the answer, a habit almost exclusive to assistants.',
    detectionHint:
      'Flag closing summary markers (总之/总的来说/总结一下/综上/In summary/In short/To sum up) and final paragraphs that restate the reply body.',
    rewriteGuidance:
      'End on the last substantive point. A short conversational reply must not have a concluding paragraph.',
    languages: ['zh', 'en', 'unknown'],
    sources: [local('chat.auto_summary')],
    scoring: 'descriptive',
    scoringNote:
      'Enrichment 3.02x on unnecessary recap against matched negatives, with 37.2% specificity and low per-item annotation confidence (REVIEW_RESULTS.md). Reported, not charged.',
  },
  {
    id: 'chat.unsolicited_offer',
    label: 'Offers more help',
    labelZh: '主动提供更多帮助',
    severity: 4,
    description:
      'The reply volunteers further assistance or invites follow-up questions.',
    detectionHint:
      'Flag service-closing formulas (还有什么可以帮你/如果还有问题/随时告诉我/希望这些对你有帮助/Let me know if/Hope this helps/Feel free to ask).',
    rewriteGuidance:
      'Remove the offer entirely. A person simply stops talking when done.',
    languages: ['zh', 'en', 'unknown'],
    sources: [local('chat.unsolicited_offer')],
    scoring: 'shadow',
    scoringNote:
      'Reviewed after the status decision, on a targeted matched sheet: 71 of 90 triggers were genuine uninvited offers against 8 of 90 matched negatives, an enrichment of 8.88x, with 98.6% of the positives assistant-shaped (OFFER_REVIEW.md). It stays shadow for the release candidate because the negatives are model replies: the human false-positive half of class A is still unmeasured, and a human arm is what would promote it.',
  },
  {
    id: 'chat.over_completeness',
    label: 'Answers too completely',
    labelZh: '回答过度完整',
    severity: 4,
    description:
      'The reply covers every branch of the question, including branches the user did not ask about, instead of answering the one thing asked.',
    detectionHint:
      'Flag enumerated multi-branch answers to a question that named one case, and the "on the other hand" reflex that appends a symmetric counter-case to a settled point.',
    rewriteGuidance:
      'Answer the asked question only. Leave the other branches out. If the user wants more, they will ask.',
    languages: ['zh', 'en', 'unknown'],
    sources: [local('chat.over_completeness')],
    scoring: 'descriptive',
    scoringNote:
      'Demoted from discriminating to descriptive after the length-matched control. The detector fires when a ' +
      'reply runs more than four sentences against a short user turn, and once human and machine replies both ' +
      'have that shape it fires on 75.8% of the human continuations and 75.5% of the machine ones ' +
      '(benchmarks/external/LENGTH_MATCHED.md). It measures shape, not authorship: a reply that answers at ' +
      'length is described, not accused. Still reported, never charged to behaviorScore.',
  },
  {
    id: 'chat.explains_obvious',
    label: 'Explains the obvious',
    labelZh: '解释明显事实',
    severity: 3,
    description:
      'The reply explains something the user evidently already knows, or defines a term the user just used correctly.',
    detectionHint:
      'Flag explanation and definition wording (也就是说/指的是/所谓/简单来说/which means/that is to say). This is a phrase match and nothing more: the detector does not read the conversation, so it cannot tell whether the user already knew the thing being explained — which is the claim the name makes.',
    rewriteGuidance:
      'Assume shared context. Skip the explanation and use the term directly.',
    languages: ['zh', 'en', 'unknown'],
    sources: [local('chat.explains_obvious')],
    scoring: 'deprecated-candidate',
    scoringNote:
      'Construct validity not established, and the evidence is missing rather than merely thin. It fired 0 times in 483 measurements over the committed corpus and 4 times across 8,000 paired continuations, below the floor at which this project classifies a rule; and its implementation is a phrase list that never reads the conversation while its name claims to know what the user already knows. The code stays; the claim does not. See GATE_REVIEW.md.',
  },
  {
    id: 'chat.forced_positivity',
    label: 'Forces a positive tone',
    labelZh: '强制正向语气',
    severity: 3,
    description:
      'The reply inserts encouragement, praise or uplift that the situation does not call for.',
    detectionHint:
      'Flag praise and encouragement formulas (很棒/厉害/加油/你已经做得很好/Great question/That is a great point/You have got this). The list is chosen so that every entry is information-free; nothing checks at run time whether the praise was warranted, and nothing needs to.',
    rewriteGuidance:
      'Drop the praise. If something specific is genuinely good, say the specific thing instead of a generic compliment.',
    languages: ['zh', 'en', 'unknown'],
    sources: [local('chat.forced_positivity')],
  },
  {
    id: 'chat.mechanical_empathy',
    label: 'Performs mechanical empathy',
    labelZh: '机械共情',
    severity: 4,
    description:
      'The reply opens with a formulaic acknowledgement of the user\'s feelings.',
    detectionHint:
      'Flag empathy openers (我理解你的感受/这确实让人很沮丧/听起来你……/I understand how you feel/That sounds really frustrating). It is a phrase match: whether the user disclosed anything is not read, and the status decision records "Context gate required? No", so the name is the only thing claiming the disclosure matters.',
    rewriteGuidance:
      'Remove the formula. Engage the substance directly. Real empathy is specific, not a template.',
    languages: ['zh', 'en', 'unknown'],
    sources: [local('chat.mechanical_empathy')],
  },
  {
    id: 'chat.unrequested_background',
    label: 'Adds unrequested background',
    labelZh: '不必要的背景补充',
    severity: 3,
    description:
      'The reply supplies history, context or caveats the user did not ask for.',
    detectionHint:
      'Flag background inserts (值得一提的是/顺便说一下/需要说明的是/值得注意的是/It is worth noting/Bear in mind that) and any aside that is not load-bearing for the answer. The "unrequested" half is read from `requestKind`, which nothing populates, so in practice this is a phrase match against a gate that is always open.',
    rewriteGuidance:
      'Cut the aside. Keep only what the answer needs to stand up.',
    languages: ['zh', 'en', 'unknown'],
    sources: [local('chat.unrequested_background')],
    scoring: 'shadow',
    scoringNote:
      'Its "unrequested" qualifier is read from `requestKind` through a gate that nothing supplies, so the gate is always true and a missing answer is read as "the user asked for nothing" — the identical defect `chat.unsolicited_advice` had before Phase B gave it a tri-state, in the one rule that still has it. Suspended from behaviorScore. Reported, charged to nothing, and wired to nothing. See GATE_REVIEW.md.',
  },
];

export const ASSISTANT_SMELL_IDS: readonly string[] = ASSISTANT_SMELLS.map((s) => s.id);

export function getAssistantSmell(id: string): AssistantSmell | undefined {
  return ASSISTANT_SMELLS.find((smell) => smell.id === id);
}

/**
 * The conversation a reply sits in.
 *
 * Several smells cannot be judged from the reply alone — mirroring is a
 * relationship between two turns, and over-completeness is a ratio between the
 * question and the answer — so the detector needs the turn before it.
 */
export interface ConversationContext {
  /** The message being replied to. */
  readonly userTurn?: string;
  /** Earlier turns, oldest first, when the caller has them. */
  readonly history?: readonly string[];
  /**
   * Whether the user turn invited advice: `granted`, `absent` or `unknown`.
   *
   * This is the field new code should use. It exists because the list below it
   * cannot express the difference between "the user asked for no advice" and
   * "nobody established whether the user asked for advice", and a rule that
   * cannot tell those apart either accuses or stays silent for the wrong reason.
   *
   * Leave it unset when the caller has no evidence: the default is `unknown`, and
   * `chat.unsolicited_advice` abstains and says so rather than reporting a clean
   * result. See `src/behavior/permission/index.ts`.
   */
  readonly advicePermission?: AdvicePermission;
  /**
   * A reading from the frozen solution-permission layer A v1, when the caller ran
   * it: `HIGH` and `LOW` become `granted` and `absent`, and `MEDIUM` and
   * `UNCERTAIN` become `unknown`. Ignored when `advicePermission` is supplied.
   */
  readonly solutionPermission?: SolutionPermissionReading;
  /**
   * What the user asked for, when it is not obvious from `userTurn`: a
   * classification such as `advice`, `summary`, `definition`.
   *
   * **Legacy, and never evidence of absence.** Listing `advice` here grants
   * advice permission. *Not* listing it grants nothing: the list may have been
   * assembled without anyone analysing the turn, which is exactly what happened on
   * every benchmark this project ran, so a missing `advice` entry resolves to
   * `unknown` and the rule abstains. Use `advicePermission` instead.
   */
  readonly requestKind?: readonly string[];
}

/**
 * What the assistant-smell measurement needs from the conversation.
 *
 * A subset of `ConversationContext`, so the detector and any caller that measures
 * smells directly agree on the shape of the evidence.
 */
export type SmellContext = Pick<
  ConversationContext,
  'userTurn' | 'advicePermission' | 'solutionPermission' | 'requestKind'
>;

/** The behaviour a reply must satisfy in a given mode. */
export interface BehaviourBaselineApplication {
  readonly baselineId: string;
  readonly allowed: readonly string[];
  readonly forbidden: readonly string[];
}

/**
 * A conversation-level behaviour baseline.
 *
 * This is the fast path's payload: for short chat turns the suite applies a
 * baseline plus a voice profile and skips the full detection pipeline.
 */
export interface BehaviorBaseline {
  readonly id: string;
  readonly languages: readonly string[];
  /** Maximum share of the reply that may overlap the user's turn. */
  readonly maxUserOverlapRatio: number;
  /** Maximum number of agreement tokens allowed per reply. */
  readonly maxAgreementTokens: number;
  /** Maximum number of sentences in a "simple" chat answer before it is over-complete. */
  readonly simpleAnswerSentenceBudget: number;
  /** Whether a closing summary paragraph is ever permitted in chat mode. */
  readonly allowClosingSummary: boolean;
  /** Whether an offer of further help is ever permitted in chat mode. */
  readonly allowUnsolicitedOffer: boolean;
  /** Whether a clarifying follow-up question is permitted. */
  readonly allowFollowUpQuestion: boolean;
  readonly forbiddenPatterns: readonly string[];
}
