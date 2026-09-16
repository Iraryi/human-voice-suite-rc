/**
 * Parser for `ai-zixun/humanizer-zh`.
 *
 * Not a `blader` localisation. This upstream keeps its own 13-pattern taxonomy
 * in `references/patterns.md` and eight normative "Core Rules" in `SKILL.md`,
 * and it acknowledges blader as inspiration only. Both files are parsed here.
 *
 * Shape of a pattern block in `references/patterns.md`:
 *
 *     ## 1. 机械对照句
 *
 *     常见问题：
 *
 *     - `不是……而是……`
 *     - `不仅……还……`
 *
 *     这些句式不是不能用，而是 AI 很容易反复套用，导致节奏发硬。
 *
 *     修改前：
 *
 *     > ...
 *
 *     修改后：
 *
 *     > ...
 *
 * Quirks this parser has to survive, all verified against the pinned commit:
 *
 * - The heading level is `##`, not `###` like blader, and the heading is
 *   numbered `N. 标题`. `splitSections(body, 2)` is therefore the top level.
 * - The document opens with a `## 目录` table of contents that itself contains
 *   fourteen numbered lines. `parseHeadingNumber('目录')` returns no number, so
 *   the section is dropped on `number === undefined` rather than becoming a
 *   fourteenth bogus rule.
 * - Section 10 contains six `### N.` rewrite sub-paths. Those are H3, so the
 *   H2 split never sees them as patterns; they stay inside pattern 10's body.
 * - Labels are plain `常见问题：` / `修改前：`, not blader's `**Watch for:**`
 *   bold form, so `parseLabeledBlocks` cannot read them. A local segmenter
 *   reads `^.{1,12}[：:]$` lines instead.
 * - Watched phrases are the backtick-quoted spans in those bullet lists, and
 *   the spans carry the templates (`不是……而是……`). A bullet whose backticks
 *   hold a full sentence, e.g. section 11's 第一步 line, is not a phrase.
 * - Section 5 has no watched-phrase label at all: its tells are prose bullets
 *   (`一段里硬塞三项排比…`, `每个 bullet 都是 …`) and yields an empty list.
 * - Section 6 lists no phrases either; its punctuation tells live in the
 *   guidance bullets (`长破折号 \`——\` 优先改成…`), so the `——` is recognised
 *   separately as a punctuation tell to keep the rule from looking empty.
 * - Section 8 has no phrase label and no per-bullet backticks; its two watched
 *   phrases are the `过度谨慎：`/`过度确定：` prefixes of its example bullets.
 * - Guidance label varies: `优先做法：`, `处理方法：`, `处理原则：`,
 *   `更自然的写法：`, `使用方法：`, `两种都常见：`.
 * - `SKILL.md` numbers its eight Core Rules `### 1.` .. `### 8.` under
 *   `## Core Rules`. Their ids are namespaced `core-N` so they cannot collide
 *   with pattern numbers.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { assertKnownSignature, unmappedSignature } from '../../../rules/canonical/signatures.js';
import { signatureSpec } from '../../../rules/canonical/signatures.js';
import { splitSections } from '../../extract/markdown.js';
import type { Section } from '../../extract/markdown.js';
import { classifyPhrase, cleanPhrase, containsTemplateMarker } from '../../extract/phrase.js';
import { EXTRACTION_SCHEMA_VERSION } from '../../extract/types.js';
import type {
  ExtractedRule,
  ExtractionResult,
  RuleExample,
  WatchPhrase,
} from '../../extract/types.js';
import { HUMANIZER_ZH_SIGNATURES } from './signatures.js';

const UPSTREAM = 'ai-zixun/humanizer-zh';
const SLUG = 'humanizer_zh';
const PATTERNS_FILE = 'references/patterns.md';
const SKILL_FILE = 'SKILL.md';

/** The upstream's own count. A change here is a signal to re-map, not to ignore. */
const EXPECTED_PATTERNS = 13;

/** `## Core Rules` in `SKILL.md`, and the eight `### N.` rules under it. */
const CORE_SECTION_TITLE = 'Core Rules';
const EXPECTED_CORE_RULES = 8;

/**
 * Severity is not stated upstream for either file. The 13 patterns are ordered
 * by how often the upstream's own prose says the tell recurs, and its examples
 * are written as "this shows up everywhere" rather than "this needs company".
 * Nothing is marked weak alone, so the leading Chinese patterns get the higher
 * band and the punctuation/formatting ones are held down.
 */
const HIGH_SEVERITY_PATTERNS = new Set([1, 2, 3, 4, 7, 9, 12, 13]);
const LOW_SEVERITY_PATTERNS = new Set([5, 6, 10, 11]);

