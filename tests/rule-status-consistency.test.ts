/**
 * One rule status, stated once, and every surface saying the same thing.
 *
 * `RULE_STATUS_DECISION.md` decides the class of every rule; `src/behavior/types.ts` carries it
 * in code; `assessBehavior` admits class A and nothing else; the README, the engine documentation,
 * the benchmark renderer and the CLI all describe the same table. Five surfaces, one decision — and
 * this file is what stops them drifting apart, because a class that disagrees with itself across
 * five surfaces is worse than no class at all.
 *
 * It also records the two rules that are class A **by inheritance**: `chat.explains_obvious` and
 * `chat.unrequested_background` were never part of the status migration, so they kept the pre-Phase-A
 * default rather than earning the class through the eleven questions the other rules answered. That
 * is a gap in the decision record, asserted here so it cannot be quietly forgotten.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ASSISTANT_SMELLS, getAssistantSmell } from '../src/behavior/types.js';
import type { AssistantSmellId } from '../src/behavior/types.js';
import { assessBehavior } from '../src/validation/behavior/index.js';
import type { Finding } from '../src/detector/types.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative: string): string => readFileSync(path.join(ROOT, relative), 'utf8');

type SmellClass = 'discriminating' | 'descriptive' | 'shadow' | 'hypothesis' | 'deprecated-candidate';

/**
 * The class of every assistant smell, taken from the status decision and the evidence behind it.
 *
 * Written out rather than derived from the taxonomy, because a test that read the value it is
 * checking would pass whatever the code said.
 */
const DECIDED: Readonly<Record<AssistantSmellId, SmellClass>> = {
  // Class A: reviewed in the status decision, with human false-positive evidence and machine positive
  // evidence, and with no contextual input the rule claims to depend on going unsupplied.
  'chat.over_agreement': 'discriminating',
  'chat.forced_positivity': 'discriminating',
  'chat.mechanical_empathy': 'discriminating',
  // Construct validity not established, and the evidence is missing rather than thin: never fired on the
  // committed corpus, below the classification floor on the paired control, and a phrase list that never
  // reads the conversation while its name claims to know what the user already knows.
  'chat.explains_obvious': 'deprecated-candidate',
  // Real information; specificity or per-item certainty is not enough to charge for.
  'chat.auto_summary': 'descriptive',
  'chat.over_completeness': 'descriptive',
  // Not validated, or dependent on input nothing supplies.
  'chat.unsolicited_advice': 'shadow',
  'chat.unsolicited_offer': 'shadow',
  // Its `unrequested` qualifier is read through a gate nothing supplies, so the gate is always true and a
  // missing answer is read as "the user asked for nothing".
  'chat.unrequested_background': 'shadow',
  // The code stays; the claim does not.
  'chat.mirrors_user': 'deprecated-candidate',
};

/**
 * Rules the taxonomy migration left at class A without the eleven questions being asked.
 *
 * It is empty, and it is kept as a named list rather than deleted so that the next rule carried over by
 * default has somewhere to go — and so that emptying it is a visible act. `chat.explains_obvious` and
 * `chat.unrequested_background` were on it until the gate review: neither had a status decision, and both
 * were demoted when the review asked what evidence they had. There is no such thing as class A by
 * inheritance any more.
 */
const INHERITED_CLASS_A: readonly AssistantSmellId[] = [];

function finding(ruleId: string): Finding {
  return {
    ruleId,
    canonicalRuleId: ruleId,
    family: 'assistant',
    severity: 4,
    confidence: 0.8,
    message: `${ruleId} fired`,
    evidence: [{ start: 0, end: 4, text: 'test' }],
  } as unknown as Finding;
}

