/**
 * Provenance reporting.
 *
 * Turns the rule registry's `sources` / `localChanges` data into something a
 * human can audit, and into the numbers that justify (or condemn) each
 * upstream's place in the suite.
 */

import type { CanonicalRule } from '../types.js';
import { LOCAL_UPSTREAM, isLocalOnly } from './types.js';
import { compareText } from '../../shared/order.js';

export interface UpstreamContribution {
  readonly upstream: string;
  /** Rules where this upstream is one of the sources. */
  readonly ruleCount: number;
  /** Rules this upstream claimed alone. */
  readonly exclusiveRuleCount: number;
  /** Rules where this upstream's claim was folded together with another's. */
  readonly sharedRuleCount: number;
}

export interface ProvenanceReport {
  readonly generatedAt: string;
  readonly totalRules: number;
  readonly localOnlyRuleCount: number;
  readonly crossUpstreamRuleCount: number;
  readonly multiSourceRuleCount: number;
  readonly upstreams: readonly UpstreamContribution[];
  /** Rules whose provenance is a single source and therefore thin. */
  readonly singleSourceRules: readonly string[];
  /** Rules that collapsed a lineage — the anti-double-counting evidence. */
  readonly lineageCollapsedRules: readonly LineageCollapse[];
}

export interface LineageCollapse {
  readonly ruleId: string;
  readonly upstreams: readonly string[];
  readonly memberCount: number;
}

export function buildProvenanceReport(
  rules: readonly CanonicalRule[],
  generatedAt: string = new Date().toISOString(),
): ProvenanceReport {
  const contributions = new Map<string, { total: number; exclusive: number; shared: number }>();
  const singleSourceRules: string[] = [];
  const lineageCollapsed: LineageCollapse[] = [];
  let localOnly = 0;
  let crossUpstream = 0;
  let multiSource = 0;

  for (const rule of rules) {
    const upstreams = [...new Set(rule.sources.map((s) => s.upstream))];
    const external = upstreams.filter((u) => u !== LOCAL_UPSTREAM);

    if (isLocalOnly(rule.sources)) localOnly += 1;
    if (external.length > 1) {
      crossUpstream += 1;
      lineageCollapsed.push({
        ruleId: rule.id,
        upstreams: external,
        memberCount: rule.sources.length,
      });
    }
    if (rule.sources.length > 1) multiSource += 1;
    if (rule.sources.length === 1) singleSourceRules.push(rule.id);

    for (const upstream of upstreams) {
      const entry = contributions.get(upstream) ?? { total: 0, exclusive: 0, shared: 0 };
      entry.total += 1;
      if (upstreams.length === 1) entry.exclusive += 1;
      else entry.shared += 1;
      contributions.set(upstream, entry);
    }
  }

  const upstreams: UpstreamContribution[] = [...contributions.entries()]
    .map(([upstream, counts]) => ({
      upstream,
      ruleCount: counts.total,
      exclusiveRuleCount: counts.exclusive,
      sharedRuleCount: counts.shared,
    }))
    .sort((a, b) => b.ruleCount - a.ruleCount || compareText(a.upstream, b.upstream));

  return {
    generatedAt,
    totalRules: rules.length,
    localOnlyRuleCount: localOnly,
    crossUpstreamRuleCount: crossUpstream,
    multiSourceRuleCount: multiSource,
    upstreams,
    singleSourceRules,
    lineageCollapsedRules: lineageCollapsed,
  };
}

export function renderProvenanceMarkdown(report: ProvenanceReport): string {
  const lines: string[] = [];
  lines.push('# Rule provenance report');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(`- Total canonical rules: **${report.totalRules}**`);
  lines.push(`- Rules claimed by more than one upstream: **${report.crossUpstreamRuleCount}**`);
  lines.push(`- Rules that are entirely local to this project: **${report.localOnlyRuleCount}**`);
  lines.push('');
  lines.push('## Upstream contribution');
  lines.push('');
  lines.push('| Upstream | Rules | Exclusive | Shared with another upstream |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const upstream of report.upstreams) {
    lines.push(
      `| \`${upstream.upstream}\` | ${upstream.ruleCount} | ${upstream.exclusiveRuleCount} | ${upstream.sharedRuleCount} |`,
    );
  }
  lines.push('');

  if (report.lineageCollapsedRules.length > 0) {
    lines.push('## Lineages collapsed by deduplication');
    lines.push('');
    lines.push('These tells were independently claimed by more than one upstream and correctly');
    lines.push('occupy a single canonical slot:');
    lines.push('');
    lines.push('| Canonical rule | Claimed by | Claims folded |');
    lines.push('| --- | --- | ---: |');
    for (const collapse of report.lineageCollapsedRules) {
      lines.push(
        `| \`${collapse.ruleId}\` | ${collapse.upstreams.map((u) => `\`${u}\``).join(', ')} | ${collapse.memberCount} |`,
      );
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}