export async function parseHumanizerZh(repoPath: string): Promise<ExtractionResult> {
  const raw = await readFile(path.join(repoPath, PATTERNS_FILE), 'utf8');
  const warnings: string[] = [];
  const disclosures: string[] = [];
  const rules: ExtractedRule[] = [];

  const sections = splitSections(raw, 2);
  const patterns = sections.filter(
    (section) => section.number !== undefined && /^\d{1,3}\.\s/.test(section.heading),
  );

  if (patterns.length !== EXPECTED_PATTERNS) {
    warnings.push(
      `Expected ${EXPECTED_PATTERNS} numbered pattern sections in ${PATTERNS_FILE}, ` +
        `found ${patterns.length}. The upstream may have restructured; check the ` +
        'signature mapping before trusting this run.',
    );
  }

  for (const pattern of patterns) {
    rules.push(parsePattern(pattern, warnings));
  }

  const numbers = patterns.map((pattern) => pattern.number);
  for (let index = 0; index < numbers.length; index += 1) {
    if (numbers[index] !== index + 1) {
      warnings.push(
        `Pattern numbering is not contiguous at position ${index + 1}: found ` +
          `${String(numbers[index])}. The 目录 section may have been mistaken for a pattern.`,
      );
      break;
    }
  }

  // Core Rules are normative, so they are imported — but under their own
  // `core-N` namespace, because patterns 1 to 8 would otherwise collide.
  rules.push(...(await parseCoreRules(repoPath, warnings, disclosures)));

  return {
    upstream: UPSTREAM,
    // Filled in from the clone's git HEAD by the extraction runner, as in the
    // other adapters; the parser never shells out.
    sourceCommit: '',
    extractedAt: new Date().toISOString(),
    sources: [PATTERNS_FILE, SKILL_FILE],
    rules,
    warnings,
    disclosures,
  };
}

/* ------------------------------------------------------------------ patterns */

function parsePattern(pattern: Section, warnings: string[]): ExtractedRule {
  const id = String(pattern.number);
  const line = pattern.line;
  const segments = mergeLeadingProse(segment(pattern.body, line));

  const watchPhrases = extractPatternPhrases(segments, pattern.number ?? 0);
  const guidance = guidanceText(segments);
  const prose = proseText(segments);

  if (watchPhrases.length === 0 && prose.length === 0 && guidance.length === 0) {
    warnings.push(`Pattern ${id} (${pattern.title}) has no body text; the section may have moved.`);
  }

  const examples = pairExamples(segments);

  const mapped = HUMANIZER_ZH_SIGNATURES[id];
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
  const body = descriptionSource(segments, watchPhrases);
  const description = leadingSentences(body, 2) || pattern.title;

  return {
    upstreamRuleId: id,
    signature,
    signatureMapped,
    title: pattern.title,
    category: spec?.category ?? 'structural',
    languages: spec?.languages ?? ['zh'],
    description,
    detection: describeDetection(watchPhrases, false),
    rewriteGuidance: guidance.length > 0 ? guidance : description,
    severity: severityForPattern(pattern.number ?? 0, signatureMapped),
    watchPhrases,
    examples,
    weakAlone: false,
    locator: `${PATTERNS_FILE}:${line}`,
    quote: excerpt(body || description, 110),
    notes: [sectionNotes(PATTERNS_FILE)],
  };
}

/* --------------------------------------------------------------- Core Rules */

/**
 * Core Rules whose headline claim is already stated by a pattern in the same
 * upstream, and which are therefore NOT imported.
 *
 * This is the one place where importing more would make the suite worse. Core
 * Rule 1 says "fix translationese: split English-syntax sentences, avoid
 * 「对于……来说」, do not default to 不是……而是……" — the middle clause is
 * pattern 2's watched phrase verbatim and the last is pattern 1's. Core Rule 2
 * says "drop vague grand words like 赋能/颠覆, avoid 「这标志着……」" — pattern 3's
 * vocabulary and pattern 12's auto-closer.
 *
 * Imported as separate rules they would carry different signatures, so
 * deduplication could not collapse them, and a text containing
 * 「对于……来说」 would be charged twice for one tell. That is the failure this
 * project exists to prevent, so the two restatements are excluded and the
 * genuinely new Core Rules are kept.
 *
 * The new content in these two is not lost: Core Rule 1's sentence-splitting and
 * Core Rule 2's "ground the abstraction in mechanism" are recorded in the
 * disclosure below as Phase 3 vocabulary work rather than smuggled in as rules
 * that double-charge.
 */
const RESTATED_CORE_RULES: ReadonlySet<string> = new Set(['core-1', 'core-2']);

