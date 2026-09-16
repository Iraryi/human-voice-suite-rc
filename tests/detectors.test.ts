/**
 * The Phase 2 detector families.
 *
 * Each family is tested against text that should and should not fire, because a
 * detector that only ever fires is indistinguishable from one that works until
 * it is pointed at real writing.
 */

import { describe, expect, it } from 'vitest';

import { buildRegistryFromExtractions } from '../src/rules/canonical/load.js';
import { createDefaultDetectors, defaultDetectorIds } from '../src/detector/registry.js';
import { scan } from '../src/detector/scan.js';
import { familyForCategory } from '../src/detector/shared/helpers.js';
import {
  DASH_PER_THOUSAND_LIMIT,
  MIN_BURSTINESS,
  MIN_SENTENCES_FOR_RHYTHM,
  createRhythmDetectors,
} from '../src/detector/rhythm/index.js';
import { createStructuralDetectors } from '../src/detector/structural/index.js';
import { createChineseDetectors, MIN_CJK_CHARS } from '../src/detector/chinese/index.js';
import { createEnglishDetectors, MIN_WORDS_FOR_PASSIVE } from '../src/detector/english/index.js';
import { createStylometryDetectors, MIN_WORDS } from '../src/detector/stylometry/index.js';
import type { Detector, DetectionContext } from '../src/detector/types.js';
import type { VoiceProfile } from '../src/voice/types.js';

const build = await buildRegistryFromExtractions();
const registry = build.registry;

async function run(detectors: readonly Detector[], text: string, language = 'en') {
  const results: string[] = [];
  for (const detector of detectors) {
    if (!detector.languages.includes(language)) continue;
    const context: DetectionContext = {
      language: language as 'en',
      mode: 'prose',
      rules: registry,
    };
    const produced = await detector.detect(text, context);
    for (const finding of produced) results.push(finding.canonicalRuleId ?? finding.ruleId);
  }
  return results;
}

describe('the detector registry', () => {
  it('registers one detector per family that is implemented', () => {
    expect(defaultDetectorIds()).toEqual([
      'lexical.watched_phrases',
      'structural.templates',
      'structural.document_shape',
      'rhythm.distribution',
      'chinese.typography',
      'chinese.translationese',
      'english.construction',
      'stylometry.statistical',
      'stylometry.voice_distance',
      'stylometry.fingerprint_features',
      'assistant.smells',
    ]);
  });

  it('declares a family that exists on every detector', () => {
    const families = new Set([
      'structural',
      'lexical',
      'rhythm',
      'assistant',
      'stylometry',
      'chinese',
      'english',
    ]);
    for (const detector of createDefaultDetectors()) {
      expect(families, detector.id).toContain(detector.family);
      expect(detector.description.length, detector.id).toBeGreaterThan(30);
      expect(detector.status, detector.id).toBe('ready');
    }
  });
});

describe('familyForCategory', () => {
  it('sends formatting rules to the structural family', () => {
    // The two taxonomies are deliberately not identical.
    expect(familyForCategory('formatting')).toBe('structural');
    expect(familyForCategory('structural')).toBe('structural');
  });

  it('sends chat rules to the assistant family', () => {
    expect(familyForCategory('chat')).toBe('assistant');
    expect(familyForCategory('assistant')).toBe('assistant');
  });

  it('falls back rather than throwing on an unknown category', () => {
    expect(familyForCategory('nonsense')).toBe('structural');
  });
});

