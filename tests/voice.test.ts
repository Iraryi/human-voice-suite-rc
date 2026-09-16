/**
 * The voice layer.
 *
 * Phase 6's claim is that a profile is more than "average sentence length,
 * punctuation, vocabulary": it also describes how a person behaves in a
 * conversation. These tests check the parts of that claim that can fail
 * silently — a distance that is always 1, a profile that carries a number it
 * never learned, an imported author voice that smuggles an instruction to
 * fabricate data.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  AUTHOR_VOICE_FILES,
  CRAFT_DIMENSIONS,
  EXPECTED_RULES,
  EXPECTED_TEMPLATES,
  MAX_ANTI_PATTERNS,
  MIN_ANTI_PATTERNS,
  VOICE_DIRECTORY,
  authorVoiceToProfile,
  countRemovals,
  normaliseLabel,
  parseAuthorVoice,
  splitBullets,
  splitNumberedEntries,
} from '../src/voice/import/index.js';
import {
  HAZARD_PATTERNS,
  blendDistributions,
  blendProfiles,
  detectDrift,
  findHazards,
  neutraliseAndRecord,
  neutraliseHazards,
} from '../src/voice/adaptation/index.js';
import {
  contentUnits,
  emojiCount,
  extractChatFeatures,
  extractFingerprint,
  learnFingerprint,
  paragraphLengths,
  punctuationRates,
  signatureVocabulary,
  splitMessages,
  summariseDistribution,
} from '../src/voice/fingerprint/index.js';
import {
  VoiceProfileStore,
  buildProfile,
  parseProfile,
  profileFileName,
  resolveProfileScope,
  serialiseProfile,
  validateProfile,
} from '../src/voice/profile/index.js';
import { compareToProfile, rateDistance, toleranceScore } from '../src/voice/scoring/index.js';
import { emptyDistribution } from '../src/voice/types.js';
import type { VoiceProfile } from '../src/voice/types.js';
import { sourceRef } from '../src/rules/provenance/types.js';

const temporary: string[] = [];
afterAll(() => {
  for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
});

const CACHE_VOICES = join(
  __dirname,
  '..',
  '.upstream-cache',
  'humanizer-zh',
  VOICE_DIRECTORY,
);

/**
 * The imported profiles, where a checkout has generated them.
 *
 * They are not committed, on purpose: they are prose about named living writers, and a
 * public repository that ships them is a distributor of eight named-author imitators. The
 * tests that read them run only when somebody has run `npm run voice:import` locally.
 */
const LOCAL_VOICES = join(
  __dirname,
  '..',
  '.external-corpora',
  'author-voices',
  'author-voices.generated.json',
);

const DEMO_VOICE = join(__dirname, '..', 'src', 'voice', 'import', 'demo-voice.json');

function source() {
  return [sourceRef('test/upstream', { locator: 'test', quote: 'test fixture' })];
}

function writingProfile(overrides: Partial<VoiceProfile> = {}): VoiceProfile {
  const base = buildProfile({
    id: 'user/chat',
    owner: 'user',
    kind: 'chat',
    languages: ['zh'],
    sources: source(),
    writing: {
      sentenceLength: {
        mean: 12,
        median: 12,
        stdDev: 3,
        min: 6,
        max: 20,
        sampleCount: 40,
      },
      paragraphLength: {
        mean: 30,
        median: 30,
        stdDev: 8,
        min: 10,
        max: 60,
        sampleCount: 40,
      },
      burstiness: 0.25,
      punctuationRates: { '\u3002': 40, '\uff0c': 60 },
      signatureVocabulary: ['确实', '离谱', '角度'],
      avoidVocabulary: ['赋能', '抓手'],
      toneMarkers: [],
      rhetoricalDevices: [],
    },
  });
  return { ...base, ...overrides };
}