async function parseCoreRules(
  repoPath: string,
  warnings: string[],
  disclosures: string[],
): Promise<ExtractedRule[]> {
  const raw = await readFile(path.join(repoPath, SKILL_FILE), 'utf8');
  const sections = splitSections(raw, 2);
  const core = sections.find((section) => section.heading === CORE_SECTION_TITLE);
  if (!core) {
    warnings.push(
      `${SKILL_FILE} has no "## ${CORE_SECTION_TITLE}" section; the eight Core Rules ` +
        'were not imported.',
    );
    return [];
  }

  const subSections = splitSections(core.body, 3, core.line);
  const numbered = subSections.filter((section) => section.number !== undefined);
  if (numbered.length !== EXPECTED_CORE_RULES) {
    warnings.push(
      `Expected ${EXPECTED_CORE_RULES} Core Rules under "## ${CORE_SECTION_TITLE}", ` +
        `found ${numbered.length}.`,
    );
  }

  const kept = numbered.filter(
    (section) => !RESTATED_CORE_RULES.has(`core-${section.number}`),
  );
  const dropped = numbered.filter((section) =>
    RESTATED_CORE_RULES.has(`core-${section.number}`),
  );

  for (const section of dropped) {
    disclosures.push(
      `Core Rule ${section.number} (${section.title}) restates patterns already ` +
        'extracted from references/patterns.md, so it is deliberately not a rule: ' +
        'importing it would charge one tell twice, because the duplicate would carry ' +
        'a different signature and deduplication could not collapse it. The genuinely ' +
        'new content it carries — sentence splitting, and grounding an abstraction in ' +
        'mechanism — needs its own signatures, which is Phase 3 vocabulary work.',
    );
  }

  return kept.map((section) => parseCoreRule(section, warnings));
}

function parseCoreRule(section: Section, warnings: string[]): ExtractedRule {
  // The namespace is load-bearing: `core-1` must not collide with pattern `1`.
  const id = `core-${section.number}`;
  const segments = segment(section.body, section.line);
  const bullets = bulletsOf(segments);
  const watchPhrases = extractCorePhrases(segments);
  const guidance = guidanceText(segments) || bullets.join(' ');
  const description = leadingSentences(bullets.join(' '), 2) || section.title;

  const mapped = HUMANIZER_ZH_SIGNATURES[id];
  let signature: string;
  let signatureMapped = false;
  if (mapped) {
    assertKnownSignature(mapped, `${UPSTREAM} Core Rule ${section.number}`);
    signature = mapped;
    signatureMapped = true;
  } else {
    signature = unmappedSignature(SLUG, id);
    warnings.push(
      `${UPSTREAM} Core Rule ${section.number} (${section.title}) has no canonical signature. ` +
        'It is imported under its own namespace but will not deduplicate.',
    );
  }

  const spec = signatureMapped ? signatureSpec(signature) : undefined;

  return {
    upstreamRuleId: id,
    signature,
    signatureMapped,
    title: section.title,
    category: spec?.category ?? 'chinese',
    languages: spec?.languages ?? ['zh'],
    description,
    detection: `Upstream Core Rule. ${bullets.length} normative bullet(s); model-judged.`,
    rewriteGuidance: guidance || description,
    severity: severityForCore(section.number ?? 0, signatureMapped),
    watchPhrases,
    examples: [],
    weakAlone: false,
    locator: `${SKILL_FILE}:${section.line}`,
    quote: excerpt(guidance || description, 110),
    notes: [
      'Namespaced `core-N`: the upstream numbers these 1..8 inside SKILL.md, ' +
        'which would collide with patterns 1..8 of references/patterns.md.',
      sectionNotes(SKILL_FILE),
    ],
  };
}

/* --------------------------------------------------------------- segmenter */

/** What a labelled block in this upstream is for. */
type SegmentRole = 'watch' | 'guidance' | 'before' | 'after' | 'prose';

interface Segment {
  readonly label?: string;
  readonly text: string;
  readonly line: number;
  readonly role: SegmentRole;
}

/**
 * Split a section body into labelled blocks, separating bullets from prose.
 *
 * `parseLabeledBlocks` only understands `**Label:**`, and this upstream writes
 * `常见问题：` with no asterisks, so the labels are read here. Two details make
 * that harder than it looks:
 *
 * 1. Only the four labels the upstream actually uses are treated as labels
 *    (`常见问题`, `高频问题词`, `常见问题` variants, and the `*做法`/`*原则`/
 *    `*方法`/`*写法` guidance labels). Any other short line ending in a colon —
 *    pattern 4's `未来已经到来：`-style slogans, pattern 7's long explanatory
 *    sentence ending in `：**先给定义…**` — is prose, and is kept in the body
 *    text instead of being mistaken for a field.
 * 2. A "watch" block holds both the phrase bullets and the sentence that
 *    explains them, with no blank-line separation:
 *
 *        常见问题：
 *
 *        - `不是……而是……`
 *        - `不仅……还……`
 *
 *        这些句式不是不能用，而是 AI 很容易反复套用，导致节奏发硬。
 *
 *    The trailing sentence is the pattern's `description`, not a watched
 *    phrase. Splitting on the bullet/non-bullet boundary keeps the two apart;
 *    without it pattern 1's description would be lost and its `quote` would be
 *    the bare phrase list.
 */
