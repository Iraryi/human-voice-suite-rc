#!/usr/bin/env node
/**
 * `npm run external:measure`
 *
 * Measure the suite against genuine human writing, and publish the numbers.
 *
 * ## What this answers
 *
 * `BENCHMARK_RESULTS.md` §1 has always said the same thing: the false-positive
 * rate on real human conversation is **unmeasured**, because the committed corpus
 * has no real human conversation in it. Everything else in that document is
 * conditional on a corpus that is 48/60 model-generated. This is the missing
 * denominator.
 *
 * ## What it publishes, and what it must not
 *
 * The fetched text has no licence. So the committed output contains:
 *
 * - counts: how many replies, how many tripped a rule, how many crossed the
 *   flagged threshold;
 * - rule ids, with firing counts;
 * - **matched phrases, but only when the phrase is one of the rule's own watched
 *   phrases** — our vocabulary, not their words. A match that is not in the rule's
 *   phrase list is counted and not quoted, because for a structural or rhythm rule
 *   the evidence span is a fragment of the comment.
 *
 * Nothing else. No reply text, no example, no excerpt, no username — the fetch
 * stripped those and this never had them.
 *
 * ## The comparison that makes the number mean something
 *
 * A false-positive rate on its own says little: some rules are meant to fire
 * rarely. So the same detectors run over the committed **model-generated chat**
 * corpus, and the report puts the two side by side as tells per 1000 characters.
 * If real human writing trips a rule at the same rate as generated chat, that rule
 * is not discriminating between them.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createToolkit } from '../../src/dsh/tools/runtime.js';
import { loadCorpus } from '../lib/corpus.js';
import { ANTI_AI_PIPELINE_FAMILIES, runPipeline } from './pipeline.js';
import type { ExternalReply } from './fetch.js';
import { compareText } from '../../src/shared/order.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(ROOT, 'benchmarks', 'external', 'EXTERNAL_CORPUS_RESULTS.md');

/** Below this, a text counts as flagged. The same threshold the benchmark uses. */
const FLAGGED = 0.7;

interface RuleTally {
  readonly ruleId: string;
  readonly family: string;
  firings: number;
  /** Watched phrases that matched, and only where the phrase is the rule's own. */
  readonly quotedMatches: Map<string, number>;
  unquotableMatches: number;
}

/**
 * A running tally. Mutable by design — this is a counter being accumulated over a
 * corpus, not a value crossing a boundary, and a copy-on-write version would be
 * slower and no clearer.
 */
interface Measurement {
  readonly label: string;
  texts: number;
  characters: number;
  withAnyFinding: number;
  flagged: number;
  findings: number;
  readonly rules: Map<string, RuleTally>;
  readonly scores: number[];
}

function emptyMeasurement(label: string): Measurement {
  return {
    label,
    texts: 0,
    characters: 0,
    withAnyFinding: 0,
    flagged: 0,
    findings: 0,
    rules: new Map(),
    scores: [],
  };
}

