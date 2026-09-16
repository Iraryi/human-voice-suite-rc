/**
 * Verbosity control
 *
 * Reply length, over-completeness and the sentence budget a simple answer is allowed.
 *
 * Status: planned for Phase 5. This module exists so the layer has a home
 * and so the planned surface is machine-readable. It implements nothing yet.
 */

export const AREA = 'behavior.verbosity';
export const TARGET_PHASE = 5;

/** Not yet built. */
export const PLANNED: readonly string[] = [
  'length_budget',
  'completeness_check',
  'branch_pruning',
];