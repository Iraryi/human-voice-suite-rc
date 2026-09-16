/**
 * Rule migrations.
 *
 * A rule reference recorded against an old upstream revision has to keep
 * resolving after the upstream renumbers. `blader/humanizer` went from 33
 * numbered patterns at v2.9.1 to 25 at v3.0.0, so a stored finding that says
 * "pattern 14" means dashes if it was recorded against v2.9.1 and curly quotes
 * if it was recorded against v3.0.0. Reading one as the other is silent and
 * wrong.
 *
 * A migration re-expresses an old reference in current terms. It never edits
 * history: the old reference stays valid, and the migration says what it now
 * points at. That is the same discipline the alias table uses for renames.
 */

import {
  BLADER_REVISIONS,
  HUMANIZER_ZH_CN_DIVERGENCES,
  signatureAtRevision,
  translatePatternNumber,
} from '../upstream-version/index.js';
import type { BladerRevision } from '../upstream-version/index.js';

export const AREA = 'compatibility.migrations';
export const TARGET_PHASE = 3;

/** A reference to a rule as some upstream stated it, at some revision. */
export interface RuleReference {
  readonly upstream: string;
  readonly revision: string;
  /** The upstream's own identifier: a pattern number, or an id. */
  readonly ruleId: string;
}

export type MigrationOutcome =
  /** Re-expressed in current terms; the tell is still stated. */
  | 'migrated'
  /** The upstream dropped the tell; the canonical rule survives on its own. */
  | 'dropped-upstream'
  /** The reference was already current. */
  | 'unchanged'
  /** Nothing in this project knows how to resolve it. */
  | 'unknown';

export interface MigratedReference {
  readonly outcome: MigrationOutcome;
  readonly from: RuleReference;
  /** The canonical signature, when one could be resolved. */
  readonly signature?: string;
  /** The identifier at the target revision, when it has one. */
  readonly targetRuleId?: string;
  readonly note: string;
}

export interface Migration {
  readonly id: string;
  readonly upstream: string;
  readonly fromRevision: string;
  readonly toRevision: string;
  readonly description: string;
  readonly notes: readonly string[];
  apply(reference: RuleReference): MigratedReference;
}

const BLADER_UPSTREAM = 'blader/humanizer';

/**
 * v2.9.1 to v3.0.0.
 *
 * The renumbering is resolved through signatures rather than by a table of
 * number pairs, so a tell that survives under a different heading is found even
 * though its number changed, and a tell the new revision dropped is reported as
 * dropped rather than pointed at whatever number happens to match.
 */
export const bladerV291ToV300: Migration = {
  id: 'blader-v2.9.1-to-v3.0.0',
  upstream: BLADER_UPSTREAM,
  fromRevision: 'v2.9.1',
  toRevision: 'v3.0.0',
  description:
    'Renumbering from 33 patterns to 25, regrouped into five lettered sections. Resolved through canonical signatures so a changed number is still followed.',
  notes: [
    'Roughly a third of the v2.9.1 tells have no v3.0.0 counterpart; the new revision folded ' +
      'several into broader patterns and dropped the rest. Those are reported as dropped rather ' +
      'than mapped onto a number that no longer means the same thing.',
    'The v2.9.1 baseline is pinned by holygeek00/humanizer-zh-cn. Its own localization diverges ' +
      'from the baseline at two numbers, and those divergences are recorded separately.',
  ],
  apply(reference) {
    if (reference.upstream !== BLADER_UPSTREAM) {
      return {
        outcome: 'unknown',
        from: reference,
        note: `This migration covers ${BLADER_UPSTREAM}, not ${reference.upstream}.`,
      };
    }
    if (reference.revision === 'v3.0.0') {
      return { outcome: 'unchanged', from: reference, note: 'Already at the target revision.' };
    }
    if (reference.revision !== 'v2.9.1') {
      return {
        outcome: 'unknown',
        from: reference,
        note: `Revision ${reference.revision} is not a revision this migration knows.`,
      };
    }

    const signature = signatureAtRevision('v2.9.1', reference.ruleId);
    if (signature === undefined) {
      return {
        outcome: 'unknown',
        from: reference,
        note: `No v2.9.1 pattern numbered ${reference.ruleId}.`,
      };
    }

    const targetRuleId = translatePatternNumber('v2.9.1', 'v3.0.0', reference.ruleId);
    if (targetRuleId === undefined) {
      return {
        outcome: 'dropped-upstream',
        from: reference,
        signature,
        note:
          `v2.9.1 pattern ${reference.ruleId} (${signature}) has no v3.0.0 counterpart. ` +
          'The canonical rule survives on its own; no current upstream pattern states it.',
      };
    }

    return {
      outcome: 'migrated',
      from: reference,
      signature,
      targetRuleId,
      note: `v2.9.1 pattern ${reference.ruleId} is v3.0.0 pattern ${targetRuleId} (${signature}).`,
    };
  },
};

