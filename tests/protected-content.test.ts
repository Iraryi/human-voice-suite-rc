/**
 * Protected content.
 *
 * A rewrite that improves the prose and quietly drops a URL, a commit hash or a
 * version number has made the document worse. These tests pin the behaviour
 * that stops that.
 */

import { describe, expect, it } from 'vitest';

import {
  checkPreservation,
  extractProtectedContent,
} from '../src/validation/protected-content/extract.js';

const SAMPLE = [
  'Run `npm run upstream:check` to refresh the cache.',
  'The upstream lives at https://github.com/blader/humanizer and is pinned to',
  '9862685f575c65a8247f90369951df1b3416e3d6 (v3.0.0).',
  'The sync engine is in src/upstream/sync.ts and it writes UPSTREAM_UPDATE_REPORT.md.',
  'As Siqi Chen wrote, "the notice must travel with the copy".',
  'This was recorded on 2026-09-16 and covers 25 patterns.',
].join('\n');

const directives = extractProtectedContent(SAMPLE);

function values(kind: string): string[] {
  return directives.filter((d) => d.kind === kind).map((d) => d.value);
}

describe('extractProtectedContent', () => {
  it('finds URLs', () => {
    expect(values('url')).toContain('https://github.com/blader/humanizer');
  });

  it('finds inline code without its backticks', () => {
    expect(values('inline-code')).toContain('npm run upstream:check');
  });

  it('finds commit hashes', () => {
    expect(values('identifier')).toContain('9862685f575c65a8247f90369951df1b3416e3d6');
  });

  it('does not mistake an ordinary word for a hash', () => {
    const extracted = extractProtectedContent('The defaced facade was a decade old.');
    expect(values('identifier')).not.toContain('defaced');
    expect(extracted.some((d) => d.value === 'defaced')).toBe(false);
  });

  it('finds relative file paths but not the path portion of a URL', () => {
    const paths = values('path');
    expect(paths).toContain('src/upstream/sync.ts');
    expect(paths).toContain('UPSTREAM_UPDATE_REPORT.md');
    expect(paths.some((p) => p.includes('github.com'))).toBe(false);
  });

  it('finds version numbers and other quantities', () => {
    expect(values('number')).toContain('v3.0.0'.replace('v', '')); // 3.0.0
    expect(values('number')).toContain('25');
  });

  it('finds dates', () => {
    expect(values('date')).toContain('2026-09-16');
  });

  it('finds quotations without their delimiters', () => {
    expect(values('quotation')).toContain('the notice must travel with the copy');
  });

  it('finds proper nouns', () => {
    expect(values('proper-noun')).toContain('Siqi Chen');
  });

  it('does not join a heading to the first word under it', () => {
    // Phase 8, found by the first run that measured preservationScore end to
    // end. `\s` matches a newline, so the H1 and the paragraph's first
    // capitalised word were captured as one name — an artefact that almost no
    // honest rewrite can keep, and it drove a faithful candidate to 0.00.
    const found = extractProtectedContent(
      '# Strategic Negotiations And Global Partnerships\n\nThe agreement was signed last month.',
    );
    const names = values('proper-noun');
    expect(names).not.toContain('Strategic Negotiations And Global Partnerships The');
    expect(names.some((name) => name.includes('The agreement'))).toBe(false);
  });

  it('does not slice a fragment out of a camel-case word', () => {
    // Also Phase 8. Without a lookbehind the camelCase branch matched from the
    // second letter, because `[a-z]+` cannot start at the capital: `penClaw`,
    // `itHub`. A fragment can never be kept by a rewrite that legitimately drops
    // the word, so it depressed the score for a correct rewrite.
    const found = extractProtectedContent('OpenClaw and GitHub both ship a CLI.');
    const identifiers = found
      .filter((directive) => directive.kind === 'identifier')
      .map((directive) => directive.value);
    expect(identifiers).not.toContain('penClaw');
    expect(identifiers).not.toContain('itHub');
    expect(identifiers).toContain('OpenClaw');
    expect(identifiers).toContain('GitHub');
  });

  it('does not protect a heading, because removing AI title case is the job', () => {
    // Phase 8. A title-cased heading is a capitalised sequence, so it was
    // extracted as a proper noun and a rewrite whose whole purpose is to fix
    // title case was forbidden from touching the title. Both shapes count: the
    // Markdown one, and the bare line a model emits when it drops the markers.
    const found = extractProtectedContent(
      [
        '# Strategic Negotiations And Global Partnerships',
        '',
        'The agreement was signed last month.',
        '',
        'Challenges and Legacy',
        '',
        'Both sides remain committed.',
      ].join('\n'),
    );
    const names = found
      .filter((directive) => directive.kind === 'proper-noun')
      .map((directive) => directive.value);
    expect(names).toEqual([]);
  });

  it('still protects a name inside prose, and a number inside a heading', () => {
    const found = extractProtectedContent(
      ['## Version 2.1.142', '', 'As Siqi Chen wrote, the notice travels with the copy.'].join('\n'),
    );
    const extracted = found.map((directive) => `${directive.kind}:${directive.value}`);
    expect(extracted).toContain('number:2.1.142');
    expect(extracted).toContain('proper-noun:Siqi Chen');
  });

  it('does not mistake an ordinary sentence for a heading', () => {
    // Sentence case is prose, and a name in it is a name.
    const found = extractProtectedContent('Siqi Chen wrote the notice.');
    expect(found.map((directive) => directive.value)).toContain('Siqi Chen');
  });

  it('says how many protected items it found, so a check that never ran is visible', () => {
    // `preservationScore` is 1 both when everything survived and when there was
    // nothing to preserve. `itemCount` is what tells them apart.
    expect(extractProtectedContent('Nothing to protect here.').length).toBe(0);
    const check = checkPreservation(extractProtectedContent('Nothing to protect here.'), 'Anything.');
    expect(check.preservationScore).toBe(1);
    expect(check.itemCount).toBe(0);
    expect(checkPreservation(extractProtectedContent('See https://a.example/b.'), 'See it.').itemCount).toBe(1);
  });

  it('counts repeated occurrences so a partial loss is detectable', () => {
    const found = extractProtectedContent('Use buildVoiceProfile. Then buildVoiceProfile again.');
    const identifier = found.find((d) => d.value === 'buildVoiceProfile');
    expect(identifier?.occurrences).toBe(2);
    expect(identifier?.exact).toBe(true);
  });

  it('does not double-count a URL as both a URL and a path', () => {
    const found = extractProtectedContent('See https://example.com/a/b/c for details.');
    const joined = found.map((d) => `${d.kind}:${d.value}`);
    expect(joined).toContain('url:https://example.com/a/b/c');
    expect(joined.filter((entry) => entry.includes('example.com'))).toHaveLength(1);
  });

  it('can skip the noisy extractors', () => {
    const found = extractProtectedContent(SAMPLE, {
      includeNumbers: false,
      includeProperNouns: false,
    });
    expect(found.some((d) => d.kind === 'number')).toBe(false);
    expect(found.some((d) => d.kind === 'proper-noun')).toBe(false);
    expect(found.some((d) => d.kind === 'url')).toBe(true);
  });
});

