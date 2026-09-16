/**
 * The assistant-smell detector.
 *
 * Ten behaviours, and the reason this project is more than an aggregator. A
 * reply can be lexically casual — no AI vocabulary, no em dash, no bold — and
 * still be unmistakably an assistant, because it mirrors, agrees, summarises,
 * offers help and explains what nobody asked about.
 *
 * Three things shape the implementation.
 *
 * **Most of the ten need the turn before them.** Mirroring is a relationship
 * between two turns. Over-completeness is a ratio between the question and the
 * answer. Unsolicited advice is advice where none was wanted. Without a
 * conversation context the detector reports what it can justify and says what it
 * could not judge, rather than guessing from the reply alone.
 *
 * **Position turns a marker into a tell.** 确实 is how people agree. 确实 as an
 * opener followed by a restatement is the tell. Markers flagged `needsPosition`
 * count only at the start of the reply or of a sentence.
 *
 * **A few are not lexical at all.** Mirroring is measured as overlap between the
 * reply's opening and the user's turn; over-completeness as the reply's size
 * against the question's. Those are computed, not matched.
 */

import { splitSentences, tokenize } from '../../shared/text.js';
import type { Detector, DetectionContext, Finding, FindingEvidence } from '../../detector/types.js';
import { LOCAL_UPSTREAM } from '../../rules/provenance/types.js';
import { ASSISTANT_SMELLS, getAssistantSmell } from '../types.js';
import type { AssistantSmellId, SmellContext } from '../types.js';
import { describeAdvicePermission, resolveAdvicePermission } from '../permission/index.js';
import type { AdvicePermissionReading } from '../permission/index.js';
import { SMELL_MARKERS } from './markers.js';
import type { SmellMarker } from './markers.js';

export const AREA = 'behavior.assistant-smell';
export const TARGET_PHASE = 5;

/** Fraction of the reply's opening that may restate the user turn. */
export const MIRROR_OVERLAP_LIMIT = 0.6;

/**
 * How much of the *turn* the reply's opening must account for, before the overlap
 * above counts as mirroring.
 *
 * Both conditions are needed, and the second was missing until a measurement on real
 * human text showed why. The first asks what share of the reply's opening appears in
 * the turn; on its own that is one-sided, because a long turn contains almost
 * everything. A forum topic of two hundred words shares vocabulary with any reply
 * about it, so the first ratio is high for a reason that has nothing to do with
 * restating — 23 of 263 genuine human turn pairs were flagged that way, against 1
 * of 14 model-generated ones, which is the wrong way round for a rule about
 * assistant behaviour.
 *
 * Mirroring means the reply duplicates **the turn**, so the overlap has to be a
 * large share of the turn as well. That is only possible when the turn is short,
 * which is exactly the chat case the rule is for.
 */
export const MIRROR_TURN_COVERAGE = 0.5;

/** Reply sentences allowed per sentence of the user's turn. */
export const COMPLETENESS_SENTENCE_RATIO = 3;

/** Reply sentences in an answer to a short question before it is over-complete. */
export const SIMPLE_ANSWER_SENTENCE_BUDGET = 4;

const WORD_CHARACTER = /[A-Za-z0-9\u4e00-\u9fff]/;

function isMostlyCjk(text: string): boolean {
  let cjk = 0;
  let total = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    total += 1;
    if (ch.codePointAt(0)! >= 0x3000) cjk += 1;
  }
  return total > 0 && cjk / total >= 0.3;
}

function escapeLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface CompiledMarker {
  readonly marker: SmellMarker;
  readonly regex: RegExp;
}

/**
 * Build a marker's matcher.
 *
 * Latin markers are word-bounded and Chinese ones are not, for the same reason
 * the lexical detector does it: Chinese has no word boundaries, and a blanket
 * `\b` never matches after a marker that ends in punctuation.
 */
function compileMarker(marker: SmellMarker): CompiledMarker {
  const cjk = isMostlyCjk(marker.text);
  const escaped = escapeLiteral(marker.text.trim());
  if (cjk) return { marker, regex: new RegExp(`(?:${escaped})`, 'gu') };
  const startsWord = /^\w/.test(marker.text);
  const endsWord = /\w$/.test(marker.text);
  return {
    marker,
    regex: new RegExp(`${startsWord ? '\\b' : ''}(?:${escaped})${endsWord ? '\\b' : ''}`, 'giu'),
  };
}

const compiledCache = new Map<string, readonly CompiledMarker[]>();

