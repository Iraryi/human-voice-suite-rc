import { describe, expect, it } from 'vitest';

import { ASSISTANT_SMELLS, getAssistantSmell } from '../src/behavior/types.js';
import { assessBehavior, BEHAVIOR_PENALTY_BUDGET } from '../src/validation/behavior/index.js';
import type { Finding } from '../src/detector/types.js';

function finding(ruleId: string, severity = 4, confidence = 0.7): Finding {
  return {
    ruleId,
    canonicalRuleId: ruleId,
    family: 'assistant',
    severity,
    confidence,
    message: `${ruleId} fired`,
    evidence: [{ start: 0, end: 4, text: 'test' }],
  } as unknown as Finding;
}

const userTurn = '今天面试又没过，第三次了';

describe('behaviorScore admits class A only', () => {
  it('charges a reviewed smell', () => {
    const assessment = assessBehavior([finding('chat.forced_positivity')], { userTurn });
    expect(assessment.behaviorScore).toBeLessThan(1);
    expect(assessment.rationale.contributors).toEqual(['chat.forced_positivity']);
  });

  it.each([
    ['chat.auto_summary', 'descriptive'],
    ['chat.over_completeness', 'descriptive'],
    ['chat.mirrors_user', 'deprecated-candidate'],
    ['chat.explains_obvious', 'deprecated-candidate'],
    ['chat.unsolicited_offer', 'shadow'],
    ['chat.unsolicited_advice', 'shadow'],
    ['chat.unrequested_background', 'shadow'],
  ])('reports %s and charges nothing, as %s', (ruleId, expectedClass) => {
    const assessment = assessBehavior([finding(ruleId)], { userTurn });
    expect(assessment.behaviorScore).toBe(1);
    expect(assessment.rationale.contributors).toEqual([]);
    expect(assessment.rationale.contributions).toEqual([]);
    // Reported, not deleted: a demoted rule still tells the reader what it saw.
    expect(assessment.findings.map((entry) => entry.canonicalRuleId ?? entry.ruleId)).toContain(ruleId);
    expect(assessment.rationale.unscored?.map((entry) => entry.label)).toContain(ruleId);
    expect(assessment.rationale.unscored?.find((entry) => entry.label === ruleId)?.class).toBe(
      expectedClass,
    );
    expect(assessment.rationale.summary).toContain('reported and not charged');
  });

  it('separates the two when a demoted smell and a class A smell both fire', () => {
    const assessment = assessBehavior(
      [finding('chat.over_completeness'), finding('chat.forced_positivity')],
      { userTurn },
    );
    expect(assessment.rationale.contributions.map((entry) => entry.label)).toEqual([
      'chat.forced_positivity',
    ]);
    expect(assessment.rationale.unscored?.map((entry) => entry.label)).toEqual([
      'chat.over_completeness',
    ]);
    // The only deduction is the class A one: severity 4 of 5 at confidence 0.7.
    expect(assessment.behaviorScore).toBeCloseTo(1 - (4 / 5) * 0.7 / BEHAVIOR_PENALTY_BUDGET, 4);
  });

  it('names the rules the score is the sum over', () => {
    const assessment = assessBehavior([finding('chat.over_agreement')], { userTurn });
    expect(assessment.rationale.contributors).toEqual(['chat.over_agreement']);
    // A reader can answer "what does this number mean" from the rationale alone.
    for (const label of assessment.rationale.contributors ?? []) {
      expect(getAssistantSmell(label)?.scoring ?? 'discriminating').toBe('discriminating');
    }
  });

  it('states the class of every smell, and why', () => {
    const demoted = ASSISTANT_SMELLS.filter((smell) => smell.scoring !== undefined && smell.scoring !== 'discriminating');
    expect(demoted.map((smell) => smell.id).sort()).toEqual([
      'chat.auto_summary',
      'chat.explains_obvious',
      'chat.mirrors_user',
      'chat.over_completeness',
      'chat.unrequested_background',
      'chat.unsolicited_advice',
      'chat.unsolicited_offer',
    ]);
    for (const smell of demoted) {
      expect(smell.scoringNote, smell.id).toBeTruthy();
      // A note has to say what was measured, not merely that a decision was taken.
      expect(smell.scoringNote, smell.id).toMatch(
        /REVIEW_RESULTS|RULE_STATUS_DECISION|LENGTH_MATCHED|GATE_REVIEW|matched|enrichment|construct/i,
      );
    }
  });

  it('has exactly three class A smells, and they are the ones with evidence on both sides', () => {
    const active = ASSISTANT_SMELLS.filter((smell) => (smell.scoring ?? 'discriminating') === 'discriminating');
    expect(active.map((smell) => smell.id).sort()).toEqual([
      'chat.forced_positivity',
      'chat.mechanical_empathy',
      'chat.over_agreement',
    ]);
    // The two the paired control found separating machine chat from human chat, in the class that may
    // charge for them. `chat.unsolicited_advice` is the third in that measurement and is not here: its
    // gate changed what it reports, and its class is `shadow`.
    for (const id of ['chat.forced_positivity', 'chat.over_agreement']) {
      expect(getAssistantSmell(id)?.scoring ?? 'discriminating', id).toBe('discriminating');
    }
    expect(getAssistantSmell('chat.unsolicited_advice')?.scoring).toBe('shadow');
  });
});
