/**
 * Text utilities, with an emphasis on the Chinese-specific paths. Most of the
 * corpus is Chinese, so a whitespace-only tokeniser would quietly break rhythm
 * measurement for the majority of the input.
 */

import { describe, expect, it } from 'vitest';

import {
  computeTextStats,
  countCjkChars,
  detectLanguage,
  isCjkChar,
  isCjkPunctuation,
  normalizeForMatch,
  splitSentences,
  tokenize,
} from '../src/shared/text.js';
import {
  clampSeverity,
  isLanguage,
  isTextMode,
  isValidId,
} from '../src/shared/types.js';

describe('detectLanguage', () => {
  it('detects Chinese', () => {
    expect(detectLanguage('这是一段中文文本，用来测试语言检测。')).toBe('zh');
  });

  it('detects English', () => {
    expect(detectLanguage('This is an English sentence used to test detection.')).toBe('en');
  });

  it('returns unknown when the signal is weak or absent', () => {
    expect(detectLanguage('')).toBe('unknown');
    expect(detectLanguage('12345 !!! ...')).toBe('unknown');
    expect(detectLanguage('中文 mixed with a lot of English words here')).toBe('unknown');
  });
});

describe('tokenize', () => {
  it('treats each Chinese character as a token', () => {
    expect(tokenize('中文测试')).toEqual(['中', '文', '测', '试']);
  });

  it('lowercases and splits Latin runs', () => {
    expect(tokenize('Hello, World!')).toEqual(['hello', 'world']);
  });

  it('handles mixed script without losing either side', () => {
    const tokens = tokenize('用 npm 安装');
    expect(tokens).toEqual(['用', 'npm', '安', '装']);
  });
});

describe('splitSentences', () => {
  it('splits on Chinese terminators and keeps them attached', () => {
    expect(splitSentences('第一句。第二句！第三句？')).toEqual([
      '第一句。',
      '第二句！',
      '第三句？',
    ]);
  });

  it('splits on Latin terminators', () => {
    expect(splitSentences('One. Two! Three?')).toEqual(['One.', 'Two!', 'Three?']);
  });

  it('drops empty fragments', () => {
    expect(splitSentences('One.\n\n\nTwo.')).toEqual(['One.', 'Two.']);
  });
});

describe('character classification', () => {
  it('recognises CJK characters', () => {
    expect(isCjkChar('中')).toBe(true);
    expect(isCjkChar('a')).toBe(false);
  });

  it('recognises CJK punctuation', () => {
    expect(isCjkPunctuation('。')).toBe(true);
    expect(isCjkPunctuation('\u300c')).toBe(true);
    expect(isCjkPunctuation('.')).toBe(false);
  });

  it('counts CJK characters only', () => {
    expect(countCjkChars('中文abc')).toBe(2);
  });
});

describe('normalizeForMatch', () => {
  it('unifies curly, CJK corner and straight double quotes', () => {
    expect(normalizeForMatch('\u201cx\u201d \u300cy\u300d "z"')).toBe('"x" "y" "z"');
  });

  it('unifies CJK white corner brackets to apostrophes', () => {
    expect(normalizeForMatch('\u300e\u300f')).toBe("''");
  });

  it('collapses whitespace', () => {
    expect(normalizeForMatch('a   \n  b')).toBe('a b');
  });
});

describe('computeTextStats', () => {
  it('reports zero burstiness for no variance', () => {
    const stats = computeTextStats('aa bb cc. aa bb cc. aa bb cc.');
    expect(stats.sentenceCount).toBe(3);
    expect(stats.burstiness).toBeCloseTo(0, 6);
  });

  it('reports high burstiness when sentence lengths vary', () => {
    const uniform = computeTextStats('one two three. four five six. seven eight nine.');
    const varied = computeTextStats(
      'one. two three four five six seven eight nine ten. eleven twelve.',
    );
    expect(varied.burstiness).toBeGreaterThan(uniform.burstiness);
  });

  it('counts paragraphs and CJK characters', () => {
    const stats = computeTextStats('第一段。\n\n第二段。');
    expect(stats.paragraphCount).toBe(2);
    expect(stats.cjkCharCount).toBe(6);
  });

  it('survives empty input without dividing by zero', () => {
    const stats = computeTextStats('');
    expect(stats.averageSentenceTokens).toBe(0);
    expect(stats.burstiness).toBe(0);
    expect(Number.isFinite(stats.burstiness)).toBe(true);
  });
});

describe('shared type guards', () => {
  it('validates languages and modes', () => {
    expect(isLanguage('zh')).toBe(true);
    expect(isLanguage('fr')).toBe(false);
    expect(isTextMode('chat')).toBe(true);
    expect(isTextMode('poetry')).toBe(false);
  });

  it('clamps severity into the 1..5 band', () => {
    expect(clampSeverity(0)).toBe(1);
    expect(clampSeverity(9)).toBe(5);
    expect(clampSeverity(3.4)).toBe(3);
    expect(clampSeverity(Number.NaN)).toBe(3);
  });

  it('accepts only dotted snake_case ids', () => {
    expect(isValidId('chat.mirrors_user')).toBe(true);
    expect(isValidId('structural.inflated_significance')).toBe(true);
    expect(isValidId('Chat.Mirrors')).toBe(false);
    expect(isValidId('chat..mirrors')).toBe(false);
    expect(isValidId('.chat')).toBe(false);
    expect(isValidId('chat.mirrors-user')).toBe(false);
  });
});