describe('fingerprint extraction', () => {
  it('summarises a distribution with a median that handles both parities', () => {
    expect(summariseDistribution([1, 2, 3]).median).toBe(2);
    expect(summariseDistribution([1, 2, 3, 4]).median).toBe(2.5);
    expect(summariseDistribution([]).sampleCount).toBe(0);
  });

  it('measures punctuation per 1000 characters, so length does not change the habit', () => {
    const short = punctuationRates('好。');
    const long = punctuationRates('好。'.repeat(50));
    expect(short['\u3002']).toBeCloseTo(500, 3);
    expect(long['\u3002']).toBeCloseTo(500, 3);
  });

  it('builds Chinese vocabulary from bigrams rather than single characters', () => {
    const units = contentUnits('确实挺离谱的');
    expect(units).toContain('确实');
    expect(units).not.toContain('的');
  });

  it('requires a term to recur before calling it a signature', () => {
    expect(signatureVocabulary('unique once only')).toEqual([]);
    expect(signatureVocabulary('赋能 赋能 抓手 抓手').sort()).toEqual(['抓手', '赋能'].sort());
  });

  it('measures paragraph length in tokens and skips headings', () => {
    const lengths = paragraphLengths('# Title\n\none two three\n\nfour five');
    expect(lengths).toHaveLength(2);
    expect(lengths[0]).toBe(3);
  });

  it('splits a burst of messages on the separator', () => {
    const messages = splitMessages(`第一条\n<!-- msg -->\n第二条`);
    expect(messages).toEqual(['第一条', '第二条']);
    expect(splitMessages('只有一条')).toEqual(['只有一条']);
  });

  it('separates a burst of four messages from one composed paragraph', () => {
    const burst = extractChatFeatures('在呢<!-- msg -->刚看完<!-- msg -->还行<!-- msg -->你呢');
    const composed = extractChatFeatures('在呢，刚看完，还行，你呢。');
    expect(burst.burstMessaging).toBeCloseTo(0.75, 4);
    expect(composed.burstMessaging).toBe(0);
  });

  it('counts emoji and shorthand, which are the habits chat has and prose does not', () => {
    expect(emojiCount('真的吗 😂😂')).toBe(2);
    const features = extractChatFeatures('笑死 233 哈哈哈哈');
    expect(features.typoAndShorthandHabits).toContain('233');
  });

  it('learns one distribution from several samples rather than averaging averages', () => {
    const learned = learnFingerprint([
      { text: '一句话。两句话。三句话。四句话。五句话。' },
      { text: '短。更短。最短。' },
    ]);
    expect(learned?.writing.sentenceLength.sampleCount).toBe(8);
    expect(learned?.thin).toBe(false);
  });

  it('returns nothing rather than an empty profile when given nothing', () => {
    expect(learnFingerprint([])).toBeUndefined();
    expect(learnFingerprint([{ text: '   ' }])).toBeUndefined();
  });

  it('marks a short sample as thin so its distributions are not trusted', () => {
    expect(extractFingerprint('一句话。').thin).toBe(true);
  });
});

