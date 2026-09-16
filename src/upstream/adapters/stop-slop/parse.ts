/**
 * Parser for `hardikpandya/stop-slop`.
 *
 * The reference implementation for this adapter is `../blader/parse.ts`: same
 * shape (find the rule units, map each onto a canonical signature, fail loudly on
 * anything unmapped) with the mechanics changed to fit this upstream's quirks.
 *
 * Shape of the upstream, all read off the pinned commit (7 files, 16,344 bytes,
 * zero CJK, no code):
 *
 *     references/phrases.md     8 `##` category headings, 65 `- "..."` bullets
 *                               and an 11-row `| Avoid | Use instead |` table
 *     references/structures.md  11 `##` headings and 48 `| "Pattern" | Problem |`
 *                               rows, with an `**Instead:**` fix under 8 of them
 *     references/examples.md    5 before/after pairs, each labelled in its heading
 *     SKILL.md                  8 Core Rules, 12 Quick Checks, a 5-dimension rubric
 *     README.md, CHANGELOG.md, LICENSE
 *
 * Quirks this parser has to survive, all verified against the pinned commit:
 *
 * - One rule per **heading**, not per phrase. A category with 15 watched phrases
 *   is one canonical rule with 15 `watchPhrases`; fifteen rules would charge
 *   fifteen times at dedupe time for one problem.
 * - `phrases.md` mixes two shapes. Eight `##` categories, but only Business Jargon
 *   is a table; its 11 rows carry a replacement in the second column, which
 *   becomes the phrase's `note`, not its `match` — the detector matches
 *   "Navigate", the rewrite produces "Handle, address".
 * - `phrases.md` is also **eight headings but nine rules**. `Adverbs` (:53-84) is
 *   two lists under one heading: its own 15 adverbs (:59-73) and, after the
 *   lead-in `Also cut these filler phrases:` (:75), 7 filler phrases (:77-83).
 *   The brief counts Filler phrases as a category of its own — it is 7 entries
 *   and its own tell — so the block is treated as a pseudo-heading with id
 *   `phrase-filler-phrases` and located on the lead-in line. A parser that only
 *   followed `##` would silently swell Adverbs from 15 entries to 22.
 * - Six `phrases.md` entries carry a slot marker and are emitted as `template`,
 *   not `literal`: "Here's what [X]", "Here's this [X]", "Here's that [X]",
 *   "Here's why [X]" (:8-11), "In today's [X]" (:78) and "This is what X actually
 *   looks like" (:115). No detector can match a bracket or a bare "X", so the
 *   file's 76 listed entries are 70 literal + 6 template — asserted, not rounded
 *   to 76 literal to make the arithmetic look tidy.
 * - The slot-marker list is read out of the shared classifier
 *   (`extract/phrase.ts:16-22`) through matched-pair probes rather than copied,
 *   because `classifyPhrase` itself is unusable on this file: its `\b[X-ZN]\b`
 *   marker matches any capitalised word ("Adverbs" is a template to it), and
 *   "Here's the thing:" is under the 4-character Latin floor only because of its
 *   punctuation. The shared classifier's own tests pin the three probes used
 *   here, and a change to the marker list without the classifier changing would
 *   make a probe fail loudly.
 * - `structures.md` rows are construction templates, never literal strings.
 *   "Not because X. Because Y." is a shape, not a phrase, so every row is
 *   `kind: 'template'` and the row's second column becomes its `note`. Nothing
 *   here may be matched literally.
 * - Only 8 of the 11 structure headings have an `**Instead:**` line. The three
 *   that do not — Formulaic Constructions (:59-64), Sentence Starters to Avoid
 *   (:108-116) and Rhythm Patterns (:118-127) — carry their fix in the second
 *   column or in the paragraph after the table; the guidance falls back to those
 *   sources rather than being invented.
 * - Two headings have no prose paragraph at all (Formulaic Constructions and
 *   Sentence Starters to Avoid), so `description` falls back to the heading plus
 *   its counts instead of quoting an empty string.
 * - `references/examples.md` is a fourth rule-bearing file. Its five pairs are
 *   attached to the rule each one's own heading names, so the examples travel
 *   with the rule they demonstrate instead of being dropped.
 * - `CHANGELOG.md` is stale: its newest entry is 2026-01-13 and it misses the
 *   performative-emphasis and telling-not-showing additions that are already in
 *   `references/phrases.md:101-116`. No version is declared anywhere in the
 *   repository. The absence is reported, not filled with a guess.
 *
 * Provenance, which is the reason this adapter exists at all
 * ---------------------------------------------------------
 * `judetelan/ai-humanizer` absorbed most of this upstream verbatim and credits it
 * in prose only. Its own source records the boundary at
 * `scripts/registry/rules.mjs:148` (`// ── Absorbed from stop-slop ──`) and
 * `README.md:290-294`, with the phrase lists living at
 * `scripts/lexicons.mjs:53-58,141-142,147-195,199-208,210-224`. Content that
 * `ai-humanizer` has is marked `inherited` here (`originatedIn` =
 * `judetelan/ai-humanizer`) so the suite attributes it to **both** upstreams and
 * never counts it as two discoveries. Content it does not have is marked `unique`
 * in the notes and carries **no** `originatedIn` field, so the pair is not
 * claimed to be a joint discovery by `deriveTags` (`extract/types.ts:133-139`,
 * which tags `originatedIn` as `inherited`); the search behind each `unique`
 * verdict is named in the note and re-run as an assertion in the test.
 *
 * Absolutism, and why every absolute rule is weak-alone
 * ----------------------------------------------------
 * This upstream states rules the rest of the corpus deliberately does not:
 * `phrases.md:55` "Kill all adverbs. No -ly words", `structures.md:125` "No em
 * dashes at all", `SKILL.md:25` "No em dashes". `blader`'s suppression policy
 * treats dashes, passive voice and intensifiers as weak alone *by design*
 * (`blader/signatures.ts:24,27` and `blader/parse.ts:265-270`), so importing the
 * absolute form would raise false positives across the corpus. Every rule whose
 * upstream form is absolute is therefore `weakAlone: true`. The criterion is
 * stated once on `WEAK_ALONE_CRITERION` below. The upstream also contradicts
 * itself: `references/examples.md:45` prints "Speed, quality, cost—pick two." as
 * an *improved* line, four rules away from guidance quoted from a file that bans
 * the em-dash outright. Recorded on the rules and in the warnings, because a
 * future contributor who imports the absolutism will otherwise reintroduce
 * exactly the false positives this `research-only` marking exists to prevent.
 *
 * The whole-adapter caution, restated where a contributor will see it: stop-slop
 * is `research-only` (`./index.ts:20-26`). This file extracts structure and
 * provenance, not prose.
 *
 * What `warnings` means here
 * -------------------------
 * `warnings` holds only what a human must look at *in this run*: a heading count
 * that no longer matches, an unmapped rule, a malformed example, a `SKILL.md`
 * checklist item whose rule has disappeared. It is empty on a clean run against
 * the pinned commit, which is the property the test asserts.
 *
 * Two facts about the upstream are true and permanent rather than surprising, and
 * they are exported as `STOP_SLOP_POLICY_RECORDS` instead: that no version is
 * declared anywhere and that the upstream's absolute rules conflict with the
 * suite's suppression policy. Putting those in `warnings` would emit the same two
 * lines on every run and teach a reader to ignore the array. The absolutism is
 * additionally carried in the notes of every rule it changes, so it travels with
 * the generated data as well.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  assertKnownSignature,
  signatureSpec,
  unmappedSignature,
} from '../../../rules/canonical/signatures.js';
import { cleanPhrase, splitOutsideParens } from '../../extract/phrase.js';
import { extractBlockquotes } from '../../extract/markdown.js';
import { EXTRACTION_SCHEMA_VERSION } from '../../extract/types.js';
import type {
  ExtractedRule,
  ExtractionResult,
  PhraseKind,
  RuleExample,
  WatchPhrase,
} from '../../extract/types.js';
import { STOP_SLOP_SIGNATURES } from './signatures.js';

const UPSTREAM = 'hardikpandya/stop-slop';
const SLUG = 'stop_slop';

const PHRASES_FILE = 'references/phrases.md';
const STRUCTURES_FILE = 'references/structures.md';
const EXAMPLES_FILE = 'references/examples.md';
const SKILL_FILE = 'SKILL.md';
const CHANGELOG_FILE = 'CHANGELOG.md';

/** Where the phrase list files itself when it is not under a `##` heading. */
const FILLER_LEAD_IN_LINE = 75;

/**
 * How many entries `references/phrases.md` lists: 65 bullets and 11 table rows.
 *
 * The number of *watched phrases* is higher, because two entries bundle variants
 * that this adapter keeps separate. Both numbers are asserted, so neither can
 * drift into the other.
 */
