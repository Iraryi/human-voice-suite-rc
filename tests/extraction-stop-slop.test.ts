/**
 * Integration tests for the `hardikpandya/stop-slop` extraction.
 *
 * The point of this adapter is provenance, so that is what the tests check: not
 * just that 20 rules came out, but that each rule is filed as *inherited* or
 * *unique* and that the filing survives an actual string search. Catching a wrong
 * `inherited` verdict matters more than catching a wrong severity, because a wrong
 * verdict either double-counts one discovery across two upstreams or erases a real
 * one.
 *
 * The uniqueness assertions deliberately search the corpus rather than reading
 * this adapter's own hard-coded list: a test that re-states the constant it is
 * testing proves nothing. `tests/corpus.ts` is used for the search so the answer
 * comes from the clones on disk.
 *
 * Skipped on a fresh checkout, where `.upstream-cache` is empty by design — the
 * same guard `tests/upstream.test.ts:403` uses.
 */

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseStopSlop, STOP_SLOP_POLICY_RECORDS, STOP_SLOP_UNIQUE_RULE_IDS } from '../src/upstream/adapters/stop-slop/parse.js';
import {
  STOP_SLOP_PHRASE_CATEGORIES,
  STOP_SLOP_SIGNATURES,
} from '../src/upstream/adapters/stop-slop/signatures.js';
import { containsTemplateMarker } from '../src/upstream/extract/phrase.js';
import { extractionProblems, toRuleCandidates } from '../src/upstream/extract/types.js';
import type { ExtractedRule, ExtractionResult } from '../src/upstream/extract/types.js';
import { CANONICAL_SIGNATURES, SIGNATURE_INDEX, isKnownSignature } from '../src/rules/canonical/signatures.js';
import { resolveProjectRoot } from '../src/upstream/manifest.js';
import { buildVocabulary, clonePaths, searchEverywhere } from './corpus.js';
import type { Vocabulary } from './corpus.js';

const projectRoot = resolveProjectRoot();
const cacheRoot = path.join(projectRoot, '.upstream-cache');
const stopSlopPath = path.join(cacheRoot, 'stop-slop');
const aiHumanizerPath = path.join(cacheRoot, 'ai-humanizer');

const present = existsSync(stopSlopPath);
const aiHumanizerPresent = existsSync(aiHumanizerPath);

/** The upstream's own counts, established by reading the pinned commit. */
const EXPECTED = {
  /** 8 `##` headings, but 9 rules: Adverbs carries the Filler phrases list too. */
  phraseCategories: 9,
  phraseHeadings: 8,
  /** 15 + 5 + 11 + 22 + 11 + 3 + 4 + 5 = 76 listed entries. */
  phraseEntries: 76,
  bullets: 65,
  jargonRows: 11,
  /** 8 entries carry a slot marker, so 68 are matchable as strings. */
  literalPhrases: 70,
  templatePhrases: 8,
  /** Splitting `"Full stop." / "Period."` yields one more watched item than rows. */
  extraVariants: 2,
  /** Entries the shared classifier calls templates because they end in an ellipsis. */
  sharedClassifierDisagreements: 5,
  structureHeadings: 11,
  structureRows: 48,
  examples: 5,
  rules: 20,
  /** 17 shared with ai-humanizer, 3 unique, 20 total. */
  inheritedRules: 17,
  uniqueRules: 3,
} as const;

const UNIQUE_RULE_IDS = [
  'phrase-telling-instead-of-showing',
  'structure-formulaic-constructions',
  'structure-narrator-from-a-distance',
] as const;

/**
 * Terms that must appear in *no* clone except stop-slop, searched as whole
 * strings in the test rather than trusted from the adapter.
 *
 * Each is a claim about the corpus, so each is spelled out here with the rule it
 * belongs to. The `crucially` / `The reality is` / `Hint:` / `Dressed up as` /
 * `X is a feature, not a bug` group is the residue inside otherwise-inherited
 * rules; the rest are the unique rules' own items.
 */
const STOP_SLOP_ONLY_TERMS: readonly string[] = [
  // phrase-adverbs
  'crucially',
  // phrase-filler-phrases
  'The reality is',
  // phrase-meta-commentary
  'Hint:',
  'Dressed up as',
  'X is a feature, not a bug',
  // phrase-telling-instead-of-showing
  'This is genuinely hard',
  'This is what leadership actually looks like',
  'actually matters',
  // structure-formulaic-constructions
  'Formulaic Constructions',
  "By the time X, I was Y.",
  // structure-narrator-from-a-distance
  'Nobody designed this.',
  'This happens because',
  'People tend to',
  // Un-enumerated binary-contrast sub-forms the reconnaissance flagged. `X isn't
  // the problem` is deliberately absent: the upstream writes it `[X] isn't the
  // problem. [Y] is.`, so the bare form is not a string in the repository and a
  // search for it proves nothing.
  "doesn't mean X, but actually Y",
  'is about X but not Y',
  'not just X but also Y',
];

/** The ai-humanizer registry rule ids that came from stop-slop, per its own source. */
const BARRED_AI_HUMANIZER_IDS = [
  'false-agency',
  'rhetorical-setup',
  'negative-listing',
  'vague-declarative',
  'meta-commentary',
  'emphasis-crutch',
  'dramatic-fragmentation',
  'adverb-filler',
  'lazy-extremes',
  'passive-voice',
  'wh-opener',
] as const;

