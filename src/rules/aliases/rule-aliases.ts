/**
 * Rule aliases.
 *
 * A canonical id is the only name that should appear in code, but ids do get
 * renamed — a signature turns out to describe the wrong family, a rule is
 * retargeted — and references to the old name must keep resolving. Renaming in
 * place would break every stored finding, every generated file and every
 * historical report.
 *
 * So a rename adds an entry here and never edits history. `resolveSignature`
 * applies the table; `assertResolvableSignature` validates the result against
 * the vocabulary.
 *
 * The table is short on purpose. The signature vocabulary was designed before
 * the adapters were written, so most rules have never needed a second name; what
 * is here is the record of the renames that did happen.
 */

import { isKnownSignature } from '../canonical/signatures.js';
import { assertKnownSignature } from '../canonical/signatures.js';

export interface SignatureAlias {
  /** The retired name. */
  readonly from: string;
  /** The name that replaced it. */
  readonly to: string;
  readonly reason: string;
}

/**
 * Retired signature names and what replaced them.
 *
 * Each entry is a real rename, not speculation. Adding one is how a rename is
 * done: the old name stays resolvable forever and nothing that recorded it has
 * to be rewritten.
 */
export const SIGNATURE_ALIASES: readonly SignatureAlias[] = [
  {
    from: 'lexical.noteworthy_filler',
    to: 'chinese.noteworthy_filler',
    reason:
      'The tell was filed under `lexical` during Phase 1, before the vocabulary enforced that ' +
      'a signature id must be prefixed by its own category. 值得注意的是 is Chinese-only, so ' +
      '`chinese` is where it belongs. The Phase 1 seed still refers to the old name.',
  },
];

const ALIAS_INDEX: ReadonlyMap<string, string> = new Map(
  SIGNATURE_ALIASES.map((alias) => [alias.from, alias.to]),
);

/**
 * Apply the alias table and return the current name.
 *
 * Chains are followed, so an alias pointing at another alias still resolves.
 * A cycle would loop forever, so the walk is bounded and throws instead.
 */
export function resolveSignature(id: string): string {
  let current = id;
  const seen = new Set<string>([current]);
  for (let hop = 0; hop < 8; hop += 1) {
    const next = ALIAS_INDEX.get(current);
    if (next === undefined) return current;
    if (seen.has(next)) {
      throw new Error(`Signature alias cycle: ${[...seen, next].join(' -> ')}`);
    }
    seen.add(next);
    current = next;
  }
  throw new Error(`Signature alias chain longer than 8 hops starting at ${JSON.stringify(id)}`);
}

/** True when the id is either current or a known retired name. */
export function isResolvableSignature(id: string): boolean {
  return isKnownSignature(resolveSignature(id));
}

/** Resolve, then validate against the vocabulary, naming the context on failure. */
export function assertResolvableSignature(id: string, context: string): string {
  const resolved = resolveSignature(id);
  assertKnownSignature(resolved, context);
  return resolved;
}

/** Every retired name, for a report or a migration listing. */
export function retiredSignatureNames(): string[] {
  return SIGNATURE_ALIASES.map((alias) => alias.from).sort();
}
