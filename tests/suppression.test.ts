/**
 * The suppression policy.
 *
 * `blader/humanizer` marks five of its patterns `*weak alone*` and ships a
 * "When not to act" policy. Importing those patterns as ordinary detectors is
 * the single easiest way to make this suite fire on careful writing, so the
 * policy is tested as its own layer.
 */

import { describe, expect, it } from 'vitest';

import {
  AI_WRITING_EPOCH,
  DEFAULT_SUPPRESSION,
  applySuppression,
  findExemptSpans,
  isInsideSpan,
  weakAloneRuleIds,
} from '../src/detector/suppression.js';
import type { Finding, FindingEvidence } from '../src/detector/types.js';

function finding(ruleId: string, evidence: FindingEvidence[], severity = 3): Finding {
  return {
    ruleId,
    canonicalRuleId: ruleId,
    upstream: 'blader/humanizer',
    detectorId: 'test',
    category: 'lexical',
    family: 'lexical',
    severity,
    languages: ['en'],
    message: ruleId,
    evidence,
    confidence: 0.8,
  };
}

const weakAlone = new Set(['rhythm.dash_overuse', 'formatting.curly_quotes']);
const at = (text: string, needle: string): FindingEvidence => {
  const start = text.indexOf(needle);
  return { start, end: start + needle.length, text: needle };
};

describe('findExemptSpans', () => {
  it('exempts fenced and inline code', () => {
    const text = 'Use `delve` sparingly.\n\n```\ndelve everywhere\n```\n';
    const spans = findExemptSpans(text);
    expect(spans.some((s) => s.reason === 'code')).toBe(true);
  });

  it('exempts quotations in both scripts', () => {
    const text = 'He wrote "let that sink in" and \u300c\u503c\u5f97\u6ce8\u610f\u7684\u662f\u300d in the margin.';
    const spans = findExemptSpans(text);
    expect(spans.filter((s) => s.reason === 'quotation')).toHaveLength(2);
  });

  it('exempts titles and headings', () => {
    const text = '## Delve Into The Tapestry\n\n\u300a\u6df1\u5165\u63a2\u7d22\u300b is a book.';
    const spans = findExemptSpans(text);
    expect(spans.some((s) => s.reason === 'title')).toBe(true);
  });

  it('honours a policy that turns quotation exemption off', () => {
    const spans = findExemptSpans('He wrote "let that sink in" here.', {
      ...DEFAULT_SUPPRESSION,
      exemptQuotations: false,
    });
    expect(spans.filter((s) => s.reason === 'quotation')).toHaveLength(0);
  });
});

describe('isInsideSpan', () => {
  it('reports containment and rejects a position past the end', () => {
    const spans = [{ start: 5, end: 10, reason: 'quotation' as const }];
    expect(isInsideSpan(7, spans)?.reason).toBe('quotation');
    expect(isInsideSpan(4, spans)).toBeUndefined();
    expect(isInsideSpan(10, spans)).toBeUndefined();
  });
});

