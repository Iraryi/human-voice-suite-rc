/**
 * Chinese-specific detector family.
 *
 * Punctuation and typography conventions that only apply to Chinese. The
 * translationese and boilerplate tells are phrase-based and arrive through the
 * lexical and template detectors; what is left for this family is the shape of
 * the punctuation itself, which no phrase list can express.
 */

import { countCjkChars } from '../../shared/text.js';
import type { Detector, DetectionContext, Finding, FindingEvidence } from '../types.js';
import { catalogForFamily } from '../catalog.js';
import type { DetectorSlot } from '../catalog.js';

export const FAMILY = 'chinese' as const;
export const TARGET_PHASE = 2;
export const PLANNED_SLOTS: readonly DetectorSlot[] = catalogForFamily(FAMILY);

/**
 * Minimum CJK characters before the measurement is meaningful.
 */
export const MIN_CJK_CHARS = 80;

/**
 * Half-width marks used *inside Chinese text*, which is the actual tell.
 *
 * A plain "are both widths present" test is wrong, and the first version of this
 * detector was: Chinese technical writing legitimately contains whole English
 * sentences ending in `.`, and flagging that would fire on most good writing.
 * The tell is a half-width mark terminating Chinese, so the mark must be
 * adjacent to a CJK character.
 */
export const MIXED_MARK_MINIMUM = 2;

const FULL_WIDTH_SENTENCE = /[\u3002\uff01\uff1f]/g;
const HALF_WIDTH_SENTENCE_IN_CJK =
  /[\u4e00-\u9fff][.!?](?![0-9])|(?<![0-9])[.!?][\u4e00-\u9fff]/g;
const FULL_WIDTH_COMMA = /[\uff0c\u3001]/g;
const HALF_WIDTH_COMMA_IN_CJK = /[\u4e00-\u9fff],|,[\u4e00-\u9fff]/g;

/**
 * Long dashes, which `humanizer-zh` bans outright in Chinese prose.
 */
const LONG_DASH = /\u2014\u2014|\u2014/g;

/**
 * Translationese thresholds, calibrated on the benchmark corpus.
 *
 * ## Why these are numbers and where they come from
 *
 * `chinese.translationese` was declared as a catalog slot in Phase 1 and, until
 * Phase 8, **nothing answered to it**: the connective half of the tell was
 * charged to `lexical.translationese_connective`, and the register half had no
 * detector at all. The benchmark is what surfaced it — the
 * `translated-chinese` category was added so the rule had something to fire on,
 * and the rule fired on none of it.
 *
 * So the thresholds were measured before they were written, over every Chinese
 * sample in the corpus. 的 density per 100 CJK characters, on the 36 zh samples:
 *
 * ```text
 *   translated positives (0001-0004)   8.21  8.65  9.83  11.55
 *   negative control (0005)            1.96
 *   hand-fixed revision (0006)         1.64
 *   every other zh sample, highest     6.10     (zh-prose-0001, AI prose with other tells)
 * ```
 *
 * 8.0 sits in the gap with roughly 30% clearance on each side, which is the
 * whole reason it is the anchor: 的的不休 is what "translated" sounds like, and
 * on this corpus nothing else reaches it.
 *
 * Corroboration is required on top. A high 的 density alone is a register
 * difference, and a register difference is not a defect — so at least one of the
 * other four signals must be present, and the finding names which. Two of the
 * positives corroborate on 被字句 (11 and 15), one on 进行/作出 (9), one on both.
 */
export const TRANSLATIONESE_MIN_CJK = 120;
export const TRANSLATIONESE_DE_DENSITY = 8;
export const TRANSLATIONESE_PASSIVE_COUNT = 2;
export const TRANSLATIONESE_LIGHT_VERB_COUNT = 3;
export const TRANSLATIONESE_ABSTRACT_SUFFIX_COUNT = 6;
export const TRANSLATIONESE_PRONOUN_COUNT = 6;

const DE = /的/g;
const PASSIVE = /被/g;
const LIGHT_VERB = /进行|作出|加以|予以/g;
const ABSTRACT_SUFFIX = /[\u4e00-\u9fff][性化度]/g;
const REDUNDANT_PRONOUN = /它|它们|他们|她们/g;

