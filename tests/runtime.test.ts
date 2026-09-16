/**
 * The capability runtime.
 *
 * The six capabilities are the only surface a user sees. These tests check that
 * each one runs against the real registry and produces something an agent could
 * act on, and that the one thing the project forbids — a blended human score —
 * is not produced anywhere.
 */

import { beforeAll, describe, expect, it } from 'vitest';

import { createToolkit } from '../src/dsh/tools/runtime.js';
import type { Toolkit } from '../src/dsh/tools/runtime.js';
import { FORBIDDEN_BLENDED_SCORE_KEYS } from '../src/validation/types.js';
import { DSH_TOOLS, findUpstreamLeakingToolNames } from '../src/dsh/tools/descriptors.js';

let kit: Toolkit;

beforeAll(async () => {
  kit = await createToolkit();
});

const AI_PROSE = [
  "Let's dive into how caching works. Here's what you need to know.",
  'This is not about speed but about scale. It stands as a testament to careful design, showcasing the enduring power of robust engineering.',
  "Moreover, it is crucial to delve into the intricate tapestry of modern infrastructure. Great question! I hope this helps.",
].join('\n\n');

describe('the toolkit', () => {
  it('loads the registry once and exposes it', () => {
    expect(kit.registry.size).toBeGreaterThan(70);
    expect(kit.build.problems).toEqual([]);
  });

  it('exposes exactly the capabilities the tool surface declares', () => {
    const capabilities = new Set(DSH_TOOLS.map((tool) => tool.capability));
    expect(capabilities.has('scan')).toBe(true);
    expect(['scan', 'rewrite', 'voice', 'chat', 'validate', 'profile'].sort()).toEqual(
      [...capabilities].sort(),
    );
  });

  it('still exposes no per-upstream tool', () => {
    expect(findUpstreamLeakingToolNames()).toEqual([]);
  });
});

