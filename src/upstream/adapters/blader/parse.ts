/**
 * Parser for `blader/humanizer`.
 *
 * The reference implementation for every other Markdown adapter. `SKILL.md` is
 * the product and there is no executable code in the upstream, so the rules have
 * to be read out of the prompt mechanically rather than pasted into one.
 *
 * Shape of a pattern block:
 *
 *     ### 12. Overused AI words
 *
 *     **Watch for:** Actually, additionally, align with, ...
 *     **Problem:** Models use these words far more often than people do...
 *     **Before:**
 *     > ...
 *     **After:**
 *     > ...
 *
 * Quirks this parser has to survive, all verified against the pinned commit:
 *
 * - Eight patterns have no `Watch for` at all (6, 7, 11, 19, 20, 24, 25 and 13's
 *   stock-section variant). Those must come out as an empty list, not as a
 *   single phrase that happens to be the next field.
 * - Only pattern 8 carries a `**Rule:**` label.
 * - Three patterns (8, 11, 21) are marked `*weak alone*` or `*Weak alone.*`.
 *   Those need corroboration and are imported into the suppression layer.
 * - Watch lists mix separators: pattern 1 uses semicolons, pattern 12 uses
 *   commas, and pattern 12 contains a semicolon inside parentheses.
 * - `Before` labels carry variants, e.g. `**Before (split across sentences):**`.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { assertKnownSignature, unmappedSignature } from '../../../rules/canonical/signatures.js';
import { signatureSpec } from '../../../rules/canonical/signatures.js';
import {
  extractBlockquotes,
  extractFrontMatter,
  findBlock,
  findBlocks,
  parseLabeledBlocks,
  splitSections,
} from '../../extract/markdown.js';
import type { LabeledBlock, Section } from '../../extract/markdown.js';
import { parseWatchList } from '../../extract/phrase.js';
import { EXTRACTION_SCHEMA_VERSION } from '../../extract/types.js';
import type {
  ExtractedRule,
  ExtractionResult,
  RuleExample,
  WatchPhrase,
} from '../../extract/types.js';
import { BLADER_SECTIONS, BLADER_SIGNATURES } from './signatures.js';

const UPSTREAM = 'blader/humanizer';
const SLUG = 'blader_humanizer';
const SKILL_FILE = 'SKILL.md';

/** Patterns the upstream marks as needing company before acting on them. */
const WEAK_ALONE_PATTERN = /\*\s*weak alone\s*\.?\s*\*/i;

export async function parseBlader(repoPath: string): Promise<ExtractionResult> {
  const raw = await readFile(path.join(repoPath, SKILL_FILE), 'utf8');
  const warnings: string[] = [];
  const rules: ExtractedRule[] = [];

  const front = extractFrontMatter(raw);
  const version = front.data['metadata.version'] ?? front.data['version'];
  void version;

  const bodyOffset = front.bodyLineOffset;
  const sections = splitSections(front.body, 2, bodyOffset);

  // The pattern sections are the lettered ones: `## A. Staging instead of stating`.
  const patternSections = sections.filter((section) => /^[A-E]\.\s/.test(section.heading));
  if (patternSections.length !== 5) {
    warnings.push(
      `Expected 5 lettered pattern sections, found ${patternSections.length}. ` +
        'The upstream may have restructured; check the mapping before trusting this run.',
    );
  }

  for (const section of patternSections) {
    const letter = section.heading[0]!;
    const sectionPlain = section.heading.replace(/^[A-E]\.\s*/, '').trim();
    const expected = BLADER_SECTIONS[letter];
    if (expected && expected !== sectionPlain) {
      warnings.push(`Section ${letter} title changed: expected ${JSON.stringify(expected)}`);
    }

    const patterns = splitSections(section.body, 3, section.line);
    for (const pattern of patterns) {
      const rule = parsePattern(pattern, letter, warnings);
      if (rule) rules.push(rule);
    }
  }

  const expectedCount = Object.keys(BLADER_SIGNATURES).length;
  if (rules.length !== expectedCount) {
    warnings.push(
      `Extracted ${rules.length} patterns but the signature map covers ${expectedCount}. ` +
        'Add the missing mapping, or the new pattern will deduplicate against nothing.',
    );
  }

  return {
    upstream: UPSTREAM,
    sourceCommit: '',
    extractedAt: new Date().toISOString(),
    sources: [SKILL_FILE],
    rules,
    warnings,
  };
}

