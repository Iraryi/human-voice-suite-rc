/**
 * Parser for `lynote-ai/dsh-humanizer`.
 *
 * This upstream is TypeScript rather than Markdown, so the rules are read out
 * of `src/core/rules.ts` as **text**. The module is never imported: it sits
 * outside this project's `rootDir`, and importing it would execute a third
 * party's code and make the extraction depend on the clone at run time. The
 * adapter only needs the literals, and the literals are recoverable from the
 * source text.
 *
 * Shape of a rule, verified against the pinned commit
 * (`src/core/rules.ts:37-311`):
 *
 *     {
 *       id: 'empty-opener-en',
 *       category: 'empty-opener',
 *       severity: 3,
 *       note: 'Leads with a scene-setting formula instead of the actual point.',
 *       patterns: [
 *         "in today's",
 *         "in the modern world",
 *       ],
 *     }
 *
 * Quirks this parser has to survive, all verified:
 *
 * - The four fields are written in a fixed order, but with no semicolons, so a
 *   match that assumes `;` before `category` silently extracts nothing. That bug
 *   was hit and fixed here; the guards below are what stop it recurring.
 * - Patterns mix quote styles: `empty-opener-en` uses double quotes because its
 *   first entry contains an apostrophe, every other rule uses single quotes.
 * - `patterns` is a source string array, not a compiled array. What the upstream
 *   calls a "watched phrase" may be a plain string (`unleash`) or a regular
 *   expression (`在这个.{0,12}的时代`, `^此外，`). Both are extracted, and the
 *   kind is decided by whether the string is distinguishable from a regex.
 * - Seven patterns carry a backslash escape in the source
 *   (`navigat(?:e|ing) the ...`), which is why the array scanner tracks escapes.
 * - The upstream count in the inventory report (`upstreams/reports/dsh-humanizer.md:104`,
 *   "Total pattern strings: 175") does not match the file. The report's own
 *   per-rule counts sum to 184, and an independent scan of the committed
 *   compiled `lib/core/rules.js` also yields 184. This parser therefore expects
 *   184 and records the discrepancy rather than deleting nine patterns to fit a
 *   wrong total.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { assertKnownSignature, signatureSpec, unmappedSignature } from '../../../rules/canonical/signatures.js';
import type { ExtractedRule, ExtractionResult, WatchPhrase } from '../../extract/types.js';
import { DSH_HUMANIZER_SIGNATURES } from './signatures.js';

const UPSTREAM = 'lynote-ai/dsh-humanizer';
const SLUG = 'dsh_humanizer';
const RULES_FILE = 'src/core/rules.ts';

/** Enough characters to be worth matching. Mirrors `extract/phrase.ts`. */
const MIN_LATIN_LENGTH = 4;
const MIN_CJK_LENGTH = 2;

/** Marks the phrase note that records a `^` anchor. */
const ANCHOR_TAG = 'anchored ^';

interface ExpectedRule {
  readonly id: string;
  readonly category: string;
  readonly severity: number;
  /**
   * Pattern count as documented per rule in
   * `upstreams/reports/dsh-humanizer.md:126-138` and confirmed by scanning the
   * source and the committed compiled `lib/core/rules.js`.
   */
  readonly patterns: number;
}

/**
 * The upstream's 13 rules in file order, with the counts this parser asserts.
 *
 * Held here rather than derived so that a silent drop is a failure instead of a
 * smaller number. This is the same device `extract/targets.ts` uses for the
 * other upstreams, and the thing `docs/provenance-policy.md:105` asks for.
 */
const EXPECTED_RULES: readonly ExpectedRule[] = [
  { id: 'empty-opener-en', category: 'empty-opener', severity: 3, patterns: 23 },
  { id: 'empty-opener-zh', category: 'empty-opener', severity: 3, patterns: 12 },
  { id: 'cliche-en', category: 'cliche', severity: 2, patterns: 36 },
  { id: 'cliche-zh', category: 'cliche', severity: 2, patterns: 28 },
  { id: 'hedge-en', category: 'hedge', severity: 1, patterns: 16 },
  { id: 'hedge-zh', category: 'hedge', severity: 1, patterns: 9 },
  { id: 'transition-en', category: 'transition', severity: 2, patterns: 16 },
  { id: 'transition-zh', category: 'transition', severity: 2, patterns: 11 },
  { id: 'summary-ending-en', category: 'summary-ending', severity: 3, patterns: 7 },
  { id: 'summary-ending-zh', category: 'summary-ending', severity: 3, patterns: 11 },
  { id: 'mechanical-parallel-zh', category: 'mechanical-parallel', severity: 3, patterns: 4 },
  { id: 'over-explain-en', category: 'over-explain', severity: 2, patterns: 6 },
  { id: 'over-explain-zh', category: 'over-explain', severity: 2, patterns: 5 },
];