function compiledFor(smellId: AssistantSmellId): readonly CompiledMarker[] {
  const cached = compiledCache.get(smellId);
  if (cached) return cached;
  const built = SMELL_MARKERS[smellId].map(compileMarker);
  compiledCache.set(smellId, built);
  return built;
}

interface Span {
  readonly text: string;
  readonly start: number;
  readonly end: number;
}

/**
 * Sentence offsets, so evidence points at a real span.
 *
 * Exported because the paired-control report has to count sentences the same way this
 * module does: a diagnostic that re-implements the split would be measuring its own
 * definition of a sentence, not the one the rules use.
 */
export function sentenceSpans(text: string): Span[] {
  const out: Span[] = [];
  let cursor = 0;
  for (const sentence of splitSentences(text)) {
    const start = text.indexOf(sentence, cursor);
    out.push({ text: sentence, start, end: start + sentence.length });
    cursor = start + sentence.length;
  }
  return out;
}

/** Content words, which is what a restatement shares. */
function contentTokens(text: string): Set<string> {
  return new Set(
    tokenize(text).filter((token) => token.length > 1 && WORD_CHARACTER.test(token)),
  );
}

export interface MeasuredSmell {
  readonly id: AssistantSmellId;
  readonly severity: number;
  readonly message: string;
  readonly evidence: readonly FindingEvidence[];
  readonly confidence: number;
}

/**
 * A rule that was evaluated and declined to decide.
 *
 * This is a third outcome, and the reason the measurement is an object rather
 * than an array of firings. `chat.unsolicited_advice` cannot be judged when the
 * advice permission is unknown, and "I could not tell" must not be stored as the
 * same thing as "I looked and there was nothing" — a report that folded them
 * together would print an abstention as a clean result, which is the defect this
 * whole layer exists to remove.
 */
export interface SmellAbstention {
  readonly id: AssistantSmellId;
  readonly reason: string;
  /** The permission state that caused it: `unknown`. */
  readonly state: string;
  /** Where that state came from. */
  readonly source: string;
  /** The signals behind the state, when the permission layer reported any. */
  readonly signals: readonly string[];
}

/**
 * A rule that was not evaluated because the evidence ruled it out for this reply.
 *
 * `granted` advice suppresses `chat.unsolicited_advice`. That is a decision with a
 * reason, and it is reported: a suppression is not a "no match" and a report that
 * printed one as the other would understate how often the gate decided anything.
 */
export interface SmellSuppression {
  readonly id: AssistantSmellId;
  readonly reason: string;
  readonly state: string;
  readonly source: string;
  readonly signals: readonly string[];
}

/** Everything one reply measured, including the rules that declined to decide. */
export interface SmellMeasurement {
  readonly smells: readonly MeasuredSmell[];
  readonly abstained: readonly SmellAbstention[];
  readonly suppressed: readonly SmellSuppression[];
}

interface MarkerHit {
  readonly evidence: FindingEvidence;
  readonly marker: SmellMarker;
}

/** Clause boundaries: where a marker counts as an opening rather than mid-flow. */
const CLAUSE_BOUNDARY = /[.!?\u3002\uff01\uff1f,\uff0c;\uff1b:\uff1a\u2014\n]/;

/** Marker matches, with the position rule applied. */
function markerHits(
  text: string,
  markers: readonly CompiledMarker[],
  language: string,
): MarkerHit[] {
  const hits: MarkerHit[] = [];

  // Positions that count as an opening: the start of the text, and the start of
  // each clause.
  //
  // Clauses, not just sentences. The flagship case is 哈哈，确实挺离谱的！ — the
  // agreement token follows a comma, and a sentence-only rule would miss exactly
  // the text this detector exists to catch.
  const openings = new Set<number>([0]);
  for (let i = 0; i < text.length; i += 1) {
    if (!CLAUSE_BOUNDARY.test(text.charAt(i))) continue;
    let cursor = i + 1;
    while (cursor < text.length && /\s/.test(text.charAt(cursor))) cursor += 1;
    openings.add(cursor);
  }

  for (const { marker, regex } of markers) {
    if (!marker.languages.includes(language) && !marker.languages.includes('unknown')) continue;
    const scanner = new RegExp(regex.source, regex.flags);
    let match: RegExpExecArray | null;
    while ((match = scanner.exec(text)) !== null) {
      const at = match.index;
      if (!marker.needsPosition || openings.has(at)) {
        hits.push({
          marker,
          evidence: { start: at, end: at + match[0].length, text: match[0] },
        });
      }
      if (scanner.lastIndex === at) scanner.lastIndex += 1;
    }
  }
  return hits;
}

