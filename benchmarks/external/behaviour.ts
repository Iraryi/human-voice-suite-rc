/**
 * Behaviour measurement over turn pairs, shared by the corpus tools.
 *
 * Two tools measure the behaviour layer — the fetched public corpus and the
 * isolated LCCC evaluation — and they have to agree about what "assistant-shaped"
 * means, or the side-by-side comparison in `LCCC_EVALUATION.md` would be comparing
 * two definitions rather than two corpora.
 *
 * The generated control comes from the committed benchmark, so the threshold here
 * is the same one `benchmarks/lib/stats.ts` uses.
 */

import type { Finding } from '../../src/detector/types.js';

/** Below this a reply behaves like an assistant. */
export const ASSISTANT_SHAPED = 0.75;

export interface BehaviourRow {
  readonly label: string;
  pairs: number;
  /** Pairs whose behaviorScore fell below {@link ASSISTANT_SHAPED}. */
  assistantShaped: number;
  readonly smells: Map<string, number>;
  readonly scores: number[];
}

export function emptyBehaviourRow(label: string): BehaviourRow {
  return { label, pairs: 0, assistantShaped: 0, smells: new Map(), scores: [] };
}

export function recordBehaviour(
  row: BehaviourRow,
  behaviorScore: number,
  findings: readonly Finding[],
): void {
  row.pairs += 1;
  row.scores.push(behaviorScore);
  if (behaviorScore < ASSISTANT_SHAPED) row.assistantShaped += 1;
  for (const finding of findings) {
    const ruleId = finding.canonicalRuleId ?? finding.ruleId;
    row.smells.set(ruleId, (row.smells.get(ruleId) ?? 0) + 1);
  }
}
