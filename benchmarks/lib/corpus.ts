/**
 * The benchmark corpus.
 *
 * Two rules make this loader stricter than it needs to be, and both are
 * deliberate:
 *
 * 1. **A sample without a licence does not load.** Not "warns", not "defaults to
 *    unknown": throws. A corpus that mixes licensed and unlicensed text cannot be
 *    published, and the failure has to happen at load time rather than in a legal
 *    review.
 * 2. **A sample without provenance does not load.** `provenance` is what makes
 *    false positives measurable. A corpus that mixes human and model text without
 *    labelling it can only measure how often the detector fires, which is not a
 *    result.
 *
 * The corpus hash covers the ids, categories and bodies but not the notes, so
 * editing a note does not invalidate a run while editing a sample does.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { splitBody } from './frontmatter.js';
import type { Language, TextMode } from '../../src/shared/types.js';
import { isLanguage, isTextMode } from '../../src/shared/types.js';
import { isAdvicePermission } from '../../src/behavior/permission/index.js';
import type { AdvicePermission } from '../../src/behavior/permission/index.js';
import { compareText } from '../../src/shared/order.js';

export const CATEGORIES = [
  'chinese-prose',
  'english-prose',
  'chinese-chat',
  'english-chat',
  'formal-writing',
  'technical-writing',
  'translated-chinese',
  'ai-pretending-casual',
  'real-human-chat',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const PROVENANCES = ['human-written', 'model-generated', 'model-then-edited'] as const;
export type Provenance = (typeof PROVENANCES)[number];

/**
 * Minimum samples per category below which differences are noise.
 *
 * `benchmarks/README.md` sets the target at 20-100 per category. This is the
 * floor at which a run is still reported, with the shortfall named in the output
 * rather than left for a reader to notice.
 */
export const NOISE_FLOOR = 20;

export interface Sample {
  readonly id: string;
  readonly category: Category;
  readonly language: Language;
  readonly mode: TextMode;
  readonly provenance: Provenance;
  readonly model?: string;
  readonly source: string;
  readonly licence: string;
  readonly notes: string;
  /**
   * The sample's own statement of what it is meant to expose, kept verbatim.
   * Nothing computes with it; it travels into the report so a reader can see
   * whether the sample did what it was written to do.
   */
  readonly expected?: string;
  /** The turn a chat reply answers, when the sample is a chat turn. */
  readonly userTurn?: string;
  /**
   * Whether the sample's user turn invited advice: `granted`, `absent` or `unknown`.
   *
   * Recorded in the sample because it is **evidence about the input**, and a rule that
   * depends on it cannot infer it. `chat.unsolicited_advice` is suppressed when the turn
   * asked for advice, decides when there is positive evidence it did not, and abstains
   * when the sample does not say. Leaving the field out is therefore `unknown`, which is
   * the honest reading of a corpus nobody annotated — and it is why every pre-Phase-B
   * rate for that rule carries the qualifier "measured with `requestKind` unpopulated".
   *
   * The state is read from A v1 by `npm run advice:annotate`, and `advice:annotate
   * --check` fails when a sample's committed state no longer matches what A v1 reads.
   */
  readonly advicePermission?: AdvicePermission;
  readonly body: string;
  /** Path relative to the corpus root, for reports. */
  readonly path: string;
  /**
   * True when a chat sample carries no `user_turn`. Two of the ten behaviours —
   * mirroring and over-completeness — cannot be judged for such a sample, and the
   * corpus reports how many samples are in that state rather than letting a
   * weaker `behaviorScore` pass as a full one.
   */
  readonly chatWithoutUserTurn?: boolean;
}

export interface Corpus {
  readonly root: string;
  readonly samples: readonly Sample[];
  /** SHA-256 over id, category, language, mode, provenance and body. */
  readonly hash: string;
  readonly byCategory: Readonly<Record<string, number>>;
  readonly byProvenance: Readonly<Record<string, number>>;
  /** Categories whose sample count is below the noise floor. */
  readonly thin: readonly string[];
  /** Categories with no samples at all, and why. */
  readonly unpopulated: ReadonlyArray<{ readonly category: string; readonly reason: string }>;
  /**
   * Chat samples with no user turn, where two of the ten behaviours are
   * unjudgeable. Named, not counted: which samples are measured more weakly is
   * the part a reader needs.
   */
  readonly partialBehavior: readonly string[];
}

export class CorpusError extends Error {}

/**
 * Markdown files that sit beside the samples without being samples.
 *
 * `NOT_POPULATED.md` is the one that matters: it is how a category explains that
 * it has no samples, and it must not itself be parsed as one.
 */
export const NON_SAMPLE_FILES: ReadonlySet<string> = new Set([
  'README.md',
  'NOT_POPULATED.md',
]);

