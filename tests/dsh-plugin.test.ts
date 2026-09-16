/**
 * The DSH plugin entry point.
 *
 * DSH loads this module into a profile and calls `apply(ctx, config)`. The tests
 * drive it exactly that way — a fake context that records registrations, then
 * real calls through each registered tool — because the alternative is finding
 * out from a live harness that a schema does not match its output.
 *
 * What is deliberately *not* mocked: the toolkit. Every tool here runs against
 * the real registry, the real detectors and the real corpus, so a registration
 * that resolves is a registration that works.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  apply,
  defaultProfileDir,
  inject,
  loadImportedAuthorVoices,
  name,
  scopedProfileId,
} from '../src/dsh/plugin/server.js';
import type { DshToolDefinition } from '../src/dsh/plugin/server.js';
import { DSH_TOOLS, findUpstreamLeakingToolNames, toolByName } from '../src/dsh/tools/descriptors.js';
import { validateAgainst } from './lib/tool-schema.js';

const ROOT = join(__dirname, '..');
const temporary: string[] = [];
afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

function profileDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'hvs-profiles-'));
  temporary.push(dir);
  return dir;
}

/** A context that registers like DSH's registry and keeps what it was given. */
function fakeContext(): { tools: Map<string, DshToolDefinition>; ctx: { tools: { register(tool: DshToolDefinition): () => void } } } {
  const tools = new Map<string, DshToolDefinition>();
  return {
    tools,
    ctx: {
      tools: {
        register(definition) {
          if (tools.has(definition.name)) throw new Error(`duplicate tool ${definition.name}`);
          tools.set(definition.name, definition);
          return () => tools.delete(definition.name);
        },
      },
    },
  };
}

function loadAll(config: Record<string, unknown> = {}): Map<string, DshToolDefinition> {
  const { tools, ctx } = fakeContext();
  apply(ctx, { projectRoot: ROOT, ...config });
  return tools;
}

async function run(
  tools: Map<string, DshToolDefinition>,
  toolName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const tool = tools.get(toolName);
  expect(tool, toolName).toBeDefined();
  return (await tool!.execute(args, {})) as Record<string, unknown>;
}

describe('the plugin surface', () => {
  it('declares the name and service the profile patch expects', () => {
    expect(name).toBe('human-voice-suite');
    expect(inject).toEqual(['tools']);
  });

  it('registers exactly the six declared tools, and no upstream tool', () => {
    const tools = loadAll();
    expect([...tools.keys()].sort()).toEqual(DSH_TOOLS.map((tool) => tool.name).sort());
    expect(findUpstreamLeakingToolNames([...tools.keys()])).toEqual([]);
  });

  it('registers nothing when the profile disables it', () => {
    expect(loadAll({ enabled: false }).size).toBe(0);
  });

  it('gives every tool a JSON Schema its own output satisfies', async () => {
    const tools = loadAll({ profileDir: profileDir() });
    // A representative call per tool, so the schema is checked against real
    // output rather than against a hand-written sample.
    const calls: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
      ['human_voice_scan', { text: '这是一段用来测试扫描的中文文本。它有两句话。' }],
      ['human_voice_prepare', { text: '这是一段需要改写的草稿。', mode: 'prose' }],
      ['human_voice_validate', { original: 'See https://example.com/a.', rewritten: 'See the site.' }],
      ['human_voice_chat', { reply: '确实挺离谱的，不过从另一个角度来看这件事。', userTurn: '你看那个新闻了吗' }],
      ['human_voice_voice', { action: 'import' }],
      ['human_voice_profile', { action: 'build', scope: 'chat', samples: ['好的，我看一下。', '行，明天再说。'] }],
    ];

    for (const [toolName, args] of calls) {
      const tool = tools.get(toolName)!;
      const value = await tool.execute(args, {});
      const problems = validateAgainst(tool.output.schema, value);
      expect(problems, `${toolName}: ${problems.join('; ')}`).toEqual([]);
      const blocks = tool.output.render(args, value);
      expect(blocks.length, toolName).toBeGreaterThan(0);
      expect(blocks[0]?.type, toolName).toBe('text');
      expect(blocks[0]?.text.length, toolName).toBeGreaterThan(0);
    }
  }, 120000);

  it('declares an object-rooted schema with required fields for every tool', () => {
    for (const [toolName, tool] of loadAll()) {
      expect(tool.parameters['type'], toolName).toBe('object');
      const required = tool.parameters['required'] as string[] | undefined;
      expect(Array.isArray(required), toolName).toBe(true);
      expect(tool.description.length, toolName).toBeGreaterThan(80);
      expect(tool.output.schema['type'], toolName).toBe('object');
    }
  });

  it('refuses an argument the caller must supply rather than guessing', async () => {
    const tools = loadAll({ profileDir: profileDir() });
    await expect(run(tools, 'human_voice_scan', {})).rejects.toThrow(/text is required/);
    await expect(run(tools, 'human_voice_voice', { action: 'get' })).rejects.toThrow(/profileId is required/);
    await expect(run(tools, 'human_voice_voice', { action: 'nonsense' })).rejects.toThrow(/Unknown action/);
    await expect(run(tools, 'human_voice_profile', { action: 'build' })).rejects.toThrow(/samples is required/);
  }, 60000);
});

