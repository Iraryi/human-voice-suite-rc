/**
 * Upstream contracts.
 *
 * An upstream is never imported directly into the core. It is wrapped in an
 * adapter, and only the adapter knows how that upstream spells things. Adding
 * a new humanizer project must mean adding one adapter directory, not editing
 * the core — that is the whole point of the suite.
 */

import type { Detector } from '../detector/types.js';
import type { RuleCandidate } from '../rules/types.js';
import type { VoiceProfile } from '../voice/types.js';

/**
 * How an upstream's content is allowed into the suite.
 *
 * - `executable-detector` — the upstream ships runnable detection logic; wrap
 *   it behind the `Detector` interface.
 * - `markdown-skill`      — the upstream is a prompt document; it must be
 *   PARSED into rules, examples and guidance. It is never pasted whole into a
 *   prompt.
 * - `voice-profile`       — the upstream models a personal style; abstract it
 *   onto the unified voice interface.
 * - `methodology`         — the upstream describes an approach or pipeline
 *   rather than rules; it becomes a strategy and stays out of the default
 *   execution path.
 * - `research-only`       — no usable licence, or nothing worth taking. Read
 *   for understanding; copy nothing.
 */
export type IntegrationKind =
  | 'executable-detector'
  | 'markdown-skill'
  | 'voice-profile'
  | 'methodology'
  | 'research-only';

export interface AdapterCapability {
  readonly kind:
    | 'rules'
    | 'detectors'
    | 'voice-profiles'
    | 'strategies'
    | 'corpus'
    | 'benchmarks'
    | 'localization';
  readonly description: string;
}

export type AdapterStatus = 'planned' | 'partial' | 'ready';

/**
 * One record per upstream in `upstreams/manifest.json`.
 *
 * The eight fields marked required are exactly the shape the project brief
 * specifies. Everything after them is suite-side bookkeeping and optional.
 */
export interface UpstreamManifestEntry {
  /** Short stable key, e.g. `blader-humanizer`. Used as the directory name. */
  name: string;
  /** `owner/repo`, exactly as on the forge. */
  repository: string;
  /**
   * Canonical clone URL. Derived from `repository` when omitted, so the common
   * case needs no extra field. Set it explicitly when the upstream is not on
   * GitHub or is reached by SSH.
   */
  url?: string;
  /** SPDX identifier, e.g. `MIT`, `BSD-3-Clause`. */
  license: string;
  /** Upstream's own declared version, or `unversioned` when it has none. */
  version: string;
  /** Full commit SHA pinned at last sync. */
  commit: string;
  /** What this upstream is used for. */
  role: string[];
  /** Manifest `name` values this upstream derives from. */
  derived_from: string[];
  /** ISO date of the last sync check. */
  last_sync: string;

  // ---- optional suite bookkeeping ----
  /** Default branch, needed by the sync checker. */
  default_branch?: string;
  /** Copyright holder exactly as written in the upstream LICENSE. */
  copyright_holder?: string;
  /** Path to the preserved licence copy inside `licenses/`. */
  license_file?: string;
  /** How the upstream is integrated. */
  integration?: IntegrationKind;
  /**
   * True when the upstream is part of the first batch that must be wired in,
   * false when it is only being investigated.
   */
  tracked?: boolean;
  /** Phase in which this upstream is expected to become functional. */
  target_phase?: number;
  /**
   * Ancestors that are NOT themselves tracked upstreams, so they cannot appear
   * in `derived_from` without breaking the sibling reference check. Recorded so
   * the lineage graph stays complete.
   */
  external_ancestors?: string[];
  /**
   * Content that must not be imported from this upstream, with the reason.
   * Used where an upstream's own licence is clean but content it took from
   * elsewhere did not carry the required notices.
   */
  import_exclusions?: Array<{ what: string; reason: string }>;
  /** Free-form notes, especially about provenance and duplicate lineage. */
  notes?: string;
}

export interface UpstreamManifest {
  readonly schemaVersion: string;
  /** Where upstream clones live, relative to the project root. */
  readonly cacheDir: string;
  readonly upstreams: readonly UpstreamManifestEntry[];
}

export const UPSTREAM_MANIFEST_SCHEMA_VERSION = '1.0.0';

export interface AdapterContext {
  readonly upstream: UpstreamManifestEntry;
  /** Absolute path to the clone, or `null` when it is not on disk. */
  readonly repoPath: string | null;
  /** Read a file inside the clone. Rejects paths that escape the clone. */
  readonly readFile: (relativePath: string) => Promise<string>;
  /** List files inside the clone, relative to its root. */
  readonly listFiles: (relativeDir?: string) => Promise<string[]>;
  readonly log: (message: string) => void;
}

export interface AdapterInspection {
  readonly upstream: string;
  /** Commit currently on disk, or `null` when the clone is missing. */
  readonly localCommit: string | null;
  /** Commit recorded in the manifest. */
  readonly manifestCommit: string;
  readonly notes: readonly string[];
}

/**
 * The seam. Implement this to add a new humanizer project to the suite.
 *
 * All extraction methods are optional: a pure Markdown skill has no detectors,
 * and a pure detector project has no voice profiles.
 */
export interface UpstreamAdapter {
  /** Stable slug matching `UpstreamManifestEntry.name`. */
  readonly id: string;
  /** `owner/repo`. */
  readonly upstream: string;
  readonly integration: IntegrationKind;
  readonly status: AdapterStatus;
  /** Phase in which this adapter is expected to reach `ready`. */
  readonly targetPhase: number;
  readonly capabilities: readonly AdapterCapability[];
  readonly description: string;

  /** Parse the upstream into canonical rule candidates. */
  extractRules?(context: AdapterContext): Promise<readonly RuleCandidate[]>;
  /** Expose the upstream's runnable detection logic. */
  exportDetectors?(context: AdapterContext): Promise<readonly Detector[]>;
  /** Expose the upstream's voice or style profiles. */
  exportVoiceProfiles?(context: AdapterContext): Promise<readonly VoiceProfile[]>;
  /** Report on-disk vs manifest commit, used by `upstream:check`. */
  inspect?(context: AdapterContext): Promise<AdapterInspection>;
}
