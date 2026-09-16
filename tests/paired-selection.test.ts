import { describe, expect, it } from 'vitest';

import { censusOf, selectStratified, strataCell } from '../benchmarks/external/selection.js';

interface Item {
  readonly id: string;
  readonly strata: Record<string, string>;
}

function item(id: string, kind: string, userLength: string, replyLength: string, type: string): Item {
  return { id, strata: { kind, userLength, replyLength, type } };
}

/** A view shaped like the real one: cells written one after another, not interleaved. */
function viewPerCell(cells: readonly string[], perCell: number): Item[] {
  const out: Item[] = [];
  for (const cell of cells) {
    const [kind, userLength, replyLength, type] = cell.split('|') as [string, string, string, string];
    for (let index = 0; index < perCell; index += 1) {
      out.push(item(`${cell}-${index}`, kind, userLength, replyLength, type));
    }
  }
  return out;
}

describe('strataCell', () => {
  it('is the four strata the sampler balances on, in the sampler’s order', () => {
    expect(
      strataCell({ kind: 'single', userLength: 'short', replyLength: 'long', type: 'question' }),
    ).toBe('single|short|long|question');
  });
});

describe('selectStratified', () => {
  it('does not take the head of the file, which is one cell', () => {
    const view = viewPerCell(
      [
        'single|short|short|question',
        'single|short|short|statement',
        'multi|long|medium|emotion',
      ],
      120,
    );
    const selected = selectStratified(view, 120);
    expect(selected).toHaveLength(120);
    // The bug this guards: `slice(0, 120)` returns 120 items of the first cell.
    expect(new Set(selected.map((entry) => strataCell(entry.strata))).size).toBe(3);
    expect(censusOf(selected)['single|short|short|question']).toBe(40);
  });

  it('spreads the remainder over cells rather than exhausting one', () => {
    const view = viewPerCell(['a|short|short|question', 'b|short|short|question'], 10);
    const counts = Object.values(censusOf(selectStratified(view, 5))).sort();
    expect(counts).toEqual([2, 3]);
  });

  it('returns everything, in order, when the limit exceeds the view', () => {
    const view = viewPerCell(['a|short|short|question'], 7);
    expect(selectStratified(view, 100).map((entry) => entry.id)).toEqual(view.map((e) => e.id));
  });

  it('is deterministic and does not mutate its input', () => {
    const view = viewPerCell(['a|short|short|question', 'b|long|long|statement'], 4);
    const before = [...view];
    const first = selectStratified(view, 5).map((entry) => entry.id);
    const second = selectStratified(view, 5).map((entry) => entry.id);
    expect(first).toEqual(second);
    expect(view).toEqual(before);
  });

  it('handles an empty view and a zero limit', () => {
    expect(selectStratified([], 10)).toEqual([]);
    expect(selectStratified(viewPerCell(['a|short|short|question'], 3), 0)).toEqual([]);
  });
});
