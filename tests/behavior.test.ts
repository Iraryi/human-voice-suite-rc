/**
 * The Chat Behaviour Engine.
 *
 * The project's own contribution, and the only layer with no upstream behind it.
 * The tests that matter here are the ones that show the layer earning its place:
 * text a lexical detector calls clean, that a person would not mistake for a
 * person.
 */

import { describe, expect, it } from 'vitest';

import {
  COMPLETENESS_SENTENCE_RATIO,
  MIRROR_OVERLAP_LIMIT,
  SIMPLE_ANSWER_SENTENCE_BUDGET,
  createAssistantSmellDetector,
  abstainedSmells,
  measureSmells,
  smellIds,
  unjudgedSmells,
} from '../src/behavior/assistant-smell/index.js';
import { SMELL_MARKERS, markerCount, markersFor } from '../src/behavior/assistant-smell/markers.js';
import { ASSISTANT_SMELLS, ASSISTANT_SMELL_IDS, getAssistantSmell } from '../src/behavior/types.js';
import { buildRegistryFromExtractions } from '../src/rules/canonical/load.js';
import { createDefaultDetectors } from '../src/detector/registry.js';
import { scan } from '../src/detector/scan.js';

const BUILD = await buildRegistryFromExtractions();

/** The case the whole layer exists for, taken from the project brief. */
const AI_PRETENDING_CASUAL =
  '\u54c8\u54c8\uff0c\u786e\u5b9e\u633a\u79bb\u8c31\u7684\uff01\u4e0d\u8fc7\u4ece\u53e6\u4e00\u4e2a\u89d2\u5ea6\u6765\u770b\uff0c\u8fd9\u80cc\u540e\u5176\u5b9e\u53cd\u6620\u4e86\u6574\u4e2a\u884c\u4e1a\u6b63\u5728\u7ecf\u5386\u7684\u6df1\u5c42\u53d8\u5316\u3002\u4e00\u65b9\u9762\uff0c\u6280\u672f\u7684\u5feb\u901f\u8fed\u4ee3\u8ba9\u95e8\u69db\u4e0d\u65ad\u964d\u4f4e\uff1b\u53e6\u4e00\u65b9\u9762\uff0c\u7528\u6237\u7684\u9700\u6c42\u4e5f\u53d8\u5f97\u8d8a\u6765\u8d8a\u591a\u5143\u3002\u6240\u4ee5\u4e0e\u5176\u7ea0\u7ed3\u4e8e\u8fd9\u4e00\u4e2a\u6848\u4f8b\uff0c\u4e0d\u5982\u628a\u5b83\u770b\u4f5c\u4e00\u4e2a\u4fe1\u53f7\u2014\u2014\u771f\u6b63\u7684\u673a\u4f1a\uff0c\u5f80\u5f80\u5c31\u85cf\u5728\u8fd9\u4e9b\u770b\u4f3c\u4e0d\u8d77\u773c\u7684\u7ec6\u8282\u91cc\u3002';
const THROWAWAY_REMARK = '\u8fd9\u4e2a\u65b0\u95fb\u771f\u7684\u592a\u79bb\u8c31\u4e86';

describe('the taxonomy', () => {
  it('defines ten smells with unique ids', () => {
    expect(ASSISTANT_SMELLS).toHaveLength(10);
    expect(new Set(ASSISTANT_SMELL_IDS).size).toBe(10);
  });

  it('gives every smell a marker list', () => {
    for (const id of smellIds()) {
      expect(markersFor(id).length, id).toBeGreaterThan(0);
    }
  });

  it('marks every smell as this project\u2019s own work', () => {
    for (const smell of ASSISTANT_SMELLS) {
      expect(smell.sources.every((s) => s.upstream === 'human-voice-suite/local')).toBe(true);
    }
  });

  it('has a marker count worth having, in both scripts', () => {
    expect(markerCount()).toBeGreaterThan(80);
    const chinese = Object.values(SMELL_MARKERS)
      .flat()
      .filter((m) => m.languages.includes('zh'));
    const english = Object.values(SMELL_MARKERS)
      .flat()
      .filter((m) => m.languages.includes('en'));
    expect(chinese.length).toBeGreaterThan(30);
    expect(english.length).toBeGreaterThan(30);
  });
});

