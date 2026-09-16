/**
 * Structural detector family.
 *
 * Document-shape tells: headings, bold, list structure and closers. These are
 * language-independent, so the family covers both scripts and carries the
 * `formatting` rules as well as the `structural` ones.
 */

import { splitSentences } from '../../shared/text.js';
import type { Detector, DetectionContext, Finding, FindingEvidence } from '../types.js';
import { catalogForFamily } from '../catalog.js';
import type { DetectorSlot } from '../catalog.js';
import { countOccurrences, perThousand, familyForCategory } from '../shared/helpers.js';

export const FAMILY = 'structural' as const;
export const TARGET_PHASE = 2;
export const PLANNED_SLOTS: readonly DetectorSlot[] = catalogForFamily(FAMILY);

/** Bold runs per 1000 characters before it is decoration rather than emphasis. */
export const BOLD_PER_THOUSAND_LIMIT = 12;

/** Fraction of headings that are Title Case before it reads as a template. */
export const TITLE_CASE_HEADING_RATIO = 0.6;

/** Heading plus list markers per 1000 characters before structure outweighs prose. */
export const STRUCTURE_PER_THOUSAND_LIMIT = 20;

/** A closer this short, after a paragraph this long, is a dramatic beat. */
export const CLOSER_MAX_WORDS = 12;
const CLOSER_MIN_PRECEDING_WORDS = 40;
const CLOSER_OCCURRENCES = 2;

const BOLD_RUN = /\*\*[^*\n]+\*\*/g;
const HEADING = /^#{1,6}\s+(.+)$/gm;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2190}-\u{21FF}\u{2600}-\u{27BF}]/u;

function words(text: string): number {
  return text.split(/\s+/).filter((token) => token.length > 0).length;
}

function isTitleCaseHeading(heading: string): boolean {
  const tokens = heading.split(/\s+/).filter((token) => /[A-Za-z]/.test(token));
  if (tokens.length < 3) return false;
  const capitalised = tokens.filter((token) => /^[A-Z]/.test(token)).length;
  return capitalised / tokens.length >= 0.8;
}

function makeFinding(
  ruleId: string,
  severity: number,
  category: string,
  message: string,
  evidence: FindingEvidence[],
  confidence: number,
): Finding {
  return {
    ruleId,
    canonicalRuleId: ruleId,
    upstream: 'human-voice-suite/local',
    detectorId: 'structural.document_shape',
    category,
    // The two taxonomies differ: `formatting` rules are found by structural
    // detectors, so the family is derived rather than passed alongside.
    family: familyForCategory(category),
    severity,
    languages: ['en', 'zh'],
    message,
    evidence,
    confidence,
  };
}