function segment(body: string, lineOffset: number): Segment[] {
  const lines = body.split(/\r?\n/);
  const out: Segment[] = [];
  let label: string | undefined;
  let role: SegmentRole = 'prose';
  let start = lineOffset + 1;
  // `bullets` and `text` are separate because a "watch" field is a bullet list
  // followed by an explanation with no blank line between them. `raw` keeps the
  // untouched lines, which the blockquote fields need.
  let bullets: string[] = [];
  let text: string[] = [];
  let raw: string[] = [];

  const flush = (): void => {
    const at = label;
    const joined = text.join('\n').trim();
    if (role === 'watch' && at !== undefined && bullets.length > 0) {
      out.push({ label: at, text: bullets.join('\n').trim(), line: start, role: 'watch' });
      // Anything after the bullets explains the tell. In pattern 8 that
      // explanation repeats the two phrases already read off the bullets, so it
      // stays a watch block; elsewhere it is the pattern's prose.
      if (joined.length > 0) {
        out.push({ text: joined, line: start, role: at === '常见问题' ? 'watch' : 'prose' });
      }
    } else if (role === 'watch' && at !== undefined && joined.length > 0) {
      // A `常见问题：` block whose first line is prose — patterns 9 to 13 write
      // `常见问题：\n\n- 第一段抛一个题目…` — is the upstream explaining the
      // tell, so the label text is folded in and the block becomes prose.
      out.push({ text: `${at}：${joined}`, line: start, role: 'prose' });
    } else if (role === 'before' || role === 'after') {
      // A `修改前：` / `修改后：` field holds a blockquote, so its lines keep
      // their `>` markers; only quote markers are stripped later.
      out.push({ text: blockquoteText(raw.join('\n')), line: start, role });
    } else {
      // Guidance bullets are the instruction; a sentence after them is the
      // upstream's own summary of the tell, so the two are both kept.
      if (bullets.length > 0) {
        out.push({ label: at ?? 'guidance', text: bullets.join('\n').trim(), line: start, role });
      }
      if (joined.length > 0) {
        out.push({
          text: at === undefined ? joined : `${at}：${joined}`,
          line: start,
          role: 'prose',
        });
      }
    }
    text = [];
    bullets = [];
    raw = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i] ?? '';
    const found = plainLabel(current);
    if (found !== undefined) {
      flush();
      label = found;
      role = roleOf(found);
      start = i + 1 + lineOffset;
      // The label's own content starts here, with no text of its own.
      continue;
    }
    // Blank lines separate fields; they are not content and must not split a
    // block, because `常见问题：` is followed by a blank line and then bullets.
    if (current.trim().length === 0) continue;
    raw.push(current);

    if (/^\s*[-*]\s+/.test(current)) {
      // Only a known field splits its content into bullets. Pattern 8's
      // `两种都常见：` is not a field, so its list stays part of the prose the
      // upstream wrote and is read back as the rule's explanation.
      if (role === 'watch' || role === 'guidance') {
        // The marker is kept so `bulletsOf` can read the list back; the phrase
        // reader strips it when it takes the phrase text.
        bullets.push(current.trim());
      } else {
        text.push(current);
      }
      continue;
    }
    text.push(current);
  }
  flush();

  return out;
}

/** Only the labels this upstream actually uses are treated as fields. */
function plainLabel(line: string): string | undefined {
  const match = /^(.{1,12})[：:]\s*$/.exec(line.trim());
  if (!match) return undefined;
  const label = match[1]!.trim();
  return KNOWN_LABELS.has(label) ? label : undefined;
}

/**
 * The label vocabulary, taken verbatim from the 13 pattern sections.
 *
 * `两种都常见` is deliberately absent: pattern 8's examples already name the two
 * tells, and its bullets are `过度谨慎：…` / `过度确定：…` — labels in shape but
 * prose in function.
 */
const KNOWN_LABELS: ReadonlySet<string> = new Set([
  '常见问题',
  '高频问题词',
  '优先做法',
  '处理方法',
  '处理原则',
  '更自然的写法',
  '使用方法',
  '修改前',
  '修改后',
]);

function roleOf(label: string): SegmentRole {
  if (label === '修改前') return 'before';
  if (label === '修改后') return 'after';
  if (label === '常见问题' || label === '高频问题词') return 'watch';
  return 'guidance';
}

/* ------------------------------------------------------------------ phrases */

/**
 * Punctuation tells that are matchable but too short for `classifyPhrase`'s
 * length floor, which would file them as `reference`. Named here so the
 * exception is visible rather than silently lost.
 *
 * The colon and the dash are checked against the whole section body because the
 * upstream only names them in its guidance; the quote styles are checked against
 * the bullet text, because those two marks are the whole point of the rule.
 */