/**
 * The Chinese localization's own divergences.
 *
 * Not a revision change: this is the fork disagreeing with the baseline it
 * translated. Applied as a migration because the effect is the same — a
 * reference recorded against one has to be read correctly against the other.
 */
export const humanizerZhCnDivergence: Migration = {
  id: 'blader-v2.9.1-to-humanizer-zh-cn',
  upstream: BLADER_UPSTREAM,
  fromRevision: 'v2.9.1',
  toRevision: 'humanizer-zh-cn',
  description:
    'Two slots where holygeek00/humanizer-zh-cn retargeted the baseline pattern instead of translating it.',
  notes: HUMANIZER_ZH_CN_DIVERGENCES.map(
    (d) => `Pattern ${d.number}: ${d.upstream} became ${d.localized}. ${d.note}`,
  ),
  apply(reference) {
    if (reference.upstream !== BLADER_UPSTREAM || reference.revision !== 'v2.9.1') {
      return {
        outcome: 'unchanged',
        from: reference,
        note: 'This migration only concerns v2.9.1 references.',
      };
    }
    const divergence = HUMANIZER_ZH_CN_DIVERGENCES.find(
      (d) => String(d.number) === String(reference.ruleId),
    );
    if (!divergence) {
      return {
        outcome: 'unchanged',
        from: reference,
        signature: signatureAtRevision('v2.9.1', reference.ruleId),
        note: `Pattern ${reference.ruleId} was localized 1:1.`,
      };
    }
    return {
      outcome: 'migrated',
      from: reference,
      signature: signatureAtRevision('v2.9.1', reference.ruleId),
      targetRuleId: String(divergence.number),
      note: divergence.note,
    };
  },
};

export const MIGRATIONS: readonly Migration[] = [bladerV291ToV300, humanizerZhCnDivergence];

export function migrationById(id: string): Migration | undefined {
  return MIGRATIONS.find((migration) => migration.id === id);
}

export interface MigrationPlan {
  readonly migration: Migration;
  readonly results: readonly MigratedReference[];
  readonly summary: Readonly<Record<MigrationOutcome, number>>;
}

/**
 * Run a migration over a set of references without changing anything.
 *
 * A dry run is the only mode there is. The suite does not rewrite stored
 * findings; it reports what a migration would mean so a human can decide.
 */
export function dryRun(
  migration: Migration,
  references: readonly RuleReference[],
): MigrationPlan {
  const results = references.map((reference) => migration.apply(reference));
  const summary: Record<MigrationOutcome, number> = {
    migrated: 0,
    'dropped-upstream': 0,
    unchanged: 0,
    unknown: 0,
  };
  for (const result of results) summary[result.outcome] += 1;
  return { migration, results, summary };
}

export function renderMigrationReport(plan: MigrationPlan): string {
  const lines: string[] = [];
  lines.push(`# Migration: ${plan.migration.id}`);
  lines.push('');
  lines.push(plan.migration.description);
  lines.push('');
  lines.push(`- From: \`${plan.migration.fromRevision}\``);
  lines.push(`- To: \`${plan.migration.toRevision}\``);
  lines.push(`- References: ${plan.results.length}`);
  lines.push('');
  lines.push('| Outcome | Count |');
  lines.push('| --- | ---: |');
  for (const [outcome, count] of Object.entries(plan.summary)) {
    lines.push(`| \`${outcome}\` | ${count} |`);
  }
  lines.push('');
  if (plan.migration.notes.length > 0) {
    lines.push('## Notes');
    lines.push('');
    for (const note of plan.migration.notes) lines.push(`- ${note}`);
    lines.push('');
  }
  lines.push('## Every reference');
  lines.push('');
  lines.push('| Reference | Outcome | Signature | Note |');
  lines.push('| --- | --- | --- | --- |');
  for (const result of plan.results) {
    lines.push(
      `| \`${result.from.upstream}#${result.from.ruleId}@${result.from.revision}\` | ${result.outcome} | ${result.signature ? `\`${result.signature}\`` : '—'} | ${result.note} |`,
    );
  }
  lines.push('');
  lines.push('Nothing was modified. A migration reports; absorbing it is a decision.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

/** Every revision a migration could start from, for a caller that has one. */
export function knownRevisions(): readonly BladerRevision[] {
  return BLADER_REVISIONS.map((pin) => pin.revision);
}

export type { BladerRevision };