export function createStructuralDetectors(): Detector[] {
  return [
    {
      id: 'structural.document_shape',
      upstream: 'human-voice-suite/local',
      family: 'structural',
      languages: ['en', 'zh', 'unknown'],
      status: 'ready',
      description:
        'Heading restatement, one-line closers, bold decoration, decorative headings and structure that outweighs the prose.',
      detect(text: string, context: DetectionContext): Finding[] {
        const registry = context.rules;
        const findings: Finding[] = [];
        const charCount = Math.max(1, text.length);

        // ---- bold as decoration ---------------------------------------------
        const boldRule = registry?.get('formatting.bold_decoration');
        if (boldRule) {
          const matches = text.match(BOLD_RUN) ?? [];
          const density = perThousand(matches.length, charCount);
          if (matches.length >= 3 && density >= BOLD_PER_THOUSAND_LIMIT) {
            findings.push(
              makeFinding(
                'formatting.bold_decoration',
                boldRule.severity,
                'formatting',
                `${matches.length} bold run(s), ${density.toFixed(1)} per 1000 characters.`,
                matches.slice(0, 5).map((match) => {
                  const start = text.indexOf(match);
                  return { start, end: start + match.length, text: match.slice(0, 60) };
                }),
                0.7,
              ),
            );
          }
        }

        // ---- decorative headings --------------------------------------------
        const headingRule = registry?.get('formatting.decorative_headings');
        if (headingRule) {
          const headings = [...text.matchAll(HEADING)].map((match) => match[1]!.trim());
          if (headings.length >= 2) {
            const titleCase = headings.filter(isTitleCaseHeading);
            const decorated = headings.filter((heading) => EMOJI.test(heading));
            const ratio = titleCase.length / headings.length;
            if (titleCase.length >= 2 && ratio >= TITLE_CASE_HEADING_RATIO) {
              findings.push(
                makeFinding(
                  'formatting.decorative_headings',
                  headingRule.severity,
                  'formatting',
                  `${titleCase.length} of ${headings.length} headings are Title Case.`,
                  titleCase.slice(0, 4).map((heading) => {
                    const start = text.indexOf(heading);
                    return { start, end: start + heading.length, text: heading };
                  }),
                  0.7,
                ),
              );
            }
            if (decorated.length >= 2) {
              findings.push(
                makeFinding(
                  'formatting.decorative_headings',
                  headingRule.severity,
                  'formatting',
                  `${decorated.length} headings carry emoji or arrows.`,
                  decorated.slice(0, 4).map((heading) => {
                    const start = text.indexOf(heading);
                    return { start, end: start + heading.length, text: heading };
                  }),
                  0.8,
                ),
              );
            }
          }
        }

        // ---- structure outweighing the prose --------------------------------
        const structureRule = registry?.get('formatting.excessive_structure');
        if (structureRule) {
          const headings = [...text.matchAll(HEADING)].length;
          const listItems = [...text.matchAll(/^\s*(?:[-*+]|\d+\.)\s+/gm)].length;
          const markers = headings + listItems;
          const density = perThousand(markers, charCount);
          if (markers >= 6 && density >= STRUCTURE_PER_THOUSAND_LIMIT) {
            findings.push(
              makeFinding(
                'formatting.excessive_structure',
                structureRule.severity,
                'formatting',
                `${markers} heading(s) and list item(s), ${density.toFixed(1)} per 1000 characters.`,
                [],
                0.65,
              ),
            );
          }
        }

        // ---- a heading restated in the first sentence ------------------------
        const restatedRule = registry?.get('structural.heading_restated');
        if (restatedRule) {
          const evidence: FindingEvidence[] = [];
          for (const match of text.matchAll(HEADING)) {
            const after = text.slice(match.index + match[0].length);
            // A heading is followed by a blank line, so the naive first chunk is
            // empty. Take the first chunk that actually has content.
            const firstLine =
              after
                .split(/\n\s*\n/)
                .map((chunk) => chunk.trim())
                .find((chunk) => chunk.length > 0 && !chunk.startsWith('#')) ?? '';
            if (firstLine.length === 0) continue;
            const sentence = splitSentences(firstLine)[0] ?? firstLine;
            const headingWords = new Set(
              match[1]!.toLowerCase().split(/\s+/).filter((w) => w.length > 3),
            );
            if (headingWords.size === 0) continue;
            const sentenceWords = sentence.toLowerCase().split(/\s+/);
            const overlap =
              sentenceWords.filter((word) => headingWords.has(word.replace(/[^a-z]/g, ''))).length;
            // Most of the heading's content words reappearing in the very next
            // sentence is a restatement rather than a continuation.
            if (overlap >= Math.max(2, Math.ceil(headingWords.size * 0.7))) {
              evidence.push({
                start: match.index,
                end: match.index + match[0].length + sentence.length,
                text: `${match[1]!.trim()} / ${sentence.slice(0, 60)}`,
              });
            }
            if (evidence.length >= 3) break;
          }
          if (evidence.length > 0) {
            findings.push(
              makeFinding(
                'structural.heading_restated',
                restatedRule.severity,
                'structural',
                `${evidence.length} heading(s) restated in the sentence beneath.`,
                evidence,
                0.6,
              ),
            );
          }
        }

        // ---- one-line closers -----------------------------------------------
        const closerRule = registry?.get('structural.one_line_closer');
        if (closerRule) {
          const paragraphs = text
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.trim())
            .filter((paragraph) => paragraph.length > 0 && !/^#/.test(paragraph));
          const evidence: FindingEvidence[] = [];
          for (let i = 1; i < paragraphs.length; i += 1) {
            const previous = paragraphs[i - 1]!;
            const current = paragraphs[i]!;
            const previousWords = words(previous);
            const currentWords = words(current);
            const singleSentence = splitSentences(current).length === 1;
            if (
              previousWords >= CLOSER_MIN_PRECEDING_WORDS &&
              currentWords <= CLOSER_MAX_WORDS &&
              singleSentence
            ) {
              const start = text.indexOf(current);
              evidence.push({ start, end: start + current.length, text: current });
            }
            if (evidence.length >= 3) break;
          }
          if (evidence.length >= CLOSER_OCCURRENCES) {
            findings.push(
              makeFinding(
                'structural.one_line_closer',
                closerRule.severity,
                'structural',
                `${evidence.length} one-line paragraphs following a long one.`,
                evidence,
                0.6,
              ),
            );
          }
        }

        return findings;
      },
    },
  ];
}

/** Slots this family owns that are implemented. */
export function readySlots(): DetectorSlot[] {
  return PLANNED_SLOTS.filter((slot) => slot.status === 'ready');
}

void countOccurrences;