const EXPECTED_PHRASE_ROWS = 76;

/** `references/examples.md:45` — see `ABSOLUTISM.selfContradiction`. */
const EM_DASH_IN_OWN_EXAMPLES = `${EXAMPLES_FILE}:45`;

/**
 * The caution from `./index.ts:20-26`, kept verbatim in substance so a reader of
 * the generated JSON meets it again next to the rules it constrains.
 */
const UPSTREAM_CAUTION =
  'stop-slop is research-only (src/upstream/adapters/stop-slop/index.ts:20-26): its prose must ' +
  'not be imported wholesale, because roughly nine tenths of it is already in the corpus via ' +
  'judetelan/ai-humanizer and its absolute rules conflict with the suite suppression policy.';

/**
 * The single criterion behind every `weakAlone: true` in this adapter.
 *
 * A rule is weak alone when the upstream states it as an absolute ("kill all
 * adverbs", "no em dashes at all"), or when the watched item occurs in ordinary
 * edited English at a rate that makes one sighting uninformative: single common
 * words ("just", "really", "actually"), bare intensifiers, common discourse
 * markers ("honestly", "Look,") and punctuation. Those families are exactly the
 * ones `blader` holds down (`blader/parse.ts:265-270`).
 *
 * A rule is strong alone when the watched item is a multi-word construction whose
 * presence is itself the tell ("Not because X. Because Y.", "The stakes are
 * high"); those survive one sighting.
 *
 * Density gating is how `ai-humanizer` implements the same judgement, and the
 * numbers are cited per rule: `engines/lexical.mjs:243` (`adverb-filler` needs 4
 * hits at 0.8 per 100 words), `:252` (`lazy-extremes` needs 4), `:291`
 * (`false-agency` needs 2), `:302` (`passive-voice` needs 3 at 1 per 120 words),
 * `:39` (`em-dash-overuse` needs 4, and its comment at `:23` calls the dash
 * "primarily a Claude tell" rather than a ban), `:193` (`aphoristic-cadence` needs
 * 2).
 */
const WEAK_ALONE_CRITERION =
  'criterion: stated as an absolute upstream, or a single common word whose presence in edited ' +
  'English is uninformative (see WEAK_ALONE_CRITERION in parse.ts)';

/**
 * Rules that survive a single sighting, each because the watched item is a
 * multi-word construction rather than an absolute or a common word.
 *
 * This is policy, not provenance: `weakAlone` says how the suite should act on a
 * hit, and it is set from the rule's own wording — not from whether another
 * upstream happens to have the rule too.
 */
const STRONG_ALONE_IDS: ReadonlySet<string> = new Set([
  'phrase-business-jargon',
  'phrase-meta-commentary',
  'phrase-vague-declaratives',
  'structure-binary-contrasts',
  'structure-negative-listing',
  'structure-dramatic-fragmentation',
  'structure-formulaic-constructions',
  'structure-false-agency',
  'structure-narrator-from-a-distance',
]);

/**
 * Rules that came from stop-slop alone: the material `ai-humanizer` had to be
 * barred from taking, and the material that appears nowhere else in the corpus.
 *
 * Three headings qualify. Everything else is already in `ai-humanizer`'s
 * lexicons, or shares a category with a rule of its own. That includes the two
 * headings `ai-humanizer` *claims* in its credits but never implemented
 * (`README.md:293-294`): of those, narrator-from-a-distance is here and
 * telling-not-showing is in the phrase list.
 */
const UNIQUE_RULE_IDS: ReadonlySet<string> = new Set([
  'phrase-telling-instead-of-showing',
  'structure-formulaic-constructions',
  'structure-narrator-from-a-distance',
]);

/**
 * Headings that share a canonical signature with another heading in the same
 * upstream, so the collision lands in a note rather than reading as a discovery.
 *
 * `phrases.md:53-73` and `structures.md:134` are the same adverb rule stated
 * twice; `structures.md:125` (one row of Rhythm Patterns) and `SKILL.md:25,43`
 * are the em-dash ban stated twice. One tell is one problem, and
 * `toRuleCandidates` keys on the signature, so the pair collapses at dedupe time;
 * recorded here so a reader of the generated data sees why.
 */
const DUPLICATE_SIGNATURES: Readonly<Record<string, string>> = {
  'phrase-adverbs': 'structure-word-patterns',
  'structure-word-patterns': 'phrase-adverbs',
  'structure-rhythm-patterns':
    'SKILL.md:25 ("No em dashes") and :43 ("Em-dash anywhere? Remove it.")',
};

/**
 * The absolutism, quoted so the notes can cite it and the test can assert the
 * conflict is real rather than a paraphrase of one.
 */
const ABSOLUTISM = {
  adverbs:
    'references/phrases.md:55 "Kill all adverbs. No -ly words. No softeners, no intensifiers, no ' +
    'hedges."',
  emDash:
    'references/structures.md:125 "Em-dashes | Remove. Use commas or periods. No em dashes at all."',
  skillEmDash: 'SKILL.md:25 "No em dashes", repeated as a checklist item at SKILL.md:43',
  selfContradiction:
    `references/examples.md:45 — the "After" line of Example 4 — prints "Speed, quality, ` +
    'cost—pick two.", an em-dash used as an improvement, in a repository whose ' +
    'references/structures.md:125 says "No em dashes at all". The example predates the January ' +
    "2026 additions, so the ban is not enforced on the upstream's own samples.",
} as const;

/** A `##` heading with its 1-based line and body. */
interface Heading {
  readonly title: string;
  readonly line: number;
  /** Last line of the section, i.e. the line before the next heading of the same level. */
  readonly endLine: number;
  readonly body: string;
}

/**
 * A section that is one rule.
 *
 * `ruleId` is not the heading title slugged: every id in `STOP_SLOP_SIGNATURES`
 * carries a `phrase-` or `structure-` prefix so a phrase rule and a structure rule
 * can never collide, and the rule id is what the signature map is keyed on.
 *
 * `entriesFrom` is the line the section's *content* begins on, which for a
 * pseudo-heading is later than its `line`; `bodyOverride` carries the content for
 * the same reason. The two differ only for Filler phrases.
 */
interface RuleHeading extends Heading {
  readonly ruleId: string;
  readonly entriesFrom: number;
  readonly bodyOverride?: string;
}

/** A row read out of one of the two Markdown tables. */
interface TableRow {
  readonly cells: readonly string[];
  readonly line: number;
}

/** A watched item with the locator of the row or bullet it came from. */
interface LocatedPhrase {
  readonly phrase: WatchPhrase;
  readonly line: number;
}

/** One extracted heading, before it becomes an `ExtractedRule`. */
interface RawRule {
  readonly upstreamRuleId: string;
  readonly title: string;
  readonly source: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly intro: string;
  readonly rewriteGuidance: string;
  readonly watchPhrases: readonly WatchPhrase[];
  readonly phraseLines: readonly number[];
  readonly quote: string;
  readonly notes: readonly string[];
}

export async function parseStopSlop(repoPath: string): Promise<ExtractionResult> {
  const [phrases, structures, examples, skill, changelog] = await Promise.all([
    readFile(path.join(repoPath, PHRASES_FILE), 'utf8'),
    readFile(path.join(repoPath, STRUCTURES_FILE), 'utf8'),
    readFile(path.join(repoPath, EXAMPLES_FILE), 'utf8'),
    readFile(path.join(repoPath, SKILL_FILE), 'utf8'),
    readFile(path.join(repoPath, CHANGELOG_FILE), 'utf8'),
  ]);

  const warnings: string[] = [];
  const phraseHeadings = findHeadings(phrases, 2);
  const structureHeadings = findHeadings(structures, 2);

  // Counts are asserted rather than assumed, so an upstream restructure shows up
  // as a warning instead of as a quietly shorter rule list.
  if (phraseHeadings.length !== 8) {
    warnings.push(
      `Expected 8 category headings in ${PHRASES_FILE}, found ${phraseHeadings.length}. ` +
        'The upstream may have restructured; check the mapping before trusting this run.',
    );
  }
  if (structureHeadings.length !== 11) {
    warnings.push(
      `Expected 11 headings in ${STRUCTURES_FILE}, found ${structureHeadings.length}. ` +
        'The upstream may have restructured; check the mapping before trusting this run.',
    );
  }

  const raws: RawRule[] = [
    ...splitPhraseCategories(phraseHeadings).map((heading) => parsePhraseCategory(heading)),
    ...structureHeadings.map((heading) => parseStructureHeading(structureRule(heading))),
  ];

  const rules = raws.map((raw) => mappedRule(raw, warnings));

  const pairs = attachExamples(rules, examples, warnings);
  if (pairs !== 5) {
    warnings.push(
      `Expected 5 before/after pairs in ${EXAMPLES_FILE}, read ${pairs}. The upstream may have ` +
        'restructured; examples are attached by the name in their heading.',
    );
  }

  reportCoverage(rules, raws, warnings);
  reportVersion(changelog, warnings);
  reportSkillAgreement(rules, skill, warnings);

  return {
    upstream: UPSTREAM,
    sourceCommit: '',
    extractedAt: new Date().toISOString(),
    sources: [PHRASES_FILE, STRUCTURES_FILE, EXAMPLES_FILE, SKILL_FILE, CHANGELOG_FILE],
    rules,
    warnings,
  };
}

