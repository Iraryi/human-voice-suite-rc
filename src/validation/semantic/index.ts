/**
 * Semantic validation
 *
 * Checks that meaning survived and that nothing was invented.
 *
 * Status: planned for Phase 4. This module exists so the layer has a home
 * and so the planned surface is machine-readable. It implements nothing yet.
 */

export const AREA = 'validation.semantic';
export const TARGET_PHASE = 4;

/** Not yet built. */
export const PLANNED: readonly string[] = [
  'claim_presence',
  'no_new_facts',
  'drift_detection',
];