describe('the taxonomy says what the decision says', () => {
  it('gives every smell exactly one class, and matches the decision', () => {
    for (const smell of ASSISTANT_SMELLS) {
      const actual = smell.scoring ?? 'discriminating';
      expect(actual, smell.id).toBe(DECIDED[smell.id]);
    }
  });

  it('covers every smell, so a new one cannot arrive without a class', () => {
    expect(ASSISTANT_SMELLS.map((smell) => smell.id).sort()).toEqual(
      Object.keys(DECIDED).sort(),
    );
  });

  it('requires a note for every class that is not the default', () => {
    for (const smell of ASSISTANT_SMELLS) {
      const klass = smell.scoring ?? 'discriminating';
      if (klass === 'discriminating') continue;
      expect(smell.scoringNote, `${smell.id} has no scoringNote`).toBeTruthy();
      // The note has to name the evidence, not merely assert a decision was taken.
      expect(smell.scoringNote, smell.id).toMatch(
        /RULE_STATUS_DECISION|REVIEW_RESULTS|LENGTH_MATCHED|ADVICE_PERMISSION|OFFER_REVIEW|GATE_REVIEW|matched|enrichment|construct/i,
      );
    }
  });

  it('leaves no rule at class A by inheritance', () => {
    // The rule this test exists for: a class that is carried over rather than earned is not evidence, and
    // it was how two rules came to charge `behaviorScore` without ever being asked why.
    expect(INHERITED_CLASS_A).toEqual([]);
    for (const id of INHERITED_CLASS_A) {
      expect(getAssistantSmell(id)?.scoring ?? 'discriminating').toBe('discriminating');
    }
  });

  it('demotes every rule whose context input nothing supplies', () => {
    // The general form of the same defect, and the one that caught `chat.unrequested_background`: a rule
    // may read a contextual input only if something actually populates it. `unwiredRequestGate` is the
    // named marker for a gate that does not have that, and a **scored** rule may not use it.
    const detector = read('src/behavior/assistant-smell/index.ts');
    expect(detector, 'the gate marker is gone; this check has stopped checking anything').toContain(
      'unwiredRequestGate',
    );
    const users = [...detector.matchAll(/unwiredRequestGate\('([a-z]+)'\)/g)].map((match) => match[1]);
    expect(users.length, 'no rule uses the unwired gate any more; delete this test with the gate').toBeGreaterThan(0);

    // Every gate scope maps onto the rule that reads it, and none of those rules may be scored.
    const scopeToRule: Readonly<Record<string, AssistantSmellId>> = {
      background: 'chat.unrequested_background',
    };
    for (const scope of users) {
      const id = scopeToRule[scope as keyof typeof scopeToRule];
      expect(id, `unwiredRequestGate('${scope}') has no rule mapped to it`).toBeDefined();
      expect(getAssistantSmell(id as string)?.scoring ?? 'discriminating', String(id)).not.toBe(
        'discriminating',
      );
    }
  });
});

describe('the score admits class A and nothing else', () => {
  it('charges only `discriminating`, for every rule in the taxonomy', () => {
    for (const smell of ASSISTANT_SMELLS) {
      const assessment = assessBehavior([finding(smell.id)], { userTurn: '今天面试又没过' });
      const klass = smell.scoring ?? 'discriminating';
      if (klass === 'discriminating') {
        expect(assessment.rationale.contributors, smell.id).toEqual([smell.id]);
        expect(assessment.behaviorScore, smell.id).toBeLessThan(1);
      } else {
        expect(assessment.rationale.contributors, smell.id).toEqual([]);
        expect(assessment.behaviorScore, smell.id).toBe(1);
        expect(assessment.rationale.unscored?.map((entry) => entry.label), smell.id).toContain(smell.id);
      }
    }
  });

  it('names only class A rules as contributors, whatever it was handed', () => {
    const everyRule = ASSISTANT_SMELLS.map((smell) => finding(smell.id));
    const assessment = assessBehavior(everyRule, { userTurn: '今天面试又没过' });
    for (const label of assessment.rationale.contributors ?? []) {
      expect(getAssistantSmell(label)?.scoring ?? 'discriminating', label).toBe('discriminating');
    }
    // And the complement is named rather than dropped.
    expect((assessment.rationale.unscored ?? []).length).toBeGreaterThan(0);
  });
});

