/**
 * Voice profiles: schema, construction, storage, scope resolution.
 *
 * A profile is a target, not a persona. It records what a writer measurably
 * does, and it is scoped: the same person writes differently in chat, in formal
 * prose and in technical documentation, so `user/chat` and `user/formal` are two
 * profiles. Averaging them would describe nobody, which is the mistake the
 * unified model exists to avoid.
 *
 * Every profile carries `sources` at the same standard rules do. A profile that
 * cannot say where it came from does not load.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SourceReference } from '../../rules/provenance/types.js';
import type { Language, TextMode } from '../../shared/types.js';
import {
  VOICE_PROFILE_SCHEMA_VERSION,
  summariseProfile,
} from '../types.js';
import type {
  ChatVoiceFeatures,
  ConversationBehaviorFeatures,
  DistributionSummary,
  VoiceProfile,
  VoiceProfileKind,
  VoiceProfileSummary,
  WritingVoiceFeatures,
} from '../types.js';
import type { FingerprintExtraction } from '../fingerprint/index.js';

export const AREA = 'voice.profile';
export const TARGET_PHASE = 6;

export interface ProfileProblem {
  readonly field: string;
  readonly problem: string;
}

/**
 * Schema and sanity checks.
 *
 * Deliberately strict about provenance, because a profile is what the rewrite
 * contract aims at: an unattributed target is an unattributable result.
 */
export function validateProfile(profile: VoiceProfile): ProfileProblem[] {
  const problems: ProfileProblem[] = [];
  const require = (condition: boolean, field: string, problem: string): void => {
    if (!condition) problems.push({ field, problem });
  };

  // Shape first. `parseProfile` runs this on arbitrary JSON, and a validator that
  // throws a TypeError on a malformed file reports a bug in the validator instead
  // of the problem with the file.
  if (typeof profile !== 'object' || profile === null) {
    return [{ field: '<root>', problem: 'a profile must be an object' }];
  }
  for (const field of ['schemaVersion', 'id', 'owner', 'kind'] as const) {
    if (typeof profile[field] !== 'string') {
      problems.push({ field, problem: `expected a string, found ${typeof profile[field]}` });
    }
  }
  for (const field of ['languages', 'sources'] as const) {
    if (!Array.isArray(profile[field])) {
      problems.push({ field, problem: `expected an array, found ${typeof profile[field]}` });
    }
  }
  if (problems.length > 0) return problems;

  require(
    profile.schemaVersion === VOICE_PROFILE_SCHEMA_VERSION,
    'schemaVersion',
    `expected ${VOICE_PROFILE_SCHEMA_VERSION}, found ${JSON.stringify(profile.schemaVersion)}`,
  );
  require(profile.id.trim().length > 0, 'id', 'a profile needs an id');
  require(
    /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(profile.id),
    'id',
    'id must be scoped as <owner>/<scope>, for example user/chat or author/fengtang',
  );
  require(profile.owner.trim().length > 0, 'owner', 'a profile needs an owner');
  require(profile.languages.length > 0, 'languages', 'a profile needs at least one language');
  require(
    profile.sources.length > 0,
    'sources',
    'a profile needs at least one source: an unattributed target produces an unattributable result',
  );

  for (const [name, distribution] of distributions(profile)) {
    if (distribution.sampleCount < 0) {
      problems.push({ field: name, problem: 'sampleCount cannot be negative' });
      continue;
    }
    if (distribution.sampleCount === 0) {
      if (distribution.mean !== 0 || distribution.min !== 0 || distribution.max !== 0) {
        problems.push({
          field: name,
          problem: 'an empty distribution must not carry a mean, min or max',
        });
      }
      continue;
    }
    if (distribution.min > distribution.max) {
      problems.push({ field: name, problem: 'min is greater than max' });
    }
    if (distribution.mean < distribution.min || distribution.mean > distribution.max) {
      problems.push({ field: name, problem: 'mean sits outside min..max' });
    }
  }

  if (profile.writing) {
    for (const [mark, rate] of Object.entries(profile.writing.punctuationRates)) {
      if (!Number.isFinite(rate) || rate < 0) {
        problems.push({ field: `writing.punctuationRates[${mark}]`, problem: 'rate must be >= 0' });
      }
    }
    if (profile.writing.burstiness < 0) {
      problems.push({ field: 'writing.burstiness', problem: 'burstiness cannot be negative' });
    }
  }

  if (profile.behavior) {
    const behavior = profile.behavior;
    const rates: ReadonlyArray<readonly [string, number]> = [
      ['followUpQuestionRate', behavior.followUpQuestionRate],
      ['topicOmissionRate', behavior.topicOmissionRate],
      ['topicJumpAbruptness', behavior.topicJumpAbruptness],
      ['agreementRate', behavior.agreementRate],
      ['unsolicitedOfferRate', behavior.unsolicitedOfferRate],
    ];
    for (const [field, value] of rates) {
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        problems.push({ field: `behavior.${field}`, problem: 'must be a rate in 0..1' });
      }
    }
  }

  return problems;
}

