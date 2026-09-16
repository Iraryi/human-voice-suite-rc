/**
 * Translationese, calibrated on the corpus that exposed it.
 *
 * `chinese.translationese` was a catalog slot for seven phases with nothing
 * behind it. Phase 8 built the detector, and these tests are the calibration
 * record: the four positives, the clean control, the hand-fixed revision, and
 * the margin between them.
 *
 * They run against the real benchmark corpus rather than fixtures, because the
 * thresholds were derived from it and a fixture would only restate them.
 */

import { describe, expect, it } from 'vitest';

import {
  TRANSLATIONESE_ABSTRACT_SUFFIX_COUNT,
  TRANSLATIONESE_DE_DENSITY,
  TRANSLATIONESE_LIGHT_VERB_COUNT,
  TRANSLATIONESE_MIN_CJK,
  TRANSLATIONESE_PASSIVE_COUNT,
  TRANSLATIONESE_PRONOUN_COUNT,
  translationeseSignals,
} from '../src/detector/chinese/index.js';
import { createToolkit } from '../src/dsh/tools/runtime.js';
import { loadCorpus } from '../benchmarks/lib/corpus.js';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const corpus = loadCorpus(join(ROOT, 'benchmarks'));

const positives = ['zh-tran-0001', 'zh-tran-0002', 'zh-tran-0003', 'zh-tran-0004'];
const negatives = ['zh-tran-0005', 'zh-tran-0006'];

function sample(id: string) {
  const found = corpus.samples.find((entry) => entry.id === id);
  expect(found, `corpus sample ${id}`).toBeDefined();
  return found!;
}

describe('the translationese thresholds', () => {
  it('separates the four positives from everything else on 的 density alone', () => {
    const positiveDensities = positives.map((id) => translationeseSignals(sample(id).body).deDensity);
    for (const density of positiveDensities) {
      expect(density).toBeGreaterThanOrEqual(TRANSLATIONESE_DE_DENSITY);
    }

    // Every other Chinese sample in the corpus, including the two negative
    // controls, sits below the threshold.
    const others = corpus.samples.filter(
      (entry) => entry.language === 'zh' && !positives.includes(entry.id),
    );
    const highest = Math.max(
      ...others.map((entry) => translationeseSignals(entry.body).deDensity),
    );
    expect(highest).toBeLessThan(TRANSLATIONESE_DE_DENSITY);

    // The margin is the point. 8.0 was chosen because it sits in a gap, not
    // because it rounded nicely, and a threshold with no clearance either side
    // is a coin toss.
    const margin = Math.min(...positiveDensities) - highest;
    expect(margin).toBeGreaterThan(1.5);
  });

  it('requires corroboration, so a high 的 density alone is not a finding', () => {
    for (const id of positives) {
      expect(
        translationeseSignals(sample(id).body).corroborating.length,
        id,
      ).toBeGreaterThan(0);
    }
  });

  it('names which signal corroborated, so the finding can be argued with', () => {
    const signals = translationeseSignals(sample('zh-tran-0002').body);
    expect(signals.passive).toBeGreaterThanOrEqual(TRANSLATIONESE_PASSIVE_COUNT);
    expect(signals.corroborating.join(' ')).toMatch(/被/);
  });

  it('keeps the control and the fixed revision clean on every signal', () => {
    for (const id of negatives) {
      const signals = translationeseSignals(sample(id).body);
      expect(signals.deDensity, id).toBeLessThan(TRANSLATIONESE_DE_DENSITY);
      expect(signals.passive, id).toBeLessThan(TRANSLATIONESE_PASSIVE_COUNT);
      expect(signals.lightVerb, id).toBeLessThan(TRANSLATIONESE_LIGHT_VERB_COUNT);
      expect(signals.abstractSuffix, id).toBeLessThan(TRANSLATIONESE_ABSTRACT_SUFFIX_COUNT);
      expect(signals.pronoun, id).toBeLessThan(TRANSLATIONESE_PRONOUN_COUNT);
    }
  });

  it('declines text too short for a density to mean anything', () => {
    const short = '这是一个被广泛讨论的问题，它的可行性需要被进一步评估。';
    const signals = translationeseSignals(short);
    expect(signals.cjkChars).toBeLessThan(TRANSLATIONESE_MIN_CJK);
  });
});

describe('the translationese detector, on the corpus', () => {
  it(
    'fires on the four translated samples and on neither of the two clean ones',
    async () => {
      const toolkit = await createToolkit({ projectRoot: ROOT });
      const fired: Record<string, number> = {};

      for (const id of [...positives, ...negatives]) {
        const entry = sample(id);
        const result = await toolkit.scan({
          text: entry.body,
          language: 'zh',
          mode: entry.mode,
        });
        fired[id] = result.byRule['chinese.translationese'] ?? 0;
      }

      for (const id of positives) expect(fired[id], id).toBe(1);
      for (const id of negatives) expect(fired[id], id).toBe(0);
    },
    60000,
  );

  it(
    'does not fire on the human-written Chinese in the corpus',
    async () => {
      const toolkit = await createToolkit({ projectRoot: ROOT });
      const human = corpus.samples.filter(
        (entry) => entry.language === 'zh' && entry.provenance === 'human-written',
      );
      expect(human.length).toBeGreaterThan(0);
      for (const entry of human) {
        const result = await toolkit.scan({
          text: entry.body,
          language: 'zh',
          mode: entry.mode,
        });
        expect(result.byRule['chinese.translationese'], entry.id).toBeUndefined();
      }
    },
    60000,
  );

  it(
    'charges the register once and the connectives once, never both to the same rule',
    async () => {
      const toolkit = await createToolkit({ projectRoot: ROOT });
      const entry = sample('zh-tran-0002');
      const result = await toolkit.scan({ text: entry.body, language: 'zh', mode: entry.mode });
      const ids = result.canonicalFindings.map((finding) => finding.canonicalRuleId ?? finding.ruleId);
      // The two rules are separate ids by design: one is a lexicon, the other a
      // register. What must not happen is the same id appearing twice.
      expect(new Set(ids).size).toBe(ids.length);
    },
    60000,
  );
});