/**
 * The nine phrase categories, named rather than derived from a prefix.
 *
 * `startsWith('phrase-')` would be a convenient discriminator and a wrong one, and
 * the reason is worth recording: the ids come from the brief, not from the file,
 * and they are ten of the brief's own slugs. `phrase-filler-phrases` is derived
 * from a lead-in line inside the Adverbs section rather than from a `##` heading,
 * so no rule of thumb over the ids recovers the split. Naming them here also
 * checks that the naming itself did not drift.
 */
const PHRASE_RULE_IDS: readonly string[] = [
  'phrase-throat-clearing-openers',
  'phrase-emphasis-crutches',
  'phrase-business-jargon',
  'phrase-adverbs',
  'phrase-filler-phrases',
  'phrase-meta-commentary',
  'phrase-performative-emphasis',
  'phrase-telling-instead-of-showing',
  'phrase-vague-declaratives',
];

function phraseRulesOf(rules: readonly ExtractedRule[]): ExtractedRule[] {
  return PHRASE_RULE_IDS.map((id) => {
    const rule = rules.find((candidate) => candidate.upstreamRuleId === id);
    expect(rule, id).toBeDefined();
    return rule!;
  });
}

/** The 11 structure rules: everything that is not one of the nine phrase rules. */
function structureRulesOf(rules: readonly ExtractedRule[]): ExtractedRule[] {
  const phraseIds = new Set(PHRASE_RULE_IDS);
  return rules.filter((rule) => !phraseIds.has(rule.upstreamRuleId));
}

/** Every watched item of a rule is present in the other upstream. */
function allItemsPresent(rule: ExtractedRule, vocabulary: Vocabulary): boolean {
  const items = rule.watchPhrases;
  if (items.length === 0) return false;
  return items.every((phrase) =>
    phrase.kind === 'literal'
      ? vocabulary.contains(phrase.text)
      : vocabulary.containsTemplate(phrase.text),
  );
}

/** At least one watched item of a rule is present in the other upstream. */
function anyItemPresent(rule: ExtractedRule, vocabulary: Vocabulary): boolean {
  return rule.watchPhrases.some((phrase) =>
    phrase.kind === 'literal'
      ? vocabulary.contains(phrase.text)
      : vocabulary.containsTemplate(phrase.text),
  );
}

