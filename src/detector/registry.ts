/**
 * The runtime detector registry.
 *
 * `catalog.ts` declares the plan; this module holds what actually runs. Keeping
 * them apart means the catalog can honestly describe unbuilt layers while the
 * scan uses only real ones.
 */

import { CanonicalRuleRegistry } from '../rules/canonical/registry.js';
import type { Detector } from './types.js';
import { createLexicalDetector } from './lexical/rule-driven.js';
import { createTemplateDetector } from './shared/template-detector.js';
import { createStructuralDetectors } from './structural/index.js';
import { createRhythmDetectors } from './rhythm/index.js';
import { createChineseDetectors } from './chinese/index.js';
import { createEnglishDetectors } from './english/index.js';
import { createStylometryDetectors } from './stylometry/index.js';
import { createAssistantSmellDetector } from '../behavior/assistant-smell/index.js';
import { weakAloneRuleIds } from './suppression.js';

export interface DefaultDetectorOptions {
  /**
   * Rule ids to leave out entirely. Rarely needed: preference is to let the
   * suppression layer filter findings so that the suppression itself stays
   * observable.
   */
  readonly excludeRuleIds?: ReadonlySet<string>;
}

/**
 * Every detector that is implemented and safe to run.
 *
 * Order matters only for the finding ceiling. The lexical and template
 * detectors come first because they cover the most rules; the statistical
 * detector comes last because it is the least certain and its findings carry
 * low confidence by design.
 */
export function createDefaultDetectors(options: DefaultDetectorOptions = {}): Detector[] {
  return [
    createLexicalDetector(
      options.excludeRuleIds ? { excludeRuleIds: options.excludeRuleIds } : {},
    ),
    createTemplateDetector(),
    ...createStructuralDetectors(),
    ...createRhythmDetectors(),
    ...createChineseDetectors(),
    ...createEnglishDetectors(),
    ...createStylometryDetectors(),
    // The assistant-behaviour detector is last because it is the only one that
    // needs a conversation rather than a document. It runs on a single reply too,
    // and then says which of the ten it could not judge.
    createAssistantSmellDetector(),
  ];
}

/** The ids of every detector `createDefaultDetectors` returns. */
export function defaultDetectorIds(): string[] {
  return createDefaultDetectors().map((detector) => detector.id);
}

/** Ids the registry marks as needing corroboration, ready for the suppression pass. */
export function weakAloneIds(registry: CanonicalRuleRegistry): Set<string> {
  return weakAloneRuleIds(registry.list());
}