const COLON_TELL = '：';
const DASH_TELL = '——';
const QUOTE_TELLS: readonly string[] = ['""', '「」'];
const SHORT_PUNCTUATION_TELLS: readonly string[] = [COLON_TELL, DASH_TELL, ...QUOTE_TELLS];

/**
 * Pattern 6 is the only pattern whose tell *is* the punctuation. Section 8 says
 * `过度谨慎：…` and section 9 says `结尾突然拔高成「…」`, so a blanket
 * "the body contains a colon/dash/quote" test would hand every pattern the same
 * phrase. Scoped to the punctuation pattern, the marks are the real watched
 * items.
 */
const PUNCTUATION_PATTERN = 6;

/**
 * The watched phrases are the backtick spans in the watch segments, plus the
 * punctuation marks of pattern 6 where the mark itself is the tell.
 *
 * A span is only a phrase when it looks like one. Section 11 quotes whole
 * sentences in backticks (`第一步 / 第二步 / 第三步` 反复出现…), and section 5
 * quotes a bold-label shape (`粗体小标题 + 冒号 + 解释`); those are prose, not
 * matchable phrases, so they are excluded by the line-shape tests.
 */
function extractPatternPhrases(segments: readonly Segment[], patternNumber: number): WatchPhrase[] {
  const phrases: WatchPhrase[] = [];
  const seen = new Set<string>();
  const body = segments.map((entry) => entry.text).join('\n');

  for (const entry of segments) {
    if (entry.role !== 'watch') continue;
    for (const line of entry.text.split(/\r?\n/)) {
      // A watch bullet keeps its `- ` marker in the stored text; the phrase is
      // what follows it.
      const bare = line.trim().replace(/^[-*]\s+/, '');
      for (const span of backticks(bare)) {
        if (looksLikePhrase(span)) pushPhrase(phrases, seen, span);
      }
      // Section 8's tells are bullet prefixes, not backtick spans.
      const prefix = bulletPrefix(bare);
      if (prefix !== undefined) pushPhrase(phrases, seen, prefix);
    }
  }

  if (patternNumber === PUNCTUATION_PATTERN) {
    if (body.includes(DASH_TELL)) pushPhrase(phrases, seen, DASH_TELL);
    if (body.includes(COLON_TELL)) pushPhrase(phrases, seen, COLON_TELL);
    for (const quote of QUOTE_TELLS) {
      // The quote bullets are the only ones in the file carrying both marks.
      if (body.includes(quote)) pushPhrase(phrases, seen, quote);
    }
  }

  return phrases;
}

function pushPhrase(phrases: WatchPhrase[], seen: Set<string>, raw: string): void {
  for (const variant of variantsOf(raw)) {
    const text = cleanPhrase(variant);
    // Deduplicate on the cleaned, lowercased form: section 13 lists `归根结底`
    // and `说到底` separately and then writes `归根结底 / 说到底` again in the
    // guidance, and only one of each belongs in the watched list.
    const key = text.toLowerCase();
    if (text.length === 0 || seen.has(key)) continue;
    seen.add(key);
    const known = SHORT_PUNCTUATION_TELLS.includes(text);
    const kind = known ? 'literal' : classifyPhrase(text);
    phrases.push({
      text,
      kind,
      match: kind === 'literal' ? text.toLowerCase() : text,
    });
  }
}

/**
 * Split a span that lists alternatives into the alternatives.
 *
 * Section 13 writes `归根结底 / 说到底` as one backtick span and pattern 11
 * writes `第一层 / 第二层`. A construction template keeps its slash — `第一步 /
 * 第二步 / 第三步` is one shape, not three phrases — which is what the template
 * test distinguishes.
 */
function variantsOf(raw: string): string[] {
  if (containsTemplateMarker(raw)) return [raw];
  const body = raw.replace(/[（(][^）)]*[）)]/g, '');
  // A slash between two terms is a separator — `归根结底 / 说到底`. A slash
  // inside one term is part of it — `coworkers/agents`, `第一步 / 第二步`, which
  // split into fragments that are too short or not Chinese to stand alone.
  const parts = body
    .split(/[/／]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const splittable =
    parts.length > 1 && parts.every((part) => part.length >= 2 || isChinesePhrase(part));
  return splittable ? parts : [raw];
}

function backticks(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/g)]
    .map((match) => match[1]!.trim())
    .filter((span) => span.length > 0);
}

/** Chinese corner brackets, which this upstream also uses to name a tell. */
function cornerQuotes(text: string): string[] {
  return [...text.matchAll(/「([^」]+)」/g)]
    .map((match) => match[1]!.trim())
    .filter((span) => span.length > 0 && span.length <= 24);
}