describe('rhythm detector', () => {
  const detectors = createRhythmDetectors();

  it('fires on sentence lengths that do not vary', async () => {
    const uniform = [
      'The system reads the input file.',
      'The parser checks the token stream.',
      'The writer emits a result log.',
      'The server sends a final response.',
      'The client shows a status line.',
      'The user reads the output text.',
    ].join(' ');
    const rules = await run(detectors, uniform);
    expect(rules).toContain('rhythm.uniform_rhythm');
  });

  it('does not fire on prose with varied sentence lengths', async () => {
    const varied = [
      'It failed.',
      'The reason turned out to be a stale cache entry that had survived three deploys because nobody had restarted the worker, which is a story for another day.',
      'We fixed it.',
      'Nobody wrote a test.',
      'That changed the following week, after the incident review produced four action items and exactly one of them was ever completed, which everyone knew at the time.',
    ].join(' ');
    const rules = await run(detectors, varied);
    expect(rules).not.toContain('rhythm.uniform_rhythm');
  });

  it('needs enough sentences before it will judge rhythm', async () => {
    const rules = await run(detectors, 'Short. Also short. Still short.');
    expect(rules).not.toContain('rhythm.uniform_rhythm');
    expect(MIN_SENTENCES_FOR_RHYTHM).toBeGreaterThan(3);
  });

  it('fires on dash density and not on a single dash', async () => {
    const heavy = `${'This clause runs on \u2014 and on \u2014 and further \u2014 before it stops. '.repeat(6)}`;
    expect(await run(detectors, heavy)).toContain('rhythm.dash_overuse');

    const light = 'The report covers one topic \u2014 and stops there.';
    expect(await run(detectors, light)).not.toContain('rhythm.dash_overuse');
    expect(DASH_PER_THOUSAND_LIMIT).toBeGreaterThan(0);
  });

  it('fires on consecutive sentences opening the same way', async () => {
    const repeated = [
      'The parser reads the file.',
      'The parser checks the tokens.',
      'The parser writes a tree.',
      'The parser returns a result.',
    ].join(' ');
    const rules = await run(detectors, repeated);
    expect(rules).toContain('rhythm.repeated_openings');
  });

  it('requires the triad reflex to be a habit, not an instance', async () => {
    const once = 'We shipped the parser, the writer, and the reader.';
    expect(await run(detectors, once)).not.toContain('rhythm.forced_triad');

    const thrice = [
      'We shipped the parser, the writer, and the reader.',
      'Then we fixed the lexer, the grammar, and the printer.',
      'Finally we tested the input, the output, and the errors.',
    ].join(' ');
    expect(await run(detectors, thrice)).toContain('rhythm.forced_triad');
  });

  it('reports the measurement, not just a verdict', async () => {
    const uniform = Array.from({ length: 6 }, () => 'The parser reads the file.').join(' ');
    const findings = await detectors[0]!.detect(uniform, {
      language: 'en',
      mode: 'prose',
      rules: registry,
    });
    const rhythm = [...findings].find((f) => f.canonicalRuleId === 'rhythm.uniform_rhythm')!;
    expect(rhythm.message).toMatch(/length variation of \d/);
    expect(rhythm.message).toMatch(String(MIN_BURSTINESS));
  });
});

describe('structural detector', () => {
  const detectors = createStructuralDetectors();

  it('fires on bold used as decoration', async () => {
    const bold = [
      '**Alpha:** the first thing.',
      '**Beta:** the second thing.',
      '**Gamma:** the third thing.',
      '**Delta:** the fourth thing.',
      '**Epsilon:** the fifth thing.',
    ].join('\n');
    expect(await run(detectors, bold)).toContain('formatting.bold_decoration');
  });

  it('fires on Title Case headings', async () => {
    const text = [
      '## Strategic Negotiations And Global Partnerships',
      '',
      'Some prose about negotiation that runs on for a while without saying much.',
      '',
      '## Operational Excellence And Delivery Quality',
      '',
      'More prose, similarly uneventful, filling the space beneath the heading.',
    ].join('\n');
    expect(await run(detectors, text)).toContain('formatting.decorative_headings');
  });

  it('fires on a heading restated in the sentence beneath it', async () => {
    const text = [
      '## Performance Benchmarking Results',
      '',
      'Performance benchmarking results are shown below in the accompanying table.',
      '',
      '## Memory Usage Characteristics',
      '',
      'Memory usage characteristics matter a great deal when the workload grows large.',
    ].join('\n');
    expect(await run(detectors, text)).toContain('structural.heading_restated');
  });

  it('fires on repeated one-line paragraphs after long ones', async () => {
    const long =
      'The first paragraph runs on at some length, explaining the situation in considerable detail, covering the background, the constraints, the options that were considered, and the reasons each was set aside before settling on the approach that was eventually taken.';
    const text = [long, 'That was the real win.', '', long, 'That was the real win.'].join('\n\n');
    expect(await run(detectors, text)).toContain('structural.one_line_closer');
  });

  it('does not fire on plain prose with no structure', async () => {
    const plain =
      'The system reads a file and returns a result. It does so quickly. There is nothing else to say about it.';
    expect(await run(detectors, plain)).toEqual([]);
  });
});