describe('profiles', () => {
  it('requires a scoped id', () => {
    const problems = validateProfile({ ...writingProfile(), id: 'chat' });
    expect(problems.some((problem) => problem.field === 'id')).toBe(true);
  });

  it('requires provenance, because an unattributed target is an unattributable result', () => {
    const problems = validateProfile({ ...writingProfile(), sources: [] });
    expect(problems.some((problem) => problem.field === 'sources')).toBe(true);
  });

  it('refuses an empty distribution that carries a mean', () => {
    const profile = writingProfile();
    const broken: VoiceProfile = {
      ...profile,
      writing: {
        ...profile.writing!,
        sentenceLength: { ...emptyDistribution(), mean: 12 },
      },
    };
    expect(validateProfile(broken).some((problem) => problem.field.includes('sentenceLength'))).toBe(
      true,
    );
  });

  it('refuses a rate outside 0..1', () => {
    const profile = writingProfile();
    const broken: VoiceProfile = {
      ...profile,
      behavior: {
        followUpQuestionRate: 1.4,
        followUpTriggers: [],
        topicOmissionRate: 0.2,
        omissionTargets: [],
        selfCorrectionStyle: [],
        topicJumpAbruptness: 0.5,
        topicJumpMarkers: [],
        agreementRate: 0.1,
        unsolicitedOfferRate: 0.05,
      },
    };
    expect(validateProfile(broken).some((problem) => problem.field.includes('followUpQuestionRate'))).toBe(
      true,
    );
  });

  it('round-trips through JSON and refuses a profile that is not one', () => {
    const profile = writingProfile();
    expect(parseProfile(serialiseProfile(profile)).id).toBe(profile.id);
    expect(() => parseProfile('{"id":"user/chat"}')).toThrow(/invalid/);
    expect(() => parseProfile('not json')).toThrow(/valid JSON/);
  });

  it('stores by id with the slash replaced, and lists what it holds', () => {
    const root = mkdtempSync(join(tmpdir(), 'hvs-voice-'));
    temporary.push(root);
    const store = new VoiceProfileStore(root);
    expect(profileFileName('user/chat')).toBe('user__chat.json');
    store.save(writingProfile());
    expect(store.get('user/chat')?.id).toBe('user/chat');
    expect(store.list().map((entry) => entry.id)).toEqual(['user/chat']);
  });

  it('resolves a profile by mode, and says why when it cannot', () => {
    const chat = writingProfile();
    const formal = buildProfile({
      id: 'user/formal',
      owner: 'user',
      kind: 'writing',
      languages: ['zh'],
      sources: source(),
    });

    expect(resolveProfileScope([chat, formal], { mode: 'chat' }).profile?.id).toBe('user/chat');
    expect(resolveProfileScope([chat, formal], { mode: 'formal' }).profile?.id).toBe('user/formal');
    const missing = resolveProfileScope([chat], { mode: 'technical' });
    expect(missing.profile).toBeUndefined();
    expect(missing.reason).toMatch(/no technical-scoped profile/);
    expect(resolveProfileScope([], { mode: 'chat' }).reason).toMatch(/no profiles/);
  });

  it('lets an explicit choice outrank the mode', () => {
    const chat = writingProfile();
    const formal = buildProfile({
      id: 'user/formal',
      owner: 'user',
      kind: 'writing',
      languages: ['zh'],
      sources: source(),
    });
    expect(
      resolveProfileScope([chat, formal], { mode: 'chat', prefer: ['user/formal'] }).profile?.id,
    ).toBe('user/formal');
  });
});

describe('voice scoring', () => {
  it('treats a habit as a range, not a point', () => {
    expect(toleranceScore(0, 3)).toBe(1);
    expect(toleranceScore(3, 3)).toBe(1);
    expect(toleranceScore(6, 3)).toBeCloseTo(0.5, 6);
    expect(toleranceScore(30, 3)).toBeLessThan(0.2);
  });

  it('measures two punctuation distributions in 0..1 regardless of scale', () => {
    expect(rateDistance({ a: 10 }, { a: 10 }).distance).toBe(0);
    expect(rateDistance({ a: 10 }, { b: 10 }).distance).toBe(1);
    expect(rateDistance({ a: 10, b: 10 }, { a: 10, b: 10 }).shared).toBe(2);
    expect(rateDistance({}, {}).distance).toBe(0);
  });

  it('measures the dimensions a profile supports and names the ones it cannot', () => {
    const comparison = compareToProfile(
      '这段话写得确实挺离谱的，不过从另一个角度来看。这里还有第二句话。第三句话在这里。',
      writingProfile(),
      { language: 'zh', mode: 'chat' },
    );
    expect(comparison.unmeasured).toBe(false);
    const names = comparison.dimensions.filter((d) => d.measured).map((d) => d.name);
    expect(names).toContain('sentenceLength');
    expect(names).toContain('punctuation');
    expect(comparison.voiceScore).toBeGreaterThan(0);
    expect(comparison.voiceScore).toBeLessThanOrEqual(1);
    expect(comparison.rationale.score).toBe('voiceScore');
  });

  it('penalises the terms a profile records as avoided', () => {
    const clean = compareToProfile('这是一句普通的话。', writingProfile(), { mode: 'chat' });
    const avoided = compareToProfile('我们要赋能业务，找到抓手。', writingProfile(), { mode: 'chat' });
    const dimensionOf = (text: ReturnType<typeof compareToProfile>): number =>
      text.dimensions.find((d) => d.name === 'avoidVocabulary')?.score ?? 1;
    expect(dimensionOf(clean)).toBe(1);
    expect(dimensionOf(avoided)).toBeLessThan(1);
  });

  it('reports unmeasured rather than a perfect match when nothing can be compared', () => {
    const empty = buildProfile({
      id: 'user/prose',
      owner: 'user',
      kind: 'writing',
      languages: ['zh'],
      sources: source(),
      writing: {
        ...writingProfile().writing!,
        sentenceLength: emptyDistribution(),
        paragraphLength: emptyDistribution(),
        punctuationRates: {},
        signatureVocabulary: [],
        avoidVocabulary: [],
      },
    });
    const comparison = compareToProfile('这是一句话。', empty, { mode: 'prose' });
    expect(comparison.unmeasured).toBe(true);
    expect(comparison.voiceScore).toBe(1);
    expect(comparison.rationale.summary).toMatch(/Not measured/);
  });

  it('excludes the chat dimensions for a prose request', () => {
    const profile = writingProfile();
    const comparison = compareToProfile('一段散文。第二句。第三句。', profile, { mode: 'prose' });
    expect(comparison.dimensions.some((dimension) => dimension.name === 'chatReplyLength')).toBe(
      false,
    );
  });
});

