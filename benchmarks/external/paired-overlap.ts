#!/usr/bin/env node
/**
 * `npm run paired:overlap`
 *
 * Do the same continuations trip a rule in every machine condition, or different ones?
 *
 * `paired:report` answers how often each rule fires. This answers whether the firings
 * are a property of the item — the context and what the model made of it — or a
 * near-random draw. The distinction matters for reading a 1% rate: a rule that catches
 * the *same* twenty replies whichever way they were produced is measuring something
 * stable; a rule whose firings are disjoint across conditions is closer to a coin toss
 * that happens to land on machine text.
 *
 * The comparison is against independence. If two conditions fired independently at their
 * observed rates, the expected overlap is `n * p1 * p2`, which for two rates near 1% is
 * a fraction of one item. Anything much above that is structure.
 *
 * Reads `.external-corpora/paired/firings.json`, which is gitignored: it was written
 * from LCCC contexts and stays with them.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PROVENANCE_LABEL, EXCEPTION_LABEL } from './labels.js';
import { CONDITIONS } from './conditions.js';
import type { Condition } from './conditions.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const FILE = path.join(ROOT, '.external-corpora', 'paired', 'firings.json');

const HUMAN = 'human' as const;
type Arm = typeof HUMAN | Condition;
const ARMS: readonly Arm[] = [HUMAN, ...CONDITIONS];

interface Firings {
  readonly items: number;
  readonly perItem: Record<string, Record<string, string[]>>;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function main(): number {
  if (!existsSync(FILE)) {
    process.stderr.write(
      `No ${path.relative(ROOT, FILE).split('\\').join('/')}. Run \`npm run paired:report\` first.\n`,
    );
    return 1;
  }
  const data = JSON.parse(readFileSync(FILE, 'utf8')) as Firings;
  const ids = Object.keys(data.perItem);
  const arms: Record<Arm, Set<string>[]> = { human: [], plain: [], default: [], post: [] };
  const perRule = new Map<string, Record<Arm, Set<string>>>();

  for (const id of ids) {
    const entry = data.perItem[id] ?? {};
    for (const arm of ARMS) {
      const fired = entry[arm] ?? [];
      arms[arm].push(new Set(fired));
      for (const ruleId of fired) {
        const row = perRule.get(ruleId) ?? { human: new Set(), plain: new Set(), default: new Set(), post: new Set() };
        row[arm].add(id);
        perRule.set(ruleId, row);
      }
    }
  }

  process.stdout.write('\nPaired overlap\n\n');
  process.stdout.write(`  items : ${ids.length}\n`);
  process.stdout.write(`  ${PROVENANCE_LABEL}\n  ${EXCEPTION_LABEL}\n\n`);

  process.stdout.write('Per rule: how many items it fired on, and how many of those it shares between conditions\n\n');
  process.stdout.write(
    `  ${'rule'.padEnd(30)}${'plain'.padStart(7)}${'deflt'.padStart(7)}${'post'.padStart(7)}${'human'.padStart(7)}   plain&deflt  expected\n`,
  );
  const machine = CONDITIONS;
  for (const [ruleId, row] of [...perRule.entries()].sort(
    (a, b) => b[1].plain.size + b[1].default.size + b[1].post.size - (a[1].plain.size + a[1].default.size + a[1].post.size),
  )) {
    const shared = [...row.plain].filter((id) => row.default.has(id)).length;
    const expected = (ids.length * (row.plain.size / ids.length) * (row.default.size / ids.length));
    process.stdout.write(
      `  ${ruleId.padEnd(30)}${String(row.plain.size).padStart(7)}${String(row.default.size).padStart(7)}` +
        `${String(row.post.size).padStart(7)}${String(row.human.size).padStart(7)}   ${String(shared).padStart(10)}  ${expected.toFixed(2).padStart(8)}\n`,
    );
  }

  process.stdout.write('\nItems carrying at least one rule, by condition\n\n');
  for (const arm of ARMS) {
    const counts = new Map<string, number>();
    let any = 0;
    for (const fired of arms[arm]) {
      if (fired.size > 0) any += 1;
      for (const ruleId of fired) counts.set(ruleId, (counts.get(ruleId) ?? 0) + 1);
    }
    const rules = [...counts.keys()].length;
    process.stdout.write(`  ${arm.padEnd(8)} ${String(any).padStart(5)} (${pct(any / ids.length)})  across ${rules} rule(s)\n`);
  }

  // How many conditions catch the same item, which is the question this file exists for.
  process.stdout.write('\nItems and how many machine conditions caught them\n\n');
  const spread = new Map<number, number>();
  for (const id of ids) {
    const entry = data.perItem[id] ?? {};
    const hit = machine.filter((condition) => (entry[condition] ?? []).length > 0).length;
    spread.set(hit, (spread.get(hit) ?? 0) + 1);
  }
  for (const count of [...spread.keys()].sort((a, b) => a - b)) {
    process.stdout.write(`  caught by ${count} condition(s): ${String(spread.get(count)).padStart(5)}\n`);
  }

  const anyMachine = ids.filter((id) => {
    const entry = data.perItem[id] ?? {};
    return machine.some((condition) => (entry[condition] ?? []).length > 0);
  }).length;
  process.stdout.write(
    `\n  ${anyMachine} item(s) (${pct(anyMachine / ids.length)}) were caught in at least one machine condition,\n` +
      `  ${ids.length - anyMachine} in none, and ${ids.filter((id) => (data.perItem[id]?.['human'] ?? []).length > 0).length} in the human control.\n\n`,
  );
  return 0;
}

process.exit(main());
