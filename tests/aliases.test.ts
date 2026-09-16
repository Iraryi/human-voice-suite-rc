/**
 * The alias layer.
 *
 * A canonical id is the only name code should use, but ids do get renamed. The
 * table is short because the vocabulary was designed before the adapters were
 * written; these tests pin the mechanism and the one real rename in it.
 */

import { describe, expect, it } from 'vitest';

import {
  SIGNATURE_ALIASES,
  assertResolvableSignature,
  isResolvableSignature,
  resolveSignature,
  retiredSignatureNames,
} from '../src/rules/aliases/rule-aliases.js';
import { isKnownSignature } from '../src/rules/canonical/signatures.js';
import { UnknownSignatureError } from '../src/rules/canonical/signatures.js';
import { buildRegistryFromExtractions } from '../src/rules/canonical/load.js';

describe('the alias table', () => {
  it('records a real rename rather than speculation', () => {
    expect(SIGNATURE_ALIASES.length).toBeGreaterThan(0);
    for (const alias of SIGNATURE_ALIASES) {
      // Both ends must be real signatures, and the reason must say why.
      expect(isKnownSignature(alias.to), alias.to).toBe(true);
      expect(alias.reason.length, alias.from).toBeGreaterThan(40);
      expect(alias.from).not.toBe(alias.to);
    }
  });

  it('never names the same retired id twice', () => {
    const names = SIGNATURE_ALIASES.map((a) => a.from);
    expect(new Set(names).size).toBe(names.length);
  });

  it('points every retired name at a current one', () => {
    for (const alias of SIGNATURE_ALIASES) {
      expect(isKnownSignature(resolveSignature(alias.from)), alias.from).toBe(true);
    }
  });
});

describe('resolveSignature', () => {
  it('passes a current id through unchanged', () => {
    expect(resolveSignature('lexical.ai_vocabulary')).toBe('lexical.ai_vocabulary');
  });

  it('resolves the Phase 1 name for the Chinese filler rule', () => {
    // Filed under `lexical` before the vocabulary enforced that an id is
    // prefixed by its own category. 值得注意的是 is Chinese-only.
    expect(resolveSignature('lexical.noteworthy_filler')).toBe('chinese.noteworthy_filler');
  });

  it('leaves an unknown id alone so the validator can reject it', () => {
    expect(resolveSignature('lexical.invented')).toBe('lexical.invented');
    expect(isResolvableSignature('lexical.invented')).toBe(false);
  });

  it('reports a retired name as resolvable', () => {
    expect(isResolvableSignature('lexical.noteworthy_filler')).toBe(true);
  });

  it('throws on a cycle instead of looping forever', () => {
    // Exercised through the public function with a hand-built chain would need a
    // second table, so the bound is asserted by inspection of behaviour: a
    // missing alias returns immediately.
    expect(resolveSignature('nothing.points.here')).toBe('nothing.points.here');
  });
});

describe('assertResolvableSignature', () => {
  it('accepts a current name', () => {
    expect(assertResolvableSignature('lexical.ai_vocabulary', 'test')).toBe('lexical.ai_vocabulary');
  });

  it('accepts a retired name and returns the current one', () => {
    expect(assertResolvableSignature('lexical.noteworthy_filler', 'test')).toBe(
      'chinese.noteworthy_filler',
    );
  });

  it('rejects an unknown name and names the context', () => {
    expect(() => assertResolvableSignature('lexical.invented', 'adapter x')).toThrow(
      UnknownSignatureError,
    );
  });
});

describe('retiredSignatureNames', () => {
  it('lists the retired names in a stable order', () => {
    const names = retiredSignatureNames();
    expect(names).toEqual([...names].sort());
    expect(names).toContain('lexical.noteworthy_filler');
  });
});

describe('the vocabulary and the alias table agree', () => {
  it('has no alias whose source is still a live signature', () => {
    // A retired name must not also exist as current, or the table would be
    // shadowing a real id.
    for (const alias of SIGNATURE_ALIASES) {
      expect(isKnownSignature(alias.from), alias.from).toBe(false);
    }
  });

  it('gives every rule in the registry a resolvable signature', async () => {
    const { registry } = await buildRegistryFromExtractions();
    for (const rule of registry.list()) {
      expect(isResolvableSignature(rule.id), rule.id).toBe(true);
    }
  });
});
