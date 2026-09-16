/**
 * Human Voice Suite.
 *
 * A multi-source collection for natural-language human voice, de-AI writing
 * patterns, personal voice learning, chat behaviour fitting and result
 * validation, built for DeepSeek Harness.
 *
 * The layering is the product:
 *
 *   upstreams -> adapters -> canonical rules -> detectors -> voice profile
 *             -> behaviour engine -> rewrite contract -> DSH tool surface
 *
 * Adding a new humanizer project means adding one adapter. Nothing else here
 * should need to change.
 */

// ---- shared primitives ----
export * from './shared/index.js';

// ---- rule layer: the canonical registry and its provenance ----
export * from './rules/index.js';
export type { RuleCandidate, RuleStatus } from './rules/types.js';
export { buildSeedRegistry, seedRuleCandidates } from './rules/canonical/seed.js';
export type { SeedRegistry } from './rules/canonical/seed.js';

// ---- upstream layer: manifest, adapters, sync ----
export * from './upstream/index.js';
export * from './upstream/adapters/index.js';

// ---- detection layer ----
export * from './detector/index.js';

// ---- voice layer ----
export * from './voice/index.js';

// ---- behaviour layer (original to this project) ----
export * from './behavior/index.js';

// ---- rewrite layer ----
export * from './rewrite/index.js';

// ---- validation layer ----
export * from './validation/index.js';

// ---- DeepSeek Harness surface ----
export * from './dsh/index.js';

import { version as packageVersion } from './version.js';

export const VERSION = packageVersion;
