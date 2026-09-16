#!/usr/bin/env node
/**
 * `npm run review:condition` and `npm run review:sheet`
 *
 * The two instruments a rule has to pass before anything is concluded about it: automatic
 * conditioning, and a blind sheet for reading the replies by hand.
 *
 * ## Why the sheet is blind
 *
 * Knowing that a reply tripped `auto_summary` is enough to start seeing summaries in it. A review
 * that knows which group a sample came from measures the reader's expectation, not the rule. So the
 * sheet hides, and this tool is what hides it:
 *
 * | Shown | Hidden until after labelling |
 * | --- | --- |
 * | Sample id, the user turn, the reply | Whether it fired |
 * | — | Which rule was being reviewed |
 * | — | Every diagnostic: overlap ratios, lengths, buckets |
 * | — | Whether it is a trigger or a matched negative |
 *
 * Trigger and matched negative are shuffled together in one list, and the key is written to a
 * separate gitignored file. The labels are recorded first; the unblinding happens afterwards, in
 * `review:condition`.
 *
 * ## Matching
 *
 * Each trigger is paired with a negative matched on response length, turn count and domain, because
 * the first question about both rules is whether they are measuring behaviour or length. A pair that
 * differs in length by more than the bucket cannot answer that question, so the matcher refuses to
 * make one and the sample is reported as unmatched rather than quietly paired with a bad partner.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createToolkit } from '../../src/dsh/tools/runtime.js';
import { compareText } from '../../src/shared/order.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const CORPUS = path.join(ROOT, '.external-corpora', 'helpsteer3');
const DIR = path.join(ROOT, '.external-corpora', 'review');
const REPORT = path.join(HERE, 'RULE_CONDITIONING.md');

const RULES = ['chat.auto_summary', 'chat.mirrors_user', 'chat.unsolicited_offer'] as const;
type Rule = (typeof RULES)[number];

function sha256(text: string): string {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function valueOf(flag: string, fallback: string): string {
  const argv = process.argv.slice(2);
  const at = argv.indexOf(flag);
  return at === -1 ? fallback : (argv[at + 1] ?? fallback);
}

/** The frozen code list, hashed into the sheet. `--rubric <path>`; none means no sheet. */
const RUBRIC = process.argv.includes('--rubric')
  ? path.resolve(ROOT, valueOf('--rubric', ''))
  : undefined;

/** Cap on triggers, so a corpus with hundreds of firings can be reviewed in a bounded batch. */
const LIMIT = Number(valueOf('--limit', '100000'));

interface Sample {
  readonly id: string;
  readonly domain: string;
  readonly turns: number;
  readonly userTurn: string;
  readonly context: string;
  readonly text: string;
  fired: boolean;
  readonly chars: number;
}