/**
 * A `structures.md` heading as a rule.
 *
 * The heading-to-id rule is the same as for the phrase file: the id is
 * `structure-` plus the heading slugged, so the two files can never produce the
 * same id even when they share a word ("Word Patterns" and "Passive Voice").
 */
function structureRule(heading: Heading): RuleHeading {
  return {
    ...heading,
    ruleId: `structure-${slug(heading.title)}`,
    entriesFrom: heading.line + 1,
  };
}

/**
 * Turn `phrases.md`'s eight `##` headings into its nine rule sections.
 *
 * The extra rule is Filler phrases. `Adverbs` (:53-84) holds two lists: the 15
 * adverbs the heading names (:59-73), and after the lead-in
 * `Also cut these filler phrases:` (:75) a further 7 entries (:77-83) that are a
 * different tell — padding phrases rather than intensifiers, and mapped to a
 * different canonical signature. The brief counts them as a category of their
 * own, so they are split off here. A parser that only followed `##` would report
 * Adverbs with 22 watched phrases and lose the distinction.
 *
 * The split is done by slicing the raw lines rather than by a second `##` regex,
 * so `entriesFrom` keeps every phrase's real line number.
 */
function splitPhraseCategories(headings: readonly Heading[]): RuleHeading[] {
  const out: RuleHeading[] = [];

  for (const heading of headings) {
    const ruleId = PHRASE_RULE_IDS[heading.title];
    if (!ruleId) continue;

    if (heading.title !== 'Adverbs') {
      out.push({ ...heading, ruleId, entriesFrom: heading.line + 1 });
      continue;
    }

    const lines = heading.body.split(/\r?\n/);
    const lead = lines.findIndex((line) => /^Also cut these filler phrases:/i.test(line.trim()));
    if (lead === -1) {
      out.push({ ...heading, ruleId, entriesFrom: heading.line + 1 });
      continue;
    }

    out.push({
      ...heading,
      ruleId,
      endLine: heading.line + lead,
      entriesFrom: heading.line + 1,
      bodyOverride: lines.slice(0, lead).join('\n'),
    });
    out.push({
      title: 'Filler phrases',
      line: heading.line,
      endLine: heading.endLine,
      body: lines.slice(lead).join('\n'),
      ruleId: 'phrase-filler-phrases',
      entriesFrom: heading.line + 1 + lead,
    });
  }

  return out;
}

/** `##` heading title -> rule id, so every id carries its `phrase-` prefix. */
const PHRASE_RULE_IDS: Readonly<Record<string, string>> = {
  'Throat-Clearing Openers': 'phrase-throat-clearing-openers',
  'Emphasis Crutches': 'phrase-emphasis-crutches',
  'Business Jargon': 'phrase-business-jargon',
  Adverbs: 'phrase-adverbs',
  'Meta-Commentary': 'phrase-meta-commentary',
  'Performative Emphasis': 'phrase-performative-emphasis',
  'Telling Instead of Showing': 'phrase-telling-instead-of-showing',
  'Vague Declaratives': 'phrase-vague-declaratives',
};

/**
 * One rule per `phrases.md` category.
 *
 * The category is one canonical rule even when it lists fifteen phrases: the
 * phrases are watched *items* of one tell, and the canonical signature is the
 * category's meaning. The alternative — one rule per phrase — is argued against
 * in the notes of the two largest categories, because that is where the choice
 * costs the most.
 */
function parsePhraseCategory(rule: RuleHeading): RawRule {
  const body = rule.bodyOverride ?? rule.body;
  const lines = body.split(/\r?\n/);
  const head = lines[0] ?? '';
  const located: LocatedPhrase[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const lineNumber = rule.entriesFrom + index;

    const bullet = /^\s*-\s+(.*)$/.exec(line);
    if (bullet) {
      // The raw text goes in, not a cleaned copy: `makeLots` has to see the
      // upstream's quotation marks and its trailing ellipsis, both of which
      // `cleanPhrase` removes (`extract/phrase.ts:25,88-96`).
      located.push(...makeLots((bullet[1] ?? '').trim(), lineNumber));
      continue;
    }

    const row = parseTableRow(line, lineNumber);
    if (row) {
      // Business Jargon is the only table in this file: `| Avoid | Use instead |`.
      // The avoid term is what a detector matches; the replacement is what the
      // rewrite should produce, so it becomes the note and never the match.
      const avoid = (row.cells[0] ?? '').trim();
      const replacement = cleanPhrase(row.cells[1] ?? '');
      if (avoid.length === 0) continue;
      // The replacement goes first so the note reads as one instruction rather
      // than a sentence fragment followed by "Use instead:".
      located.push(
        ...makeLots(
          avoid,
          lineNumber,
          replacement.length > 0 ? `Use instead: ${replacement}` : '',
        ),
      );
    }
  }

  const watchPhrases = located.map((entry) => entry.phrase);
  const intro = firstProseParagraph(body);
  const literal = watchPhrases.filter((phrase) => phrase.kind === 'literal').length;
  const templates = watchPhrases.length - literal;

  return {
    upstreamRuleId: rule.ruleId,
    title: rule.title,
    source: PHRASES_FILE,
    startLine: rule.line,
    endLine: rule.endLine,
    intro,
    rewriteGuidance: literal + templates > 0 ? fallbackBulletGuidance(watchPhrases) : intro,
    watchPhrases,
    phraseLines: located.map((entry) => entry.line),
    quote: truncate(intro.length > 0 ? intro : head, 240),
    notes: phraseNotes(rule, watchPhrases, located),
  };
}

/**
 * One rule per `structures.md` heading.
 *
 * The rows are construction templates and are emitted as `kind: 'template'` with
 * the second column as the note. They are never literal: a detector cannot match
 * "Not because X. Because Y." as a string, and treating a template as a literal is
 * how a lexical detector starts firing on every sentence containing "not".
 */
function parseStructureHeading(rule: RuleHeading): RawRule {
  const lines = rule.body.split(/\r?\n/);
  const located: LocatedPhrase[] = [];
  const insteadLines: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const lineNumber = rule.entriesFrom + index;

    const row = parseTableRow(line, lineNumber);
    if (row) {
      const pattern = (row.cells[0] ?? '').trim();
      const second = cleanVariant(row.cells[1] ?? '');
      if (pattern.length === 0) continue;
      located.push(...makeLots(pattern, lineNumber, second, 'template'));
      continue;
    }

    const instead = /^\*\*Instead:\*\*\s*(.*)$/.exec(line);
    if (instead) {
      const text = normalise(instead[1] ?? '');
      if (text.length > 0) insteadLines.push(text);
    }
  }

  const watchPhrases = located.map((entry) => entry.phrase);
  const intro = firstProseParagraph(rule.body);
  const afterTable = paragraphAfterTable(rule.body);
  const guidance =
    insteadLines.length > 0
      ? insteadLines.join(' ')
      : afterTable.length > 0
        ? afterTable
        : uniqueJoin(watchPhrases.map((phrase) => phrase.note ?? ''));

  const notes: string[] = [UPSTREAM_CAUTION];
  if (insteadLines.length === 0) {
    notes.push(
      `No "**Instead:**" line under this heading. The rewrite guidance is taken from ` +
        `${afterTable.length > 0 ? 'the paragraph that follows the table' : 'the second column of the table'} ` +
        `(${STRUCTURES_FILE}:${rule.line}-${rule.endLine}), not invented here.`,
    );
  }

  return {
    upstreamRuleId: rule.ruleId,
    title: rule.title,
    source: STRUCTURES_FILE,
    startLine: rule.line,
    endLine: rule.endLine,
    intro,
    rewriteGuidance: guidance.length > 0 ? guidance : intro,
    watchPhrases,
    phraseLines: located.map((entry) => entry.line),
    // Formulaic Constructions has neither an `**Instead:**` line nor a prose
    // paragraph, so its quote would otherwise be empty. Its first table row is the
    // shortest verbatim excerpt that stands for the heading.
    quote: truncate(intro.length > 0 ? intro : (watchPhrases[0]?.text ?? ''), 240),
    notes,
  };
}