/**
 * Every smell this reply commits, given the conversation around it.
 *
 * Exported on its own so the behaviour engine and the benchmark can call it
 * without going through the detector interface.
 */
export function measureSmells(reply: string, context: SmellContext = {}): MeasuredSmell[] {
  return [...measureSmellsDetailed(reply, context).smells];
}

/**
 * The same measurement, with the rules that abstained or were suppressed.
 *
 * `measureSmells` is this function's `smells`, unchanged, so every existing
 * caller keeps its shape. The two extra lists are the part that used to be
 * invisible: which rules could not be judged, and which were ruled out.
 */
export function measureSmellsDetailed(reply: string, context: SmellContext = {}): SmellMeasurement {
  const measured: MeasuredSmell[] = [];
  const abstained: SmellAbstention[] = [];
  const suppressed: SmellSuppression[] = [];
  const language = isMostlyCjk(reply) ? 'zh' : 'en';
  const replySentences = sentenceSpans(reply);
  const requested = new Set((context.requestKind ?? []).map((kind) => kind.toLowerCase()));
  /**
   * The request-scope gate, and it is **not wired**.
   *
   * `requestKind` is the only input this reads, and nothing in this project populates it: the benchmark
   * harness passes a user turn and nothing else, the corpus front matter has no field for it, and the DSH
   * tool only forwards it when the calling agent chooses to send one. So the gate is always true, and the
   * absence of `background` in a list nobody wrote is read as "the user did not ask for background" — the
   * same defect `chat.unsolicited_advice` had before it was given a tri-state, still present in the rule
   * that has it.
   *
   * `chat.unrequested_background` is `shadow` because of this: reported, charged to nothing. The function
   * exists rather than being inlined so that the defect is a named thing in the code and so that
   * `tests/rule-status-consistency.test.ts` can fail when a **scored** rule starts using it. Wiring it
   * means giving this rule the input the gate is asking for — the same tri-state treatment the advice rule
   * got — and that is a change with a score diff, not a repair to make quietly.
   */
  const unwiredRequestGate = (scope: string): boolean => !requested.has(scope);
  const advice = resolveAdvicePermission({
    ...(context.advicePermission !== undefined
      ? { advicePermission: context.advicePermission }
      : {}),
    ...(context.solutionPermission !== undefined
      ? { solutionPermission: context.solutionPermission }
      : {}),
    ...(context.requestKind !== undefined ? { requestKind: context.requestKind } : {}),
  });

  const push = (
    id: AssistantSmellId,
    message: string,
    evidence: FindingEvidence[],
    confidence: number,
  ): void => {
    const smell = getAssistantSmell(id);
    if (!smell) return;
    measured.push({ id, severity: smell.severity, message, evidence, confidence });
  };

  const hitsFor = (id: AssistantSmellId): MarkerHit[] =>
    markerHits(reply, compiledFor(id), language);

  const hold = (id: AssistantSmellId, reading: AdvicePermissionReading): {
    reason: string;
    state: string;
    source: string;
    signals: readonly string[];
  } => ({
    reason: `${describeAdvicePermission(reading)}. ${reading.note}`,
    state: reading.advicePermission,
    source: reading.source,
    signals: reading.signals,
  });

  // ---- 1. mirroring the user, measured as overlap --------------------------
  if (context.userTurn !== undefined) {
    const userTokens = contentTokens(context.userTurn);
    if (userTokens.size >= 3 && replySentences.length > 0) {
      const opening = replySentences
        .slice(0, 2)
        .map((span) => span.text)
        .join(' ');
      const openingTokens = [...contentTokens(opening)];
      const shared = openingTokens.filter((token) => userTokens.has(token));
      const ratio = openingTokens.length === 0 ? 0 : shared.length / openingTokens.length;
      // Both shares, because either one alone is satisfied for the wrong reason:
      // see MIRROR_TURN_COVERAGE.
      const coverage = userTokens.size === 0 ? 0 : shared.length / userTokens.size;
      if (ratio >= MIRROR_OVERLAP_LIMIT && coverage >= MIRROR_TURN_COVERAGE) {
        push(
          'chat.mirrors_user',
          `The opening shares ${shared.length} of ${openingTokens.length} content word(s) with the user turn ` +
            `and accounts for ${(coverage * 100).toFixed(0)}% of it, so it restates rather than responds.`,
          replySentences.slice(0, 2).map((span) => ({
            start: span.start,
            end: span.end,
            text: span.text,
          })),
          0.7,
        );
      }
    }
  }
  if (!measured.some((entry) => entry.id === 'chat.mirrors_user')) {
    const mirrorMarkers = hitsFor('chat.mirrors_user');
    if (mirrorMarkers.length > 0) {
      push(
        'chat.mirrors_user',
        `The reply opens by restating the user's turn: ${mirrorMarkers.map((h) => h.evidence.text).join(', ')}.`,
        mirrorMarkers.slice(0, 3).map((h) => h.evidence),
        0.75,
      );
    }
  }

  // ---- 2. reflexive agreement ----------------------------------------------
  const agreement = hitsFor('chat.over_agreement');
  if (agreement.length > 0) {
    push(
      'chat.over_agreement',
      `Reflexive agreement: ${[...new Set(agreement.map((h) => h.evidence.text))].join(', ')}.`,
      agreement.slice(0, 4).map((h) => h.evidence),
      0.65,
    );
  }

  // ---- 3. unsolicited advice ------------------------------------------------
  //
  // The gate is a three-way decision, not a membership test. `granted` means the
  // user invited advice, so there is nothing unsolicited to find. `absent` means
  // there is positive evidence the turn invited none, so the lexical detector
  // decides. `unknown` means nobody can say, and the rule abstains — the state
  // that used to be spelled "not in `requestKind`" and read as `absent` on every
  // sample this project ever measured. See `../permission/index.ts`.
  if (advice.advicePermission === 'absent') {
    const adviceHits = hitsFor('chat.unsolicited_advice');
    if (adviceHits.length > 0) {
      push(
        'chat.unsolicited_advice',
        `Advice the user did not ask for: ${[...new Set(adviceHits.map((h) => h.evidence.text))].join(', ')}.`,
        adviceHits.slice(0, 4).map((h) => h.evidence),
        0.7,
      );
    }
  } else if (advice.advicePermission === 'granted') {
    suppressed.push({ id: 'chat.unsolicited_advice', ...hold('chat.unsolicited_advice', advice) });
  } else {
    abstained.push({ id: 'chat.unsolicited_advice', ...hold('chat.unsolicited_advice', advice) });
  }

  // ---- 4. automatic summary --------------------------------------------------
  const summary = hitsFor('chat.auto_summary');
  if (summary.length > 0) {
    push(
      'chat.auto_summary',
      `Closing summary formula: ${[...new Set(summary.map((h) => h.evidence.text))].join(', ')}.`,
      summary.slice(0, 3).map((h) => h.evidence),
      0.8,
    );
  }

  // ---- 5. offering more help --------------------------------------------------
  const offer = hitsFor('chat.unsolicited_offer');
  if (offer.length > 0) {
    push(
      'chat.unsolicited_offer',
      `Offers further help: ${[...new Set(offer.map((h) => h.evidence.text))].join(', ')}.`,
      offer.slice(0, 3).map((h) => h.evidence),
      0.85,
    );
  }

  // ---- 6. over-completeness, measured as a ratio ------------------------------
  if (context.userTurn !== undefined && replySentences.length > 0) {
    const userSentences = Math.max(1, sentenceSpans(context.userTurn).length);
    const ratio = replySentences.length / userSentences;
    if (
      context.userTurn.trim().length <= 120 &&
      replySentences.length > SIMPLE_ANSWER_SENTENCE_BUDGET &&
      ratio >= COMPLETENESS_SENTENCE_RATIO
    ) {
      push(
        'chat.over_completeness',
        `${replySentences.length} sentences answering ${userSentences}, a ratio of ${ratio.toFixed(1)}. A question that short does not need an answer that long.`,
        replySentences.slice(0, 2).map((span) => ({
          start: span.start,
          end: span.end,
          text: span.text,
        })),
        0.7,
      );
    }
  }

  // ---- 7. explaining the obvious ------------------------------------------------
  const explaining = hitsFor('chat.explains_obvious');
  if (explaining.length > 0) {
    push(
      'chat.explains_obvious',
      `Explains rather than answers: ${[...new Set(explaining.map((h) => h.evidence.text))].join(', ')}.`,
      explaining.slice(0, 3).map((h) => h.evidence),
      0.55,
    );
  }

  // ---- 8. forced positivity -------------------------------------------------------
  const praise = hitsFor('chat.forced_positivity');
  if (praise.length > 0) {
    push(
      'chat.forced_positivity',
      `Praise that carries no information: ${[...new Set(praise.map((h) => h.evidence.text))].join(', ')}.`,
      praise.slice(0, 3).map((h) => h.evidence),
      0.7,
    );
  }

  // ---- 9. mechanical empathy -------------------------------------------------------
  const empathy = hitsFor('chat.mechanical_empathy');
  if (empathy.length > 0) {
    push(
      'chat.mechanical_empathy',
      `Formulaic acknowledgement: ${[...new Set(empathy.map((h) => h.evidence.text))].join(', ')}.`,
      empathy.slice(0, 3).map((h) => h.evidence),
      0.8,
    );
  }

  // ---- 10. background nobody asked for -----------------------------------------------
  const background = hitsFor('chat.unrequested_background');
  if (background.length > 0 && unwiredRequestGate('background')) {
    push(
      'chat.unrequested_background',
      `Background the user did not ask for: ${[...new Set(background.map((h) => h.evidence.text))].join(', ')}.`,
      background.slice(0, 3).map((h) => h.evidence),
      0.65,
    );
  }

  return { smells: measured, abstained, suppressed };
}

