/**
 * Advice permission: the tri-state interface, and the six integration cases the
 * rule status decision asked for.
 *
 * `chat.unsolicited_advice` has a permission gate and, for the whole of this
 * project's measurement history, nothing fed it. `requestKind` is a list of what
 * the user asked for and the gate tested membership, so **absence meant two things
 * at once**: "the user did not ask for advice" and "nobody analysed the turn".
 * Every published rate for the rule describes it with that ambiguity in place.
 *
 * These tests pin the replacement: three states, an adapter from the frozen
 * solution-permission layer, and an abstention that is structurally different from
 * a negative result.
 *
 * The A v1 cases import the real layer from `benchmarks/external/permission.ts`
 * rather than restating its mapping, so an adapter that drifts from the frozen
 * layer fails here.
 */

import { describe, expect, it } from 'vitest';

import {
  measureSmells,
  measureSmellsDetailed,
  abstainedSmells,
  suppressedSmells,
} from '../src/behavior/assistant-smell/index.js';
import { assessBehavior, abstainedBehaviors } from '../src/validation/behavior/index.js';
import {
  advicePermissionFromRequestKind,
  advicePermissionFromSolution,
  isAdvicePermission,
  resolveAdvicePermission,
} from '../src/behavior/permission/index.js';
import type { AdvicePermission } from '../src/behavior/permission/index.js';
import { scan } from '../src/detector/scan.js';
import { createAssistantSmellDetector } from '../src/behavior/assistant-smell/index.js';
import {
  permissionOf,
  type Permission,
} from '../benchmarks/external/permission.js';

/** A reply that carries a watched advice phrase, and nothing else notable. */
const ADVICE_REPLY = '建议你先把日志按天切开，再给关键目录留三成余量。';

/** The same reply with no advice phrase in it. */
const PLAIN_REPLY = '日志昨天就切过了，磁盘现在还有三成余量。';

describe('the tri-state', () => {
  it('defaults to unknown, because a missing field is not evidence', () => {
    expect(resolveAdvicePermission({}).advicePermission).toBe('unknown');
    expect(resolveAdvicePermission({}).source).toBe('default');
    expect(isAdvicePermission('unknown')).toBe(true);
    expect(isAdvicePermission('absent ')).toBe(false);
    expect(isAdvicePermission(undefined)).toBe(false);
  });

  it('does not accept an unrecognised value as a state', () => {
    // A malformed argument must not become `absent`, which would accuse a reply of
    // advice nobody ruled out.
    const reading = resolveAdvicePermission({
      advicePermission: 'ABSENT' as unknown as AdvicePermission,
    });
    expect(reading.advicePermission).toBe('unknown');
    expect(reading.source).toBe('default');
  });

  it('keeps granted, absent and unknown distinct through the resolver', () => {
    for (const state of ['granted', 'absent', 'unknown'] as const) {
      expect(resolveAdvicePermission({ advicePermission: state }).advicePermission).toBe(state);
    }
  });
});

describe('the A v1 adapter', () => {
  it('maps the frozen layer: HIGH grants, LOW is absent, MEDIUM and UNCERTAIN abstain', () => {
    expect(advicePermissionFromSolution('HIGH').advicePermission).toBe('granted');
    expect(advicePermissionFromSolution('LOW').advicePermission).toBe('absent');
    // Neither of these may be folded into `absent`: a judgement request is not a
    // turn that ruled advice out.
    expect(advicePermissionFromSolution('MEDIUM').advicePermission).toBe('unknown');
    expect(advicePermissionFromSolution('UNCERTAIN').advicePermission).toBe('unknown');
  });

  it('covers every state the frozen layer can produce', () => {
    const levels: readonly Permission[] = ['LOW', 'MEDIUM', 'HIGH', 'UNCERTAIN'];
    for (const level of levels) {
      const reading = advicePermissionFromSolution({ permission: level });
      expect(['granted', 'absent', 'unknown']).toContain(reading.advicePermission);
      expect(reading.signals).toContain(`permission:${level}`);
    }
  });

  it('reads the published state all three ways', () => {
    // These are A v1's own readings of these turns, not this test's opinion of them.
    expect(permissionOf({ userTurn: '你说我该怎么办' }).permission).toBe('HIGH');
    expect(permissionOf({ userTurn: '今天真是够够的。' }).permission).toBe('LOW');
    expect(permissionOf({ userTurn: '你觉得这事离谱吗' }).permission).toBe('MEDIUM');
    expect(permissionOf({ userTurn: '嗯嗯' }).permission).toBe('UNCERTAIN');
  });
});