/** Build one watched item, keeping the row's own line for the phrase index. */
/**
 * Build the watched items for one entry, which may bundle variants.
 *
 * Kind is decided per variant rather than per line, because the upstream bundles
 * strings that are not the same sort of thing: `- "Full stop." / "Period."` is two
 * literal strings, while `"Here's what [X]"` is one construction. Deciding per line
 * would label `"X is a feature, not a bug"` a literal and hand a detector a string
 * with an `X` in it.
 *
 * Every non-slot entry is `literal`, including the six that end in an ellipsis.
 * That follows the brief's rule for this file — "every listed phrase becomes a
 * `WatchPhrase` of kind `literal`" — and it keeps the arithmetic exact: of the
 * file's 76 entries, 8 carry a slot and 68 do not. The ellipsis entries are the one
 * place the shared classifier disagrees, and it is recorded in the notes rather
 * than acted on: `The rest of this essay explains...` truncates a sentence, but the
 * words before the dots are still a literal string a detector can find.
 */
function makeLots(raw: string, line: number, note = '', forced?: PhraseKind): LocatedPhrase[] {
  const { text: unquoted, note: caveat } = splitTrailingCaveat(raw);
  const notes = [note, caveat ?? ''].filter((part) => part.length > 0).join('. ');

  const parts = splitVariants(unquoted);
  if (parts.length === 0) return [];
  const kinds = parts.map((part) => variantKind(part, forced));

  const out: LocatedPhrase[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const kind = kinds[index]!;
    // A template keeps the whole entry, unsplit, because the shapes it bundles are
    // one row of the upstream's table (the row count must not drift) and a pattern
    // author needs to see them together.
    const text =
      kind === 'template' ? stripQuotes(cleanVariant(unquoted)) : parts[index]!;
    if (out.some((entry) => entry.phrase.text === text)) continue;
    out.push({
      phrase: {
        text,
        kind,
        // A template is stored verbatim rather than lowercased: the match field for
        // a literal is a lowercase string ready for exact matching, and for a
        // template it is the upstream's own wording, which a pattern author needs
        // to see capitalised.
        match: kind === 'literal' ? text.toLowerCase() : text,
        ...(notes.length > 0 ? { note: notes } : {}),
      },
      line,
    });
  }
  return out;
}

/**
 * True when the upstream cut the entry short: it ends in an ellipsis.
 *
 * Read by the notes, not by the classifier. The shared list treats `...` as a
 * construction marker (`extract/phrase.ts:19`), which is right for `not X ... but
 * Y`; this upstream uses a trailing ellipsis to mean "and so on" instead. The
 * entries are still literals because the words before the dots are matchable, but
 * a detector should treat them as prefixes, which is what the note on the rule
 * says.
 */
function isTruncated(text: string): boolean {
  return /(?:\.\.\.|\u2026)$/.test(text.trim());
}

/**
 * Strip the surrounding quotation marks the upstream wraps every entry in.
 *
 * `phrases.md` writes `- "Here's the thing:"` and `structures.md` writes
 * `| "Not because X. Because Y." |`. The quotes are Markdown emphasis, not part of
 * the phrase, and leaving them on would put them in `match`, where a detector
 * would look for them literally. Only a *matching pair* of outer quotes is
 * removed, so an internal quote in `Paragraphs starting with "So"` survives.
 */
function stripQuotes(text: string): string {
  const trimmed = text.trim();
  for (const [open, close] of [
    ['"', '"'],
    ['\u201c', '\u201d'],
  ] as const) {
    if (trimmed.length >= 2 && trimmed.startsWith(open) && trimmed.endsWith(close)) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

/**
 * Split one entry on the `/` the upstream uses to bundle variants, and clean each
 * variant without losing its trailing ellipsis.
 *
 * `- "Full stop." / "Period."` is two watchable strings, and the mouthful
 * `"Not X. But Y." / "not X, it's Y" / "isn't X, it's Y"` is three, so keeping
 * them as one entry would make a detector search for a string containing `" / "`.
 * The split happens only on `/` outside quotes, so a URL or a `setup/reveal` pair
 * inside a note is left alone.
 *
 * The ellipsis is preserved deliberately. `cleanPhrase` strips trailing
 * punctuation as list noise (`extract/phrase.ts:25`), which is right for
 * `Let that sink in.` and wrong for `As we'll see...` — the dots are part of how
 * the upstream wrote the entry, and `kindPhrase` needs to see them.
 */
function splitVariants(raw: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]!;
    if (char === '"' || char === '\u201c' || char === '\u201d') quoted = !quoted;
    if (char === '/' && !quoted) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);

  const cleaned = parts
    .map((part) => cleanVariant(stripQuotes(part)))
    .filter((part) => part.length > 0)
    .filter((part, index, all) => all.indexOf(part) === index);

  return cleaned.length > 0 ? cleaned : [cleanVariant(stripQuotes(raw))];
}

/** `cleanPhrase`, but a trailing ellipsis survives because it is meaningful here. */
function cleanVariant(text: string): string {
  const truncated = /(?:\.\.\.|\u2026)\s*$/.test(text);
  const cleaned = cleanPhrase(text);
  if (!truncated || cleaned.length === 0) return cleaned;
  return `${cleaned.replace(/[.\u2026]+$/, '')}...`;
}

/**
 * Separate a trailing parenthetical from the phrase.
 *
 * Only `phrases.md` needs this: `Navigate (challenges)` is the phrase "Navigate"
 * with a scope caveat, and `All adverbs (-ly words, "really," ...)` is a row of
 * the Word Patterns table. The caveat becomes the note, because it is a scope
 * restriction the detector has to honour rather than part of the match. This is
 * the same job as the shared `splitNote` (`extract/phrase.ts:105`); it is done
 * here on the raw line because the shared one runs on already-segmented entries
 * and would also strip a bracket that is a *slot* rather than a caveat — which is
 * exactly the `[X]` case this file must keep, and why the bracket test comes first.
 */
function splitTrailingCaveat(raw: string): { text: string; note?: string } {
  if (/\[[^\]]*\]/.test(raw)) return { text: raw };
  const match = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(raw);
  if (!match) return { text: raw };
  const body = (match[1] ?? '').trim();
  const note = (match[2] ?? '').trim();
  if (body.length === 0 || note.length === 0) return { text: raw };
  return { text: body, note };
}

/**
 * The slot markers, and why the shared classifier is not used directly.
 *
 * A slot is a bracket or a bare placeholder letter; the two regexes below are the
 * shared list's first two entries (`extract/phrase.ts:17-18`), restated rather than
 * fetched. The shared `classifyPhrase` cannot be used on this file for two reasons
 * that would both be silent if they were wrong:
 *
 *   - Its marker list includes `/\b[X-ZN]\b/`, which matches any single capital
 *     letter in that range — so "Adverbs" and "Emphasis" classify as templates.
 *     That is not a defect there, but on a list of quoted phrases it misfires on
 *     the first word of many entries.
 *   - Its length floor (`extract/phrase.ts:115`, 4 Latin characters) makes "just"
 *     and "Let that sink in." into `reference`s, because the floor is applied to
 *     the string *with* its punctuation, whereas this upstream deliberately lists
 *     short common words as the tell.
 *
 * The restatement is guarded rather than trusted: the test asserts that the shared
 * `containsTemplateMarker` agrees with this adapter about every phrase it calls a
 * template. The shared list's third marker, an ellipsis, is deliberately *not*
 * restated: see `isTruncated`, which treats a trailing ellipsis as the truncation
 * it is in this upstream.
 */
const SLOT_MARKERS: readonly RegExp[] = [/\b[X-ZN]\b/, /\[[^\]]+\]/];

/**
 * Classify one already-split variant: a slot makes a construction, everything else
 * is a string a detector can look for. Only two of the three `PhraseKind` values
 * are produced by this adapter.
 */
function variantKind(text: string, forced?: PhraseKind): PhraseKind {
  if (forced) return forced;
  return SLOT_MARKERS.some((marker) => marker.test(text)) ? 'template' : 'literal';
}

/**
 * Notes common to every phrase category: the shape of the category, the
 * classification decisions taken for it, and — the part that matters most — the
 * `inherited` / `unique` verdict with the search behind it.
 */