/**
 * What the detector could not judge, so a thin result is explained rather than
 * mistaken for a clean one.
 *
 * Two different reasons live here, and they are kept apart. `chat.mirrors_user`
 * and `chat.over_completeness` are relationships to a turn nobody supplied;
 * `chat.unsolicited_advice` is a permission nobody established. The first is a
 * missing input, the second is a state the rule can name.
 */
export function unjudgedSmells(context: SmellContext): AssistantSmellId[] {
  return context.userTurn === undefined
    ? ['chat.mirrors_user', 'chat.over_completeness']
    : [];
}

/**
 * The rules that abstained for this context.
 *
 * Derived from the same resolver the detector uses rather than from a second copy
 * of the rule, so the report and the measurement cannot disagree.
 * `tests/behavior-advice-permission.test.ts` asserts the two agree.
 */
export function abstainedSmells(context: SmellContext = {}): AssistantSmellId[] {
  const advice = resolveAdvicePermission({
    ...(context.advicePermission !== undefined
      ? { advicePermission: context.advicePermission }
      : {}),
    ...(context.solutionPermission !== undefined
      ? { solutionPermission: context.solutionPermission }
      : {}),
    ...(context.requestKind !== undefined ? { requestKind: context.requestKind } : {}),
  });
  return advice.advicePermission === 'unknown' ? ['chat.unsolicited_advice'] : [];
}