describe('hazard neutralisation', () => {
  it('catches the exact instruction the inventory flagged', () => {
    // Verbatim from ai-zixun/humanizer-zh references/voices/lixiaolai.md rule 6.
    const hazard =
      'NUMBERS must be precise. Never write "很多人", "近年来", "大约". If you don\'t have a real number, invent a plausible specific one rather than hedging.';
    const pattern = HAZARD_PATTERNS.find((entry) => entry.id === 'fabricated-data');
    expect(pattern?.pattern.test(hazard)).toBe(true);
  });

  it('catches a persona claim without catching ordinary craft instruction', () => {
    const persona = HAZARD_PATTERNS.find((entry) => entry.id === 'persona-claim');
    expect(persona?.pattern.test('You are writing in the voice of 冯唐 (Feng Tang).')).toBe(true);
    expect(persona?.pattern.test('Write a short verdict sentence instead of a summary.')).toBe(false);
  });

  it('removes the evil and keeps the craft', () => {
    const profile = buildProfile({
      id: 'author/test',
      owner: 'test/upstream',
      kind: 'writing',
      languages: ['zh'],
      sources: source(),
      writing: {
        ...writingProfile().writing!,
        rhetoricalDevices: ['Open with a concrete number.'],
      },
      directives: [
        'Voice rule: If you do not have a real number, invent a plausible specific one.',
        'Voice rule: Keep paragraphs to one to three sentences.',
      ],
    });

    const { profile: cleaned, removed } = neutraliseHazards(profile);
    expect(removed.map((entry) => entry.hazard)).toEqual(['fabricated-data']);
    expect(cleaned.directives).toHaveLength(1);
    expect(cleaned.writing?.rhetoricalDevices).toEqual(['Open with a concrete number.']);
  });

  it('is idempotent, so the pipeline can be re-run', () => {
    const once = neutraliseAndRecord(
      buildProfile({
        id: 'author/test',
        owner: 'test/upstream',
        kind: 'writing',
        languages: ['zh'],
        sources: source(),
        directives: ['invent a plausible specific number when you have none'],
      }),
    );
    expect(countRemovals(once)).toBe(1);
    const twice = neutraliseAndRecord(once);
    expect(twice.directives).toBeUndefined();
    expect(findHazards(twice)).toEqual([]);
    expect(countRemovals(twice)).toBe(1);
  });
});