function phraseNotes(
  rule: RuleHeading,
  watchPhrases: readonly WatchPhrase[],
  located: readonly LocatedPhrase[],
): string[] {
  const notes: string[] = [];
  const id = rule.ruleId.replace(/^phrase-/, '').replace(/-/g, '_');
  const literal = watchPhrases.filter((phrase) => phrase.kind === 'literal').length;
  const templates = watchPhrases.length - literal;
  const replacements = watchPhrases.filter((phrase) => (phrase.note ?? '').includes('Use instead:'));

  const verdict = PHRASE_VERDICTS[id];
  if (verdict) notes.push(verdict);

  const first = located[0]?.line;
  const last = located[located.length - 1]?.line;
  notes.push(
    `Shape: ${literal} literal watched phrase(s)` +
      (templates > 0 ? `, ${templates} construction template(s)` : '') +
      (replacements.length > 0
        ? `, ${replacements.length} carrying the upstream's replacement in the note`
        : '') +
      (first && last ? `; entries at ${PHRASES_FILE}:${first}-${last}` : '') +
      `.`,
  );

  if (id === 'filler_phrases') {
    notes.push(
      `This category has no heading of its own: it is the second list inside "## Adverbs" ` +
        `(${PHRASES_FILE}:${rule.line}), introduced by the lead-in "Also cut these filler phrases:" ` +
        `(${PHRASES_FILE}:${FILLER_LEAD_IN_LINE}). The lead-in is the only label its 7 entries have, ` +
        'so the id is slugs from that line rather than from a `##`, and the locator points at the ' +
        'real entry range.',
    );
    notes.push(
      `"In today's [X]" (${PHRASES_FILE}:78) is classified template, not literal: the bracket is a ` +
        'slot, so no detector can match the string. See the note on phrase-adverbs for the other ' +
        'five templates in this file.',
    );
  }

  if (id === 'throat_clearing_openers' || id === 'adverbs') {
    notes.push(
      `One rule, not ${watchPhrases.length}: the upstream lists watched items of one tell, and the ` +
        'canonical signature is the tell. One rule per phrase would give this adapter ' +
        `${watchPhrases.length} rules for one problem, and at dedupe time one problem would be ` +
        `charged ${watchPhrases.length} times.`,
    );
  }

  if (id === 'throat_clearing_openers') {
    const slots = watchPhrases.filter((phrase) => phrase.kind === 'template');
    notes.push(
      `${slots.length} of the 15 entries are templates, not literal phrases: ` +
        `${slots.map((phrase) => `"${phrase.text}"`).join(', ')} ` +
        `(${PHRASES_FILE}:8-11). The bracket is a slot, so nothing can be matched literally and a ` +
        'pattern matcher is required. The file\'s own prose paragraph (:23) treats them as one ' +
        'family — \'Any "here\'s what/this/that" construction\' — which is why they belong to this ' +
        'rule rather than to a rule of their own.',
    );
  }

  if (id === 'adverbs') {
    notes.push(
      `ABSOLUTISM: ${ABSOLUTISM.adverbs} Imported with weakAlone: true for every entry ` +
        `(${WEAK_ALONE_CRITERION}). ai-humanizer deliberately does not import the absolute form: ` +
        'its adverb-filler detector is density-gated (engines/lexical.mjs:243, 4 hits at 0.8 per ' +
        '100 words) and its registry weight is the file\'s lowest (registry/rules.mjs:185-188). ' +
        'Inheriting "kill all adverbs" would reintroduce exactly the false positives that gate ' +
        'exists to prevent.',
    );
    notes.push(
      `The 15 adverbs run ${PHRASES_FILE}:59-73, and the same "## Adverbs" heading also carries ` +
        'the 7 filler phrases at :77-83. Two lists, one heading, two tells — which is why ' +
        'phrase-filler-phrases is split out of it; the shared heading line is reported here so the ' +
        'split is auditable rather than surprising.',
    );
    notes.push(
      `"crucially" (${PHRASES_FILE}:73) is the one entry in this category with no counterpart ` +
        'anywhere else in the corpus. Verified by searching every other clone for the string: ' +
        'zero hits outside stop-slop. ai-humanizer\'s ADVERB_FILLER (scripts/lexicons.mjs:147-152) ' +
        'holds 15 words and "crucially" is not among them; nor is it in AI_OPENERS ' +
        '(scripts/lexicons.mjs:41-61) or BANNED_VOCAB (scripts/lexicons.mjs:14-38).',
    );
    notes.push(
      `"importantly" (${PHRASES_FILE}:72) and "interestingly" (:71) are NOT unique even though ` +
        'both are absent from ADVERB_FILLER: ai-humanizer absorbed them as openers, ' +
        '"importantly," at scripts/lexicons.mjs:45 and "interestingly," at :50. Missing from the ' +
        'corresponding list is not evidence of uniqueness; absence from the whole clone is.',
    );
  }

  if (id === 'meta_commentary') {
    const ellipses = watchPhrases.filter((phrase) => isTruncated(phrase.text));
    if (ellipses.length > 0) {
      notes.push(
        `${ellipses.length} of the entries end in an ellipsis — ` +
          `${ellipses.map((phrase) => `"${phrase.text}"`).join(', ')} — and the shared classifier ` +
          'calls each of those a template because `...` is one of its markers ' +
          '(extract/phrase.ts:19). Here the dots mean "and so on" rather than "a slot goes here", ' +
          'so the entry is kept literal per the brief and the ellipsis is recorded: a detector ' +
          'should match the prefix rather than expect a literal "...". This is the only place ' +
          'this adapter knowingly disagrees with the shared classifier.',
      );
    }
    notes.push(
      `Three entries here are stop-slop-only: "Hint:" (${PHRASES_FILE}:89), "X is a feature, not a ` +
        `bug" (:93) and "Dressed up as" (:94). Verified by searching every other clone in the ` +
        'cache for each string: zero hits. ai-humanizer\'s META_COMMENTARY ' +
        '(scripts/lexicons.mjs:161-168) holds 15 entries and none of the three is among them.',
    );
    notes.push(
      'The category itself is inherited, so the rule is attributed to both upstreams even though ' +
        'three of its items are stop-slop-only: `originatedIn` records where the RULE came from, ' +
        'and per-item residuals are named here rather than split into extra rules.',
    );
  }

  if (id === 'performative_emphasis') {
    notes.push(
      'The 3 entries changed lists on import: ai-humanizer put "creeps in", "I promise" and "They ' +
        'exist, I promise" in EMPHASIS_CRUTCH (scripts/lexicons.mjs:182-183) rather than in a ' +
        'performative-emphasis list of their own. The content is inherited even though this ' +
        'heading is not a heading there — presence of the strings decides `inherited`, not the ' +
        'shape of the list.',
    );
  }

  if (id === 'telling_instead_of_showing') {
    notes.push(
      'UNIQUE. ai-humanizer\'s README.md:293-294 claims it absorbed "telling-not-showing", but it ' +
        'has no rule id and no lexicon entry for it: searching the whole clone for each of the ' +
        'four phrases ("This is genuinely hard", "This is what leadership actually looks like", ' +
        '"This is what X actually looks like", "actually matters") returns zero hits, and ' +
        'searching every other clone in the cache returns zero too. A prose credit is not an ' +
        'absorption, and this rule therefore carries no `originatedIn`.',
    );
  }

  if (id === 'emphasis_crutches') {
    notes.push(
      'Two entries sit in a different canonical bucket from the rest: "This matters because" and ' +
        '"Here\'s why that matters" are the same causal-announcement move as ' +
        'phrase-throat-clearing-openers, and ai-humanizer files all five together in ' +
        'EMPHASIS_CRUTCH (scripts/lexicons.mjs:178-184). The upstream files them here; the ' +
        'adapter follows the file and records the overlap instead of moving entries between rules.',
    );
  }

  if (id === 'vague_declaratives') {
    notes.push(
      'All 5 entries are inherited verbatim: "the reasons are structural", "the implications are ' +
        'significant", "the stakes are high" and "the consequences are real" at ' +
        'scripts/lexicons.mjs:187-189, "this is the deepest problem" at :189, in ai-humanizer\'s ' +
        'VAGUE_DECLARATIVE. Its detector also builds a regex over the same nouns ' +
        '(scripts/engines/lexical.mjs:274-285), so the tell is implemented, not just listed.',
    );
  }

  if (templates > 0 && id !== 'filler_phrases') {
    notes.push(
      `${templates} entry is classified template because it carries a slot marker, so it is a ` +
        'shape rather than a string (extract/phrase.ts:16-22). The match field carries the ' +
        'upstream wording for a human reader; literal matching must not use it.',
    );
  }

  notes.push(UPSTREAM_CAUTION);
  return notes;
}

/**
 * The `inherited` / `unique` verdict per phrase category, with the search behind
 * it. Kept as data so the test can iterate the same claims the generated file
 * states, instead of maintaining a second hand-typed list.
 */
