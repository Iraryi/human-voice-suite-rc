/**
 * Parser for `lynote-ai/humanize-text`.
 *
 * The counterpart of `../blader/parse.ts`, with the same shape: find the rule
 * units in the upstream, map each onto a canonical signature, and fail loudly
 * on anything unmapped. The mechanics differ because the upstream is Python,
 * not a prompt document — the rules have to be read out of source text with
 * regular expressions rather than out of Markdown headings, because the task
 * forbids running the upstream's interpreter.
 *
 * Three files carry the rule data, verified against the pinned commit:
 *
 * - `src/methodologies/postprocess.py` — `AI_VOCAB_REPLACEMENTS`, a 30-entry
 *   word -> replacement-list map (`:7-36`), and `_disrupt_sentence_rhythm`,
 *   which merges consecutive short sentences (`:55-74`).
 * - `src/methodologies/llm_rewriter.py` — three `REWRITE_PROMPTS` (`:15-27`).
 * - `docs/techniques.md` — prose that describes the rules but is *not* the
 *   implementation, and is deliberately not the source of truth here.
 *
 * The reconciliation rule for this adapter: **the code is the source of truth.**
 * `docs/techniques.md:141-150` documents four post-processing techniques and
 * `:136-139` four detection signals. Five of those eight have no implementation
 * at the pinned commit. They are skipped here, not transcribed, and listed in
 * `warnings` as explicit gaps so the generated data records the absence instead
 * of quietly implying coverage.
 *
 * Quirks this parser has to survive, all read off the pinned source:
 *
 * - The map is a plain Python dict literal whose values are lists. One entry per
 *   physical line, and the trailing comma is optional on the last one.
 * - One of the *replacement* values is a hyphenated word and one *key* is
 *   hyphenated (`cutting-edge`), so the key pattern cannot be `\w+`.
 * - `postprocess.py:36` ends the dict with `"underscore": [...],` — the trailing
 *   comma is present, so the regex loop must not depend on its absence.
 * - `postprocess.py:67` builds the merged sentence with `" — "`: an em-dash join.
 *   That is an AI tell and it is recorded, but as a *note*, because the
 *   technique is the merge and the dash is the punctuation it happens to use.
 * - `llm_rewriter.py` imports `src.standard.llm_client` at module scope, so
 *   reading its prompts must not require the import graph to resolve.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  assertKnownSignature,
  signatureSpec,
  unmappedSignature,
} from '../../../rules/canonical/signatures.js';
import { EXTRACTION_SCHEMA_VERSION } from '../../extract/types.js';
import type { ExtractedRule, ExtractionResult, WatchPhrase } from '../../extract/types.js';
import { HUMANIZE_TEXT_SIGNATURES } from './signatures.js';

const UPSTREAM = 'lynote-ai/humanize-text';
const SLUG = 'humanize_text';

const POSTPROCESS = 'src/methodologies/postprocess.py';
const LLM_REWRITER = 'src/methodologies/llm_rewriter.py';
const TECHNIQUES = 'docs/techniques.md';

/**
 * The one entry the upstream writes with an em-dash join instead of a
 * replacement word is *not* in the vocabulary map — the join is in the rhythm
 * merge, at `postprocess.py:67`. Kept as a named constant so the test can point
 * at it and so the note below cannot drift.
 */
const EM_DASH_JOIN_LOCATOR = `${POSTPROCESS}:67`;

/**
 * The exact Python source line at `postprocess.py:67`, kept verbatim so the
 * rule's `quote` is a string a reader can find in the upstream with a search,
 * rather than a paraphrase. The em-dash is literal.
 */
const EM_DASH_JOIN_QUOTE =
  'merged = sentences[i].rstrip(\'.!?\') + " — " + sentences[i + 1][0].lower() + sentences[i + 1][1:]';

/** A parsed `AI_VOCAB_REPLACEMENTS` row. */
interface VocabEntry {
  readonly key: string;
  readonly replacements: readonly string[];
  /** 1-based line of the Python source row. */
  readonly line: number;
}

/**
 * The documented-but-unimplemented techniques. Each is a `locator` plus the
 * claim made there, so the warning is auditable rather than a summary.
 */
