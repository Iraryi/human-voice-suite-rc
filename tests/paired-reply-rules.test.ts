import { describe, expect, it } from 'vitest';

import { MAX_REPLY, MIN_REPLY, isRefusal } from '../benchmarks/external/reply-rules.js';

describe('isRefusal', () => {
  it('catches a declined task', () => {
    for (const text of [
      '抱歉，我无法参与这个话题。',
      '很抱歉，我不能继续这个对话。',
      '对不起，我不可以提供这类信息。',
      '作为一个AI助手，我不能这样做。',
      '我无法回答这个问题。',
      '以下是整理后的内容：',
      '希望这些对你有帮助。',
    ]) {
      expect(isRefusal(text), text).toBe(true);
    }
  });

  it('does not treat a chat apology as a refusal', () => {
    // Written here rather than quoted from the run: the reply that exposed this is
    // LCCC-derived text and does not belong in the repository. An earlier version of the
    // pattern matched the bare prefix 抱歉, which is how it was lost.
    for (const text of [
      '抱歉抱歉，刚在忙，没顾上看手机',
      '抱歉啊，我明天才有空',
      '对不起，我记错了',
      '我错了，抱歉',
      '哈哈抱歉，来晚了',
    ]) {
      expect(isRefusal(text), text).toBe(false);
    }
  });

  it('leaves ordinary Chinese chat alone', () => {
    for (const text of ['好的', '在的', '明天见', '？？？', '这也太离谱了', '谢谢啦']) {
      expect(isRefusal(text), text).toBe(false);
    }
  });
});

describe('reply length bounds', () => {
  it('brackets what a chat message can be', () => {
    expect(MIN_REPLY).toBeLessThan(MAX_REPLY);
    expect(MAX_REPLY).toBeGreaterThanOrEqual(120);
  });
});