const EXPECTED_PATTERN_TOTAL = EXPECTED_RULES.reduce((n, rule) => n + rule.patterns, 0);

/** The anchored-pattern count `docs/provenance-policy.md:114` states. */
const EXPECTED_ANCHORED = 37;

/** Rules whose anchors the upstream's missing `m` flag makes unreachable. */
const ANCHOR_AFFECTED = new Set([
  'transition-en',
  'transition-zh',
  'summary-ending-en',
  'summary-ending-zh',
]);

/**
 * Phrases this upstream shares with another of its own rules. Verified in
 * `upstreams/reports/dsh-humanizer.md:164-171`: the unanchored copies fire
 * anywhere, the `^`-anchored copies only at position 0.
 */
const VERBATIM_COLLISIONS: Readonly<Record<string, string>> = {
  'hedge-zh': '值得注意的是',
  'over-explain-zh': '换句话说，',
};

export async function parseDshHumanizer(repoPath: string): Promise<ExtractionResult> {
  const raw = await readFile(path.join(repoPath, RULES_FILE), 'utf8');
  const warnings: string[] = [];
  const rules: ExtractedRule[] = [];

  const located = locateRules(raw);
  if (located.length !== EXPECTED_RULES.length) {
    warnings.push(
      `Expected ${EXPECTED_RULES.length} rules in ${RULES_FILE}, found ${located.length}. ` +
        'The upstream may have restructured; check the signature map before trusting this run.',
    );
  }

  const lineOf = lineIndex(raw);
  let anchored = 0;

  located.forEach((block, index) => {
    const expected = EXPECTED_RULES[index];
    if (!expected) {
      warnings.push(
        `${RULES_FILE}: unexpected extra rule ${JSON.stringify(block.id)}; ` +
          'add it to the signature map or the rule will deduplicate against nothing.',
      );
      return;
    }
    if (block.id !== expected.id) {
      warnings.push(
        `Rule ${index + 1} is ${JSON.stringify(block.id)} but was expected to be ` +
          `${JSON.stringify(expected.id)}. The order or the rule set changed.`,
      );
    }
    if (block.category !== expected.category) {
      warnings.push(
        `${block.id}: category changed from ${expected.category} to ${block.category}.`,
      );
    }
    if (block.severity !== expected.severity) {
      warnings.push(
        `${block.id}: upstream severity changed from ${expected.severity} to ${block.severity}; ` +
          'review the severity mapping before trusting it.',
      );
    }
    if (block.patternSources.length !== expected.patterns) {
      warnings.push(
        `${block.id}: ${block.patternSources.length} pattern strings, expected ${expected.patterns}. ` +
          'The watched list changed; re-check the count in the extraction report.',
      );
    }

    const rule = buildRule(block, lineOf, warnings);
    anchored += rule.watchPhrases.filter((phrase) => isAnchored(phrase)).length;
    rules.push(rule);
  });

  if (anchored !== EXPECTED_ANCHORED) {
    warnings.push(
      `Counted ${anchored} ^{}-anchored patterns; docs/provenance-policy.md:114 states ` +
        `${EXPECTED_ANCHORED}. The anchor defect note needs revisiting.`,
    );
  }

  const patternTotal = rules.reduce((n, rule) => n + rule.watchPhrases.length, 0);
  if (patternTotal !== EXPECTED_PATTERN_TOTAL) {
    warnings.push(
      `Extracted ${patternTotal} watched phrases; the per-rule counts in ` +
        `upstreams/reports/dsh-humanizer.md:126-138 sum to ${EXPECTED_PATTERN_TOTAL}.`,
    );
  }

  const covered = Object.keys(DSH_HUMANIZER_SIGNATURES).length;
  if (covered !== EXPECTED_RULES.length) {
    warnings.push(
      `The signature map covers ${covered} rules but ${EXPECTED_RULES.length} were expected. ` +
        'A new upstream rule would deduplicate against nothing.',
    );
  }

  return {
    upstream: UPSTREAM,
    sourceCommit: '',
    extractedAt: new Date().toISOString(),
    sources: [RULES_FILE],
    rules,
    warnings,
  };
}

