/**
 * Parser for `judetelan/ai-humanizer`.
 *
 * Where `blader` is Markdown, this upstream is JavaScript: a declarative rule
 * registry (`scripts/registry/rules.mjs`), two engines
 * (`scripts/engines/lexical.mjs`, `scripts/engines/stylometry.mjs`) and a
 * lexicon module (`scripts/lexicons.mjs`). The registry is read **as text**,
 * never imported: importing it would execute upstream code and would make the
 * adapter depend on the clone at run time, and the generated JSON is supposed to
 * carry the rules so the published package does not.
 *
 * The licence restriction is the second thing that shapes this parser, and it is
 * the reason the parser is exclusion-driven rather than allow-list-driven:
 *
 *  - `scripts/registry/rules.mjs:148` is the marker comment
 *    `// ── Absorbed from stop-slop (editorial tells) ──`. Every rule object
 *    between that comment and the next section comment (~line 148 to ~line 205,
 *    i.e. the objects at lines 150-203) came from `hardikpandya/stop-slop`
 *    without its copyright notice, and is barred by `IMPORT_EXCLUSIONS` in
 *    `./index.ts`. The boundary is found by *position*, not by a hand-typed id
 *    list, so a renamed or added stop-slop rule inside that section cannot leak
 *    in unnoticed. The ids are then cross-checked against
 *    `AI_HUMANIZER_SIGNATURES`, which must cover the 35 rules that remain.
 *  - `scripts/lexicons.mjs` carries the same split in its section comments
 *    ("stop-slop additions" / "stop-slop throat-clearers" / "(stop-slop)"), and
 *    every array so marked is refused, whether or not a permitted rule could
 *    have used it. `JARGON_SWAPS` is refused outright as stop-slop's
 *    business-jargon table reproduced row for row.
 *
 * Excluded content is *absent* from the result. It is not emitted with empty
 * fields and it is not emitted with a note: a rule that should not have been
 * imported must not appear at all.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  assertKnownSignature,
  signatureSpec,
  unmappedSignature,
} from '../../../rules/canonical/signatures.js';
import { classifyPhrase, cleanPhrase } from '../../extract/phrase.js';
import { EXTRACTION_SCHEMA_VERSION } from '../../extract/types.js';
import type {
  ExtractedRule,
  ExtractionResult,
  WatchPhrase,
} from '../../extract/types.js';
import { AI_HUMANIZER_SIGNATURES } from './signatures.js';

const UPSTREAM = 'judetelan/ai-humanizer';
const SLUG = 'ai_humanizer';

const REGISTRY_FILE = 'scripts/registry/rules.mjs';
const LEXICONS_FILE = 'scripts/lexicons.mjs';
const LEXICAL_ENGINE_FILE = 'scripts/engines/lexical.mjs';
const STYLOMETRY_ENGINE_FILE = 'scripts/engines/stylometry.mjs';

/**
 * The comment that introduces the stop-slop-derived rules, quoted from
 * `scripts/registry/rules.mjs:148`.
 */
const ABSORBED_MARKER = /Absorbed from stop-slop/i;

/** Any other `// ── …` section banner inside the RULES array ends the bar. */
const SECTION_BANNER = /^\s*\/\/\s*──+\s*(.+?)\s*──+\s*$/;

/** Rule ids the upstream's own source attributes to stop-slop, re-stated. */
const STOP_SLOP_RULE_IDS: readonly string[] = [
  'false-agency',
  'rhetorical-setup',
  'negative-listing',
  'vague-declarative',
  'meta-commentary',
  'emphasis-crutch',
  'dramatic-fragmentation',
  'adverb-filler',
  'lazy-extremes',
  'passive-voice',
  'wh-opener',
];

/**
 * Lexicon arrays barred with those rules.
 *
 * Provenance is per-array, taken from the comment sitting immediately above the
 * declaration, so this is documentation rather than a parse input — the array
 * names themselves are never read, which is the point: their entries cannot
 * reach the output.
 */
const BARRED_LEXICON_ARRAYS: readonly string[] = [
  'ADVERB_FILLER',
  'LAZY_EXTREMES',
  'META_COMMENTARY',
  'RHETORICAL_SETUP',
  'EMPHASIS_CRUTCH',
  'VAGUE_DECLARATIVE',
  'FALSE_AGENCY_NOUNS',
  'FALSE_AGENCY_VERBS',
  'JARGON_SWAPS',
];

