/**
 * Rule-level provenance.
 *
 * The suite never settles for a README "thanks to Humanizer". Every canonical
 * rule must be able to answer: which upstream did this come from, was it
 * changed on the way in, and did we invent anything ourselves.
 */

/**
 * A pointer back to the exact place an upstream stated a rule.
 *
 * All fields except `upstream` are optional because upstreams record rules in
 * wildly different ways: some have machine ids in a registry file, some have a
 * numbered heading in Markdown, some only have a sentence in a prompt.
 */
export interface SourceReference {
  /** Manifest key of the upstream, e.g. `blader/humanizer`. */
  upstream: string;
  /** The upstream's own identifier, verbatim, e.g. `12` or `generic_opener`. */
  ruleId?: string;
  /** Where to look, e.g. `SKILL.md:214` or `references/patterns.md#5`. */
  locator?: string;
  /** Verbatim quoted text from the upstream, for auditability. */
  quote?: string;
  /** True when the suite changed the meaning, scope or wording on import. */
  modified?: boolean;
  /** Free-form note, e.g. what was changed. */
  note?: string;
}

export type LocalChangeKind =
  | 'added'
  | 'modified'
  | 'removed'
  | 'split'
  | 'merged'
  | 'retargeted'
  | 'translated';

/**
 * A change made by Human Voice Suite itself, as opposed to inherited from an
 * upstream. Section 14 of the project brief requires that local capability is
 * never disguised as an upstream capability.
 */
export interface LocalChange {
  kind: LocalChangeKind;
  description: string;
  /** Who made the change. Only `human-voice-suite` is meaningful today. */
  author: 'human-voice-suite';
}

/** Convenience constructor so provenance records stay uniformly shaped. */
export function sourceRef(
  upstream: string,
  init: Omit<SourceReference, 'upstream'> = {},
): SourceReference {
  return { upstream, ...init };
}

export function localChange(kind: LocalChangeKind, description: string): LocalChange {
  return { kind, description, author: 'human-voice-suite' };
}

/**
 * True when a rule has no upstream at all and is therefore entirely our own
 * work. Local-only rules must be labelled as such in every report.
 */
export function isLocalOnly(sources: readonly SourceReference[]): boolean {
  if (sources.length === 0) return true;
  return sources.every((s) => s.upstream === LOCAL_UPSTREAM);
}

/** Reserved manifest key for capabilities that originate in this project. */
export const LOCAL_UPSTREAM = 'human-voice-suite/local';
