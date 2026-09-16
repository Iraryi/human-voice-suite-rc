/**
 * Conversation behaviour modelling
 *
 * Follow-up timing, deliberate omission, self-correction style and topic jumps.
 *
 * Status: planned for Phase 5. This module exists so the layer has a home
 * and so the planned surface is machine-readable. It implements nothing yet.
 */

export const AREA = 'behavior.conversation';
export const TARGET_PHASE = 5;

/** Not yet built. */
export const PLANNED: readonly string[] = [
  'follow_up_model',
  'omission_model',
  'self_correction_model',
];