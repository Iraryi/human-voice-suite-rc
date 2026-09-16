/**
 * Rhythm detector family.
 *
 * Distributional tells: sentence-length uniformity, dash density, repeated
 * sentence openings, comma splices and the triad reflex. These are the tells
 * that cannot be found by matching a string, which is why they need their own
 * detector rather than another lexicon.
 *
 * Thresholds are stated per length wherever the upstream states one, because a
 * long document with five dashes is not dash-heavy and a short one with five is.
 */

import { computeTextStats, splitSentences } from '../../shared/text.js';
import type { Detector, DetectionContext, Finding, FindingEvidence } from '../types.js';
import { catalogForFamily } from '../catalog.js';
import type { DetectorSlot } from '../catalog.js';
import { countOccurrences, perThousand } from '../shared/helpers.js';

export const FAMILY = 'rhythm' as const;
export const TARGET_PHASE = 2;
export const PLANNED_SLOTS: readonly DetectorSlot[] = catalogForFamily(FAMILY);

/**
 * Sentence-length variation below this reads as machine-uniform. `ai-humanizer`
 * uses the same figure as its `uniform-rhythm` gate.
 */
export const MIN_BURSTINESS = 0.35;

/** Below this many sentences, burstiness is not a meaningful measurement. */
export const MIN_SENTENCES_FOR_RHYTHM = 5;

/** Dashes per 1000 characters before it is a habit rather than a choice. */
export const DASH_PER_THOUSAND_LIMIT = 6;

/**
 * Dashes below which the rate is meaningless.
 *
 * A rate alone fails on short text: one dash in a forty-character sentence is
 * twenty-five per thousand, which clears any density threshold. A single dash
 * can never be overuse, so an absolute floor is required alongside the rate.
 */
export const MIN_DASHES = 3;

/** Consecutive sentences opening the same way before it is a pattern. */
export const REPEATED_OPENING_RUN = 3;

/**
 * A list item or an emphasised label is not a sentence opening.
 *
 * Phase 8 fix, driven by the benchmark. `rhythm.repeated_openings` fired on 6 of
 * 56 corpus samples and 4 of those were human-written, every one of them a
 * Markdown document whose "repeated openings" were `- ` bullets or `**Label:**`
 * emphasis. A bullet list has no prose rhythm to measure, and bold labels are
 * already charged once by the structural rules — charging them again here is the
 * double-counting this project exists to remove.
 *
 * So the pattern is measured over sentences that begin with prose, and a document
 * that is mostly a list simply has fewer sentences to measure.
 */
export const LEADING_MARKUP = /^(?:[-*+\u2022\u00b7]|\d+[.)]|#{1,6}\s|\*\*|__|>\s)/;

/** A character that makes a string a sentence rather than a punctuation mark. */
const WORD_CHARACTER = /[\p{Script=Han}A-Za-z0-9]/u;

/**
 * A sentence with no word in it is not a sentence.
 *
 * Phase 11 fix, and the largest false positive this project has found. On 30,000
 * sessions of human dialogue, `rhythm.repeated_openings` fired **1,123 times** — six
 * times its rate on generated text, the only rule in the whole measurement whose
 * rate was higher on human writing.
 *
 * Every one of those firings was punctuation. `splitSentences` keeps the terminator
 * on the sentence it closes, which is right for measuring rhythm, but it means a run
 * of terminators — `真的吗？？？`, `哈哈。。。`, the way people actually type — becomes a run
 * of "sentences" consisting only of `？` or `。`. Three of those in a row satisfied
 * "three consecutive sentences open with 。".
 *
 * Requiring one word character per sentence is the whole fix: punctuation still
 * belongs to the sentence it closes, and a fragment with nothing in it stops being a
 * sentence at all.
 */
function isProseSentence(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (trimmed.length === 0) return false;
  if (LEADING_MARKUP.test(trimmed)) return false;
  return WORD_CHARACTER.test(trimmed);
}

/** "A, B, and C" constructions before the reflex is a habit rather than English. */
export const TRIAD_HABIT_THRESHOLD = 3;

const DASHES = ['\u2014', '\u2013', '--', '\uff0d'];
const COMMA_SPLICE = /[^.;!?\n]{25,},(?:\s+[^.;!?\n]{10,}){3,}[^.;!?\n]*$/gm;
const TRIAD =
  /\b[\w'-]+(?:\s+[\w'-]+){0,2},\s+[\w'-]+(?:\s+[\w'-]+){0,2},\s+and\s+[\w'-]+(?:\s+[\w'-]+){0,2}\b/gi;

