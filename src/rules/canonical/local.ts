/**
 * Canonical rules that belong to this project.
 *
 * Not every rule comes from an upstream. The stylometry distance measurement is
 * ours, and the ten assistant smells are ours, so neither can arrive through an
 * adapter — there is no repository to parse them from.
 *
 * They live here rather than in the Phase 1 seed because the seed exists to test
 * the collapse mechanism quickly, and these need to be in the production
 * registry that the detectors read. Every one carries
 * `upstream: 'human-voice-suite/local'`, so `isLocalOnly` returns true and a
 * provenance report can never present our work as inherited.
 *
 * The ten smells are declared but not yet detectable: their detection is Phase 5.
 * They are registered now so that a finding and a taxonomy entry resolve to the
 * same rule rather than to two, which is the mistake the signature vocabulary
 * exists to prevent.
 */

import { ASSISTANT_SMELLS } from '../../behavior/types.js';
import { LOCAL_UPSTREAM } from '../provenance/types.js';
import { signatureSpec } from './signatures.js';
import type { CanonicalRule } from '../types.js';

function localRule(
  id: string,
  overrides: Partial<CanonicalRule> & Pick<CanonicalRule, 'description' | 'rewriteGuidance'>,
): CanonicalRule {
  const spec = signatureSpec(id);
  return {
    id,
    category: spec?.category ?? 'structural',
    languages: spec ? [...spec.languages] : ['en', 'zh'],
    severity: 3,
    sources: [{ upstream: LOCAL_UPSTREAM, ruleId: id, locator: 'src/rules/canonical/local.ts' }],
    aliases: [],
    status: 'canonical',
    ...overrides,
  };
}