describe('chinese detector', () => {
  const detectors = createChineseDetectors();

  it('fires when half-width marks terminate Chinese sentences', async () => {
    // The tell is a half-width mark used *inside* Chinese, not merely the
    // presence of both widths. Chinese technical writing contains whole English
    // sentences ending in `.` and that is not a defect.
    const chinese = '\u8fd9\u662f\u4e00\u6bb5\u4e2d\u6587. \u5b83\u6709\u5f88\u591a\u53e5\u5b50. \u6807\u70b9\u6df7\u7528\u4e86. ';
    const text = `${chinese.repeat(4)}\u8fd9\u662f\u4e00\u6bb5\u4e2d\u6587\u3002\u5b83\u4e5f\u6709\u5168\u89d2\u53e5\u53f7\u3002`;
    const rules = await run(detectors, text, 'zh');
    expect(rules).toContain('chinese.punctuation_width');
  });

  it('does not fire on consistent full-width punctuation', async () => {
    const text = '\u8fd9\u662f\u4e00\u6bb5\u4e2d\u6587\u3002\u5b83\u7684\u6807\u70b9\u4e00\u81f4\u3002\u6ca1\u6709\u6df7\u7528\u3002'.repeat(12);
    expect(await run(detectors, text, 'zh')).not.toContain('chinese.punctuation_width');
  });

  it('does not fire on Chinese that merely quotes English sentences', async () => {
    // English sentences are not a punctuation defect, and the first version of
    // this detector flagged exactly that.
    const text = `${'\u8fd9\u662f\u4e00\u6bb5\u4e2d\u6587\u3002\u5b83\u6709\u5f88\u591a\u53e5\u5b50\u3002'.repeat(6)}And here is an English sentence. Another one follows here.`;
    expect(await run(detectors, text, 'zh')).not.toContain('chinese.punctuation_width');
  });

  it('declines a sample too short to measure', async () => {
    expect(await run(detectors, '\u77ed\u53e5\u3002', 'zh')).toEqual([]);
    expect(MIN_CJK_CHARS).toBeGreaterThan(20);
  });

  it('does not run on English text at all', async () => {
    const english = 'This is English. It is not Chinese at all. '.repeat(10);
    expect(await run(detectors, english, 'en')).toEqual([]);
  });
});

describe('english detector', () => {
  const detectors = createEnglishDetectors();

  it('fires on a passive-heavy passage', async () => {
    const passive = Array.from(
      { length: 8 },
      (_, i) =>
        `The report was written by the team and the findings were reviewed by the board before the summary was approved and the changes were made in stage ${i}.`,
    ).join(' ');
    expect(await run(detectors, passive)).toContain('lexical.passive_and_subjectless');
  });

  it('declines a sample below the minimum length', async () => {
    const short = 'It was written by the team. The draft was reviewed.';
    expect(await run(detectors, short)).toEqual([]);
    expect(MIN_WORDS_FOR_PASSIVE).toBeGreaterThan(50);
  });
});

describe('stylometry detector', () => {
  const detectors = createStylometryDetectors();

  it('reports nothing without a voice profile, rather than inventing a baseline', async () => {
    const text = 'The parser reads the file. It returns a tree. The caller walks the tree and writes a report.';
    const voice = detectors.find((d) => d.id === 'stylometry.voice_distance')!;
    const findings = await voice.detect(text, { language: 'en', mode: 'prose', rules: registry });
    expect([...findings]).toEqual([]);
  });

  it('measures distance in the profile’s own spread once one is supplied', async () => {
    const text = Array.from(
      { length: 12 },
      () => 'The parser reads the input file and returns a tree for the caller to walk.',
    ).join(' ');

    const profile: VoiceProfile = {
      schemaVersion: '1.0.0',
      id: 'user/technical',
      owner: 'user',
      kind: 'writing',
      languages: ['en'],
      sources: [],
      writing: {
        sentenceLength: { mean: 6, median: 6, stdDev: 1.2, min: 4, max: 9, sampleCount: 40 },
        paragraphLength: { mean: 3, median: 3, stdDev: 1, min: 1, max: 6, sampleCount: 40 },
        burstiness: 0.9,
        punctuationRates: {},
        signatureVocabulary: [],
        avoidVocabulary: [],
        toneMarkers: [],
        rhetoricalDevices: [],
      },
    };

    const voice = detectors.find((d) => d.id === 'stylometry.voice_distance')!;
    const findings = await voice.detect(text, {
      language: 'en',
      mode: 'prose',
      rules: registry,
      voiceProfile: profile,
    });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.message).toMatch(/standard deviations/);
  });

  it('declines a statistical sample below the minimum it will measure over', async () => {
    const statistical = detectors.find((d) => d.id === 'stylometry.statistical')!;
    const short = 'The cat sat. The cat ran. The cat slept.';
    const findings = await statistical.detect(short, {
      language: 'en',
      mode: 'prose',
      rules: registry,
    });
    expect([...findings]).toEqual([]);
    expect(MIN_WORDS).toBeGreaterThan(50);
  });

  it('is English-only, because its sentence splitter is', async () => {
    const statistical = detectors.find((d) => d.id === 'stylometry.statistical')!;
    const chinese = '\u8fd9\u662f\u7b2c\u4e00\u53e5\u3002\u8fd9\u662f\u7b2c\u4e8c\u53e5\u3002'.repeat(60);
    const findings = await statistical.detect(chinese, {
      language: 'zh',
      mode: 'prose',
      rules: registry,
    });
    expect([...findings]).toEqual([]);
  });
});

