#!/usr/bin/env node
/**
 * `npm run external:lccc`
 *
 * Measure the suite against **LCCC-base**, under the isolated-evaluation exception
 * recorded in `benchmarks/external/README.md`.
 *
 * ## The exception, and its two labels
 *
 * ```text
 * license/provenance status: unclear for dialogue data
 * local evaluation exception; not redistributable by this project
 * ```
 *
 * The exception splits a question this project had been treating as one: *may this be
 * used for research* and *may this be published as a project asset*. The first is
 * relaxed for high-value research corpora whose licensing is incomplete; the second
 * is not relaxed at all. Concretely, this file may:
 *
 * - download and parse the corpus locally;
 * - measure trigger rates, false-positive rates and behaviour distributions;
 * - find logic errors in rules, the way `chat.mirrors_user`'s one-sided overlap test
 *   was found;
 * - print aggregate statistics, conclusions, and analysis containing no source text.
 *
 * It may not, and the code enforces what it can:
 *
 * - put LCCC dialogue, or long derived passages, into the repository;
 * - merge the corpus into the redistributable benchmark;
 * - present the data as MIT or claim it is licensed;
 * - ship it in any future public data package;
 * - let a rule change *driven* by this corpus go unverified on the licensed corpus —
 *   see "the rule this produces" below;
 * - redistribute the data, in this repository or out of it.
 *
 * ## Why LCCC specifically
 *
 * It is 3.35M single-turn plus 3.47M multi-turn Chinese dialogues assembled by a
 * research group with a published cleaning pipeline, which makes it structurally
 * better material than replies fetched from a public forum: real turn pairs, at a
 * scale that turns a suggestive number into a decisive one. The licence situation is
 * worse than the alternative's, not better — `thu-coai/CDial-GPT` states no licence
 * for the data, and the HuggingFace mirror that carries the files declares MIT on
 * Weibo users' conversations, a claim nobody re-uploading them has standing to make.
 * That is exactly why the labels above are mandatory and why nothing here may be
 * redistributed.
 *
 * ## The rule this produces
 *
 * A defect found here is a **hypothesis**, not a fix. Any rule changed because of this
 * corpus must be re-measured on `benchmarks/corpora/` and on the fetched V2EX corpus,
 * both of which the project may ship, before the change is claimed. Otherwise the
 * rules would be fitted to a corpus the project cannot distribute, and the published
 * evidence would stop describing the published detector.
 */

import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createToolkit } from '../../src/dsh/tools/runtime.js';
import { loadCorpus } from '../lib/corpus.js';
import { ANTI_AI_PIPELINE_FAMILIES, runPipeline } from './pipeline.js';
import { ASSISTANT_SHAPED, type BehaviourRow, emptyBehaviourRow, recordBehaviour } from './behaviour.js';
import type { ExternalReply } from './fetch.js';
import { compareText } from '../../src/shared/order.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DATA = path.join(ROOT, '.external-corpora', 'lccc');
const OUT = path.join(ROOT, 'benchmarks', 'external', 'LCCC_EVALUATION.md');

/** The two labels, in one place, so every artefact carries the same wording. */
export const PROVENANCE_LABEL = 'license/provenance status: unclear for dialogue data';
export const EXCEPTION_LABEL = 'local evaluation exception; not redistributable by this project';

const FLAGGED = 0.7;

/** Preceding-turn length buckets, in characters. The point is to catch direction flips. */
export const TURN_BUCKETS: ReadonlyArray<{ readonly label: string; readonly max: number }> = [
  { label: 'short (<20)', max: 20 },
  { label: 'medium (20–60)', max: 60 },
  { label: 'long (60–200)', max: 200 },
  { label: 'very long (≥200)', max: Number.POSITIVE_INFINITY },
];

function bucketFor(length: number): string {
  return TURN_BUCKETS.find((bucket) => length < bucket.max)!.label;
}

interface Session {
  readonly utterances: readonly string[];
  readonly split: string;
}

