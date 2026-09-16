/**
 * The canonical signature vocabulary.
 *
 * Three adapters are written independently against this list. If two of them
 * pick different ids for one tell, deduplication fails silently and the tell is
 * charged twice — which is the exact failure the whole project exists to
 * prevent. So the vocabulary itself is tested.
 */

import { describe, expect, it } from 'vitest';

import {
  CANONICAL_SIGNATURES,
  SIGNATURE_INDEX,
  UnknownSignatureError,
  assertKnownSignature,
  isKnownSignature,
  signatureSpec,
  signaturesByCategory,
  unmappedSignature,
} from '../src/rules/canonical/signatures.js';
import type { RuleCategory } from '../src/rules/canonical/signatures.js';
import { isValidId } from '../src/shared/types.js';
import { ASSISTANT_SMELL_IDS } from '../src/behavior/types.js';

const CATEGORIES: readonly RuleCategory[] = [
  'structural',
  'lexical',
  'rhythm',
  'formatting',
  'assistant',
  'chat',
  'chinese',
  'stylometry',
];

describe('vocabulary integrity', () => {
  it('is non-empty and has no duplicate ids', () => {
    expect(CANONICAL_SIGNATURES.length).toBeGreaterThan(50);
    const ids = CANONICAL_SIGNATURES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses only valid dotted snake_case ids', () => {
    for (const spec of CANONICAL_SIGNATURES) {
      expect(isValidId(spec.id), spec.id).toBe(true);
    }
  });

  it('prefixes every id with its own category', () => {
    // `lexical.negative_listing` was moved to `rhythm` precisely because a
    // category and an id that disagree are a routing bug waiting to happen.
    for (const spec of CANONICAL_SIGNATURES) {
      expect(spec.id.split('.')[0], spec.id).toBe(spec.category);
    }
  });

  it('uses only known categories', () => {
    for (const spec of CANONICAL_SIGNATURES) {
      expect(CATEGORIES, spec.id).toContain(spec.category);
    }
  });

  it('states what each tell means and which languages it applies to', () => {
    for (const spec of CANONICAL_SIGNATURES) {
      expect(spec.means.length, spec.id).toBeGreaterThan(15);
      expect(spec.languages.length, spec.id).toBeGreaterThan(0);
      for (const language of spec.languages) {
        expect(['en', 'zh', 'unknown']).toContain(language);
      }
    }
  });

  it('indexes every signature', () => {
    for (const spec of CANONICAL_SIGNATURES) {
      expect(SIGNATURE_INDEX.get(spec.id)).toBe(spec);
      expect(isKnownSignature(spec.id)).toBe(true);
      expect(signatureSpec(spec.id)?.category).toBe(spec.category);
    }
  });
});

describe('the chat signatures and the behaviour taxonomy are the same rules', () => {
  it('matches the assistant smell ids exactly', () => {
    // A chat finding and a taxonomy entry must resolve to one rule, not two.
    // Duplicating the ten ids here would let them drift apart.
    const chatSignatures = CANONICAL_SIGNATURES.filter((s) => s.category === 'chat')
      .map((s) => s.id)
      .sort();
    expect(chatSignatures).toEqual([...ASSISTANT_SMELL_IDS].sort());
  });

  it('has ten of them', () => {
    expect(CANONICAL_SIGNATURES.filter((s) => s.category === 'chat')).toHaveLength(10);
  });
});

describe('expected overlaps are present', () => {
  it('offers one signature for the tells several upstreams share', () => {
    // Each of these is claimed by at least two upstreams in the corpus. If one
    // went missing, the lineage would stop collapsing.
    for (const id of [
      'structural.negation_contrast',
      'structural.inflated_significance',
      'structural.one_line_closer',
      'rhythm.forced_triad',
      'rhythm.dash_overuse',
      'lexical.ai_vocabulary',
      'lexical.stacked_qualifiers',
      'lexical.vague_attribution',
      'assistant.chatbot_residue',
      'assistant.knowledge_limit_disclaimer',
      'formatting.bold_decoration',
      'formatting.curly_quotes',
    ]) {
      expect(isKnownSignature(id), id).toBe(true);
    }
  });

  it('keeps the weak-alone tells the upstream marks', () => {
    for (const id of ['rhythm.dash_overuse', 'lexical.passive_and_subjectless', 'formatting.curly_quotes']) {
      expect(signatureSpec(id)?.means.toLowerCase(), id).toMatch(/weak alone|corroborat/);
    }
  });
});

describe('assertKnownSignature', () => {
  it('accepts a known signature', () => {
    expect(() => assertKnownSignature('lexical.ai_vocabulary', 'test')).not.toThrow();
  });

  it('rejects an unknown signature and names the context', () => {
    expect(() => assertKnownSignature('lexical.invented_thing', 'blader pattern 99')).toThrow(
      UnknownSignatureError,
    );
    try {
      assertKnownSignature('lexical.invented_thing', 'blader pattern 99');
    } catch (error) {
      expect((error as UnknownSignatureError).context).toBe('blader pattern 99');
      expect((error as Error).message).toContain('CANONICAL_SIGNATURES');
    }
  });

  it('rejects an id that is not dotted snake_case', () => {
    expect(() => assertKnownSignature('Lexical Thing', 'test')).toThrow(UnknownSignatureError);
  });
});

describe('unmappedSignature', () => {
  it('produces a valid id so an unmapped rule does not break the registry', () => {
    const id = unmappedSignature('blader-humanizer', '99');
    expect(isValidId(id)).toBe(true);
    expect(id).toBe('upstream.blader_humanizer_99');
  });

  it('is deliberately not a known signature, so it is reported as a problem', () => {
    expect(isKnownSignature(unmappedSignature('x', '1'))).toBe(false);
  });

  it('handles a rule id with characters that are not id-safe', () => {
    const id = unmappedSignature('ai-humanizer', 'em-dash-overuse');
    expect(isValidId(id)).toBe(true);
    expect(id).toBe('upstream.ai_humanizer_em_dash_overuse');
  });
});

describe('signaturesByCategory', () => {
  it('groups every signature and loses none', () => {
    const grouped = signaturesByCategory();
    const total = [...grouped.values()].reduce((sum, list) => sum + list.length, 0);
    expect(total).toBe(CANONICAL_SIGNATURES.length);
  });
});