describe('blending and drift', () => {
  it('pools two distributions with the law of total variance', () => {
    const blended = blendDistributions(
      { mean: 10, median: 10, stdDev: 1, min: 8, max: 12, sampleCount: 10 },
      { mean: 30, median: 30, stdDev: 1, min: 28, max: 32, sampleCount: 10 },
      0.5,
    );
    expect(blended.mean).toBeCloseTo(20, 4);
    // A blend of two very different writers is not a consistent writer.
    expect(blended.stdDev).toBeGreaterThan(9);
    expect(blended.sampleCount).toBe(20);
  });

  it('returns the other side unchanged when one side has no samples', () => {
    const only = { mean: 5, median: 5, stdDev: 1, min: 4, max: 6, sampleCount: 3 };
    expect(blendDistributions(emptyDistribution(), only, 0.5)).toEqual(only);
  });

  it('refuses to blend across scopes, because that would describe nobody', () => {
    const chat = writingProfile();
    const formal = buildProfile({
      id: 'user/formal',
      owner: 'user',
      kind: 'writing',
      languages: ['zh'],
      sources: source(),
    });
    expect(() => blendProfiles(chat, formal, { id: 'user/blend' })).toThrow(/different scopes/);

    const english = buildProfile({
      id: 'user/en-chat',
      owner: 'user',
      kind: 'chat',
      languages: ['en'],
      sources: source(),
    });
    expect(() => blendProfiles(chat, english, { id: 'user/blend' })).toThrow(/no shared language/);
  });

  it('blends within a scope and keeps both provenances', () => {
    const a = writingProfile();
    const b = { ...writingProfile(), sources: [sourceRef('other/upstream', { locator: 'x' })] };
    const blended = blendProfiles(a, b, { id: 'user/blend', weightA: 0.5 });
    expect(blended.sources).toHaveLength(2);
    expect(blended.writing?.signatureVocabulary).toEqual(a.writing?.signatureVocabulary);
  });

  it('detects drift beyond two standard deviations and says nothing when it cannot measure', () => {
    const baseline = writingProfile();
    const moved: VoiceProfile = {
      ...baseline,
      writing: {
        ...baseline.writing!,
        sentenceLength: { mean: 40, median: 40, stdDev: 3, min: 30, max: 50, sampleCount: 40 },
      },
    };
    const drift = detectDrift(baseline, moved);
    expect(drift.drifted).toBe(true);
    expect(drift.summary).toMatch(/moved/);

    const nothing = detectDrift(
      buildProfile({ id: 'user/a', owner: 'user', kind: 'chat', languages: ['zh'], sources: source() }),
      buildProfile({ id: 'user/b', owner: 'user', kind: 'chat', languages: ['zh'], sources: source() }),
    );
    expect(nothing.drifted).toBe(false);
    expect(nothing.summary).toMatch(/cannot be measured/);
  });
});

