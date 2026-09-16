/**
 * Importing upstream voice material into unified profiles.
 *
 * Two sources with very different shapes:
 *
 * - `lynote-ai/dsh-humanizer` ships a 25-field writing fingerprint with a clear
 *   schema. That import is mechanical and lives in the fingerprint layer.
 * - `ai-zixun/humanizer-zh` ships eight Chinese author voices as **free-form
 *   prose**. There is no 成语 field, no taboo-word field, no sentence-length
 *   field: those dimensions appear as bold prose labels such as
 *   `MIX CLASSICAL AND VULGAR` or `Paragraph brevity.`
 *
 * So parsing is two-stage, as `docs/voice-profile-schema.md` specifies:
 *
 * 1. **Deterministic, for the container.** Split on `^## `, match headings
 *    case-insensitively on the stems `Persona`, `Quick Reference`, `Voice`,
 *    `Anti-pattern` (three of the eight files use lowercase headings, one
 *    anonymises its author), split numbered entries on `^\d+\. `, and assert
 *    exactly 8 templates and 12 rules per file.
 * 2. **Normalising, for the dimensions.** Map each bold prose label onto the
 *    unified craft vocabulary by keyword, and **flag anything that does not map
 *    instead of guessing**. An unmapped label keeps its rule text as a directive
 *    — the craft instruction is still worth carrying — but it is listed in
 *    `unmappedLabels` so a human can extend the map rather than a maintainer
 *    quietly inventing a dimension for it.
 *
 * What this import deliberately does not produce: statistical distributions. No
 * file contains a sample passage, so no sentence length, burstiness or
 * punctuation habit can be learned from them. The resulting profiles carry
 * `directives` and an empty `writing.sentenceLength`, which is why they never
 * contribute a fabricated number to `voiceScore`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sourceRef } from '../../rules/provenance/types.js';
import type { SourceReference } from '../../rules/provenance/types.js';
import { neutraliseAndRecord } from '../adaptation/index.js';
import { emptyDistribution } from '../types.js';
import type { VoiceProfile, WritingVoiceFeatures } from '../types.js';
import { buildProfile } from '../profile/index.js';

export const AREA = 'voice.import';
export const TARGET_PHASE = 6;

/** The eight voices, in the order the upstream index lists them. */
export interface AuthorVoiceFile {
  /** Profile scope key, e.g. `fengtang`. */
  readonly key: string;
  /** File under `references/voices/`. */
  readonly file: string;
  /** The name the file itself gives, checked against the parse. */
  readonly name: string;
}

export const AUTHOR_VOICE_FILES: readonly AuthorVoiceFile[] = [
  { key: 'fengtang', file: 'fengtang.md', name: '冯唐' },
  { key: 'hefan', file: 'hefan.md', name: '何帆' },
  { key: 'helaoshi', file: 'helaoshi.md', name: '鹤老师' },
  { key: 'lishanglong', file: 'lishanglong.md', name: '李尚龙' },
  { key: 'liuzichao', file: 'liuzichao.md', name: '刘子超' },
  { key: 'lixiaolai', file: 'lixiaolai.md', name: '李笑来' },
  { key: 'luozhenyu', file: 'luozhenyu.md', name: '罗振宇' },
  { key: 'wujun', file: 'wujun.md', name: '吴军' },
];

/** Upstream key, matching `upstreams/manifest.json`. */
export const VOICE_UPSTREAM = 'ai-zixun/humanizer-zh';

/** Where the voice files live inside that upstream. */
export const VOICE_DIRECTORY = 'references/voices';

/** The container shape the upstream guarantees. Asserted, not assumed. */
export const EXPECTED_TEMPLATES = 8;
export const EXPECTED_RULES = 12;
export const MIN_ANTI_PATTERNS = 8;
export const MAX_ANTI_PATTERNS = 13;

/**
 * The unified craft vocabulary.
 *
 * Deliberately small. A vocabulary that grows a dimension per upstream label
 * stops being a vocabulary, which is the same failure mode the rule layer avoids
 * by canonicalising signatures instead of importing pattern numbers.
 */
