# Provenance and rule policy

This document is the operational version of `ARCHITECTURE.md` invariants 1, 2 and
4. It is what you follow when adding an upstream or a rule.

## Why this is not documentation theatre

The corpus contains one lineage and two licence defects. Concretely:

- `blader/humanizer` pattern 13, `humanizer-zh-cn` pattern 1 and
  `ai-zixun/humanizer-zh` pattern 3 are the same tell.
- `op7418/Humanizer-zh` reproduces blader's work without its copyright notice.
- `judetelan/ai-humanizer` absorbed 11 of its 46 rules from `stop-slop` without
  `stop-slop`'s notice.

A project that ignores the first fact produces wrong numbers. A project that
ignores the second and third produces a licence problem. Both are prevented by
the same mechanism: **every rule knows where it came from, at rule level.**

The project brief's image for this is exact: a README that says "thanks to
Humanizer" is not provenance.

## The rule record

```ts
interface CanonicalRule {
  id: string;              // dotted snake_case, the dedupe key
  category: string;
  languages: string[];
  description: string;
  detection?: string;      // machine-checkable, or plain language if model-judged
  rewriteGuidance: string; // required: a rule you cannot act on is noise
  severity: number;        // 1..5, clamped
  sources: SourceReference[];
  aliases: string[];
  localChanges?: LocalChange[];
  status?: 'seed' | 'canonical' | 'deprecated';
  tags?: string[];
}
```

`sources` is an array because the whole point is that several upstreams can claim
one rule. `localChanges` exists so our own additions are never passed off as
inherited capability.

## The signature

The dedupe key is a **signature**: a repository-independent dotted snake_case id
such as `structural.inflated_significance`.

It is **not** a pattern number, and this is not a stylistic preference:

| Revision | Identifier for "avoid dashes" |
| --- | --- |
| blader v3.0.0 | pattern 8 |
| op7418 | pattern 13 |
| humanizer-zh-cn (blader v2.9.1) | pattern 14 |
| ai-zixun | pattern 6 |

Four numbers, one tell. Any dedupe keyed on number collapses the wrong things and
misses the right ones.

### Naming a signature

- Dotted snake_case, `^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$`. Enforced at registry and
  dedupe time; an invalid signature throws rather than being coerced.
- The first segment is the family: `structural`, `lexical`, `rhythm`,
  `formatting`, `assistant`, `chat`.
- Name the **tell**, not the fix. `structural.inflated_significance`, not
  `structural.remove_significance_claims`.
- Two upstreams detecting the same thing **must** emit the same signature. That
  is the entire mechanism; if two adapters disagree, deduplication silently fails
  and the tell is charged twice.

### When a signature turns out to be wrong

Do not rename it in place. Add it to the `signatureAliases` map passed to
`dedupeRuleCandidates`, so historical findings remain explainable and old
references still resolve.

## Severity

Clamped to 1–5. When several upstreams claim one rule, the default policy is
`max`: the rule fires once, at the strength of the most insistent upstream.
`median` and `mean` are available for a tangled lineage and are what the Phase 1
seed uses.

Severity is a property of the rule, not of a finding. A detector may down-weight
its own confidence; it may not change the rule's severity.

## The three integration kinds, and what each demands

### `markdown-skill` — parse it, never paste it

A Markdown skill is a prompt, not a rule set. Pasting it whole into a prompt
reintroduces exactly the problem this project solves: no ids, no severities, no
deduplication, no provenance.

Each parse must have an explicit plan, an assertion on the expected pattern
count, and a defined behaviour for every non-uniform case. The `blader/humanizer`
plan in `UPSTREAM_INVENTORY.md` §4.2 is the model: eight passes, with the edge
cases named, including the eight patterns that have **no** watch list and must
therefore be `null` rather than empty.

Assert the count. `blader` has 25 patterns; `humanizer-zh-cn` has 33;
`humanize-text` has 13. A parser that silently extracts 24 has a bug, and the
assertion is what finds it.

### `executable-detector` — wrap it, fix it, do not inherit its bugs

Port the upstream's logic behind the `Detector` interface, and fix the defects
that would corrupt results. From the inventory, the mandatory fixes are:

- `dsh-humanizer`: regexes compiled without the `m` flag, so 37 anchored patterns
  never match past position 0.
- `dsh-humanizer`: a naively blended 0–100 score that saturates and ignores text
  length.
- `dsh-humanizer`: a store that silently discards the profile file on a schema
  version mismatch.
- `ai-humanizer`: 12 lexicon entries duplicated across arrays, which double-charge
  those terms.
