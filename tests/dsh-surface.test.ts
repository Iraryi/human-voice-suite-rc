/**
 * The public tool surface.
 *
 * The project brief is emphatic: users see capabilities, never upstreams. These
 * tests make that a checked property rather than a good intention.
 */

import { describe, expect, it } from 'vitest';

import {
  CAPABILITIES,
  DSH_TOOLS,
  FORBIDDEN_TOOL_PATTERNS,
  findUpstreamLeakingToolNames,
  toolByName,
  toolsByCapability,
} from '../src/dsh/tools/descriptors.js';
import { DSH_PLUGIN, DSH_PLUGIN_CONSTRAINTS } from '../src/dsh/plugin/index.js';
import { ASSISTANT_SMELLS, ASSISTANT_SMELL_IDS, getAssistantSmell } from '../src/behavior/types.js';
import { summariseProfile } from '../src/voice/types.js';
import { LOCAL_UPSTREAM } from '../src/rules/provenance/types.js';

describe('capability surface', () => {
  it('exposes exactly the six capabilities and no more', () => {
    expect([...CAPABILITIES].sort()).toEqual(
      ['chat', 'profile', 'rewrite', 'scan', 'validate', 'voice'].sort(),
    );
  });

  it('covers every capability with at least one tool', () => {
    for (const capability of CAPABILITIES) {
      expect(toolsByCapability(capability).length).toBeGreaterThan(0);
    }
  });

  it('names every tool human_voice_<capability>', () => {
    for (const tool of DSH_TOOLS) {
      expect(tool.name).toMatch(/^human_voice_[a-z_]+$/);
    }
  });

  it('exposes no per-upstream tool', () => {
    expect(findUpstreamLeakingToolNames()).toEqual([]);
  });

  it('would catch a per-upstream tool if one were added', () => {
    const leaked = ['run_blader', 'human_voice_humanizer_zh', 'stop_slop_scan'];
    expect(findUpstreamLeakingToolNames(leaked)).toEqual(leaked);
    for (const name of leaked) {
      expect(FORBIDDEN_TOOL_PATTERNS.some((p) => p.test(name))).toBe(true);
    }
  });

  it('declares the scan and prepare tools the brief requires', () => {
    expect(toolByName('human_voice_scan')?.capability).toBe('scan');
    expect(toolByName('human_voice_prepare')?.capability).toBe('rewrite');
  });

  it('states that prepare does not call a model of its own', () => {
    expect(toolByName('human_voice_prepare')?.summary).toMatch(/never calls another language model/);
  });

  it('keeps upstream names internal, as provenance rather than as the interface', () => {
    const scan = toolByName('human_voice_scan')!;
    expect(scan.internalSources).toContain('blader/humanizer');
    expect(scan.name).not.toContain('blader');
  });

  it('requires the mandatory parameters', () => {
    expect(toolByName('human_voice_scan')?.parameters.find((p) => p.name === 'text')?.required).toBe(
      true,
    );
    expect(
      toolByName('human_voice_scan')?.parameters.find((p) => p.name === 'language')?.required,
    ).toBe(false);
  });

  it('gives every tool a summary and a return description', () => {
    for (const tool of DSH_TOOLS) {
      expect(tool.summary.length).toBeGreaterThan(30);
      expect(tool.returns.length).toBeGreaterThan(20);
      expect(tool.targetPhase).toBeGreaterThanOrEqual(4);
    }
  });
});

describe('plugin descriptor', () => {
  it('lists the same tools as the tool catalogue', () => {
    expect([...DSH_PLUGIN.tools].sort()).toEqual(DSH_TOOLS.map((t) => t.name).sort());
  });

  it('lists the same capabilities as the capability set', () => {
    expect([...DSH_PLUGIN.capabilities].sort()).toEqual([...CAPABILITIES].sort());
  });

  it('carries no runtime dependency, so it can run inside DSH as-is', () => {
    expect(DSH_PLUGIN.runtime.dependencies).toEqual([]);
    expect(DSH_PLUGIN.runtime.node).toMatch(/^>=22/);
  });

  it('encodes the design constraints that are easiest to break casually', () => {
    const joined = DSH_PLUGIN_CONSTRAINTS.join('\n');
    expect(joined).toMatch(/never upstreams/i);
    expect(joined).toMatch(/Never call another language model/);
    expect(joined).toMatch(/blended/);
    expect(joined).toMatch(/read-only inputs/);
  });
});

describe('assistant smell taxonomy', () => {
  it('defines the ten smells the brief names', () => {
    expect(ASSISTANT_SMELLS).toHaveLength(10);
    expect(ASSISTANT_SMELL_IDS).toEqual([
      'chat.mirrors_user',
      'chat.over_agreement',
      'chat.unsolicited_advice',
      'chat.auto_summary',
      'chat.unsolicited_offer',
      'chat.over_completeness',
      'chat.explains_obvious',
      'chat.forced_positivity',
      'chat.mechanical_empathy',
      'chat.unrequested_background',
    ]);
  });

  it('gives every smell a Chinese label, a detection hint and rewrite guidance', () => {
    for (const smell of ASSISTANT_SMELLS) {
      expect(smell.labelZh.length).toBeGreaterThan(0);
      expect(smell.detectionHint.length).toBeGreaterThan(30);
      expect(smell.rewriteGuidance.length).toBeGreaterThan(20);
      expect(smell.severity).toBeGreaterThanOrEqual(1);
      expect(smell.severity).toBeLessThanOrEqual(5);
    }
  });

  it('attributes every smell to this project, never to an upstream', () => {
    for (const smell of ASSISTANT_SMELLS) {
      expect(smell.sources.length).toBeGreaterThan(0);
      for (const source of smell.sources) {
        expect(source.upstream).toBe(LOCAL_UPSTREAM);
      }
    }
  });

  it('looks a smell up by id and returns undefined for an unknown one', () => {
    expect(getAssistantSmell('chat.mirrors_user')?.labelZh).toBe('复述用户');
    expect(getAssistantSmell('chat.not_a_smell')).toBeUndefined();
  });
});

describe('voice profile summaries', () => {
  it('reports which dimensions a profile actually carries', () => {
    const summary = summariseProfile({
      schemaVersion: '1.0.0',
      id: 'user/chat',
      owner: 'user',
      kind: 'combined',
      languages: ['zh'],
      sources: [],
      chat: {
        replyLength: { mean: 12, median: 11, stdDev: 4, min: 2, max: 30, sampleCount: 40 },
        burstMessaging: 0.4,
        rhetoricalQuestionRate: 0.15,
        emojiRate: 0.02,
        punctuationInChat: { '。': 0.1 },
        typoAndShorthandHabits: ['省略句末标点'],
      },
      behavior: {
        followUpQuestionRate: 0.2,
        followUpTriggers: ['需求含糊时'],
        topicOmissionRate: 0.35,
        omissionTargets: ['次要点'],
        selfCorrectionStyle: ['follow-up-message'],
        topicJumpAbruptness: 0.6,
        topicJumpMarkers: ['对了'],
        agreementRate: 0.1,
        unsolicitedOfferRate: 0.0,
      },
    });

    expect(summary.hasChat).toBe(true);
    expect(summary.hasBehavior).toBe(true);
    expect(summary.hasWriting).toBe(false);
    expect(summary.id).toBe('user/chat');
  });

  it('supports scoped profiles for the same owner', () => {
    const scopes = ['user/chat', 'user/formal', 'user/technical', 'user/public'];
    expect(new Set(scopes).size).toBe(4);
    for (const scope of scopes) {
      expect(scope).toMatch(/^user\/[a-z]+$/);
    }
  });
});