interface RuleBlock {
  readonly id: string;
  readonly category: string;
  readonly severity: number;
  readonly note: string;
  readonly patternSources: readonly string[];
  /** Line of the `id:` field, used as the locator. */
  readonly line: number;
}

/**
 * The rule-object scan.
 *
 * A backreference is used for the note's closing quote so that one pattern
 * covers both quote styles. The group that holds the quote is group 4 — an
 * earlier revision wrote `\1` and matched the severity digit instead, which
 * silently extracted nothing. The `id`/`category` ordering check in the caller
 * is what makes that kind of mistake visible.
 */
function rulePattern(): RegExp {
  return new RegExp(
    String.raw`id:\s*'([^']+)',?\s*` +
      String.raw`category:\s*'([^']+)',?\s*` +
      String.raw`severity:\s*([123]),?\s*` +
      String.raw`note:\s*(['"])([^'"]*)\4,?\s*` +
      String.raw`patterns:\s*\[`,
    'g',
  );
}

function locateRules(raw: string): RuleBlock[] {
  const matcher = rulePattern();
  const starts = [0];
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] === '\n') starts.push(i + 1);
  }

  const blocks: RuleBlock[] = [];
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(raw)) !== null) {
    const open = match.index + match[0].length - 1;
    blocks.push({
      id: match[1]!,
      category: match[2]!,
      severity: Number(match[3]),
      note: unescapeLiteral(match[5]!),
      patternSources: scanStringArray(raw, open).map((entry) => unescapeLiteral(entry)),
      line: lineAt(starts, match.index),
    });
  }
  return blocks;
}

/**
 * Read a quoted-string array starting at its `[`.
 *
 * Character level rather than a regex, because the array contains full-width
 * punctuation, apostrophes inside double-quoted strings, and backslash escapes,
 * and a regex over that mixture is where a miscount would hide.
 */
function scanStringArray(raw: string, openIndex: number): string[] {
  const items: string[] = [];
  let i = openIndex + 1;
  while (i < raw.length) {
    const ch = raw[i]!;
    if (ch === ']') return items;
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      const start = i + 1;
      i += 1;
      while (i < raw.length && raw[i] !== quote) {
        if (raw[i] === '\\') i += 1;
        i += 1;
      }
      items.push(raw.slice(start, i));
      i += 1;
      continue;
    }
    i += 1;
  }
  return items;
}

function buildRule(block: RuleBlock, lineOf: (index: number) => number, warnings: string[]): ExtractedRule {
  const mapped = DSH_HUMANIZER_SIGNATURES[block.id];
  let signature: string;
  let signatureMapped = false;
  if (mapped) {
    assertKnownSignature(mapped, `${UPSTREAM} rule ${block.id}`);
    signature = mapped;
    signatureMapped = true;
  } else {
    signature = unmappedSignature(SLUG, block.id);
    warnings.push(
      `${UPSTREAM} rule ${block.id} has no signature mapping. ` +
        'It will not deduplicate against the rest of the corpus.',
    );
  }

  const spec = signatureMapped ? signatureSpec(signature) : undefined;
  const watchPhrases = block.patternSources.map((source) => toWatchPhrase(source));
  const anchored = watchPhrases.filter((phrase) => isAnchored(phrase)).length;
  const weakAlone = block.severity === 1;

  return {
    upstreamRuleId: block.id,
    signature,
    signatureMapped,
    title: titleFrom(block.note, block.id),
    category: spec?.category ?? block.category,
    // The rule's own id suffix, not the signature's language list. The
    // signature says which languages a tell can occur in; this says which
    // language this upstream actually watches, and the upstream writes that
    // into the id (`mechanical-parallel-zh` is the only parallelism rule and it
    // watches Chinese only).
    languages: languagesFrom(block.id),
    description: block.note,
    detection: describeDetection(watchPhrases, anchored),
    rewriteGuidance: rewriteGuidanceFor(block),
    severity: severityFor(block.severity),
    watchPhrases,
    examples: [],
    weakAlone,
    locator: `${RULES_FILE}:${block.line}`,
    quote: block.note,
    notes: notesFor(block, anchored, weakAlone),
  };
}

/**
 * Classify one pattern source the way `extract/phrase.ts` classifies a watch
 * list entry, with one addition the Markdown upstreams do not need: a source
 * that carries regex syntax is a construction, not a phrase.
 *
 * The test has to look for syntax rather than compare `new RegExp(s).source`
 * with `s`: an anchor, a quantifier and a character class all survive that
 * comparison unchanged, so `^此外，` and `一方面.{0,20}另一方面` would both have
 * been filed as literal phrases a detector would then try to match as strings.
 *
 * The scan walks the source and tracks escapes, so it never confuses a literal
 * `\.` with a quantifier or a literal `[` with a class.
 */