describe('the scan tool', () => {
  it('reports the four scores separately and names what it did not measure', async () => {
    const tools = loadAll({ profileDir: profileDir() });
    const result = await run(tools, 'human_voice_scan', {
      text: '这是一段测试文本。第二句话在这里。',
      mode: 'prose',
    });

    const scores = result['scores'] as Record<string, number>;
    expect(Object.keys(scores).sort()).toEqual([
      'antiAIScore',
      'behaviorScore',
      'preservationScore',
      'voiceScore',
    ]);
    // Without a conversation and without two texts, two of the four are
    // unmeasured, and the tool has to say so rather than report a pass.
    const unmeasured = result['unmeasured'] as string[];
    expect(unmeasured).toContain('voiceScore');
    expect(unmeasured).toContain('preservationScore');
    expect(result['note']).toMatch(/never double-count/);
  }, 60000);

  it('runs every detector and says how many', async () => {
    const tools = loadAll({ profileDir: profileDir() });
    const result = await run(tools, 'human_voice_scan', { text: '一段中文测试文本，用于确认检测器确实运行。' });
    expect((result['detectorsRun'] as string[]).length).toBeGreaterThan(5);
    expect(result['suppressedCount']).toBeGreaterThanOrEqual(0);
  }, 60000);
});

describe('the chat tool', () => {
  it('finds assistant behaviour in text with no AI vocabulary', async () => {
    const tools = loadAll({ profileDir: profileDir() });
    const result = await run(tools, 'human_voice_chat', {
      reply:
        '哈哈，确实挺离谱的！不过从另一个角度来看，这背后其实反映了整个行业正在经历的深层变化。一方面，技术的快速迭代让门槛不断降低；另一方面，用户的需求也变得越来越多元。所以与其纠结于这一个案例，不如把它看作一个信号。',
      userTurn: '刚看到那个新闻了',
    });
    const smells = result['smells'] as Array<{ id: string }>;
    expect(smells.map((smell) => smell.id)).toContain('chat.over_agreement');
    expect((result['behaviorScore'] as number)).toBeLessThan(1);
  }, 60000);

  it('says which behaviours a missing user turn made unjudgeable', async () => {
    const tools = loadAll({ profileDir: profileDir() });
    const result = await run(tools, 'human_voice_chat', { reply: '好的，我看一下。' });
    expect(result['unjudged']).toEqual(['chat.mirrors_user', 'chat.over_completeness']);
  }, 60000);
});