/**
 * A watched phrase is a construction, not a sentence: it is short, it fits on
 * one line, and it is not a numbered step such as `第一步 / 第二步 / 第三步` or
 * `第一段抛一个题目`.
 *
 * A span with no word character at all is punctuation the upstream quotes while
 * explaining a convention — `''`, `（` — not a phrase to match.
 */
function looksLikePhrase(span: string): boolean {
  if (/[\r\n]/.test(span)) return false;
  if (span.length > 24) return false;
  const bare = cleanPhrase(span);
  if (!/[\p{Script=Han}A-Za-z0-9]/u.test(bare)) return false;
  if (/^第[一二三四五六七八九十\d]/.test(bare)) return false;
  // A span holding sentence punctuation is a quoted sentence, not a phrase.
  if (/[。！？；]/.test(bare) && bare.length > 12) return false;
  return true;
}

/**
 * Section 8 writes `- 过度谨慎：\`在某种程度上…\`` and has neither a phrase label
 * nor a backtick span around the tell itself, so the leading term is read off
 * the bullet. That term is the upstream's own name for the tell.
 *
 * The bullet must also carry a backtick span. Without that guard, section 9's
 * ordinary bullet `第一段抛一个题目，正文却一直在补背景` would yield `题目` and
 * sections 10 and 11 would yield a bare colon.
 */