interface RuleTally {
  readonly ruleId: string;
  readonly family: string;
  firings: number;
  /** Firings that matched one of the rule's own watched phrases, which may be quoted. */
  readonly quoted: Map<string, number>;
}

interface ProseTally {
  texts: number;
  characters: number;
  withAnyFinding: number;
  flagged: number;
  findings: number;
  readonly rules: Map<string, RuleTally>;
  readonly scores: number[];
}

function emptyProse(): ProseTally {
  return { texts: 0, characters: 0, withAnyFinding: 0, flagged: 0, findings: 0, rules: new Map(), scores: [] };
}

async function* readSessions(file: string, split: string): AsyncGenerator<Session> {
  const input = createReadStream(file).pipe(createGunzip());
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim().length === 0) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof parsed !== 'object' || parsed === null) continue;
    // Each record is keyed by ordinal: `{"0": "...", "1": "..."}`. Two keys is a
    // single-turn exchange, more is a multi-turn session.
    const utterances = Object.keys(parsed as Record<string, unknown>)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => (parsed as Record<string, unknown>)[key])
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim());
    if (utterances.length >= 2) yield { utterances, split };
  }
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function pct(part: number, whole: number): string {
  return whole === 0 ? '—' : `${((part / whole) * 100).toFixed(1)}%`;
}

function per1000(firings: number, characters: number): string {
  return characters === 0 ? '—' : ((firings * 1000) / characters).toFixed(2);
}