/** The rules this context ruled out before they were evaluated. */
export function suppressedSmells(context: SmellContext = {}): AssistantSmellId[] {
  const advice = resolveAdvicePermission({
    ...(context.advicePermission !== undefined
      ? { advicePermission: context.advicePermission }
      : {}),
    ...(context.solutionPermission !== undefined
      ? { solutionPermission: context.solutionPermission }
      : {}),
    ...(context.requestKind !== undefined ? { requestKind: context.requestKind } : {}),
  });
  return advice.advicePermission === 'granted' ? ['chat.unsolicited_advice'] : [];
}

export function createAssistantSmellDetector(): Detector {
  return {
    id: 'assistant.smells',
    upstream: LOCAL_UPSTREAM,
    family: 'assistant',
    languages: ['en', 'zh', 'unknown'],
    status: 'ready',
    description:
      'The ten chat behaviours: mirroring, over-agreement, unsolicited advice, auto summary, unsolicited offers, over-completeness, explaining the obvious, forced positivity, mechanical empathy and unrequested background.',
    detect(text: string, context: DetectionContext): Finding[] {
      const conversation = context.conversation;
      const measured = measureSmells(text, {
        ...(conversation?.userTurn !== undefined ? { userTurn: conversation.userTurn } : {}),
        ...(conversation?.advicePermission !== undefined
          ? { advicePermission: conversation.advicePermission }
          : {}),
        ...(conversation?.solutionPermission !== undefined
          ? { solutionPermission: conversation.solutionPermission }
          : {}),
        ...(conversation?.requestKind !== undefined
          ? { requestKind: conversation.requestKind }
          : {}),
      });

      return measured.map((smell) => {
        const smellSpec = getAssistantSmell(smell.id);
        return {
          ruleId: smell.id,
          canonicalRuleId: smell.id,
          upstream: LOCAL_UPSTREAM,
          detectorId: 'assistant.smells',
          category: 'chat',
          family: 'assistant' as const,
          severity: smell.severity,
          languages: smellSpec ? [...smellSpec.languages] : ['en', 'zh'],
          message: smell.message,
          evidence: smell.evidence,
          confidence: smell.confidence,
        };
      });
    },
  };
}

/** The ten smells, for a caller that wants the taxonomy and not the detector. */
export function smellIds(): AssistantSmellId[] {
  return ASSISTANT_SMELLS.map((smell) => smell.id);
}
