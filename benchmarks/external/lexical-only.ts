#!/usr/bin/env node
/**
 * `npm run lexical:sheet` and `npm run lexical:tally`
 *
 * The forty-five replies where `chat.unsolicited_advice` fires and the reply is **not** shaped like an
 * action plan — the lexical-only cell of `COVERAGE_MATRIX.md`. Reading them decides what that rule
 * actually is.
 *
 * ## The question is not "why is the rule wrong"
 *
 * It is "what happens in these forty-five". A rule that fires on lightweight advice, on advice about
 * somebody else, or on legitimate advice after an explicit request is doing something even if its name
 * overclaims. A rule that fires on generic hypothetical constructions is a language feature, not a
 * behaviour. The classification below separates those, and reports two things that decide the final
 * status:
 *
 * | Field | Why it decides |
 * | --- | --- |
 * | `directed at the user` | "你可以先……" and "如果有人遇到这种情况，可以……" are not the same act, and a rule that cannot tell them apart is a language feature |
 * | `requires context to judge` | A rule whose verdict depends on the user turn is a conversation feature and belongs behind the permission layer, not in a response-only detector |
 *
 * The replies are HelpSteer3 text: read locally, counted here, never committed.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { solutionFeatures } from './solution-mode.js';
import { hasAdviceMarker } from './solution-mode.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const CORPUS = path.join(ROOT, '.external-corpora', 'helpsteer3');
const DIR = path.join(ROOT, '.external-corpora', 'review');
const OUT = path.join(HERE, 'LEXICAL_ONLY_CLASSIFICATION.md');

export const CATEGORIES = [
  'lightweight_advice',
  'generic_hypothetical',
  'third_party_advice',
  'legitimate_after_permission',
  'phrase_false_positive',
  'other',
  'uncertain',
] as const;

interface Item {
  readonly id: string;
  readonly userTurn: string;
  readonly text: string;
}

function collect(): Item[] {
  const items: Item[] = [];
  for (const file of ['preference-train.jsonl.gz', 'preference-validation.jsonl.gz']) {
    const full = path.join(CORPUS, file);
    if (!existsSync(full)) continue;
    const raw = gunzipSync(readFileSync(full)).toString('utf8');
    for (const line of raw.split('\n')) {
      if (line.trim().length === 0) continue;
      let row: {
        language?: string;
        context?: Array<{ role: string; content: string }>;
        response1?: string;
        response2?: string;
      };
      try {
        row = JSON.parse(line) as typeof row;
      } catch {
        continue;
      }
      if ((row.language ?? '') !== 'chinese' || !Array.isArray(row.context)) continue;
      const lastUser = [...row.context].reverse().find((turn) => turn.role === 'user');
      const userTurn = lastUser?.content ?? '';
      for (const text of [row.response1, row.response2]) {
        if (typeof text !== 'string' || text.trim().length === 0) continue;
        if (!hasAdviceMarker(text)) continue;
        if (solutionFeatures(text).isPlan) continue;
        items.push({ id: `L-${String(items.length + 1).padStart(3, '0')}`, userTurn, text: text.trim() });
      }
    }
  }
  return items;
}

function sheet(): number {
  const items = collect();
  mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, 'lexical-only-sheet.md');
  writeFileSync(
    file,
    [
      '# Lexical-only sheet',
      '',
      `${items.length} replies where the advice rule fires and the reply is not plan-shaped.`,
      '',
      'For each, record the category, then four yes/no/uncertain fields: assistant-shaped, requires user',
      'context to judge, contains action-plan structure, directed at the user.',
      '',
      '---',
      '',
      ...items.flatMap((item) => [
        `### ${item.id}`,
        '',
        `**user**: ${item.userTurn.replace(/\n/g, ' / ').slice(0, 600)}`,
        '',
        `**response**: ${item.text.replace(/\n/g, ' / ')}`,
        '',
        '',
      ]),
    ].join('\n'),
    'utf8',
  );
  process.stdout.write(`\nLexical-only sheet: ${items.length} replies\n  ${path.relative(ROOT, file).split('\\').join('/')}\n`);
  return 0;
}

function tally(): number {
  const items = collect();
  const labelDir = path.join(DIR, 'labels');
  const rows: Array<Record<string, string>> = [];
  if (existsSync(labelDir)) {
    for (const file of readdirSync(labelDir).filter((name) => name.startsWith('lexical-') && name.endsWith('.jsonl'))) {
      for (const line of readFileSync(path.join(labelDir, file), 'utf8').split('\n')) {
        if (line.trim().length === 0) continue;
        try {
          rows.push(JSON.parse(line) as Record<string, string>);
        } catch {
          /* counted by its absence */
        }
      }
    }
  }
  const byId = new Map(rows.map((row) => [row['id'] ?? '', row]));
  const pct = (value: number, total: number): string => `${((value / Math.max(1, total)) * 100).toFixed(0)}%`;
  const count = (field: string, value: string): number =>
    items.filter((item) => (byId.get(item.id)?.[field] ?? '').toLowerCase() === value).length;

  const lines: string[] = [];
  const push = (...text: string[]): void => {
    for (const line of text) lines.push(line);
  };
  push(
    '# What the lexical advice rule fires on when the reply is not a plan',
    '',
    '<!-- Generated by `npm run lexical:tally`. Counts only: no source text. -->',
    '',
    `The lexical-only cell of \`COVERAGE_MATRIX.md\`: ${items.length} replies where \`chat.unsolicited_advice\` fires and`,
    'the frozen structural features see no action plan. Read locally, classified by category and four',
    'questions, counted here.',
    '',
    '| Category | Replies |',
    '| --- | --- |',
    ...CATEGORIES.map((category) => `| \`${category}\` | ${count('category', category)} |`),
    '',
    '## The two fields that decide the rule’s status',
    '',
    '| Question | yes | no | uncertain |',
    '| --- | --- | --- | --- |',
    ...['directed_at_user', 'requires_context', 'assistant_shaped', 'action_plan_structure'].map(
      (field) =>
        `| ${field} | ${count(field, 'yes')} | ${count(field, 'no')} | ${count(field, 'uncertain')} |`,
    ),
    '',
    '## What the rule is, by the evidence',
    '',
    `- **Direct-to-user advice**: ${count('directed_at_user', 'yes')} of ${items.length} (${pct(count('directed_at_user', 'yes'), items.length)}).`,
    `- **Generic or hypothetical advice**: ${count('category', 'generic_hypothetical')}.`,
    `- **Advice about a third party**: ${count('category', 'third_party_advice')}.`,
    `- **Advice that was legitimate because the user asked**: ${count('category', 'legitimate_after_permission')}.`,
    `- **Phrase-level false positives**: ${count('category', 'phrase_false_positive')}.`,
    `- **Assistant-shaped among them**: ${count('assistant_shaped', 'yes')} of ${items.length} (${pct(count('assistant_shaped', 'yes'), items.length)}).`,
    `- **Needing the user turn to judge**: ${count('requires_context', 'yes')} of ${items.length} (${pct(count('requires_context', 'yes'), items.length)}).`,
    '',
    `Generated ${new Date().toISOString()} from ${items.length} replies; ${rows.length} labelled.`,
    '',
  );
  writeFileSync(OUT, `${lines.join('\n')}\n`, 'utf8');
  process.stdout.write(`\nLexical-only tally: ${rows.length}/${items.length} labelled\n`);
  process.stdout.write(`  directed at user: ${count('directed_at_user', 'yes')}, assistant-shaped: ${count('assistant_shaped', 'yes')}, needs context: ${count('requires_context', 'yes')}\n`);
  process.stdout.write(`  written to ${path.relative(ROOT, OUT).split('\\').join('/')}\n`);
  return 0;
}

const command = process.argv[2];
process.exit(command === 'sheet' ? sheet() : command === 'tally' ? tally() : 1);
