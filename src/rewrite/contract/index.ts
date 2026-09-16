/**
 * Rewrite contract layer.
 *
 * The contract types, builder and agent renderer already live in
 * `../contract.ts`. This module re-exports them so the rewrite layer has the
 * directory the architecture calls for, and declares what is still missing.
 */

export * from '../contract.js';

export const TARGET_PHASE = 4;

/** Not yet built. */
export const PLANNED: readonly string[] = [
  'contract_validation',
  'contract_serialisation',
];