function isConstruction(source: string): boolean {
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i]!;
    if (ch === '\\') {
      i += 1;
      continue;
    }
    if ('^$*+?'.includes(ch)) return true;
    if (ch === '.' && source[i + 1] === '*') return true;
    if (ch === '|') return true;
    if (ch === '[') return true;
    if (ch === '(') return true;
    if (ch === '{' && /\{\d+(?:,\d*)?\}/.test(source.slice(i))) return true;
  }
  return false;
}

/** One watched phrase: literal, or a construction with a readable label. */
function toWatchPhrase(source: string): WatchPhrase {
  const anchored = source.startsWith('^');
  const template = isConstruction(source);
  const parts: string[] = [];
  if (anchored) {
    parts.push(`${ANCHOR_TAG} (upstream compiles without the m flag, so this matches only at absolute position 0)`);
  }

  if (!template) {
    const kind = shortKind(source) === 'reference' ? 'reference' : 'literal';
    return {
      text: source,
      kind,
      match: kind === 'literal' ? source.toLowerCase() : source,
      ...(parts.length > 0 ? { note: parts.join('; ') } : {}),
    };
  }

  const label = readableTemplate(source);
  parts.push(`upstream regex source: ${source}`);
  return {
    text: label,
    kind: 'template',
    match: label,
    // The label is lossy on purpose; the source is kept so nothing is lost.
    note: parts.join('; '),
  };
}

function isAnchored(phrase: WatchPhrase): boolean {
  return phrase.note?.includes(ANCHOR_TAG) ?? false;
}

/** Length and generic-word rules from `extract/phrase.ts:136-144`. */
function shortKind(text: string): 'literal' | 'reference' {
  const bare = text.trim();
  const minimum = isMostlyCjk(bare) ? MIN_CJK_LENGTH : MIN_LATIN_LENGTH;
  if ([...bare].length < minimum) return 'reference';
  if (/^(the|and|or|but|so|very|really|just|also|key|deep)$/i.test(bare)) return 'reference';
  return 'literal';
}

function isMostlyCjk(text: string): boolean {
  let cjk = 0;
  let total = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    total += 1;
    if (ch.codePointAt(0)! >= 0x3000) cjk += 1;
  }
  return total > 0 && cjk / total >= 0.5;
}

/**
 * Turn a regex source into something a reader can see.
 *
 * `在这个.{0,12}的时代` reads as `在这个…的时代`; `^此外，` loses its anchor
 * because the anchor is not text. The exact source travels in the phrase note,
 * so the readable form is a convenience, not the record.
 */
