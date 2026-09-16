/**
 * Parser for `holygeek00/humanizer-zh-cn`.
 *
 * The simplified-Chinese fork of blader's skill, pinned at the 2.9.1 baseline.
 * `SKILL.md` is the product and there is no executable code, so the 33 patterns
 * have to be read out of the prompt mechanically.
 *
 * Shape of a pattern block:
 *
 *     ### 1. 空泛拔高意义
 *
 *     **留意：** 标志着、彰显了、体现了。
 *     **问题：** 把普通事实强行放进宏大叙事。
 *     **改前：** 本次办公室搬迁标志着公司发展迈入全新阶段。
 *     **改后：** 公司搬了办公室。原文没有说明搬迁时间、原因或实际影响。
 *
 * Quirks this parser has to survive, all verified against the pinned commit:
 *
 * - `改前` / `改后` are inline plain text on the label line, not blockquotes as
 *   in blader. Two patterns (16 and 29) are the exception and do quote their
 *   examples, so both shapes are read.
 * - Six patterns (11, 12, 14, 15, 18, 19, 23, 24, 29) carry no `留意` at all,
 *   and six (11, 12, 15, 16, 24, 29) carry no `问题`. Guidance then comes from
 *   the unlabelled prose line that follows the block, or from the `改前`/`改后`
 *   pair itself. Treating either absence as a parse failure would emit 12 bogus
 *   warnings and hide the real ones.
 * - Pattern 23 uses `**改法示例：**` where every other pattern uses `**问题：**`;
 *   it lists concrete substitutions rather than stating a problem.
 * - Three patterns (14, 18, 19) put a scope caveat in a paragraph after the
 *   examples. It is guidance the rewriter must honour, so it is captured rather
 *   than dropped.
 * - Watch lists separate with `、` and `，` and end with `。`, which
 *   `parseWatchList` already handles; some entries are constructions (`X 是 Y
 *   的底色`, `……吗`) and must not be matched literally.
 * - The suppression policy is stated once for the whole document under 避免误伤
 *   ("don't treat a single dash, a single short sentence, quotation marks, a
 *   list or a missing citation as AI evidence on its own"), not per pattern as
 *   blader's `*weak alone*` does. See `WEAK_ALONE` below.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { assertKnownSignature, signatureSpec, unmappedSignature } from '../../../rules/canonical/signatures.js';
import {
  extractBlockquotes,
  extractFrontMatter,
  findBlock,
  parseLabeledBlocks,
  splitSections,
} from '../../extract/markdown.js';
import type { LabeledBlock, Section } from '../../extract/markdown.js';
import { classifyPhrase, cleanPhrase, splitNote, splitOutsideParens } from '../../extract/phrase.js';
import { EXTRACTION_SCHEMA_VERSION } from '../../extract/types.js';
import type {
  ExtractedRule,
  ExtractionResult,
  RuleExample,
  WatchPhrase,
} from '../../extract/types.js';
import {
  HUMANIZER_ZH_CN_PATTERN_SECTION,
  HUMANIZER_ZH_CN_SIGNATURES,
} from './signatures.js';

const UPSTREAM = 'holygeek00/humanizer-zh-cn';
const SLUG = 'humanizer_zh_cn';
const SKILL_FILE = 'SKILL.md';

/** The number of patterns the upstream promises, and enforces in its validator. */
const EXPECTED_PATTERN_COUNT = 33;

/** Field labels, in the upstream's own words. */
const WATCH_LABELS = ['留意'] as const;
const PROBLEM_LABELS = ['问题'] as const;
const FIX_EXAMPLE_LABELS = ['改法示例'] as const;
const BEFORE_LABELS = ['改前'] as const;
const AFTER_LABELS = ['改后'] as const;

/**
 * Patterns whose field the upstream's suppression section names directly, so no
 * single sighting justifies an edit. Severity is held down for those.
 *
 * The section is written for the document rather than for individual patterns,
 * so `weakAlone` stays false for all 33: this fork has no per-pattern marker to
 * honour, and inventing one would suppress rules the upstream never suppressed.
 */
const CORROBORATION_ONLY = new Set([
  '13', // 无主句 — "单个破折号" and dropped subjects are ordinary.
  '14', // 破折号 — one dash is not a tell.
  '19', // 引号 — quotation marks alone are not evidence.
]);