const DOCUMENTED_BUT_ABSENT: readonly { readonly locator: string; readonly claim: string }[] = [
  {
    locator: `${TECHNIQUES}:145`,
    claim:
      '11+ Chinese boilerplate phrases with natural alternatives. No such list exists in the ' +
      'repository; `AI_VOCAB_REPLACEMENTS` at postprocess.py:7-36 holds English words only and ' +
      'the string "Chinese" appears in no Python source file.',
  },
  {
    locator: `${TECHNIQUES}:149`,
    claim:
      'Detect and break 3+ sentence uniform-length patterns. `_disrupt_sentence_rhythm` only ' +
      'merges (postprocess.py:60-72): it never splits a sentence, and the only length test is ' +
      '`< short_threshold` on two neighbours.',
  },
  {
    locator: `${TECHNIQUES}:150`,
    claim:
      'Insert transitional variety (short interjection, question, aside). Nothing in the ' +
      'post-processor inserts text other than the em-dash join; the adjacent prompt wording ' +
      '(llm_rewriter.py:21) delegates it to a model and cannot be checked.',
  },
  {
    locator: `${TECHNIQUES}:173-174`,
    claim:
      'Segment selection by vocabulary diversity and by structural difference from the original. ' +
      '`_score_naturalness` (mixed_engine.py:28-35) scores a back-translation on unique-token ' +
      'ratio and word-length variance, both computed on the candidate alone, so the original is ' +
      'never consulted and no structural comparison exists.',
  },
  {
    locator: `${TECHNIQUES}:138`,
    claim:
      'n-gram diversity as a statistical feature. `StatisticalDetector.score` ' +
      '(detectors/statistical.py:8-39) computes TTR, sentence-length CV and hapax ratio; there ' +
      'is no n-gram of any order in the file.',
  },
  {
    locator: `${TECHNIQUES}:139`,
    claim:
      "Yule's K measure. The string 'yule' does not occur anywhere in the repository, and the " +
      'detector returns a three-term mean, not four.',
  },
  {
    locator: `${TECHNIQUES}:181`,
    claim:
      'DeepL as a mixed-engine member. `_get_translator` (mixed_engine.py:18-23) accepts only ' +
      '"google" and "mymemory" and raises ValueError otherwise.',
  },
  {
    locator: `${TECHNIQUES}:182`,
    claim:
      'Apertium as a mixed-engine member. Same guard; the engine name appears in the ' +
      'repository only inside docs/techniques.md.',
  },
];

export async function parseHumanizeText(repoPath: string): Promise<ExtractionResult> {
  const postprocess = await readFile(path.join(repoPath, POSTPROCESS), 'utf8');
  const llmRewriter = await readFile(path.join(repoPath, LLM_REWRITER), 'utf8');

  const warnings: string[] = [];
  const disclosures: string[] = [];
  const rules: ExtractedRule[] = [];

  const vocab = parseVocabMap(postprocess);
  if (vocab.length === 0) {
    warnings.push(
      `${POSTPROCESS}: no entries parsed out of AI_VOCAB_REPLACEMENTS. The upstream may have ` +
        'restructured the map; check the mapping before trusting this run.',
    );
  }

  rules.push(...vocabRules(vocab));
  rules.push(rhythmMergeRule(postprocess, vocab));
  rules.push(...promptRules(llmRewriter));

  // Every rule must land on a real signature. A missing slug is a bug in this
  // adapter, not something to paper over at the call site.
  const mappedCount = countMappedSlugs();
  const ruleIds = new Set(rules.map((rule) => rule.upstreamRuleId));
  if (ruleIds.size !== mappedCount) {
    warnings.push(
      `Extracted ${ruleIds.size} distinct rules but the signature map covers ${mappedCount}. ` +
        'Add the missing mapping, or the new rule will deduplicate against nothing.',
    );
  }

  for (const gap of DOCUMENTED_BUT_ABSENT) {
    disclosures.push(`Documented but not implemented, so deliberately not a rule: ${gap.claim} (${gap.locator})`);
  }

  // The integration expectation, stated once and not as a rule. The upstream's
  // default path is a four-stage remote chain: LLM (EN->ZH) -> LLM (ZH->JA) ->
  // Google Translate (JA->FI) -> Niutrans (FI->target), needing a language-model
  // key, a Niutrans key and the undocumented `deep_translator` Google endpoint.
  // It is recorded here as a methodology note so a reader of the generated data
  // knows the path exists and knows it was excluded on purpose, and it is
  // deliberately absent from `HUMANIZE_TEXT_SIGNATURES`, from `rules` and from
  // every watchPhrase. A strategy that needs three network services and has no
  // retry or rate limiting is not a tell and must not become a default.
  disclosures.push(
    'Methodology note, deliberately not a rule: the default execution path is a four-stage remote ' +
      'translation chain (src/standard/pipeline.py:5-8 and :82-98): LLM rewrite EN->ZH, LLM ' +
      'rewrite ZH->JA, Google Translate JA->FI, Niutrans FI->target. It needs an LLM key, a ' +
      'Niutrans key and an undocumented Google endpoint, so it is excluded from the extracted ' +
      'rules and must not become a default strategy. The offline statistical detector in ' +
      'statistical.ts is the only always-available asset.',
  );

  return {
    upstream: UPSTREAM,
    sourceCommit: '',
    extractedAt: new Date().toISOString(),
    sources: [POSTPROCESS, LLM_REWRITER, TECHNIQUES],
    rules,
    warnings,
    disclosures,
  };
}

