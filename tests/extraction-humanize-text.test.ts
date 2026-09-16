/**
 * Extraction tests for the `lynote-ai/humanize-text` adapter.
 *
 * Two halves, and they fail for different reasons on purpose:
 *
 * - The **statistical port** is tested against values computed by hand from the
 *   Python source, with no clone needed. Those assertions are unconditional,
 *   because the port is the one asset this upstream contributes to the suite and
 *   a regression in it must break CI on a fresh checkout.
 * - The **extraction** is tested against the pinned clone and is skipped when
 *   `.upstream-cache/humanize-text` is absent, matching `tests/upstream.test.ts`.
 *
 * The hand-computed inputs are shown with their arithmetic in comments. Every
 * expected number here was derived from `statistical.py:9-39`, not from running
 * this TypeScript — a test that asserts whatever the port happens to print
 * proves nothing.
 */

import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseHumanizeText } from '../src/upstream/adapters/humanize-text/parse.js';
import { HUMANIZE_TEXT_SIGNATURES } from '../src/upstream/adapters/humanize-text/signatures.js';
import {
  STATISTICAL_ANCHORS,
  splitSentences,
  statisticalFeatures,
  statisticalScore,
} from '../src/upstream/adapters/humanize-text/statistical.js';
import { CANONICAL_SIGNATURES } from '../src/rules/canonical/signatures.js';
import { extractionProblems } from '../src/upstream/extract/types.js';

const CLONE_PATH = path.join(
  process.cwd(),
  '.upstream-cache',
  'humanize-text',
);
const clonePresent = existsSync(CLONE_PATH);

/**
 * The exact size of `AI_VOCAB_REPLACEMENTS` at the pinned commit: keys on
 * `postprocess.py:7-36`, one per line, 30 rows.
 */
const AI_VOCAB_ENTRY_COUNT = 30;

/** The rule slugs the signature map covers, and the count the parser expects. */
const EXPECTED_RULES = [
  'vocab-replacement',
  'vocab-formal-to-everyday',
  'rhythm-merge-short-sentences',
  'rhythm-alternate-lengths',
] as const;

const CANONICAL_IDS = new Set(CANONICAL_SIGNATURES.map((spec) => spec.id));

/**
 * A second parser for the Python dict, written independently of the adapter's,
 * so the entry-count assertion is a genuine check rather than the adapter
 * agreeing with itself.
 */
function readVocabMapFromSource(source: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  let inside = false;
  for (const line of source.split(/\r?\n/)) {
    if (/^AI_VOCAB_REPLACEMENTS\s*=\s*\{\s*$/.test(line)) {
      inside = true;
      continue;
    }
    if (!inside) continue;
    if (/^\}\s*$/.test(line)) break;
    const match = /^\s{4}["']([^"']+)["']:\s*\[([^\]]+)\],?\s*$/.exec(line);
    if (!match) continue;
    const key = match[1]!;
    const values = [...match[2]!.matchAll(/["']([^"']*)["']/g)].map((m) => m[1]!);
    out.set(key, values);
  }
  return out;
}