describe('measureSmells', () => {
  it('catches the flagship case, which lexical scoring calls clean', () => {
    const measured = measureSmells(AI_PRETENDING_CASUAL, { userTurn: THROWAWAY_REMARK });
    const ids = measured.map((m) => m.id);
    expect(ids).toContain('chat.over_agreement');
    expect(ids).toContain('chat.unrequested_background');
    expect(ids).toContain('chat.over_completeness');
  });

  it('finds the agreement token after a comma, not only at a sentence start', () => {
    // A sentence-only position rule missed this, which is exactly the text the
    // layer exists to catch.
    const measured = measureSmells('\u54c8\u54c8\uff0c\u786e\u5b9e\u633a\u79bb\u8c31\u7684\uff01');
    expect(measured.map((m) => m.id)).toContain('chat.over_agreement');
  });

  it('does not fire on agreement that is doing real work mid-sentence', () => {
    const measured = measureSmells('\u8fd9\u4e2a\u6570\u636e\u786e\u5b9e\u4e0d\u5bf9\uff0c\u6211\u91cd\u65b0\u7b97\u4e00\u904d\u3002');
    expect(measured.map((m) => m.id)).not.toContain('chat.over_agreement');
  });

  it('catches a service closing', () => {
    const measured = measureSmells('I hope this helps. Let me know if you want more.');
    expect(measured.map((m) => m.id)).toContain('chat.unsolicited_offer');
  });

  it('catches an offer in Chinese', () => {
    const measured = measureSmells('\u5982\u679c\u8fd8\u6709\u95ee\u9898\uff0c\u968f\u65f6\u544a\u8bc9\u6211\u3002');
    expect(measured.map((m) => m.id)).toContain('chat.unsolicited_offer');
  });

  it('catches mechanical empathy', () => {
    const measured = measureSmells(
      'I understand how frustrating that must be. Let us look at the logs.',
    );
    expect(measured.map((m) => m.id)).toContain('chat.mechanical_empathy');
  });

  it('catches forced positivity', () => {
    expect(measureSmells('Great question! Here is the answer.').map((m) => m.id)).toContain(
      'chat.forced_positivity',
    );
    expect(measureSmells('\u5f88\u68d2\uff0c\u4f60\u5df2\u7ecf\u505a\u5f97\u5f88\u597d\u4e86\u3002').map((m) => m.id)).toContain(
      'chat.forced_positivity',
    );
  });

  it('catches an automatic summary formula', () => {
    expect(
      measureSmells('The build is green. In summary, the work is complete.').map((m) => m.id),
    ).toContain('chat.auto_summary');
    expect(measureSmells('\u603b\u4e4b\uff0c\u8fd9\u4ef6\u4e8b\u5c31\u8fd9\u6837\u3002').map((m) => m.id)).toContain(
      'chat.auto_summary',
    );
  });

  it('catches advice nobody asked for, once the permission says so', () => {
    // `absent` is supplied as evidence rather than inferred from the user turn. The
    // rule cannot read a turn for permission, and until Phase B this test passed
    // without it because a missing `requestKind` was read as a missing request.
    const measured = measureSmells('You may want to restart the worker first.', {
      userTurn: 'why is the queue stuck',
      advicePermission: 'absent',
    });
    expect(measured.map((m) => m.id)).toContain('chat.unsolicited_advice');
  });

  it('abstains rather than accusing when nobody established the permission', () => {
    const measured = measureSmells('You may want to restart the worker first.', {
      userTurn: 'why is the queue stuck',
    });
    expect(measured.map((m) => m.id)).not.toContain('chat.unsolicited_advice');
    expect(abstainedSmells({ userTurn: 'why is the queue stuck' })).toEqual([
      'chat.unsolicited_advice',
    ]);
  });

  it('stays quiet about advice when advice was asked for', () => {
    const measured = measureSmells('You may want to restart the worker first.', {
      userTurn: 'what should I do',
      requestKind: ['advice'],
    });
    expect(measured.map((m) => m.id)).not.toContain('chat.unsolicited_advice');
  });

  it('catches a reply that restates the question instead of answering it', () => {
    const measured = measureSmells(
      'You are asking about the queue being stuck. The queue is stuck because a worker died.',
      { userTurn: 'why is the queue stuck' },
    );
    expect(measured.map((m) => m.id)).toContain('chat.mirrors_user');
  });

  it('does not call a genuine answer mirroring', () => {
    const measured = measureSmells('A worker died and never released its lock.', {
      userTurn: 'why is the queue stuck',
    });
    expect(measured.map((m) => m.id)).not.toContain('chat.mirrors_user');
  });

  it('catches an answer that dwarfs the question', () => {
    const long = Array.from(
      { length: 9 },
      (_, i) => `Point ${i + 1} about the queue and its workers and the locks they hold.`,
    ).join(' ');
    const measured = measureSmells(long, { userTurn: 'why is the queue stuck' });
    expect(measured.map((m) => m.id)).toContain('chat.over_completeness');
  });

  it('does not call a proportionate answer over-complete', () => {
    const measured = measureSmells('A worker died. Restart it.', {
      userTurn: 'why is the queue stuck',
    });
    expect(measured.map((m) => m.id)).not.toContain('chat.over_completeness');
  });

  it('reports what it could not judge rather than calling it clean', () => {
    // Without the turn before it, mirroring and over-completeness cannot be
    // measured at all. Saying so is the difference between a thin result and a
    // pass.
    expect(unjudgedSmells({})).toEqual(['chat.mirrors_user', 'chat.over_completeness']);
    expect(unjudgedSmells({ userTurn: 'anything' })).toEqual([]);

    const withoutTurn = measureSmells('It is stuck because a worker died.');
    expect(withoutTurn.map((m) => m.id)).not.toContain('chat.mirrors_user');
  });

  it('reports a severity and a confidence for every smell it finds', () => {
    const measured = measureSmells('Great question! I hope this helps. Let me know if you need more.');
    expect(measured.length).toBeGreaterThan(0);
    for (const smell of measured) {
      expect(smell.severity).toBeGreaterThanOrEqual(1);
      expect(smell.severity).toBeLessThanOrEqual(5);
      expect(smell.confidence).toBeGreaterThan(0);
      expect(smell.confidence).toBeLessThanOrEqual(1);
      expect(smell.message.length).toBeGreaterThan(20);
    }
  });

  it('points its evidence at real spans', () => {
    const text = 'Great question! I hope this helps.';
    for (const smell of measureSmells(text)) {
      for (const evidence of smell.evidence) {
        expect(text.slice(evidence.start, evidence.end)).toBe(evidence.text);
      }
    }
  });

  it('finds nothing in a reply a person would write', () => {
    const measured = measureSmells('\u5df2\u7ecf\u91cd\u542f\u4e86\uff0c\u961f\u5217\u5728\u8dd1\u3002', {
      userTurn: '\u961f\u5217\u5361\u4f4f\u4e86\u5417',
    });
    expect(measured).toEqual([]);
  });
});