function distributions(
  profile: VoiceProfile,
): ReadonlyArray<readonly [string, DistributionSummary]> {
  const out: Array<readonly [string, DistributionSummary]> = [];
  if (profile.writing) {
    out.push(['writing.sentenceLength', profile.writing.sentenceLength]);
    out.push(['writing.paragraphLength', profile.writing.paragraphLength]);
  }
  if (profile.chat) out.push(['chat.replyLength', profile.chat.replyLength]);
  return out;
}

export function assertValidProfile(profile: VoiceProfile): void {
  const problems = validateProfile(profile);
  if (problems.length === 0) return;
  throw new Error(
    `Voice profile ${profile.id} is invalid:\n` +
      problems.map((problem) => `  - ${problem.field}: ${problem.problem}`).join('\n'),
  );
}

export interface BuildProfileInput {
  readonly id: string;
  readonly owner: string;
  readonly kind: VoiceProfileKind;
  readonly languages: readonly string[];
  readonly sources: readonly SourceReference[];
  readonly writing?: WritingVoiceFeatures;
  readonly chat?: ChatVoiceFeatures;
  readonly behavior?: ConversationBehaviorFeatures;
  readonly directives?: readonly string[];
  readonly notes?: string;
}

export function buildProfile(input: BuildProfileInput): VoiceProfile {
  const profile: VoiceProfile = {
    schemaVersion: VOICE_PROFILE_SCHEMA_VERSION,
    id: input.id,
    owner: input.owner,
    kind: input.kind,
    languages: [...input.languages],
    sources: [...input.sources],
    ...(input.writing ? { writing: input.writing } : {}),
    ...(input.chat ? { chat: input.chat } : {}),
    ...(input.behavior ? { behavior: input.behavior } : {}),
    ...(input.directives && input.directives.length > 0
      ? { directives: [...input.directives] }
      : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  };
  assertValidProfile(profile);
  return profile;
}

/**
 * Turn a learned fingerprint into a profile.
 *
 * `avoidVocabulary` is an argument rather than a learned field on purpose: no
 * amount of a writer's own text says what they never write. It has to be
 * declared, and a profile that declares none says so by being empty.
 */
export function profileFromFingerprint(
  extraction: FingerprintExtraction,
  input: {
    readonly id: string;
    readonly owner: string;
    readonly kind: VoiceProfileKind;
    readonly sources: readonly SourceReference[];
    readonly avoidVocabulary?: readonly string[];
    readonly behavior?: ConversationBehaviorFeatures;
    readonly directives?: readonly string[];
    readonly notes?: string;
  },
): VoiceProfile {
  const writing: WritingVoiceFeatures = {
    ...extraction.writing,
    avoidVocabulary: [...(input.avoidVocabulary ?? [])],
  };

  return buildProfile({
    id: input.id,
    owner: input.owner,
    kind: input.kind,
    languages: [extraction.language === 'unknown' ? 'zh' : extraction.language],
    sources: input.sources,
    writing,
    ...(extraction.chat ? { chat: extraction.chat } : {}),
    ...(input.behavior ? { behavior: input.behavior } : {}),
    ...(input.directives ? { directives: input.directives } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  });
}

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

export function serialiseProfile(profile: VoiceProfile): string {
  return `${JSON.stringify(profile, null, 2)}\n`;
}

export function parseProfile(json: string, origin = '<memory>'): VoiceProfile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(`${origin} is not valid JSON: ${(error as Error).message}`);
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`${origin} does not contain a profile object`);
  }
  const profile = parsed as VoiceProfile;
  assertValidProfile(profile);
  return profile;
}

