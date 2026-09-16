/**
 * Anti-AI validation
 *
 * Re-scans the rewrite and confirms fewer canonical rules fire than before.
 *
 * Status: planned for Phase 4. This module exists so the layer has a home
 * and so the planned surface is machine-readable. It implements nothing yet.
 */

export const AREA = 'validation.anti-ai';
export const TARGET_PHASE = 4;

/** Not yet built. */
export const PLANNED: readonly string[] = [
  'rescan_comparison',
  'regression_check',
];