function bulletPrefix(bare: string): string | undefined {
  const quotedAt = bare.search(/[`「]/);
  if (quotedAt <= 0) return undefined;
  // The name must come before the quoted tell: `过度谨慎：\`在某种…\`` names the
  // tell, while `这和第 5 条「列表和排比成瘾」不完全一样` only mentions one.
  const match = /^([^：:]{2,12})[：:]/.exec(bare);
  if (!match) return undefined;
  const prefix = match[1]!.trim();
  return isChinesePhrase(prefix) ? prefix : undefined;
}

/** Enough CJK to be a Chinese phrase rather than a label in Latin letters. */
function isChinesePhrase(text: string): boolean {
  let cjk = 0;
  let total = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    total += 1;
    if ((ch.codePointAt(0) ?? 0) >= 0x3000) cjk += 1;
  }
  return total > 0 && cjk / total >= 0.6;
}

/* -------------------------------------------------------------- description */

function proseText(segments: readonly Segment[]): string {
  return segments
    .filter((entry) => entry.role === 'prose')
    .map((entry) => entry.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The instruction, taken from the guidance bullets.
 *
 * Every pattern states its instruction as a bullet list under a label such as
 * `优先做法：` or `处理方法：`. The example bullets (`修改前：` / `修改后：`) and
 * the watched-phrase bullets are deliberately excluded: the former are
 * illustrations and the latter are the tells, not the fix.
 */
/**
 * The instruction, taken from the guidance field.
 *
 * The segmenter has already stripped the bullet markers, so the field's text is
 * the instruction as written. The example fields (`修改前：` / `修改后：`) are
 * excluded: they illustrate the fix rather than state it.
 */
function guidanceText(segments: readonly Segment[]): string {
  const guidance = segments.filter((entry) => entry.role === 'guidance');
  const withContent = guidance.filter((entry) => entry.text.trim().length > 0);
  if (withContent.length > 0) {
    return withContent
      .flatMap((entry) =>
        entry.text
          .split(/\r?\n/)
          .map((line) => stripMarkup(line.replace(/^\s*[-*]\s+/, '')).trim())
          .filter((line) => line.length > 0),
      )
      .join('\n');
  }
  // Pattern 6 labels its instruction `处理原则：` and lists the punctuation as
  // guidance, so its field carries the instruction even without a second label.
  // A bullet that reads as a matchable phrase is the phrase list, not guidance,
  // so it is dropped; pattern 6's sentences are long enough not to qualify.
  return segments
    .filter((entry) => entry.role === 'watch')
    .flatMap((entry) => bulletsOf([entry]))
    .filter((bullet) => !isPhraseOnlyBullet(bullet) && classifyPhrase(bullet) === 'reference')
    .map((bullet) => stripMarkup(bullet).trim())
    .filter((bullet) => bullet.length > 0)
    .join('\n');
}

/**
 * True for a watch bullet that is nothing but a watched phrase in backticks,
 * such as pattern 13's `` `本质上` ``. Those entries are the match list rather
 * than an explanation, and the explanation bullets in the same field read as
 * ordinary Chinese sentences.
 */
function isPhraseOnlyBullet(bullet: string): boolean {
  return /^`[^`]{1,12}`$/.test(bullet.trim());
}

/**
 * The rule's own summary of the tell.
 *
 * Several patterns state no sentence outside their phrase bullets, so a
 * description built from prose alone would collapse to the bare heading. The
 * text is assembled in document order from the prose the upstream wrote plus any
 * bullet that is not itself a watched phrase — pattern 1's
 * `这些句式不是不能用…` and pattern 5's `一段里硬塞三项排比…` are bullets, but they
 * explain the tell rather than list it.
 *
 * When only the phrase list and the fix exist — patterns 2, 3, 4, 6, 7, 11, 13
 * — the heading is the best description available and is used instead.
 */
function descriptionSource(segments: readonly Segment[], phrases: readonly WatchPhrase[]): string {
  const parts: string[] = [];
  for (const entry of segments) {
    if (entry.role === 'watch') {
      parts.push(
        ...bulletsOf([entry])
          .filter((bullet) => !isWatchedPhrase(bullet, phrases))
          .filter((bullet) => !isPhraseOnlyBullet(bullet)),
      );
      // Pattern 1's explanation sits in the same field as its bullet list but
      // carries no marker of its own, so a plain line there is prose too.
      parts.push(
        ...entry.text
          .split(/\r?\n/)
          .map((line) => stripMarkup(line).trim())
          .filter((line) => line.length > 0 && !/^[-*]\s/.test(line)),
      );
      continue;
    }
    if (entry.role !== 'prose') continue;
    const lines = entry.text.split(/\r?\n/);
    const label = plainLabel(lines[0] ?? '');
    const rest = (label === undefined ? lines : lines.slice(1))
      .map((line) => stripMarkup(line.replace(/^\s*[-*]\s+/, '')).trim())
      .filter((line) => line.length > 0)
      .join(' ');
    const text = label === undefined ? rest : `${label}： ${rest}`;
    if (text.length > 0) parts.push(text);  }
  return parts.filter((part) => part.length > 0).join(' ');
}

/** True for a bullet that restates a watched phrase verbatim. */
function isWatchedPhrase(bullet: string, phrases: readonly WatchPhrase[]): boolean {
  const bare = cleanPhrase(bullet.replace(/^[-*]\s+/, ''));
  return phrases.some((phrase) => phrase.text === bare);
}

/**
 * Fold the prose that introduces a phrase list into the list's own segment.
 *
 * Pattern 1 writes the explanation inside the same field as the bullets, but
 * with no label of its own and no blank line before the next `修改前：`:
 *
 *     常见问题：
 *
 *     - `不是……而是……`
 *
 *     这些句式不是不能用，而是 AI 很容易反复套用，导致节奏发硬。
 *
 * The segmenter sees the bullet run end and the sentence start, so it emits the
 * sentence as its own segment. Merging it back keeps the phrase list and its
 * explanation together, which is what the description and the guidance both
 * read from. A prose segment that a label introduced is left alone.
 */
function mergeLeadingProse(segments: readonly Segment[]): Segment[] {
  const out: Segment[] = [];
  for (const entry of segments) {
    const previous = out[out.length - 1];
    if (
      entry.role === 'prose' &&
      previous !== undefined &&
      previous.role === 'watch' &&
      isBareLabel(previous.text)
    ) {
      out[out.length - 1] = {
        ...previous,
        text: `${previous.text}\n${entry.text}`,
      };
      continue;
    }
    out.push(entry);
  }
  return out;
}

/** True when a segment is nothing but a field label, e.g. pattern 8's `两种都常见：`. */
function isBareLabel(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return lines.length === 1 && plainLabel(lines[0] ?? '') !== undefined;
}

/**
 * Watched phrases for a Core Rule.
 *
 * `SKILL.md` uses backticks for two different jobs: naming a tell (「少用
 * 「对于……来说」…」) and quoting a technical term or a filename (`CLAUDE.md`,
 * `YouTube`). Only bullets that instruct against something name tells, so the
 * extraction is fenced to those, and the tell itself may be in backticks or in
 * Chinese corner brackets.
 */
function extractCorePhrases(segments: readonly Segment[]): WatchPhrase[] {
  const phrases: WatchPhrase[] = [];
  const seen = new Set<string>();
  const instructsAgainst = /不|少用|避免|不要|别/;

  for (const line of segments.flatMap((entry) => entry.text.split(/\r?\n/))) {
    // The instruction must come *before* the quoted term. Core Rule 6 says
    // 「正文引号默认用全角双引号 `""`」 and only adds 「两种样式不要混用」 after;
    // reading the later 不要 as if it governed the earlier backticks would put
    // the prescribed style in the watched list.
    const firstQuote = line.search(/[`「]/);
    if (firstQuote === -1) continue;
    if (!instructsAgainst.test(line.slice(0, firstQuote))) continue;
    for (const span of [...backticks(line), ...cornerQuotes(line)]) {
      if (looksLikePhrase(span)) pushPhrase(phrases, seen, span);
    }
  }

  return phrases;
}

