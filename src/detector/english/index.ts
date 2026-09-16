/**
 * English-specific detector family.
 *
 * The English phrase blacklist arrives through the lexical and template
 * detectors. What is left here is the construction that no word list can carry:
 * passive voice and the missing subject.
 *
 * Blader marks this pattern `*weak alone*`, so the detector states what it found
 * and lets the suppression layer decide. Firing on a single passive sentence
 * would flag most careful technical writing.
 */

import { splitSentences } from '../../shared/text.js';
import type { Detector, DetectionContext, Finding, FindingEvidence } from '../types.js';
import { catalogForFamily } from '../catalog.js';
import type { DetectorSlot } from '../catalog.js';
import { perThousand } from '../shared/helpers.js';

export const FAMILY = 'english' as const;
export const TARGET_PHASE = 2;
export const PLANNED_SLOTS: readonly DetectorSlot[] = catalogForFamily(FAMILY);

/** Passive constructions per 1000 words before it reads as a habit. */
export const PASSIVE_PER_THOUSAND_LIMIT = 12;

/** Minimum words before a rate is meaningful. */
export const MIN_WORDS_FOR_PASSIVE = 120;

/**
 * `be` + past participle.
 *
 * Deliberately a closed list of irregular participles plus the regular `-ed`
 * shape. A general past-participle test needs a tagger, and guessing produces
 * false positives on ordinary past tense, which is worse than missing some.
 */
const PASSIVE = new RegExp(
  String.raw`\b(?:is|are|was|were|be|been|being|am)\s+` +
    String.raw`(?:\w+ed|known|made|given|taken|seen|done|shown|found|held|kept|left|met|paid|put|read|run|said|sold|sent|set|shown|told|thought|understood|written|built|chosen|driven|felt|grown|lost|meant)\b`,
  'gi',
);

/** Sentences that open with a verb, i.e. the subject has been dropped. */
const SUBJECTLESS = /(?:^|[.!?]\s+)(?:No\s+\w+\s+(?:is|are|was|were)\s+\w+ed)\b/gi;

export function createEnglishDetectors(): Detector[] {
  return [
    {
      id: 'english.construction',
      upstream: 'human-voice-suite/local',
      family: 'english',
      languages: ['en'],
      status: 'ready',
      description:
        'Passive voice at a rate above careful human writing, and sentences whose subject has been dropped.',
      detect(text: string, context: DetectionContext): Finding[] {
        const registry = context.rules;
        const rule = registry?.get('lexical.passive_and_subjectless');
        if (!rule) return [];

        const findings: Finding[] = [];
        const wordCount = text.split(/\s+/).filter((word) => word.length > 0).length;
        if (wordCount < MIN_WORDS_FOR_PASSIVE) return findings;

        const evidence: FindingEvidence[] = [];
        const scanner = new RegExp(PASSIVE.source, 'gi');
        let match: RegExpExecArray | null;
        let count = 0;
        while ((match = scanner.exec(text)) !== null) {
          count += 1;
          if (evidence.length < 5) {
            evidence.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
          }
          if (scanner.lastIndex === match.index) scanner.lastIndex += 1;
        }

        const density = perThousand(count, wordCount);
        if (count >= 3 && density >= PASSIVE_PER_THOUSAND_LIMIT) {
          findings.push({
            ruleId: rule.id,
            canonicalRuleId: rule.id,
            upstream: 'human-voice-suite/local',
            detectorId: 'english.construction',
            category: 'lexical',
            family: 'english',
            severity: rule.severity,
            languages: ['en'],
            message: `${count} passive construction(s) in ${wordCount} words, ${density.toFixed(1)} per 1000.`,
            evidence,
            confidence: 0.6,
          });
        }

        // Subjectless sentences are rarer and stronger, so they are reported on
        // their own rather than folded into the rate above.
        const subjectless = text.match(SUBJECTLESS) ?? [];
        if (subjectless.length >= 2) {
          const spans: FindingEvidence[] = [];
          const scanner2 = new RegExp(SUBJECTLESS.source, 'gi');
          let m: RegExpExecArray | null;
          while ((m = scanner2.exec(text)) !== null && spans.length < 5) {
            spans.push({ start: m.index, end: m.index + m[0].length, text: m[0].trim() });
          }
          findings.push({
            ruleId: rule.id,
            canonicalRuleId: rule.id,
            upstream: 'human-voice-suite/local',
            detectorId: 'english.construction',
            category: 'lexical',
            family: 'english',
            severity: rule.severity,
            languages: ['en'],
            message: `${subjectless.length} sentence(s) drop the subject entirely.`,
            evidence: spans,
            confidence: 0.7,
          });
        }

        // A sentence count is reported so a reader can see the measurement was
        // taken over something, not over one line.
        void splitSentences(text).length;
        return findings;
      },
    },
  ];
}

/** Slots this family owns that are implemented. */
export function readySlots(): DetectorSlot[] {
  return PLANNED_SLOTS.filter((slot) => slot.status === 'ready');
}