function parsePattern(
  pattern: Section,
  sectionLetter: string,
  warnings: string[],
): ExtractedRule | undefined {
  if (pattern.number === undefined) {
    // The `## Why AI text sounds the way it does` style headings are not patterns.
    return undefined;
  }

  const id = String(pattern.number);
  const blocks = parseLabeledBlocks(pattern.body, pattern.line);

  const watchBlock = findBlock(blocks, 'Watch for', 'Watch');
  const problemBlock = findBlock(blocks, 'Problem');
  const ruleBlock = findBlock(blocks, 'Rule');

  if (!problemBlock) {
    warnings.push(`Pattern ${id} has no "Problem" field; skipping.`);
    return undefined;
  }

  const watchPhrases: WatchPhrase[] = watchBlock ? parseWatchList(watchBlock.content) : [];
  if (!watchBlock) {
    // Documented upstream behaviour for 8 patterns, not a parser failure.
    // Recorded so the generated data shows the absence rather than hiding it.
  }

  const problemText = normaliseProse(problemBlock.content);
  const weakAlone = WEAK_ALONE_PATTERN.test(problemText);

  const mapped = BLADER_SIGNATURES[id];
  let signature: string;
  let signatureMapped = false;
  if (mapped) {
    assertKnownSignature(mapped, `${UPSTREAM} pattern ${id}`);
    signature = mapped;
    signatureMapped = true;
  } else {
    signature = unmappedSignature(SLUG, id);
    warnings.push(
      `${UPSTREAM} pattern ${id} (${pattern.title}) has no signature mapping. ` +
        'It will not deduplicate against the Chinese lineage.',
    );
  }

  const spec = signatureMapped ? signatureSpec(signature) : undefined;

  const examples = pairExamples(blocks);
  const noteParts: string[] = [];
  if (ruleBlock) noteParts.push(`upstream Rule: ${normaliseProse(ruleBlock.content)}`);
  if (weakAlone) noteParts.push('Marked weak alone upstream: needs corroboration.');
  if (sectionLetter) noteParts.push(`Section ${sectionLetter}: ${BLADER_SECTIONS[sectionLetter] ?? ''}`);

  return {
    upstreamRuleId: id,
    signature,
    signatureMapped,
    title: pattern.title,
    category: spec?.category ?? 'structural',
    languages: spec?.languages ?? ['en'],
    description: describeFromProblem(problemText),
    ...(buildDetection(watchPhrases, weakAlone) ?? {}),
    rewriteGuidance: problemText,
    severity: severityFor(signature, signatureMapped),
    watchPhrases,
    examples,
    weakAlone,
    locator: `${SKILL_FILE}:${pattern.line}`,
    quote: truncate(problemText, 240),
    notes: noteParts.filter((part) => part.length > 0),
  };
}

/**
 * The `Problem` field carries both the explanation and the instruction, and the
 * upstream does not separate them. The description takes the leading sentences
 * and the guidance keeps the whole field, so nothing is lost by the split.
 */
function describeFromProblem(problem: string): string {
  const sentences = problem.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const leading = sentences.slice(0, 2).join(' ');
  return leading.length > 0 ? leading : problem;
}

function buildDetection(phrases: readonly WatchPhrase[], weakAlone: boolean): { detection?: string } | undefined {
  if (phrases.length === 0) {
    return weakAlone
      ? { detection: 'No watched list upstream. Model-judged. Weak alone: needs corroboration.' }
      : { detection: 'No watched list upstream. Model-judged.' };
  }
  const literal = phrases.filter((p) => p.kind === 'literal').length;
  const templates = phrases.filter((p) => p.kind === 'template').length;
  const parts = [`${literal} literal watched phrase(s)`];
  if (templates > 0) parts.push(`${templates} construction template(s)`);
  if (weakAlone) parts.push('weak alone: requires corroboration before acting');
  return { detection: `Lexical. ${parts.join(', ')}.` };
}

/**
 * Pair each `Before` with the `After` that follows it.
 *
 * Labels are read in document order, which is the only way to associate the
 * variants: `Before (split across sentences)` belongs to the `After` that comes
 * next, not to the first `After` in the block.
 */
function pairExamples(blocks: readonly LabeledBlock[]): RuleExample[] {
  const examples: RuleExample[] = [];
  let pending: { text: string; note?: string } | undefined;

  for (const block of blocks) {
    const label = block.label.toLowerCase();
    const note = variantOf(block.label);
    if (label.startsWith('before')) {
      const quotes = extractBlockquotes(block.content, block.line);
      const text = quotes.length > 0 ? quotes.map((q) => q.text).join('\n\n') : block.content.trim();
      pending = { text, ...(note ? { note } : {}) };
      continue;
    }
    if (label.startsWith('after') && pending) {
      const quotes = extractBlockquotes(block.content, block.line);
      const after = quotes.length > 0 ? quotes.map((q) => q.text).join('\n\n') : block.content.trim();
      examples.push({
        before: pending.text,
        after,
        ...(pending.note ? { note: pending.note } : {}),
      });
      pending = undefined;
    }
  }

  return examples;
}

/** `Before (split across sentences)` -> `split across sentences`. */
function variantOf(label: string): string | undefined {
  const match = /\(([^)]+)\)/.exec(label);
  return match ? match[1]!.trim() : undefined;
}

/**
 * Severity is not stated upstream. The upstream's ordering is by strength and
 * frequency, and its own text says patterns 1 to 5 justify an edit on a single
 * sighting, so the leading group gets the higher band and weak-alone patterns
 * are held down regardless of position.
 */
function severityFor(signature: string, mapped: boolean): number {
  if (!mapped) return 2;
  const weakAloneSignatures = new Set([
    'rhythm.dash_overuse',
    'lexical.passive_and_subjectless',
    'formatting.curly_quotes',
  ]);
  if (weakAloneSignatures.has(signature)) return 2;

  const leading = new Set([
    'structural.negation_contrast',
    'structural.one_line_closer',
    'lexical.aphorism_dressing',
    'structural.staged_runup',
    'structural.arguing_with_no_one',
  ]);
  if (leading.has(signature)) return 4;

  const certain = new Set([
    'assistant.chatbot_residue',
    'assistant.knowledge_limit_disclaimer',
  ]);
  if (certain.has(signature)) return 5;

  return 3;
}

function normaliseProse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 3)}...`;
}

export const BLADER_EXTRACTION_SCHEMA = EXTRACTION_SCHEMA_VERSION;