export const LOCAL_RULES: readonly CanonicalRule[] = [
  localRule('stylometry.distribution_distance', {
    severity: 3,
    // The upstreams that measure style distance state no threshold; this one is
    // expressed in the target profile's own spread, so it is a direction rather
    // than a fixed number. See `src/detector/stylometry/index.ts`.
    description:
      'The text sits further from the target voice profile than the profile\u2019s own spread allows, across sentence length and burstiness.',
    rewriteGuidance:
      'Move sentence length and variation towards the profile. Do not flatten the text to match a mean: the profile records a spread, and matching the spread is the point.',
    localChanges: [
      {
        kind: 'added',
        description:
          'Measurement expressed in standard deviations of the profile rather than against a fixed target.',
        author: 'human-voice-suite',
      },
    ],
    tags: ['local', 'voice'],
  }),

  // The translationese register. The tell is the upstreams' — `ai-zixun/humanizer-zh`
  // states 优先改掉翻译腔 as its first Core Rule, and `holygeek00/humanizer-zh-cn`
  // lists the same symptoms — but neither states how to measure it, so the
  // measurement is ours and the provenance says so. The connective half of the
  // same register is charged separately, by `lexical.translationese_connective`,
  // which arrives through the lexical detector from the upstream's own phrase
  // list. Two rules for two different things: a lexicon and a register.
  localRule('chinese.translationese', {
    severity: 3,
    description:
      'Chinese that reads as translated from English: 的的不休, 被字句 overuse, light-verb constructions, abstract-noun suffixes and pronouns where Chinese would omit them.',
    rewriteGuidance:
      'Rewrite the sentence rather than swapping words. Cut the 的 that carry no information, turn 被字句 back into an ordinary Chinese subject-predicate, replace 进行/作出 with the verb itself, and drop pronouns the reader can infer. Do not flatten a technical register into casual Chinese: the target is Chinese, not informal Chinese.',
    languages: ['zh'],
    sources: [
      {
        upstream: 'ai-zixun/humanizer-zh',
        ruleId: '1',
        locator: 'SKILL.md ## Core Rules 1 (优先改掉翻译腔)',
        quote:
          '把英文句法硬套中文的句子拆开重写。少用「对于……来说」「基于……」「围绕……展开」这类翻译味很重的连接。',
        modified: true,
        note:
          'The upstream states the tell and gives examples; it states no measurement. The thresholds and the corroboration requirement are this project\u2019s, calibrated on the translated-chinese benchmark category.',
      },
      {
        upstream: 'holygeek00/humanizer-zh-cn',
        locator: 'localisation map',
        note: 'Lists the same symptoms for the simplified-Chinese fork.',
      },
      {
        upstream: LOCAL_UPSTREAM,
        ruleId: 'chinese.translationese',
        locator: 'src/detector/chinese/index.ts',
      },
    ],
    localChanges: [
      {
        kind: 'added',
        description:
          'The measurement: 的 density per 100 CJK characters as the anchor, plus one corroborating signal. Calibrated on four translated samples, one clean control and one hand-fixed revision; 8.0 per 100 sits in a gap with roughly 30% clearance on both sides.',
        author: 'human-voice-suite',
      },
    ],
    tags: ['local', 'zh'],
  }),

  // The fingerprint distance rules. Same family and same measurement as
  // `stylometry.distribution_distance`, split so that the report can say *which*
  // habit is off target instead of only that something is. All three carry the
  // `voice` tag, which keeps them out of `antiAIScore`: a distance from a target
  // is charged to `voiceScore` and nowhere else, because charging it twice is the
  // double-counting this project exists to remove.
  localRule('stylometry.fingerprint_sentence_length', {
    severity: 3,
    description:
      'Mean sentence length sits outside the target profile\u2019s spread, measured in the profile\u2019s own standard deviations.',
    rewriteGuidance:
      'Move sentence length towards the profile\u2019s range. The profile records a spread, not a target value: matching the spread is the point, and flattening every sentence to the mean is a worse match than the original.',
    localChanges: [
      {
        kind: 'added',
        description:
          'Original to this project. The upstream fingerprint records a mean sentence length but states no tolerance and never scores it; this rule states both.',
        author: 'human-voice-suite',
      },
    ],
    tags: ['local', 'voice'],
  }),
  localRule('stylometry.fingerprint_punctuation', {
    severity: 2,
    description:
      'Punctuation habits differ from the target profile: which marks the writer reaches for, and how often per 1000 characters.',
    rewriteGuidance:
      'Use the writer\u2019s own punctuation habits — the marks that appear in the profile and the density it records. Do not add marks the profile does not show; substituting one habit for another is not a match.',
    localChanges: [
      {
        kind: 'added',
        description:
          'Original to this project. Ten of the upstream fingerprint\u2019s 25 fields are computed and never scored; punctuation rate is one of them, and it is scored here.',
        author: 'human-voice-suite',
      },
    ],
    tags: ['local', 'voice'],
  }),
  localRule('stylometry.fingerprint_vocabulary', {
    severity: 3,
    description:
      'The writer\u2019s own recurring vocabulary is absent, or terms the profile records as avoided appear.',
    rewriteGuidance:
      'Reach for the vocabulary the profile records, and never for the terms it records as avoided. Absence of a signature term is weaker evidence than presence of an avoided one, and the finding says which case it is.',
    localChanges: [
      {
        kind: 'added',
        description:
          'Original to this project. Deriving an avoid-list from negative samples is stated here and in the schema, because no upstream models it.',
        author: 'human-voice-suite',
      },
    ],
    tags: ['local', 'voice'],
  }),

  // The ten assistant smells. Detection is Phase 5; the rules exist now so that
  // the taxonomy and the detector cannot drift apart.
  ...ASSISTANT_SMELLS.map((smell) =>
    localRule(smell.id, {
      severity: smell.severity,
      description: smell.description,
      rewriteGuidance: smell.rewriteGuidance,
      detection: smell.detectionHint,
      languages: [...smell.languages],
      sources: smell.sources.map((source) => ({ ...source })),
      localChanges: [
        {
          kind: 'added',
          description: 'Original to this project. No upstream states this as a rule.',
          author: 'human-voice-suite',
        },
      ],
      tags: ['local', 'chat'],
    }),
  ),
];

export function localRuleIds(): string[] {
  return LOCAL_RULES.map((rule) => rule.id);
}