describe('the whole stack together', () => {
  it('finds both the vocabulary and the shape of a machine-written English passage', async () => {
    const text = [
      '# Strategic Negotiations And Global Partnerships',
      '',
      "Let's dive into how caching works. Here's what you need to know. This is not about speed but about scale.",
      '',
      "Moreover, it's crucial to delve into the intricate tapestry of modern infrastructure. The system stands as a testament to careful design, showcasing the enduring power of robust engineering.",
      '',
      'Great question! I hope this helps. Let me know if you would like me to expand on any section.',
    ].join('\n');

    const result = await scan(text, { registry, detectors: createDefaultDetectors() });
    const rules = result.canonicalFindings.map((f) => f.canonicalRuleId);

    // Vocabulary.
    expect(rules).toContain('lexical.ai_vocabulary');
    // Shape, via a template.
    expect(rules).toContain('structural.negation_contrast');
    // Assistant residue.
    expect(rules).toContain('assistant.chatbot_residue');
    // The title is exempt, but the paragraph under it is not.
    expect(rules).toContain('structural.staged_runup');
    expect(result.scores.antiAIScore).toBeLessThan(1);
  });

  it('finds the shape of a machine-written Chinese passage', async () => {
    const text = [
      '\u968f\u7740\u6280\u672f\u7684\u4e0d\u65ad\u53d1\u5c55\uff0c\u8fd9\u9879\u6539\u9769\u6210\u4e3a\u4e86\u884c\u4e1a\u7684\u91cd\u8981\u6293\u624b\u3002\u503c\u5f97\u6ce8\u610f\u7684\u662f\uff0c\u5b83\u4e0d\u4ec5\u662f\u6280\u672f\u95ee\u9898\uff0c\u66f4\u662f\u7ec4\u7ec7\u95ee\u9898\u3002',
      '',
      '\u4e00\u65b9\u9762\u6210\u672c\u4e0b\u964d\uff0c\u53e6\u4e00\u65b9\u9762\u98ce\u9669\u4e0a\u5347\u3002\u8fd9\u4e0d\u662f\u4e00\u6b21\u666e\u901a\u7684\u66f4\u65b0\uff0c\u800c\u662f\u4e00\u6b21\u91cd\u65b0\u5b9a\u4e49\u884c\u4e1a\u8fb9\u754c\u7684\u8f6c\u6298\u3002',
    ].join('\n');

    const result = await scan(text, { registry, detectors: createDefaultDetectors() });
    const rules = result.canonicalFindings.map((f) => f.canonicalRuleId);

    expect(rules).toContain('structural.negation_contrast');
    expect(rules).toContain('rhythm.forced_triad');
    expect(result.language).toBe('zh');
  });

  it('never charges one rule twice, however many detectors found it', async () => {
    const text =
      'It is crucial. It is pivotal. The framework is robust and the design is vibrant. '.repeat(2);
    const result = await scan(text, { registry, detectors: createDefaultDetectors() });
    const ids = result.canonicalFindings.map((f) => f.canonicalRuleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reports every detector that ran and every layer still unbuilt', async () => {
    const result = await scan('Some English prose to scan.', {
      registry,
      detectors: createDefaultDetectors(),
    });
    expect(result.detectorsRun.length).toBeGreaterThan(5);
    // Nothing is unbuilt any more: Phase 8 filled the last slot, which was
    // `chinese.translationese`. The assertion is now the milestone rather than
    // the placeholder it used to be.
    expect(result.detectorsPlanned).toEqual([]);
    // The Chinese detectors declare `zh` only, so they are correctly absent from
    // an English scan; `registry-load.test.ts` asserts them on Chinese input.
    expect(result.detectorsRun).not.toContain('chinese.translationese');
  });
});