function record(
  measurement: Measurement,
  text: string,
  canonical: Awaited<ReturnType<typeof runPipeline>>,
  watchedPhrases: ReadonlyMap<string, ReadonlySet<string>>,
): void {
  measurement.texts += 1;
  measurement.characters += text.length;
  measurement.scores.push(canonical.scores.antiAIScore);
  if (canonical.findings.length > 0) measurement.withAnyFinding += 1;
  if (canonical.scores.antiAIScore < FLAGGED) measurement.flagged += 1;
  measurement.findings += canonical.findings.length;

  for (const finding of canonical.findings) {
    const ruleId = finding.canonicalRuleId ?? finding.ruleId;
    const tally =
      measurement.rules.get(ruleId) ??
      ({ ruleId, family: finding.family, firings: 0, quotedMatches: new Map(), unquotableMatches: 0 } satisfies RuleTally);
    tally.firings += 1;

    const vocabulary = watchedPhrases.get(ruleId);
    const spans = finding.evidence.map((span) => span.text.trim()).filter((span) => span.length > 0);
    const quotable = spans.filter((span) => vocabulary?.has(span) === true);
    if (quotable.length === 0) {
      // The evidence is a fragment of the text rather than one of our own phrases.
      // Counted, never quoted.
      tally.unquotableMatches += 1;
    } else {
      for (const span of quotable) {
        tally.quotedMatches.set(span, (tally.quotedMatches.get(span) ?? 0) + 1);
      }
    }
    measurement.rules.set(ruleId, tally);
  }
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

/** A running tally of behaviour over turn pairs. */
interface BehaviourMeasurement {
  readonly label: string;
  pairs: number;
  characters: number;
  /** Pairs whose behaviorScore fell below the assistant-shaped threshold. */
  assistantShaped: number;
  readonly smells: Map<string, number>;
  readonly scores: number[];
}

/** Below this a reply behaves like an assistant. The same threshold the benchmark uses. */
const ASSISTANT_SHAPED = 0.75;

function emptyBehaviour(label: string): BehaviourMeasurement {
  return { label, pairs: 0, characters: 0, assistantShaped: 0, smells: new Map(), scores: [] };
}

function recordBehaviour(
  measurement: BehaviourMeasurement,
  behaviorScore: number,
  findings: readonly { readonly canonicalRuleId?: string; readonly ruleId: string }[],
): void {
  measurement.pairs += 1;
  measurement.scores.push(behaviorScore);
  if (behaviorScore < ASSISTANT_SHAPED) measurement.assistantShaped += 1;
  for (const finding of findings) {
    const ruleId = finding.canonicalRuleId ?? finding.ruleId;
    measurement.smells.set(ruleId, (measurement.smells.get(ruleId) ?? 0) + 1);
  }
}

function percent(part: number, whole: number): string {
  return whole === 0 ? '—' : `${((part / whole) * 100).toFixed(1)}%`;
}

function perThousand(firings: number, characters: number): string {
  return characters === 0 ? '—' : ((firings * 1000) / characters).toFixed(2);
}

function loadExternal(directory: string): ExternalReply[] {
  const file = path.join(directory, 'replies.jsonl');
  if (!existsSync(file)) {
    throw new Error(
      `No fetched corpus at ${path.relative(ROOT, file)}. Run \`npm run external:fetch\` first. ` +
        'It is gitignored on purpose: the text has no licence and is never committed.',
    );
  }
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ExternalReply);
}

