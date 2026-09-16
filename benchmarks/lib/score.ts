/**
 * Running one configuration against one sample.
 *
 * The harness never rewrites anything. It produces measurements: four scores and
 * the findings behind them. A rewrite would require a model in the loop, and a
 * benchmark that lets a model rewrite its own test input is measuring the model,
 * not the suite. When a candidate rewrite has been recorded for a sample, the
 * `full` configuration measures preservation against it — and the candidate is a
 * file on disk with a recorded provenance, not something this code invents.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Toolkit } from '../../src/dsh/tools/runtime.js';
import type { VoiceProfile } from '../../src/voice/types.js';
import type { ScoreName } from '../../src/validation/types.js';
import type { AblationConfig } from './configs.js';
import type { Sample } from './corpus.js';

export interface FindingRecord {
  readonly ruleId: string;
  readonly family: string;
  readonly severity: number;
  readonly confidence: number;
  readonly message: string;
}

export interface ScoreRecord {
  readonly antiAIScore: number;
  readonly voiceScore: number;
  readonly behaviorScore: number;
  readonly preservationScore: number;
}

export interface SampleResult {
  readonly sampleId: string;
  readonly category: string;
  readonly language: string;
  readonly mode: string;
  readonly provenance: string;
  readonly configId: string;
  readonly scores: ScoreRecord;
  readonly unmeasured: readonly ScoreName[];
  readonly findings: readonly FindingRecord[];
  readonly suppressedCount: number;
  readonly detectorsRun: readonly string[];
  /**
   * Behaviour rules that were evaluated and declined to decide on this sample, with the
   * state that stopped them.
   *
   * Recorded so the report can show why a context-dependent rule produced nothing. A rule
   * that abstained is neither a firing nor a pass, and a run file that recorded only the
   * two would make an abstention look like a clean result. Optional because runs stored
   * before the advice-permission gate was wired do not have it, and an old run must not be
   * read as one where nothing abstained.
   */
  readonly abstained?: ReadonlyArray<{
    readonly ruleId: string;
    readonly state: string;
    readonly source: string;
  }>;
  /** The profile the sample was measured against, when one was attached. */
  readonly profileId?: string;
  /** True when the sample has a recorded candidate and `full` used it. */
  readonly preservationMeasured: boolean;
}

export interface RunContext {
  /** The profile for a sample, learned leave-one-out. */
  readonly profileFor?: (sample: Sample) => VoiceProfile | undefined;
  /** Directory of recorded candidate rewrites, `<sample-id>.md`. */
  readonly candidatesDir?: string;
}

export function candidateFor(
  sample: Sample,
  candidatesDir: string | undefined,
): string | undefined {
  if (!candidatesDir) return undefined;
  const path = join(candidatesDir, `${sample.id}.md`);
  return existsSync(path) ? readFileSync(path, 'utf8').trim() : undefined;
}