/**
 * Read `AI_VOCAB_REPLACEMENTS` out of the Python source as text.
 *
 * Deliberately not a Python parser. The map is four-space-indented one row per
 * entry, key then list, so a line-oriented read is both sufficient and
 * auditable. Anything outside the opening and closing braces is ignored, which
 * is what keeps the surrounding class out of the result.
 */
function parseVocabMap(source: string): VocabEntry[] {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => /^AI_VOCAB_REPLACEMENTS\s*=\s*\{\s*$/.test(line));
  if (start === -1) return [];

  const entries: VocabEntry[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (/^\}\s*$/.test(line)) break;

    // `"utilize": ["use", "apply", "work with"],`
    const match = /^\s*["']([^"']+)["']\s*:\s*\[([^\]]*)\]\s*,?\s*$/.exec(line);
    if (!match) continue;

    const key = match[1] ?? '';
    const body = match[2] ?? '';
    const replacements = [...body.matchAll(/["']([^"']*)["']/g)].map((m) => m[1] ?? '');
    if (key.length === 0 || replacements.length === 0) continue;

    entries.push({ key, replacements, line: index + 1 });
  }

  return entries;
}

/**
 * The vocabulary map as one rule.
 *
 * One rule, not 30: the upstream applies all 30 through a single loop
 * (`postprocess.py:48-52`), and the canonical signature for the tell is one id.
 * Thirty rules would also charge thirty times at dedupe time for one problem.
 */