describe('scan', () => {
  it('finds real tells and attributes them to canonical rules', async () => {
    const result = await kit.scan({ text: AI_PROSE, mode: 'prose' });
    const rules = result.canonicalFindings.map((f) => f.canonicalRuleId);
    expect(rules).toContain('lexical.ai_vocabulary');
    expect(rules).toContain('structural.negation_contrast');
    expect(rules).toContain('assistant.chatbot_residue');
    expect(result.scores.antiAIScore).toBeLessThan(1);
  });

  it('never reports one canonical rule twice', async () => {
    const result = await kit.scan({ text: AI_PROSE, mode: 'prose' });
    const ids = result.canonicalFindings.map((f) => f.canonicalRuleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reports what the suppression policy dropped', async () => {
    const result = await kit.scan({ text: AI_PROSE, mode: 'prose' });
    for (const entry of result.suppressed) {
      expect(entry.reason.length).toBeGreaterThan(10);
      expect(entry.finding.ruleId.length).toBeGreaterThan(0);
    }
  });
});

describe('prepare', () => {
  it('produces a contract the executing agent can act on', async () => {
    const prepared = await kit.prepare({ text: AI_PROSE, mode: 'prose' });
    expect(prepared.contract.schemaVersion).toBe('1.0.0');
    expect(prepared.contract.strategyId).toBe(prepared.strategy.id);
    expect(prepared.contract.rules.length).toBeGreaterThan(3);
    expect(prepared.contract.budget.maxValidationRetries).toBe(1);
  });

  it('orders the directives by severity, so the agent fixes what matters first', async () => {
    const prepared = await kit.prepare({ text: AI_PROSE, mode: 'prose' });
    const severities = prepared.contract.rules.map((rule) => rule.severity);
    expect(severities).toEqual([...severities].sort((a, b) => b - a));
  });

  it('carries the detector and the upstream behind every directive', async () => {
    const prepared = await kit.prepare({ text: AI_PROSE, mode: 'prose' });
    for (const rule of prepared.contract.rules) {
      expect(rule.triggeredBy.length, rule.ruleId).toBeGreaterThan(0);
      expect(rule.triggeredBy[0]!.detectorId.length).toBeGreaterThan(0);
      expect(rule.triggeredBy[0]!.upstream.length).toBeGreaterThan(0);
      // The bar is low on purpose. Upstreams write guidance in their own voice
      // and some of it is terse and perfectly usable: "Say the plain thing.",
      // "Collapse to one word." A higher bar here would be about style, not
      // about whether the agent can act on it.
      expect(rule.guidance.length, rule.ruleId).toBeGreaterThan(15);
    }
  });

  it('never hands the agent guidance that is a parsing artifact', async () => {
    // `lexical.provider_tic` carries the string `"Here's"). Rephrase plainly.`,
    // which is the tail of a rule description the extractor split badly. The
    // rule is withdrawn from matching so it never reaches a contract — this test
    // is what will notice if that changes.
    const prepared = await kit.prepare({ text: AI_PROSE, mode: 'prose' });
    for (const rule of prepared.contract.rules) {
      expect(rule.guidance, rule.ruleId).not.toMatch(/^["'\u201c\u201d]/);
    }
  });

  it('extracts protected content from the source and hands it over', async () => {
    const text =
      'Run `npm test` and read src/index.ts. The build is at https://example.com/build and takes 42 seconds.';
    const prepared = await kit.prepare({ text, mode: 'technical' });
    const kinds = prepared.contract.preserve.map((p) => p.kind);
    expect(kinds).toContain('inline-code');
    expect(kinds).toContain('url');
    expect(kinds).toContain('path');
  });

  it('prepends a mode-appropriate preamble to the contract body', async () => {
    const prepared = await kit.prepare({ text: AI_PROSE, mode: 'prose' });
    expect(prepared.preamble).toContain('# Task');
    expect(prepared.preamble).toContain('Every claim in the source must still be present');
    // The body must follow on its own line, not run into the preamble.
    expect(prepared.rendered).toContain('\n# Human voice contract');
  });

  it('says when a strategy deliberately disables part of the work', async () => {
    const prepared = await kit.prepare({
      text: 'The system reads the input and writes the output to a file in the target directory.',
      mode: 'technical',
    });
    expect(prepared.strategy.id).toBe('technical');
    expect(prepared.preamble).toMatch(/precision/i);
  });

  it('keeps the universal prohibitions on every contract', async () => {
    const prepared = await kit.prepare({ text: AI_PROSE, mode: 'prose' });
    const joined = prepared.contract.forbidden.join('\n');
    expect(joined).toMatch(/Do not add facts/);
    expect(joined).toMatch(/Do not close by offering further help/);
  });
});

describe('validate', () => {
  it('reports four separate scores and never fuses them', async () => {
    const result = await kit.validate({ original: AI_PROSE, rewritten: AI_PROSE });
    // `unmeasured` is present when a score had nothing to measure against. It is
    // not a fifth score: it is the list saying which of the four mean nothing.
    expect(Object.keys(result.scores).sort()).toEqual(
      [
        'antiAIScore',
        'behaviorScore',
        'preservationScore',
        'rationales',
        'unmeasured',
        'voiceScore',
      ].sort(),
    );
    const serialised = JSON.stringify(result.scores);
    for (const key of FORBIDDEN_BLENDED_SCORE_KEYS) {
      expect(serialised).not.toContain(`"${key}"`);
    }
  });

  it('catches a dropped URL and lowers the preservation score', async () => {
    const result = await kit.validate({
      original: 'See https://example.com/a for the details.',
      rewritten: 'See the documentation for the details.',
    });
    expect(result.preservation.lost.some((d) => d.kind === 'url')).toBe(true);
    expect(result.scores.preservationScore).toBeLessThan(1);
    expect(result.issues.some((i) => i.kind === 'protected-content-lost')).toBe(true);
    expect(result.retryRecommended).toBe(true);
  });

  it('scores a faithful rewrite as preserving everything', async () => {
    const text = 'Run `npm test` and read src/index.ts, then check https://example.com/a.';
    const result = await kit.validate({ original: text, rewritten: text });
    expect(result.scores.preservationScore).toBe(1);
    expect(result.preservation.lost).toEqual([]);
    expect(result.preservation.altered).toEqual([]);
  });

  it('scores the rewrite by rescanning it, not by trusting the rewrite', async () => {
    const clean = await kit.validate({
      original: 'The cat sat on the mat.',
      rewritten: 'The cat sat on the mat.',
    });
    const dirty = await kit.validate({
      original: 'The cat sat on the mat.',
      rewritten: AI_PROSE,
    });
    expect(clean.scores.antiAIScore).toBe(1);
    expect(dirty.scores.antiAIScore).toBeLessThan(1);
    expect(dirty.rescanned.canonicalFindings.length).toBeGreaterThan(0);
  });

  it('says plainly that voice and behaviour were not measured without a profile', async () => {
    const result = await kit.validate({ original: 'A sentence.', rewritten: 'A sentence.' });
    expect(result.summary).toContain('not measured');
    // Not zero: nothing was measured, and a zero would read as a failure.
    expect(result.scores.voiceScore).toBe(1);
    expect(result.scores.behaviorScore).toBe(1);
  });

  it('gives a reason for the retry recommendation either way', async () => {
    const good = await kit.validate({
      original: 'The parser reads the file.',
      rewritten: 'The parser reads the file.',
    });
    expect(good.retryRecommended).toBe(false);

    const bad = await kit.validate({
      original: 'See https://example.com/a.',
      rewritten: 'See the docs.',
    });
    expect(bad.retryRecommended).toBe(true);
  });

  it('explains the preservation score rather than only reporting it', async () => {
    const result = await kit.validate({
      original: 'Run `npm test` at https://example.com/a on 2026-09-16.',
      rewritten: 'Run `npm test` at https://example.com/a on 2026-09-16.',
    });
    const rationale = result.scores.rationales.find((r) => r.score === 'preservationScore');
    expect(rationale).toBeDefined();
    expect(rationale!.summary).toMatch(/protected item/);
    expect(rationale!.contributions.length).toBeGreaterThan(0);
  });
});

describe('strategyFor', () => {
  it('picks the same strategy the prepare step would, before doing any work', () => {
    const strategy = kit.strategyFor({ language: 'zh', mode: 'chat', text: '这个怎么弄？' });
    expect(strategy.id).toBe('zh-chat');
    expect(strategy.fastPath).toBe(true);
  });

  it('prefers a personal voice profile when one is loaded', () => {
    const strategy = kit.strategyFor({
      language: 'zh',
      mode: 'chat',
      text: '这个怎么弄？',
      hasVoiceProfile: true,
    });
    expect(strategy.id).toBe('personal-voice-chat');
  });
});

describe('the whole path', () => {
  it('scans, prepares, then validates a rewrite that keeps its protected content', async () => {
    const original = 'The system stands as a testament to robust design. See https://example.com/a.';
    const scanResult = await kit.scan({ text: original, mode: 'prose' });
    expect(scanResult.canonicalFindings.length).toBeGreaterThan(0);

    const prepared = await kit.prepare({ text: original, mode: 'prose' });
    expect(prepared.contract.preserve.some((p) => p.kind === 'url')).toBe(true);

    const rewritten = 'The design is robust. See https://example.com/a.';
    const validated = await kit.validate({ original, rewritten });
    expect(validated.scores.preservationScore).toBe(1);
    expect(validated.scores.antiAIScore).toBeGreaterThan(scanResult.scores.antiAIScore);
  });
});