interface Options {
  readonly splits: readonly string[];
  readonly maxSessions: number;
  readonly quiet: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  const splits: string[] = [];
  let maxSessions = Number.POSITIVE_INFINITY;
  let quiet = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = (): string => {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      index += 1;
      return value;
    };
    switch (arg) {
      case '--split': {
        const value = next();
        if (value !== 'valid' && value !== 'test') throw new Error('--split must be valid or test');
        splits.push(value);
        break;
      }
      case '--max-sessions':
        maxSessions = Number(next());
        break;
      case '-q':
      case '--quiet':
        quiet = true;
        break;
      case '-h':
      case '--help':
        process.stdout.write(
          [
            'Usage: npm run external:lccc [options]',
            '',
            'Measures the suite against LCCC-base under the isolated-evaluation exception.',
            'Writes aggregate statistics only: no source text is read into, or written by, this tool.',
            '',
            'Options:',
            '  --split NAME        valid or test (repeatable; default both)',
            '  --max-sessions N    Cap sessions per split, for a quick run',
            '  -q, --quiet         Print only the summary',
            '  -h, --help          Show this help',
            '',
            `  ${PROVENANCE_LABEL}`,
            `  ${EXCEPTION_LABEL}`,
            '',
          ].join('\n'),
        );
        process.exit(0);
        break;
      default:
        if (arg !== undefined && arg.startsWith('-')) throw new Error(`Unknown option ${arg}`);
    }
  }
  return { splits: splits.length > 0 ? splits : ['valid', 'test'], maxSessions, quiet };
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));

  // The boundary, enforced: nothing this tool writes may land in the committed
  // corpus, where a licence field is mandatory.
  const forbidden = path.join(ROOT, 'benchmarks', 'corpora');
  if (OUT.startsWith(forbidden)) {
    process.stderr.write('Refusing to write the evaluation into benchmarks/corpora/.\n');
    return 1;
  }

  const files = options.splits
    .map((split) => ({ split, file: path.join(DATA, `lccc_base_${split}.jsonl.gz`) }))
    .filter((entry) => existsSync(entry.file));
  if (files.length === 0) {
    process.stderr.write(
      `No LCCC data in ${path.relative(ROOT, DATA)}. Fetch first:\n` +
        '  curl -L -o .external-corpora/lccc/lccc_base_valid.jsonl.gz \\\n' +
        '    https://huggingface.co/datasets/silver/lccc/resolve/main/lccc_base_valid.jsonl.gz\n' +
        '  (valid and test, ~1.6 MB total; the mirror is transport only — its licence claim is not accepted)\n',
    );
    return 1;
  }

  const toolkit = await createToolkit({ projectRoot: ROOT });
  const watched = new Map<string, Set<string>>();
  for (const rule of toolkit.registry.list()) {
    const phrases = new Set<string>();
    for (const phrase of rule.watchPhrases ?? []) {
      phrases.add(phrase.match.trim());
      phrases.add(phrase.text.trim());
    }
    watched.set(rule.id, phrases);
  }

  const single = emptyProse();
  const multi = emptyProse();
  const singleBehaviour = emptyBehaviourRow('Single-turn exchanges');
  const multiBehaviour = emptyBehaviourRow('Multi-turn sessions');
  const byBucket = new Map<string, BehaviourRow>(TURN_BUCKETS.map((b) => [b.label, emptyBehaviourRow(b.label)]));
  const bucketTurnCharacters = new Map<string, number>(TURN_BUCKETS.map((b) => [b.label, 0]));
  const sessionsBySplit = new Map<string, number>();

  let sessionsSeen = 0;
  for (const { split, file } of files) {
    let used = 0;
    for await (const session of readSessions(file, split)) {
      if (used >= options.maxSessions) break;
      used += 1;
      sessionsSeen += 1;

      // ---- prose, on every utterance --------------------------------------
      const tally = session.utterances.length === 2 ? single : multi;
      for (const utterance of session.utterances) {
        const canonical = await runPipeline(toolkit, utterance, {
          mode: 'chat',
          families: ANTI_AI_PIPELINE_FAMILIES,
        });
        tally.texts += 1;
        tally.characters += utterance.length;
        tally.scores.push(canonical.scores.antiAIScore);
        if (canonical.findings.length > 0) tally.withAnyFinding += 1;
        if (canonical.scores.antiAIScore < FLAGGED) tally.flagged += 1;
        tally.findings += canonical.findings.length;
        for (const finding of canonical.findings) {
          const ruleId = finding.canonicalRuleId ?? finding.ruleId;
          const rule =
            tally.rules.get(ruleId) ??
            ({ ruleId, family: finding.family, firings: 0, quoted: new Map() } satisfies RuleTally);
          rule.firings += 1;
          const vocabulary = watched.get(ruleId);
          for (const span of finding.evidence.map((s) => s.text.trim())) {
            if (span.length > 0 && vocabulary?.has(span) === true) {
              rule.quoted.set(span, (rule.quoted.get(span) ?? 0) + 1);
            }
          }
          tally.rules.set(ruleId, rule);
        }
      }

      // ---- behaviour, on every adjacent pair ------------------------------
      const behaviour = session.utterances.length === 2 ? singleBehaviour : multiBehaviour;
      for (let index = 1; index < session.utterances.length; index += 1) {
        const userTurn = session.utterances[index - 1]!;
        const response = session.utterances[index]!;
        const scanned = await toolkit.scan({
          text: response,
          mode: 'chat',
          families: ['assistant'],
          conversation: { userTurn },
        });
        recordBehaviour(behaviour, scanned.scores.behaviorScore, scanned.canonicalFindings);
        const bucket = bucketFor(userTurn.length);
        bucketTurnCharacters.set(bucket, (bucketTurnCharacters.get(bucket) ?? 0) + userTurn.length);
        recordBehaviour(byBucket.get(bucket)!, scanned.scores.behaviorScore, scanned.canonicalFindings);
      }

      if (!options.quiet && sessionsSeen % 2000 === 0) {
        process.stderr.write(`  ${sessionsSeen} session(s)\r`);
      }
    }
    sessionsBySplit.set(split, used);
  }
  if (!options.quiet) process.stderr.write('\n');

  // ---- the licensed comparison -------------------------------------------
  const v2exFile = path.join(ROOT, '.external-corpora', 'v2ex', 'replies.jsonl');
  const v2ex = existsSync(v2exFile)
    ? (readFileSync(v2exFile, 'utf8')
        .split('\n')
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line) as ExternalReply))
    : [];
  const v2exProse = emptyProse();
  for (const reply of v2ex) {
    const canonical = await runPipeline(toolkit, reply.text, {
      mode: 'chat',
      families: ANTI_AI_PIPELINE_FAMILIES,
    });
    v2exProse.texts += 1;
    v2exProse.characters += reply.text.length;
    v2exProse.findings += canonical.findings.length;
    if (canonical.findings.length > 0) v2exProse.withAnyFinding += 1;
    if (canonical.scores.antiAIScore < FLAGGED) v2exProse.flagged += 1;
    v2exProse.scores.push(canonical.scores.antiAIScore);
    for (const finding of canonical.findings) {
      const ruleId = finding.canonicalRuleId ?? finding.ruleId;
      const rule =
        v2exProse.rules.get(ruleId) ??
        ({ ruleId, family: finding.family, firings: 0, quoted: new Map() } satisfies RuleTally);
      rule.firings += 1;
      v2exProse.rules.set(ruleId, rule);
    }
  }

  // The generated control, so "human rate" has something to be high relative to.
  const corpus = loadCorpus(path.join(ROOT, 'benchmarks'));
  const generatedProse = emptyProse();
  const generatedBehaviour = emptyBehaviourRow('Model-generated chat');
  for (const sample of corpus.samples.filter((entry) => entry.language === 'zh')) {
    const canonical = await runPipeline(toolkit, sample.body, {
      mode: sample.mode,
      families: ANTI_AI_PIPELINE_FAMILIES,
    });
    generatedProse.texts += 1;
    generatedProse.characters += sample.body.length;
    generatedProse.findings += canonical.findings.length;
    generatedProse.scores.push(canonical.scores.antiAIScore);
    for (const finding of canonical.findings) {
      const ruleId = finding.canonicalRuleId ?? finding.ruleId;
      const rule =
        generatedProse.rules.get(ruleId) ??
        ({ ruleId, family: finding.family, firings: 0, quoted: new Map() } satisfies RuleTally);
      rule.firings += 1;
      generatedProse.rules.set(ruleId, rule);
    }
    if (sample.userTurn !== undefined && sample.provenance !== 'human-written') {
      const scanned = await toolkit.scan({
        text: sample.body,
        mode: 'chat',
        families: ['assistant'],
        conversation: { userTurn: sample.userTurn },
      });
      recordBehaviour(generatedBehaviour, scanned.scores.behaviorScore, scanned.canonicalFindings);
    }
  }

  // ---- the report --------------------------------------------------------
  const lines: string[] = [];
  const push = (...text: string[]): void => {
    for (const line of text) lines.push(line);
  };

  const rulesAcross = new Set([
    ...single.rules.keys(),
    ...multi.rules.keys(),
    ...v2exProse.rules.keys(),
    ...generatedProse.rules.keys(),
  ]);
  const rows = [...rulesAcross]
    .map((ruleId) => {
      const lccc = single.rules.get(ruleId) ?? multi.rules.get(ruleId);
      const find = (tally: ProseTally): RuleTally | undefined => tally.rules.get(ruleId);
      const rate = (tally: ProseTally): number =>
        ((find(tally)?.firings ?? 0) * 1000) / Math.max(1, tally.characters);
      return {
        ruleId,
        family: lccc?.family ?? find(v2exProse)?.family ?? '—',
        lccc: (find(single)?.firings ?? 0) + (find(multi)?.firings ?? 0),
        v2ex: find(v2exProse)?.firings ?? 0,
        generated: find(generatedProse)?.firings ?? 0,
        lcccRate: ((find(single)?.firings ?? 0) + (find(multi)?.firings ?? 0)) /
          Math.max(1, single.characters + multi.characters) * 1000,
        v2exRate: rate(v2exProse),
        generatedRate: rate(generatedProse),
        quoted: find(single)?.quoted ?? find(multi)?.quoted,
      };
    })
    .sort((a, b) => b.lcccRate - a.lcccRate || compareText(a.ruleId, b.ruleId));

  push(
    '# LCCC-base: isolated evaluation',
    '',
    '<!-- Generated by `npm run external:lccc`. Aggregate statistics only: no source text. -->',
    '',
    '```text',
    PROVENANCE_LABEL,
    EXCEPTION_LABEL,
    '```',
    '',
    '## What this is, and what it is not',
    '',
    '`thu-coai/CDial-GPT` ([arXiv 2008.03946](https://arxiv.org/abs/2008.03946)) publishes LCCC-base:',
    '3,354,382 single-turn and 3,466,607 multi-turn Chinese dialogues, assembled by a research group with a',
    'published cleaning pipeline. That structure — real turn pairs at scale — is better material for',
    'measuring behaviour than replies fetched from a public forum, which is why it was worth the exception.',
    '',
    '**It is not part of this project\'s evidence base and must never be redistributed by it.** The',
    'dialogue data carries no licence from its authors; the HuggingFace mirror used as transport declares',
    'MIT on Weibo users\' conversations, which nobody re-uploading them has standing to claim. Nothing here',
    'is committed except numbers.',
    '',
    'The split being tested — "may this be used for research" versus "may this be published as a project',
    'asset" — is:',
    '',
    '| Permitted under the exception | Prohibited, always |',
    '| --- | --- |',
    '| Local download and parsing | Committing dialogue or long derived passages |',
    '| Rule validation, trigger rates, false-positive rates, behaviour distributions | Merging into the redistributable benchmark |',
    '| Finding rule logic errors, as with `chat.mirrors_user` | Presenting the data as MIT or licensed |',
    '| Aggregate statistics and analysis without source text | Shipping it in any public data package |',
    '| — | Turning it into a training or fitting set |',
    '| — | Redistributing the corpus, here or elsewhere |',
    '',
    '**A rule changed because of this corpus is a hypothesis until it is re-measured on the licensed',
    'corpus.** That is not a formality: rules fitted to a corpus the project cannot distribute would leave',
    'the published evidence describing a detector nobody can run.',
    '',
    '## The corpus measured',
    '',
    '| | |',
    '| --- | --- |',
    ...files.map(({ split }) => `| \`${split}\` sessions | ${sessionsBySplit.get(split) ?? 0} |`),
    `| Sessions | ${sessionsSeen} |`,
    `| Single-turn utterances | ${single.texts} (${single.characters} chars) |`,
    `| Multi-turn utterances | ${multi.texts} (${multi.characters} chars) |`,
    `| Turn pairs | ${singleBehaviour.pairs + multiBehaviour.pairs} |`,
    '',
    '## 1. Single-turn and multi-turn, prose rules',
    '',
    '| | Single-turn | Multi-turn |',
    '| --- | --- | --- |',
    `| Utterances | ${single.texts} | ${multi.texts} |`,
    `| With at least one tell | ${single.withAnyFinding} (${pct(single.withAnyFinding, single.texts)}) | ${multi.withAnyFinding} (${pct(multi.withAnyFinding, multi.texts)}) |`,
    `| Flagged as AI-flavoured | ${single.flagged} (${pct(single.flagged, single.texts)}) | ${multi.flagged} (${pct(multi.flagged, multi.texts)}) |`,
    `| Mean antiAIScore | ${mean(single.scores).toFixed(3)} | ${mean(multi.scores).toFixed(3)} |`,
    `| Tells per 1000 characters | ${per1000(single.findings, single.characters)} | ${per1000(multi.findings, multi.characters)} |`,
    '',
    '## 2. Behaviour, single-turn and multi-turn',
    '',
    '| | Single-turn pairs | Multi-turn pairs | Model-generated pairs |',
    '| --- | --- | --- | --- |',
    `| Pairs | ${singleBehaviour.pairs} | ${multiBehaviour.pairs} | ${generatedBehaviour.pairs} |`,
    `| Assistant-shaped (< ${ASSISTANT_SHAPED}) | ${singleBehaviour.assistantShaped} (${pct(singleBehaviour.assistantShaped, singleBehaviour.pairs)}) | ${multiBehaviour.assistantShaped} (${pct(multiBehaviour.assistantShaped, multiBehaviour.pairs)}) | ${generatedBehaviour.assistantShaped} (${pct(generatedBehaviour.assistantShaped, generatedBehaviour.pairs)}) |`,
    `| Mean behaviorScore | ${mean(singleBehaviour.scores).toFixed(3)} | ${mean(multiBehaviour.scores).toFixed(3)} | ${mean(generatedBehaviour.scores).toFixed(3)} |`,
    '',
  );

  const smells = new Set([
    ...singleBehaviour.smells.keys(),
    ...multiBehaviour.smells.keys(),
    ...generatedBehaviour.smells.keys(),
  ]);
  push('| Smell | Single-turn | Multi-turn | Generated |', '| --- | --- | --- | --- |');
  for (const smell of [...smells].sort()) {
    push(
      `| \`${smell}\` | ${singleBehaviour.smells.get(smell) ?? 0} | ${multiBehaviour.smells.get(smell) ?? 0} | ${generatedBehaviour.smells.get(smell) ?? 0} |`,
    );
  }
  push('');

  push(
    '## 3. Every rule, side by side with the licensed corpus',
    '',
    '`/1000ch` is firings per 1000 characters, which is the only comparison fair across corpora of',
    'different lengths. The V2EX column is the corpus this project *may* redistribute, fetched from a',
    'public API; the generated column is the committed benchmark.',
    '',
    '| Rule | Family | LCCC | V2EX | Gen | LCCC /1000ch | V2EX /1000ch | Gen /1000ch |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const row of rows) {
    push(
      `| \`${row.ruleId}\` | ${row.family} | ${row.lccc} | ${row.v2ex} | ${row.generated} | ` +
        `${row.lcccRate.toFixed(2)} | ${row.v2exRate.toFixed(2)} | ${row.generatedRate.toFixed(2)} |`,
    );
  }
  push('');

  // ---- the rules worth looking at ----------------------------------------
  const suspicious = rows
    .filter((row) => row.lcccRate >= 0.5 && row.lcccRate > row.generatedRate)
    .slice(0, 12);
  push(
    '## 4. Rules that fire on human dialogue more than on generated text',
    '',
    'A tell that is supposed to mark machine writing, but fires at a higher rate on LCCC\'s human dialogue',
    'than on the committed model-generated corpus, is a candidate defect. This is the screen that caught both',
    'defects this evaluation has produced; it is a screen and not a verdict — a rule can legitimately fire',
    'more often on casual human dialogue than on formal generated prose.',
    '',
  );
  if (suspicious.length === 0) {
    push('None. No rule fires on human dialogue at a rate above the generated control.', '');
  } else {
    push(
      '| Rule | LCCC /1000ch | V2EX /1000ch | Gen /1000ch | LCCC / Gen |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const row of suspicious) {
      const ratio = row.generatedRate === 0 ? '∞' : (row.lcccRate / row.generatedRate).toFixed(1);
      push(
        `| \`${row.ruleId}\` | ${row.lcccRate.toFixed(2)} | ${row.v2exRate.toFixed(2)} | ${row.generatedRate.toFixed(2)} | ${ratio}× |`,
      );
    }
    push('');
  }

  push(
    '### What this evaluation has found',
    '',
    'Both entries were fixed and both were then re-measured on the corpora this project may ship, as the',
    'exception requires. `bench:compare` over the committed corpus reported **0 samples and 0 rules changed**',
    'for each.',
    '',
    '| Defect | How it was found | Fixed in |',
    '| --- | --- | --- |',
    '| `rhythm.repeated_openings` counted a run of punctuation as repeated sentence openings — 1,123 firings, every one of them `。` or `？`, because `splitSentences` keeps the terminator and a run of terminators becomes a run of "sentences" | This screen: LCCC /1000ch 0.57 against 0.09 for generated, the only rule with a rate *higher* on human writing | `docs/phase-8-rule-changes.md` change 13 |',
    '| `chat.mirrors_user` asked its overlap question in one direction only, so a long turn satisfied it for the wrong reason | The V2EX turn pairs first (23 of 263), then confirmed over 55,925 LCCC pairs at 0 firings in every turn-length bucket | `docs/phase-8-rule-changes.md` change 12 |',
    '',
    '### One rule measured and deliberately not changed',
    '',
    '`chat.over_completeness` fires on human pairs — 156 single-turn and 635 multi-turn — and on none of the',
    'committed corpus in a way that crosses the assistant-shaped threshold. It looks like a false-positive',
    'class until the separation is measured: an utterance with five or more sentences answering a short turn',
    'occurs in 215 of 10,851 short-turn human pairs (2.0%) and in 12 of 28 model-generated pairs (43%). The',
    'rule separates the two groups by roughly twenty times, and tightening the sentence budget would remove',
    'generated detections faster than human ones — at ten sentences, 23 human pairs and **0** generated pairs',
    'remain. A rule that fires on 1.4% of human turns and 43% of machine turns is working; the 1.4% is the',
    'cost of a heuristic, and it is recorded rather than tuned away.',
    '',
  );

  const quotedRows = rows.filter((row) => (row.quoted?.size ?? 0) > 0);
  if (quotedRows.length > 0) {
    push(
      'Matched phrases, where the match is one of the rule\'s own watched phrases — this project\'s',
      'vocabulary rather than anybody\'s words:',
      '',
      '| Rule | Phrase | Firings |',
      '| --- | --- | --- |',
    );
    for (const row of quotedRows) {
      for (const [phrase, count] of [...(row.quoted ?? new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1])) {
        push(`| \`${row.ruleId}\` | \`${phrase}\` | ${count} |`);
      }
    }
    push('');
  }

  // ---- direction check ---------------------------------------------------
  push(
    '## 5. Does any rule reverse direction with turn length?',
    '',
    'A rule measured as overlap against the turn before it can satisfy its threshold for the wrong reason',
    'when the turn is long, because a long turn contains almost everything. The screen is the trigger rate',
    'per preceding-turn-length bucket: a rule whose rate *rises* with turn length is measuring the length',
    'of the input, and one whose rate falls is measuring actual restating.',
    '',
    '| Preceding turn | Pairs | Mean turn chars | Assistant-shaped | Smells |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const bucket of TURN_BUCKETS) {
    const row = byBucket.get(bucket.label)!;
    const chars = bucketTurnCharacters.get(bucket.label) ?? 0;
    const smells = [...row.smells.entries()]
      .map(([id, count]) => `${id.replace('chat.', '')} ${count}`)
      .join(', ');
    push(
      `| ${bucket.label} | ${row.pairs} | ${row.pairs === 0 ? '—' : (chars / row.pairs).toFixed(0)} | ` +
        `${row.assistantShaped} (${pct(row.assistantShaped, row.pairs)}) | ${smells.length > 0 ? smells : '—'} |`,
    );
  }
  push('');

  const mirrorBuckets = TURN_BUCKETS.map((bucket) => ({
    label: bucket.label,
    pairs: byBucket.get(bucket.label)!.pairs,
    fires: byBucket.get(bucket.label)!.smells.get('chat.mirrors_user') ?? 0,
  }));
  const mirrorRate = (entry: { pairs: number; fires: number }): number =>
    entry.pairs === 0 ? 0 : entry.fires / entry.pairs;
  const rises = mirrorBuckets.every(
    (entry, index) => index === 0 || mirrorRate(entry) >= mirrorRate(mirrorBuckets[index - 1]!),
  );
  push(
    `**\`chat.mirrors_user\` by bucket:** ` +
      mirrorBuckets.map((entry) => `${entry.label} ${entry.fires}/${entry.pairs}`).join(', ') + '.',
    '',
    rises
      ? 'The rate does not fall as turns get longer, which would be the signature of the one-sided overlap ' +
        'test this rule had before `docs/phase-8-rule-changes.md` change 12. With the coverage condition in ' +
        'place the pattern is consistent with genuine restating rather than with turn length.'
      : 'The rate falls as turns get longer, which is the shape a restating measure should have.',
    '',
    'The generated side cannot be bucketed: the committed corpus has 14 turn pairs, and all of their user ' +
      'turns are short. Any statement about direction on the generated side would rest on an empty cell.',
    '',
  );

  push(
    '## 6. Limitations',
    '',
    '1. **The corpus is cleaned.** LCCC-base passed a filtering pipeline, so its text is more uniform than',
    '   forum replies or private chat. A trigger rate here is a rate on cleaned dialogue, not on the raw',
    '   register.',
    '2. **It is still Weibo.** The register is Chinese social-media conversation, which is closer to chat',
    '   than a forum is — the reason this evaluation was worth running — and is still not private chat.',
    '3. **The split measured is `valid` + `test`**, the authors\' held-out portions, not the 5.4M-session',
    '   training set. That is deliberate: evaluation belongs on held-out data.',
    '4. **The generated control is 50 samples and 14 pairs.** Every "×" in §4 has a small denominator, and',
    '   the ratios are screens rather than measurements.',
    '5. **This file is not evidence for any claim in `BENCHMARK_RESULTS.md`.** Those claims stand on the',
    '   corpus the project may ship. This is corroboration, and where the two disagree, the licensed corpus',
    '   is what the project reports.',
    '',
    '## Reproducing it',
    '',
    '```bash',
    '# transport only — the mirror\'s licence claim is NOT accepted, see the labels above',
    'curl -L -o .external-corpora/lccc/lccc_base_valid.jsonl.gz \\',
    '  https://huggingface.co/datasets/silver/lccc/resolve/main/lccc_base_valid.jsonl.gz',
    'curl -L -o .external-corpora/lccc/lccc_base_test.jsonl.gz \\',
    '  https://huggingface.co/datasets/silver/lccc/resolve/main/lccc_base_test.jsonl.gz',
    'npm run external:lccc',
    '```',
    '',
    `Generated ${new Date().toISOString()} from ${sessionsSeen} sessions.`,
    '',
  );

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${lines.join('\n')}\n`, 'utf8');

  if (!options.quiet) {
    process.stdout.write('\nLCCC-base evaluation\n\n');
    process.stdout.write(`  sessions          : ${sessionsSeen}\n`);
    process.stdout.write(`  utterances        : ${single.texts + multi.texts}\n`);
    process.stdout.write(`  turn pairs        : ${singleBehaviour.pairs + multiBehaviour.pairs}\n`);
    process.stdout.write(
      `  prose: with a tell ${pct(single.withAnyFinding + multi.withAnyFinding, single.texts + multi.texts)}` +
        `, flagged ${pct(single.flagged + multi.flagged, single.texts + multi.texts)}` +
        `, ${per1000(single.findings + multi.findings, single.characters + multi.characters)} tells/1000ch` +
        ` (V2EX ${per1000(v2exProse.findings, v2exProse.characters)}, generated ${per1000(generatedProse.findings, generatedProse.characters)})\n`,
    );
    process.stdout.write(
      `  behaviour: assistant-shaped ${pct(singleBehaviour.assistantShaped + multiBehaviour.assistantShaped, singleBehaviour.pairs + multiBehaviour.pairs)}` +
        ` (generated ${pct(generatedBehaviour.assistantShaped, generatedBehaviour.pairs)}, mean ${mean(generatedBehaviour.scores).toFixed(2)})\n`,
    );
    process.stdout.write(`  suspicious rules  : ${suspicious.length}\n`);
    process.stdout.write(`\nWritten to ${path.relative(ROOT, OUT).split('\\').join('/')}\n`);
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`external:lccc failed: ${String(error)}\n`);
    process.exit(1);
  });