/**
 * The two patterns the upstream calls certain: a chat wrapper or a
 * knowledge-limit disclaimer left in the text needs no company.
 */
const CERTAIN = new Set(['20', '21']);

/**
 * The leading group. The upstream orders the list strongest-first and the
 * fork inherits blader's rule that §1 to §5 justify an edit on one sighting,
 * so the five leading patterns carry the higher band.
 */
const LEADING = new Set(['1', '2', '3', '4', '5', '6']);

export async function parseHumanizerZhCn(repoPath: string): Promise<ExtractionResult> {
  const raw = await readFile(path.join(repoPath, SKILL_FILE), 'utf8');
  const warnings: string[] = [];
  const rules: ExtractedRule[] = [];

  const front = extractFrontMatter(raw);
  const version = front.data['metadata.version'] ?? front.data['version'];
  void version;

  const bodyOffset = front.bodyLineOffset;
  const sections = splitSections(front.body, 2, bodyOffset);

  const patternSection = sections.find(
    (section) => section.title === HUMANIZER_ZH_CN_PATTERN_SECTION,
  );
  if (!patternSection) {
    warnings.push(
      `Section ${JSON.stringify(HUMANIZER_ZH_CN_PATTERN_SECTION)} is missing from ${SKILL_FILE}. ` +
        'The upstream restructured; check the section heading before trusting this run.',
    );
    return {
      upstream: UPSTREAM,
      sourceCommit: '',
      extractedAt: new Date().toISOString(),
      sources: [SKILL_FILE],
      rules,
      warnings,
    };
  }

  const patterns = splitSections(patternSection.body, 3, patternSection.line);
  for (const pattern of patterns) {
    const rule = parsePattern(pattern, warnings);
    if (rule) rules.push(rule);
  }

  if (rules.length !== EXPECTED_PATTERN_COUNT) {
    warnings.push(
      `Extracted ${rules.length} patterns from ${SKILL_FILE} but the upstream holds ` +
        `${EXPECTED_PATTERN_COUNT}. The fork keeps the 33 numbering deliberately; a change here ` +
        'means the signature map needs re-checking.',
    );
  }

  const numbers = rules.map((rule) => Number.parseInt(rule.upstreamRuleId, 10));
  for (let index = 0; index < numbers.length; index += 1) {
    if (numbers[index] !== index + 1) {
      warnings.push(
        `Pattern numbering is not contiguous at position ${index + 1}: found ${String(numbers[index])}.`,
      );
      break;
    }
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

function parsePattern(pattern: Section, warnings: string[]): ExtractedRule | undefined {
  if (pattern.number === undefined) {
    // The section has nothing but the 33 numbered headings, so this is a
    // restructure rather than an expected non-pattern heading.
    warnings.push(`Unnumbered heading under the pattern section: ${JSON.stringify(pattern.title)}.`);
    return undefined;
  }

  const id = String(pattern.number);
  const blocks = parseLabeledBlocks(pattern.body, pattern.line);

  const watchBlock = findBlock(blocks, ...WATCH_LABELS);
  const problemBlock = findBlock(blocks, ...PROBLEM_LABELS);
  const fixExampleBlock = findBlock(blocks, ...FIX_EXAMPLE_LABELS);

  const watchPhrases: WatchPhrase[] = watchBlock ? readWatchList(fieldText(watchBlock)) : [];
  const examples = pairExamples(blocks);
  const bodyProse = extractBodyProse(pattern, blocks);

  const notes: string[] = [];
  if (!watchBlock) {
    // Nine patterns have no 留意 list. Documented upstream behaviour, not a
    // parser failure, so this is recorded as a note rather than a warning.
    notes.push('No 留意 watched list upstream; detection is model-judged.');
  }

  // The 问题 field carries both the explanation and the instruction, as in
  // blader. Nine patterns state no problem at all and three more leave it to a
  // paragraph after the examples, so the fallback order matters.
  const problemText = problemBlock ? normaliseProse(fieldText(problemBlock)) : '';
  const fixExampleText = fixExampleBlock ? normaliseProse(fieldText(fixExampleBlock)) : '';

  let guidance = problemText;
  if (guidance.length === 0 && fixExampleText.length > 0) {
    guidance = fixExampleText;
    notes.push('Guidance taken from the upstream 改法示例 substitutions.');
  }
  if (guidance.length === 0 && bodyProse.length > 0) {
    guidance = bodyProse;
    notes.push('Guidance taken from the unlabelled paragraph after the examples.');
  }
  if (guidance.length === 0) {
    guidance = guidanceFromExamples(examples);
    notes.push('No 问题 field and no trailing prose; guidance reconstructed from 改前/改后.');
  }
  // Four patterns (14, 18, 19 and 24) put a scope caveat after the examples. It
  // is guidance whichever branch above won, so it is always recorded.
  if (bodyProse.length > 0 && guidance !== bodyProse) {
    notes.push('Has a scope caveat paragraph after the examples; see the upstream body.');
  }

  const mapped = HUMANIZER_ZH_CN_SIGNATURES[id];
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
        'It will not deduplicate against the English lineage.',
    );
  }

  const spec = signatureMapped ? signatureSpec(signature) : undefined;

  if (!signatureMapped) notes.push('No canonical signature claimed; see the extraction warnings.');

  const description = describeFromText(problemText || bodyProse || fixExampleText, examples);

  return {
    upstreamRuleId: id,
    signature,
    signatureMapped,
    title: pattern.title,
    category: spec?.category ?? 'structural',
    languages: languagesFor(spec?.languages),
    description,
    ...(buildDetection(watchPhrases, fixExampleBlock !== undefined, watchBlock === undefined) ?? {}),
    rewriteGuidance: guidance,
    severity: severityFor(id, signatureMapped),
    watchPhrases,
    examples,
    weakAlone: false,
    locator: `${SKILL_FILE}:${pattern.line}`,
    quote: truncate(problemText || bodyProse || fixExampleText || guidanceFromExamples(examples), 240),
    notes: [...notes, `Upstream heading: ${pattern.heading}`],
  };
}