const PHRASE_VERDICTS: Readonly<Record<string, string>> = {
  'phrase-throat-clearing-openers':
    'INHERITED from judetelan/ai-humanizer. Search: its AI_OPENERS (scripts/lexicons.mjs:41-61) ' +
    'contains "it turns out" (:54), "the truth is" (:54), "let\'s be honest" (:54), "can we talk ' +
    'about" (:54), "in a world where" (:55), "here\'s what i find interesting" (:57) and "here\'s ' +
    'the problem though" (:57). Its rule ai-openers (scripts/registry/rules.mjs:31, ' +
    '"Throat-clearing openers") is the same category and is NOT in the barred block, so the two ' +
    'upstreams must collapse to one rule: this adapter attributes the category to both and claims ' +
    'no discovery for it.',
  'phrase-emphasis-crutches':
    'INHERITED from judetelan/ai-humanizer. Search: its EMPHASIS_CRUTCH ' +
    '(scripts/lexicons.mjs:178-184) holds "full stop." (:179), "let that sink in" (:179), "this ' +
    'matters because" (:179), "make no mistake" (:179) and "here\'s why that matters" (:180) — all ' +
    'five of this category\'s entries. Rule emphasis-crutch at scripts/registry/rules.mjs:174.',
  'phrase-business-jargon':
    'INHERITED from judetelan/ai-humanizer, and the most thoroughly absorbed category here: its ' +
    'JARGON_SWAPS (scripts/lexicons.mjs:212-224) reproduces this table row for row, all 11 rows, ' +
    'with the same replacements — which is why IMPORT_EXCLUSIONS bars JARGON_SWAPS from ' +
    'ai-humanizer (ai-humanizer/index.ts:61-64), and why this adapter has to carry it instead, ' +
    'attributed to both upstreams.',
  'phrase-adverbs':
    'INHERITED from judetelan/ai-humanizer for 14 of the 15 entries. Search: ADVERB_FILLER ' +
    '(scripts/lexicons.mjs:147-152) holds really, just, literally, genuinely, honestly, simply, ' +
    'actually, deeply, truly, fundamentally, inherently, inevitably; "importantly" and ' +
    '"interestingly" are in AI_OPENERS (:45, :50); "crucially" is in neither. "crucially" appears ' +
    'in no other clone, so it is stop-slop-only while the rule as a whole stays inherited.',
  'phrase-filler-phrases':
    'INHERITED from judetelan/ai-humanizer for 6 of the 7 entries. Search: "at its core," at ' +
    'scripts/lexicons.mjs:59, "in today\'s" at :43, "it\'s worth noting" at :44, "at the end of ' +
    'the day" at :46, "when it comes to" at :46, "in a world where" at :55. "The reality is" is ' +
    'the exception: ai-humanizer has "in reality," (:59) but not the stop-slop wording, and no ' +
    'other clone has it either, so it is stop-slop-only while the category stays inherited.',
  'phrase-meta-commentary':
    'INHERITED from judetelan/ai-humanizer for 8 of the 11 entries, UNIQUE for 3. Search: ' +
    'META_COMMENTARY (scripts/lexicons.mjs:161-168) holds "plot twist:" and "spoiler:" (:164), ' +
    '"you already know this" and "but that\'s another post" (:165), "the rest of this essay" and ' +
    '"walk you through" (:162), "in this section" (:163), "as we\'ll see" (:163) and "i want to ' +
    'explore" (:164). "Hint:", "X is a feature, not a bug" and "Dressed up as" appear nowhere in ' +
    'ai-humanizer and nowhere in any other clone, searched as whole strings.',
  'phrase-performative-emphasis':
    'INHERITED from judetelan/ai-humanizer. Search: all three entries — "creeps in", "I promise", ' +
    '"they exist, i promise" — are at scripts/lexicons.mjs:183, added under the comment "2026 ' +
    'additions (stop-slop performative emphasis)". The heading is stop-slop\'s own, but no string ' +
    'in it is unique to stop-slop.',
  'phrase-telling-instead-of-showing':
    'UNIQUE to stop-slop. ai-humanizer\'s README.md:293-294 names "telling-not-showing" in its ' +
    'credits, but the clone contains no rule id and no lexicon entry for any of the four phrases; ' +
    'searching every other clone in the cache for "This is genuinely hard", "This is what ' +
    'leadership actually looks like", "This is what X actually looks like" and "actually matters" ' +
    'returns zero hits. The absorption claim is prose only, so this rule carries no originatedIn.',
  'phrase-vague-declaratives':
    'INHERITED from judetelan/ai-humanizer, verbatim and in full. Search: VAGUE_DECLARATIVE ' +
    '(scripts/lexicons.mjs:187-195) lists every one of the 5 entries, and the detector at ' +
    'scripts/engines/lexical.mjs:274-285 matches them as phrases plus a regex over the same nouns.',
};

/**
 * Attach each `examples.md` pair to the rule its own heading names, and return the
 * number of pairs *read from the file*.
 *
 * The pairing is explicit in the upstream: `## Example 1: Throat-Clearing + Binary
 * Contrast` names both rules it demonstrates, so the first pair lands on two rules
 * and the rest on one. Attaching by the heading text — rather than to everything
 * or to nothing — keeps the example next to the rule it justifies. The return
 * value counts pairs, not attachments, so the 5-pair assertion in the test is
 * about the upstream file rather than about how many rules reused a pair.
 */
function attachExamples(
  rules: ExtractedRule[],
  examplesSource: string,
  warnings: string[],
): number {
  const headings = findHeadings(examplesSource, 2);
  const byRule = new Map<string, RuleExample[]>();
  let pairs = 0;

  for (const heading of headings) {
    const lines = heading.body.split(/\r?\n/);
    const beforeLine = lines.findIndex((line) => /^\*\*Before/.test(line));
    const afterLine = lines.findIndex((line) => /^\*\*After/.test(line));
    if (beforeLine === -1 || afterLine === -1 || afterLine < beforeLine) {
      warnings.push(
        `${EXAMPLES_FILE}:${heading.line} has no Before/After pair; skipped rather than guessed.`,
      );
      continue;
    }

    const before = firstQuote(lines.slice(beforeLine + 1, afterLine).join('\n'));
    const after = firstQuote(lines.slice(afterLine + 1).join('\n'));
    if (!before || !after) {
      warnings.push(
        `${EXAMPLES_FILE}:${heading.line} has an empty Before or After quote; skipped rather than ` +
          'recorded as blank.',
      );
      continue;
    }

    const targets = exampleTargets(heading.title);
    if (targets.length === 0) {
      warnings.push(
        `${EXAMPLES_FILE}:${heading.line} ("${heading.title}") names no rule in this adapter; the ` +
          'example is not attached rather than attached to something arbitrary.',
      );
      continue;
    }

    pairs += 1;
    const example: RuleExample = {
      before: stripQuotes(before),
      after: stripQuotes(after),
      note: heading.title,
    };
    for (const id of targets) {
      const found = rules.find((rule) => rule.upstreamRuleId === id);
      if (!found) continue;
      byRule.set(id, [...(byRule.get(id) ?? []), example]);
    }
  }

  // `ExtractedRule.examples` is readonly by contract, so the rule is rebuilt
  // rather than mutated in place.
  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index]!;
    const found = byRule.get(rule.upstreamRuleId);
    if (!found || found.length === 0) continue;
    rules[index] = { ...rule, examples: [...rule.examples, ...found] };
  }

  return pairs;
}

/**
 * The rule ids an example heading names.
 *
 * `## Example 2: Filler + Unnecessary Reassurance` is deliberately read as
 * *two* tells — the filler phrases and the permission-granting rhetorical setup
 * ("And that's okay.", `structures.md:55`) — because the pair demonstrates both.
 */
function exampleTargets(title: string): string[] {
  const ids: string[] = [];
  if (/throat/i.test(title)) ids.push('phrase-throat-clearing-openers');
  if (/binary contrast/i.test(title)) ids.push('structure-binary-contrasts');
  if (/filler/i.test(title)) ids.push('phrase-filler-phrases');
  if (/reassurance/i.test(title)) ids.push('structure-rhetorical-setups');
  if (/business jargon/i.test(title)) ids.push('phrase-business-jargon');
  if (/dramatic fragmentation/i.test(title)) ids.push('structure-dramatic-fragmentation');
  if (/rhetorical setup/i.test(title)) ids.push('structure-rhetorical-setups');
  return ids;
}

/** The first blockquote inside a field, stripped of `>` markers. */
function firstQuote(content: string): string | undefined {
  const quotes = extractBlockquotes(content);
  return quotes.length > 0 ? quotes[0]!.text : undefined;
}

