/**
 * Upstream revision compatibility.
 *
 * The claim these tests defend is narrow and load-bearing: a pattern number is
 * not an identifier, and the numbers below were transcribed from git rather than
 * reconstructed. Where the clones are present the transcription is checked
 * against them directly.
 */

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BLADER_REVISIONS,
  BLADER_V291_SIGNATURES,
  BLADER_V291_TITLES,
  HUMANIZER_ZH_CN_DIVERGENCES,
  renumberingSummary,
  revisionPin,
  signatureAtRevision,
  translatePatternNumber,
  verifiableRevisions,
} from '../src/compatibility/upstream-version/index.js';
import {
  MIGRATIONS,
  bladerV291ToV300,
  dryRun,
  humanizerZhCnDivergence,
  migrationById,
  renderMigrationReport,
} from '../src/compatibility/migrations/index.js';
import { BLADER_SIGNATURES } from '../src/upstream/adapters/blader/signatures.js';
import { isKnownSignature } from '../src/rules/canonical/signatures.js';
import { resolveProjectRoot } from '../src/upstream/manifest.js';

const projectRoot = resolveProjectRoot();
const bladerClone = path.join(projectRoot, '.upstream-cache', 'blader-humanizer');
const forkClone = path.join(projectRoot, '.upstream-cache', 'humanizer-zh-cn');
const clonesPresent = existsSync(bladerClone) && existsSync(forkClone);

