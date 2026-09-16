/**
 * Stratified selection for the paired experiment.
 *
 * The balanced view is written cell by cell, so its first `perStratum` rows are one
 * cell and nothing else. Taking the head of it is not a stratified sample, it is a
 * single stratum wearing the name — which is exactly what the first run of this
 * experiment did, and why the report showed one user-turn bucket.
 *
 * The selection here is therefore round-robin across cells: one item from every cell,
 * then a second from every cell, and so on until the limit is reached. A limit of ten
 * per cell over fifty-nine cells is fifty-nine cells at ten, not one cell at five
 * hundred and ninety.
 *
 * It lives in its own module because importing a file that runs a command-line tool
 * has already broken this pipeline twice.
 */

import { compareText } from '../../src/shared/order.js';

/** The strata a balanced cell is defined by: the same four the sampler balances on. */
export function strataCell(strata: Record<string, string>): string {
  return [strata['kind'], strata['userLength'], strata['replyLength'], strata['type']].join('|');
}

export function censusOf(items: readonly Stratified[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const key = strataCell(item.strata);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

export interface Stratified {
  readonly id: string;
  readonly strata: Record<string, string>;
}

/**
 * Draw `limit` items, spread as evenly as the available cells allow.
 *
 * Items keep the order they arrived in inside their cell, and cells are visited in
 * sorted order, so the result is reproducible from the view file alone.
 */
export function selectStratified<T extends Stratified>(items: readonly T[], limit: number): T[] {
  const wanted = Math.max(0, Math.floor(limit));
  if (wanted >= items.length) return [...items];

  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = strataCell(item.strata);
    const list = groups.get(key);
    if (list === undefined) groups.set(key, [item]);
    else list.push(item);
  }
  const ordered = [...groups.entries()]
    .sort((a, b) => compareText(a[0], b[0]))
    .map(([, list]) => list);

  const out: T[] = [];
  for (let round = 0; out.length < wanted; round += 1) {
    let drew = false;
    for (const list of ordered) {
      const item = list[round];
      if (item === undefined) continue;
      out.push(item);
      drew = true;
      if (out.length >= wanted) break;
    }
    if (!drew) break;
  }
  return out;
}