describe('the author voice parser', () => {
  const fixture = [
    '# 声音：测试作者 (Cè Shì)',
    '',
    '适用：测试用。',
    '启用方式：手动选择。',
    '',
    '注意：默认中立。',
    '',
    '---',
    '',
    'You are writing in the voice of 测试作者.',
    '',
    '## Persona (who you are when writing)',
    '',
    'A person who writes tests.',
    '',
    '## Quick Reference: Sentence Templates',
    '',
    ...Array.from({ length: EXPECTED_TEMPLATES }, (_, i) => `${i + 1}. "模板${i + 1}" — a template`),
    '',
    '## Voice rules',
    '',
    ...Array.from(
      { length: EXPECTED_RULES },
      (_, i) => `${i + 1}. **Paragraph brevity.** Rule number ${i + 1}.`,
    ),
    '',
    '## Anti-patterns — things this author would NEVER do:',
    '',
    '- Never hedge',
    '- Never summarise at the end',
    '- Never use emojis',
    '- Never use passive voice',
    '- Never open with 众所周知',
    '- Never pad',
    '- Never over-explain',
    '- Never use citation format',
    '',
  ].join('\n');

  it('requires the container shape rather than trusting it', () => {
    const parsed = parseAuthorVoice(fixture, 'test');
    expect(parsed.templates).toHaveLength(EXPECTED_TEMPLATES);
    expect(parsed.rules).toHaveLength(EXPECTED_RULES);
    expect(parsed.name).toBe('测试作者');
    expect(parsed.pinyin).toBe('Cè Shì');
    expect(parsed.appliesTo).toBe('测试用。');
    expect(parsed.neutrality).toContain('默认中立');
  });

  it('fails loudly when a file loses a template, rather than importing a short list', () => {
    const short = fixture.replace('8. "模板8" — a template\n', '');
    expect(() => parseAuthorVoice(short, 'test')).toThrow(/expected 8 templates, found 7/);
  });

  it('fails loudly when the headings are not the four it knows', () => {
    const renamed = fixture.replace('## Voice rules', '## Style rules');
    expect(() => parseAuthorVoice(renamed, 'test')).toThrow(/no Voice section/);
  });

  it('matches headings case-insensitively, which three of the eight files need', () => {
    const lowercase = fixture.replace('## Voice rules', '## voice rules');
    expect(() => parseAuthorVoice(lowercase, 'test')).not.toThrow();
  });

  it('maps a label by keyword, and refuses to invent a dimension for one that does not', () => {
    expect(normaliseLabel('Paragraph brevity.')).toBe('brevity');
    expect(normaliseLabel('MIX CLASSICAL AND VULGAR')).toBe('register-mixing');
    expect(normaliseLabel('SENSORY DETAILS')).toBe('concreteness');
    expect(normaliseLabel('"再说一遍" for emphasis')).toBeUndefined();
    for (const dimension of CRAFT_DIMENSIONS) expect(dimension).toMatch(/^[a-z-]+$/);
  });

  it('splits numbered entries and bullets, keeping indented continuations', () => {
    expect(splitNumberedEntries(['1. first', '   continued', '2. second'])).toEqual([
      'first continued',
      'second',
    ]);
    expect(splitBullets(['- one', '  two', '- three'])).toEqual(['one two', 'three']);
  });

  it('turns a parsed voice into craft, not a persona', () => {
    const { profile, unmappedLabels } = authorVoiceToProfile(parseAuthorVoice(fixture, 'test'), {
      revision: 'abc123',
      licence: 'MIT',
    });
    expect(profile.id).toBe('author/test');
    // No sample passage exists in the source, so no distribution may be invented.
    expect(profile.writing?.sentenceLength.sampleCount).toBe(0);
    expect(profile.writing?.paragraphLength.sampleCount).toBe(0);
    expect(profile.writing?.rhetoricalDevices).toHaveLength(EXPECTED_TEMPLATES);
    expect(profile.directives?.length).toBe(EXPECTED_RULES + 8);
    expect(profile.writing?.toneMarkers).toContain('craft:brevity');
    expect(unmappedLabels).toEqual([]);
    // The persona sentence is not imported anywhere.
    expect(JSON.stringify(profile)).not.toContain('You are writing in the voice of');
    expect(profile.sources.length).toBeGreaterThanOrEqual(3);
  });

  it('reports a label it cannot map instead of guessing at one', () => {
    const withOdd = fixture.replace(
      '**Paragraph brevity.** Rule number 1.',
      '**"再说一遍" for emphasis.** Rule number 1.',
    );
    const { unmappedLabels } = authorVoiceToProfile(parseAuthorVoice(withOdd, 'test'));
    expect(unmappedLabels).toContain('"再说一遍" for emphasis');
  });

  it('declares the eight voices the upstream ships, and no others', () => {
    expect(AUTHOR_VOICE_FILES).toHaveLength(8);
    expect(AUTHOR_VOICE_FILES.map((file) => file.key)).toEqual([
      'fengtang',
      'hefan',
      'helaoshi',
      'lishanglong',
      'liuzichao',
      'lixiaolai',
      'luozhenyu',
      'wujun',
    ]);
  });
});