/**
 * Coverage cross-checks.
 *
 * The signature map and the headings have to agree in both directions. A heading
 * with no signature would deduplicate against nothing; a signature with no
 * heading is a mapping left behind by a restructure.
 */
function reportCoverage(
  rules: readonly ExtractedRule[],
  raws: readonly RawRule[],
  warnings: string[],
): void {
  const headingIds = new Set(raws.map((raw) => raw.upstreamRuleId));
  for (const id of Object.keys(STOP_SLOP_SIGNATURES)) {
    if (!headingIds.has(id)) {
      warnings.push(
        `Signature map covers ${id}, but no heading with that id was found. The upstream may have ` +
          'renamed a heading; the mapping is now dead weight.',
      );
    }
  }

  const phraseRules = rules.filter((rule) => rule.upstreamRuleId.startsWith('phrase-'));
  const structureRules = rules.filter((rule) => rule.upstreamRuleId.startsWith('structure-'));
  if (phraseRules.length !== 9 || structureRules.length !== 11) {
    warnings.push(
      `Expected 9 phrase categories and 11 structure headings, found ${phraseRules.length} and ` +
        `${structureRules.length}. The split of "## Adverbs" into phrase-adverbs and ` +
        'phrase-filler-phrases is the only reason the two totals differ from the 8 and 11 ' +
        '"##" headings in the files.',
    );
    return;
  }

  const phraseItems = phraseRules.reduce((total, rule) => total + rule.watchPhrases.length, 0);
  // 65 bullets + 11 table rows = 76 listed entries. Two of those entries bundle
  // two variants each ("Full stop." / "Period." and "Plot twist:" / "Spoiler:"),
  // and each variant is a watched phrase, so a correct run produces 78 items. A
  // count of exactly 76 would mean a variant had been silently dropped.
  if (phraseItems < 76 || phraseItems > 78) {
    warnings.push(
      `Expected 76-78 watched entries out of ${PHRASES_FILE} (${EXPECTED_PHRASE_ROWS} listed ` +
        `entries, two of which bundle two variants each), found ${phraseItems}.`,
    );
  }

  const structureItems = structureRules.reduce((total, rule) => total + rule.watchPhrases.length, 0);
  if (structureItems !== 48) {
    warnings.push(
      `Expected 48 construction template(s) out of ${STRUCTURES_FILE}, found ${structureItems}.`,
    );
  }

  const references = rules.reduce(
    (total, rule) => total + rule.watchPhrases.filter((phrase) => phrase.kind === 'reference').length,
    0,
  );
  if (references > 0) {
    warnings.push(
      `${references} watched phrase(s) classified reference (too short or too generic to match ` +
        'safely); they are recorded for a human and must not be used by a detector.',
    );
    return;
  }

  const literal = phraseRules.reduce(
    (total, rule) => total + rule.watchPhrases.filter((phrase) => phrase.kind === 'literal').length,
    0,
  );
  const templates = phraseRules.reduce(
    (total, rule) => total + rule.watchPhrases.filter((phrase) => phrase.kind === 'template').length,
    0,
  );
  if (literal + templates !== phraseItems) {
    warnings.push(
      `${PHRASES_FILE}: ${literal} literal + ${templates} template = ${literal + templates}, ` +
        `which does not add up to ${phraseItems} watched entries.`,
    );
  }
}

/**
 * The version state, as a warning only if it *changed*.
 *
 * The fact that no version is declared is recorded in `POLICY_RECORDS` below
 * rather than pushed here unconditionally: it is true of the upstream and always
 * will be until upstream starts versioning, and `warnings` is for what a human
 * must look at in *this* run. Emitting a permanent warning would train a reader to
 * ignore the array.
 */
function reportVersion(changelog: string, warnings: string[]): void {
  const version = /^##\s+v?(\d+\.\d+\.\d+)/m.exec(changelog);
  if (version) {
    warnings.push(
      `A version-like heading (${version[1]}) appeared in ${CHANGELOG_FILE}; this adapter had ` +
        'recorded none. Re-check whether upstream has started versioning.',
    );
  }
}

/**
 * Two facts about this upstream that are true, permanent, and not warnings.
 *
 * `warnings` means "a human should look at this run". These are not that: they are
 * properties of the pinned commit that any consumer of the generated data needs,
 * and they are exported so a test can assert them without opening the JSON. Both
 * are also on the rules themselves — the absolutism on the rules it changes, the
 * version note everywhere it matters.
 */
export const STOP_SLOP_POLICY_RECORDS: readonly string[] = [
  `Declared version: none. No file in the 7 carries one — no package.json, no VERSION file, no ` +
    `version field — and ${CHANGELOG_FILE} is stale: its newest entry is 2026-01-13 (:3) and it ` +
    'misses the performative-emphasis and telling-not-showing additions already present at ' +
    'references/phrases.md:101-116. The commit is the only pin.',
  `Absolutism conflict, recorded so it is not imported later: ${ABSOLUTISM.adverbs} and ` +
    `${ABSOLUTISM.emDash}, which contradicts blader's deliberate weak-alone suppression policy ` +
    '(blader/parse.ts:265-270, blader/signatures.ts:24,27) and ai-humanizer\'s density gates ' +
    '(engines/lexical.mjs:39,243,252,291,302). Every absolute rule here is weakAlone: true, so it ' +
    `can only fire with corroboration. The upstream also contradicts itself: ` +
    `${ABSOLUTISM.selfContradiction}`,
  `Engine note: the absolute forms must not reach the detector. ${ABSOLUTISM.skillEmDash} restates ` +
    'the em-dash ban in the prompt, and SKILL.md:36-46 restates several of the strong-alone rules ' +
    'as yes/no checklist items, which reads as permission to fire on one sighting. The checklist ' +
    'is prompt text for a model, not a detection threshold for the suite.',
];

/**
 * `SKILL.md` restates six of the structure rules as checklist items. It is not
 * read as a rule source — `references/` is the rule data and `SKILL.md` is the
 * prompt that points at it — but it is checked for agreement so a restructure in
 * one file without the other is visible.
 */
function reportSkillAgreement(
  rules: readonly ExtractedRule[],
  skill: string,
  warnings: string[],
): void {
  const checks: readonly { readonly phrase: string; readonly id: string }[] = [
    { phrase: 'Any adverbs? Kill them.', id: 'phrase-adverbs' },
    { phrase: 'Any passive voice?', id: 'structure-passive-voice' },
    { phrase: 'Any "not X, it\'s Y" contrasts?', id: 'structure-binary-contrasts' },
    { phrase: 'Em-dash anywhere? Remove it.', id: 'structure-rhythm-patterns' },
    { phrase: 'Vague declarative', id: 'phrase-vague-declaratives' },
    { phrase: 'Narrator-from-a-distance', id: 'structure-narrator-from-a-distance' },
    { phrase: 'Meta-joiners', id: 'phrase-meta-commentary' },
  ];

  const ids = new Set(rules.map((rule) => rule.upstreamRuleId));
  for (const check of checks) {
    if (!skill.includes(check.phrase)) {
      warnings.push(
        `${SKILL_FILE} no longer contains ${JSON.stringify(check.phrase)}, which is the checklist ` +
          `item that corresponds to ${check.id}. The prompt and the references have drifted apart.`,
      );
    }
    if (!ids.has(check.id)) {
      warnings.push(`${SKILL_FILE} points at ${check.id}, which this run did not extract.`);
    }
  }
}

/**
 * The rule assembled from a `RawRule`, with the signature map consulted once.
 *
 * `languages` is taken from the signature spec, not forced to `['en']`, so this
 * adapter agrees with every other one about which languages a canonical signature
 * covers. That means rules landing on a bilingual signature
 * (`structural.staged_runup`, `structural.staged_candor`, `lexical.passive_and_subjectless`)
 * report `['en', 'zh']` although the upstream's content is entirely English. It
 * over-states what this upstream supplies and under-states nothing; a detector
 * reads `languages` off the canonical signature anyway, and forcing `['en']` here
 * would make the same signature report different languages depending on which
 * adapter produced it.
 */
