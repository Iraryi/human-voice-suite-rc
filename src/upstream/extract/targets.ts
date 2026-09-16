/**
 * Registered extraction targets.
 *
 * Adding an upstream means adding its adapter, its signature map, and one entry
 * here. Nothing else in the extraction pipeline changes.
 */

import type { ExtractionResult } from './types.js';
import { parseBlader } from '../adapters/blader/parse.js';
import { parseAiHumanizer } from '../adapters/ai-humanizer/parse.js';
import { parseHumanizeText } from '../adapters/humanize-text/parse.js';
import { parseHumanizerZhCn } from '../adapters/humanizer-zh-cn/parse.js';
import { parseDshHumanizer } from '../adapters/dsh-humanizer/parse.js';
import { parseStopSlop } from '../adapters/stop-slop/parse.js';
import { parseHumanizerZh } from '../adapters/humanizer-zh/parse.js';

export interface ExtractionTarget {
  /** Manifest key, matching the adapter id and the cache directory name. */
  readonly adapterId: string;
  /**
   * Directory under `src/upstream/adapters/`. Usually the short slug rather than
   * the manifest name, because the directory names are chosen for readability
   * (`blader`, not `blader-humanizer`). Kept explicit so the two can differ
   * without the generated file landing in a directory nobody looks at.
   */
  readonly directory: string;
  readonly upstream: string;
  /** Integration kind, recorded so the CLI can label the run. */
  readonly integration: string;
  /** Parse the pinned clone. */
  readonly parse: (repoPath: string) => Promise<ExtractionResult>;
}

export const EXTRACTION_TARGETS: readonly ExtractionTarget[] = [
  {
    adapterId: 'blader-humanizer',
    directory: 'blader',
    upstream: 'blader/humanizer',
    integration: 'markdown-skill',
    parse: parseBlader,
  },
  {
    adapterId: 'ai-humanizer',
    directory: 'ai-humanizer',
    upstream: 'judetelan/ai-humanizer',
    integration: 'executable-detector',
    parse: parseAiHumanizer,
  },
  {
    adapterId: 'humanize-text',
    directory: 'humanize-text',
    upstream: 'lynote-ai/humanize-text',
    integration: 'methodology',
    parse: parseHumanizeText,
  },
  {
    adapterId: 'humanizer-zh-cn',
    directory: 'humanizer-zh-cn',
    upstream: 'holygeek00/humanizer-zh-cn',
    integration: 'markdown-skill',
    parse: parseHumanizerZhCn,
  },
  {
    adapterId: 'dsh-humanizer',
    directory: 'dsh-humanizer',
    upstream: 'lynote-ai/dsh-humanizer',
    integration: 'voice-profile',
    parse: parseDshHumanizer,
  },
  {
    // Research-only as a package: nothing here is the suite's chosen source for
    // a rule, and its absolutist prose conflicts with blader's suppression
    // policy. But it holds clean title for the content barred from
    // `ai-humanizer`, and three of its tells appear nowhere else in the corpus,
    // so it gets a targeted extraction rather than none at all.
    adapterId: 'stop-slop',
    directory: 'stop-slop',
    upstream: 'hardikpandya/stop-slop',
    integration: 'research-only',
    parse: parseStopSlop,
  },
  {
    adapterId: 'humanizer-zh',
    directory: 'humanizer-zh',
    upstream: 'ai-zixun/humanizer-zh',
    integration: 'markdown-skill',
    parse: parseHumanizerZh,
  },
];

export function targetFor(adapterId: string): ExtractionTarget | undefined {
  return EXTRACTION_TARGETS.find((target) => target.adapterId === adapterId);
}

/** Every directory a target writes into. Used by tests to catch a stray path. */
export function targetDirectories(): string[] {
  return EXTRACTION_TARGETS.map((target) => target.directory);
}

/**
 * Manifest entries that should have an extraction target but do not.
 *
 * `research-only` upstreams are excluded on purpose: nothing may be imported
 * from them, so they must not have a target and their absence is not a gap.
 * Reporting them would train the reader to ignore this message.
 */
export function missingTargets(
  entries: ReadonlyArray<{ readonly name: string; readonly integration?: string }>,
): string[] {
  const registered = new Set(EXTRACTION_TARGETS.map((t) => t.adapterId));
  return entries
    .filter((entry) => entry.integration !== 'research-only')
    .map((entry) => entry.name)
    .filter((name) => !registered.has(name))
    .sort();
}

/**
 * Research-only upstreams that have no target.
 *
 * `research-only` means nothing distributable may be imported. That usually
 * means no target either — but not always: `stop-slop` is research-only as a
 * package while still being the clean-title source for content barred from
 * `ai-humanizer`, so it has a small targeted extraction. An entry with a target
 * is therefore never reported here, whatever its integration kind.
 */
export function deliberatelyNotExtracted(
  entries: ReadonlyArray<{ readonly name: string; readonly integration?: string }>,
): string[] {
  const registered = new Set(EXTRACTION_TARGETS.map((t) => t.adapterId));
  return entries
    .filter((entry) => entry.integration === 'research-only')
    .map((entry) => entry.name)
    .filter((name) => !registered.has(name))
    .sort();
}