/**
 * Lexicon array -> the rules that use it, from the `DETECTORS` table in
 * `scripts/engines/lexical.mjs`.
 *
 * `JARGON_SWAPS` is absent by design (barred), and so are the eight arrays the
 * upstream itself puts under a stop-slop comment. Where an array serves more
 * than one rule it is listed under each; the duplicate entries between arrays
 * are de-duplicated per rule below, which is why the sum of the per-rule counts
 * is smaller than the sum of the raw array lengths.
 */
const RULE_LEXICONS: Readonly<Record<string, readonly string[]>> = {
  'banned-vocab': ['BANNED_VOCAB'],
  'ai-openers': ['AI_OPENERS'],
  'marketing-buzzword': ['BUZZWORDS'],
  'hedging': ['HEDGES'],
  'wordy-connectives': ['WORDY_CONNECTIVES'],
  'weasel-attribution': ['WEASEL_ATTRIBUTION'],
  'copula-avoidance': ['COPULA_AVOID'],
  'chatbot-closer': ['CHATBOT_CLOSERS'],
  'rlhf-artifacts': ['RLHF_ARTIFACTS'],
  'reasoning-chain-leak': ['REASONING_CHAIN'],
  'acknowledgment-loop': ['ACKNOWLEDGMENT_LOOP'],
  'conclusion-fluff': ['CONCLUSION_FLUFF'],
  'business-jargon': ['BUSINESS_JARGON'],
  'gpt-tics': ['GPT_TICS'],
  'claude-tics': ['CLAUDE_TICS'],
  'gemini-tics': ['GEMINI_TICS'],
  'grok-tics': ['GROK_TICS'],
  'deepseek-tics': ['DEEPSEEK_TICS'],
};

/** How each permitted rule is detected, for the `detection` field. */
const RULE_DETECTION: Readonly<Record<string, string>> = {
  'em-dash-overuse': 'count/rate over em-dashes and typographic double-hyphens',
  'plays-a-role': 'regex over the "plays a … role" template',
  'numbered-section-markers': 'sequential 01/02/03 marker detection',
  'exclamation-spam': 'exclamation count per 200 words',
  'emoji-decoration': 'emoji code-point ranges in raw text',
  'ing-trailers': 'regex over trailing ", -ing" clauses',
  'llm-artifact-leak': 'regex over model/tool artefact tokens',
  'smart-punctuation-leak': 'curly/straight punctuation mixing and zero-width characters',
  'bold-label-list': 'regex over "**Label:**" bullets',
  'aphoristic-cadence': 'regex over "not X but Y" and short-rebuttal constructions',
  'rule-of-three': 'regex over triadic "X, Y, and Z" lists',
};

/**
 * Rules the upstream itself treats as weak: gated behind a provider, or with a
 * weight no higher than the advisory band. Stated as a rule, not a list.
 */
function isWeakAlone(rule: ParsedRule): boolean {
  if (rule.gated !== undefined) return true;
  if (rule.severity === 'advisory') return true;
  return rule.weight <= 3;
}

interface ParsedRule {
  readonly id: string;
  readonly category: string;
  readonly engine: string;
  readonly severity: string;
  readonly name: string;
  readonly weight: number;
  /** Raw `weight` as written upstream, so an object form is not flattened away. */
  readonly rawWeight: string;
  readonly description: string;
  readonly gated?: string;
  readonly line: number;
}

export async function parseAiHumanizer(repoPath: string): Promise<ExtractionResult> {
  const warnings: string[] = [];
  const rules: ExtractedRule[] = [];

  const registry = await readFile(path.join(repoPath, REGISTRY_FILE), 'utf8');
  const lexicons = await readFile(path.join(repoPath, LEXICONS_FILE), 'utf8');

  const { permitted, excluded, totalDeclared } = partitionRules(registry, warnings);
  const lexiconArrays = parseStringArrays(lexicons);

  const expectedIds = Object.keys(AI_HUMANIZER_SIGNATURES).sort();
  const permittedIds = permitted.map((rule) => rule.id).sort();
  if (permittedIds.join(',') !== expectedIds.join(',')) {
    warnings.push(
      `The permitted set changed: registry has [${permittedIds.join(', ')}] but ` +
        `AI_HUMANIZER_SIGNATURES covers [${expectedIds.join(', ')}]. ` +
        'Review the stop-slop boundary at rules.mjs:148 before trusting this run.',
    );
  }

  const missingExclusions = STOP_SLOP_RULE_IDS.filter(
    (id) => !excluded.some((rule) => rule.id === id),
  );
  if (missingExclusions.length > 0) {
    warnings.push(
      `Expected stop-slop-derived ids missing from the barred section: ${missingExclusions.join(', ')}. ` +
        'The upstream may have renamed or moved them.',
    );
  }

  const leaked = permittedIds.filter((id) => STOP_SLOP_RULE_IDS.includes(id));
  if (leaked.length > 0) {
    warnings.push(`Stop-slop-derived ids leaked into the permitted set: ${leaked.join(', ')}.`);
  }

  const seen = new Set<string>();
  for (const rule of permitted) {
    if (seen.has(rule.id)) {
      warnings.push(`Duplicate rule id in the registry: ${rule.id}. Keeping the first.`);
      continue;
    }
    seen.add(rule.id);
    rules.push(buildRule(rule, lexiconArrays, warnings));
  }

  return {
    upstream: UPSTREAM,
    sourceCommit: '',
    extractedAt: new Date().toISOString(),
    sources: [REGISTRY_FILE, LEXICONS_FILE, LEXICAL_ENGINE_FILE, STYLOMETRY_ENGINE_FILE],
    rules,
    warnings,
  };
}