function show(repo: string, ref: string): string {
  return execFileSync('git', ['show', `${ref}:SKILL.md`], {
    cwd: repo,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

function numberedTitles(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => /^###\s+(\d+)\.\s*(.+?)\s*$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => match[2]!);
}

describe('revision pins', () => {
  it('records three revisions with their pattern counts', () => {
    expect(BLADER_REVISIONS.map((p) => p.revision)).toEqual(['v2.1.0', 'v2.9.1', 'v3.0.0']);
    expect(revisionPin('v2.9.1')?.patternCount).toBe(33);
    expect(revisionPin('v3.0.0')?.patternCount).toBe(25);
  });

  it('marks the revision it cannot check as unavailable rather than guessing', () => {
    const unverifiable = BLADER_REVISIONS.filter((pin) => !pin.available);
    expect(unverifiable.map((pin) => pin.revision)).toEqual(['v2.1.0']);
    for (const pin of unverifiable) {
      expect(pin.commit).toBeNull();
      expect(pin.notes).toMatch(/not|unverif|cannot/i);
    }
  });

  it('says why each pin is trustworthy or not', () => {
    for (const pin of BLADER_REVISIONS) {
      expect(pin.notes.length, pin.revision).toBeGreaterThan(60);
    }
  });

  it('lists only checkable revisions as verifiable', () => {
    expect(verifiableRevisions()).toEqual(['v2.9.1', 'v3.0.0']);
  });
});

describe('the transcribed v2.9.1 data', () => {
  it('has 33 contiguous titles and a signature for every one', () => {
    expect(BLADER_V291_TITLES).toHaveLength(33);
    expect(Object.keys(BLADER_V291_SIGNATURES)).toHaveLength(33);
    for (let n = 1; n <= 33; n += 1) {
      expect(BLADER_V291_SIGNATURES[String(n)], String(n)).toBeDefined();
    }
  });

  it('uses only signatures from the vocabulary', () => {
    for (const [number, signature] of Object.entries(BLADER_V291_SIGNATURES)) {
      expect(isKnownSignature(signature), `${number} ${signature}`).toBe(true);
    }
  });
});

describe.skipIf(!clonesPresent)('checked against the clones', () => {
  it('reproduces the v2.9.1 titles from the fork exactly', () => {
    const markdown = show(forkClone, '523374dee72d67c7b2b5f858ea0094ffda49c3ac');
    expect(numberedTitles(markdown)).toEqual([...BLADER_V291_TITLES]);
  });

  it('agrees with the v2.9.1 tag, which is why the pin is called v2.9.1', () => {
    expect(numberedTitles(show(bladerClone, 'v2.9.1'))).toEqual([...BLADER_V291_TITLES]);
  });

  it('reproduces the v3.0.0 pattern count from the pinned HEAD', () => {
    const titles = numberedTitles(show(bladerClone, 'HEAD'));
    expect(titles).toHaveLength(25);
    expect(titles[0]).toBe('Not X but Y');
    expect(titles[7]).toBe('Dashes as the universal connector');
  });

  it('confirms the baseline commit is reachable from both clones', () => {
    // Checked rather than assumed, and the first version of this test asserted
    // the opposite because a shell quoting mistake made the lookup look like it
    // had failed. The commit is in both.
    const has = (repo: string): boolean => {
      try {
        execFileSync('git', ['cat-file', '-e', '523374dee72d67c7b2b5f858ea0094ffda49c3ac^{commit}'], {
          cwd: repo,
          stdio: 'ignore',
        });
        return true;
      } catch {
        return false;
      }
    };
    expect(has(bladerClone)).toBe(true);
    expect(has(forkClone)).toBe(true);
  });
});

describe('resolveAtRevision', () => {
  it('gives different numbers the same signature across the renumbering', () => {
    // "Avoid dashes" is 14 at v2.9.1 and 8 at v3.0.0. That difference is the
    // whole reason a pattern number is not an identifier.
    expect(signatureAtRevision('v2.9.1', 14)).toBe('rhythm.dash_overuse');
    expect(signatureAtRevision('v3.0.0', 8)).toBe('rhythm.dash_overuse');
    expect(signatureAtRevision('v2.9.1', 8)).toBe('lexical.copula_avoidance');
    expect(signatureAtRevision('v3.0.0', 14)).toBe('lexical.vague_attribution');
  });

  it('claims nothing for the revision it cannot read', () => {
    for (let n = 1; n <= 24; n += 1) {
      expect(signatureAtRevision('v2.1.0', n), String(n)).toBeUndefined();
    }
  });

  it('returns nothing for a number that does not exist', () => {
    expect(signatureAtRevision('v3.0.0', 99)).toBeUndefined();
    expect(signatureAtRevision('v2.9.1', 0)).toBeUndefined();
  });
});

describe('translatePatternNumber', () => {
  it('follows a tell whose number changed', () => {
    expect(translatePatternNumber('v2.9.1', 'v3.0.0', 14)).toBe('8');
    expect(translatePatternNumber('v3.0.0', 'v2.9.1', 8)).toBe('14');
  });

  it('is the identity within one revision', () => {
    expect(translatePatternNumber('v3.0.0', 'v3.0.0', 12)).toBe('12');
  });

  it('returns undefined for a tell the target revision dropped', () => {
    // v2.9.1 pattern 22 is sycophancy, which v3.0.0 has no pattern for.
    expect(signatureAtRevision('v2.9.1', 22)).toBe('assistant.sycophancy');
    expect(translatePatternNumber('v2.9.1', 'v3.0.0', 22)).toBeUndefined();
  });
});

describe('renumberingSummary', () => {
  it('accounts for every v2.9.1 number as carried or dropped', () => {
    const summary = renumberingSummary();
    expect(summary.carried.length + summary.droppedAtV300.length).toBe(33);
  });

  it('reports that v3.0.0 added tells the old revision had not named', () => {
    const summary = renumberingSummary();
    expect(summary.addedAtV300.length).toBeGreaterThan(0);
    for (const entry of summary.addedAtV300) {
      expect(isKnownSignature(entry.signature)).toBe(true);
    }
  });
});

describe('localization divergences', () => {
  it('records exactly the slots the fork retargeted', () => {
    expect(HUMANIZER_ZH_CN_DIVERGENCES.map((d) => d.number).sort((a, b) => a - b)).toEqual([7, 19]);
  });

  it('names the upstream pattern and what replaced it', () => {
    for (const divergence of HUMANIZER_ZH_CN_DIVERGENCES) {
      expect(divergence.upstream.length).toBeGreaterThan(10);
      expect(divergence.localized.length).toBeGreaterThan(2);
      expect(divergence.note.length).toBeGreaterThan(60);
    }
  });
});

describe('the migration registry', () => {
  it('exposes both migrations', () => {
    expect(MIGRATIONS.map((m) => m.id)).toEqual([
      'blader-v2.9.1-to-v3.0.0',
      'blader-v2.9.1-to-humanizer-zh-cn',
    ]);
    expect(migrationById('blader-v2.9.1-to-v3.0.0')).toBe(bladerV291ToV300);
    expect(migrationById('nobody')).toBeUndefined();
  });

  it('states its own notes rather than relying on a caller', () => {
    for (const migration of MIGRATIONS) {
      expect(migration.notes.length, migration.id).toBeGreaterThan(0);
      expect(migration.description.length, migration.id).toBeGreaterThan(40);
    }
  });
});

describe('the v2.9.1 to v3.0.0 migration', () => {
  it('follows a tell through the renumbering', () => {
    const result = bladerV291ToV300.apply({
      upstream: 'blader/humanizer',
      revision: 'v2.9.1',
      ruleId: '14',
    });
    expect(result.outcome).toBe('migrated');
    expect(result.signature).toBe('rhythm.dash_overuse');
    expect(result.targetRuleId).toBe('8');
  });

  it('reports a dropped tell as dropped rather than pointing at a number', () => {
    const result = bladerV291ToV300.apply({
      upstream: 'blader/humanizer',
      revision: 'v2.9.1',
      ruleId: '22',
    });
    expect(result.outcome).toBe('dropped-upstream');
    expect(result.signature).toBe('assistant.sycophancy');
    expect(result.targetRuleId).toBeUndefined();
  });

  it('leaves a current reference alone', () => {
    const result = bladerV291ToV300.apply({
      upstream: 'blader/humanizer',
      revision: 'v3.0.0',
      ruleId: '8',
    });
    expect(result.outcome).toBe('unchanged');
  });

  it('declines a reference it does not cover instead of guessing', () => {
    expect(
      bladerV291ToV300.apply({ upstream: 'someone/else', revision: 'v2.9.1', ruleId: '1' }).outcome,
    ).toBe('unknown');
    expect(
      bladerV291ToV300.apply({ upstream: 'blader/humanizer', revision: 'v9', ruleId: '1' }).outcome,
    ).toBe('unknown');
    expect(
      bladerV291ToV300.apply({ upstream: 'blader/humanizer', revision: 'v2.9.1', ruleId: '999' })
        .outcome,
    ).toBe('unknown');
  });

  it('accounts for every v2.9.1 number when run over all of them', () => {
    const references = Array.from({ length: 33 }, (_, i) => ({
      upstream: 'blader/humanizer',
      revision: 'v2.9.1',
      ruleId: String(i + 1),
    }));
    const plan = dryRun(bladerV291ToV300, references);
    expect(plan.summary.migrated + plan.summary['dropped-upstream']).toBe(33);
    expect(plan.summary.unknown).toBe(0);
  });
});

describe('the localization divergence migration', () => {
  it('flags the retargeted slots and passes the rest through', () => {
    expect(
      humanizerZhCnDivergence.apply({
        upstream: 'blader/humanizer',
        revision: 'v2.9.1',
        ruleId: '7',
      }).note,
    ).toContain('abstract verbs');

    const untouched = humanizerZhCnDivergence.apply({
      upstream: 'blader/humanizer',
      revision: 'v2.9.1',
      ruleId: '8',
    });
    expect(untouched.outcome).toBe('unchanged');
    expect(untouched.note).toContain('1:1');
  });

  it('ignores references that are not v2.9.1', () => {
    expect(
      humanizerZhCnDivergence.apply({
        upstream: 'blader/humanizer',
        revision: 'v3.0.0',
        ruleId: '7',
      }).outcome,
    ).toBe('unchanged');
  });
});

describe('the dry run', () => {
  it('reports rather than modifies, and says so in the report', () => {
    const plan = dryRun(bladerV291ToV300, [
      { upstream: 'blader/humanizer', revision: 'v2.9.1', ruleId: '1' },
      { upstream: 'blader/humanizer', revision: 'v2.9.1', ruleId: '22' },
    ]);
    expect(plan.summary.migrated).toBe(1);
    expect(plan.summary['dropped-upstream']).toBe(1);

    const markdown = renderMigrationReport(plan);
    expect(markdown).toContain('Nothing was modified');
    expect(markdown).toContain('blader/humanizer#1@v2.9.1');
    expect(markdown).toContain('dropped-upstream');
  });

  it('counts every outcome it can produce', () => {
    const plan = dryRun(bladerV291ToV300, []);
    expect(Object.keys(plan.summary).sort()).toEqual([
      'dropped-upstream',
      'migrated',
      'unchanged',
      'unknown',
    ]);
  });
});

describe('the two vocabularies stay aligned', () => {
  it('keys both revisions on the same signature space', () => {
    // Every signature that appears in both revisions must be one the canonical
    // registry knows, or a migrated reference would resolve to nothing.
    for (const signature of Object.values(BLADER_V291_SIGNATURES)) {
      expect(isKnownSignature(signature), signature).toBe(true);
    }
    for (const signature of Object.values(BLADER_SIGNATURES)) {
      expect(isKnownSignature(signature), signature).toBe(true);
    }
  });
});
