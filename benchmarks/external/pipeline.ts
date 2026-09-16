/**
 * The prose pipeline, as one call.
 *
 * `scan` is built for a caller that wants every finding and every count. Measuring
 * a corpus wants one thing: the canonical findings and the `antiAIScore` for a
 * text, under a named set of families. This wraps that so the external measurement
 * and any future corpus tool agree about what "the prose detectors" means instead
 * of each listing the families itself.
 *
 * The assistant family is deliberately absent. Behaviour is judged against the
 * conversation, and a corpus of replies to a topic is not a conversation — see the
 * limitations in `EXTERNAL_CORPUS_RESULTS.md`.
 */

import type { Toolkit } from '../../src/dsh/tools/runtime.js';
import type { DetectorFamily, Finding } from '../../src/detector/types.js';
import type { TextMode } from '../../src/shared/types.js';

export const ANTI_AI_PIPELINE_FAMILIES: readonly DetectorFamily[] = [
  'lexical',
  'structural',
  'rhythm',
  'chinese',
  'english',
  'stylometry',
];

export interface PipelineResult {
  readonly findings: readonly Finding[];
  readonly scores: { readonly antiAIScore: number };
}

export async function runPipeline(
  toolkit: Toolkit,
  text: string,
  options: { readonly mode: TextMode; readonly families: readonly DetectorFamily[] },
): Promise<PipelineResult> {
  const scanned = await toolkit.scan({
    text,
    mode: options.mode,
    families: options.families,
  });
  return { findings: scanned.canonicalFindings, scores: { antiAIScore: scanned.scores.antiAIScore } };
}
