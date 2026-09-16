/**
 * Turn a run into numbers that can be argued with.
 *
 * Deliberately arithmetic rather than inferential: with 6 to 12 samples in a
 * category, a p-value would be a decoration on noise. What is reported instead
 * is the mean, the spread, the sample count, how many scores were unmeasured,
 * and a rank separation — all of which a reader can check by hand against the
 * stored run.
 *
 * Every cell reports four numbers and no aggregate. If a layer improves one score
 * while degrading another, that is a finding, and blending would have hidden it.
 */

import type { ScoreName } from '../../src/validation/types.js';
import type { SampleResult } from './score.js';
import type { AblationConfig } from './configs.js';
import { compareText } from '../../src/shared/order.js';

/** Below this, a sample counts as flagged. Declared so the threshold is arguable. */
export const FLAGGED_ANTI_AI = 0.7;
/** A behaviour score below this counts as assistant-shaped. */
export const ASSISTANT_SHAPED = 0.75;

export interface Summary {
  readonly n: number;
  readonly mean: number;
  readonly median: number;
  readonly min: number;
  readonly max: number;
  readonly stdDev: number;
  /** How many samples had nothing to measure for this score. */
  readonly unmeasured: number;
}

export function summarise(values: readonly number[]): Summary {
  if (values.length === 0) {
    return { n: 0, mean: 0, median: 0, min: 0, max: 0, stdDev: 0, unmeasured: 0 };
  }  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  const mid = Math.floor(sorted.length / 2);
  return {
    n: values.length,
    mean,
    median:
      sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    stdDev: Math.sqrt(variance),
    unmeasured: 0,
  };
}

export interface Cell {
  readonly configId: string;
  readonly category: string;
  readonly counts: { readonly samples: number };
  readonly antiAIScore: Summary;
  readonly behaviorScore: Summary;
  readonly voiceScore: Summary;
  readonly preservationScore: Summary;
  /** Samples whose antiAIScore is below the flagged threshold. */
  readonly flagged: readonly string[];
  /** Samples whose behaviorScore is below the assistant-shaped threshold. */
  readonly assistantShaped: readonly string[];
}

const SCORE_KEYS: readonly ScoreName[] = [
  'antiAIScore',
  'voiceScore',
  'behaviorScore',
  'preservationScore',
];

export function cellFor(
  results: readonly SampleResult[],
  config: AblationConfig,
  category: string,
): Cell {
  const rows = results.filter(
    (row) => row.configId === config.id && row.category === category,
  );

  const collect = (score: ScoreName): Summary => {
    const measured = rows.filter((row) => !row.unmeasured.includes(score));
    const summary = summarise(measured.map((row) => row.scores[score]));
    return { ...summary, unmeasured: rows.length - measured.length };
  };

  return {
    configId: config.id,
    category,
    counts: { samples: rows.length },
    antiAIScore: collect('antiAIScore'),
    behaviorScore: collect('behaviorScore'),
    voiceScore: collect('voiceScore'),
    preservationScore: collect('preservationScore'),
    flagged: rows
      .filter(
        (row) => !row.unmeasured.includes('antiAIScore') && row.scores.antiAIScore < FLAGGED_ANTI_AI,
      )
      .map((row) => row.sampleId),
    assistantShaped: rows
      .filter(
        (row) =>
          !row.unmeasured.includes('behaviorScore') && row.scores.behaviorScore < ASSISTANT_SHAPED,
      )
      .map((row) => row.sampleId),
  };
}

/**
 * Rank separation: the probability that a randomly chosen value from `a` scores
 * higher than a randomly chosen value from `b`, with ties counted as a half.
 *
 * 0.5 means the two groups are indistinguishable on this score, 1.0 means every
 * `a` beats every `b`. Reported instead of a mean difference because it does not
 * assume the scores are normally distributed, which on a 0..1 clipped scale they
 * are not.
 */
export function separation(a: readonly number[], b: readonly number[]): number | undefined {
  if (a.length === 0 || b.length === 0) return undefined;
  let wins = 0;
  for (const left of a) {
    for (const right of b) {
      if (left > right) wins += 1;
      else if (left === right) wins += 0.5;
    }
  }
  return wins / (a.length * b.length);
}

export function valuesFor(
  results: readonly SampleResult[],
  configId: string,
  score: ScoreName,
  filter: (row: SampleResult) => boolean = () => true,
): number[] {
  return results
    .filter((row) => row.configId === configId && filter(row) && !row.unmeasured.includes(score))
    .map((row) => row.scores[score]);
}