describe('the voice tools', () => {
  it('lists the voices this project distributes, and any generated locally', async () => {
    const tools = loadAll({ profileDir: profileDir() });
    const result = await run(tools, 'human_voice_voice', { action: 'import' });
    const profiles = result['profiles'] as Array<{ id: string }>;
    // The demonstration profile always ships. The imported author voices are generated
    // locally by `npm run voice:import` and are not distributed, so a fresh checkout has
    // the demo and a machine that has run the importer has that plus the eight.
    expect(profiles.map((profile) => profile.id)).toContain('author/plainspoken-demo');
    expect(profiles.length).toBeGreaterThanOrEqual(1);
    expect(result['note']).toMatch(/opt-in/);
  }, 60000);

  it('builds a profile from samples, saves it, and scores text against it', async () => {
    const dir = profileDir();
    const tools = loadAll({ profileDir: dir });
    const samples = [
      '今天的进展比预期慢一些，主要是接口那边还没对齐。明天上午再推一次。',
      '这个方案我看了，整体没问题，只是第三节的结论下得太满了，我改了两句。',
      '刚跟产品那边过了一遍，砍掉两个不重要的功能，先上线主干流程。',
    ];

    const built = await run(tools, 'human_voice_profile', {
      action: 'save',
      scope: 'chat',
      language: 'zh',
      samples,
    });
    expect((built['profile'] as { id: string }).id).toBe('user/chat');
    expect((built['dimensionsMeasured'] as string[]).length).toBeGreaterThan(0);

    const listed = await run(tools, 'human_voice_voice', { action: 'list' });
    expect((listed['profiles'] as Array<{ id: string }>).map((entry) => entry.id)).toEqual(['user/chat']);

    const scored = await run(tools, 'human_voice_voice', {
      action: 'score',
      profileId: 'user/chat',
      mode: 'chat',
      text: '这个我看了，整体没问题，只是第二段有点啰嗦，我删了几句。',
    });
    expect(scored['voiceScore']).toBeGreaterThan(0);
    expect((scored['dimensions'] as unknown[]).length).toBeGreaterThan(0);
  }, 120000);

  it('refuses to score against a profile that does not exist', async () => {
    const tools = loadAll({ profileDir: profileDir() });
    await expect(
      run(tools, 'human_voice_voice', { action: 'score', profileId: 'user/nope', text: 'x' }),
    ).rejects.toThrow(/No profile user\/nope/);
  }, 60000);

  it('reports an empty store as empty rather than as a failure', async () => {
    const tools = loadAll({ profileDir: profileDir() });
    const listed = await run(tools, 'human_voice_voice', { action: 'list' });
    expect(listed['profiles']).toEqual([]);
    expect(listed['note']).toMatch(/No profiles/);
  }, 60000);
});

describe('the plugin helpers', () => {
  it('resolves a profile for a mode, and reports nothing when none fits', () => {
    const voices = loadImportedAuthorVoices(ROOT);
    expect(voices.map((profile) => profile.id)).toContain('author/plainspoken-demo');
    // Every voice profile is writing-kind, so chat resolves to none of them.
    expect(scopedProfileId(voices, 'chat')).toBeUndefined();
    // Prose resolves to a writing profile; which one depends on what is loaded, so the
    // assertion is about the kind rather than about a name.
    const prose = scopedProfileId(voices, 'prose');
    expect(prose, 'prose should resolve to a writing profile').toBeDefined();
  });

  it('puts learned profiles in one documented place', () => {
    expect(defaultProfileDir('/tmp/x')).toBe(join('/tmp/x', 'profiles'));
  });

  it('refuses to serve author voices that carry a hazard', async () => {
    // The guard that catches a hand edit to a generated file, which `voice:check` cannot
    // see at call time.
    const { findHazards } = await import('../src/voice/adaptation/index.js');
    for (const profile of loadImportedAuthorVoices(ROOT)) {
      expect(findHazards(profile), profile.id).toEqual([]);
    }
  });
});

describe('the docs the plugin points at', () => {
  it('describes every tool the plugin registers', async () => {
    const { readFileSync } = await import('node:fs');
    const doc = readFileSync(join(ROOT, 'docs', 'dsh-plugin.md'), 'utf8');
    for (const toolName of loadAll().keys()) {
      expect(doc, toolName).toContain(toolName);
    }
  });

  it('names the profile-patch entry point, so the two cannot drift', async () => {
    const { readFileSync } = await import('node:fs');
    const patch = readFileSync(join(ROOT, 'cordis.patch.yml'), 'utf8');
    expect(patch).toContain('name: human-voice-suite/plugin');
    expect(toolByName('human_voice_scan')?.summary).toMatch(/canonical rules/);
  });
});