- `humanize-text`: an offline statistical detector whose 0.7/0.5/0.6 thresholds
  are unanchored.

Never carry an upstream's own scoring model into the suite. Every detector
contributes `Finding`s; the suite's own scoring layers produce the four scores.

### `voice-profile` — abstract onto the unified interface

Do not keep the upstream's profile shape. Map it onto `VoiceProfile`, and record
what could not be mapped rather than dropping it silently. See
`voice-profile-schema.md`.

### `methodology` and `research-only`

`methodology` becomes a named strategy and stays **off the default execution
path**. `research-only` means read it, learn from it, copy nothing — and that
instruction is recorded in the manifest as `integration: "research-only"` and
`tracked: false`, not as a comment.

## Adding an upstream: the checklist

Licence first. Everything else is second.

1. **Establish the licence** by reading the actual `LICENSE` at the commit you
   will pin. No licence file means `research-only`, regardless of how useful it
   looks. Do not infer a licence from a README badge.
2. **Check for inherited content.** If the upstream took work from a third party,
   verify the third party's notice travelled with it. If it did not, restrict the
   import with `import_exclusions` and source that content from whoever holds
   clean title. This is exactly what the manifest does for `ai-humanizer`.
3. **Record the copyright holder verbatim**, including punctuation and spacing.
4. **Pin a forty-character commit.** Branches move. `validateManifest` rejects a
   short SHA.
5. **Fill in `derived_from`** for content derivation — this is what prevents
   same-lineage repositories being counted twice — and `external_ancestors` for
   ancestors outside the manifest.
6. **Copy the licence** byte-for-byte into `licenses/<SPDX>-<name>`.
7. **Update `THIRD_PARTY_NOTICES.md`**, including a section if anything is
   unusual.
8. **Write the adapter** and register it. `tests/upstream.test.ts` asserts the
   adapter registry and the manifest agree exactly.
9. **Run `npm run typecheck && npm test && npm run licenses:verify`.**
10. **Never delete an existing notice.** Not when rewriting, not when
    translating, not when consolidating.

## Deduplication, worked

The Phase 1 seed in `src/rules/canonical/seed.ts` is the reference
implementation. Its behaviour is asserted by `tests/rules.test.ts`:

```text
input:  structural.inflated_significance claimed by
          blader/humanizer        pattern 13
          humanizer-zh-cn         pattern 1
          ai-zixun/humanizer-zh   pattern 3
          op7418/Humanizer-zh     pattern 1   (research only, provenance only)

output: ONE CanonicalRule
          id: structural.inflated_significance
          sources: 4, with the op7418 source marked as not importable
          languages: ['en', 'zh']
          severity: median of the contributing claims
```

Four claims, one rule, one deduction. And `registry.resolveUpstreamRule('blader/humanizer', '13')`
still resolves, so a finding expressed in upstream numbering lands correctly.

## Reporting

`buildProvenanceReport` produces the audit view: total rules, how many collapsed
a lineage, how many are entirely local, and per-upstream exclusive versus shared
contribution counts.

That last pair is the honest measure of an upstream's value. A repository with 33
rules of which 33 are shared with its own ancestor contributes nothing
independent. A repository with 13 rules of which 13 are exclusive contributes
everything it has. Rule count alone says nothing.

---

# Part 2: writing an adapter

Phase 2 established the machinery. This is what you follow to add an upstream.

## The signature vocabulary is a controlled list

`src/rules/canonical/signatures.ts` holds every signature the suite recognises,
each with a category, the languages it is meaningful for, and one line saying
what the tell is.

**Use only signatures that exist there.** Three adapters are written
independently; without a shared list they will invent
`structural.inflated_significance`, `lexical.inflated_claims` and
`structural.significance_inflation` for one tell, and deduplication fails
silently. `assertKnownSignature` throws on anything else.

**If you need a signature that is not there, report it — do not invent one.** If
your rule cannot be expressed by an existing id, that is a real gap in the
vocabulary and it should be filled deliberately, in one place. Three gaps were
filled this way during Phase 2:

| Added | Requested by | Why it was genuinely new |
| --- | --- | --- |
| `formatting.exclamation_spam` | `ai-humanizer` | There was no punctuation-rate signature, so `exclamation-spam` was sharing `emoji-decoration` |
| `lexical.passive_and_subjectless` | the blader map | blader pattern 11 is not the same as copula avoidance |
| `rhythm.negative_listing` | the stop-slop map | Listing what something is *not* is not the same as a single contrast |

Use `unmappedSignature(slug, id)` only as a fallback so the run does not crash.
Every unmapped signature is reported as a problem and fails `upstream:extract`,
which is the point.