/**
 * The languages a rule applies to.
 *
 * The signature already states which languages the tell occurs in — `BOTH` for
 * the shared ones, `ZH` for the Chinese-only ones — and this clone is Chinese
 * text, so `zh` is always true of an extracted rule. Without the union, a
 * shared tell whose spec lists only `en` (blader's shallow -ing riders, which
 * pattern 3 localises) would be filed as an English-only rule read out of a
 * Chinese document.
 */
function languagesFor(declared: readonly string[] | undefined): readonly string[] {
  const out = new Set(declared ?? []);
  out.add('zh');
  return ['en', 'zh'].filter((language) => out.has(language));
}

/**
 * The `问题` field carries both the explanation and the instruction, and the
 * upstream does not separate them. The description takes the leading sentence
 * or two and the guidance keeps the whole field, so nothing is lost.
 *
 * Chinese prose ends a sentence with `。`, not a space, so the split has to be
 * on the CJK terminators; splitting on `[.!?]` alone would return the whole
 * paragraph as one "sentence".
 */
function describeFromText(source: string, examples: readonly RuleExample[]): string {
  const text = source.length > 0 ? source : guidanceFromExamples(examples);
  const sentences = [...text.matchAll(/[^。！？!?]+[。！？!?]?/g)]
    .map((match) => match[0].trim())
    .filter((sentence) => sentence.length > 0);
  const leading = sentences.slice(0, 2).join('');
  return leading.length > 0 ? leading : text;
}

function guidanceFromExamples(examples: readonly RuleExample[]): string {
  const example = examples[0];
  if (!example) return '';
  return `改前：${example.before} 改后：${example.after}`;
}

function buildDetection(
  phrases: readonly WatchPhrase[],
  hasFixExamples: boolean,
  missingWatchList: boolean,
): { detection?: string } | undefined {
  if (phrases.length === 0) {
    if (hasFixExamples) {
      return { detection: 'No watched list upstream. The 改法示例 substitutions define the rewrite.' };
    }
    if (missingWatchList) {
      return { detection: 'No watched list upstream. Model-judged.' };
    }
    return { detection: 'No watched list upstream. Model-judged.' };
  }
  const literal = phrases.filter((p) => p.kind === 'literal').length;
  const templates = phrases.filter((p) => p.kind === 'template').length;
  const references = phrases.filter((p) => p.kind === 'reference').length;
  const parts = [`${literal} literal watched phrase(s)`];
  if (templates > 0) parts.push(`${templates} construction template(s)`);
  if (references > 0) parts.push(`${references} reference-only entry(ies)`);
  return { detection: `Lexical. ${parts.join(', ')}.` };
}