/**
 * Split the `RULES` array into the permitted rules and the barred ones.
 *
 * The registry is read as text with a regex over the array literal, never
 * `eval`'d or imported. The bar is positional: everything between the
 * `Absorbed from stop-slop` comment at line 148 and the next section banner is
 * excluded, whatever it contains.
 */
function partitionRules(
  registry: string,
  warnings: string[],
): { permitted: ParsedRule[]; excluded: ParsedRule[]; totalDeclared: number } {
  const lines = registry.split('\n');
  const startIndex = lines.findIndex((line) => /const RULES = \[/.test(line));
  if (startIndex < 0) {
    warnings.push('Could not find `const RULES = [` in the registry; extracted nothing.');
    return { permitted: [], excluded: [], totalDeclared: 0 };
  }

  const permitted: ParsedRule[] = [];
  const excluded: ParsedRule[] = [];
  let barred = false;
  let totalDeclared = 0;

  let openObjectAt = -1;
  let depth = 0;

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();

    if (openObjectAt < 0) {
      if (depth === 0 && /^\];/.test(trimmed)) break;

      if (trimmed.startsWith('//')) {
        if (ABSORBED_MARKER.test(trimmed)) {
          barred = true;
        } else if (SECTION_BANNER.test(line)) {
          // Any later section banner ends the stop-slop bar.
          barred = false;
        }
        continue;
      }

      if (trimmed.startsWith('{')) {
        openObjectAt = index;
        depth = 1;
        continue;
      }
      continue;
    }

    if (trimmed.startsWith('{')) depth += 1;
    if (trimmed.startsWith('}')) depth -= 1;

    if (depth === 0) {
      const block = lines.slice(openObjectAt, index + 1);
      const rule = parseRuleObject(block, openObjectAt + 1);
      if (rule) {
        totalDeclared += 1;
        if (barred) excluded.push(rule);
        else permitted.push(rule);
      } else {
        warnings.push(
          `Could not read the rule object starting at ${REGISTRY_FILE}:${openObjectAt + 1}.`,
        );
      }
      openObjectAt = -1;
    }
  }

  return { permitted, excluded, totalDeclared };
}

/**
 * Read one rule object from its source lines.
 *
 * Rules are written both on a single line and across several, and `weight` is
 * either a number or `{ default, marketing }`, so each field is matched on its
 * own rather than by position in the line.
 */
function parseRuleObject(block: readonly string[], startLine: number): ParsedRule | undefined {
  const text = block.join('\n');

  const id = field(text, /id:\s*'([^']+)'/);
  const category = field(text, /category:\s*'([^']+)'/);
  const engine = field(text, /engine:\s*'([^']+)'/);
  const severity = field(text, /severity:\s*'([^']+)'/);
  const name = field(text, /name:\s*'((?:[^'\\]|\\.)*)'/);
  const description = field(text, /description:\s*'((?:[^'\\]|\\.)*)'/);

  if (!id || !category || !engine || !severity || !name || !description) return undefined;

  // Point the locator at the `id:` line rather than at the opening brace, so
  // `rules.mjs:26` names the rule and not the blank line above it.
  const idOffset = block.findIndex((line) => /id:\s*'/.test(line));

  const weightMatch = /weight:\s*(\{[^}]*\}|\d+)/.exec(text);
  const rawWeight = weightMatch?.[1] ?? '3';
  const weight = numericWeight(rawWeight);

  const gated = field(text, /gated:\s*'([^']+)'/);

  return {
    id,
    category,
    engine,
    severity,
    name: unescape(name),
    weight,
    rawWeight,
    description: unescape(description),
    ...(gated ? { gated } : {}),
    line: startLine + (idOffset > 0 ? idOffset : 0),
  };
}