function vocabRules(entries: readonly VocabEntry[]): ExtractedRule[] {
  if (entries.length === 0) return [];

  const first = entries[0]!;
  const last = entries[entries.length - 1]!;
  const locator = `${POSTPROCESS}:${first.line}-${last.line}`;

  // Each source word is a literal watched phrase; the upstream's replacement
  // list goes in the note, because it is what the rewrite should do, not what
  // the detector matches.
  const watchPhrases: WatchPhrase[] = entries.map((entry) => ({
    text: entry.key,
    kind: 'literal',
    match: entry.key.toLowerCase(),
    note: entry.replacements.join(' | '),
  }));

  const shortWords = entries.filter((entry) => entry.key.length < 4).map((entry) => entry.key);
  const hyphenated = entries.filter((entry) => entry.key.includes('-')).map((entry) => entry.key);

  return [
    mappedRule({
      upstreamRuleId: 'vocab-replacement',
      title: 'AI-ish vocabulary swapped for a plainer word',
      category: 'lexical',
      languages: ['en'],
      description:
        'Thirty words the upstream treats as AI register, each replaced by one of three plainer ' +
        'alternatives picked at random. Substitution, not deletion: the sentence survives, only ' +
        'the register changes.',
      detection:
        `Lexical. ${watchPhrases.length} literal watched word(s), matched case-insensitively via ` +
        're.escape(word) with IGNORECASE, at most one replacement per word per pass ' +
        `(${POSTPROCESS}:49-52).`,
      rewriteGuidance:
        'Replace the word with a plainer one from its list. The upstream chooses at random among ' +
        'the alternatives; a caller should pick by context instead, because "utilize" is not ' +
        'always "use". Only the first occurrence of each word is replaced, so a repeated tell ' +
        'survives one pass.',
      severity: 2,
      watchPhrases,
      examples: [],
      weakAlone: true,
      locator,
      quote: `${first.key}: ${first.replacements.join(', ')}`,
      notes: [
        `Derived id vocab-replacement from the constant AI_VOCAB_REPLACEMENTS (${POSTPROCESS}:6) ` +
          'and the method that applies it, _replace_ai_vocabulary ' +
          `(${POSTPROCESS}:47).`,
        `${entries.length} entries extracted; the documentation claims "30+ English signal words" ` +
          `(${TECHNIQUES}:144), which matches the code.`,
        'Replacement lists are notes on the watched phrases, not detection data: the detector ' +
          'matches the source word, and the alternative is what the rewrite should produce.',
        `${shortWords.length} key(s) are shorter than the 4-character floor the shared phrase ` +
          `classifier uses for Latin text (extract/phrase.ts:115), so those names are labelled ` +
          `literal here rather than reference, because a lexical detector must watch them, and ` +
          `with word boundaries they match safely: ${shortWords.join(', ')}.`,
        `${hyphenated.length} key(s) are hyphenated and need a word-boundary regex that treats ` +
          `"-" as a letter, not a terminator: ${hyphenated.join(', ')}.`,
        'The upstream does not strip punctuation before matching, so "utilize," is replaced and ' +
          '"utilization" is not; the substitution is a word, not a stem.',
        `RECORDED TELL, NOT A RULE OF ITS OWN: the map itself is built with an em-dash join at ` +
          `${EM_DASH_JOIN_LOCATOR} (the merged sentence separator), and the em-dash is a ` +
          'catalogued tell. It belongs to rhythm-merge-short-sentences and is noted there; a ' +
          'separate rule would double-charge one piece of punctuation.',
      ],
    }),
    mappedRule({
      upstreamRuleId: 'vocab-formal-to-everyday',
      title: 'Formal or academic vocabulary replaced with everyday words',
      category: 'lexical',
      languages: ['en'],
      description:
        'The same instruction as the vocabulary map, stated again as an LLM prompt: replace ' +
        'formal or academic vocabulary with everyday equivalents.',
      detection:
        'Model-judged. The upstream states the target register but never lists the words, so no ' +
        'watched phrase is derivable from this source and none is invented here.',
      rewriteGuidance:
        'Replace any formal or academic vocabulary with everyday equivalents, and add colloquial ' +
        'expressions where they fit. The wording is the upstream prompt, kept verbatim so a ' +
        'caller can reuse it; the model decides which words qualify.',
      severity: 3,
      watchPhrases: [],
      examples: [],
      weakAlone: true,
      locator: `${LLM_REWRITER}:20-22`,
      quote:
        'replace any formal or academic vocabulary with everyday equivalents',
      notes: [
        'Derived id vocab-formal-to-everyday from the leading instruction of ' +
          'REWRITE_PROMPTS[1] (llm_rewriter.py:20).',
        'Separate rule from vocab-replacement because it is a separate upstream artefact with a ' +
          'separate locator, but the same canonical signature, so cross-upstream dedupe still ' +
          'collapses the lineage to one problem.',
        'Carries no watchPhrases: the upstream names a register, not words. The English word ' +
          'list lives in the other rule, which is why that one has 30 and this one has none.',
      ],
    }),
  ];
}

/**
 * `_disrupt_sentence_rhythm` as a rule.
 *
 * The upstream names the method "disrupt" but the body only ever merges, so the
 * rule is written from the body: two consecutive sentences under the word
 * threshold become one, joined by an em-dash, with the second sentence's first
 * letter lowercased.
 */