describe.skipIf(!present)('stop-slop extraction', () => {
  /** One extraction for the whole file: parsing is pure and the clone is pinned. */
  let cached: Promise<ExtractionResult> | undefined;
  const extract = (): Promise<ExtractionResult> => {
    cached ??= parseStopSlop(stopSlopPath);
    return cached;
  };

  const rulesOf = async (): Promise<readonly ExtractedRule[]> => (await extract()).rules;

  describe('the shape of the upstream', () => {
    it('reads 8 category headings and 11 structure headings', async () => {
      const phrases = await readFile(path.join(stopSlopPath, 'references/phrases.md'), 'utf8');
      const structures = await readFile(path.join(stopSlopPath, 'references/structures.md'), 'utf8');
      expect(phrases.match(/^##\s/gm)).toHaveLength(EXPECTED.phraseHeadings);
      expect(structures.match(/^##\s/gm)).toHaveLength(EXPECTED.structureHeadings);
    });

    it('counts 76 listed phrase entries: 65 bullets and the 11-row jargon table', async () => {
      const phrases = await readFile(path.join(stopSlopPath, 'references/phrases.md'), 'utf8');
      const lines = phrases.split(/\r?\n/);
      const bullets = lines.filter((line) => /^\s*-\s/.test(line)).length;
      const rows = lines.filter(
        (line) => /^\|/.test(line) && !/^\|[\s-]+\|/.test(line) && !/^\|\s*Avoid/.test(line),
      ).length;
      expect(bullets).toBe(EXPECTED.bullets);
      expect(rows).toBe(EXPECTED.jargonRows);
      expect(bullets + rows).toBe(EXPECTED.phraseEntries);
    });

    it('counts 48 structure rows and 5 before/after examples', async () => {
      const structures = await readFile(path.join(stopSlopPath, 'references/structures.md'), 'utf8');
      const rows = structures
        .split(/\r?\n/)
        .filter(
          (line) => /^\|/.test(line) && !/^\|[\s-]+\|/.test(line) && !/^\|\s*Pattern/.test(line),
        );
      expect(rows).toHaveLength(EXPECTED.structureRows);

      const examples = await readFile(path.join(stopSlopPath, 'references/examples.md'), 'utf8');
      expect(examples.match(/^\*\*Before/gm)).toHaveLength(EXPECTED.examples);
      expect(examples.match(/^\*\*After/gm)).toHaveLength(EXPECTED.examples);
    });

    it('finds the absolutism and the upstream contradicting itself', async () => {
      const phrases = await readFile(path.join(stopSlopPath, 'references/phrases.md'), 'utf8');
      const structures = await readFile(path.join(stopSlopPath, 'references/structures.md'), 'utf8');
      const examples = await readFile(path.join(stopSlopPath, 'references/examples.md'), 'utf8');

      expect(phrases).toContain('Kill all adverbs');
      expect(structures).toContain('No em dashes at all');
      // The ban, and the em-dash the upstream prints as an improvement.
      expect(structures).toContain('| Em-dashes |');
      expect(examples).toContain('cost\u2014pick two');
    });

    it('finds no declared version anywhere in the 7 files', async () => {
      const files = [
        'SKILL.md',
        'README.md',
        'CHANGELOG.md',
        'references/phrases.md',
        'references/structures.md',
        'references/examples.md',
      ];
      for (const file of files) {
        const text = await readFile(path.join(stopSlopPath, file), 'utf8');
        expect(text, file).not.toMatch(/^\s*version\s*[:=]/im);
      }
      expect(existsSync(path.join(stopSlopPath, 'package.json'))).toBe(false);
    });
  });

  describe('the extracted rules', () => {
    it(`produces exactly ${EXPECTED.rules} rules: 9 phrase categories + 11 structures`, async () => {
      const rules = await rulesOf();
      expect(rules).toHaveLength(EXPECTED.rules);
      expect(rules.filter((rule) => rule.upstreamRuleId.startsWith('phrase-'))).toHaveLength(
        EXPECTED.phraseCategories,
      );
      expect(rules.filter((rule) => rule.upstreamRuleId.startsWith('structure-'))).toHaveLength(
        EXPECTED.structureHeadings,
      );
    });

    it('carries the signature map exactly, with no rule left unmapped', async () => {
      const rules = await rulesOf();
      expect(new Set(rules.map((rule) => rule.upstreamRuleId))).toEqual(
        new Set(Object.keys(STOP_SLOP_SIGNATURES)),
      );
      for (const rule of rules) {
        expect(rule.signatureMapped, rule.upstreamRuleId).toBe(true);
        expect(rule.signature, rule.upstreamRuleId).not.toMatch(/^upstream\./);
        // The signature map is keyed by rule id, and the value must be a real id
        // from the canonical vocabulary — not merely a well-formed one.
        expect(STOP_SLOP_SIGNATURES[rule.upstreamRuleId]).toBe(rule.signature);
        expect(SIGNATURE_INDEX.has(rule.signature), rule.signature).toBe(true);
        expect(rule.signature).toMatch(/^(lexical|structural|rhythm|formatting)\./);
      }
    });

    it('never maps onto a signature outside the canonical vocabulary', async () => {
      const known = new Set(CANONICAL_SIGNATURES.map((spec) => spec.id));
      for (const signature of Object.values(STOP_SLOP_SIGNATURES)) {
        expect(known.has(signature), signature).toBe(true);
      }
    });

    it('reports no problems and no warnings', async () => {
      const result = await extract();
      expect(extractionProblems(result)).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it('counts 78 watched phrases out of the file 76 listed rows', async () => {
      const result = await extract();
      const phraseRules = phraseRulesOf(result.rules);
      const items = phraseRules.flatMap((rule) => rule.watchPhrases);
      // The excess over 76 is not drift: two rows bundle two variants each and both
      // are kept, because a detector has to look for both strings.
      const bundled = phraseRules
        .flatMap((rule) => rule.watchPhrases)
        .filter((phrase) => phrase.text === 'Period' || phrase.text === 'Spoiler:');
      expect(bundled).toHaveLength(2);
      expect(items.length).toBe(EXPECTED.phraseEntries + bundled.length);
    });

    it('keeps the permanent upstream facts out of warnings but exported', () => {
      expect(STOP_SLOP_POLICY_RECORDS.length).toBeGreaterThanOrEqual(3);
      expect(STOP_SLOP_POLICY_RECORDS.join(' ')).toContain('Declared version: none');
      expect(STOP_SLOP_POLICY_RECORDS.join(' ')).toContain('Absolutism conflict');
    });

    it(`accounts for every listed entry: ${EXPECTED.literalPhrases} literal + ${EXPECTED.templatePhrases} template`, async () => {      const rules = await rulesOf();
      const phraseRules = phraseRulesOf(rules);
      const literal = phraseRules.flatMap((rule) =>
        rule.watchPhrases.filter((phrase) => phrase.kind === 'literal'),
      );
      const templates = phraseRules.flatMap((rule) =>
        rule.watchPhrases.filter((phrase) => phrase.kind === 'template'),
      );

      expect(phraseRules).toHaveLength(EXPECTED.phraseCategories);
      expect(literal.length).toBe(EXPECTED.literalPhrases);
      expect(templates.length).toBe(EXPECTED.templatePhrases);
      // 76 listed rows become 78 watched items, because two of the rows bundle two
      // variants each and this adapter keeps both: `"Full stop." / "Period."` is
      // two strings a detector must look for. The excess is named rather than
      // rounded away, and asserted exactly.
      expect(literal.length + templates.length).toBe(
        EXPECTED.phraseEntries + EXPECTED.extraVariants,
      );
      expect(
        phraseRules.flatMap((rule) =>
          rule.watchPhrases.filter((phrase) => phrase.kind === 'reference'),
        ),
      ).toEqual([]);

      // The eight templates are exactly the entries that carry a slot.
      const slots = templates.map((phrase) => phrase.text).sort();
      expect(slots).toEqual(
        [
          "Here's that [X]",
          "Here's this [X]",
          "Here's what [X]",
          "Here's why [X]",
          "In today's [X]",
          'The real [X] is',
          'This is what X actually looks like',
          'X is a feature, not a bug',
        ].sort(),
      );
      for (const phrase of literal) {
        expect(phrase.match, phrase.text).toBe(phrase.text.toLowerCase());
      }
    });

    it('keeps the five ellipsis entries literal, and says so where it differs', async () => {
      const rules = await rulesOf();
      const literal = phraseRulesOf(rules).flatMap((rule) =>
        rule.watchPhrases.filter((phrase) => phrase.kind === 'literal'),
      );
      // The shared classifier's `...` marker calls these templates. This adapter
      // does not, because in this upstream the dots mean "and so on"; the
      // divergence is counted here rather than left implicit.
      const disagreement = literal.filter((phrase) => containsTemplateMarker(phrase.text));
      expect(disagreement).toHaveLength(EXPECTED.sharedClassifierDisagreements);
      for (const phrase of disagreement) {
        expect(phrase.text, phrase.text).toMatch(/\.\.\.$/);
      }
      const meta = rules.find((rule) => rule.upstreamRuleId === 'phrase-meta-commentary')!;
      expect(meta.notes!.join(' ')).toContain('ellipsis');
      expect(meta.notes!.join(' ')).toContain('extract/phrase.ts:19');
    });

    it('classifies every structures.md row as a template, never as a literal', async () => {
      const rules = await rulesOf();
      const items = structureRulesOf(rules).flatMap((rule) => rule.watchPhrases);
      expect(items).toHaveLength(EXPECTED.structureRows);
      for (const phrase of items) {
        expect(phrase.kind, phrase.text).toBe('template');
        // A template keeps the upstream's own wording, capitals and all: a
        // pattern author needs to see it, and lowercasing it would look like a
        // literal match key.
        expect(phrase.match, phrase.text).toBe(phrase.text);
        // Every row carries the second column as its note, never as its match.
        expect(phrase.note, phrase.text).toBeTruthy();
        expect(phrase.match, phrase.text).not.toBe(phrase.note);
      }
    });

    it('agrees with the shared slot-marker classifier about which phrases are templates', async () => {
      const rules = await rulesOf();
      for (const phrase of phraseRulesOf(rules).flatMap((rule) => rule.watchPhrases)) {
        // This adapter restates the marker list rather than calling
        // `classifyPhrase`, which mislabels capitalised words. The restated list
        // is guarded here: every phrase this adapter calls a template must carry a
        // shared marker. The converse is asserted in the ellipsis test above,
        // because the ellipsis is the one marker this adapter reads differently.
        if (phrase.kind === 'template') {
          expect(containsTemplateMarker(phrase.text), phrase.text).toBe(true);
        }
      }
    });

    it('keeps every jargon replacement in the note, never in the match', async () => {
      const rules = await rulesOf();
      const jargon = rules.find((rule) => rule.upstreamRuleId === 'phrase-business-jargon');
      expect(jargon).toBeDefined();
      expect(jargon!.watchPhrases).toHaveLength(EXPECTED.jargonRows);
      for (const phrase of jargon!.watchPhrases) {
        expect(phrase.note, phrase.text).toMatch(/^Use instead: /);
        expect(phrase.match).toBe(phrase.text.toLowerCase());
        expect(phrase.match).not.toContain('instead');
      }
      // The caveat in the upstream's first column survives as part of the note.
      expect(jargon!.watchPhrases[0]!.text).toBe('Navigate');
      expect(jargon!.watchPhrases[0]!.note).toContain('challenges');
    });

    it('reads the filler phrases as their own rule, not as part of Adverbs', async () => {
      const rules = await rulesOf();
      const adverbs = rules.find((rule) => rule.upstreamRuleId === 'phrase-adverbs');
      const filler = rules.find((rule) => rule.upstreamRuleId === 'phrase-filler-phrases');
      expect(adverbs!.watchPhrases).toHaveLength(15);
      expect(filler!.watchPhrases).toHaveLength(7);
      expect(filler!.locator).toContain('references/phrases.md');
      expect(STOP_SLOP_PHRASE_CATEGORIES['phrase-filler-phrases']).toBe('Filler phrases');
      // Different tells, different signatures: intensifiers versus padding.
      expect(adverbs!.signature).toBe('lexical.adverb_filler');
      expect(filler!.signature).toBe('lexical.wordy_connectives');
    });

    it('attaches all 5 examples to the rules their own headings name', async () => {
      const rules = await rulesOf();
      const attachments = rules.flatMap((rule) =>
        rule.examples.map((example) => ({ id: rule.upstreamRuleId, example })),
      );
      expect(attachments.length).toBeGreaterThanOrEqual(EXPECTED.examples);
      expect(new Set(attachments.map((entry) => entry.example.note)).size).toBe(EXPECTED.examples);
      // Example 1 names two tells in its heading, so it lands on two rules. The
      // note is the upstream's own heading, kept verbatim including the number.
      const first = attachments.filter(
        (entry) => entry.example.note === 'Example 1: Throat-Clearing + Binary Contrast',
      );
      expect(first.map((entry) => entry.id).sort()).toEqual([
        'phrase-throat-clearing-openers',
        'structure-binary-contrasts',
      ]);
      for (const { example } of attachments) {
        expect(example.before.length).toBeGreaterThan(0);
        expect(example.after.length).toBeGreaterThan(0);
        // The upstream wraps each quote in `> "..."`; those quotes are Markdown, so
        // they are stripped rather than shipped as part of the sample.
        expect(example.before.startsWith('"')).toBe(false);
        expect(example.after.startsWith('"')).toBe(false);
      }
      // The em-dash example is the one that contradicts the upstream's own ban, so
      // it has to survive the stripping intact for a reader to see the conflict.
      const dashes = attachments.find(
        (entry) => entry.example.note === 'Example 4: Dramatic Fragmentation',
      );
      expect(dashes!.example.after).toContain('cost\u2014pick two');
    });

    it('gives every rule a locator, a quote, a severity and languages', async () => {
      const rules = await rulesOf();
      for (const rule of rules) {
        expect(rule.locator, rule.upstreamRuleId).toMatch(/^references\/[a-z]+\.md:\d+/);
        expect(rule.quote, rule.upstreamRuleId).toBeTruthy();
        expect(rule.severity, rule.upstreamRuleId).toBeGreaterThanOrEqual(1);
        expect(rule.severity, rule.upstreamRuleId).toBeLessThanOrEqual(5);
        // `languages` follows the canonical signature, so a bilingual signature
        // reports ['en', 'zh'] even though this upstream is English only. Asserted
        // as a subset check on purpose: the alternative — forcing ['en'] here —
        // would make one signature report two different language sets depending on
        // which adapter produced the rule.
        expect(rule.languages.length, rule.upstreamRuleId).toBeGreaterThan(0);
        for (const language of rule.languages) {
          expect(['en', 'zh'], rule.upstreamRuleId).toContain(language);
        }
        expect(rule.description.length, rule.upstreamRuleId).toBeGreaterThan(20);
        expect(rule.detection, rule.upstreamRuleId).toBeTruthy();
        expect(rule.rewriteGuidance.length, rule.upstreamRuleId).toBeGreaterThan(10);
        expect(rule.notes?.length, rule.upstreamRuleId).toBeGreaterThan(0);
      }
    });

    it('marks every absolute rule weak-alone and leaves the constructions strong', async () => {
      const rules = await rulesOf();
      const weak = (id: string): boolean =>
        rules.find((rule) => rule.upstreamRuleId === id)?.weakAlone ?? false;
      // The absolutism: adverbs and dashes.
      expect(weak('phrase-adverbs')).toBe(true);
      expect(weak('structure-rhythm-patterns')).toBe(true);
      // The two other absolutes: passive voice and the yes/no checklist families.
      expect(weak('structure-passive-voice')).toBe(true);
      expect(weak('structure-sentence-starters-to-avoid')).toBe(true);
      // Weak alone because a single dash or one of the words is uninformative.
      expect(weak('phrase-emphasis-crutches')).toBe(true);
      // Strong alone: a multi-word construction is itself the tell.
      expect(weak('structure-binary-contrasts')).toBe(false);
      expect(weak('phrase-vague-declaratives')).toBe(false);
    });

    it('marks the absolutism on both em-dash headings, which share one signature', async () => {
      const rules = await rulesOf();
      // `phrases.md:55` is the adverb ban; the em-dash ban is `structures.md:125`,
      // one row of Rhythm Patterns, restated as a checklist item at SKILL.md:25,43.
      const adverbs = rules.find((rule) => rule.upstreamRuleId === 'phrase-adverbs')!;
      const adverbNotes = adverbs.notes!.join(' ');
      expect(adverbNotes).toContain('ABSOLUTISM');
      expect(adverbNotes).toContain('Kill all adverbs');
      expect(adverbNotes).toContain('density-gated');

      const rhythms = rules.find((rule) => rule.upstreamRuleId === 'structure-rhythm-patterns')!;
      const rhythmNotes = rhythms.notes!.join(' ');
      expect(rhythms.signature).toBe('rhythm.uniform_rhythm');
      expect(rhythmNotes).toContain('SKILL.md:25');
      // The column that carries the ban is the Fix column of the Em-dashes row, and
      // it is the note on that row rather than the rule's guidance.
      const dashes = rhythms.watchPhrases.find((phrase) => phrase.text === 'Em-dashes')!;
      expect(dashes.note).toContain('No em dashes at all');
      expect(dashes.note).toContain('Remove');
      // The row is a row of Rhythm Patterns, whose signature is uniform rhythm, so
      // it does not get a second rule of its own — the duplicate is recorded.
      expect(rhythmNotes).toContain('rhythm.uniform_rhythm');
      // The central note says why the absolute form is not imported.
      expect(STOP_SLOP_POLICY_RECORDS.join(' ')).toContain('No em dashes at all');
    });

    it('survives conversion to dedupe input with the right tags', async () => {
      const result = await extract();
      const candidates = toRuleCandidates(result);
      expect(candidates).toHaveLength(EXPECTED.rules);
      for (const candidate of candidates) {
        expect(candidate.upstream).toBe('hardikpandya/stop-slop');
        expect(candidate.signature).not.toMatch(/^upstream\./);
        expect(candidate.tags).toContain('en');
      }
      const byId = new Map(candidates.map((candidate) => [candidate.upstreamRuleId, candidate]));
      expect(byId.get('phrase-adverbs')!.tags).toContain('weak-alone');
      expect(byId.get('phrase-adverbs')!.tags).toContain('inherited');
      expect(byId.get('structure-formulaic-constructions')!.tags).not.toContain('inherited');
    });
  });

  describe('provenance: inherited or unique', () => {
    /**
     * The reading of the ai-humanizer clone: its registry ids and its whole text
     * as a searchable vocabulary.
     *
     * The registry answers "does it claim this rule"; the text answers "does the
     * string exist in it at all". Both are needed, because they disagree for the
     * two rules this adapter's whole job turns on: `README.md:293-294` *credits*
     * narrator-from-a-distance and telling-not-showing while the clone contains no
     * rule id and no lexicon entry for either.
     */
    let registryIds: Promise<Set<string>> | undefined;
    let aiVocabulary: Promise<Vocabulary> | undefined;

    const ids = (): Promise<Set<string>> => {
      registryIds ??= readFile(
        path.join(aiHumanizerPath, 'scripts/registry/rules.mjs'),
        'utf8',
      ).then((text) => new Set([...text.matchAll(/^\s+id:\s*'([^']+)'/gm)].map((m) => m[1]!)));
      return registryIds;
    };

    const aiText = (): Promise<Vocabulary> => {
      aiVocabulary ??= clonePaths(aiHumanizerPath).then(async (files) => {
        const parts = await Promise.all(files.map((file) => readFile(file, 'utf8')));
        return buildVocabulary(parts.join('\n'));
      });
      return aiVocabulary;
    };

    /**
     * The canonical signatures ai-humanizer's own rules use.
     *
     * Derived from its registry ids through the same lexicon tokens the adapter's
     * signature map cites, so the comparison is between two upstreams' *signatures*
     * and not between two hand-typed lists. This is the route by which a structural
     * rule counts as inherited even though ai-humanizer words the construction
     * differently: `structural.negation_contrast` is ai-humanizer's
     * `aphoristic-cadence`, and `lexical.false_agency` is its `false-agency`.
     */
    let signatureIndex: Promise<Set<string>> | undefined;
    const aiHumanizerSignatures = (): Promise<Set<string>> => {
      signatureIndex ??= ids().then((set) => {
        const derived = new Set<string>();
        for (const [needle, signature] of [
          ['aphoristic', 'structural.negation_contrast'],
          ['falseagency', 'lexical.false_agency'],
          ['rhetoricalsetup', 'lexical.rhetorical_setup'],
          ['negativelisting', 'rhythm.negative_listing'],
          ['vague-declarative', 'lexical.vague_declarative'],
          ['meta-commentary', 'lexical.meta_commentary'],
          ['emphasis-crutch', 'lexical.emphasis_crutch'],
          ['dramatic-fragmentation', 'structural.one_line_closer'],
          ['adverb-filler', 'lexical.adverb_filler'],
          ['lazy-extremes', 'lexical.lazy_extremes'],
          ['passive-voice', 'lexical.passive_and_subjectless'],
          ['wh-opener', 'rhythm.repeated_openings'],
          ['ai-openers', 'structural.staged_runup'],
          ['business-jargon', 'lexical.business_jargon'],
          ['em-dash-overuse', 'rhythm.dash_overuse'],
          ['rule-of-three', 'rhythm.forced_triad'],
          ['uniform-rhythm', 'rhythm.uniform_rhythm'],
        ] as const) {
          const present = [...set].some((id) =>
            id.replace(/[_-]/g, '').includes(needle.replace(/[_-]/g, '')),
          );
          if (present) derived.add(signature);
          // `staged_candor` has no ai-humanizer rule id of its own: its content
          // lives inside that clone's emphasis-crutch and ai-openers lists.
          if (needle === 'emphasis-crutch') derived.add('structural.staged_candor');
        }
        return derived;
      });
      return signatureIndex;
    };

    it('finds the ai-humanizer clone it is comparing against', async () => {
      expect(aiHumanizerPresent).toBe(true);
      const set = await ids();
      // 46 ids, the count `tests/upstream.test.ts:503` pins for this clone.
      expect(set.size).toBe(46);
      for (const id of BARRED_AI_HUMANIZER_IDS) {
        expect(set.has(id), id).toBe(true);
      }
      const registry = await readFile(
        path.join(aiHumanizerPath, 'scripts/registry/rules.mjs'),
        'utf8',
      );
      expect(registry).toMatch(/Absorbed from stop-slop/i);
    });

    it('marks at least 5 rules as also present in ai-humanizer, by searching it', async () => {
      const vocabulary = await aiText();
      const rules = await rulesOf();
      // The bar is deliberately higher than "one phrase happens to match": a rule
      // counts as independently found only when at least two of its watched items
      // are in the clone. One match can be ordinary English that both projects
      // happen to use; two of them in one category is evidence of absorption.
      const found = rules.filter(
        (rule) =>
          rule.watchPhrases.filter((phrase) =>
            phrase.kind === 'literal'
              ? vocabulary.contains(phrase.text)
              : vocabulary.containsTemplate(phrase.text),
          ).length >= 2,
      );
      const evidence = found
        .map((rule) => `${rule.upstreamRuleId}: ${rule.watchPhrases.length} items`)
        .join('; ');
      expect(found.length, `rules with 2+ watched items in ai-humanizer: ${evidence}`).toBeGreaterThanOrEqual(
        5,
      );
      // Name the strongest three so a regression is legible.
      const ids = found.map((rule) => rule.upstreamRuleId);
      expect(ids).toContain('phrase-business-jargon');
      expect(ids).toContain('phrase-vague-declaratives');
      expect(ids).toContain('phrase-adverbs');
    });

    it('finds every jargon row and every vague declarative verbatim, in full', async () => {
      const vocabulary = await aiText();
      const rules = await rulesOf();
      // These two are the categories where the absorption is complete rather than
      // partial, so "every item present" is the assertion, not "any item".
      for (const id of ['phrase-business-jargon', 'phrase-vague-declaratives']) {
        const rule = rules.find((candidate) => candidate.upstreamRuleId === id)!;
        for (const phrase of rule.watchPhrases) {
          expect(vocabulary.contains(phrase.text), `${id}: ${phrase.text}`).toBe(true);
        }
        expect(allItemsPresent(rule, vocabulary), id).toBe(true);
      }
    });

    it('marks exactly 17 rules inherited and 3 unique', async () => {
      const rules = await rulesOf();
      const inherited = rules.filter((rule) => rule.originatedIn !== undefined);
      const unique = rules.filter((rule) => rule.originatedIn === undefined);
      expect(inherited).toHaveLength(EXPECTED.inheritedRules);
      expect(unique).toHaveLength(EXPECTED.uniqueRules);
      expect(unique.map((rule) => rule.upstreamRuleId).sort()).toEqual([...UNIQUE_RULE_IDS].sort());
      for (const rule of inherited) {
        expect(rule.originatedIn, rule.upstreamRuleId).toBe('judetelan/ai-humanizer');
      }
    });

    it('only marks a rule inherited when ai-humanizer actually contains it', async () => {
      const vocabulary = await aiText();
      const rules = await rulesOf();
      // A rule marked inherited must be findable in the ai-humanizer clone in at
      // least one of two ways: a watched item is verbatim there, or the rule's
      // canonical signature is one of the signatures that clone's own registry
      // uses. The second route matters for the structural rules, whose strings are
      // paraphrased on import while the tell is the same — `structural.negation_contrast`
      // is ai-humanizer's `aphoristic-cadence`, not its `negative-listing`.
      const aiSignatures = await aiHumanizerSignatures();
      for (const rule of rules.filter((candidate) => candidate.originatedIn)) {
        expect(
          anyItemPresent(rule, vocabulary) || aiSignatures.has(rule.signature),
          `${rule.upstreamRuleId} (${rule.signature})`,
        ).toBe(true);
      }
      // The rules that are marked inherited with *no* verbatim item and *no*
      // signature match would be the false attributions. There are none.
      const unsupported = rules
        .filter((candidate) => candidate.originatedIn)
        .filter((candidate) => !anyItemPresent(candidate, vocabulary))
        .filter((candidate) => !aiSignatures.has(candidate.signature))
        .map((candidate) => candidate.upstreamRuleId);
      expect(unsupported).toEqual([]);
      // The rules marked inherited that no verbatim item supports: the structural
      // headings whose construction strings ai-humanizer paraphrases while keeping
      // the tell, plus the performative-emphasis list that moved into
      // EMPHASIS_CRUTCH. Each is named so a change fails loudly instead of eroding
      // the provenance claim quietly.
      const signatureOnly = rules
        .filter((candidate) => candidate.originatedIn)
        .filter((candidate) => !anyItemPresent(candidate, vocabulary))
        .map((candidate) => candidate.upstreamRuleId)
        .sort();
      expect(signatureOnly).toEqual([
        'phrase-performative-emphasis',
        'structure-binary-contrasts',
        'structure-dramatic-fragmentation',
        'structure-negative-listing',
        'structure-sentence-starters-to-avoid',
      ]);
      // The adapter originally mapped all three unique rules onto the nearest
      // existing signature and reported the imprecision. Those three gaps were
      // then filled in the vocabulary, so each now points at an exact fit and
      // none of them asserts a false relationship with ai-humanizer.
      for (const signature of [
        'lexical.telling_not_showing',
        'structural.formulaic_construction',
        'structural.narrator_from_a_distance',
      ]) {
        expect(isKnownSignature(signature), signature).toBe(true);
        expect(aiSignatures.has(signature), signature).toBe(false);
      }
      const telling = rules.find(
        (rule) => rule.upstreamRuleId === 'phrase-telling-instead-of-showing',
      )!;
      // Marked unique because the *content* is not in ai-humanizer, which is what
      // `originatedIn` records.
      expect(telling.originatedIn).toBeUndefined();
      expect(telling.signature).toBe('lexical.telling_not_showing');
    });

    it('leaves the 3 unique rules with no matching item anywhere in ai-humanizer', async () => {
      const vocabulary = await aiText();
      const rules = await rulesOf();
      const unique = rules.filter((rule) => rule.originatedIn === undefined);
      for (const rule of unique) {
        expect(anyItemPresent(rule, vocabulary), rule.upstreamRuleId).toBe(false);
        expect(rule.notes!.join(' '), rule.upstreamRuleId).toMatch(/UNIQUE|stop-slop-only/i);
      }
    });

    it('shows the narrator and telling-not-showing credits are prose only', async () => {
      const readme = await readFile(path.join(aiHumanizerPath, 'README.md'), 'utf8');
      expect(readme).toMatch(/narrator-from-a-distance/);
      expect(readme).toMatch(/telling-not-showing/);

      const set = await ids();
      expect(set.has('narrator-from-a-distance')).toBe(false);
      expect(set.has('telling-not-showing')).toBe(false);

      const vocabulary = await aiText();
      for (const term of [
        'Nobody designed this',
        'People tend to',
        'This happens because',
        'This is genuinely hard',
        'actually matters',
      ]) {
        expect(vocabulary.contains(term), term).toBe(false);
      }
    });

    it('proves each stop-slop-only term is absent from every other clone, by searching', async () => {
      // Excluding ai-humanizer: the question is which of the other six clones has
      // this term. Stop-slop itself is excluded too, because the term is trivially
      // in the upstream whose content this is; "found only in stop-slop" is the
      // claim being tested.
      const { text, hits } = await searchEverywhere(
        projectRoot,
        ['ai-humanizer', 'stop-slop'],
        STOP_SLOP_ONLY_TERMS,
      );
      expect(text.length).toBeGreaterThan(10_000);
      for (const term of STOP_SLOP_ONLY_TERMS) {
        expect(hits.get(term), `${term} found in ${hits.get(term)?.join(', ')}`).toEqual([]);
      }
    });

    it('shows the same terms are in stop-slop, so the absence above is not a broken search', async () => {
      const { hits } = await searchEverywhere(projectRoot, ['ai-humanizer'], STOP_SLOP_ONLY_TERMS);
      for (const term of STOP_SLOP_ONLY_TERMS) {
        expect(hits.get(term), term).toEqual(['stop-slop']);
      }
    });

    it('finds the terms it claims are inherited, for a positive control', async () => {
      // The same search, on terms that *must* be in another clone. Without this a
      // search helper that silently returned nothing would make the uniqueness test
      // pass for the wrong reason. `let that sink in` is in two clones, which is
      // itself worth knowing: ai-humanizer is not the only second source here.
      const { hits } = await searchEverywhere(
        projectRoot,
        ['stop-slop'],
        ['the stakes are high', 'the reasons are structural', 'let that sink in', 'plot twist:'],
      );
      for (const term of [
        'the stakes are high',
        'the reasons are structural',
        'let that sink in',
        'plot twist:',
      ]) {
        expect(hits.get(term), term).toContain('ai-humanizer');
      }
      expect(hits.get('plot twist:')).toEqual(['ai-humanizer']);
    });

    it('confirms the reconnaissance clauses that were wrong, by searching', async () => {
      const { hits } = await searchEverywhere(
        projectRoot,
        ['stop-slop'],
        ['importantly,', 'interestingly,', 'creeps in', 'i promise', 'they exist, i promise'],
      );
      // "importantly" and "interestingly" ARE in ai-humanizer, as openers in
      // AI_OPENERS (scripts/lexicons.mjs:45,50) rather than in ADVERB_FILLER.
      expect(hits.get('importantly,')).toContain('ai-humanizer');
      expect(hits.get('interestingly,')).toContain('ai-humanizer');
      // Performative emphasis IS inherited, under EMPHASIS_CRUTCH
      // (scripts/lexicons.mjs:182-183).
      expect(hits.get('creeps in')).toContain('ai-humanizer');
      expect(hits.get('i promise')).toContain('ai-humanizer');
      expect(hits.get('they exist, i promise')).toContain('ai-humanizer');
      // And the rules are marked inherited, not unique.
      const unique = new Set<string>(STOP_SLOP_UNIQUE_RULE_IDS);
      expect(unique.has('phrase-adverbs')).toBe(false);
      expect(unique.has('phrase-performative-emphasis')).toBe(false);
      expect(STOP_SLOP_UNIQUE_RULE_IDS).toHaveLength(EXPECTED.uniqueRules);
    });

    it('records the dual attribution the suite needs: both upstreams, one rule', async () => {
      const result = await extract();
      const candidates = toRuleCandidates(result);
      const byId = new Map(candidates.map((candidate) => [candidate.upstreamRuleId, candidate]));
      // Inherited rules carry the `inherited` tag, which is what tells dedupe the
      // content exists in ai-humanizer too.
      const inheritedCandidates = candidates.filter((candidate) =>
        (candidate.tags ?? []).includes('inherited'),
      );
      expect(inheritedCandidates).toHaveLength(EXPECTED.inheritedRules);
      // The jargon table is the sharpest case: ai-humanizer reproduces it row for
      // row and is barred from importing it, so this adapter must.
      expect(byId.get('phrase-business-jargon')!.tags).toContain('inherited');
      expect(byId.get('phrase-business-jargon')!.signature).toBe('lexical.business_jargon');
      // The unique rules must not carry it.
      for (const id of UNIQUE_RULE_IDS) {
        expect(byId.get(id)!.tags, id).not.toContain('inherited');
      }
    });
  });
});