export const CRAFT_DIMENSIONS = [
  'register-mixing',
  'concreteness',
  'data-embedding',
  'brevity',
  'certainty',
  'argument-structure',
  'narrative-thread',
  'closure-style',
  'rhythm',
  'prohibition',
] as const;

export type CraftDimension = (typeof CRAFT_DIMENSIONS)[number];

/**
 * Keyword map from a free-form label to a unified dimension.
 *
 * Order is the priority order: the first pattern that matches wins, so
 * `Paragraph brevity.` lands on `brevity` rather than `rhythm` even though it
 * mentions paragraphs.
 */
export const LABEL_KEYWORDS: ReadonlyArray<readonly [CraftDimension, RegExp]> = [
  ['prohibition', /\bnever\b|\bno\s+summar|\bno\s+conclusion|\bno\s+wrap|\bavoid\b|禁止|不要/],
  ['brevity', /brevity|brief|short[- ]sentence|short[- ]paragraph|concise|terse|minimal|简洁|短句/],
  ['data-embedding', /\bdata\b|number|statistic|figure|quantif|numeric|数据|数字/],
  ['concreteness', /sensory|concrete|analog|imagery|\bimage\b|metaphor|vivid|detail|example|具体|意象/],
  ['register-mixing', /register|colloquial|classical|vulgar|slang|vernacular|dialect|文白|口语|京味/],
  ['certainty', /certainty|absolute|verdict|no hedging|assert|blunt|direct|judg|判断|绝对/],
  [
    'argument-structure',
    /argument|structure|pattern recognition|question-answer|version|framework|exception|variable|logic|论证|结构/,
  ],
  ['narrative-thread', /thread|narrative|experience|character sketch|archaeolog|story|anecdot|叙事|线索/],
  ['closure-style', /farewell|fade|freeze|closing|end with|linger|ending|收尾/],
  ['rhythm', /rhythm|sentence|paragraph|pace|pause|beat|节奏|句子|段落/],
];

