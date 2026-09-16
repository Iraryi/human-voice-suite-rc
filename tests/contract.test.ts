/**
 * The rewrite contract.
 *
 * `human_voice_prepare` never calls a model. It produces this structure and the
 * calling agent executes it, so the contract has to be complete enough to act
 * on and honest enough not to promise a number it cannot deliver.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_VALIDATION,
  UNIVERSAL_FORBIDDEN,
  behaviorDirectives,
  buildContract,
  directivesFromFindings,
  renderContractForAgent,
} from '../src/rewrite/contract.js';
import { buildSeedRegistry } from '../src/rules/canonical/seed.js';
import type { Finding } from '../src/detector/types.js';
import { ASSISTANT_SMELLS } from '../src/behavior/types.js';
import { FORBIDDEN_BLENDED_SCORE_KEYS } from '../src/validation/types.js';

const { registry } = buildSeedRegistry();

function contract() {
  return buildContract({
    language: 'zh',
    mode: 'chat',
    strategyId: 'zh-chat',
    objective: 'Answer the question the way this person would.',
    voiceProfileId: 'user/chat',
    behaviorBaselineId: 'default-zh-chat',
  });
}

describe('buildContract', () => {
  it('stamps the schema version and a unique contract id', () => {
    const first = contract();
    const second = contract();
    expect(first.schemaVersion).toBe('1.0.0');
    expect(first.contractId).not.toBe(second.contractId);
    expect(first.contractId).toContain('hvc-zh-chat-zh-chat');
  });

  it('caps the retry budget at one, as the pipeline design requires', () => {
    const built = contract();
    expect(built.budget.maxValidationRetries).toBe(1);
    expect(built.budget.maxRewritePasses).toBe(2);
  });

  it('carries the universal prohibitions on every contract', () => {
    const built = contract();
    for (const rule of UNIVERSAL_FORBIDDEN) {
      expect(built.forbidden).toContain(rule);
    }
  });

  it('appends strategy-specific prohibitions without dropping the universal ones', () => {
    const built = buildContract({
      language: 'en',
      mode: 'prose',
      strategyId: 'en-prose',
      objective: 'objective',
      forbidden: ['Do not touch the legal disclaimer.'],
    });
    expect(built.forbidden).toContain('Do not touch the legal disclaimer.');
    expect(built.forbidden.length).toBe(UNIVERSAL_FORBIDDEN.length + 1);
  });

  it('omits optional profile fields when they were not supplied', () => {
    const built = buildContract({
      language: 'en',
      mode: 'prose',
      strategyId: 'en-prose',
      objective: 'objective',
    });
    expect('voiceProfileId' in built).toBe(false);
    expect('behaviorBaselineId' in built).toBe(false);
  });

  it('defaults to the standard validation requirements', () => {
    expect(contract().validation).toEqual(DEFAULT_VALIDATION);
  });

  it('requires every validation requirement to name one of the four scores', () => {
    const allowed = new Set([
      'antiAIScore',
      'voiceScore',
      'behaviorScore',
      'preservationScore',
    ]);
    for (const requirement of DEFAULT_VALIDATION) {
      expect(allowed.has(requirement.score)).toBe(true);
    }
  });
});

describe('directivesFromFindings', () => {
  const finding: Finding = {
    ruleId: '13',
    canonicalRuleId: 'structural.inflated_significance',
    upstream: 'blader/humanizer',
    detectorId: 'structural.inflated_significance',
    category: 'structural',
    family: 'structural',
    severity: 4,
    languages: ['en', 'zh'],
    message: 'inflated significance',
    evidence: [],
    confidence: 0.9,
  };

  it('keys the directive on the canonical rule, not the upstream-local id', () => {
    const directives = directivesFromFindings([finding], (id) =>
      registry.get(id)?.rewriteGuidance,
    );
    expect(directives).toHaveLength(1);
    expect(directives[0]!.ruleId).toBe('structural.inflated_significance');
    expect(directives[0]!.guidance).toBe(
      registry.get('structural.inflated_significance')!.rewriteGuidance,
    );
    expect(directives[0]!.triggeredBy[0]!.upstream).toBe('blader/humanizer');
  });

  it('falls back to a usable instruction when no guidance exists', () => {
    const directives = directivesFromFindings([finding], () => undefined);
    expect(directives[0]!.guidance).toMatch(/without losing any information/);
  });
});

describe('behaviorDirectives', () => {
  it('emits the high-severity assistant smells for chat mode', () => {
    const directives = behaviorDirectives('chat');
    const highSeverity = ASSISTANT_SMELLS.filter((s) => s.severity >= 3);
    expect(directives).toHaveLength(highSeverity.length);
    expect(directives.join('\n')).toContain('复述用户');
    expect(directives.join('\n')).toContain('主动提供更多帮助');
  });

  it('emits nothing outside chat mode', () => {
    expect(behaviorDirectives('prose')).toEqual([]);
    expect(behaviorDirectives('formal')).toEqual([]);
  });
});

describe('renderContractForAgent', () => {
  it('renders the objective, the rules and the prohibitions in plain language', () => {
    const built = buildContract({
      language: 'zh',
      mode: 'chat',
      strategyId: 'zh-chat',
      objective: 'Answer the question the way this person would.',
      rules: [
        {
          ruleId: 'chat.mirrors_user',
          category: 'chat',
          severity: 4,
          guidance: 'Delete the restatement.',
          triggeredBy: [
            {
              detectorId: 'assistant.smell_taxonomy',
              upstream: 'human-voice-suite/local',
              message: 'the reply restates the user turn',
              severity: 4,
            },
          ],
        },
      ],
    });
    const rendered = renderContractForAgent(built);

    expect(rendered).toContain('# Human voice contract');
    expect(rendered).toContain('Answer the question the way this person would.');
    expect(rendered).toContain('chat.mirrors_user');
    expect(rendered).toContain('Delete the restatement.');
    expect(rendered).toContain('## Never do this');
    expect(rendered).toContain('## How this will be checked');
    expect(rendered).toContain('At most 2 rewrite passes and 1 validation retry.');
  });

  it('orders rules by severity so the agent fixes what matters first', () => {
    const built = buildContract({
      language: 'en',
      mode: 'prose',
      strategyId: 'en-prose',
      objective: 'objective',
      rules: [
        { ruleId: 'low.rule', category: 'x', severity: 1, guidance: 'minor', triggeredBy: [] },
        { ruleId: 'high.rule', category: 'x', severity: 5, guidance: 'major', triggeredBy: [] },
      ],
    });
    const rendered = renderContractForAgent(built);
    expect(rendered.indexOf('high.rule')).toBeLessThan(rendered.indexOf('low.rule'));
  });

  it('states that there is no single human score and forbids claiming one', () => {
    const rendered = renderContractForAgent(contract());
    expect(rendered).toContain('no single "human score"');
    expect(rendered).toMatch(/must not claim one/);
  });

  it('never emits a blended score key', () => {
    const rendered = renderContractForAgent(contract());
    for (const key of FORBIDDEN_BLENDED_SCORE_KEYS) {
      expect(rendered).not.toContain(key);
    }
  });

  it('lists protected content when the caller supplied it', () => {
    const built = buildContract({
      language: 'en',
      mode: 'technical',
      strategyId: 'technical',
      objective: 'objective',
      preserve: [
        { kind: 'url', value: 'https://example.com/a', occurrences: 1, exact: true },
        { kind: 'identifier', value: 'buildVoiceProfile', occurrences: 3, exact: true },
      ],
    });
    const rendered = renderContractForAgent(built);
    expect(rendered).toContain('## Preserve exactly');
    expect(rendered).toContain('https://example.com/a');
    expect(rendered).toContain('buildVoiceProfile');
  });
});