function readableTemplate(source: string): string {
  return source
    .replace(/^\^/, '')
    .replace(/\.\{\d+(?:,\d*)?\}/g, '\u2026')
    .replace(/\.\*/g, '\u2026')
    .replace(/\.\+/g, '\u2026')
    .replace(/\(\?:\s*([^()|]+?)\s*\|[^()]*\)/g, '$1')
    .replace(/\(\?:/g, '')
    .replace(/\)/g, '')
    .replace(/\(\?/g, '');
}

/**
 * Severity.
 *
 * The upstream states its own scale in the file header (`src/core/rules.ts:7`):
 * "severity (1 = mild tell, 3 = strong tell)". That is a different scale from
 * this suite's 1..5, but it is not a coarse one, and the upstream's three bands
 * line up with this suite's lower three: a hedge is the sort of thing that
 * dilutes rather than proves anything, a cliché or a transition is a genuine
 * category error, and an empty opener or a summary ending is a tell an editor
 * acts on at one sighting.
 *
 * The mapping is therefore the identity, documented rather than silent:
 *
 *   upstream 3 -> 3   `empty-opener`, `summary-ending`, `mechanical-parallel`
 *   upstream 2 -> 2   `cliche`, `transition`, `over-explain`
 *   upstream 1 -> 1   `hedge`, flagged weak alone
 *
 * Nothing is raised into 4 or 5. The upstream's 3 is "strong tell", not "proof":
 * its patterns are substring matches, and several of them (`it is worth`,
 * `somewhat`, `potentially`, `robust`, `leverage`) occur legitimately in human
 * prose. Promoting those on intuition would inflate every downstream score
 * without evidence from a real run. 4 and 5 stay reserved for tells that cannot
 * plausibly be deliberate, which is also why the two hedge rules are the only
 * `weakAlone: true` entries here.
 */
function severityFor(upstreamSeverity: number): number {
  return upstreamSeverity;
}

function describeDetection(phrases: readonly WatchPhrase[], anchored: number): string {
  const literal = phrases.filter((phrase) => phrase.kind === 'literal').length;
  const templates = phrases.filter((phrase) => phrase.kind === 'template').length;
  const parts = [`${literal} literal watched phrase(s)`];
  if (templates > 0) parts.push(`${templates} construction/(regex) source(s)`);
  let detection = `Lexical. ${parts.join(', ')}.`;
  if (anchored > 0) {
    detection +=
      ` ${anchored} pattern(s) anchored ^ (upstream compiles without the m flag,` +
      ' so the anchor matches only at absolute position 0 of the input).';
  }
  if (anchored === phrases.length && phrases.length > 0) {
    detection += ' Every pattern in this rule is anchored, so the rule fires only on a single-paragraph input.';
  }
  return detection;
}

function notesFor(block: RuleBlock, anchored: number, weakAlone: boolean): string[] {
  const notes: string[] = [
    `Upstream severity ${block.severity} of 3, upstream category "${block.category}" ` +
      `(src/core/rules.ts:7 for the scale; ${RULES_FILE}:${block.line} for the rule).`,
    'rewriteGuidance was derived from the upstream note plus the rule meaning; ' +
      'the upstream gives no separate guidance field.',
  ];

  if (anchored > 0) {
    notes.push(
      `${anchored} of ${block.patternSources.length} patterns are ^-anchored. The upstream compiles ` +
        'every pattern with flags "gi" and no "m" (src/core/rules.ts:319), so those patterns match ' +
        'only at absolute position 0: on any multi-paragraph text they are unreachable. ' +
        'docs/provenance-policy.md:114 records the defect; the anchors are reproduced here as ' +
        'data, not as a working detection.',
    );
  }
  if (weakAlone) {
    notes.push(
      'Marked weak alone here: a single hedge dilutes the statement but does not prove it was ' +
        'generated. The upstream checks for one occurrence, not for stacked qualifiers, so the ' +
        'canonical signature is broader than what this rule actually measures.',
    );
  }

  const collision = VERBATIM_COLLISIONS[block.id];
  if (collision) {
    notes.push(
      `The phrase ${JSON.stringify(collision)} is also claimed by another rule of this upstream ` +
        '(see upstreams/reports/dsh-humanizer.md:164-171). The copies here are unanchored, so they ' +
        'fire anywhere and double-count text that opens with the phrase.',
    );
  }

  if (block.id === 'empty-opener-zh') {
    notes.push(
      'Two of this list are not scene-setting at all: 众所周知 and 显而易见 carry no time or place, ' +
        'and 众所周知， repeats 众所周知 in the same list as a near-duplicate. The filler half is ' +
        'recorded here rather than treated as a separate rule, because the upstream files both ' +
        'halves under one id and an adapter does not get to re-cut upstream rules.',
    );
  }

  if (block.id === 'over-explain-en' || block.id === 'over-explain-zh') {
    notes.push(
      'This adapter flagged that no canonical signature meant "restates what was just said" and ' +
        'mapped here to lexical.filler_phrase as the closest fit. That gap was filled: the rule now ' +
        'points at lexical.restatement, which is narrower than filler and distinguishes a ' +
        'restatement from text that carries no content at all.',
    );
  }

  if (block.id === 'summary-ending-zh') {
    notes.push(
      'The slogan half of this rule (希望通过, 让我们携手, ^让我们) leans towards ' +
        'structural.universal_positive_ending. The restatement half dominates the pattern list, ' +
        'so the rule keeps the single conclusion signature and the second tell is recorded here.',
    );
  }

  if (block.id === 'transition-zh') {
    notes.push(
      'Mapped to lexical.translationese_connective rather than lexical.wordy_connectives: the ' +
        'tell is the translated-connective register (^此外，, ^与此同时，), and the English half of ' +
        'the same upstream category is the one that reads as wordy English.',
    );
  }

  return notes;
}

/**
 * A short human-readable name, derived from the note.
 *
 * The upstream has no title field. Most notes are one English sentence; the
 * bilingual ones are `English sentence. 中文補充。`, and the sentence split would
 * throw the Chinese half away, so the split happens at the first CJK character
 * rather than at the first full stop. Both halves are the upstream's own words.
 */
function titleFrom(note: string, id: string): string {
  const trimmed = note.replace(/[\u3002\uff0e.]$/, '').trim();
  if (trimmed.length === 0) return id;

  const split = /^([^\u3000-\u9fff]*?)\s*([\u3000-\u9fff][\s\S]*)$/.exec(trimmed);
  if (split && split[1]!.trim().length > 0) {
    const english = split[1]!.trim().replace(/[.,;:]$/, '');
    const chinese = split[2]!.replace(/[\u3002\uff0e.]$/, '').trim();
    const combined = `${english} / ${chinese}`;
    if (combined.length <= 90) return combined;
  }

  const englishOnly =
    split && split[1]!.trim().length > 0
      ? split[1]!.trim().replace(/[.,;:]$/, '')
      : trimmed.split(/(?<=\.)\s+/)[0]!.replace(/\.$/, '').trim();
  if (englishOnly.length > 0 && englishOnly.length <= 90) return englishOnly;
  return id;
}

/**
 * Guidance the upstream implies but does not spell out.
 *
 * Every sentence here traces to the rule's own note: the note names the fault,
 * and the guidance names the edit that removes it. No policy is added that the
 * upstream did not state.
 */
function rewriteGuidanceFor(block: RuleBlock): string {
  const base = block.note;
  const guidance: Record<string, string> = {
    'empty-opener-en':
      'Delete the opener and start at the claim it was clearing its throat for. A date or a ' +
      'setting belongs in the sentence only when it carries information.',
    'empty-opener-zh':
      '删掉时代背景开场，直接从结论或事实写起。时间与地点只在本身携带信息时保留。',
    'cliche-en':
      'Replace the word with the plainer, more specific one. This is substitution rather than ' +
      'deletion: the sentence still has to say something.',
    'cliche-zh':
      '把黑话换成具体的动作与对象。这类词是替换而非删除：句子仍须表达实际内容。',
    'hedge-en':
      'Assert the claim, or state the real uncertainty. A hedge that adds no information is ' +
      'removed; a scope or legal qualifier stays.',
    'hedge-zh':
      '直接陈述，或写出真实的保留条件。不携带信息的修饰语应删除，范围与法律限定语保留。',
    'transition-en':
      'Drop the connective and let the paragraph break carry the turn. Keep it only when the ' +
      'logical relation would otherwise be unclear.',
    'transition-zh':
      '删掉形式化的段首连接词，让段落本身完成转折。仅当逻辑关系确实不清时才保留。',
    'summary-ending-en':
      'Cut the closing paragraph, or replace it with the one specific thing it was circling. The ' +
      'piece should end on information, not on a restatement.',
    'summary-ending-zh':
      '删掉总结式结尾，或改写成它试图掩盖的那个具体结论。文章应以信息收束，而不是以复述收束。',
    'mechanical-parallel-zh':
      '打破整齐的排比：合并并列项、发展其中最强的一项，或改变句式长短。意思确实有三部分时才保留三项。',
    'over-explain-en':
      'Delete the second telling. If the idea was unclear the first time, fix the first sentence ' +
      'instead of explaining it again.',
    'over-explain-zh':
      '删掉第二次解释。若第一次没说清，应修改第一句，而不是重复说明。',
  };
  const extra = guidance[block.id];
  return extra ? `${base} ${extra}` : base;
}

/** Language from the upstream's own id suffix, for a rule outside the map. */
function languagesFrom(id: string): string[] {
  if (id.endsWith('-zh')) return ['zh'];
  if (id.endsWith('-en')) return ['en'];
  return ['unknown'];
}

function unescapeLiteral(body: string): string {
  return body.replace(/\\(['"`\\])/g, '$1');
}

/** Binary search over newline offsets; same line numbering the report uses. */
function lineIndex(raw: string): (index: number) => number {
  const starts = [0];
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] === '\n') starts.push(i + 1);
  }
  return (index: number) => lineAt(starts, index);
}

function lineAt(starts: readonly number[], index: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  let answer = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid]! <= index) {
      answer = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return answer + 1;
}

/** The rule ids in file order. Exported so a test can assert against the same list. */
export const DSH_HUMANIZER_EXPECTED_RULES: readonly string[] = EXPECTED_RULES.map((rule) => rule.id);

/** 184, the count this parser expects. The report's "175" is unreconcilable. */
export const DSH_HUMANIZER_EXPECTED_PATTERN_COUNT = EXPECTED_PATTERN_TOTAL;