describe('the legacy requestKind bridge', () => {
  it('lets a listed `advice` grant permission', () => {
    expect(advicePermissionFromRequestKind(['advice']).advicePermission).toBe('granted');
    expect(advicePermissionFromRequestKind(['Advice']).advicePermission).toBe('granted');
  });

  it('never turns a missing `advice` entry into absence', () => {
    for (const kinds of [[], ['summary'], ['definition'], ['background']] as const) {
      const reading = advicePermissionFromRequestKind([...kinds]);
      expect(reading.advicePermission).toBe('unknown');
      expect(reading.advicePermission).not.toBe('absent');
    }
  });

  it('grants through the resolver and abstains otherwise', () => {
    expect(resolveAdvicePermission({ requestKind: ['advice'] }).advicePermission).toBe('granted');
    expect(resolveAdvicePermission({ requestKind: [] }).advicePermission).toBe('unknown');
  });

  it('lets an explicit state override the legacy list in both directions', () => {
    expect(
      resolveAdvicePermission({ advicePermission: 'absent', requestKind: ['advice'] }).advicePermission,
    ).toBe('absent');
    expect(
      resolveAdvicePermission({ advicePermission: 'granted', requestKind: [] }).advicePermission,
    ).toBe('granted');
  });
});

describe('the six integration cases', () => {
  it('1. the same reply with advicePermission=granted does not fire', () => {
    const measured = measureSmells(ADVICE_REPLY, {
      userTurn: '你说我该怎么办',
      advicePermission: 'granted',
    });
    expect(measured.map((smell) => smell.id)).not.toContain('chat.unsolicited_advice');
  });

  it('2. the same reply with advicePermission=absent may fire', () => {
    const measured = measureSmells(ADVICE_REPLY, {
      userTurn: '今天真是够够的。',
      advicePermission: 'absent',
    });
    expect(measured.map((smell) => smell.id)).toContain('chat.unsolicited_advice');
  });

  it('3. permission A v1 HIGH reaches the gate as granted', () => {
    const userTurn = '你说我该怎么办';
    const reading = permissionOf({ userTurn });
    expect(reading.permission).toBe('HIGH');

    const measured = measureSmells(ADVICE_REPLY, { userTurn, solutionPermission: reading });
    expect(measured.map((smell) => smell.id)).not.toContain('chat.unsolicited_advice');
    expect(suppressedSmells({ userTurn, solutionPermission: reading })).toEqual([
      'chat.unsolicited_advice',
    ]);
  });

  it('4. permission A v1 LOW reaches the gate as absent', () => {
    const userTurn = '今天真是够够的。';
    const reading = permissionOf({ userTurn });
    expect(reading.permission).toBe('LOW');

    const measured = measureSmells(ADVICE_REPLY, { userTurn, solutionPermission: reading });
    expect(measured.map((smell) => smell.id)).toContain('chat.unsolicited_advice');
    expect(abstainedSmells({ userTurn, solutionPermission: reading })).toEqual([]);
  });

  it('5. permission A v1 MEDIUM and UNCERTAIN reach the gate as unknown, and it abstains', () => {
    for (const userTurn of ['你觉得这事离谱吗', '嗯嗯']) {
      const reading = permissionOf({ userTurn });
      expect(['MEDIUM', 'UNCERTAIN']).toContain(reading.permission);

      const measured = measureSmellsDetailed(ADVICE_REPLY, { userTurn, solutionPermission: reading });
      expect(measured.smells.map((smell) => smell.id)).not.toContain('chat.unsolicited_advice');

      const abstention = measured.abstained.find((entry) => entry.id === 'chat.unsolicited_advice');
      expect(abstention).toBeDefined();
      expect(abstention?.state).toBe('unknown');
      expect(abstention?.source).toBe('solution-permission');
      expect(abstention?.reason).toMatch(/abstains/);

      // And the report says the same thing the detector did.
      expect(abstainedSmells({ userTurn, solutionPermission: reading })).toEqual([
        'chat.unsolicited_advice',
      ]);
    }
  });

  it('6. no context at all abstains, and does not fall back to the old unsolicited default', () => {
    // This is the behaviour that changed. Before the tri-state, a reply carrying an
    // advice phrase with no permission evidence fired the rule against every sample
    // this project ever measured.
    const measured = measureSmellsDetailed(ADVICE_REPLY);
    expect(measured.smells.map((smell) => smell.id)).not.toContain('chat.unsolicited_advice');
    expect(measured.abstained.map((entry) => entry.id)).toEqual(['chat.unsolicited_advice']);
    expect(measured.abstained[0]?.state).toBe('unknown');

    // A user turn on its own is still no permission evidence: the turn does not say
    // whether advice was invited, and nobody read it to find out.
    const withTurn = measureSmellsDetailed(ADVICE_REPLY, { userTurn: '日志满了' });
    expect(withTurn.smells.map((smell) => smell.id)).not.toContain('chat.unsolicited_advice');
    expect(withTurn.abstained.map((entry) => entry.id)).toEqual(['chat.unsolicited_advice']);
  });

  it('7. legacy requestKind=[] is not read as absence', () => {
    const measured = measureSmellsDetailed(ADVICE_REPLY, { requestKind: [] });
    expect(measured.smells.map((smell) => smell.id)).not.toContain('chat.unsolicited_advice');
    expect(measured.abstained.map((entry) => entry.id)).toEqual(['chat.unsolicited_advice']);
    expect(measured.suppressed).toEqual([]);

    // Unless the caller supplies absence as evidence in its own right.
    const withEvidence = measureSmells(ADVICE_REPLY, {
      requestKind: [],
      advicePermission: 'absent',
    });
    expect(withEvidence.map((smell) => smell.id)).toContain('chat.unsolicited_advice');
  });
});