describe.runIf(existsSync(LOCAL_VOICES))('the locally generated author voices', () => {
  const committed = LOCAL_VOICES;

  it('are in sync with the parser, so the artefact and the code cannot disagree', async () => {
    const { importAuthorVoices } = await import('../src/voice/import/index.js');
    const report = importAuthorVoices({
      voiceDirectory: CACHE_VOICES,
      revision: 'test',
      licence: 'MIT',
    });
    const file = JSON.parse(readFileSync(committed, 'utf8')) as {
      profiles: VoiceProfile[];
    };
    expect(file.profiles).toHaveLength(8);
    expect(file.profiles.map((profile) => profile.id)).toEqual(
      report.profiles.map((profile) => profile.id),
    );
    // Compare the craft, ignoring the revision the file was pinned at.
    const craft = (profile: VoiceProfile): unknown => ({
      directives: profile.directives,
      toneMarkers: profile.writing?.toneMarkers,
      devices: profile.writing?.rhetoricalDevices,
    });
    expect(file.profiles.map(craft)).toEqual(report.profiles.map(craft));
  });

  it('carry no hazard, including the one the inventory flagged', () => {
    const file = JSON.parse(readFileSync(committed, 'utf8')) as {
      profiles: VoiceProfile[];
      removals: ReadonlyArray<{ profile: string; count: number }>;
    };
    for (const profile of file.profiles) {
      expect(findHazards(profile), profile.id).toEqual([]);
      expect(profile.id).toMatch(/^author\//);
      expect(profile.languages).toEqual(['zh']);
    }
    expect(file.removals.map((entry) => entry.profile)).toContain('author/lixiaolai');
    const lixiaolai = file.profiles.find((profile) => profile.id === 'author/lixiaolai');
    expect(lixiaolai?.notes).toMatch(/Hazards removed at import \(1\)/);
  });

  it('record the upstream revision and licence they were generated from', () => {
    const file = JSON.parse(readFileSync(committed, 'utf8')) as {
      generatedFrom: { upstream: string; revision: string; licence: string; files: string[] };
    };
    expect(file.generatedFrom.upstream).toBe('ai-zixun/humanizer-zh');
    expect(file.generatedFrom.revision).toMatch(/^[0-9a-f]{40}$/);
    expect(file.generatedFrom.licence).toBe('MIT');
    expect(file.generatedFrom.files).toHaveLength(8);
  });

  it('learns no statistical feature from prose that contains no sample passage', () => {
    const file = JSON.parse(readFileSync(committed, 'utf8')) as {
      profiles: VoiceProfile[];
    };
    for (const profile of file.profiles) {
      expect(profile.writing?.sentenceLength.sampleCount, profile.id).toBe(0);
      expect(profile.writing?.burstiness, profile.id).toBe(0);
      expect(profile.writing?.signatureVocabulary, profile.id).toEqual([]);
    }
  });

  it('keeps the upstream neutrality preamble on every profile', () => {
    const file = JSON.parse(readFileSync(committed, 'utf8')) as {
      profiles: VoiceProfile[];
    };
    for (const profile of file.profiles) {
      expect(profile.notes, profile.id).toMatch(/neutrality preamble/);
    }
  });
});

describe('the author voices this project distributes', () => {
  const demo = JSON.parse(readFileSync(DEMO_VOICE, 'utf8')) as VoiceProfile;

  it('ships a demonstration profile that imitates nobody', () => {
    expect(demo.id).toBe('author/plainspoken-demo');
    expect(demo.owner).toBe('human-voice-suite');
    expect(demo.sources[0]?.upstream).toBe('human-voice-suite');
    expect(demo.sources[0]?.note).toMatch(/imitates nobody/);
    expect(demo.directives?.length ?? 0).toBeGreaterThan(5);
    expect(findHazards(demo)).toEqual([]);
  });

  it('learns no statistical feature from a profile that carries no sample passage', () => {
    expect(demo.writing?.sentenceLength.sampleCount).toBe(0);
    expect(demo.writing?.burstiness).toBe(0);
    expect(demo.writing?.signatureVocabulary).toEqual([]);
  });

  it('commits none of the imported profiles', () => {
    // The release boundary, as a test: this file was committed once and had to be removed,
    // and the check is here so that a later commit cannot quietly put it back.
    expect(existsSync(join(__dirname, '..', 'src', 'voice', 'import', 'author-voices.generated.json'))).toBe(
      false,
    );
  });
});

describe('profiles in the registry shape', () => {
  it('uses the same schema version as the types module', async () => {
    const { VOICE_PROFILE_SCHEMA_VERSION } = await import('../src/voice/types.js');
    expect(writingProfile().schemaVersion).toBe(VOICE_PROFILE_SCHEMA_VERSION);
  });

  it('summarises what a profile holds without exposing its contents', async () => {
    const { summariseProfile } = await import('../src/voice/types.js');
    const summary = summariseProfile(writingProfile());
    expect(summary).toEqual({
      id: 'user/chat',
      owner: 'user',
      kind: 'chat',
      languages: ['zh'],
      hasWriting: true,
      hasChat: false,
      hasBehavior: false,
      exampleCount: 0,
    });
  });
});