describe('checkPreservation', () => {
  const original = extractProtectedContent(SAMPLE);

  it('scores a faithful rewrite at or near perfect', () => {
    const result = checkPreservation(original, SAMPLE);
    expect(result.preservationScore).toBe(1);
    expect(result.issues).toEqual([]);
    expect(result.lost).toEqual([]);
    expect(result.altered).toEqual([]);
  });

  it('flags a dropped URL as lost', () => {
    const rewritten = SAMPLE.replace('https://github.com/blader/humanizer', 'the upstream');
    const result = checkPreservation(original, rewritten);
    expect(result.lost.some((d) => d.value === 'https://github.com/blader/humanizer')).toBe(true);
    expect(result.preservationScore).toBeLessThan(1);
    expect(result.issues.some((i) => i.kind === 'protected-content-lost')).toBe(true);
  });

  it('flags a mutated commit hash as lost, because exact values are matched exactly', () => {
    const rewritten = SAMPLE.replace(
      '9862685f575c65a8247f90369951df1b3416e3d6',
      '9862685f575c65a8247f90369951df1b3416e3d7',
    );
    const result = checkPreservation(original, rewritten);
    expect(result.lost.some((d) => d.kind === 'identifier')).toBe(true);
    expect(result.issues.some((i) => i.kind === 'protected-content-lost')).toBe(true);
    expect(result.preservationScore).toBeLessThan(1);
  });

  it('distinguishes partial loss from total loss', () => {
    const rewritten = SAMPLE.replace(
      '9862685f575c65a8247f90369951df1b3416e3d6',
      '9862685f575c65a8247f90369951df1b3416e3d7',
    );
    const result = checkPreservation(original, rewritten);
    // The mutated hash is gone, and so is nothing else.
    expect(result.kept.length).toBe(original.length - 1);
  });

  it('flags a lost occurrence when a name appears fewer times than before', () => {
    const before = extractProtectedContent('buildVoiceProfile then buildVoiceProfile');
    const result = checkPreservation(before, 'buildVoiceProfile only once now');
    expect(result.issues.some((i) => i.message.includes('appeared 2x but only 1x'))).toBe(true);
  });

  it('accepts quote-style variation in a non-exact protected value', () => {
    const before = extractProtectedContent('They said \u201cthe notice must travel\u201d loudly.');
    const result = checkPreservation(before, 'They said "the notice must travel" loudly.');
    expect(result.preservationScore).toBe(1);
  });

  it('returns a perfect score when there was nothing to protect', () => {
    const result = checkPreservation([], 'anything at all');
    expect(result.preservationScore).toBe(1);
  });

  it('attributes every issue to the preservation score', () => {
    const rewritten = SAMPLE.replace('https://github.com/blader/humanizer', 'nowhere');
    const result = checkPreservation(original, rewritten);
    expect(result.issues.length).toBeGreaterThan(0);
    for (const issue of result.issues) {
      expect(issue.score).toBe('preservationScore');
    }
  });
});
