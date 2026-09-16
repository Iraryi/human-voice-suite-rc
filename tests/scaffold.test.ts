/**
 * The project skeleton.
 *
 * Phase 1 scaffolded every layer the architecture calls for, with a machine
 * readable statement of what lands there and in which phase. These tests stop
 * the scaffold and the detector catalog from drifting apart, which would make
 * the plan a lie.
 */

import { describe, expect, it } from 'vitest';

import { DETECTOR_CATALOG, catalogForFamily } from '../src/detector/catalog.js';
import { DETECTOR_FAMILIES } from '../src/detector/types.js';

import * as structural from '../src/detector/structural/index.js';
import * as lexical from '../src/detector/lexical/index.js';
import * as rhythm from '../src/detector/rhythm/index.js';
import * as assistant from '../src/detector/assistant/index.js';
import * as stylometry from '../src/detector/stylometry/index.js';
import * as chinese from '../src/detector/chinese/index.js';
import * as english from '../src/detector/english/index.js';

import * as voiceFingerprint from '../src/voice/fingerprint/index.js';
import * as voiceProfile from '../src/voice/profile/index.js';
import * as voiceScoring from '../src/voice/scoring/index.js';
import * as voiceImport from '../src/voice/import/index.js';
import * as voiceAdaptation from '../src/voice/adaptation/index.js';
import * as behaviorChat from '../src/behavior/chat/index.js';
import * as behaviorConversation from '../src/behavior/conversation/index.js';
import * as behaviorVerbosity from '../src/behavior/verbosity/index.js';
import * as behaviorInteraction from '../src/behavior/interaction/index.js';
import * as rewritePlanner from '../src/rewrite/planner/index.js';
import * as ruleAliases from '../src/rules/aliases/index.js';
import * as behaviorAssistantSmell from '../src/behavior/assistant-smell/index.js';
import { markersFor } from '../src/behavior/assistant-smell/markers.js';
import * as dshPrompt from '../src/dsh/prompt/index.js';
import * as compatibilityVersion from '../src/compatibility/upstream-version/index.js';
import * as compatibilityMigrations from '../src/compatibility/migrations/index.js';
import * as rewritePreserve from '../src/rewrite/preserve/index.js';
import * as rewriteContract from '../src/rewrite/contract/index.js';
import * as validationSemantic from '../src/validation/semantic/index.js';
import * as validationVoice from '../src/validation/voice/index.js';
import * as validationAntiAi from '../src/validation/anti-ai/index.js';
import * as validationBehavior from '../src/validation/behavior/index.js';

const FAMILY_MODULES = {
  structural,
  lexical,
  rhythm,
  assistant,
  stylometry,
  chinese,
  english,
} as const;

interface ScaffoldModule {
  readonly TARGET_PHASE: number;
  readonly PLANNED: readonly string[];
}

const PLANNED_MODULES: ReadonlyArray<readonly [string, ScaffoldModule]> = [
  ['behavior/chat', behaviorChat],
  ['behavior/conversation', behaviorConversation],
  ['behavior/verbosity', behaviorVerbosity],
  ['behavior/interaction', behaviorInteraction],
  ['rewrite/planner', rewritePlanner],
  ['rewrite/preserve', rewritePreserve],
  ['rewrite/contract', rewriteContract],
  ['validation/semantic', validationSemantic],
  ['validation/anti-ai', validationAntiAi],
];

/**
 * Layers that were scaffolded and have since been built.
 *
 * When a layer lands, its planned stub is replaced here by assertions about what
 * it now exports rather than the entry being deleted. Otherwise the plan and the
 * code drift apart, which is what this file exists to prevent.
 */
const BUILT_MODULES: ReadonlyArray<readonly [string, { readonly TARGET_PHASE: number }]> = [
  ['voice/fingerprint', voiceFingerprint],
  ['voice/profile', voiceProfile],
  ['voice/scoring', voiceScoring],
  ['voice/import', voiceImport],
  ['voice/adaptation', voiceAdaptation],
  ['validation/voice', validationVoice],
  ['validation/behavior', validationBehavior],
];