describe('abstention is not a negative result', () => {
  it('distinguishes "not evaluated" from "evaluated and found nothing"', () => {
    // Same finding list, different state. The data says which one happened.
    const undecided = measureSmellsDetailed(PLAIN_REPLY);
    const decided = measureSmellsDetailed(PLAIN_REPLY, { advicePermission: 'absent' });

    expect(undecided.smells).toEqual(decided.smells);
    expect(undecided.abstained.map((entry) => entry.id)).toEqual(['chat.unsolicited_advice']);
    expect(decided.abstained).toEqual([]);
  });

  it('distinguishes a suppression from a no-match', () => {
    const granted = measureSmellsDetailed(PLAIN_REPLY, { advicePermission: 'granted' });
    expect(granted.smells).toEqual([]);
    // The rule did not look, and the report says so rather than reporting silence.
    expect(granted.suppressed.map((entry) => entry.id)).toEqual(['chat.unsolicited_advice']);
    expect(granted.suppressed[0]?.state).toBe('granted');
  });

  it('reports the abstention in the score rationale, with the state that caused it', () => {
    const assessment = assessBehavior([], { userTurn: '日志满了' });
    expect(assessment.abstained.map((entry) => entry.ruleId)).toEqual(['chat.unsolicited_advice']);
    expect(assessment.abstained[0]?.outcome).toBe('abstained');
    expect(assessment.rationale.abstained?.[0]?.label).toBe('chat.unsolicited_advice');
    expect(assessment.rationale.abstained?.[0]?.state).toBe('unknown');
    expect(assessment.rationale.summary).toMatch(/chat\.unsolicited_advice abstained on unknown/);
    // A rule that abstained was not judged, and the count must not claim it was:
    // nine of ten here, because the user turn is present and the permission is not.
    expect(assessment.judgedCount).toBe(9);
  });

  it('counts the rule as judged once the permission is known', () => {
    const absent = assessBehavior([], { userTurn: '日志满了', advicePermission: 'absent' });
    expect(absent.abstained).toEqual([]);
    expect(absent.judgedCount).toBe(10);
    expect(absent.rationale.abstained).toBeUndefined();

    const granted = assessBehavior([], { userTurn: '日志满了', advicePermission: 'granted' });
    expect(granted.suppressed.map((entry) => entry.ruleId)).toEqual(['chat.unsolicited_advice']);
    expect(granted.rationale.suppressed?.[0]?.state).toBe('granted');
    expect(granted.rationale.summary).toMatch(/suppressed on granted/);
  });

  it('agrees with the detector about what abstained', async () => {
    // The report derives abstentions from a resolver of its own; the detector
    // derives them from its gate. They must not be able to disagree.
    const contexts = [
      {},
      { userTurn: '日志满了' },
      { userTurn: '日志满了', advicePermission: 'absent' as const },
      { userTurn: '日志满了', advicePermission: 'granted' as const },
      { requestKind: ['advice'] },
      { requestKind: [] },
      { userTurn: '你说我该怎么办', solutionPermission: permissionOf({ userTurn: '你说我该怎么办' }) },
    ];

    for (const context of contexts) {
      const measured = measureSmellsDetailed(ADVICE_REPLY, context);
      expect(measured.abstained.map((entry) => entry.id)).toEqual(abstainedSmells(context));
      expect(measured.suppressed.map((entry) => entry.id)).toEqual(suppressedSmells(context));
      expect(abstainedBehaviors(context).map((entry) => entry.ruleId)).toEqual(
        abstainedSmells(context),
      );
    }

    // And the same through the detector interface, which is what `scan` calls.
    const detector = createAssistantSmellDetector();
    for (const context of contexts) {
      const findings = await detector.detect(ADVICE_REPLY, {
        language: 'zh',
        mode: 'chat',
        conversation: context,
      });
      expect(findings.map((finding) => finding.ruleId)).toEqual(
        measureSmellsDetailed(ADVICE_REPLY, context).smells.map((smell) => smell.id),
      );
    }
  });

  it('carries the abstention out of a scan, so a caller can see it without the rationale', async () => {
    const scanned = await scan(ADVICE_REPLY, { mode: 'chat', detectors: [createAssistantSmellDetector()] });
    expect(scanned.behaviorAbstained.map((entry) => entry.ruleId)).toEqual([
      'chat.unsolicited_advice',
    ]);
    expect(scanned.behaviorSuppressed).toEqual([]);
    expect(scanned.canonicalFindings.map((finding) => finding.ruleId)).not.toContain(
      'chat.unsolicited_advice',
    );

    const granted = await scan(ADVICE_REPLY, {
      mode: 'chat',
      detectors: [createAssistantSmellDetector()],
      conversation: { advicePermission: 'granted' },
    });
    expect(granted.behaviorAbstained).toEqual([]);
    expect(granted.behaviorSuppressed.map((entry) => entry.ruleId)).toEqual([
      'chat.unsolicited_advice',
    ]);
  });

  it('leaves the shadow rule out of the score in every permission state', async () => {
    // The rule is `shadow`: wiring its gate must not move `behaviorScore`, in either
    // direction, for any of the three states. The gate decides whether the rule is
    // reported, never what the score is.
    const states: readonly (AdvicePermission | undefined)[] = [
      undefined,
      'granted',
      'absent',
      'unknown',
    ];
    const scores: number[] = [];
    for (const state of states) {
      const scanned = await scan(ADVICE_REPLY, {
        mode: 'chat',
        detectors: [createAssistantSmellDetector()],
        ...(state ? { conversation: { advicePermission: state } } : {}),
      });
      scores.push(scanned.scores.behaviorScore);

      const rationale = scanned.scores.rationales.find((entry) => entry.score === 'behaviorScore');
      expect(rationale?.contributors ?? []).not.toContain('chat.unsolicited_advice');
      expect(rationale?.contributions ?? []).toEqual([]);
    }
    expect(new Set(scores).size).toBe(1);
    expect(scores[0]).toBe(1);
  });
});