function rhythmMergeRule(source: string, vocab: readonly VocabEntry[]): ExtractedRule {
  const threshold = readShortThreshold(source);
  const line = lineOf(source, /def _disrupt_sentence_rhythm/);
  const mergeLine = lineOf(source, /merged = sentences\[i\]/);
  const bodyEnd = lastLineOf(source, /return " "\.join\(result\)/);

  return mappedRule({
    upstreamRuleId: 'rhythm-merge-short-sentences',
    title: 'Consecutive short sentences merged into one',
    category: 'rhythm',
    languages: ['en'],
    description:
      `Two consecutive sentences that are both shorter than ${threshold} words are merged into ` +
      'one, with the separator replacing the full stop and the second sentence lowercased. The ' +
      'effect is fewer, longer sentences and a more even length profile.',
    detection:
      `Deterministic. Split on /(?<=[.!?])\\s+/ and merge when both sentences are strictly under ` +
      `${threshold} words (config key postprocess.short_sentence_threshold, ` +
      `${POSTPROCESS}:45). No-op below three sentences (${POSTPROCESS}:57).`,
    rewriteGuidance:
      `Merging two short sentences is only right when they belong together. The upstream does it ` +
      `positionally: any two consecutive sentences under ${threshold} words get joined, ` +
      'regardless of whether they share a subject.',
    severity: 3,
    watchPhrases: [],
    examples: [],
    weakAlone: false,
    locator: `${POSTPROCESS}:${line}-${bodyEnd}`,
    quote: EM_DASH_JOIN_QUOTE,
    notes: [
      'Derived id rhythm-merge-short-sentences from the method name _disrupt_sentence_rhythm ' +
        `(${POSTPROCESS}:55) plus the one thing the body does: merge two short sentences.`,
      `Threshold read from the default at ${POSTPROCESS}:45 ` +
        '(postprocess.short_sentence_threshold = 8); the upstream calls it a "short sentence" ' +
        'threshold in a config key, not a constant.',
      `EM-DASH TELL (${EM_DASH_JOIN_LOCATOR}): the merge inserts " — " as the ` +
        'separator, so the rule\'s own output uses a dash as the universal connector. That is ' +
        'itself an AI tell and the canonical vocabulary already has a signature for it ' +
        '(rhythm.dash_overuse). Recorded as a note and located precisely rather than extracted ' +
        'as a second rule, because the same line would otherwise deduct twice for one edit. The ' +
        'link is deliberately not asserted as `=> rhythm.dash_overuse` on the rule, so the ' +
        'extraction stays free of any relationship the type system does not model.',
      `Off-by-one worth knowing: ${POSTPROCESS}:67 indexes sentences[i + 1][0] without a length ` +
        'check, so a second sentence that is pure whitespace-stripped to one character would ' +
        'produce an empty tail. Recorded as an upstream defect, not imported as behaviour.',
      'The technique is rhythm.uniform_rhythm, not a punctuation rule: the tell being treated ' +
        'is uniform sentence length, and the dash is incidental to how this implementation ' +
        'attacks it.',
      `The word count used is str.split() on whitespace, so a Chinese sentence counts as one ` +
        `"word" and the merge fires on almost any two Chinese sentences; see the ` +
        `${POSTPROCESS}:56 segmentation note in the statistical port.`,
      ...(vocab.length === 0
        ? ['The vocabulary map could not be parsed in this run, so the em-dash note may be stale.']
        : []),
    ],
  });
}

/**
 * The two prompt instructions that name a technique the code also contains.
 *
 * `REWRITE_PROMPTS[2]` ("ensure smooth transitions", "Check that no three
 * consecutive sentences have similar length") is folded into
 * `rhythm-alternate-lengths` rather than extracted separately: both prompts
 * instruct the same correction, and the second adds no machine-checkable
 * condition the first lacks.
 */