/**
 * Read a `留意` list into phrases.
 *
 * `parseWatchList` segments the shared shape, but two of its rules work against
 * Chinese enumeration lists, both verified against this pinned clone:
 *
 * 1. It splits on `、` only for a group that carries no construction marker.
 *    Pattern 1's list is one group whose last two entries contain `……`, so all
 *    eight items came back as a single "template" and the lexical detector lost
 *    every phrase in it. Patterns 3 and 7 were the same shape.
 * 2. Its separator scan does not treat `“...”` as quoted, so pattern 10's
 *    `“第一、第二、第三”无论内容是否适合` was cut into `“第一` and `第二`.
 *
 * `phrase.ts` serves the whole corpus and is not this adapter's to change, so
 * the list is segmented here instead. Semicolons always separate. `、` always
 * separates, outside parentheses and outside quotes. `，` separates only where
 * the group holds no `、` at all: the upstream uses `、` for its enumerations, so
 * a `，` beside one is a construction (`为……奠定基础、推动……迈上新台阶` is two
 * templates, not four), while a group with no `、` is a flat list
 * (`“洞察趋势：解码未来”“破局增长，共创未来”` is two quoted examples). No group
 * in this clone uses both, which is why the rule is safe here.
 */
function readWatchList(raw: string): WatchPhrase[] {
  const entries: WatchPhrase[] = [];
  for (const group of splitOutsideParens(raw, SEMICOLONS)) {
    for (const byEnumeration of splitOutsideParensAndQuotes(group, ['\u3001'])) {
      const parts = byEnumeration.includes('\u3001')
        ? [byEnumeration]
        : splitOutsideParensAndQuotes(byEnumeration, ['\uff0c']);
      for (const part of parts) {
        const { text, note } = splitNote(part);
        const cleaned = cleanPhrase(text);
        if (cleaned.length === 0) continue;
        const kind = classifyPhrase(cleaned);
        entries.push({
          text: cleaned,
          kind,
          match: kind === 'literal' ? cleaned.toLowerCase() : cleaned,
          ...(note ? { note } : {}),
        });
      }
    }
  }
  return entries;
}

const SEMICOLONS = [';', '\uff1b'] as const;
const QUOTE_CHARS = ['\u201c', '\u201d', '\u2018', '\u2019', '"', "'"] as const;
const OPEN_DEPTH = ['(', '\uff08', '[', '\u3010'] as const;
const CLOSE_DEPTH = [')', '\uff09', ']', '\u3011'] as const;

/** Split on the given characters when they are outside parentheses and quotes. */
function splitOutsideParensAndQuotes(text: string, separators: readonly string[]): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let quoteOpen = false;

  for (const ch of text) {
    if (QUOTE_CHARS.includes(ch as (typeof QUOTE_CHARS)[number])) quoteOpen = !quoteOpen;
    if (OPEN_DEPTH.includes(ch as (typeof OPEN_DEPTH)[number])) depth += 1;
    if (CLOSE_DEPTH.includes(ch as (typeof CLOSE_DEPTH)[number])) depth = Math.max(0, depth - 1);

    if (depth === 0 && !quoteOpen && separators.includes(ch)) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);

  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

/**
 * The content of one labelled field, with the paragraph that follows it removed.
 *
 * `parseLabeledBlocks` runs a field from its label to the next label or to the
 * end of the section, so an unlabelled paragraph after the last field is
 * appended to that field. Four patterns (14, 18, 19 and 24) end with exactly
 * such a paragraph — a scope caveat that is guidance, not example — and it was
 * landing inside the `改后` text.
 *
 * Two shapes have to be told apart:
 *
 * - inline (`**改后：** text`), where the field is the single label line. Any
 *   further line is the next paragraph, because the upstream never wraps one.
 * - quoted (`**改前：**` then `> ...`), where the field is the first blockquote;
 *   text after that blank line is again a separate paragraph.
 */
function fieldText(block: LabeledBlock): string {
  const isQuoted = /^\s*>/.test(block.content);
  if (!isQuoted) {
    const [first = ''] = block.content.split(/\n\s*\n/);
    return first.trim();
  }
  const quotes = extractBlockquotes(block.content, block.line);
  if (quotes.length === 0) return block.content.trim();
  return quotes.map((quote) => quote.text).join('\n\n').trim();
}

