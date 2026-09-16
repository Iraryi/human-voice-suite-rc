/**
 * Preservation directives
 *
 * Builds the preserve list from protected content and enforces it across passes.
 *
 * Status: planned for Phase 4. This module exists so the layer has a home
 * and so the planned surface is machine-readable. It implements nothing yet.
 */

export const AREA = 'rewrite.preserve';
export const TARGET_PHASE = 4;

/** Not yet built. */
export const PLANNED: readonly string[] = [
  'directive_building',
  'occurrence_tracking',
  'exactness_policy',
];