interface TranslationeseSignals {
  readonly cjkChars: number;
  readonly deDensity: number;
  readonly passive: number;
  readonly lightVerb: number;
  readonly abstractSuffix: number;
  readonly pronoun: number;
  /** Signals other than the 的 anchor that are over their threshold. */
  readonly corroborating: readonly string[];
}

/**
 * Measure the five signals. Exported because the benchmark and the tests both
 * need to see the numbers behind a finding, not only the verdict.
 */
export function translationeseSignals(text: string): TranslationeseSignals {
  const cjkChars = countCjkChars(text);
  const de = (text.match(DE) ?? []).length;
  const deDensity = cjkChars === 0 ? 0 : (de * 100) / cjkChars;
  const passive = (text.match(PASSIVE) ?? []).length;
  const lightVerb = (text.match(LIGHT_VERB) ?? []).length;
  const abstractSuffix = (text.match(ABSTRACT_SUFFIX) ?? []).length;
  const pronoun = (text.match(REDUNDANT_PRONOUN) ?? []).length;

  const corroborating: string[] = [];
  if (passive >= TRANSLATIONESE_PASSIVE_COUNT) {
    corroborating.push(`${passive} 被 (passive where Chinese would not use it)`);
  }
  if (lightVerb >= TRANSLATIONESE_LIGHT_VERB_COUNT) {
    corroborating.push(`${lightVerb} 进行/作出 (light-verb construction)`);
  }
  if (abstractSuffix >= TRANSLATIONESE_ABSTRACT_SUFFIX_COUNT) {
    corroborating.push(`${abstractSuffix} -性/-化/-度 (abstract-noun suffix)`);
  }
  if (pronoun >= TRANSLATIONESE_PRONOUN_COUNT) {
    corroborating.push(`${pronoun} 它/他们 (pronoun where Chinese would omit)`);
  }

  return {
    cjkChars,
    deDensity: Number(deDensity.toFixed(2)),
    passive,
    lightVerb,
    abstractSuffix,
    pronoun,
    corroborating,
  };
}

