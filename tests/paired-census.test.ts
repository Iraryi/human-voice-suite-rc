import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CENSUS = path.join(HERE, '..', 'benchmarks', 'external', 'paired-census.json');

interface Census {
  readonly source: string;
  readonly provenance: string;
  readonly exception: string;
  readonly splits: Record<string, number>;
  readonly sessions: number;
  readonly natural: { items: number; census: Record<string, number> };
  readonly balanced: { items: number; cells: number; census: Record<string, number> };
  readonly strata: Record<string, unknown>;
}

const raw = readFileSync(CENSUS, 'utf8');
const census = JSON.parse(raw) as Census;

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

describe('the committed paired census', () => {
  /**
   * The strong check, and the reason this file is allowed to exist in the repository at
   * all: the items it counts are unlicensed third-party dialogue, and the census cannot
   * carry any of it. Dialogue in this corpus is Chinese, so a file with no Han character
   * in it contains no dialogue — a property that is mechanical rather than a promise.
   */
  it('contains no Han character anywhere', () => {
    const han = raw.match(/\p{Script=Han}/gu);
    expect(han).toBeNull();
  });

  it('carries the two mandatory labels', () => {
    expect(census.provenance).toBe('license/provenance status: unclear for dialogue data');
    expect(census.exception).toBe('local evaluation exception; not redistributable by this project');
  });

  it('counts what it says it counted', () => {
    expect(sum(Object.values(census.natural.census))).toBe(census.natural.items);
    expect(sum(Object.values(census.balanced.census))).toBe(census.balanced.items);
    expect(Object.keys(census.balanced.census)).toHaveLength(census.balanced.cells);
    expect(sum(Object.values(census.splits))).toBe(census.sessions);
  });

  it('has a census keyed on the four strata the sampler balances on', () => {
    for (const cell of Object.keys(census.balanced.census)) {
      const parts = cell.split('|');
      expect(parts, cell).toHaveLength(4);
      const [kind, userLength, replyLength, type] = parts as [string, string, string, string];
      expect(['single', 'multi'], cell).toContain(kind);
      expect(['short', 'medium', 'long'], cell).toContain(userLength);
      expect(['short', 'medium', 'long'], cell).toContain(replyLength);
      expect(['question', 'statement', 'emotion', 'chitchat'], cell).toContain(type);
    }
  });

  it('gives the natural view LCCC’s own proportions and the balanced view even ones', () => {
    const balancedCounts = Object.values(census.balanced.census);
    const naturalCounts = Object.values(census.natural.census);
    const spread = (values: readonly number[]): number => Math.max(...values) - Math.min(...values);
    // Every cell is capped at the same per-stratum allowance, so the balanced view is
    // flat where the natural one is not. A balanced view that looked like the natural
    // one would mean the cap was not applied and the "balanced" claim was false.
    expect(balancedCounts.length).toBeGreaterThan(40);
    expect(spread(naturalCounts)).toBeGreaterThan(spread(balancedCounts));
  });
});
