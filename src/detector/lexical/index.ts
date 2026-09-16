/**
 * Lexical detector family
 *
 * Word and phrase level tells, driven by upstream lexicons rather than invented lists.
 *
 * Status: planned for Phase 2. This module exists so the layer has a home
 * and so the planned surface is machine-readable. It implements nothing yet:
 * the live detector list comes from `src/detector/catalog.ts` and the slots
 * below are the ones this family owns.
 */

import type { DetectorFamily } from '../types.js';
import { catalogForFamily } from '../catalog.js';
import type { DetectorSlot } from '../catalog.js';

export const FAMILY: DetectorFamily = 'lexical';
export const TARGET_PHASE = 2;

/** Detector slots that land in this module, sourced from the catalog. */
export const PLANNED_SLOTS: readonly DetectorSlot[] = catalogForFamily(FAMILY);

/** Detector slots this family owns that are already implemented. */
export function readySlots(): DetectorSlot[] {
  return PLANNED_SLOTS.filter((slot) => slot.status === 'ready');
}