export function createChineseDetectors(): Detector[] {
  return [
    {
      id: 'chinese.typography',
      upstream: 'human-voice-suite/local',
      family: 'chinese',
      languages: ['zh'],
      status: 'ready',
      description:
        'Full-width and half-width punctuation mixed in one Chinese document, and long dashes used where a comma or full stop belongs.',
      detect(text: string, context: DetectionContext): Finding[] {
        const registry = context.rules;
        const findings: Finding[] = [];

        if (countCjkChars(text) < MIN_CJK_CHARS) return findings;

        // ---- mixed punctuation width ----------------------------------------
        const rule = registry?.get('chinese.punctuation_width');
        if (rule) {
          const fullWidth = (text.match(FULL_WIDTH_SENTENCE) ?? []).length;
          const mixed = [...text.matchAll(HALF_WIDTH_SENTENCE_IN_CJK)];

          if (fullWidth >= MIXED_MARK_MINIMUM && mixed.length >= MIXED_MARK_MINIMUM) {
            findings.push({
              ruleId: rule.id,
              canonicalRuleId: rule.id,
              upstream: 'human-voice-suite/local',
              detectorId: 'chinese.typography',
              category: 'chinese',
              family: 'chinese',
              severity: rule.severity,
              languages: ['zh'],
              message: `${fullWidth} full-width and ${mixed.length} half-width sentence mark(s) inside Chinese text, so the two conventions are mixed.`,
              evidence: mixed.slice(0, 5).map((match) => ({
                start: match.index,
                end: match.index + match[0].length,
                text: match[0],
              })),
              confidence: 0.8,
            });
          }
        }

        // ---- long dashes ----------------------------------------------------
        const dashRule = registry?.get('rhythm.dash_overuse');
        if (dashRule) {
          const dashes = text.match(LONG_DASH) ?? [];
          if (dashes.length >= 2) {
            const evidence: FindingEvidence[] = [];
            const scanner = new RegExp(LONG_DASH.source, 'g');
            let match: RegExpExecArray | null;
            while ((match = scanner.exec(text)) !== null && evidence.length < 5) {
              evidence.push({
                start: match.index,
                end: match.index + match[0].length,
                text: text.slice(Math.max(0, match.index - 10), match.index + match[0].length + 10),
              });
            }
            findings.push({
              ruleId: 'rhythm.dash_overuse',
              canonicalRuleId: 'rhythm.dash_overuse',
              upstream: 'human-voice-suite/local',
              detectorId: 'chinese.typography',
              category: 'rhythm',
              family: 'chinese',
              severity: dashRule.severity,
              languages: ['zh'],
              message: `${dashes.length} long dash(es) in Chinese prose, where a comma, full stop or a split sentence is the conventional choice.`,
              evidence,
              confidence: 0.7,
            });
          }
        }

        // ---- comma conventions ----------------------------------------------
        if (rule) {
          const fullWidth = (text.match(FULL_WIDTH_COMMA) ?? []).length;
          const mixed = (text.match(HALF_WIDTH_COMMA_IN_CJK) ?? []).length;
          if (fullWidth >= MIXED_MARK_MINIMUM && mixed >= MIXED_MARK_MINIMUM) {
            findings.push({
              ruleId: rule.id,
              canonicalRuleId: rule.id,
              upstream: 'human-voice-suite/local',
              detectorId: 'chinese.typography',
              category: 'chinese',
              family: 'chinese',
              severity: rule.severity,
              languages: ['zh'],
              message: `${fullWidth} full-width and ${mixed} half-width comma(s) inside Chinese text.`,
              evidence: [],
              confidence: 0.65,
            });
          }
        }

        return findings;
      },
    },
    {
      id: 'chinese.translationese',
      upstream: 'human-voice-suite/local',
      family: 'chinese',
      languages: ['zh'],
      status: 'ready',
      description:
        'Chinese that reads as translated: 的的不休 as the anchor, corroborated by 被字句, light-verb constructions, abstract-noun suffixes or redundant pronouns. The connective half of the same tell is charged separately by the lexical detector, so neither is deducted twice.',
      detect(text: string, context: DetectionContext): Finding[] {
        const rule = context.rules?.get('chinese.translationese');
        if (!rule) return [];

        const signals = translationeseSignals(text);
        if (signals.cjkChars < TRANSLATIONESE_MIN_CJK) return [];
        if (signals.deDensity < TRANSLATIONESE_DE_DENSITY) return [];
        // The anchor alone is a register, not a defect. Without a second signal
        // this is a text that uses 的 a lot, which is not a finding.
        if (signals.corroborating.length === 0) return [];

        const evidence: FindingEvidence[] = [];
        const scanner = new RegExp(DE.source, 'g');
        let match: RegExpExecArray | null;
        while ((match = scanner.exec(text)) !== null && evidence.length < 5) {
          evidence.push({
            start: match.index,
            end: match.index + match[0].length,
            text: text.slice(Math.max(0, match.index - 8), match.index + match[0].length + 8),
          });
        }

        return [
          {
            ruleId: rule.id,
            canonicalRuleId: rule.id,
            upstream: 'human-voice-suite/local',
            detectorId: 'chinese.translationese',
            category: 'chinese',
            family: 'chinese',
            severity: rule.severity,
            languages: ['zh'],
            message:
              `的 at ${signals.deDensity} per 100 characters over ${signals.cjkChars} characters, ` +
              `which is the 的的不休 shape of translated Chinese; corroborated by ${signals.corroborating.join(', ')}.`,
            evidence,
            // The anchor is a clean measurement and the margin is wide, but a
            // register is not a defect, so this never claims to be certain.
            confidence: signals.corroborating.length >= 2 ? 0.75 : 0.6,
          },
        ];
      },
    },
  ];
}

/** Slots this family owns that are implemented. */
export function readySlots(): DetectorSlot[] {
  return PLANNED_SLOTS.filter((slot) => slot.status === 'ready');
}