/**
 * Pair each `改前` with the `改后` that follows it, in document order.
 *
 * blader's examples live in blockquotes; this fork writes them on the label
 * line. Two patterns (16 and 29) quote them anyway, so the blockquote is
 * stripped when present and the inline text used when it is not.
 */
function pairExamples(blocks: readonly LabeledBlock[]): RuleExample[] {
  const examples: RuleExample[] = [];
  let pending: string | undefined;

  for (const block of blocks) {
    const label = block.label.toLowerCase();
    if (BEFORE_LABELS.some((prefix) => label.startsWith(prefix))) {
      pending = exampleText(block);
      continue;
    }
    if (AFTER_LABELS.some((prefix) => label.startsWith(prefix)) && pending !== undefined) {
      const before = pending;
      pending = undefined;
      if (before.length === 0) continue;
      examples.push({ before, after: exampleText(block) });
    }
  }

  return examples;
}

function exampleText(block: LabeledBlock): string {
  return normaliseProse(fieldText(block));
}

/**
 * The paragraph an upstream author wrote between or after the labelled fields.
 *
 * Three patterns (14, 18, 19) put a scope caveat there correctly, and one (24)
 * does too. It tells the rewriter when NOT to apply the rule, so dropping it
 * would make the guidance wrong.
 *
 * The end of each field is recomputed rather than taken from
 * `parseLabeledBlocks`, because that reader absorbs the trailing paragraph into
 * the last field and would make the caveat look like part of the example.
 */
function extractBodyProse(section: Section, blocks: readonly LabeledBlock[]): string {
  const lines = section.body.split(/\r?\n/);
  const labelLines = new Set(blocks.map((block) => block.line - section.line - 1));
  const own = new Set<number>();
  for (const block of blocks) {
    const end = fieldEndOffset(lines, labelLines, block.line - section.line - 1);
    for (let index = block.line - section.line - 1; index <= end && index < lines.length; index += 1) {
      own.add(index);
    }
  }

  const chunks: string[] = [];
  let current: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (own.has(index) || line.trim() === '') {
      if (current.length > 0) chunks.push(current.join(' '));
      current = [];
      continue;
    }
    current.push(line.trim());
  }
  if (current.length > 0) chunks.push(current.join(' '));

  return normaliseProse(chunks.map((chunk) => stripMarkup(chunk)).join(' '));
}

/**
 * 0-based body offset of the last line a labelled field owns.
 *
 * Inline fields end on their own line. Quoted fields keep every continuation
 * line, including the blank lines between quoted paragraphs, and stop before the
 * blank line that introduces ordinary prose.
 */
function fieldEndOffset(
  lines: readonly string[],
  labelLines: ReadonlySet<number>,
  start: number,
): number {
  let end = start;
  let quoted = false;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (labelLines.has(index)) break;
    const line = lines[index] ?? '';
    if (line.trim() === '') {
      const more = /^\s*>/.test(lines[index + 1] ?? '');
      if (!quoted || !more) break;
      end = index;
      continue;
    }
    if (!quoted && !/^\s*>/.test(line)) break;
    quoted = true;
    end = index;
  }
  return end;
}

/**
 * Severity is not stated upstream. The ordering is strongest-first, so the
 * leading patterns get the higher band, the two certain chat leftovers get the
 * top band, and the tells the suppression section names as ordinary on their
 * own are held down.
 */
function severityFor(id: string, mapped: boolean): number {
  if (!mapped) return 2;
  if (CORROBORATION_ONLY.has(id)) return 2;
  if (CERTAIN.has(id)) return 5;
  if (LEADING.has(id)) return 4;
  return 3;
}

/** Strip inline markup so the stored text is prose, not Markdown. */
function stripMarkup(text: string): string {
  return text.replace(/\*\*/g, '').replace(/`/g, '');
}

function normaliseProse(text: string): string {
  return stripMarkup(text).replace(/\s+/g, ' ').trim();
}

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 3)}...`;
}

export const HUMANIZER_ZH_CN_EXTRACTION_SCHEMA = EXTRACTION_SCHEMA_VERSION;
