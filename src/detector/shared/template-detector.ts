/**
 * The template detector.
 *
 * One detector serves every construction template the registry carries, in the
 * same way the lexical detector serves every watched phrase. Until this existed,
 * extraction classified eighteen of blader's entries as `template` and nothing
 * could match them, so the suite saw the vocabulary of AI prose and none of its
 * shape.
 *
 * Findings are attributed to the family of the rule's own category, so a
 * `rhythm.forced_triad` template reports as rhythm and a
 * `structural.negation_contrast` template reports as structural. That keeps the
 * per-family counts in a scan meaningful without splitting the matching code.
 */

import { CanonicalRuleRegistry } from '../../rules/canonical/registry.js';
import { LOCAL_UPSTREAM } from '../../rules/provenance/types.js';
import { buildPhraseIndex, ownsPhrase } from '../../rules/dedupe/phrases.js';
import type { Detector, DetectionContext, Finding, FindingEvidence } from '../types.js';
import { familyForCategory } from './helpers.js';
import { templatesFor } from './template.js';
import type { TemplateCompilationReport } from './template.js';
import type { PhraseIndex } from '../../rules/dedupe/phrases.js';

/** Cache the index by registry identity; building it walks every rule. */
const indexCache = new WeakMap<CanonicalRuleRegistry, PhraseIndex>();

function indexFor(registry: CanonicalRuleRegistry): PhraseIndex {
  const cached = indexCache.get(registry);
  if (cached) return cached;
  const built = buildPhraseIndex(registry.list());
  indexCache.set(registry, built);
  return built;
}

/** Cap per rule, matching the lexical detector's discipline. */
export const MAX_TEMPLATE_EVIDENCE = 5;

export interface TemplateDetectorStats {
  readonly compiled: number;
  readonly skipped: number;
}

/** How many templates compile, for the CLI and for tests. */
export function templateStats(
  registry: CanonicalRuleRegistry,
  language: string,
): TemplateDetectorStats {
  const report: TemplateCompilationReport = templatesFor(registry, language);
  return { compiled: report.compiled.length, skipped: report.skipped.length };
}

export function createTemplateDetector(): Detector {
  return {
    id: 'structural.templates',
    upstream: LOCAL_UPSTREAM,
    family: 'structural',
    languages: ['en', 'zh', 'unknown'],
    status: 'ready',
    description:
      'Matches the construction templates contributed by every upstream, read from the canonical rules. Covers the tells that cannot be matched as literal strings, such as "not X but Y".',
    detect(text: string, context: DetectionContext): Finding[] {
      const registry = context.rules;
      if (!registry) return [];

      const report = templatesFor(registry, context.language);
      const index = indexFor(registry);
      const byRule = new Map<string, typeof report.compiled[number][]>();
      for (const pattern of report.compiled) {
        // Templates are deduplicated by ownership exactly as literal phrases are:
        // `not X but Y` is claimed by several rules and belongs to one.
        if (!ownsPhrase(index, pattern.phrase, pattern.ruleId)) continue;
        const bucket = byRule.get(pattern.ruleId);
        if (bucket) bucket.push(pattern);
        else byRule.set(pattern.ruleId, [pattern]);
      }

      const findings: Finding[] = [];
      const ceiling = context.maxFindings ?? 500;

      for (const [ruleId, patterns] of byRule) {
        const rule = registry.get(ruleId);
        if (!rule) continue;

        const evidence: FindingEvidence[] = [];
        const matched = new Set<string>();
        let totalHits = 0;
        let bestConfidence = 0;

        for (const pattern of patterns) {
          pattern.regex.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = pattern.regex.exec(text)) !== null) {
            totalHits += 1;
            matched.add(pattern.template);
            bestConfidence = Math.max(bestConfidence, pattern.confidence);
            if (evidence.length < MAX_TEMPLATE_EVIDENCE) {
              evidence.push({
                start: match.index,
                end: match.index + match[0].length,
                text: match[0].trim(),
              });
            }
            if (match.index === pattern.regex.lastIndex) pattern.regex.lastIndex += 1;
          }
        }

        if (totalHits === 0) continue;

        findings.push({
          ruleId,
          canonicalRuleId: ruleId,
          upstream: rule.sources[0]?.upstream ?? LOCAL_UPSTREAM,
          detectorId: 'structural.templates',
          category: rule.category,
          family: familyForCategory(rule.category),
          severity: rule.severity,
          languages: rule.languages,
          message: `${totalHits} construction match(es) across ${matched.size} template(s): ${[...matched].slice(0, 4).join(' | ')}`,
          evidence,
          confidence: bestConfidence,
        });

        if (findings.length >= ceiling) break;
      }

      return findings;
    },
  };
}
