/**
 * Advice permission: the tri-state contract a context-dependent rule needs.
 *
 * ## The defect this replaces
 *
 * `chat.unsolicited_advice` has always had a permission gate and has never been
 * fed by it. The gate reads `requestKind` — a caller-supplied list of what the
 * user asked for — and applies the rule whenever the list does not contain
 * `advice`.
 *
 * `requestKind` is a list of things the user asked for and the gate tests
 * membership. **Absence therefore means two different things at once**: "the user
 * did not ask for advice" and "nobody analysed the turn, so nobody knows". The
 * second was silently read as the first, on every sample this project ever ran.
 * `RULE_STATUS_DECISION.md` recorded that as an interface design gap and refused
 * to implement the adapter until a state existed that could tell them apart.
 *
 * ## The three states
 *
 * | State | Meaning | The rule |
 * | --- | --- | --- |
 * | `granted` | Evidence that the turn invited advice or a course of action | suppressed |
 * | `absent` | Positive evidence that the turn invited none | runs |
 * | `unknown` | Not enough evidence to decide | **abstains** |
 *
 * `unknown` is the default, and it is not a synonym for `absent`. A rule that
 * abstains says so in the report; a rule that treats "nobody looked" as "the user
 * asked for nothing" accuses a reply of a behaviour nobody checked for.
 *
 * ## Where a state comes from
 *
 * `resolveAdvicePermission` reads evidence in order of strength:
 *
 * 1. an explicit `advicePermission` handed in by the caller;
 * 2. a reading from the frozen solution-permission layer A v1 — see
 *    `benchmarks/external/permission.ts`, whose four states map onto three here;
 * 3. the legacy `requestKind` list, which can only ever say `granted`;
 * 4. nothing, which is `unknown`.
 *
 * Legacy `requestKind` rule, and it is the whole point: **containing `advice`
 * grants; not containing it grants nothing.** A caller that supplied a list of
 * subjects analysed the turn; a caller that supplied nothing did not.
 *
 * ## What this module is not
 *
 * It is not a detector. It reads no text and it contains no patterns: everything
 * that decides a permission state lives in the frozen A v1 layer or in the
 * caller. What lives here is the mapping and the discipline.
 */

/** Whether advice was invited by the user turn. */
export type AdvicePermission = 'granted' | 'absent' | 'unknown';

/** The three states, in the order a report should list them. */
export const ADVICE_PERMISSION_STATES: readonly AdvicePermission[] = [
  'granted',
  'absent',
  'unknown',
];

/**
 * The four states of the frozen solution-permission layer, A v1.
 *
 * Declared structurally rather than imported: A v1 is a research artifact in
 * `benchmarks/`, and the runtime must not depend on the benchmark layer. The
 * equivalence is asserted by `tests/behavior-advice-permission.test.ts`, which
 * imports the real A v1 and checks every one of its states maps as promised.
 */
export type SolutionPermissionLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNCERTAIN';

/** A permission-layer reading: the state plus the signals that produced it. */
export interface SolutionPermissionReading {
  readonly permission: SolutionPermissionLevel;
  /** Which signals fired, so a reader can disagree with the reading. */
  readonly signals?: readonly string[];
}

/** Where the tri-state came from, so a report can show its evidence. */
export type AdvicePermissionSource =
  | 'explicit'
  | 'solution-permission'
  | 'request-kind'
  | 'default';

export interface AdvicePermissionReading {
  readonly advicePermission: AdvicePermission;
  readonly source: AdvicePermissionSource;
  /** The permission-layer signals, when there were any. */
  readonly signals: readonly string[];
  /** One sentence a report can print under the state. */
  readonly note: string;
}

/**
 * The default, and it is `unknown` on purpose.
 *
 * A missing field is not evidence. Any default other than `unknown` would rebuild
 * the defect: `absent` would accuse, and `granted` would silence a rule nobody
 * gave permission to silence.
 */
export const DEFAULT_ADVICE_PERMISSION: AdvicePermission = 'unknown';

const NOTES: Readonly<Record<AdvicePermission, string>> = {
  granted:
    'There is evidence that the user turn invited advice or a course of action, so advice in the reply is not unsolicited.',
  absent:
    'There is positive evidence that the user turn invited no advice, so the lexical detector decides.',
  unknown:
    'No evidence either way about whether advice was invited. The rule abstains rather than reading an unanalysed turn as a turn that asked for nothing.',
};

export function isAdvicePermission(value: unknown): value is AdvicePermission {
  return value === 'granted' || value === 'absent' || value === 'unknown';
}

export function isSolutionPermissionLevel(value: unknown): value is SolutionPermissionLevel {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'UNCERTAIN';
}

