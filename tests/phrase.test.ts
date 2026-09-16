/**
 * Watch-phrase segmentation.
 *
 * The heuristic here is load-bearing and its two failure modes are worse than
 * they look. Split too eagerly and `not just` becomes a matchable phrase that
 * fires on ordinary English; split too reluctantly and the chatbot-residue list
 * collapses into one template, losing the most certain tell in the corpus.
 */

import { describe, expect, it } from 'vitest';

import {
  classifyPhrase,
  cleanPhrase,
  containsTemplateMarker,
  matchablePhrases,
  parseWatchList,
  segmentWatchList,
  splitNote,
  splitOutsideParens,
} from '../src/upstream/extract/phrase.js';

describe('splitOutsideParens', () => {
  it('keeps a separator inside parentheses', () => {
    const parts = splitOutsideParens('gate/gated/gating (figurative; keep technical uses), insight', [
      ',',
      ';',
    ]);
    expect(parts).toEqual(['gate/gated/gating (figurative; keep technical uses)', 'insight']);
  });

  it('handles full-width parentheses and brackets', () => {
    expect(splitOutsideParens('a\uff08b;c\uff09, d', [';'])).toEqual(['a\uff08b;c\uff09, d']);
  });
});

describe('segmentWatchList', () => {
  it('keeps a construction that is split by commas together', () => {
    // blader pattern 1. Splitting this on commas yields `not just` and
    // `not only`, both of which would match ordinary English prose.
    const entries = segmentWatchList(
      'not X but Y; not just, not only, or not merely X, but Y; it\'s not X, it\'s Y',
    );
    expect(entries).toEqual([
      'not X but Y',
      'not just, not only, or not merely X, but Y',
      "it's not X, it's Y",
    ]);
    expect(entries).not.toContain('not just');
  });

  it('splits a plain list that contains construction markers of its own', () => {
    // blader pattern 22. The whole list contains `...`, so a group-level
    // template check would swallow all ten phrases.
    const entries = segmentWatchList(
      'I hope this helps, Of course!, Certainly!, Great question!, Would you like..., Want me to...?, let me know, here is a...',
    );
    expect(entries).toContain('I hope this helps');
    expect(entries).toContain('Great question!');
    expect(entries).toContain('let me know');
    expect(entries.length).toBe(8);
  });

  it('splits a comma-separated vocabulary list', () => {
    const entries = segmentWatchList('Actually, additionally, align with, bolstered, crucial, delve');
    expect(entries).toEqual(['Actually', 'additionally', 'align with', 'bolstered', 'crucial', 'delve']);
  });

  it('splits a Chinese list on enumeration and full-width commas', () => {
    const entries = segmentWatchList('\u7a7a\u6cdb\u62d4\u9ad8\u3001\u610f\u4e49\u6df1\u8fdc\uff0c\u5177\u6709\u91cc\u7a0b\u7891\u610f\u4e49\u3002');
    expect(entries).toEqual([
      '\u7a7a\u6cdb\u62d4\u9ad8',
      '\u610f\u4e49\u6df1\u8fdc',
      '\u5177\u6709\u91cc\u7a0b\u7891\u610f\u4e49',
    ]);
  });

  it('keeps a construction whole only when every later fragment continues it', () => {
    // The discriminating case. `not X but Y` here is a NEW entry, not a
    // continuation of `crucial`, and gluing them loses two watched phrases.
    const entries = segmentWatchList('delve, crucial, not X but Y');
    expect(entries).toEqual(['delve', 'crucial', 'not X but Y']);
  });

  it('splits a list whose fragments merely start with a continuation word', () => {
    // `not publicly available` is its own entry, and the group carries no
    // construction marker, so the whole-group rule does not apply.
    const entries = segmentWatchList('based on available information, not publicly available');
    expect(entries).toEqual(['based on available information', 'not publicly available']);
  });

  it('strips trailing list punctuation', () => {
    expect(segmentWatchList('foo;; bar,')).toEqual(['foo', 'bar']);
  });
});

describe('classifyPhrase', () => {
  it('calls a construction a template', () => {
    expect(classifyPhrase('not X but Y')).toBe('template');
    expect(classifyPhrase('\u4e0d\u662f\u2026\u2026\u800c\u662f\u2026\u2026')).toBe('template');
    expect(classifyPhrase('as of [date]')).toBe('template');
  });

  it('calls a matchable phrase literal', () => {
    expect(classifyPhrase('here is what you need to know')).toBe('literal');
    expect(classifyPhrase('\u503c\u5f97\u6ce8\u610f\u7684\u662f')).toBe('literal');
  });

  it('calls something too short a reference rather than matching it', () => {
    expect(classifyPhrase('key')).toBe('reference');
    expect(classifyPhrase('a')).toBe('reference');
  });

  it('calls a long explanatory clause a reference', () => {
    // Upstream watch lists sometimes trail off into advice to the reader. A
    // clause that long is not a phrase to match.
    expect(
      classifyPhrase(
        'a clipped negative tail no guessing The formula appears in every language and elsewhere too',
      ),
    ).toBe('reference');
    // A short clause survives, and will simply never match real text. Missing a
    // detection is the safe direction; inventing one is not.
    expect(classifyPhrase('treat the equivalent construction the same way')).toBe('literal');
  });
});

describe('splitNote', () => {
  it('separates a scope restriction from the phrase', () => {
    expect(splitNote('gate/gated/gating (figurative; keep technical uses)')).toEqual({
      text: 'gate/gated/gating',
      note: 'figurative; keep technical uses',
    });
  });

  it('handles a full-width parenthesis', () => {
    expect(splitNote('\u67d0\u8bcd\uff08\u53ea\u9650\u53e3\u8bed\uff09')).toEqual({
      text: '\u67d0\u8bcd',
      note: '\u53ea\u9650\u53e3\u8bed',
    });
  });

  it('leaves a phrase with no note alone', () => {
    expect(splitNote('here is what you need to know')).toEqual({
      text: 'here is what you need to know',
    });
  });
});

describe('parseWatchList', () => {
  it('produces a phrase per entry with a kind and a match form', () => {
    const phrases = parseWatchList('delve, crucial, not X but Y');
    expect(phrases.map((p) => p.kind)).toEqual(['literal', 'literal', 'template']);
    expect(phrases[0]!.match).toBe('delve');
    // A template keeps its original casing; it is not matched as text.
    expect(phrases[2]!.match).toBe('not X but Y');
  });

  it('keeps a reference entry rather than dropping it', () => {
    const phrases = parseWatchList('key, delve');
    expect(phrases).toHaveLength(2);
    expect(phrases[0]!.kind).toBe('reference');
  });

  it('exposes only matchable phrases to a detector', () => {
    const phrases = parseWatchList('delve, not X but Y, key');
    expect(matchablePhrases(phrases).map((p) => p.text)).toEqual(['delve']);
  });
});

describe('containsTemplateMarker and cleanPhrase', () => {
  it('detects the marker families', () => {
    expect(containsTemplateMarker('X becomes a trap')).toBe(true);
    expect(containsTemplateMarker('as of [date]')).toBe(true);
    expect(containsTemplateMarker('a...b')).toBe(true);
    expect(containsTemplateMarker('plain phrase')).toBe(false);
  });

  it('strips markup and list punctuation', () => {
    expect(cleanPhrase('**bold** `code`')).toBe('bold code');
    expect(cleanPhrase('\u3001 leading')).toBe('leading');
    expect(cleanPhrase('trailing\u3002')).toBe('trailing');
  });
});