/**
 * A directory of `<id>.json` files.
 *
 * `id` contains a slash (`user/chat`), so the file name replaces it with `__`.
 * The id inside the file is authoritative; the file name is only a convention so
 * that a person can find the file.
 */
export function profileFileName(id: string): string {
  return `${id.replace(/\//g, '__')}.json`;
}

export class VoiceProfileStore {
  readonly #root: string;

  constructor(root: string) {
    this.#root = root;
  }

  get root(): string {
    return this.#root;
  }

  list(): VoiceProfileSummary[] {
    return this.loadAll().map(summariseProfile);
  }

  loadAll(): VoiceProfile[] {
    if (!existsSync(this.#root)) return [];
    return readdirSync(this.#root)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .map((name) => this.loadFile(join(this.#root, name)));
  }

  loadFile(path: string): VoiceProfile {
    return parseProfile(readFileSync(path, 'utf8'), path);
  }

  get(id: string): VoiceProfile | undefined {
    const path = join(this.#root, profileFileName(id));
    if (!existsSync(path)) return undefined;
    return this.loadFile(path);
  }

  save(profile: VoiceProfile): string {
    assertValidProfile(profile);
    mkdirSync(this.#root, { recursive: true });
    const path = join(this.#root, profileFileName(profile.id));
    writeFileSync(path, serialiseProfile(profile), 'utf8');
    return path;
  }
}

// ---------------------------------------------------------------------------
// Scope resolution
// ---------------------------------------------------------------------------

/**
 * Which profile a request should use.
 *
 * Mode is the primary key: a chat request must not be aimed at a formal-writing
 * profile, because the two disagree about sentence length, punctuation and
 * almost everything else. Language is the tie-break, and an exact mode match
 * always beats a `combined` profile.
 */
export interface ScopeRequest {
  readonly mode: TextMode;
  readonly language?: Language;
  /** Preferred ids, highest priority first. A caller's explicit choice wins. */
  readonly prefer?: readonly string[];
}

export interface ScopeResolution {
  readonly profile?: VoiceProfile;
  readonly reason: string;
}

export function resolveProfileScope(
  profiles: readonly VoiceProfile[],
  request: ScopeRequest,
): ScopeResolution {
  if (profiles.length === 0) return { reason: 'no profiles are loaded' };

  for (const id of request.prefer ?? []) {
    const preferred = profiles.find((profile) => profile.id === id);
    if (preferred) return { profile: preferred, reason: `explicitly requested ${id}` };
  }

  const languageMatches = (profile: VoiceProfile): boolean =>
    request.language === undefined ||
    profile.languages.includes(request.language) ||
    profile.languages.includes('unknown');

  const eligible = profiles.filter(languageMatches);
  if (eligible.length === 0) {
    return {
      reason: `no profile covers ${request.language ?? 'the requested language'}`,
    };
  }

  const wanted = wantedKinds(request.mode);
  for (const kind of wanted) {
    const match = eligible.find((profile) => profile.kind === kind);
    if (match) {
      return {
        profile: match,
        reason: `${request.mode} mode resolves to kind ${kind}`,
      };
    }
  }

  return {
    reason: `no ${request.mode}-scoped profile; ${eligible.length} profile(s) available but none matches this mode`,
  };
}

function wantedKinds(mode: TextMode): readonly VoiceProfileKind[] {
  switch (mode) {
    case 'chat':
      return ['chat', 'conversation-behavior', 'combined'];
    case 'formal':
    case 'technical':
    case 'prose':
      return ['writing', 'combined'];
    default:
      return ['combined', 'writing'];
  }
}