describe('every surface describes the same five classes', () => {
  const CLASSES: readonly SmellClass[] = [
    'discriminating',
    'descriptive',
    'shadow',
    'hypothesis',
    'deprecated-candidate',
  ];

  it.each([
    ['README.md', 'README.md'],
    ['docs/behavior-engine.md', 'docs/behavior-engine.md'],
    ['src/behavior/types.ts', 'src/behavior/types.ts'],
    ['benchmarks/external/RULE_STATUS_DECISION.md', 'benchmarks/external/RULE_STATUS_DECISION.md'],
  ])('%s defines all five', (_label, relative) => {
    const text = read(relative);
    // The decision record uses the four-class vocabulary (A/B/C/D) beside the five names, which is
    // why it is the one file allowed to satisfy this through either spelling.
    const phrases: Record<SmellClass, RegExp> = {
      discriminating: /discriminating|[Cc]lass\s*\*{0,2}A\*{0,2}|\*\*A\*\*/,
      descriptive: /descriptive/,
      shadow: /shadow/,
      hypothesis: /hypothesis/,
      'deprecated-candidate': /deprecated-candidate|Construct validity (?:insufficient|not established)/,
    };
    for (const klass of CLASSES) {
      expect(phrases[klass].test(text), `${relative} does not define ${klass}`).toBe(true);
    }
  });

  it('states that class A is the only class that contributes', () => {
    expect(read('README.md')).toMatch(/only class A contributes/i);
    expect(read('docs/behavior-engine.md')).toMatch(/class A only/i);
    expect(read('src/behavior/types.ts')).toMatch(/Only these contribute to the/);
  });

  it('says in the renderer that unscored findings are not in any aggregate', () => {
    // The renderer is a surface too: a reader of BENCHMARK_RESULTS.md has to learn there that a
    // reported finding is not a charged one, or the firing table reads as a score table.
    const renderer = read('benchmarks/report.ts');
    expect(renderer).toMatch(/admits class A only/);
    expect(renderer).toMatch(/charged to nothing/);
  });

  it('marks the non-taxonomy layers with their status where they live', () => {
    // Action-plan structure and solution permission are shadow, solution-mode shift is a hypothesis.
    // None of the three is a registered smell, so the taxonomy cannot carry their status and the
    // module or record that owns each one has to say it.
    expect(read('benchmarks/external/permission.ts')).toMatch(/Status: shadow/);
    expect(read('benchmarks/external/solution-mode.ts')).toMatch(/frozen|shadow/i);
    // The shift is a composition rather than a detector, and the decision record is where its
    // `hypothesis` status is written down.
    const decision = read('benchmarks/external/RULE_STATUS_DECISION.md');
    expect(decision).toMatch(/Solution-mode shift — `hypothesis`/);
    expect(decision).toMatch(/Final status \| `hypothesis`/);
    // And the shadow report says out loud that it reports without scoring.
    expect(read('benchmarks/external/shadow-report.ts')).toMatch(/Nothing here is scored/);
  });
});

describe('the pending migration is recorded rather than implied', () => {
  it('still names the rules the decision suspended', () => {
    const decision = read('benchmarks/external/RULE_STATUS_DECISION.md');
    for (const id of [
      'chat.unsolicited_advice',
      'chat.unsolicited_offer',
      'chat.auto_summary',
      'chat.mirrors_user',
      'chat.over_completeness',
      'chat.mechanical_empathy',
      'chat.forced_positivity',
      'chat.over_agreement',
    ]) {
      expect(decision, `${id} is not in the decision record`).toContain(id);
    }
  });

  it('keeps the historical qualifier attached to the old advice numbers', () => {
    // Every published rate for that rule was produced with its permission gate disabled, and the
    // qualifier is the only thing that keeps the numbers honest.
    for (const relative of [
      'benchmarks/external/RULE_STATUS_DECISION.md',
      'benchmarks/external/README.md',
      'docs/phase-28-advice-permission.md',
    ]) {
      expect(read(relative), relative).toMatch(/requestKind.*unpopulated|unpopulated.*requestKind/i);
    }
  });
});