export async function runSample(
  toolkit: Toolkit,
  sample: Sample,
  config: AblationConfig,
  context: RunContext = {},
): Promise<SampleResult> {
  const profile = config.voice ? context.profileFor?.(sample) : undefined;
  // The advice permission travels with the sample, because it is evidence about the
  // input rather than something a detector can read off the reply. A sample that does
  // not record one leaves the rule abstaining, and the report says so; it is never
  // inferred from the user turn not mentioning advice.
  const conversation =
    config.conversation && sample.userTurn !== undefined
      ? {
          userTurn: sample.userTurn,
          ...(sample.advicePermission ? { advicePermission: sample.advicePermission } : {}),
        }
      : undefined;

  const candidate = config.candidate ? candidateFor(sample, context.candidatesDir) : undefined;

  if (candidate !== undefined) {
    const validated = await toolkit.validate({
      original: sample.body,
      rewritten: candidate,
      language: sample.language === 'unknown' ? undefined : sample.language,
      mode: sample.mode,
      ...(profile ? { voiceProfile: profile } : {}),
      ...(conversation ? { conversation } : {}),
    });
    const unmeasured = new Set<ScoreName>(validated.scores.unmeasured ?? []);
    return {
      sampleId: sample.id,
      category: sample.category,
      language: sample.language,
      mode: sample.mode,
      provenance: sample.provenance,
      configId: config.id,
      scores: {
        antiAIScore: validated.scores.antiAIScore,
        voiceScore: validated.scores.voiceScore,
        behaviorScore: validated.scores.behaviorScore,
        preservationScore: validated.scores.preservationScore,
      },
      unmeasured: [...unmeasured],
      findings: record(validated.rescanned.canonicalFindings),
      suppressedCount: validated.rescanned.suppressed.length,
      detectorsRun: validated.rescanned.detectorsRun,
      abstained: dedupeHolds(validated.rescanned.behaviorAbstained),
      ...(profile ? { profileId: profile.id } : {}),
      preservationMeasured: !unmeasured.has('preservationScore'),
    };
  }

  const scanned = await toolkit.scan({
    text: sample.body,
    language: sample.language === 'unknown' ? undefined : sample.language,
    mode: sample.mode,
    families: config.families,
    ...(profile ? { voiceProfile: profile } : {}),
    ...(conversation ? { conversation } : {}),
  });

  // `preservationScore` needs two texts. With one, it is reported as unmeasured
  // rather than as a pass.
  const unmeasured = new Set<ScoreName>(scanned.scores.unmeasured ?? []);
  unmeasured.add('preservationScore');

  return {
    sampleId: sample.id,
    category: sample.category,
    language: sample.language,
    mode: sample.mode,
    provenance: sample.provenance,
    configId: config.id,
    scores: {
      antiAIScore: scanned.scores.antiAIScore,
      voiceScore: scanned.scores.voiceScore,
      behaviorScore: scanned.scores.behaviorScore,
      preservationScore: scanned.scores.preservationScore,
    },
    unmeasured: [...unmeasured].sort(),
    findings: record(scanned.canonicalFindings),
    suppressedCount: scanned.suppressed.length,
    detectorsRun: scanned.detectorsRun,
    abstained: dedupeHolds(scanned.behaviorAbstained),
    ...(profile ? { profileId: profile.id } : {}),
    preservationMeasured: false,
  };
}

/**
 * One entry per rule/state/source, which is what a report needs.
 *
 * A sample can produce the same abstention from more than one detector pass; the run file
 * records the reason, not the number of times it was reached.
 */
function dedupeHolds(
  holds: readonly { readonly ruleId: string; readonly state: string; readonly source: string }[],
): Array<{ ruleId: string; state: string; source: string }> {
  const seen = new Map<string, { ruleId: string; state: string; source: string }>();
  for (const hold of holds) {
    seen.set(`${hold.ruleId}\u0000${hold.state}\u0000${hold.source}`, {
      ruleId: hold.ruleId,
      state: hold.state,
      source: hold.source,
    });
  }
  return [...seen.values()];
}

function record(
  findings: readonly {
    readonly canonicalRuleId?: string;
    readonly ruleId: string;
    readonly family: string;
    readonly severity: number;
    readonly confidence: number;
    readonly message: string;
  }[],
): FindingRecord[] {
  return findings.map((finding) => ({
    ruleId: finding.canonicalRuleId ?? finding.ruleId,
    family: finding.family,
    severity: finding.severity,
    confidence: Number(finding.confidence.toFixed(3)),
    message: finding.message,
  }));
}

/** Run every configuration against every sample. */
export async function runAll(
  toolkit: Toolkit,
  samples: readonly Sample[],
  configs: readonly AblationConfig[],
  context: RunContext = {},
  onProgress?: (done: number, total: number) => void,
): Promise<SampleResult[]> {
  const results: SampleResult[] = [];
  const total = samples.length * configs.length;
  let done = 0;

  for (const sample of samples) {
    for (const config of configs) {
      results.push(await runSample(toolkit, sample, config, context));
      done += 1;
      onProgress?.(done, total);
    }
  }

  return results;
}