export interface HypothesisTest {
  readonly configId: string;
  readonly score: ScoreName;
  /** The category under test: AI pretending to be casual. */
  readonly subject: Summary;
  /** Real human writing, in any register. */
  readonly control: Summary;
  /** Probability a subject sample scores higher than a control sample. */
  readonly separation?: number;
  /**
   * The claim under test, restated as it is actually testable with this corpus.
   * See `benchmarks/README.md` §2 for the revision and why it was made.
   */
  readonly claim: string;
  readonly holds: boolean | undefined;
}

export const SUBJECT_CATEGORY = 'ai-pretending-casual';

/** The categories whose samples are genuinely human-written, for control use. */
export const CONTROL_PROVENANCE = 'human-written';

export function testHypothesis(
  results: readonly SampleResult[],
  config: AblationConfig,
  score: ScoreName,
): HypothesisTest {
  const subject = valuesFor(results, config.id, score, (row) => row.category === SUBJECT_CATEGORY);
  const control = valuesFor(
    results,
    config.id,
    score,
    (row) => row.provenance === CONTROL_PROVENANCE,
  );

  const subjectSummary = summarise(subject);
  const controlSummary = summarise(control);
  const sep = separation(subject, control);

  return {
    configId: config.id,
    score,
    subject: subjectSummary,
    control: controlSummary,
    ...(sep !== undefined ? { separation: sep } : {}),
    claim:
      'AI pretending to be casual scores better (higher) than genuinely human-written text on this score.',
    holds: sep === undefined ? undefined : sep > 0.5,
  };
}

/** Every rule that fired in a run, with how often and in which category. */
export interface RuleTally {
  readonly ruleId: string;
  readonly family: string;
  readonly firings: number;
  readonly categories: readonly string[];
  readonly samples: readonly string[];
}

export function tallyRules(
  results: readonly SampleResult[],
  configId: string,
): RuleTally[] {
  const byRule = new Map<string, { family: string; samples: Set<string>; categories: Set<string> }>();
  for (const row of results) {
    if (row.configId !== configId) continue;
    for (const finding of row.findings) {
      const entry = byRule.get(finding.ruleId) ?? {
        family: finding.family,
        samples: new Set<string>(),
        categories: new Set<string>(),
      };
      entry.samples.add(row.sampleId);
      entry.categories.add(row.category);
      byRule.set(finding.ruleId, entry);
    }
  }
  return [...byRule.entries()]
    .map(([ruleId, entry]) => ({
      ruleId,
      family: entry.family,
      firings: entry.samples.size,
      categories: [...entry.categories].sort(),
      samples: [...entry.samples].sort(),
    }))
    .sort((a, b) => b.firings - a.firings || compareText(a.ruleId, b.ruleId));
}

/**
 * Rules that abstained, with the state that stopped them and where it came from.
 *
 * Not a firing and not a pass. Grouped by rule, state and source so a report can say
 * *why* a rule produced nothing rather than only that it did.
 */
export interface AbstentionTally {
  readonly ruleId: string;
  readonly state: string;
  readonly source: string;
  /** Measurements in which this rule abstained in this state. */
  readonly count: number;
}

export function tallyAbstentions(results: readonly SampleResult[]): AbstentionTally[] {
  const tally = new Map<string, AbstentionTally>();
  for (const row of results) {
    // Runs stored before abstention recording have no field, and are not read as clean.
    if (row.abstained === undefined) continue;
    for (const entry of row.abstained) {
      const key = `${entry.ruleId}\u0000${entry.state}\u0000${entry.source}`;
      const existing = tally.get(key);
      tally.set(key, {
        ruleId: entry.ruleId,
        state: entry.state,
        source: entry.source,
        count: (existing?.count ?? 0) + 1,
      });
    }
  }
  return [...tally.values()].sort(
    (a, b) => b.count - a.count || compareText(a.ruleId, b.ruleId) || compareText(a.state, b.state),
  );
}

/**
 * Rules that fire on human-written samples. These are the false-positive
 * candidates, and they are listed by name rather than counted, because a count
 * cannot be acted on.
 */
export function flaggedHumanRules(results: readonly SampleResult[], configId: string): RuleTally[] {
  const human = new Set(
    results.filter((row) => row.provenance === CONTROL_PROVENANCE).map((row) => row.sampleId),
  );
  return tallyRules(results, configId)
    .map((tally) => ({
      ...tally,
      firings: tally.samples.filter((sample) => human.has(sample)).length,
      samples: tally.samples.filter((sample) => human.has(sample)),
    }))
    .filter((tally) => tally.firings > 0)
    .sort((a, b) => b.firings - a.firings || compareText(a.ruleId, b.ruleId));
}

export { SCORE_KEYS };
