/**
 * Deterministic ordering.
 *
 * `String.prototype.localeCompare` is the natural way to sort strings and it is the wrong one for
 * anything this project **generates and commits**. Its result depends on the runtime's locale, which
 * comes from the environment: the same repository, the same commit and the same command can produce
 * different orderings on two machines, and an artefact whose `--check` compares generated content
 * byte for byte then disagrees with itself.
 *
 * That is not hypothetical. `PHRASE_OWNERSHIP.md` is generated from seventy-nine contested phrases,
 * most of them Chinese, and it was current on the machine that generated it and stale in CI for the
 * whole life of the workflow — the list was sorted with `localeCompare` and the two platforms
 * collated Han characters differently.
 *
 * Code-point order is ugly for a human to read (uppercase before lowercase, `_` after letters) and
 * it is **identical everywhere**, which is the property that matters for a committed artefact. Where
 * a reader would prefer a natural sort, sort a display list; never sort a file by it.
 */

/** Locale-independent string comparison, for anything whose order is committed or compared. */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Ordering by one key, then another, then code point.
 *
 * The tail matters: a comparator that returns 0 for two different values leaves the order to
 * `Array.prototype.sort`'s stability and to the input order, which is stable within a run and
 * therefore hides the problem until the input order changes for an unrelated reason.
 */
export function byKey<T>(...keys: ReadonlyArray<(value: T) => number | string>): (a: T, b: T) => number {
  return (a, b) => {
    for (const key of keys) {
      const left = key(a);
      const right = key(b);
      if (typeof left === 'number' && typeof right === 'number') {
        if (left !== right) return left - right;
        continue;
      }
      const compared = compareText(String(left), String(right));
      if (compared !== 0) return compared;
    }
    return 0;
  };
}
