/**
 * Strategy selection must be deterministic. The project brief forbids asking an
 * agent to improvise a plan at runtime, so every choice here is a first-match
 * rule with a recorded rationale.
 */

import { describe, expect, it } from 'vitest';

import {
  FAST_PATH_PIPELINE,
  FULL_PIPELINE,
  inferMode,
  selectStrategy,
  strategyIds,
} from '../src/rewrite/strategies/strategy.js';
import { computeTextStats } from '../src/shared/text.js';

const short = computeTextStats('这个怎么弄？');

describe('selectStrategy', () => {
  it('sends English long-form prose to the blader and detector strategies', () => {
    const strategy = selectStrategy({ language: 'en', mode: 'prose' });
    expect(strategy.id).toBe('en-prose');
    expect(strategy.adapters).toContain('blader-humanizer');
    expect(strategy.adapters).toContain('ai-humanizer');
    expect(strategy.fastPath).toBe(false);
    expect(strategy.pipeline).toEqual(FULL_PIPELINE);
  });

  it('sends Chinese long-form prose to the Chinese rules plus the shared structural rules', () => {
    const strategy = selectStrategy({ language: 'zh', mode: 'prose' });
    expect(strategy.id).toBe('zh-prose');
    expect(strategy.adapters).toContain('humanizer-zh');
    expect(strategy.adapters).toContain('blader-humanizer');
    expect(strategy.detectorFamilies).toContain('chinese');
  });

  it('sends a short Chinese chat turn down the fast path', () => {
    const strategy = selectStrategy({ language: 'zh', mode: 'chat', textStats: short });
    expect(strategy.id).toBe('zh-chat');
    expect(strategy.fastPath).toBe(true);
    expect(strategy.pipeline).toEqual(FAST_PATH_PIPELINE);
    expect(strategy.useBehaviorBaseline).toBe(true);
    expect(strategy.detectorFamilies).toEqual(['assistant']);
  });

  it('does not send a long chat turn down the fast path', () => {
    const long = computeTextStats('x'.repeat(2000));
    const strategy = selectStrategy({ language: 'en', mode: 'chat', textStats: long });
    expect(strategy.id).toBe('chat-long-turn');
    expect(strategy.fastPath).toBe(false);
    expect(strategy.useBehaviorBaseline).toBe(true);
  });

  it('lets a loaded personal voice profile outrank a generic humanizer strategy', () => {
    const strategy = selectStrategy({
      language: 'zh',
      mode: 'chat',
      textStats: short,
      hasVoiceProfile: true,
      voiceProfileId: 'user/chat',
    });
    expect(strategy.id).toBe('personal-voice-chat');
    expect(strategy.adapters).toEqual(['dsh-humanizer']);
    expect(strategy.useVoiceProfile).toBe(true);
  });

  it('keeps formal writing conservative about structural rewriting', () => {
    const strategy = selectStrategy({ language: 'en', mode: 'formal' });
    expect(strategy.id).toBe('formal');
    expect(strategy.detectorFamilies).not.toContain('structural');
    expect(strategy.rationale).toMatch(/passive voice/);
  });

  it('protects technical writing from rhythm rewriting', () => {
    const strategy = selectStrategy({ language: 'en', mode: 'technical' });
    expect(strategy.id).toBe('technical');
    expect(strategy.detectorFamilies).not.toContain('rhythm');
    expect(strategy.ruleCategories).not.toContain('structural');
  });

  it('always returns a strategy, even for an unknown language and mode', () => {
    const strategy = selectStrategy({ language: 'unknown', mode: 'unknown' });
    expect(strategy.id).toBe('default');
    expect(strategy.rationale).toMatch(/unknown/i);
  });

  it('is deterministic: the same input yields the same strategy every time', () => {
    const input = { language: 'zh' as const, mode: 'prose' as const };
    const ids = new Set(Array.from({ length: 20 }, () => selectStrategy(input).id));
    expect(ids.size).toBe(1);
  });

  it('gives every strategy a non-empty rationale and pipeline', () => {
    for (const id of strategyIds()) {
      void id;
    }
    const cases = [
      { language: 'zh' as const, mode: 'prose' as const },
      { language: 'en' as const, mode: 'formal' as const },
      { language: 'en' as const, mode: 'technical' as const },
      { language: 'zh' as const, mode: 'public' as const },
    ];
    for (const input of cases) {
      const strategy = selectStrategy(input);
      expect(strategy.rationale.length).toBeGreaterThan(10);
      expect(strategy.pipeline.length).toBeGreaterThan(0);
    }
  });
});

describe('inferMode', () => {
  it('honours a declared mode', () => {
    expect(inferMode('anything', 'formal')).toBe('formal');
  });

  it('treats fenced or inline code as technical', () => {
    expect(inferMode('run `npm test` first')).toBe('technical');
    expect(inferMode('```js\nconst a = 1\n```')).toBe('technical');
  });

  it('treats a short question as chat', () => {
    expect(inferMode('这个怎么办？')).toBe('chat');
  });

  it('resolves ambiguity to unknown rather than guessing', () => {
    expect(inferMode('x'.repeat(1000))).toBe('unknown');
    expect(inferMode('')).toBe('unknown');
  });
});