## The three files an adapter owns

```text
src/upstream/adapters/<directory>/
  signatures.ts            upstream rule id -> canonical signature
  parse.ts                 export async function parseX(repoPath): Promise<ExtractionResult>
  rules.generated.json     produced by npm run upstream:extract, committed
tests/extraction-<slug>.test.ts
```

Plus one entry in `src/upstream/extract/targets.ts`. Note that `directory` is
declared explicitly and may differ from the manifest name — `blader-humanizer`
lives in `adapters/blader`. Deriving the path from the id would write the artifact
somewhere nobody looks, which is a mistake this project has already made once.

## What `watched phrases` are for

An upstream's "Watch for" list is not one thing. `parseWatchList` classifies each
entry:

- **`literal`** — matchable text. `delve`, `值得注意的是`, `I hope this helps`.
- **`template`** — a construction. `not X but Y`, `as of [date]`, `不是……而是……`.
  Needs a pattern, not a string, so the lexical detector skips it.
- **`reference`** — too short, too common, or an explanatory clause. Kept so the
  data is complete; never matched.

Getting this wrong is expensive in both directions, and the two real cases are
worth remembering because they look identical:

```text
not just, not only, or not merely X, but Y      ONE construction
delve, crucial, not X but Y                     THREE entries
```

The first must stay whole, or `not just` becomes a matchable phrase that fires on
ordinary English. The second must split, or two watched phrases are lost. The
separating signal is that in the first case *every* fragment after the first is a
grammatical continuation, and in the second case only the last one is —
`segmentWatchList` implements exactly that and is tested on both.

## Disclosures are not warnings

`ExtractionResult` has two fields for things that are not rules.

- `warnings` — the parser could not handle something. Fails `upstream:extract`.
- `disclosures` — a deliberate decision, such as `humanize-text`'s eight
  techniques its documentation claims and its code never implements, or its
  remote translation chain that must not become a strategy.

Use `disclosures` for the second kind. Conflating them means either failing the
build for correct behaviour or burying a real parser problem among nine
informational notes.

## Before you commit an adapter

```bash
npm run upstream:extract          # must exit 0
npm run typecheck
npm test
```

Your test should assert, at minimum: the exact rule count and that numbering is
contiguous, zero warnings, every rule `signatureMapped === true`, that a specific
verbatim watched phrase and before/after example survive the parse, and how many
rules reuse a signature from another upstream.

That last count is the one that matters. A Markdown skill that reuses no
signature from the lineage it descends from is either mistranslated or a
duplicate that has not been recognised as one.

## Worked result

After four adapters were wired in, 97 extracted rules collapsed to 52 canonical
rules with 24 cross-upstream merges. For example:

```text
structural.inflated_significance  <- blader#13, humanizer-zh-cn#1
assistant.chatbot_residue         <- blader#22, ai-humanizer#chatbot-closer, humanizer-zh-cn#20
lexical.copula_avoidance          <- blader#18, ai-humanizer#copula-avoidance,
                                     ai-humanizer#plays-a-role, ai-humanizer#contraction-absence,
                                     humanizer-zh-cn#8
lexical.ai_vocabulary             <- blader#12, ai-humanizer#banned-vocab,
                                     humanize-text#vocab-replacement, humanize-text#vocab-formal-to-everyday
```

Without the collapse, the first line would have deducted twice, the second three
times and the fourth four times, for one problem each.

## Gotchas found the hard way

Recorded because each one cost real debugging.

- **A group-level template check swallows whole lists.** blader pattern 22's
  watch list contains `Would you like...`, so checking the group would discard all
  ten of its phrases, including `Great question!` — the most certain tell in the
  corpus. Check fragments, not groups.
- **Quotation marks inside a list are separators waiting to happen.**
  `humanizer-zh-cn` writes `"第一、第二、第三"`, where the enumeration comma is
  inside the quoted example. `splitOutsideParens` protects `“”`, `「」` and `『』`
  for exactly this reason. Straight quotes are not tracked, because an apostrophe
  makes their pairing ambiguous.
- **A field runs to the next label, not to the end of the sentence.** Patterns
  that end with an unlabelled scope caveat will pull that caveat into the last
  labelled field. Check where your fields actually end.
- **Not every pattern has every field.** `humanizer-zh-cn` has six patterns with
  no `问题` and nine with no `留意`; blader has eight with no `Watch for`. Treating
  an absence as a parse failure emits a dozen bogus warnings and hides the real
  ones.
- **A pattern number is not an identity.** If you are tempted to key anything on
  a number, re-read §2 of `UPSTREAM_INVENTORY.md`.