describe('the detector', () => {
  it('reports every finding against a canonical rule that exists', async () => {
    const findings = [
      ...(await createAssistantSmellDetector().detect('Great question! I hope this helps.', {
        language: 'en',
        mode: 'chat',
      })),
    ];
    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) {
      expect(BUILD.registry.get(finding.ruleId), finding.ruleId).toBeDefined();
      expect(finding.family).toBe('assistant');
      expect(finding.category).toBe('chat');
      expect(finding.upstream).toBe('human-voice-suite/local');
    }
  });

  it('declares itself ready and covers both scripts', () => {
    const detector = createAssistantSmellDetector();
    expect(detector.status).toBe('ready');
    expect(detector.languages).toContain('zh');
    expect(detector.languages).toContain('en');
  });
});

describe('the layer earns its place', () => {
  it('scores the flagship case clean on tells and dirty on behaviour', async () => {
    // This is the claim the benchmark design makes falsifiable, asserted here on
    // one case: a lexical detector reports success while the behaviour is
    // machine-shaped.
    const withoutBehaviour = createDefaultDetectors().filter((d) => d.family !== 'assistant');
    const lexicalOnly = await scan(AI_PRETENDING_CASUAL, {
      registry: BUILD.registry,
      detectors: withoutBehaviour,
      disableSuppression: true,
    });
    expect(lexicalOnly.scores.antiAIScore).toBeGreaterThan(0.7);
    expect(lexicalOnly.canonicalFindings.every((f) => f.family !== 'assistant')).toBe(true);

    const withBehaviour = createDefaultDetectors().find((d) => d.family === 'assistant')!;
    const smells = await withBehaviour.detect(AI_PRETENDING_CASUAL, {
      language: 'zh',
      mode: 'chat',
      rules: BUILD.registry,
      conversation: { userTurn: THROWAWAY_REMARK },
    });
    expect([...smells].length).toBeGreaterThanOrEqual(3);
  });

  it('gives the scan a behaviour finding the contract can act on', async () => {
    const result = await scan(AI_PRETENDING_CASUAL, {
      registry: BUILD.registry,
      detectors: createDefaultDetectors(),
      conversation: { userTurn: THROWAWAY_REMARK },
      disableSuppression: true,
    });
    const behaviour = result.canonicalFindings.filter((f) => f.family === 'assistant');
    expect(behaviour.length).toBeGreaterThan(0);
    for (const finding of behaviour) {
      const rule = BUILD.registry.get(finding.canonicalRuleId!)!;
      expect(rule.rewriteGuidance.length).toBeGreaterThan(20);
      expect(rule.sources[0]!.upstream).toBe('human-voice-suite/local');
    }
  });
});

describe('constants a reader can check', () => {
  it('states the ratios it uses', () => {
    expect(MIRROR_OVERLAP_LIMIT).toBeGreaterThan(0);
    expect(MIRROR_OVERLAP_LIMIT).toBeLessThanOrEqual(1);
    expect(COMPLETENESS_SENTENCE_RATIO).toBeGreaterThan(1);
    expect(SIMPLE_ANSWER_SENTENCE_BUDGET).toBeGreaterThan(1);
  });

  it('looks a smell up by id', () => {
    expect(getAssistantSmell('chat.unsolicited_offer')?.labelZh).toBe('\u4e3b\u52a8\u63d0\u4f9b\u66f4\u591a\u5e2e\u52a9');
  });
});