/** `src/methodologies/postprocess.py` as text, or null when the clone is absent. */
function upstreamFile(relative: string): string | null {
  if (!clonePresent) return null;
  try {
    return readFileSync(path.join(CLONE_PATH, relative), 'utf8');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Statistical port. Always runs; does not need the clone.
// ---------------------------------------------------------------------------

describe('statistical port: hand-computed against the Python source', () => {
  it('splits sentences exactly as re.split(r\' (?<=[.!?])\\s+\') does', () => {
    expect(splitSentences('One two. Three four! Five six?')).toEqual([
      'One two.',
      'Three four!',
      'Five six?',
    ]);
    // A terminator with no following whitespace does not split, which is the
    // behaviour that makes the detector English-only. Note that a space after
    // the period *does* split: the upstream has no abbreviation guard, so "Dr.
    // Smith arrived." becomes two "sentences".
    expect(splitSentences('Alpha.Bravo.')).toEqual(['Alpha.Bravo.']);
    expect(splitSentences('Dr. Smith arrived.')).toEqual(['Dr.', 'Smith arrived.']);
    // CJK terminators are not in the class and are not followed by ASCII
    // whitespace, so a Chinese paragraph stays one "sentence".
    expect(splitSentences('中文句子一。中文句子二。')).toEqual(['中文句子一。中文句子二。']);
    expect(splitSentences('   ')).toEqual([]);
  });

  it('reproduces the upstream for input A: high vocab, no variation', () => {
    const text = 'The cat sat. The cat ran. The cat slept.';
    // sentences = 3; words = 9 (whitespace split, punctuation kept)
    // lower = the,cat,sat.,the,cat,ran.,the,cat,slept.
    // ttr   = 5 distinct / 9      = 0.5555555555555556
    // lengths = [3,3,3]; mean = 3; variance = 0; cv = 0
    // counts: the=3 cat=3 sat.=1 ran.=1 slept.=1 -> 5 types, 3 hapax -> 0.6
    // ttr_score   = clamp((0.7 - 0.5555555555555556) / 0.3) = 0.4814814814814814
    // cv_score    = clamp((0.5 - 0) / 0.3)                  = 1
    // hapax_score = clamp((0.6 - 0.6) / 0.3)                = 0
    // mean = 1.4814814814814814 / 3 = 0.49382716049382713
    expect(statisticalFeatures(text)).toEqual({
      ttr: 0.5555555555555556,
      cv: 0,
      hapaxRatio: 0.6,
      sentences: 3,
      words: 9,
      types: 5,
    });
    expect(statisticalScore(text)).toBeCloseTo(0.49382716049382713, 12);
  });

  it('reproduces the upstream for input B: every word appears once', () => {
    const text = 'Alpha beta gamma. Delta epsilon zeta.';
    // words = 6, all distinct -> ttr = 1, types = 6, hapax = 6/6 = 1
    // lengths = [3,3]; mean = 3; variance = 0; cv = 0
    // ttr_score   = clamp((0.7 - 1) / 0.3) = 0
    // cv_score    = clamp((0.5 - 0) / 0.3) = 1
    // hapax_score = clamp((0.6 - 1) / 0.3) = 0
    // mean = 1/3 = 0.3333333333333333
    expect(statisticalFeatures(text)).toEqual({
      ttr: 1,
      cv: 0,
      hapaxRatio: 1,
      sentences: 2,
      words: 6,
      types: 6,
    });
    expect(statisticalScore(text)).toBeCloseTo(1 / 3, 12);
  });

  it('reproduces the upstream for input C: repeated word, uneven sentences', () => {
    const text = 'Hello world. Hello there again.';
    // words = 5: hello,world.,hello,there,again.
    // ttr = 4/5 = 0.8
    // lengths = [2,3]; mean = 2.5; variance = 0.25; stddev = 0.5; cv = 0.2
    // counts: hello=2, others=1 -> types=4, hapax=3 -> 0.75
    // ttr_score   = (0.7 - 0.8) / 0.3 = -0.3333.. -> clamped to 0
    // cv_score    = (0.5 - 0.2) / 0.3 = 1
    // hapax_score = (0.6 - 0.75) / 0.3 = -0.5 -> clamped to 0
    // mean = 1/3 = 0.3333333333333333
    expect(statisticalFeatures(text)).toEqual({
      ttr: 0.8,
      cv: 0.2,
      hapaxRatio: 0.75,
      sentences: 2,
      words: 5,
      types: 4,
    });
    expect(statisticalScore(text)).toBeCloseTo(1 / 3, 12);
  });

  it('reproduces the upstream for input D: low vocab, uneven sentences', () => {
    const text = 'Go now. Go go go now now now.';
    // sentences = 2; words = 8, and the split keeps punctuation:
    //   Go | now. | Go | go | go | now | now | now.
    // lower = go,now.,go,go,go,now,now,now.
    //   counts: go=4, now.=2, now=2  -> 3 types, 0 hapax
    //   ttr = 3/8 = 0.375
    // lengths = [2,6]; mean = 4; variance = 4; stddev = 2; cv = 0.5
    // ttr_score   = clamp((0.7 - 0.375) / 0.3) = 1
    // cv_score    = clamp((0.5 - 0.5) / 0.3)   = 0
    // hapax_score = clamp((0.6 - 0) / 0.3)     = 1
    // mean = 2/3 = 0.6666666666666666
    //
    // This pair is the punctuation-leak case: because the split keeps the full
    // stop, "now." is not merged with "now", and *no* type is a hapax. Strip the
    // punctuation and the hapax count would be 1, moving the score by 0.22.
    expect(statisticalFeatures(text)).toEqual({
      ttr: 0.375,
      cv: 0.5,
      hapaxRatio: 0,
      sentences: 2,
      words: 8,
      types: 3,
    });
    expect(statisticalScore(text)).toBeCloseTo(2 / 3, 12);
  });

  it('reproduces the upstream for input E: every type hapax under low CV', () => {
    const text = 'Alpha beta. Gamma delta.';
    // words = 4, all distinct -> ttr = 1, types = 4, hapax = 4/4 = 1
    // lengths = [2,2]; mean = 2; variance = 0; cv = 0
    // ttr_score   = clamp((0.7 - 1) / 0.3)   = 0
    // cv_score    = clamp((0.5 - 0) / 0.3)   = 1
    // hapax_score = clamp((0.6 - 1) / 0.3)   = 0
    // mean = 1/3 = 0.3333333333333333
    //
    // This pair is the useful one for a caller recalibrating: ttr and hapax
    // both saturate at the low end while cv saturates at the high end, so the
    // score is 1/3 no matter how the anchors move. The raw sub-features say why.
    expect(statisticalScore(text)).toBeCloseTo(1 / 3, 12);
  });

  it('returns 0.5 for fewer than two sentences', () => {
    // statistical.py:10-11
    expect(statisticalScore('Only one sentence here.')).toBe(0.5);
    expect(statisticalScore('No terminator at all')).toBe(0.5);
    expect(statisticalScore('')).toBe(0.5);
    // The Chinese limitation, made explicit: two Chinese sentences with no space
    // after 。are one sentence, so the detector reports the neutral 0.5.
    expect(statisticalScore('这是第一句。这是第二句。')).toBe(0.5);
    expect(splitSentences('这是第一句。这是第二句。')).toHaveLength(1);
    // And the feature extraction refuses rather than inventing a sub-feature.
    expect(statisticalFeatures('Only one sentence here.')).toBeNull();
  });

  it('returns 0.5 when there are words but not two sentences of them', () => {
    // statistical.py:13-15. Whitespace-only text has no words at all; the
    // sentence guard fires first, so both guards are exercised here.
    expect(statisticalScore('A.')).toBe(0.5);
    expect(statisticalScore('word word.')).toBe(0.5);
    expect(statisticalFeatures('word word.')).toBeNull();
  });

  it('keeps the upstream anchors discoverable for recalibration', () => {
    // The anchors are unanchored magic numbers upstream; exporting them is what
    // lets a caller recalibrate rather than patch the port.
    expect(STATISTICAL_ANCHORS).toEqual({
      ttr: 0.7,
      cv: 0.5,
      hapax: 0.6,
      width: 0.3,
      neutral: 0.5,
    });
  });

  it('clamps each term into 0..1, matching max(0, min(1, ...))', () => {
    // All three terms would be negative: every word distinct (ttr 1), no
    // variation (cv 0 -> positive 1), hapax 1. ttr and hapax clamp to 0, cv to 1.
    const extreme = 'A b c. D e f. G h i.';
    const features = statisticalFeatures(extreme)!;
    expect(features.ttr).toBe(1);
    expect(features.cv).toBe(0);
    expect(features.hapaxRatio).toBe(1);
    expect(statisticalScore(extreme)).toBeCloseTo(1 / 3, 12);
  });
});

// ---------------------------------------------------------------------------
// The Python source as text. Skipped without the clone.
// ---------------------------------------------------------------------------

describe.skipIf(!clonePresent)('AI_VOCAB_REPLACEMENTS as read from the clone', () => {
  it(`holds exactly ${AI_VOCAB_ENTRY_COUNT} entries at postprocess.py:7-36`, () => {
    const source = upstreamFile('src/methodologies/postprocess.py');
    expect(source).not.toBeNull();
    const entries = readVocabMapFromSource(source!);
    expect(entries.size).toBe(AI_VOCAB_ENTRY_COUNT);
    expect([...entries.keys()]).toHaveLength(AI_VOCAB_ENTRY_COUNT);
  });

  it('has three alternatives for every entry and no duplicates', () => {
    const entries = readVocabMapFromSource(upstreamFile('src/methodologies/postprocess.py')!);
    for (const [key, values] of entries) {
      expect(values.length, key).toBe(3);
      expect(new Set(values).size, key).toBe(3);
    }
    expect(new Set(entries.keys()).size).toBe(AI_VOCAB_ENTRY_COUNT);
  });

  it('contains no Chinese, which is the documented-but-absent phrase list', () => {
    const entries = readVocabMapFromSource(upstreamFile('src/methodologies/postprocess.py')!);
    for (const key of entries.keys()) {
      expect(key, 'keys are English-only at the pinned commit').toMatch(/^[a-z-]+$/);
    }
    // docs/techniques.md:145 claims "11+ Chinese boilerplate phrases with natural
    // alternatives". No such list exists.
    expect([...entries.keys()].some((key) => /[\u4e00-\u9fff]/.test(key))).toBe(false);
  });

  it('uses an em-dash join, at postprocess.py:67 — an AI tell in the fixer', () => {
    const source = upstreamFile('src/methodologies/postprocess.py')!;
    const lines = source.split(/\r?\n/);
    expect(lines[66]).toContain('" — "');
    // And not in the vocabulary map, where a replacement string could hide it.
    for (const values of readVocabMapFromSource(source).values()) {
      expect(values.some((value) => value.includes('—'))).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Extraction against the pinned clone.
// ---------------------------------------------------------------------------

describe.skipIf(!clonePresent)('parseHumanizeText against the pinned clone', () => {
  it('extracts exactly four rules, all mapped, with no mapping defects', async () => {
    const result = await parseHumanizeText(CLONE_PATH);

    expect(result.upstream).toBe('lynote-ai/humanize-text');
    expect(result.rules).toHaveLength(EXPECTED_RULES.length);
    expect(result.rules.map((rule) => rule.upstreamRuleId).sort()).toEqual(
      [...EXPECTED_RULES].sort(),
    );

    for (const rule of result.rules) {
      expect(rule.signatureMapped, `${rule.upstreamRuleId} must be mapped`).toBe(true);
      expect(CANONICAL_IDS.has(rule.signature), `${rule.signature} must exist`).toBe(true);
      // No fallback signature may survive, since every slug is in the map.
      expect(rule.signature.startsWith('upstream.'), rule.signature).toBe(false);
    }

    // No unmapped-signature fallback anywhere. `extractionProblems` is the
    // suite's own definition of "a build should stop for this".
    expect(extractionProblems(result)).toEqual([]);

    // The parser found nothing to complain about. Deliberate decisions live in
    // `disclosures`, which is a separate field precisely so that recording a
    // technique the upstream documented but never implemented does not fail the
    // extraction run.
    expect(result.warnings).toEqual([]);

    // Every disclosure names something this adapter chose not to turn into a
    // rule. A defect warning ("no entries parsed", "signature map covers N") is
    // written without that phrase, so it would fail here.
    for (const disclosure of result.disclosures ?? []) {
      expect(disclosure, disclosure).toContain('not a rule');
    }

    // Every slug in the map is used, and no rule is missing a mapping.
    expect(Object.keys(HUMANIZE_TEXT_SIGNATURES).sort()).toEqual([...EXPECTED_RULES].sort());
  });

  it('watches all 30 source words as literal phrases with the replacement in the note', async () => {
    const result = await parseHumanizeText(CLONE_PATH);
    const rule = result.rules.find((r) => r.upstreamRuleId === 'vocab-replacement')!;

    expect(rule.watchPhrases).toHaveLength(AI_VOCAB_ENTRY_COUNT);
    expect(rule.watchPhrases.every((phrase) => phrase.kind === 'literal')).toBe(true);
    expect(rule.watchPhrases.every((phrase) => phrase.match === phrase.text.toLowerCase())).toBe(
      true,
    );
    expect(rule.watchPhrases.every((phrase) => (phrase.note ?? '').length > 0)).toBe(true);

    const byText = new Map(rule.watchPhrases.map((phrase) => [phrase.text, phrase]));
    expect(byText.get('utilize')?.note).toBe('use | apply | work with');
    expect(byText.get('facilitate')?.note).toBe('help | support | enable');
    expect(byText.get('underscore')?.note).toBe('highlight | stress | emphasize');
    expect(byText.get('cutting-edge')?.note).toBe('latest | advanced | modern');
    // Sub-4-character keys are still literals: a lexical detector must watch them.
    expect(byText.get('delve')?.kind).toBe('literal');
    expect(byText.get('realm')?.kind).toBe('literal');

    // The map was read from the source, not transcribed: same keys, same order.
    const fromSource = readVocabMapFromSource(upstreamFile('src/methodologies/postprocess.py')!);
    expect(rule.watchPhrases.map((phrase) => phrase.text)).toEqual([...fromSource.keys()]);
  });

  it('records the em-dash tell as a note, not as a second rule', async () => {
    const result = await parseHumanizeText(CLONE_PATH);
    const rhythm = result.rules.find((r) => r.upstreamRuleId === 'rhythm-merge-short-sentences')!;

    expect(rhythm.signature).toBe('rhythm.uniform_rhythm');
    expect(rhythm.quote).toContain('" — "');
    expect(rhythm.notes?.join(' ')).toContain('EM-DASH TELL');
    expect(rhythm.notes?.join(' ')).toContain('postprocess.py:67');
    // Exactly one rule mentions the dash, so one edit cannot be charged twice.
    expect(
      result.rules.filter((rule) => rule.notes?.join(' ').includes('EM-DASH TELL')),
    ).toHaveLength(1);
    // And it is not resurrected as its own signature anywhere.
    expect(result.rules.some((rule) => rule.signature === 'rhythm.dash_overuse')).toBe(false);
  });

  it('gives every rule a locator that resolves to a real line', async () => {
    const result = await parseHumanizeText(CLONE_PATH);

    for (const rule of result.rules) {
      const match = /^(.+?):(\d+)(?:-(\d+))?$/.exec(rule.locator);
      expect(match, rule.locator).not.toBeNull();
      const file = match![1]!;
      const first = Number(match![2]);
      const last = match![3] === undefined ? first : Number(match![3]);

      const source = upstreamFile(file);
      expect(source, `${file} must exist`).not.toBeNull();
      const lineCount = source!.split(/\r?\n/).length;
      expect(first, `${rule.locator} start`).toBeGreaterThanOrEqual(1);
      expect(last, `${rule.locator} end`).toBeLessThanOrEqual(lineCount);
      expect(last).toBeGreaterThanOrEqual(first);

      expect(rule.title.length).toBeGreaterThan(0);
      expect(rule.description.length).toBeGreaterThan(40);
      expect(rule.detection?.length ?? 0).toBeGreaterThan(20);
      expect(rule.rewriteGuidance.length).toBeGreaterThan(20);
      expect(rule.quote?.length ?? 0).toBeGreaterThan(0);
      expect(rule.severity).toBeGreaterThanOrEqual(1);
      expect(rule.severity).toBeLessThanOrEqual(5);
      expect(rule.languages.length).toBeGreaterThan(0);
      expect(rule.notes?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('keeps the remote translation chain out of the rules entirely', async () => {
    const result = await parseHumanizeText(CLONE_PATH);

    // No rule id, title, guidance or phrase may represent the chain.
    const haystack = result.rules
      .map((rule) =>
        [
          rule.upstreamRuleId,
          rule.title,
          rule.description,
          rule.detection ?? '',
          rule.rewriteGuidance,
          ...rule.watchPhrases.map((phrase) => phrase.text),
        ].join(' '),
      )
      .join('\n')
      .toLowerCase();
    for (const forbidden of ['translation', 'niutrans', 'deepl', 'apertium', 'google']) {
      expect(haystack, `rules must not mention ${forbidden}`).not.toContain(forbidden);
    }

    // It is recorded instead, as exactly one methodology note among the nine
    // deliberate disclosures (8 documented-but-absent techniques + the chain).
    const all = result.disclosures ?? [];
    expect(all).toHaveLength(9);
    const chainNotes = all.filter((note) => note.startsWith('Methodology note'));
    expect(chainNotes).toHaveLength(1);
    expect(chainNotes[0]).toContain('translation chain');
    expect(chainNotes[0]).toContain('src/standard/pipeline.py');

    // The eight documented-but-absent techniques are each named with a locator.
    const gaps = all.filter((note) => note.includes('Documented but not implemented'));
    expect(gaps).toHaveLength(8);
    for (const gap of gaps) {
      expect(gap).toMatch(/\(docs\/techniques\.md:\d+(?:-\d+)?\)$/);
    }
    expect(gaps.join(' ')).toContain('Chinese boilerplate');
    expect(gaps.join(' ')).toContain('Yule');
    expect(gaps.join(' ')).toContain('n-gram');
    expect(gaps.join(' ')).toContain('DeepL');
    expect(gaps.join(' ')).toContain('Apertium');
    expect(gaps.join(' ')).toContain('transitional variety');
    expect(gaps.join(' ')).toContain('uniform-length patterns');
    expect(gaps.join(' ')).toContain('structural difference');

    // The sources list the three files the extraction read, before the skip.
    expect(result.sources).toEqual([
      'src/methodologies/postprocess.py',
      'src/methodologies/llm_rewriter.py',
      'docs/techniques.md',
    ]);
  });

  it('is deterministic across runs apart from the timestamp', async () => {
    const first = await parseHumanizeText(CLONE_PATH);
    const second = await parseHumanizeText(CLONE_PATH);
    expect({ ...first, extractedAt: '' }).toEqual({ ...second, extractedAt: '' });
  });
});
