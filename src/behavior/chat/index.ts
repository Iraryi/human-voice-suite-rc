/**
 * Chat behaviour engine
 *
 * Conversation-level fitting. Decides what a reply should do, not just how it should read.
 *
 * Status: planned for Phase 5. This module exists so the layer has a home
 * and so the planned surface is machine-readable. It implements nothing yet.
 */

export const AREA = 'behavior.chat';
export const TARGET_PHASE = 5;

/** Not yet built. */
export const PLANNED: readonly string[] = [
  'turn_classification',
  'reply_shape',
  'baseline_application',
];