/**
 * Rewrite planner
 *
 * Turns a scan result plus a strategy into an ordered, budgeted plan of edits.
 *
 * Status: planned for Phase 4. This module exists so the layer has a home
 * and so the planned surface is machine-readable. It implements nothing yet.
 */

export const AREA = 'rewrite.planner';
export const TARGET_PHASE = 4;

/** Not yet built. */
export const PLANNED: readonly string[] = [
  'edit_ordering',
  'scope_limiting',
  'budget_allocation',
];