const REQUIRED = [
  'id',
  'category',
  'language',
  'mode',
  'provenance',
  'source',
  'licence',
  'notes',
] as const;

const ID_PATTERN = /^[a-z]{2}-[a-z-]+-\d{4}$/;

export function parseSample(text: string, path: string): Sample {
  const { frontMatter, body } = splitBody(text);
  const fields = frontMatter.fields;

  const missing = REQUIRED.filter((key) => (fields[key] ?? '').length === 0);
  // `licence` and `provenance` are called out separately because they are the two
  // fields a corpus is tempted to leave blank.
  if (missing.length > 0) {
    const fatal = missing.filter((key) => key === 'licence' || key === 'provenance');
    const message =
      `${path}: missing ${missing.join(', ')}.` +
      (fatal.length > 0
        ? ' A sample may not enter the corpus without a licence and a provenance: unlicensed text cannot be published, and unlabelled text makes false positives unmeasurable.'
        : '');
    throw new CorpusError(message);
  }

  const id = fields['id'] ?? '';
  if (!ID_PATTERN.test(id)) {
    throw new CorpusError(`${path}: id ${JSON.stringify(id)} does not match ${ID_PATTERN}`);
  }

  const category = fields['category'] ?? '';
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    throw new CorpusError(
      `${path}: unknown category ${JSON.stringify(category)}; known: ${CATEGORIES.join(', ')}`,
    );
  }
  const directory = path.split(/[\\/]/).slice(-2)[0] ?? '';
  if (directory !== category) {
    throw new CorpusError(
      `${path}: category is ${category} but the sample sits in ${directory}/. The directory decides which comparisons a sample takes part in.`,
    );
  }

  const language = fields['language'] ?? '';
  if (!isLanguage(language)) {
    throw new CorpusError(`${path}: language ${JSON.stringify(language)} is not one of zh, en, unknown`);
  }
  const mode = fields['mode'] ?? '';
  if (!isTextMode(mode)) {
    throw new CorpusError(`${path}: mode ${JSON.stringify(mode)} is not a text mode`);
  }

  const provenance = fields['provenance'] ?? '';
  if (!(PROVENANCES as readonly string[]).includes(provenance)) {
    throw new CorpusError(
      `${path}: provenance ${JSON.stringify(provenance)} is not one of ${PROVENANCES.join(', ')}`,
    );
  }
  if (provenance !== 'human-written' && (fields['model'] ?? '').length === 0) {
    throw new CorpusError(
      `${path}: provenance is ${provenance} but no model is named. A generated sample without a generator is a sample nobody can evaluate.`,
    );
  }
  if (provenance === 'human-written' && /generated|deepseek|gpt|claude|model/i.test(fields['source'] ?? '')) {
    throw new CorpusError(
      `${path}: provenance is human-written but the source names a model: ${fields['source']}`,
    );
  }

  if (body.length === 0) throw new CorpusError(`${path}: the sample has no body`);
  // A chat sample without the turn before it is allowed, but it is disclosed
  // rather than passed over: mirroring and over-completeness cannot be judged
  // without it, so two of the ten behaviours go unjudged in that sample. That is
  // a weaker measurement, and the corpus says so instead of the reader finding
  // out from a footnote in the report.
  const withoutUserTurn = mode === 'chat' && (fields['user_turn'] ?? '').length === 0;

  // A recorded advice permission has to be one of the three states. A typo here would
  // silently become `unknown`, which changes what the advice rule does with the sample.
  const adviceField = (fields['advice_permission'] ?? '').trim();
  if (adviceField.length > 0 && !isAdvicePermission(adviceField)) {
    throw new CorpusError(
      `${path}: advice_permission ${JSON.stringify(adviceField)} is not one of granted, absent, unknown. ` +
        'An unrecognised value would be read as unknown, which is not the same claim.',
    );
  }
  if (adviceField.length > 0 && (fields['user_turn'] ?? '').length === 0) {
    throw new CorpusError(
      `${path}: advice_permission is recorded but the sample has no user_turn. The permission is a property of the turn, so there is nothing for it to describe.`,
    );
  }

  return {
    id,
    category: category as Category,
    language,
    mode,
    provenance: provenance as Provenance,
    ...(fields['model'] ? { model: fields['model'] } : {}),
    source: fields['source'] ?? '',
    licence: fields['licence'] ?? '',
    notes: fields['notes'] ?? '',
    ...(fields['expected'] ? { expected: fields['expected'] } : {}),
    ...(fields['user_turn'] ? { userTurn: fields['user_turn'] } : {}),
    ...(adviceField.length > 0 ? { advicePermission: adviceField as AdvicePermission } : {}),
    body,
    path,
    ...(withoutUserTurn ? { chatWithoutUserTurn: true } : {}),
  };
}