async function main(): Promise<number> {
  const toolkit = await createToolkit({ projectRoot: ROOT });

  // Which phrases each rule watches, so a match can be quoted only when it is ours.
  const watchedPhrases = new Map<string, Set<string>>();
  for (const rule of toolkit.registry.list()) {
    const phrases = new Set<string>();
    for (const phrase of rule.watchPhrases ?? []) {
      phrases.add(phrase.match.trim());
      phrases.add(phrase.text.trim());
    }
    watchedPhrases.set(rule.id, phrases);
  }

  // ---- the external corpus ------------------------------------------------
  const external = loadExternal(path.join(ROOT, '.external-corpora', 'v2ex'));
  const corpus = loadCorpus(path.join(ROOT, 'benchmarks'));
  const human = emptyMeasurement('Real human replies (V2EX, fetched locally)');
  for (const reply of external) {
    const canonical = await runPipeline(toolkit, reply.text, {
      mode: 'chat',
      families: ANTI_AI_PIPELINE_FAMILIES,
    });
    record(human, reply.text, canonical, watchedPhrases);
  }

  // ---- behaviour, on turn pairs -------------------------------------------
  // The prose pass above measures single replies, which is all the committed corpus
  // could ever measure: mirroring and over-completeness are relationships between a
  // turn and the turn before it, and a reply with nothing before it cannot show
  // either. A topic and its **first** reply is a genuine pair — someone said
  // something, someone answered it — so this is the first behaviour measurement on
  // real human text in the project.
  //
  // First replies only. The fifth reply answers the second replier, not the topic,
  // and pretending otherwise would put the wrong turn in the comparison.
  const firstReplies = external.filter((reply) => reply.ordinal === 0);
  const humanBehaviour = emptyBehaviour('Real human turn pairs (topic → first reply)');
  for (const reply of firstReplies) {
    const scanned = await toolkit.scan({
      text: reply.text,
      mode: 'chat',
      families: ['assistant'],
      conversation: { userTurn: reply.context },
    });
    recordBehaviour(humanBehaviour, scanned.scores.behaviorScore, scanned.canonicalFindings);
  }

  const generatedBehaviour = emptyBehaviour('Model-generated chat, with its user turn');
  for (const sample of corpus.samples.filter(
    (entry) => entry.language === 'zh' && entry.userTurn !== undefined && entry.provenance !== 'human-written',
  )) {
    const scanned = await toolkit.scan({
      text: sample.body,
      mode: 'chat',
      families: ['assistant'],
      conversation: { userTurn: sample.userTurn! },
    });
    recordBehaviour(generatedBehaviour, scanned.scores.behaviorScore, scanned.canonicalFindings);
  }

  // ---- the control: model-generated chat, same detectors -------------------
  const generatedSamples = corpus.samples.filter(
    (sample) =>
      sample.language === 'zh' &&
      (sample.category === 'chinese-chat' || sample.category === 'ai-pretending-casual') &&
      sample.provenance !== 'human-written',
  );
  const generated = emptyMeasurement('Model-generated Chinese chat (committed corpus)');
  for (const sample of generatedSamples) {
    const canonical = await runPipeline(toolkit, sample.body, {
      mode: 'chat',
      families: ANTI_AI_PIPELINE_FAMILIES,
    });
    record(generated, sample.body, canonical, watchedPhrases);
  }

  // ---- how the human replies should score if the detectors behaved ---------
  // A rule that fires as often per 1000 characters on real human writing as on
  // generated chat is not separating the two groups at all.
  const allRules = new Set([...human.rules.keys(), ...generated.rules.keys()]);
  const rows = [...allRules]
    .map((ruleId) => {
      const h = human.rules.get(ruleId);
      const g = generated.rules.get(ruleId);
      return {
        ruleId,
        family: h?.family ?? g?.family ?? '—',
        human: h?.firings ?? 0,
        generated: g?.firings ?? 0,
        humanRate: ((h?.firings ?? 0) * 1000) / Math.max(1, human.characters),
        generatedRate: ((g?.firings ?? 0) * 1000) / Math.max(1, generated.characters),
      };
    })
    .sort((a, b) => b.humanRate - a.humanRate || compareText(a.ruleId, b.ruleId));

  const lines: string[] = [];
  const push = (...text: string[]): void => {
    for (const line of text) lines.push(line);
  };

  push(
    '# External corpus: false positives on real human writing',
    '',
    '<!-- Generated by `npm run external:measure`. Do not edit by hand. -->',
    '',
    'This file contains **numbers and rule ids only**. The text it measured is',
    'copyrighted by the people who wrote it, carries no licence, and is deliberately',
    'not in this repository — see [`README.md`](./README.md). Where a matched phrase',
    'appears below it is one of the rule\'s own watched phrases, which is this',
    "project's vocabulary rather than anyone's words.",
    '',
    '## What this is for',
    '',
    '`BENCHMARK_RESULTS.md` has said since its first run that the false-positive rate',
    'on **real human conversation is unmeasured**, because the committed corpus holds',
    'no real human conversation. This is that measurement.',
    '',
    '| | |',
    '| --- | --- |',
    `| Human replies | ${human.texts} |`,
    `| Human characters | ${human.characters} |`,
    `| Generated chat samples (control) | ${generated.texts} |`,
    `| Generated characters | ${generated.characters} |`,
    `| Detectors | prose families: ${ANTI_AI_PIPELINE_FAMILIES.join(', ')} |`,
    `| Flagged threshold | antiAIScore < ${FLAGGED} |`,
    '',
    '## Headline',
    '',
    '| | Real human replies | Model-generated chat |',
    '| --- | --- | --- |',
    `| Text with at least one tell | ${human.withAnyFinding} (${percent(human.withAnyFinding, human.texts)}) | ${generated.withAnyFinding} (${percent(generated.withAnyFinding, generated.texts)}) |`,
    `| Flagged as AI-flavoured | ${human.flagged} (${percent(human.flagged, human.texts)}) | ${generated.flagged} (${percent(generated.flagged, generated.texts)}) |`,
    `| Mean antiAIScore | ${mean(human.scores).toFixed(2)} | ${mean(generated.scores).toFixed(2)} |`,
    `| Tells per 1000 characters | ${perThousand(human.findings, human.characters)} | ${perThousand(generated.findings, generated.characters)} |`,
    '',
  );

  const ratio =
    human.characters === 0 || generated.characters === 0
      ? 0
      : (human.findings / human.characters) / (generated.findings / generated.characters);
  push(
    `A ratio near 1 means the prose detectors fire about as often on real human writing as on generated`,
    `chat, and are therefore not separating the two. Here it is **${ratio.toFixed(2)}**.`,
    '',
  );

  push(
    '## Every rule that fired, by rate',
    '',
    '`human /1000ch` and `generated /1000ch` are firings per 1000 characters, which is the only',
    'comparison that is fair across two corpora of different lengths.',
    '',
    '| Rule | Family | Human | Gen | Human /1000ch | Gen /1000ch |',
    '| --- | --- | --- | --- | --- | --- |',
  );
  for (const row of rows) {
    push(
      `| \`${row.ruleId}\` | ${row.family} | ${row.human} | ${row.generated} | ${row.humanRate.toFixed(2)} | ${row.generatedRate.toFixed(2)} |`,
    );
  }
  push('');

  const quoted = rows.filter((row) => (human.rules.get(row.ruleId)?.quotedMatches.size ?? 0) > 0);
  if (quoted.length > 0) {
    push(
      '## What matched, where the match is this project\'s own phrase',
      '',
      'Only rules whose evidence span is one of the watched phrases appear here. For every other',
      'rule the evidence is a fragment of the measured text, and it is counted without being',
      'quoted.',
      '',
      '| Rule | Watched phrase | Firings |',
      '| --- | --- | --- |',
    );
    for (const row of quoted) {
      const tally = human.rules.get(row.ruleId)!;
      for (const [phrase, count] of [...tally.quotedMatches.entries()].sort((a, b) => b[1] - a[1])) {
        push(`| \`${row.ruleId}\` | \`${phrase}\` | ${count} |`);
      }
    }
    push('');
  }

  const unquotable = rows.filter((row) => (human.rules.get(row.ruleId)?.unquotableMatches ?? 0) > 0);
  if (unquotable.length > 0) {
    push(
      'Rules whose matches could not be quoted, because the evidence is a fragment of the text:',
      '',
      `\`${unquotable.map((row) => row.ruleId).join('`, `')}\`.`,
      '',
    );
  }

  push(
    '## Behaviour, on real turn pairs',
    '',
    'This is the measurement the committed corpus could not make. Mirroring and over-completeness are',
    'relationships between a turn and the turn before it, so they need pairs; the benchmark corpus has',
    'chat samples with a `user_turn`, but every one of them was written by a model. Here a human topic and',
    'the **first** human reply to it are the pair. The fifth reply answers the second replier rather than',
    'the topic, and is left out instead of mislabelled.',
    '',
    '| | Real human pairs | Model-generated pairs |',
    '| --- | --- | --- |',
    `| Pairs | ${humanBehaviour.pairs} | ${generatedBehaviour.pairs} |`,
    `| Assistant-shaped (behaviorScore < ${ASSISTANT_SHAPED}) | ${humanBehaviour.assistantShaped} (${percent(humanBehaviour.assistantShaped, humanBehaviour.pairs)}) | ${generatedBehaviour.assistantShaped} (${percent(generatedBehaviour.assistantShaped, generatedBehaviour.pairs)}) |`,
    `| Mean behaviorScore | ${mean(humanBehaviour.scores).toFixed(2)} | ${mean(generatedBehaviour.scores).toFixed(2)} |`,
    '',
  );

  const smellIds = new Set([...humanBehaviour.smells.keys(), ...generatedBehaviour.smells.keys()]);
  if (smellIds.size > 0) {
    push('| Smell | Human pairs | Generated pairs |', '| --- | --- | --- |');
    for (const smell of [...smellIds].sort()) {
      push(
        `| \`${smell}\` | ${humanBehaviour.smells.get(smell) ?? 0} | ${generatedBehaviour.smells.get(smell) ?? 0} |`,
      );
    }
    push('');
  } else {
    push('No assistant smell fired on either group.', '');
  }

  push(
    'Read the human column as the behaviour layer\'s false-positive rate, with a caveat that matters',
    'more here than in the prose table: a forum reply is not a chat reply. Answering a topic in public is',
    'a different act from answering a person in a message, so a low assistant-shaped rate is',
    '*encouraging rather than conclusive*. What it shows is that the layer does not fire indiscriminately',
    'on human text. What it cannot show is how the layer behaves on real private chat, and nothing in this',
    'repository can.',
    '',
  );

  const mirrorHuman = humanBehaviour.smells.get('chat.mirrors_user') ?? 0;
  if (mirrorHuman > 0) {
    push(
      `**\`chat.mirrors_user\` still fires on ${mirrorHuman} of ${humanBehaviour.pairs} human pairs.** It ` +
        'was 23 of 263 before the fix recorded in `docs/phase-8-rule-changes.md` — the overlap test was ' +
        'one-sided and a long topic shares vocabulary with any reply about it. The remainder is the floor ' +
        'of this corpus rather than a known defect: a forum reply that quotes the topic before answering ' +
        'it is doing something a chat reply would not, and no threshold separates the two on this data. ' +
        'What would settle it is a corpus where mirroring is *known* present, and there is not one here.',
      '',
    );
  }

  push(
    '## Limitations, stated before anyone quotes the headline',
    '',
    '1. **A forum reply is not a chat turn.** Replies answer a topic, and from the second one onward they',
    '   often answer the other replies. The behaviour table above therefore uses first replies only, which',
    '   is the closest available stand-in for a turn pair and is still not one.',
    '2. **The population is not the population.** V2EX is a technology forum whose users write',
    '   unusually carefully and at unusual length. A false-positive rate measured here is not a',
    '   false-positive rate on casual chat.',
    '3. **Some of it may be machine-written.** The premise is that AI text is rare there, not that',
    '   it is absent, and nothing distinguishes the two in this measurement. That inflates the',
    '   apparent human false-positive rate rather than hiding it.',
    '4. **The text is not reproducible from this repository.** Anyone can re-fetch their own copy',
    '   with `npm run external:fetch`, and the numbers will differ, because the API returns whatever',
    '   is current. This is a measurement, not a benchmark: it has no pinned corpus hash.',
    '5. **Short replies are excluded** (under 8 characters) along with links and text with no Han or',
    '   Latin letters, because a detector was never meant to judge them.',
    '',
    '## Reproducing it',
    '',
    '```bash',
    'npm run external:fetch      # writes .external-corpora/ (gitignored, no licence)',
    'npm run external:measure    # rewrites this file',
    '```',
    '',
    `Generated ${new Date().toISOString()}.`,
    '',
  );

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${lines.join('\n')}\n`, 'utf8');

  process.stdout.write('\nExternal measurement\n\n');
  process.stdout.write(`  human replies      : ${human.texts} (${human.characters} chars)\n`);
  process.stdout.write(`  with a tell        : ${human.withAnyFinding} (${percent(human.withAnyFinding, human.texts)})\n`);
  process.stdout.write(`  flagged            : ${human.flagged} (${percent(human.flagged, human.texts)})\n`);
  process.stdout.write(`  mean antiAIScore   : ${mean(human.scores).toFixed(2)}\n`);
  process.stdout.write(`  control (generated): ${generated.texts} texts, mean ${mean(generated.scores).toFixed(2)}\n`);
  process.stdout.write(`  tells/1000 ratio   : ${ratio.toFixed(2)}\n`);
  process.stdout.write(`\nWritten to ${path.relative(ROOT, OUT).split('\\').join('/')}\n`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`external:measure failed: ${String(error)}\n`);
    process.exit(1);
  });