function firstToken(sentence: string): string {
  const trimmed = sentence.trim();
  const latin = /^([A-Za-z']+)/.exec(trimmed);
  if (latin) return latin[1]!.toLowerCase();
  // Chinese has no words; the first two characters are the closest thing to an
  // opening unit.
  return [...trimmed].slice(0, 2).join('');
}

function finding(
  ruleId: string,
  severity: number,
  message: string,
  evidence: FindingEvidence[],
  confidence: number,
): Finding {
  return {
    ruleId,
    canonicalRuleId: ruleId,
    upstream: 'human-voice-suite/local',
    detectorId: 'rhythm.distribution',
    category: 'rhythm',
    family: 'rhythm',
    severity,
    languages: ['en', 'zh'],
    message,
    evidence,
    confidence,
  };
}

export function createRhythmDetectors(): Detector[] {
  return [
    {
      id: 'rhythm.distribution',
      upstream: 'human-voice-suite/local',
      family: 'rhythm',
      languages: ['en', 'zh', 'unknown'],
      status: 'ready',
      description:
        'Sentence-length uniformity, dash density, repeated openings, comma splices and the triad reflex.',
      detect(text: string, context: DetectionContext): Finding[] {
        const registry = context.rules;
        const language = context.language;
        const stats = computeTextStats(text);
        const sentences = splitSentences(text);
        const findings: Finding[] = [];

        // ---- sentence-length uniformity ------------------------------------
        const rhythmRule = registry?.get('rhythm.uniform_rhythm');
        if (
          rhythmRule &&
          stats.sentenceCount >= MIN_SENTENCES_FOR_RHYTHM &&
          stats.burstiness < MIN_BURSTINESS
        ) {
          findings.push(
            finding(
              'rhythm.uniform_rhythm',
              rhythmRule.severity,
              `${stats.sentenceCount} sentences with a length variation of ${stats.burstiness.toFixed(2)}, below ${MIN_BURSTINESS}. Mean length ${stats.averageSentenceTokens.toFixed(1)} tokens.`,
              sentences.slice(0, 3).map((sentence) => {
                const start = text.indexOf(sentence);
                return { start, end: start + sentence.length, text: sentence.slice(0, 80) };
              }),
              0.75,
            ),
          );
        }

        // ---- dash density ---------------------------------------------------
        const dashRule = registry?.get('rhythm.dash_overuse');
        if (dashRule) {
          let dashCount = 0;
          const evidence: FindingEvidence[] = [];
          for (const dash of DASHES) {
            dashCount += countOccurrences(text, dash);
            let index = text.indexOf(dash);
            while (index !== -1 && evidence.length < 5) {
              evidence.push({ start: index, end: index + dash.length, text: dash });
              index = text.indexOf(dash, index + dash.length);
            }
          }
          const density = perThousand(dashCount, stats.charCount);
          if (dashCount >= MIN_DASHES && density >= DASH_PER_THOUSAND_LIMIT) {
            findings.push(
              finding(
                'rhythm.dash_overuse',
                dashRule.severity,
                `${dashCount} dash(es), ${density.toFixed(1)} per 1000 characters, above the ${DASH_PER_THOUSAND_LIMIT} limit.`,
                evidence.slice(0, 5),
                0.8,
              ),
            );
          }
        }

        // ---- repeated sentence openings ------------------------------------
        const openingRule = registry?.get('rhythm.repeated_openings');
        const proseSentences = sentences.filter(isProseSentence);
        if (openingRule && proseSentences.length >= REPEATED_OPENING_RUN) {
          const tokens = proseSentences.map(firstToken);
          for (let i = 0; i + REPEATED_OPENING_RUN <= tokens.length; i += 1) {
            const token = tokens[i]!;
            if (token.length === 0) continue;
            let end = i + 1;
            while (end < tokens.length && tokens[end] === token) end += 1;
            if (end - i < REPEATED_OPENING_RUN) continue;

            const evidence: FindingEvidence[] = proseSentences.slice(i, end).map((sentence) => {
              const start = text.indexOf(sentence);
              return { start, end: start + sentence.length, text: sentence.slice(0, 60) };
            });
            const skipped = sentences.length - proseSentences.length;
            findings.push(
              finding(
                'rhythm.repeated_openings',
                openingRule.severity,
                `${end - i} consecutive prose sentences open with "${token}".` +
                  (skipped > 0
                    ? ` ${skipped} list item(s) or emphasised label(s) were not counted as sentence openings.`
                    : ''),
                evidence,
                0.85,
              ),
            );
            break;
          }
        }

        // ---- comma splices --------------------------------------------------
        // English only: Chinese uses the comma differently and this shape would
        // fire on ordinary Chinese prose.
        const spliceRule = registry?.get('rhythm.comma_splice_rhythm');
        if (spliceRule && language !== 'zh') {
          const matches = text.match(COMMA_SPLICE) ?? [];
          if (matches.length >= 2) {
            findings.push(
              finding(
                'rhythm.comma_splice_rhythm',
                spliceRule.severity,
                `${matches.length} sentence(s) chain four or more clauses with commas.`,
                matches.slice(0, 3).map((match) => {
                  const start = text.indexOf(match);
                  return { start, end: start + match.length, text: match.slice(0, 80) };
                }),
                0.5,
              ),
            );
          }
        }

        // ---- the triad reflex ----------------------------------------------
        // Held to a habit rather than an instance: "A, B, and C" is normal
        // English, and only its repetition is a tell.
        const triadRule = registry?.get('rhythm.forced_triad');
        if (triadRule) {
          const matches = text.match(TRIAD) ?? [];
          if (matches.length >= TRIAD_HABIT_THRESHOLD) {
            findings.push(
              finding(
                'rhythm.forced_triad',
                triadRule.severity,
                `${matches.length} "A, B, and C" constructions.`,
                matches.slice(0, 4).map((match) => {
                  const start = text.indexOf(match);
                  return { start, end: start + match.length, text: match.slice(0, 70) };
                }),
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