/**
 * The A v1 adapter, and the table it implements.
 *
 * | A v1 | `advicePermission` | Why |
 * | --- | --- | --- |
 * | `HIGH` | `granted` | The turn asks for a method, steps, options or help |
 * | `LOW` | `absent` | The turn shares or vents, with positive evidence of that stance |
 * | `MEDIUM` | `unknown` | The turn asks for a judgement, not for a course of action — advice may or may not be welcome, and A v1 does not say |
 * | `UNCERTAIN` | `unknown` | A v1 has no opinion; neither does this |
 *
 * `MEDIUM` and `UNCERTAIN` must never be folded into `absent`. That would rebuild
 * the original error from the other side: a judgement request would be read as a
 * turn that ruled advice out.
 *
 * A v1 is not modified by this adapter and gains no new signals. It is read.
 */
export function advicePermissionFromSolution(
  reading: SolutionPermissionReading | SolutionPermissionLevel,
): AdvicePermissionReading {
  const level = typeof reading === 'string' ? reading : reading.permission;
  const signals =
    typeof reading === 'string'
      ? [`permission:${reading}`]
      : [`permission:${reading.permission}`, ...(reading.signals ?? [])];

  const mapped: AdvicePermission =
    level === 'HIGH' ? 'granted' : level === 'LOW' ? 'absent' : 'unknown';

  return {
    advicePermission: mapped,
    source: 'solution-permission',
    signals,
    note:
      mapped === 'unknown' && level === 'MEDIUM'
        ? 'The turn asks for a judgement rather than a course of action, which is not evidence that advice was invited or that it was ruled out. The rule abstains.'
        : NOTES[mapped],
  };
}

/**
 * The legacy bridge: `requestKind` can grant, and can do nothing else.
 *
 * This is deliberately a one-way mapping. `requestKind: []` is not evidence that
 * the user asked for nothing; it is a list that was supplied and did not mention
 * advice, which is exactly the state that was misread for the whole of this
 * project's measurement history.
 *
 * The field is kept because callers pass it and because a granted reading from it
 * is real evidence. New code should pass `advicePermission` instead.
 */
export function advicePermissionFromRequestKind(
  requestKind: readonly string[] | undefined | null,
): AdvicePermissionReading {
  const kinds = (requestKind ?? []).map((kind) => kind.toLowerCase());
  if (kinds.includes('advice')) {
    return {
      advicePermission: 'granted',
      source: 'request-kind',
      signals: ['request-kind:advice'],
      note: 'The caller listed `advice` among what the user asked for, so advice in the reply is not unsolicited.',
    };
  }
  return {
    advicePermission: 'unknown',
    source: 'request-kind',
    signals: ['request-kind:no-advice', 'request-kind:not-permission-evidence'],
    note:
      '`requestKind` was supplied and does not list `advice`. That is not evidence that the user asked for nothing — it may mean nobody analysed the turn — so the rule abstains.',
  };
}

export interface AdvicePermissionInput {
  /** The explicit tri-state. Wins over everything else when present. */
  readonly advicePermission?: AdvicePermission;
  /** A reading from the frozen solution-permission layer A v1. */
  readonly solutionPermission?: SolutionPermissionReading;
  /**
   * Legacy: what the caller says the user asked for.
   *
   * Kept for compatibility. It can only ever produce `granted`; every other value
   * resolves as if it were not supplied.
   */
  readonly requestKind?: readonly string[];
}

/**
 * Read the advice permission out of whatever the caller supplied.
 *
 * Never throws and never guesses: the weakest branch returns `unknown`.
 */
export function resolveAdvicePermission(
  input: AdvicePermissionInput = {},
): AdvicePermissionReading {
  if (isAdvicePermission(input.advicePermission)) {
    return {
      advicePermission: input.advicePermission,
      source: 'explicit',
      signals: [`explicit:${input.advicePermission}`],
      note: NOTES[input.advicePermission],
    };
  }

  // A caller that handed in something else under that name gets no credit for it:
  // an unrecognised value is a missing value, not a permission.
  if (input.solutionPermission !== undefined && isSolutionPermissionLevel(input.solutionPermission.permission)) {
    return advicePermissionFromSolution(input.solutionPermission);
  }

  if (input.requestKind !== undefined) {
    return advicePermissionFromRequestKind(input.requestKind);
  }

  return {
    advicePermission: DEFAULT_ADVICE_PERMISSION,
    source: 'default',
    signals: ['default:no-permission-evidence'],
    note: NOTES[DEFAULT_ADVICE_PERMISSION],
  };
}

/**
 * One line describing what the gate did, for a report.
 *
 * Worded so that `abstained` cannot be read as `clean`: the three outcomes are
 * three sentences, not one sentence and two silences.
 */
export function describeAdvicePermission(reading: AdvicePermissionReading): string {
  switch (reading.advicePermission) {
    case 'granted':
      return 'advice permission granted: the rule is suppressed for this reply';
    case 'absent':
      return 'advice permission absent: the lexical detector is allowed to decide';
    case 'unknown':
      return 'advice permission unknown: the rule abstains, which is not a negative result';
  }
}

/** Every rule in the taxonomy whose verdict depends on an advice permission state. */
export const ADVICE_PERMISSION_DEPENDENT_RULES: readonly string[] = ['chat.unsolicited_advice'];