function loadSamples(): Sample[] {
  const out: Sample[] = [];
  for (const file of ['preference-train.jsonl.gz', 'preference-validation.jsonl.gz']) {
    const full = path.join(CORPUS, file);
    if (!existsSync(full)) continue;
    const raw = gunzipSync(readFileSync(full)).toString('utf8');
    for (const line of raw.split('\n')) {
      if (line.trim().length === 0) continue;
      let row: {
        domain?: string;
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
      const context = row.context;
      const lastUser = [...context].reverse().find((turn) => turn.role === 'user');
      const userTurn = lastUser?.content ?? '';
      const turns = context.filter((turn) => turn.role === 'user').length;
      const joined = context.map((turn) => turn.content).join('\n');
      for (const [slot, text] of [
        ['1', row.response1],
        ['2', row.response2],
      ] as const) {
        if (typeof text !== 'string' || text.trim().length === 0) continue;
        out.push({
          id: `${file.startsWith('preference-train') ? 'tr' : 'va'}-${out.length}-${slot}`,
          domain: row.domain ?? 'unknown',
          turns,
          userTurn,
          context: joined.slice(0, 1200),
          text: text.trim(),
          fired: false,
          chars: text.trim().length,
        });
      }
    }
  }
  return out;
}

async function scan(samples: Sample[], rule: Rule): Promise<void> {
  const toolkit = await createToolkit({ projectRoot: ROOT });
  let done = 0;
  for (const sample of samples) {
    const scanned = await toolkit.scan({
      text: sample.text,
      mode: 'chat',
      families: ['assistant'],
      conversation: { userTurn: sample.userTurn },
    });
    sample.fired = scanned.canonicalFindings.some(
      (finding) => (finding.canonicalRuleId ?? finding.ruleId) === rule,
    );
    done += 1;
    if (done % 500 === 0) process.stderr.write(`  ${done}/${samples.length}\r`);
  }
  process.stderr.write('\n');
}

/** Response-length buckets, in characters. Long answers are the register these rules are read in. */
function lengthBucket(chars: number): string {
  if (chars < 200) return 'xs<200';
  if (chars < 600) return 'short<600';
  if (chars < 1500) return 'medium<1500';
  return 'long>=1500';
}

function rate(fires: number, n: number): string {
  return `${fires}/${n} (${((fires / Math.max(1, n)) * 100).toFixed(2)}%)`;
}

async function condition(rule: Rule): Promise<number> {
  const samples = loadSamples();
  if (samples.length === 0) {
    process.stderr.write('No HelpSteer3 Chinese rows. Fetch the preference splits first.\n');
    return 1;
  }
  await scan(samples, rule);

  const by = (key: (sample: Sample) => string): Map<string, { n: number; fired: number }> => {
    const out = new Map<string, { n: number; fired: number }>();
    for (const sample of samples) {
      const k = key(sample);
      const entry = out.get(k) ?? { n: 0, fired: 0 };
      entry.n += 1;
      if (sample.fired) entry.fired += 1;
      out.set(k, entry);
    }
    return out;
  };

  const fires = samples.filter((sample) => sample.fired);
  const lines: string[] = [];
  const push = (...text: string[]): void => {
    for (const line of text) lines.push(line);
  };

  push(
    `## ${rule}`,
    '',
    `| | |`,
    `| --- | --- |`,
    `| Corpus | HelpSteer3, Chinese rows, \`preference\` config only |`,
    `| Responses | ${samples.length} |`,
    `| Firings | ${rate(fires.length, samples.length)} |`,
    `| Mean length, fired | ${(fires.reduce((sum, s) => sum + s.chars, 0) / Math.max(1, fires.length)).toFixed(0)} characters |`,
    `| Mean length, all | ${(samples.reduce((sum, s) => sum + s.chars, 0) / samples.length).toFixed(0)} characters |`,
    '',
    `### By response length`,
    '',
    '| Bucket | Firings |',
    '| --- | --- |',
    ...[...by((s) => lengthBucket(s.chars)).entries()]
      .sort((a, b) => compareText(a[0], b[0]))
      .map(([bucket, entry]) => `| \`${bucket}\` | ${rate(entry.fired, entry.n)} |`),
    '',
    `### By turn count`,
    '',
    '| Turns | Firings |',
    '| --- | --- |',
    ...[...by((s) => (s.turns <= 1 ? 'single' : 'multi')).entries()].map(
      ([turns, entry]) => `| \`${turns}\` | ${rate(entry.fired, entry.n)} |`,
    ),
    '',
    `### By domain`,
    '',
    '| Domain | Firings |',
    '| --- | --- |',
    ...[...by((s) => s.domain).entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .map(([domain, entry]) => `| \`${domain}\` | ${rate(entry.fired, entry.n)} |`),
    '',
    `### Length-matched view`,
    '',
    'The question this answers: is the rule enriched at a given length, or does it only look enriched',
    'because it fires on long answers? A rate that holds inside every bucket is not a length effect; a',
    'rate concentrated in the long bucket is.',
    '',
    '| Bucket | Firings | Share of all firings |',
    '| --- | --- | --- |',
    ...[...by((s) => lengthBucket(s.chars)).entries()]
      .sort((a, b) => compareText(a[0], b[0]))
      .map(
        ([bucket, entry]) =>
          `| \`${bucket}\` | ${rate(entry.fired, entry.n)} | ${((entry.fired / Math.max(1, fires.length)) * 100).toFixed(0)}% |`,
      ),
    '',
  );

  if (!existsSync(REPORT)) {
    writeFileSync(
      REPORT,
      [
        '# Rule conditioning on an external corpus',
        '',
        '<!-- Generated by `npm run review:condition`. Numbers only: no source text. -->',
        '',
        'Each rule is measured on HelpSteer3 before anything is concluded about what it detects. The',
        'question throughout is whether a firing rate is a behaviour or a length: a rule that fires on',
        'long answers and short ones at the same rate is measuring something else.',
        '',
        `Generated ${new Date().toISOString()}.`,
        '',
        '',
      ].join('\n'),
      'utf8',
    );
  }
  const existing = readFileSync(REPORT, 'utf8').replace(/Generated .*\n?/, '');
  writeFileSync(REPORT, `${existing.trimEnd()}\n\n${lines.join('\n')}\n`, 'utf8');

  process.stdout.write(`\n${rule}: ${rate(fires.length, samples.length)}\n`);
  for (const [bucket, entry] of [...by((s) => lengthBucket(s.chars)).entries()].sort((a, b) =>
    compareText(a[0], b[0]),
  )) {
    process.stdout.write(`  ${bucket.padEnd(12)}${rate(entry.fired, entry.n)}\n`);
  }
  process.stdout.write(`\nAppended to ${path.relative(ROOT, REPORT).split('\\').join('/')}\n`);
  return 0;
}

async function sheet(rule: Rule): Promise<number> {
  const samples = loadSamples();
  if (samples.length === 0) {
    process.stderr.write('No HelpSteer3 Chinese rows.\n');
    return 1;
  }
  await scan(samples, rule);

  // The rubric has to be frozen before the sheet exists, and the way to make that checkable rather
  // than promised is to hash it into the sheet and the key. A rubric edited after the fact changes
  // the hash, and a reader comparing the two sees it.
  const rubricPath = RUBRIC;
  if (rubricPath === undefined || !existsSync(rubricPath)) {
    process.stderr.write(
      `No rubric at ${rubricPath === undefined ? '(none given)' : path.relative(ROOT, rubricPath)}. ` +
        'Generate a sheet with `--rubric <file>`: a code list invented after seeing the samples is not a rubric.\n',
    );
    return 1;
  }
  const rubricText = readFileSync(rubricPath, 'utf8');
  const rubricHash = sha256(rubricText);

  const triggers = samples.filter((sample) => sample.fired).slice(0, LIMIT);
  const negatives = samples.filter((sample) => !sample.fired);
  const used = new Set<string>();
  const pairs: Array<{ trigger: Sample; negative: Sample | null }> = [];

  for (const trigger of triggers) {
    const bucket = lengthBucket(trigger.chars);
    const candidate = negatives
      .filter((sample) => !used.has(sample.id))
      .filter((sample) => lengthBucket(sample.chars) === bucket)
      .filter((sample) => (sample.turns <= 1) === (trigger.turns <= 1))
      .filter((sample) => sample.domain === trigger.domain)
      .sort((a, b) => Math.abs(a.chars - trigger.chars) - Math.abs(b.chars - trigger.chars))[0];
    if (candidate !== undefined) used.add(candidate.id);
    pairs.push({ trigger, negative: candidate ?? null });
  }

  // Interleave and shuffle deterministically, so the two groups are not separable by position.
  const rows: Array<{ id: string; userTurn: string; context: string; text: string }> = [];
  const key: Array<{ id: string; group: 'trigger' | 'matched-negative'; rule: Rule; chars: number; turns: number; domain: string }> = [];
  for (const pair of pairs) {
    rows.push({ id: `t-${pair.trigger.id}`, userTurn: pair.trigger.userTurn, context: pair.trigger.context, text: pair.trigger.text });
    key.push({ id: `t-${pair.trigger.id}`, group: 'trigger', rule, chars: pair.trigger.chars, turns: pair.trigger.turns, domain: pair.trigger.domain });
    if (pair.negative !== null) {
      rows.push({ id: `n-${pair.negative.id}`, userTurn: pair.negative.userTurn, context: pair.negative.context, text: pair.negative.text });
      key.push({ id: `n-${pair.negative.id}`, group: 'matched-negative', rule, chars: pair.negative.chars, turns: pair.negative.turns, domain: pair.negative.domain });
    }
  }
  const hash = (value: string): number => {
    let h = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      h ^= value.charCodeAt(index);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  // Opaque, sequential ids assigned *after* the shuffle. The first version prefixed them `t-` and
  // `n-`, which told the reader the very thing the blinding exists to hide.
  rows.sort((a, b) => hash(a.id) - hash(b.id));
  const sheetRows = rows.map((row, index) => ({ ...row, id: `s-${String(index + 1).padStart(4, '0')}` }));
  const keyById = new Map(rows.map((row, index) => [row.id, `s-${String(index + 1).padStart(4, '0')}`]));
  const opaqueKey = key.map((entry) => ({ ...entry, id: keyById.get(entry.id) ?? entry.id }));

  mkdirSync(DIR, { recursive: true });
  const sheetFile = path.join(DIR, `${rule.replace('chat.', '')}-sheet.md`);
  const keyFile = path.join(DIR, `${rule.replace('chat.', '')}-key.json`);
  const manifestFile = path.join(DIR, `${rule.replace('chat.', '')}-manifest.json`);
  const matched = pairs.filter((pair) => pair.negative !== null).length;

  const sheetText = [
    `# Blind review sheet`,
    '',
    'Label every sample on its own. Nothing here says which rule is being reviewed, whether a sample',
    'fired, or which group it came from — that is the point, and the key is a separate file.',
    '',
    `Samples: ${sheetRows.length}. The list mixes two groups in an order that carries no information.`,
    '',
    `**Rubric**: \`${path.relative(ROOT, rubricPath).split('\\').join('/')}\` at \`${rubricHash}\`.`,
    `Read the rubric before the first label. Its hash is recorded here and in the key file, so a rubric`,
    `edited after this sheet was generated no longer matches. Stop and regenerate if it does not.`,
    '',
    'For each sample record four things: **label** (a code from the rubric), **confidence** (`high`,',
    '`medium`, `low`), **assistant-shaped** (`yes`, `no`, `uncertain`) and **requires context** (`yes`,',
    '`no`). Write them as JSON lines into `.external-corpora/review/labels/<prefix>-NN.jsonl`, then',
    'unblind with `npm run review:tally`.',
    '',
    '---',
    '',
    ...sheetRows.flatMap((row) => [
      `### ${row.id}`,
      '',
      `**user**: ${row.userTurn.replace(/\n/g, ' / ')}`,
      row.context.length > 0 ? `**context**: ${row.context.replace(/\n/g, ' / ').slice(0, 400)}` : '',
      '',
      `**response**: ${row.text.replace(/\n/g, ' / ')}`,
      '',
      '',
    ]),
  ].join('\n');
  writeFileSync(sheetFile, sheetText, 'utf8');
  writeFileSync(keyFile, `${JSON.stringify(opaqueKey, null, 1)}\n`, 'utf8');

  // The sheet hash is computed over the sheet as written, and stored beside the key rather than in
  // the sheet: the sheet is what the reader works from, and it must not carry a value that changes
  // if the reader re-saves it.
  const manifest = {
    rule,
    rubric: path.relative(ROOT, rubricPath).split('\\').join('/'),
    rubricHash,
    sheetHash: sha256(sheetText),
    samples: sheetRows.length,
    triggers: pairs.length,
    matchedNegatives: matched,
    unmatched: pairs.length - matched,
    limit: LIMIT,
    keyHash: sha256(`${JSON.stringify(opaqueKey, null, 1)}\n`),
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 1)}\n`, 'utf8');

  process.stdout.write(`\nBlind sheet for ${rule}\n\n`);
  process.stdout.write(`  samples  : ${rows.length} (${pairs.length} triggers, ${matched} matched negatives)\n`);
  process.stdout.write(`  unmatched: ${pairs.length - matched} trigger(s) with no partner in the same length bucket, turn count and domain\n`);
  process.stdout.write(`  rubric   : ${manifest.rubric} ${rubricHash}\n`);
  process.stdout.write(`  sheet    : ${path.relative(ROOT, sheetFile).split('\\').join('/')} ${manifest.sheetHash} (gitignored)\n`);
  process.stdout.write(`  key      : ${path.relative(ROOT, keyFile).split('\\').join('/')} (gitignored — do not open before labelling)\n`);
  process.stdout.write(`  manifest : ${path.relative(ROOT, manifestFile).split('\\').join('/')} (gitignored)\n`);
  return 0;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const command = argv[0];
  const ruleArg = argv.includes('--rule') ? (argv[argv.indexOf('--rule') + 1] ?? '') : '';
  const rule = (RULES as readonly string[]).includes(ruleArg) ? (ruleArg as Rule) : null;
  if (command === 'condition' || command === 'sheet') {
    const targets = rule === null ? [...RULES] : [rule];
    let code = 0;
    for (const target of targets) {
      code = command === 'condition' ? await condition(target) : await sheet(target);
      if (code !== 0) break;
    }
    return code;
  }
  process.stdout.write(
    [
      'Usage:',
      '  npm run review:condition            # every rule, appended to RULE_CONDITIONING.md',
      '  npm run review:sheet -- --rule chat.unsolicited_offer --rubric benchmarks/external/offer-rubric.md',
      '',
      'The sheet is blind by construction: it shows id, user turn, context and response, and hides',
      'everything else. The key is written beside it and stays closed until the labels are done. The',
      'rubric is hashed into the sheet and the manifest, so a rubric edited after the fact is visible.',
      '',
      '  --limit <n>   cap the number of triggers (and therefore negatives) in the sheet',
      '',
    ].join('\n'),
  );
  return command === undefined ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`review failed: ${String(error)}\n`);
    process.exit(1);
  });
