/**
 * The voice layer.
 *
 * Explicit re-exports rather than `export *`, because every module here declares
 * its own `AREA` and a barrel of wildcards would collapse six distinct areas
 * into whichever one won.
 *
 * The layers, in dependency order:
 *
 * ```text
 * fingerprint  extract habits from text; used both to learn and to measure
 * profile      schema, storage, scope resolution
 * scoring      distance from a target → voiceScore
 * adaptation   blending, drift, hazard neutralisation
 * import       upstream voice material → unified profiles
 * ```
 */

export * from './types.js';

export {
  THIN_SAMPLE_SENTENCES,
  PUNCTUATION_MARKS,
  SHORTHAND_MARKERS,
  SIGNATURE_VOCABULARY_LIMIT,
  SIGNATURE_MIN_COUNT,
  MESSAGE_SEPARATOR,
  summariseDistribution,
  punctuationRates,
  contentUnits,
  signatureVocabulary,
  paragraphLengths,
  extractWritingFeatures,
  extractChatFeatures,
  splitMessages,
  emojiCount,
  extractFingerprint,
  learnFingerprint,
} from './fingerprint/index.js';
export type { FingerprintExtraction, FingerprintExtractOptions } from './fingerprint/index.js';

export {
  validateProfile,
  assertValidProfile,
  buildProfile,
  profileFromFingerprint,
  serialiseProfile,
  parseProfile,
  profileFileName,
  VoiceProfileStore,
  resolveProfileScope,
} from './profile/index.js';
export type {
  ProfileProblem,
  BuildProfileInput,
  ScopeRequest,
  ScopeResolution,
} from './profile/index.js';

export {
  DIMENSION_WEIGHTS,
  MIN_UNITS_FOR_VOCABULARY,
  MIN_PARAGRAPHS,
  toleranceScore,
  rateDistance,
  compareToProfile,
} from './scoring/index.js';
export type { VoiceDimension, VoiceComparison, CompareOptions } from './scoring/index.js';

export {
  HAZARD_PATTERNS,
  findHazards,
  neutraliseHazards,
  neutraliseAndRecord,
  blendDistributions,
  blendProfiles,
  detectDrift,
  DRIFT_SIGMA,
} from './adaptation/index.js';
export type {
  HazardPattern,
  NeutralisationResult,
  BlendOptions,
  DriftReport,
} from './adaptation/index.js';

export {
  AUTHOR_VOICE_FILES,
  VOICE_UPSTREAM,
  VOICE_DIRECTORY,
  EXPECTED_TEMPLATES,
  EXPECTED_RULES,
  MIN_ANTI_PATTERNS,
  MAX_ANTI_PATTERNS,
  CRAFT_DIMENSIONS,
  LABEL_KEYWORDS,
  normaliseLabel,
  splitNumberedEntries,
  splitBullets,
  parseAuthorVoice,
  authorVoiceToProfile,
  importAuthorVoices,
  countRemovals,
  AuthorVoiceParseError,
} from './import/index.js';
export type {
  AuthorVoiceFile,
  CraftDimension,
  ParsedAuthorVoice,
  AuthorProfileResult,
  VoiceImportReport,
} from './import/index.js';