function field(text: string, pattern: RegExp): string | undefined {
  const match = pattern.exec(text);
  return match?.[1];
}

/**
 * The highest weight the rule can carry.
 *
 * `{ default: 4, marketing: 8 }` scores 8 so that the imported severity matches
 * the rule at its strongest, which is the reading that matters when deciding
 * whether one sighting justifies an edit.
 */
function numericWeight(raw: string): number {
  if (!raw.startsWith('{')) {
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) ? value : 3;
  }
  const numbers = [...raw.matchAll(/\d+/g)].map((match) => Number.parseInt(match[0], 10));
  return numbers.length > 0 ? Math.max(...numbers) : 3;
}

/** The registry's `\'` escapes, restored for the verbatim `quote`. */
function unescape(text: string): string {
  return text.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

/**
 * Build the imported rule.
 *
 * Description and quote are the upstream's own text, verbatim. Category and
 * languages come from the canonical signature rather than from the upstream's
 * coarser buckets, so that the same tell lands in the same suite taxonomy
 * whichever upstream it arrived through.
 */
function buildRule(
  rule: ParsedRule,
  lexiconArrays: ReadonlyMap<string, readonly string[]>,
  warnings: string[],
): ExtractedRule {
  const mapped = AI_HUMANIZER_SIGNATURES[rule.id];
  let signature: string;
  let signatureMapped = false;
  if (mapped) {
    assertKnownSignature(mapped, `${UPSTREAM} rule ${rule.id}`);
    signature = mapped;
    signatureMapped = true;
  } else {
    signature = unmappedSignature(SLUG, rule.id);
    signatureMapped = false;
    warnings.push(
      `${UPSTREAM} rule ${rule.id} (${rule.name}) has no signature mapping. ` +
        'Report the gap; do not invent a signature.',
    );
  }

  const spec = signatureMapped ? signatureSpec(signature) : undefined;
  const arrayNames = RULE_LEXICONS[rule.id] ?? [];
  const watchPhrases = watchPhrasesFor(arrayNames, lexiconArrays);
  const weakAlone = isWeakAlone(rule);

  const notes = [
    `Upstream severity "${rule.severity}", weight ${rule.rawWeight} (${rule.weight} effective).`,
    `Upstream category "${rule.category}", engine "${rule.engine}".`,
  ];
  if (rule.gated !== undefined) {
    notes.push(
      `Provider-gated upstream on "${rule.gated}": off unless that provider is enabled. ` +
        'Imported weak alone for the same reason.',
    );
  }
  if (arrayNames.length === 0) {
    notes.push('No lexicon array upstream; the detector is a regex or a statistic, so watchPhrases is empty.');
  }
  if (rule.id === 'exclamation-spam') {
    notes.push(
      'Signature formatting.emoji_decoration is a known collision: the canonical vocabulary has no ' +
        'punctuation-rate signature, and inventing one is out of scope.',
    );
  }
  for (const arrayName of arrayNames) {
    if (BARRED_LEXICON_ARRAYS.includes(arrayName)) {
      warnings.push(`${UPSTREAM} rule ${rule.id} references barred lexicon ${arrayName}; refused.`);
    }
  }

  return {
    upstreamRuleId: rule.id,
    signature,
    signatureMapped,
    title: rule.name,
    category: spec?.category ?? 'lexical',
    languages: spec?.languages ?? ['en'],
    description: rule.description,
    detection: detectionFor(rule, arrayNames, watchPhrases, weakAlone),
    rewriteGuidance: rewriteGuidanceFrom(rule.description),
    severity: severityFor(rule),
    watchPhrases,
    examples: [],
    weakAlone,
    locator: `${REGISTRY_FILE}:${rule.line}`,
    quote: rule.description,
    notes,
  };
}

/**
 * Severity: the upstream's own 2-12 weight mapped onto the suite's 1-5 band.
 *
 * Band by the upstream's severity label, then adjusted by weight, which is what
 * separates a `warning` the upstream scores 12 from one it scores 4:
 *
 *   warning  -> 3 (4 at weight 5-8, 5 at weight 9+)
 *   info     -> 2 (3 at weight 5-8)
 *   advisory -> 2 (never raised: the upstream calls these low-confidence)
 *
 * `llm-artifact-leak` (warning, weight 12) lands on 5, the documented intent.
 */
function severityFor(rule: ParsedRule): number {
  const base = rule.severity === 'warning' ? 3 : 2;
  let value = base;
  if (rule.severity !== 'advisory') {
    if (rule.weight >= 9) value = 5;
    else if (rule.weight >= 5) value = base + 1;
  }
  return Math.max(1, Math.min(5, value));
}

/** The instruction half of the upstream's description, kept as guidance. */
function rewriteGuidanceFrom(description: string): string {
  const sentences = description.split(/(?<=[.!?])\s+/).filter((part) => part.trim().length > 0);
  const instruction = sentences.slice(1).join(' ');
  return instruction.length > 0 ? instruction : description;
}

function detectionFor(
  rule: ParsedRule,
  arrayNames: readonly string[],
  watchPhrases: readonly WatchPhrase[],
  weakAlone: boolean,
): string {
  const parts: string[] = [];
  if (rule.engine === 'stylometry') {
    parts.push(`Stylometry engine (${STYLOMETRY_ENGINE_FILE}).`);
  } else {
    parts.push(`Lexical engine (${LEXICAL_ENGINE_FILE}).`);
  }

  const detail = RULE_DETECTION[rule.id];
  if (detail) parts.push(`Detection: ${detail}.`);

  if (arrayNames.length > 0) {
    const literals = watchPhrases.filter((phrase) => phrase.kind === 'literal').length;
    const templates = watchPhrases.filter((phrase) => phrase.kind === 'template').length;
    parts.push(`${arrayNames.length} lexicon array(s): ${arrayNames.join(', ')}.`);
    parts.push(`${literals} literal phrase(s), de-duplicated across arrays.`);
    if (templates > 0) parts.push(`${templates} template(s), not matched literally.`);
  } else {
    parts.push('No lexicon array upstream.');
  }

  if (weakAlone) parts.push('Weak alone: needs corroboration before acting.');
  return parts.join(' ');
}

/**
 * Attach an imported lexicon array to its rule.
 *
 * Entries are de-duplicated across every array the rule reads, because the
 * upstream's arrays overlap: twelve entries appear in more than one array
 * corpus-wide. `parseWatchList` equivalent classification is reused from the
 * shared extractor so that a placeholder such as `[insert ...]` is recorded as a
 * template rather than as a string a detector would try to match.
 */
function watchPhrasesFor(
  arrayNames: readonly string[],
  lexiconArrays: ReadonlyMap<string, readonly string[]>,
): WatchPhrase[] {
  const phrases: WatchPhrase[] = [];
  const seen = new Set<string>();

  for (const arrayName of arrayNames) {
    const entries = lexiconArrays.get(arrayName) ?? [];
    for (const entry of entries) {
      const text = cleanPhrase(entry);
      if (text.length === 0) continue;
      if (seen.has(text)) continue;
      seen.add(text);
      const kind = classifyPhrase(text);
      phrases.push({
        text,
        kind,
        match: kind === 'literal' ? text.toLowerCase() : text,
      });
    }
  }

  return phrases;
}

/**
 * Read the string arrays out of `scripts/lexicons.mjs`.
 *
 * Only array literals are read; the one object literal export, `JARGON_SWAPS`,
 * is skipped without being parsed, which is also the licence requirement. Values
 * keep the upstream's spelling and case, unsorted.
 */
function parseStringArrays(source: string): Map<string, readonly string[]> {
  const out = new Map<string, readonly string[]>();
  const declaration = /export const ([A-Z0-9_]+) = (\[|\{)/g;

  let match: RegExpExecArray | null;
  while ((match = declaration.exec(source)) !== null) {
    const name = match[1];
    const open = match[2];
    if (name === undefined || open === undefined) continue;
    if (open === '{') continue;

    const bodyStart = match.index + match[0].length - 1;
    const bodyEnd = matchingBracket(source, bodyStart, '[', ']');
    if (bodyEnd < 0) continue;

    out.set(name, stringEntries(source.slice(bodyStart, bodyEnd + 1)));
    declaration.lastIndex = bodyEnd + 1;
  }

  return out;
}

function matchingBracket(source: string, start: number, open: string, close: string): number {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const ch = source[index];
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/**
 * Pull the quoted entries out of an array body.
 *
 * Comments are removed first so that a commented-out example cannot become a
 * watched phrase, and both quote styles are accepted because the upstream mixes
 * them (usually to embed an apostrophe).
 */
function stringEntries(body: string): readonly string[] {
  const withoutComments = body.replace(/\/\/[^\n]*/g, '');
  const out: string[] = [];
  const literal = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;

  let match: RegExpExecArray | null;
  while ((match = literal.exec(withoutComments)) !== null) {
    const value = match[1] ?? match[2] ?? '';
    out.push(value.replace(/\\(["'\\])/g, '$1'));
  }

  return out;
}

export const AI_HUMANIZER_EXTRACTION_SCHEMA = EXTRACTION_SCHEMA_VERSION;