function promptRules(source: string): ExtractedRule[] {
  const promptLines = [...source.matchAll(/^\s{8}"([^"]*)"/gm)].map((match) => ({
    text: match[1] ?? '',
    line: lineNumberOf(source, match.index ?? 0),
  }));

  const varied = promptLines.find((entry) => entry.text.startsWith('Rewrite the following text'));
  const final = promptLines.find((entry) => entry.text.startsWith('Final polish'));

  if (!varied || !final) return [];

  const rules: ExtractedRule[] = [
    mappedRule({
      upstreamRuleId: 'rhythm-alternate-lengths',
      title: 'Sentence lengths alternated by instruction',
      category: 'rhythm',
      languages: ['en'],
      description:
        'The upstream asks a model to alternate between very short sentences of 3-8 words and ' +
        'long complex ones of 25-40 words, which is a direct instruction to raise burstiness.',
      detection:
        'Model-judged. The prompt states word-count bands but ships no checker, so nothing can ' +
        'be verified offline; the bands are recorded as the upstream states them.',
      rewriteGuidance:
        'Rewrite the text with dramatically varied sentence lengths, alternating between very ' +
        'short sentences (3-8 words) and longer complex ones (25-40 words); use natural, ' +
        'conversational vocabulary and preserve all factual content.',
      severity: 3,
      watchPhrases: [],
      examples: [],
      weakAlone: false,
      locator: `${LLM_REWRITER}:${varied.line}`,
      quote: truncate(varied.text, 240),
      notes: [
        'Derived id rhythm-alternate-lengths from the leading instruction of REWRITE_PROMPTS[0] ' +
          `(${LLM_REWRITER}:16), "Rewrite the following text with dramatically varied sentence ` +
          'lengths".',
        `REWRITE_PROMPTS[2] (${LLM_REWRITER}:${final.line}) repeats the same correction as ` +
          '"ensure smooth transitions" and "no three consecutive sentences have similar length"; ' +
          'folded in here so one technique is one rule. That sentence is quoted in the ' +
          'documentation too (' + TECHNIQUES + ':149) as a post-processing rule, but the ' +
          'post-processor never checks length beyond the two-neighbour merge, so it exists only ' +
          'as prompt text.',
        'Both this rule and rhythm-merge-short-sentences map to rhythm.uniform_rhythm on ' +
          'purpose: they are two implementations of one tell, and the dedupe key is the tell.',
        'No word band is machine-checked anywhere in the repository, so the 3-8 and 25-40 bands ' +
          'are quoted from the prompt rather than encoded as detection.',
      ],
    }),
  ];

  return rules;
}

/** One rule assembled from a signature slug, with the map consulted once. */
function mappedRule(input: {
  upstreamRuleId: string;
  title: string;
  category: string;
  languages: readonly string[];
  description: string;
  detection: string;
  rewriteGuidance: string;
  severity: number;
  watchPhrases: readonly WatchPhrase[];
  examples: readonly { before: string; after: string; note?: string }[];
  weakAlone: boolean;
  locator: string;
  quote: string;
  notes: readonly string[];
}): ExtractedRule {
  const mapped = HUMANIZE_TEXT_SIGNATURES[input.upstreamRuleId];
  let signature: string;
  let signatureMapped = false;

  if (mapped) {
    assertKnownSignature(mapped, `${UPSTREAM} rule ${input.upstreamRuleId}`);
    signature = mapped;
    signatureMapped = true;
  } else {
    signature = unmappedSignature(SLUG, input.upstreamRuleId);
  }

  const spec = signatureMapped ? signatureSpec(signature) : undefined;

  return {
    upstreamRuleId: input.upstreamRuleId,
    signature,
    signatureMapped,
    title: input.title,
    category: spec?.category ?? input.category,
    languages: spec?.languages ?? input.languages,
    description: input.description,
    detection: input.detection,
    rewriteGuidance: input.rewriteGuidance,
    severity: input.severity,
    watchPhrases: input.watchPhrases,
    examples: input.examples,
    weakAlone: input.weakAlone,
    locator: input.locator,
    quote: input.quote,
    notes: input.notes,
  };
}

function countMappedSlugs(): number {
  return Object.keys(HUMANIZE_TEXT_SIGNATURES).length;
}

/** `short_sentence_threshold` default, read from the config lookup. */
function readShortThreshold(source: string): number {
  const match = /get\(\s*["']short_sentence_threshold["']\s*,\s*(\d+)\s*\)/.exec(source);
  return match ? Number(match[1]) : 8;
}

function lineOf(source: string, pattern: RegExp): number {
  const lines = source.split(/\r?\n/);
  const index = lines.findIndex((line) => pattern.test(line));
  return index === -1 ? 1 : index + 1;
}

function lastLineOf(source: string, pattern: RegExp): number {
  const lines = source.split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (pattern.test(lines[index] ?? '')) return index + 1;
  }
  return lines.length;
}

function lineNumberOf(source: string, offset: number): number {
  let line = 1;
  for (let index = 0; index < offset && index < source.length; index += 1) {
    if (source[index] === '\n') line += 1;
  }
  return line;
}

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 3)}...`;
}

export const HUMANIZE_TEXT_EXTRACTION_SCHEMA = EXTRACTION_SCHEMA_VERSION;