export function normaliseLabel(label: string): CraftDimension | undefined {
  // Lowercased before matching: the upstream writes most labels in Title Case or
  // in FULL CAPS (`MIX CLASSICAL AND VULGAR`), and a case-sensitive keyword list
  // silently maps nothing. That failure is invisible — an unmapped label still
  // carries its rule text as a directive — so it has to be ruled out by
  // construction rather than noticed later.
  const cleaned = label.replace(/[*"]/g, '').trim().toLowerCase();
  for (const [dimension, pattern] of LABEL_KEYWORDS) {
    if (pattern.test(cleaned)) return dimension;
  }
  return undefined;
}

export interface ParsedAuthorVoice {
  readonly key: string;
  readonly locator: string;
  /** `冯唐` */
  readonly name: string;
  /** `Féng Táng` */
  readonly pinyin: string;
  /** The `适用：` line: what this voice is for. */
  readonly appliesTo: string;
  /** The `启用方式：` line: how the upstream expects the voice to be selected. */
  readonly activation: string;
  /** The neutrality preamble, which is why an imported voice is opt-in. */
  readonly neutrality: string;
  readonly persona: string;
  readonly templates: readonly string[];
  readonly rules: readonly string[];
  readonly antiPatterns: readonly string[];
  readonly sectionHeadings: readonly string[];
  /** Every bold label found, with the dimension it mapped to, if any. */
  readonly labels: ReadonlyArray<{ readonly label: string; readonly dimension?: CraftDimension }>;
}

export class AuthorVoiceParseError extends Error {}

function fail(locator: string, message: string): never {
  throw new AuthorVoiceParseError(`${locator}: ${message}`);
}

/** Split a section body into numbered entries, keeping continuation lines. */
export function splitNumberedEntries(body: readonly string[]): string[] {
  const entries: string[] = [];
  for (const line of body) {
    const match = /^(\d+)\.\s+(.*)$/.exec(line);
    if (match) {
      entries.push((match[2] ?? '').trim());
      continue;
    }
    if (entries.length > 0 && (line.startsWith('  ') || line.startsWith('\t')) && line.trim()) {
      // An indented continuation belongs to the entry above it. A blank line or
      // an unindented line ends the entry rather than being silently merged.
      entries[entries.length - 1] = `${entries[entries.length - 1]} ${line.trim()}`;
    }
  }
  return entries;
}

export function splitBullets(body: readonly string[]): string[] {
  const entries: string[] = [];
  for (const line of body) {
    const match = /^[-*\u2022]\s+(.*)$/.exec(line);
    if (match) {
      entries.push((match[1] ?? '').trim());
      continue;
    }
    if (entries.length > 0 && (line.startsWith('  ') || line.startsWith('\t')) && line.trim()) {
      entries[entries.length - 1] = `${entries[entries.length - 1]} ${line.trim()}`;
    }
  }
  return entries;
}

/**
 * Stage 1: the container.
 *
 * The header block — everything before the first `---` — is read positionally
 * rather than by content regex for the prose: the layout is stable, and a content
 * regex silently drops a field the day an author writes something unusual. Blank
 * lines inside the block are skipped rather than counted, because all eight files
 * put a blank line after the title.
 */
export function parseAuthorVoice(text: string, key: string): ParsedAuthorVoice {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const locator = `${VOICE_DIRECTORY}/${key}.md`;

  const separator = lines.findIndex((line) => line.trim() === '---');
  if (separator === -1) fail(locator, 'no `---` separator after the preamble');
  const header = lines.slice(0, separator);

  const title = header[0] ?? '';
  const titleMatch = /^#\s*声音：\s*(.+?)\s*[（(]([^）)]+)[）)]\s*$/.exec(title);
  if (!titleMatch) fail(locator, `line 1 is not a voice title: ${JSON.stringify(title)}`);
  const name = titleMatch[1] ?? '';
  const pinyin = titleMatch[2] ?? '';

  const fieldIndex = (prefix: string): number =>
    header.findIndex((line) => line.startsWith(prefix));
  const appliesIndex = fieldIndex('适用：');
  const activationIndex = fieldIndex('启用方式：');
  if (appliesIndex === -1) fail(locator, 'the header does not carry 适用 (what this voice is for)');
  const appliesTo = (header[appliesIndex] ?? '').replace(/^适用：\s*/, '').trim();
  const activation =
    activationIndex === -1
      ? ''
      : (header[activationIndex] ?? '').replace(/^启用方式：\s*/, '').trim();

  // The neutrality preamble: everything after 启用方式 and before `---`. It is
  // kept because it is the reason an imported voice must be explicitly opt-in.
  const neutrality = header
    .slice(Math.max(appliesIndex, activationIndex) + 1)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  const headingIndices: Array<{ index: number; heading: string }> = [];
  lines.forEach((line, index) => {
    if (/^##\s+/.test(line)) headingIndices.push({ index, heading: line.replace(/^##\s+/, '').trim() });
  });
  if (headingIndices.length !== 4) {
    fail(locator, `expected 4 sections, found ${headingIndices.length}: ${headingIndices.map((h) => h.heading).join(' | ')}`);
  }

  const sectionBody = (position: number): string[] => {
    const start = (headingIndices[position]?.index ?? 0) + 1;
    const end = headingIndices[position + 1]?.index ?? lines.length;
    return lines.slice(start, end);
  };

  const stemOf = (position: number): string => (headingIndices[position]?.heading ?? '').toLowerCase();
  const findSection = (pattern: RegExp, what: string): number => {
    const position = headingIndices.findIndex((entry) => pattern.test(entry.heading));
    if (position === -1) fail(locator, `no ${what} section`);
    return position;
  };

  const personaPosition = findSection(/persona/i, 'Persona');
  const templatePosition = findSection(/quick reference/i, 'Quick Reference');
  const rulePosition = findSection(/^voice/i, 'Voice');
  const antiPosition = findSection(/anti-?pattern/i, 'Anti-pattern');

  // Every heading must be used exactly once, or the file has grown a section the
  // importer would silently ignore.
  const positions = [personaPosition, templatePosition, rulePosition, antiPosition].sort();
  if (positions.join(',') !== '0,1,2,3') {
    fail(locator, `section headings are case-shifted but not reordered; found ${positions.join(',')}`);
  }
  if (!/quick reference/i.test(stemOf(templatePosition))) {
    fail(locator, 'the Quick Reference section is not second');
  }

  const templates = splitNumberedEntries(sectionBody(templatePosition));
  const rules = splitNumberedEntries(sectionBody(rulePosition));
  const antiPatterns = splitBullets(sectionBody(antiPosition));

  if (templates.length !== EXPECTED_TEMPLATES) {
    fail(locator, `expected ${EXPECTED_TEMPLATES} templates, found ${templates.length}`);
  }
  if (rules.length !== EXPECTED_RULES) {
    fail(locator, `expected ${EXPECTED_RULES} rules, found ${rules.length}`);
  }
  if (antiPatterns.length < MIN_ANTI_PATTERNS || antiPatterns.length > MAX_ANTI_PATTERNS) {
    fail(
      locator,
      `expected ${MIN_ANTI_PATTERNS}..${MAX_ANTI_PATTERNS} anti-patterns, found ${antiPatterns.length}`,
    );
  }

  // Every bold span, not just the first one in an entry. Only two of the eight
  // files use bold labels at all (12 in `helaoshi.md`, 6 in `liuzichao.md`), and
  // several of those entries carry two, so taking only the first would silently
  // drop a dimension.
  const seenLabels = new Set<string>();
  const labels: Array<{ label: string; dimension?: CraftDimension }> = [];
  for (const entry of [...rules, ...antiPatterns, ...templates]) {
    for (const match of entry.matchAll(/\*\*([^*]+)\*\*/g)) {
      const label = (match[1] ?? '').trim().replace(/\.$/, '');
      if (label.length === 0 || seenLabels.has(label)) continue;
      seenLabels.add(label);
      const dimension = normaliseLabel(label);
      labels.push(dimension ? { label, dimension } : { label });
    }
  }

  return {
    key,
    locator,
    name,
    pinyin,
    appliesTo,
    activation,
    neutrality,
    persona: sectionBody(personaPosition).join('\n').trim(),
    templates,
    rules,
    antiPatterns,
    sectionHeadings: headingIndices.map((entry) => entry.heading),
    labels,
  };
}

/**
 * Stage 2: normalisation.
 *
 * Templates become `rhetoricalDevices`, because a sentence template is a device
 * and not a word. Rules and anti-patterns become `directives`. Labels that
 * mapped become `toneMarkers`; labels that did not are reported.
 */
export interface AuthorProfileResult {
  readonly profile: VoiceProfile;
  readonly unmappedLabels: readonly string[];
  readonly dimensions: readonly CraftDimension[];
}

export function authorVoiceToProfile(
  parsed: ParsedAuthorVoice,
  options: { readonly revision?: string; readonly licence?: string } = {},
): AuthorProfileResult {
  const unmappedLabels = parsed.labels
    .filter((entry) => entry.dimension === undefined)
    .map((entry) => entry.label);
  const dimensions = [
    ...new Set(
      parsed.labels
        .map((entry) => entry.dimension)
        .filter((dimension): dimension is CraftDimension => dimension !== undefined),
    ),
  ];

  const source: SourceReference = sourceRef(VOICE_UPSTREAM, {
    ruleId: parsed.key,
    locator: parsed.locator,
    quote: `# 声音：${parsed.name} (${parsed.pinyin})`,
    modified: true,
    note:
      'Voice profile, not a rule. Container parsed deterministically; bold prose labels normalised ' +
      'onto the unified craft vocabulary. Statistical features are deliberately empty: the file ' +
      'contains no sample passage, so no distribution can be learned from it.',
  });

  // The craft material. Every entry is a habit or a craft instruction; none of it
  // claims to be a person.
  const directives = [
    ...parsed.rules.map((rule) => `Voice rule: ${rule}`),
    ...parsed.antiPatterns.map((pattern) => `Never: ${pattern.replace(/^Never\s+/i, '')}`),
  ];

  const writing: WritingVoiceFeatures = {
    // Empty on purpose, and validated as empty. See `validateProfile`: a
    // distribution with `sampleCount: 0` must not carry a mean.
    sentenceLength: emptyDistribution(),
    paragraphLength: emptyDistribution(),
    burstiness: 0,
    punctuationRates: {},
    signatureVocabulary: [],
    avoidVocabulary: [],
    toneMarkers: dimensions.map((dimension) => `craft:${dimension}`),
    rhetoricalDevices: [...parsed.templates],
  };

  const profile = buildProfile({
    id: `author/${parsed.key}`,
    owner: VOICE_UPSTREAM,
    kind: 'writing',
    languages: ['zh'],
    sources: [
      source,
      ...(options.revision
        ? [
            sourceRef(VOICE_UPSTREAM, {
              locator: 'git revision',
              quote: options.revision,
              note: 'the revision this profile was generated from',
            }),
          ]
        : []),
      ...(options.licence
        ? [
            sourceRef(VOICE_UPSTREAM, {
              locator: 'LICENSE',
              quote: options.licence,
              note: 'licence covering the imported text',
            }),
          ]
        : []),
    ],
    writing,
    directives,
    notes: [
      `Applies to: ${parsed.appliesTo}`,
      `Upstream neutrality preamble, kept verbatim: ${parsed.neutrality.replace(/\n/g, ' ')}`,
      'Scope: opt-in. The suite never applies an author voice unless a caller selects it.',
      'This profile describes craft and measurable habits from published work. It is not a persona to perform, ' +
        'and the rewrite contract must not claim authorship.',
    ].join('\n'),
  });

  // Hazards are removed here rather than trusted to the profile author.
  const cleaned = neutraliseAndRecord(profile);

  return { profile: cleaned, unmappedLabels, dimensions };
}

export interface VoiceImportReport {
  readonly revision: string;
  readonly licence: string;
  readonly profiles: readonly VoiceProfile[];
  readonly unmappedLabels: Readonly<Record<string, readonly string[]>>;
  readonly harnessRemovals: ReadonlyArray<{ readonly profile: string; readonly count: number }>;
}

export function importAuthorVoices(input: {
  readonly voiceDirectory: string;
  readonly revision?: string;
  readonly licence?: string;
}): VoiceImportReport {
  const profiles: VoiceProfile[] = [];
  const unmappedLabels: Record<string, readonly string[]> = {};
  const harnessRemovals: Array<{ profile: string; count: number }> = [];

  for (const entry of AUTHOR_VOICE_FILES) {
    const path = join(input.voiceDirectory, entry.file);
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      throw new AuthorVoiceParseError(
        `cannot read ${path}. The upstream cache is gitignored; run \`npm run upstream:sync\` first.`,
      );
    }
    const parsed = parseAuthorVoice(text, entry.key);
    if (parsed.name !== entry.name) {
      throw new AuthorVoiceParseError(
        `${entry.file}: expected author ${entry.name}, the file says ${parsed.name}`,
      );
    }
    const result = authorVoiceToProfile(parsed, {
      ...(input.revision ? { revision: input.revision } : {}),
      ...(input.licence ? { licence: input.licence } : {}),
    });
    profiles.push(result.profile);
    if (result.unmappedLabels.length > 0) unmappedLabels[entry.key] = result.unmappedLabels;

    const removed = countRemovals(result.profile);
    if (removed > 0) harnessRemovals.push({ profile: result.profile.id, count: removed });
  }

  return {
    revision: input.revision ?? 'unpinned',
    licence: input.licence ?? 'unknown',
    profiles,
    unmappedLabels,
    harnessRemovals,
  };
}

/** How many hazard removals a generated profile records in its notes. */
export function countRemovals(profile: VoiceProfile): number {
  const match = /Hazards removed at import \((\d+)\)/.exec(profile.notes ?? '');
  return match ? Number(match[1]) : 0;
}