describe('applySuppression', () => {
  it('drops a finding that only fired inside a quotation', () => {
    const text = 'She said "let that sink in" and moved on.';
    const result = applySuppression(
      [finding('structural.one_line_closer', [at(text, 'let that sink in')])],
      text,
      weakAlone,
    );
    expect(result.kept).toEqual([]);
    expect(result.suppressed[0]!.reason).toMatch(/inside a quotation/);
  });

  it('keeps a weak-alone rule when enough other rules corroborate it', () => {
    const text = 'It is crucial. It is pivotal. The report is well-written and data-driven and long-term.';
    const findings = [
      finding('lexical.ai_vocabulary', [at(text, 'crucial')]),
      finding('lexical.borrowed_authority', [at(text, 'pivotal')]),
      finding('rhythm.dash_overuse', [at(text, 'well-written')]),
    ];
    const result = applySuppression(findings, text, weakAlone);
    expect(result.corroboratingRuleCount).toBe(2);
    expect(result.kept.map((f) => f.ruleId)).toContain('rhythm.dash_overuse');
  });

  it('drops a weak-alone rule when nothing corroborates it', () => {
    const text = 'The report is well-written.';
    const result = applySuppression(
      [finding('rhythm.dash_overuse', [at(text, 'well-written')])],
      text,
      weakAlone,
    );
    expect(result.kept).toEqual([]);
    expect(result.suppressed[0]!.reason).toMatch(/weak alone/);
  });

  it('does not let a weak-alone rule corroborate another weak-alone rule', () => {
    const text = 'Both \u201ccurly\u201d and well-written appear here.';
    const findings = [
      finding('formatting.curly_quotes', [at(text, '\u201ccurly\u201d')]),
      finding('rhythm.dash_overuse', [at(text, 'well-written')]),
    ];
    const result = applySuppression(findings, text, weakAlone);
    expect(result.corroboratingRuleCount).toBe(0);
    expect(result.kept).toEqual([]);
    expect(result.suppressed).toHaveLength(2);
  });

  it('does not let a suppressed finding corroborate anything', () => {
    // The dash is inside a quotation, so it must not count as corroboration for
    // the second weak-alone rule elsewhere in the text.
    const text = 'He wrote "well-written" once. The report is \u201cdata-driven\u201d.';
    const findings = [
      finding('rhythm.dash_overuse', [at(text, 'well-written')]),
      finding('formatting.curly_quotes', [at(text, '\u201cdata-driven\u201d')]),
    ];
    const result = applySuppression(findings, text, weakAlone);
    expect(result.corroboratingRuleCount).toBe(0);
    expect(result.kept).toEqual([]);
  });

  it('keeps every non-weak-alone finding regardless of count', () => {
    const text = 'It is crucial.';
    const result = applySuppression(
      [finding('lexical.ai_vocabulary', [at(text, 'crucial')])],
      text,
      weakAlone,
    );
    expect(result.kept).toHaveLength(1);
    expect(result.suppressed).toEqual([]);
  });

  it('skips the whole policy for text that predates AI writing', () => {
    const text = 'The report is well-written.';
    const result = applySuppression(
      [finding('rhythm.dash_overuse', [at(text, 'well-written')])],
      text,
      weakAlone,
      { ...DEFAULT_SUPPRESSION, predatesAiWriting: true },
    );
    expect(result.kept).toHaveLength(1);
  });

  it('records why each finding was dropped, so nothing disappears silently', () => {
    const text = 'He wrote "let that sink in".';
    const result = applySuppression(
      [finding('structural.one_line_closer', [at(text, 'let that sink in')])],
      text,
      weakAlone,
    );
    expect(result.suppressed).toHaveLength(1);
    expect(result.suppressed[0]!.reason.length).toBeGreaterThan(10);
    expect(result.suppressed[0]!.finding.ruleId).toBe('structural.one_line_closer');
  });

  it('requires the number of corroborating rules the policy states', () => {
    const text = 'It is crucial. The report is well-written and data-driven.';
    const findings = [
      finding('lexical.ai_vocabulary', [at(text, 'crucial')]),
      finding('rhythm.dash_overuse', [at(text, 'data-driven')]),
    ];
    const lenient = applySuppression(findings, text, weakAlone, {
      ...DEFAULT_SUPPRESSION,
      weakAloneCorroboration: 1,
    });
    expect(lenient.kept.map((f) => f.ruleId)).toContain('rhythm.dash_overuse');

    const strict = applySuppression(findings, text, weakAlone, {
      ...DEFAULT_SUPPRESSION,
      weakAloneCorroboration: 3,
    });
    expect(strict.kept.map((f) => f.ruleId)).not.toContain('rhythm.dash_overuse');
  });
});

describe('weakAloneRuleIds', () => {
  it('collects only the rules marked weak alone', () => {
    const ids = weakAloneRuleIds([
      { id: 'a.b', weakAlone: true },
      { id: 'c.d' },
      { id: 'e.f', weakAlone: false },
    ]);
    expect([...ids]).toEqual(['a.b']);
  });
});

describe('policy constants', () => {
  it('names the date the upstream gives for AI-written text', () => {
    expect(AI_WRITING_EPOCH).toBe('2022-11-30');
  });

  it('defaults corroboration above one, matching the upstream wording "several"', () => {
    expect(DEFAULT_SUPPRESSION.weakAloneCorroboration).toBeGreaterThan(1);
  });
});