/** Load every sample under `<root>/corpora`, or a subset of categories. */
export function loadCorpus(root: string, options: { readonly only?: readonly string[] } = {}): Corpus {
  const corporaRoot = join(root, 'corpora');
  if (!existsSync(corporaRoot)) {
    throw new CorpusError(`no corpus at ${corporaRoot}`);
  }

  const samples: Sample[] = [];
  const unpopulated: Array<{ category: string; reason: string }> = [];
  const seen = new Map<string, string>();

  const directories = readdirSync(corporaRoot)
    .filter((name) => statSync(join(corporaRoot, name)).isDirectory())
    .sort();

  for (const directory of directories) {
    if (options.only && !options.only.includes(directory)) continue;
    const dir = join(corporaRoot, directory);
    const files = readdirSync(dir)
      .filter((name) => name.endsWith('.md'))
      .filter((name) => !NON_SAMPLE_FILES.has(name))
      .sort();

    if (files.length === 0) {
      const explanation = join(dir, 'NOT_POPULATED.md');
      unpopulated.push({
        category: directory,
        reason: existsSync(explanation) ? firstProseLine(explanation) : 'no samples and no explanation',
      });
      continue;
    }

    for (const file of files) {
      const absolute = join(dir, file);
      const relativePath = relative(root, absolute).split('\\').join('/');
      const sample = parseSample(readFileSync(absolute, 'utf8'), relativePath);
      const previous = seen.get(sample.id);
      if (previous) {
        throw new CorpusError(
          `${relativePath}: id ${sample.id} is already used by ${previous}. Ids address samples in run output and in the report.`,
        );
      }
      seen.set(sample.id, relativePath);
      samples.push(sample);
    }
  }

  samples.sort((a, b) => compareText(a.category, b.category) || compareText(a.id, b.id));

  const byCategory: Record<string, number> = {};
  const byProvenance: Record<string, number> = {};
  for (const sample of samples) {
    byCategory[sample.category] = (byCategory[sample.category] ?? 0) + 1;
    byProvenance[sample.provenance] = (byProvenance[sample.provenance] ?? 0) + 1;
  }

  const thin = CATEGORIES.filter(
    (category) => (byCategory[category] ?? 0) > 0 && (byCategory[category] ?? 0) < NOISE_FLOOR,
  );

  return {
    root,
    samples,
    hash: corpusHash(samples),
    byCategory,
    byProvenance,
    thin,
    unpopulated,
    partialBehavior: samples
      .filter((sample) => sample.chatWithoutUserTurn === true)
      .map((sample) => sample.id),
  };
}

/**
 * The corpus hash.
 *
 * Covers what a result depends on and nothing else. Notes are excluded on
 * purpose: correcting a typo in a note must not invalidate a stored run. The advice
 * permission is included, because the advice rule's behaviour depends on it and a run
 * whose recorded state changed is a different run.
 */
export function corpusHash(samples: readonly Sample[]): string {
  const hash = createHash('sha256');
  for (const sample of [...samples].sort((a, b) => compareText(a.id, b.id))) {
    hash.update(
      [
        sample.id,
        sample.category,
        sample.language,
        sample.mode,
        sample.provenance,
        sample.userTurn ?? '',
        sample.advicePermission ?? '',
        sample.body,
        '\u0000',
      ].join('\u001f'),
    );
  }
  return `sha256:${hash.digest('hex')}`;
}

export function samplesIn(corpus: Corpus, category: Category): Sample[] {
  return corpus.samples.filter((sample) => sample.category === category);
}

/**
 * The first line of prose in a file, skipping headings and markup.
 *
 * Recovery of a category's stated reason has to read like a sentence, or the run
 * output and the report both quote a `#` heading at the reader.
 */
function firstProseLine(path: string): string {
  const lines = readFileSync(path, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.startsWith('#') || trimmed.startsWith('-') || trimmed.startsWith('>')) continue;
    return trimmed;
  }
  return 'no samples and no usable explanation';
}

/**
 * The categories whose samples are genuinely human-written, for control use.
 *
 * `translated-chinese` is deliberately absent. It is a **positive** category —
 * it exists so `chinese.translationese` has something to fire on — and all six of
 * its samples are generated, so listing it here would advertise a control group
 * that contributes none. Which samples are controls is decided by `provenance`,
 * not by category, and the report derives its control list the same way.
 */
export const HUMAN_CONTROL_CATEGORIES: readonly Category[] = [
  'chinese-prose',
  'english-prose',
  'formal-writing',
  'technical-writing',
];

export function humanWritten(samples: readonly Sample[]): Sample[] {
  return samples.filter((sample) => sample.provenance === 'human-written');
}
