/**
 * Every registered upstream adapter.
 *
 * Adding a new humanizer project means writing one adapter module and adding it
 * to this list. Nothing else in the suite changes.
 */

import type { UpstreamAdapter } from '../types.js';
import { dshHumanizerAdapter } from './dsh-humanizer/index.js';
import { bladerAdapter } from './blader/index.js';
import { aiHumanizerAdapter } from './ai-humanizer/index.js';
import { humanizerZhAdapter } from './humanizer-zh/index.js';
import { humanizeTextAdapter } from './humanize-text/index.js';
import { humanizerZhCnAdapter } from './humanizer-zh-cn/index.js';
import { op7418Adapter } from './op7418-humanizer-zh/index.js';
import { stopSlopAdapter } from './stop-slop/index.js';

export {
  dshHumanizerAdapter,
  bladerAdapter,
  aiHumanizerAdapter,
  humanizerZhAdapter,
  humanizeTextAdapter,
  humanizerZhCnAdapter,
  op7418Adapter,
  stopSlopAdapter,
};

/** All adapters, in the order the inventory presents them. */
export const ALL_ADAPTERS: readonly UpstreamAdapter[] = [
  dshHumanizerAdapter,
  bladerAdapter,
  aiHumanizerAdapter,
  humanizerZhAdapter,
  humanizeTextAdapter,
  humanizerZhCnAdapter,
  op7418Adapter,
  stopSlopAdapter,
];

export function allAdapters(): UpstreamAdapter[] {
  return [...ALL_ADAPTERS];
}