function mappedRule(raw: RawRule, warnings: string[]): ExtractedRule {
  const mapped = STOP_SLOP_SIGNATURES[raw.upstreamRuleId];
  let signature: string;
  let signatureMapped = false;

  if (mapped) {
    assertKnownSignature(mapped, `${UPSTREAM} rule ${raw.upstreamRuleId}`);
    signature = mapped;
    signatureMapped = true;
  } else {
    signature = unmappedSignature(SLUG, raw.upstreamRuleId);
    warnings.push(
      `${UPSTREAM} rule ${raw.upstreamRuleId} (${raw.title}) has no signature mapping. It will ` +
        'not deduplicate against the ai-humanizer lineage, which is where most of this content ' +
        'already lives.',
    );
  }

  const spec = signatureMapped ? signatureSpec(signature) : undefined;
  const weakAlone = !STRONG_ALONE_IDS.has(raw.upstreamRuleId);
  const unique = UNIQUE_RULE_IDS.has(raw.upstreamRuleId);

  const notes = [...raw.notes];
  if (weakAlone) {
    notes.push(
      `weakAlone: true — ${WEAK_ALONE_CRITERION}. It may fire only with corroboration, which is ` +
        "how the suite acts on this upstream's absolute wording without importing the absolute.",
    );
  }
  const duplicate = DUPLICATE_SIGNATURES[raw.upstreamRuleId];
  if (duplicate) {
    notes.push(
      `Shares signature ${signature} with ${duplicate}. One tell under two headings: recorded so ` +
        'the collision is visible at dedupe time rather than reading as a second discovery.',
    );
  }
  if (unique) {
    notes.push(
      'No originatedIn is set on this rule: unique means the content is in no other clone in the ' +
        'corpus, so attributing it to a second upstream would double-count it in the other ' +
        'direction. Re-verify with the searches named above before merging it with anything.',
    );
  }

  const first = raw.phraseLines[0];
  const last = raw.phraseLines[raw.phraseLines.length - 1];
  const locator =
    raw.watchPhrases.length > 0 && first !== undefined && last !== undefined
      ? `${raw.source}:${raw.startLine}-${raw.endLine} (entries ${first}-${last})`
      : `${raw.source}:${raw.startLine}-${raw.endLine}`;

  return {
    upstreamRuleId: raw.upstreamRuleId,
    signature,
    signatureMapped,
    title: raw.title,
    category: spec?.category ?? 'lexical',
    languages: spec?.languages ?? ['en'],
    description: describe(raw),
    detection: buildDetection(raw.watchPhrases, weakAlone),
    rewriteGuidance: raw.rewriteGuidance,
    severity: severityFor(raw.upstreamRuleId),
    watchPhrases: raw.watchPhrases,
    examples: [],
    weakAlone,
    locator,
    quote: raw.quote,
    ...(unique ? {} : { originatedIn: 'judetelan/ai-humanizer' }),
    notes,
  };
}

/**
 * The description is the upstream's own introduction where there is one, and the
 * heading plus its counts where there is not — Formulaic Constructions and
 * Sentence Starters to Avoid have no prose paragraph at all.
 */
function describe(raw: RawRule): string {
  if (raw.intro.length > 0) return raw.intro;
  const literal = raw.watchPhrases.filter((phrase) => phrase.kind === 'literal').length;
  const templates = raw.watchPhrases.filter((phrase) => phrase.kind === 'template').length;
  const parts = [`The upstream states "${raw.title}" as a heading`];
  if (literal > 0) parts.push(`${literal} watched phrase(s)`);
  if (templates > 0) parts.push(`${templates} construction template(s)`);
  return `${parts.join(' with ')} and no prose explanation.`;
}

/**
 * The detection spec: what the upstream actually hands a machine, stated as a
 * count so the generated data shows the shape without implying a matcher exists.
 */
function buildDetection(phrases: readonly WatchPhrase[], weakAlone: boolean): string {
  const literal = phrases.filter((phrase) => phrase.kind === 'literal').length;
  const templates = phrases.filter((phrase) => phrase.kind === 'template').length;
  const parts: string[] = [];
  if (literal > 0) parts.push(`${literal} literal watched phrase(s), matched case-insensitively`);
  if (templates > 0) {
    parts.push(
      `${templates} construction template(s), a shape rather than a string — a pattern matcher ` +
        'must be written for these and literal matching must not be used',
    );
  }
  if (parts.length === 0) parts.push('no watched items; the upstream states the rule in prose only');
  if (weakAlone) {
    parts.push(
      'weak alone: stated absolutely upstream, so corroboration is required before acting',
    );
  }
  return `Lexical and structural. ${parts.join('; ')}.`;
}

/**
 * Severity is not stated upstream, so it follows the reasoning `blader` uses: a
 * construction that is unmistakable on one sighting outranks a single common
 * word, and weak-alone rules are held down regardless of position.
 */
function severityFor(id: string): number {
  if (!STRONG_ALONE_IDS.has(id)) return 2;
  if (
    id === 'structure-binary-contrasts' ||
    id === 'structure-narrator-from-a-distance' ||
    id === 'phrase-business-jargon'
  ) {
    return 4;
  }
  return 3;
}

/** Split a document into level-`level` headings with bodies and derived ids. */
function findHeadings(markdown: string, level: 2 | 3): Heading[] {
  const lines = markdown.split(/\r?\n/);
  const marker = new RegExp(`^#{${level}}\\s+(.*)$`);
  const starts: Array<{ index: number; title: string }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = marker.exec(lines[index] ?? '');
    if (match) starts.push({ index, title: (match[1] ?? '').trim() });
  }

  return starts.map((start, position) => {
    const next = starts[position + 1]?.index ?? lines.length;
    return {
      title: start.title,
      line: start.index + 1,
      endLine: next,
      body: lines.slice(start.index + 1, next).join('\n'),
    };
  });
}

/**
 * A table row, or `undefined` for a separator or a header.
 *
 * `| Avoid | Use instead |` and `| Pattern | Problem |` are recognised by shape,
 * so the two files can share one reader.
 */
function parseTableRow(line: string, lineNumber: number): TableRow | undefined {
  if (!/^\s*\|/.test(line)) return undefined;
  const cells = line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
  if (cells.length < 2) return undefined;
  const first = cells[0] ?? '';
  if (/^[\s:-]+$/.test(first)) return undefined;
  if (/^(pattern|avoid|instead)$/i.test(first)) return undefined;
  return { cells, line: lineNumber };
}

/** The first prose paragraph of a section body, with tables and labels skipped. */
function firstProseParagraph(body: string): string {
  for (const paragraph of body.split(/\n\s*\n/)) {
    const trimmed = paragraph.trim();
    if (trimmed.length === 0) continue;
    if (/^[|#>*\-\d]/.test(trimmed)) continue;
    if (/^\*\*Instead/i.test(trimmed)) continue;
    return normalise(trimmed.replace(/\*+/g, ''));
  }
  return '';
}

/** The first prose paragraph that follows the last table row. */
function paragraphAfterTable(body: string): string {
  const lines = body.split(/\r?\n/);
  let lastTable = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (parseTableRow(lines[index] ?? '', index + 1)) lastTable = index;
  }
  if (lastTable === -1) return '';
  return firstProseParagraph(lines.slice(lastTable + 1).join('\n'));
}

/**
 * The guidance a phrase category can state on its own.
 *
 * `phrases.md` is a list, not an instruction manual: only Business Jargon carries
 * a replacement column. So the guidance is the one instruction the file does give
 * — cut the phrase and state the content directly, which is what
 * `references/phrases.md:5` says for the openers and what "Delete them" (:27)
 * says for the crutches — plus the replacements where the file has them. Nothing
 * is invented beyond that.
 */
function fallbackBulletGuidance(phrases: readonly WatchPhrase[]): string {
  const withReplacements = phrases.filter((phrase) =>
    (phrase.note ?? '').startsWith('Use instead:'),
  );
  const base = 'Cut the phrase and state the content directly.';
  if (withReplacements.length === 0) return base;
  const pairs = withReplacements
    .map((phrase) => `"${phrase.text}": ${(phrase.note ?? '').replace(/^Use instead:\s*/, '')}`)
    .join('; ');
  return `${base} The upstream's own replacements: ${pairs}.`;
}

/** Join notes without repeating one the upstream stated twice. */
function uniqueJoin(values: readonly string[]): string {
  return [...new Set(values.filter((value) => value.length > 0))].join(' ');
}

function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 3)}...`;
}

/** The id a heading slugs to. Kept lower-kebab, matching the brief's examples. */
function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const STOP_SLOP_EXTRACTION_SCHEMA = EXTRACTION_SCHEMA_VERSION;

/**
 * The rule ids this adapter treats as stop-slop-only, exported for the test and
 * for the report.
 *
 * Three headings, no more: everything else is in the ai-humanizer clone. This is
 * the material `ai-humanizer` was barred from and the material that appears
 * nowhere else in the corpus, so a caller must not merge these with anything
 * without re-running the searches named in their notes.
 */
export const STOP_SLOP_UNIQUE_RULE_IDS: readonly string[] = [...UNIQUE_RULE_IDS];

/** The phase-3 caution, exported so the report can quote it rather than restate it. */
export const STOP_SLOP_CAUTION = UPSTREAM_CAUTION;