describe('detector family modules', () => {
  it('has a module for every detector family', () => {
    expect(Object.keys(FAMILY_MODULES).sort()).toEqual([...DETECTOR_FAMILIES].sort());
  });

  it('each declares the family it owns', () => {
    for (const [name, module] of Object.entries(FAMILY_MODULES)) {
      expect(module.FAMILY).toBe(name);
    }
  });

  it('each draws its planned slots from the catalog rather than duplicating them', () => {
    for (const [name, module] of Object.entries(FAMILY_MODULES)) {
      expect(module.PLANNED_SLOTS).toEqual(catalogForFamily(module.FAMILY));
      expect(module.PLANNED_SLOTS.length).toBeGreaterThan(0);
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('reports ready slots only in the families that are actually implemented', () => {
    const ready = Object.entries(FAMILY_MODULES)
      .filter(([, module]) => module.readySlots().length > 0)
      .map(([name]) => name)
      .sort();
    // Phase 2 built six families and Phase 5 built the seventh. Every family in
    // the catalog now has something behind it.
    expect(ready).toEqual([
      'assistant',
      'chinese',
      'english',
      'lexical',
      'rhythm',
      'structural',
      'stylometry',
    ]);
    expect(structural.readySlots().length).toBeGreaterThan(0);
    expect(assistant.readySlots().length).toBeGreaterThan(0);
  });

  it('covers the whole catalog, with no slot belonging to no family', () => {
    const covered = Object.values(FAMILY_MODULES).flatMap((m) =>
      m.PLANNED_SLOTS.map((s) => s.id),
    );
    expect(covered.sort()).toEqual(DETECTOR_CATALOG.map((s) => s.id).sort());
  });
});

describe('planned layer modules', () => {
  it('declares a target phase inside the eight-phase plan', () => {
    for (const [path, module] of PLANNED_MODULES) {
      expect(module.TARGET_PHASE, path).toBeGreaterThanOrEqual(1);
      expect(module.TARGET_PHASE, path).toBeLessThanOrEqual(8);
    }
  });

  it('names what will land there, so the plan is not empty', () => {
    for (const [path, module] of PLANNED_MODULES) {
      expect(module.PLANNED.length, path).toBeGreaterThan(0);
      for (const item of module.PLANNED) {
        expect(item.length, `${path}: ${item}`).toBeGreaterThan(0);
        expect(item).toMatch(/^[a-z][a-z0-9_]*$/);
      }
    }
  });

  it('does not schedule original behaviour work before its phase', () => {
    // The behaviour engine is Phase 5 by design; scheduling it earlier would
    // mean the voice and detector layers it depends on are not ready.
    expect(behaviorChat.TARGET_PHASE).toBe(5);
    expect(behaviorAssistantSmell.TARGET_PHASE).toBe(5);
    expect(behaviorConversation.TARGET_PHASE).toBe(5);
    expect(validationSemantic.TARGET_PHASE).toBe(4);
    expect(voiceFingerprint.TARGET_PHASE).toBe(6);
  });

  it('declares AREA for every module that is not the contract barrel', () => {
    for (const [path, module] of PLANNED_MODULES) {
      if (path === 'rewrite/contract') continue;
      expect((module as { AREA?: string }).AREA, path).toMatch(/^[a-z]+(\.[a-z-]+)+$/);
    }
  });
});

describe('layers that were scaffolded and are now built', () => {
  it('keeps every built layer inside the eight-phase plan', () => {
    for (const [path, module] of BUILT_MODULES) {
      expect(module.TARGET_PHASE, path).toBeGreaterThanOrEqual(1);
      expect(module.TARGET_PHASE, path).toBeLessThanOrEqual(8);
    }
  });

  it('has no module that is both planned and built', () => {
    const planned = new Set(PLANNED_MODULES.map(([path]) => path));
    for (const [path] of BUILT_MODULES) {
      expect(planned.has(path), path).toBe(false);
    }
  });

  it('replaced the voice stubs with real exports', () => {
    // A stub that still exports PLANNED would mean the layer never landed.
    expect('PLANNED' in voiceFingerprint).toBe(false);
    expect('PLANNED' in voiceScoring).toBe(false);
    expect('PLANNED' in voiceProfile).toBe(false);
    expect('PLANNED' in voiceImport).toBe(false);
    expect('PLANNED' in voiceAdaptation).toBe(false);
    expect('PLANNED' in validationBehavior).toBe(false);
    expect('PLANNED' in validationVoice).toBe(false);
  });

  it('exports the surface each built layer promises', () => {
    expect(voiceFingerprint.extractFingerprint('Hello there. This is a test.').stats.sentenceCount)
      .toBeGreaterThan(0);
    expect(voiceFingerprint.summariseDistribution([1, 2, 3]).median).toBe(2);
    expect(voiceScoring.DIMENSION_WEIGHTS.sentenceLength).toBeGreaterThan(0);
    expect(voiceAdaptation.HAZARD_PATTERNS.length).toBeGreaterThan(0);
    expect(voiceImport.AUTHOR_VOICE_FILES).toHaveLength(8);
    expect(voiceImport.EXPECTED_RULES).toBe(12);
    expect(validationBehavior.BEHAVIOR_PENALTY_BUDGET).toBeGreaterThan(0);
    expect(validationVoice.VOICE_REGRESSION_TOLERANCE).toBeGreaterThan(0);
    expect(voiceProfile.profileFileName('user/chat')).toBe('user__chat.json');
  });
});

describe('the assistant behaviour layer', () => {
  it('is built, and declares a marker list for every smell', () => {
    expect(behaviorAssistantSmell.TARGET_PHASE).toBe(5);
    expect(behaviorAssistantSmell.smellIds()).toHaveLength(10);
    for (const id of behaviorAssistantSmell.smellIds()) {
      expect(markersFor(id).length, id).toBeGreaterThan(0);
    }
  });

  it('says which smells a single reply cannot be judged for', () => {
    // Mirroring and over-completeness are relationships, not forms.
    expect(behaviorAssistantSmell.unjudgedSmells({})).toEqual([
      'chat.mirrors_user',
      'chat.over_completeness',
    ]);
    expect(behaviorAssistantSmell.unjudgedSmells({ userTurn: 'hi' })).toEqual([]);
  });
});

describe('the prompt layer', () => {
  it('frames every text mode it can be asked about', () => {
    expect(dshPrompt.TARGET_PHASE).toBe(4);
    expect(dshPrompt.framedModes().sort()).toEqual(
      ['chat', 'formal', 'prose', 'public', 'technical', 'unknown'].sort(),
    );
  });

  it('states what a strategy deliberately disables', () => {
    expect(dshPrompt.strategyCaveat('technical')).toMatch(/precision/i);
    expect(dshPrompt.strategyCaveat('formal')).toMatch(/passive/i);
    expect(dshPrompt.strategyCaveat('en-prose')).toBeUndefined();
  });
});

describe('the compatibility layer', () => {
  it('is built, so it is no longer a planned module', () => {
    expect(compatibilityVersion.TARGET_PHASE).toBe(3);
    expect(compatibilityVersion.BLADER_REVISIONS.length).toBe(3);
    expect(compatibilityVersion.BLADER_V291_TITLES.length).toBe(33);
    expect(compatibilityMigrations.TARGET_PHASE).toBe(3);
    expect(compatibilityMigrations.MIGRATIONS.length).toBe(2);
  });
});

describe('the alias layer', () => {
  it('is built, so it is no longer a planned module', () => {
    expect(ruleAliases.TARGET_PHASE).toBe(3);
    expect(ruleAliases.SIGNATURE_ALIASES.length).toBeGreaterThan(0);
    expect(Object.keys(ruleAliases.PHRASE_OWNER_OVERRIDES).length).toBeGreaterThan(0);
  });
});

describe('catalog integrity', () => {
  it('gives every slot an id whose prefix matches its family', () => {
    for (const slot of DETECTOR_CATALOG) {
      expect(slot.id.split('.')[0]).toBe(slot.family);
    }
  });

  it('has no duplicate slot ids', () => {
    const ids = DETECTOR_CATALOG.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('attributes every slot to at least one source', () => {
    for (const slot of DETECTOR_CATALOG) {
      expect(slot.sources.length).toBeGreaterThan(0);
      expect(slot.description.length).toBeGreaterThan(20);
    }
  });

  it('schedules every slot within the eight-phase plan', () => {
    for (const slot of DETECTOR_CATALOG) {
      expect(slot.targetPhase).toBeGreaterThanOrEqual(2);
      expect(slot.targetPhase).toBeLessThanOrEqual(8);
    }
  });

  it('marks a slot ready only once a detector actually implements it', () => {
    const ready = DETECTOR_CATALOG.filter((slot) => slot.status === 'ready');
    // A ready slot must name a phase that has actually been built. Phases 2, 5,
    // 6 and 8 are complete; a ready slot pointing at phase 7 would mean the
    // catalog is claiming something ships that has not been written. This
    // assertion was a comment for one commit and caught nothing in that time,
    // which is exactly why it is an assertion again.
    const builtPhases = [2, 5, 6, 8];
    for (const slot of ready) {
      expect(builtPhases, slot.id).toContain(slot.targetPhase);
      expect(slot.sources.length, slot.id).toBeGreaterThan(0);
    }
    expect(ready.length).toBe(DETECTOR_CATALOG.length);
  });

  it('has built the behaviour slots, which were the last unbuilt family', () => {
    const assistantSlots = DETECTOR_CATALOG.filter((slot) => slot.family === 'assistant');
    expect(assistantSlots.length).toBeGreaterThan(0);
    for (const slot of assistantSlots) {
      expect(slot.status, slot.id).toBe('ready');
    }
  });
  it('has built every slot it declared, so nothing is left advertised and unbuilt', () => {
    // Phase 1 declared the catalog; Phase 8 filled its last slot. The suite now
    // ships every capability the catalog names, which is the condition this test
    // was written to be able to check.
    const partial = DETECTOR_CATALOG.filter((slot) => slot.status === 'partial');
    expect(partial).toEqual([]);
    const planned = DETECTOR_CATALOG.filter((slot) => slot.status === 'planned');
    expect(planned).toEqual([]);
    // `chinese.translationese` was the last one: declared in Phase 1, and
    // answered by no rule until the benchmark showed a category built for it
    // firing on nothing.
    expect(DETECTOR_CATALOG.some((slot) => slot.id === 'chinese.translationese')).toBe(true);
  });
});