/** The leading sentences of the prose, which is what the contract calls `description`. */
function leadingSentences(text: string, count: number): string {
  const normalised = normaliseProse(text);
  if (normalised.length === 0) return '';
  const parts = normalised.match(/[^。！？!?]+[。！？!?]?/g) ?? [normalised];
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .slice(0, count)
    .join('');
}

/** A short verbatim excerpt, cut at a sentence end when one is in reach. */
function excerpt(text: string, limit: number): string {
  const normalised = normaliseProse(text);
  if (normalised.length <= limit) return normalised;
  const window = normalised.slice(0, limit);
  const lastStop = Math.max(
    window.lastIndexOf('。'),
    window.lastIndexOf('；'),
    window.lastIndexOf('！'),
  );
  return lastStop >= Math.floor(limit / 2) ? window.slice(0, lastStop + 1) : `${window}...`;
}

/** What a detector can match on, stated in one line. */
function describeDetection(phrases: readonly WatchPhrase[], weakAlone: boolean): string {
  if (phrases.length === 0) {
    return weakAlone
      ? 'No watched list upstream. Model-judged. Weak alone: needs corroboration.'
      : 'No watched list upstream. Model-judged.';
  }
  const literal = phrases.filter((phrase) => phrase.kind === 'literal').length;
  const templates = phrases.filter((phrase) => phrase.kind === 'template').length;
  const parts = [`${literal} literal watched phrase(s)`];
  if (templates > 0) parts.push(`${templates} construction template(s)`);
  return `Lexical. ${parts.join(', ')}.`;
}

/* ----------------------------------------------------------------- examples */

function bulletsOf(segments: readonly Segment[]): string[] {
  return listLines(segments).map((line) => line.replace(/^[-*]\s+/, '').trim());
}

/** The bullet lines of a set of segments, markers intact. */
function listLines(segments: readonly Segment[]): string[] {
  return segments
    .flatMap((entry) => entry.text.split(/\r?\n/))
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .filter((line) => line.length > 2);
}

/**
 * Pair each `修改前：` with the `修改后：` that follows it.
 *
 * The segmenter already stripped the blockquote markers, so the text is used as
 * read. Consecutive quote lines separated by a `>` blank line stay one passage —
 * section 9's before-example is a five-line blockquote, not five examples.
 */
function pairExamples(segments: readonly Segment[]): RuleExample[] {
  const examples: RuleExample[] = [];
  let pending: string | undefined;

  for (const entry of segments) {
    if (entry.role === 'before') {
      pending = entry.text;
      continue;
    }
    if (entry.role === 'after' && pending !== undefined) {
      if (pending.length > 0) examples.push({ before: pending, after: entry.text });
      pending = undefined;
    }
  }

  return examples;
}

function blockquoteText(text: string): string {
  // The label's own content starts with blank lines and the quote marker; take
  // the first run of quoted lines and ignore the spacing around it.
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let started = false;
  for (const line of lines) {
    if (/^\s*>/.test(line)) {
      started = true;
      out.push(line.replace(/^\s*>\s?/, ''));
      continue;
    }
    if (!started) continue;
    if (line.trim() === '') out.push('');
    else break;
  }
  return out.join('\n').trim();
}

/* ----------------------------------------------------------------- severity */

function severityForPattern(number: number, mapped: boolean): number {
  if (!mapped) return 2;
  if (LOW_SEVERITY_PATTERNS.has(number)) return 3;
  if (HIGH_SEVERITY_PATTERNS.has(number)) return 4;
  return 3;
}

/**
 * Core Rules are the upstream's default path (`SKILL.md` says so under Voice
 * Adoption), so they sit at the same band as the leading patterns. The three
 * that reach the canonical vocabulary score higher than the five that do not,
 * because a mapped rule can actually be deduplicated and acted on.
 */
function severityForCore(number: number, mapped: boolean): number {
  if (!mapped) return 2;
  return number <= 5 ? 4 : 3;
}

/* ------------------------------------------------------------------- misc */

/**
 * The four repo overrides in `SKILL.md` (`## Repo Overrides`) and the four
 * voice-adoption anti-patterns both change how these rules are applied, but
 * they are not rules themselves. They are recorded on every imported rule so
 * the scope change survives into the generated JSON instead of being lost.
 */
function sectionNotes(file: string): string {
  return (
    `Imported from ${file}. Repo Overrides in ${SKILL_FILE} outrank these rules, and ` +
    'the voice-adoption anti-patterns apply only in sessions where a voice profile is active.'
  );
}

/** Strip inline markup so stored text is prose, not Markdown. */
function stripMarkup(text: string): string {
  return text.replace(/\*\*/g, '').replace(/`/g, '');
}

function normaliseProse(text: string): string {
  return stripMarkup(text).replace(/\s+/g, ' ').trim();
}

export const HUMANIZER_ZH_EXTRACTION_SCHEMA = EXTRACTION_SCHEMA_VERSION;
