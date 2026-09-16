# Architecture

Human Voice Suite is a collection, not a pile. This document explains the
layering and, more usefully, the invariants that keep the layers from collapsing
into one another.

## The shape

```text
  upstreams            read-only clones, pinned by commit
      │
      ▼
  adapters             one per upstream; the ONLY code that knows how that
      │                upstream spells things
      ▼
  RuleCandidate[]      a tell as claimed by exactly one upstream
      │
      ▼
  dedupe               collapse same-signature claims
      │
      ▼
  CanonicalRule        one tell, one id, N sources, rule-level provenance
      │
      ├──────────────► detector/    findings, each resolved to a canonical rule
      │                    │
      │                    ▼
      │                scan         fuses detector families, collapses again,
      │                             returns antiAIScore and nothing blended
      │
      ├──────────────► voice/       VoiceProfile: writing + chat + behaviour
      │
      ├──────────────► behavior/    assistant smells, behaviour baselines
      │
      ▼
  StrategyEngine       deterministic conditions pick detector families,
      │                rule categories, adapters and a pipeline
      ▼
  HumanVoiceContract   rules + preserve list + prohibitions + budget
      │
      ▼
  DSH tool surface     human_voice_scan / _prepare / _voice / _chat /
                       _validate / _profile
```

The original brief describes this as
`upstreams → adapters → unified rules → detector → voice → behaviour → contract → DSH`.
That is exactly the pipeline above, and it is deliberately one-directional.
Nothing at the bottom may know about a specific upstream.

## The invariants

These are the rules that make the suite a collection rather than a folder. Each
one is enforced somewhere in code or tests, not left to discipline.

### 1. One tell is one rule

`CanonicalRuleRegistry` keys on a dotted snake_case **signature**, never on a
pattern number, because pattern numbers are not comparable across this corpus
(see `UPSTREAM_INVENTORY.md` §2). Deduplication groups claims by signature,
unions their languages, merges their `sources` and keeps one severity.

- Enforced by: `src/rules/dedupe/dedupe.ts`, `src/rules/canonical/registry.ts`
- Tested by: `tests/rules.test.ts` — three claims from three upstreams must
  produce one rule with three sources and a `crossUpstream` merge record.

`collapseToCanonical` applies the same idea at detection time, so a rule that
somehow fires twice is still charged once.

### 2. Provenance is rule-level, not README-level

Every rule carries `sources: SourceReference[]`, each naming the upstream, the
upstream's own identifier, a locator and optionally a verbatim quote. Every rule
also carries optional `localChanges`, so our own additions are never disguised
as inherited capability.

- Enforced by: `src/rules/provenance/types.ts`
- Reported by: `buildProvenanceReport`, which computes upstream contribution
  counts and lists the lineages that deduplication collapsed.

### 3. Upstreams are read-only

Adapters receive an `AdapterContext` whose only operations are `readFile` and
`listFiles`, both contained to the upstream's own clone by a path check. There is
no write operation to expose.

- Enforced by: `src/upstream/workspace.ts` (`PathEscapeError`)
- Tested by: `tests/upstream.test.ts` (escape attempt rejected) and
  `tests/manifest.test.ts` (`git status --porcelain` empty for all eight clones).

### 4. Licence is checked before anything else

A manifest entry without a licence, a copyright holder or a pinned forty-character
commit fails validation and throws. Content with inherited-notice problems is
barred by machine-readable `import_exclusions`, not by a comment.

- Enforced by: `validateManifest`, `ManifestValidationError`
- Verified by: `npm run licenses:verify`, which compares every preserved licence
  against the upstream at the pinned commit.

### 5. No blended human score

Section 19 of the brief forbids inventing a "97% human" number. The suite reports
`antiAIScore`, `voiceScore`, `behaviorScore` and `preservationScore` separately,
each with a rationale and per-contribution breakdown. A runtime guard rejects a
fused key, and the names are listed as data so a test can scan output for them.

- Enforced by: `assertNoBlendedScore`, `FORBIDDEN_BLENDED_SCORE_KEYS`
- Tested by: `tests/scan.test.ts` — no forbidden key may appear in serialised
  scores.

### 6. Capabilities are public, upstreams are internal

No tool is named after an upstream. Tool names are `human_voice_*` and map onto
the six capabilities. Upstream names appear only inside results, as provenance.

- Enforced by: `FORBIDDEN_TOOL_PATTERNS` and `findUpstreamLeakingToolNames`
- Tested by: `tests/dsh-surface.test.ts` — asserts the leak detector would catch
  `run_blader` if someone added it.

### 7. The suite never calls a language model

`human_voice_prepare` produces a `HumanVoiceContract` and returns it to the
calling DSH agent, which performs the rewrite. The suite is not a model proxy,
and exactly one model stays in the loop.

- Enforced by: the DSH plugin constraint list, and the absence of any network
  client in the source tree.

### 8. Strategy is chosen by condition, not by improvisation

`selectStrategy` is a first-match-wins rule table over language, mode and turn
length. Every result carries a `rationale` explaining the choice, so a surprising
strategy can be traced rather than guessed at.

- Enforced by: `src/rewrite/strategies/strategy.ts`
- Tested by: `tests/strategy.test.ts`, including a determinism check.

### 9. Short chat never pays for the long pipeline

Chat turns under 240 characters take the fast path: behaviour baseline, voice
profile, answer. No draft, no scan, no retry.

- Enforced by: `FAST_PATH_PIPELINE` and the `isShort` condition in the strategy
  table.
- Tested by: `tests/strategy.test.ts`.

### 10. At most one retry

`HumanVoiceContract.budget` caps rewrite passes at two and validation retries at
one. This is a hard ceiling, not a default.

- Enforced by: `buildContract`
- Tested by: `tests/contract.test.ts`.

### 11. Extraction is a build step, and its output is committed

Adapters parse the pinned clones and write `<adapter>/rules.generated.json`,
which is committed. The published package therefore carries its rules with
provenance attached and needs no clone at run time, and every rule change shows
up as a reviewable diff.

The artifact records the commit it was read from. `tests/extraction-pipeline.test.ts`
asserts that commit matches the manifest, so a stale artifact cannot be read as
current truth.

- Enforced by: `src/upstream/extract/generate.ts`, `npm run upstream:extract`
- Tested by: `tests/extraction-pipeline.test.ts` — artifact commit versus manifest

### 12. A warning is a defect; a disclosure is not

`ExtractionResult` separates the two. `warnings` fails the extraction run;
`disclosures` records a deliberate decision, such as `humanize-text`'s eight
documented-but-unimplemented techniques and its remote translation chain.

Conflating them means either failing the build for correct behaviour or hiding a
real parser problem among nine informational notes. Both are worse than a second
field.

- Enforced by: `extractionProblems` versus `extractionDisclosures`
- Tested by: `tests/extraction-pipeline.test.ts` — a disclosure is never also a warning

### 13. A signature is a controlled vocabulary, not a free name

Three adapters are written independently. Without a shared list they would invent
`structural.inflated_significance`, `lexical.inflated_claims` and
`structural.significance_inflation` for one tell, and deduplication would fail
silently — the failure this project exists to prevent.

So signatures come from `CANONICAL_SIGNATURES`, `assertKnownSignature` throws on
anything else, and an adapter that finds a genuine gap reports it rather than
inventing an id. Three gaps were found this way during Phase 2 and filled in the
vocabulary.

- Enforced by: `src/rules/canonical/signatures.ts`
- Tested by: `tests/signatures.test.ts` — every id is valid, unique and prefixed
  by its own category; the ten `chat.*` ids match the behaviour taxonomy exactly.

## Directory map

`✓` implemented · `·` scaffolded, planned for the phase shown

```text
src/
  shared/                        ✓ language, mode, severity, text statistics
  rules/
    types.ts                     ✓ CanonicalRule, RuleCandidate, WatchPhrase
    canonical/signatures.ts      ✓ the controlled signature vocabulary
    canonical/registry.ts        ✓ the registry
    canonical/load.ts            ✓ registry built from committed extractions
    canonical/local.ts           ✓ rules that belong to this project
    canonical/seed.ts            ✓ Phase 1 seed, kept for fast collapse tests
    aliases/                     ·  Phase 3
    dedupe/dedupe.ts             ✓ signature-based deduplication
    provenance/                  ✓ rule-level provenance and reporting
  upstream/
    types.ts                     ✓ manifest and adapter contracts
    manifest.ts                  ✓ load, validate, lineage, URL derivation
    registry.ts                  ✓ adapter registry and manifest audit
    workspace.ts                 ✓ contained, read-only adapter file access
    sync.ts                      ✓ upstream:check engine and report renderer
    rule-extract.ts              ✓ rule-heading diffing, licence diffing
    git.ts                       ✓ read-only git wrapper
    extract/                     ✓ markdown + phrase parsing, extraction runner
    cli/                         ✓ upstream:check, upstream:extract, licenses:verify
    adapters/<upstream>/         ✓ parser + signature map + generated rules
  detector/
    types.ts                     ✓ Detector, Finding, DetectionContext
    catalog.ts                   ✓ declared detector slots with real statuses
    scan.ts                      ✓ unified scan, canonical collapse, antiAIScore
    suppression.ts               ✓ weak-alone and When-not-to-act policy
    registry.ts                  ✓ the detectors that actually run
    lexical/rule-driven.ts       ✓ matches every upstream's watched phrases
    shared/template.ts           ✓ compiles construction templates
    shared/template-detector.ts  ✓ matches them, across every family
    shared/helpers.ts            ✓ category-to-family mapping, rate maths
    structural/index.ts          ✓ headings, bold, closers
    rhythm/index.ts              ✓ burstiness, dashes, openings, triads
    chinese/index.ts             ✓ half-width marks inside Chinese
    english/index.ts             ✓ passive voice, dropped subjects
    stylometry/index.ts          ✓ statistical detector, voice distance
    assistant/                   ·  Phase 5
  voice/
    types.ts                     ✓ unified VoiceProfile (writing+chat+behaviour)
    fingerprint/ profile/        ·  Phase 6
    scoring/ import/ adaptation/ ·  Phase 6
  behavior/
    types.ts                     ✓ ten assistant smells, BehaviourBaseline
    chat/ assistant-smell/       ·  Phase 5
    conversation/ verbosity/     ·  Phase 5
    interaction/                 ·  Phase 5
  rewrite/
    types.ts contract.ts         ✓ the contract and its renderer
    contract/                    ✓ barrel + planned additions
    planner/ preserve/           ·  Phase 4
    strategies/strategy.ts       ✓ deterministic strategy table
  validation/
    types.ts                     ✓ four scores, no blended score
    protected-content/extract.ts ✓ extraction and preservation checking
    semantic/ anti-ai/           ·  Phase 4
    voice/ behavior/             ·  Phases 5–6
  dsh/
    tools/descriptors.ts         ✓ the six-capability tool surface
    plugin/                      ✓ plugin descriptor and constraints
    prompt/                      ·  Phase 4
  compatibility/
    upstream-version/ migrations/·  Phase 3
```

## How extraction works

```text
pinned clone
    │
    ▼
adapter.parse(repoPath)  ──►  ExtractionResult { rules, warnings, disclosures }
    │                            each rule: signature, watchPhrases, examples,
    │                            weakAlone, locator, quote
    ▼
rules.generated.json          committed, pinned to sourceCommit
    │
    ▼
toRuleCandidates()            one candidate per upstream claim
    │
    ▼
dedupeRuleCandidates()        collapse by signature; union phrases and languages;
    │                         weak alone if any source says so
    ▼
CanonicalRuleRegistry         what the detectors read
```

The adapter is the only code that knows how its upstream spells things. Once a
rule has a signature, nothing downstream cares where it came from — except the
provenance report, which cares a great deal.

### Why the watched phrases live on the canonical rule

A lexical detector could have been written per upstream, each with its own word
list. Instead the phrases are unioned onto the canonical rule, and one detector
reads them. So `structural.inflated_significance` carries the watched phrases
from blader pattern 13 *and* `humanizer-zh-cn` pattern 1 *and* whatever
`ai-humanizer` contributed, and matching any of them produces one finding
against one rule.

That is what makes adding an upstream require no detector change at all.

## The two data flows

### Full pipeline — long-form writing

```text
input
  → mode detection            inferMode() when the caller did not declare one
  → draft                     the calling agent writes it; the suite never does
  → unified scan              scan(): every available detector, collapsed to
                              canonical rules, antiAIScore produced
  → strategy selection        selectStrategy(): a deterministic table lookup
  → voice contract            directivesFromFindings() + the voice profile
  → behaviour contract        behaviourDirectives() when mode is chat
  → rewrite                   the CALLING agent rewrites, using the rendered
                              contract as its brief
  → validation                preservation, semantic, voice, behaviour, anti-AI
  → at most one retry
  → final output
```

### Fast path — short chat

```text
input
  → behaviour baseline        the reply shape a person would use
  → voice profile             user/chat when one is loaded
  → answer
```

The fast path exists because running a scan and a validation pass on a two-line
reply is both wasteful and actively harmful: it pushes the model towards
over-editing short conversational turns, which is itself an assistant tell.

## How to add a new humanizer project

The whole point of the design. Adding an upstream must mean adding one adapter and
touching nothing else.

1. **Check the licence first.** Read the actual `LICENSE` at the commit you intend
   to pin. No licence means `research-only`. See `THIRD_PARTY_NOTICES.md` §6.
2. **Add a manifest entry** in `upstreams/manifest.json` with the eight required
   fields, plus `integration`, `target_phase`, `copyright_holder`, `license_file`
   and, if it derives from something already tracked, `derived_from`.
3. **Copy the licence** byte-for-byte into `licenses/<SPDX>-<name>`.
4. **Write `src/upstream/adapters/<name>/index.ts`** exporting an
   `UpstreamAdapter`: its integration kind, status, target phase, capabilities
   and, when Phase 2 work begins, `extractRules`, `exportDetectors` or
   `exportVoiceProfiles`.
5. **Register it** in `src/upstream/adapters/index.ts`.
6. **Give its rules signatures**, not pattern numbers. Two upstreams that detect
   the same tell must emit the same signature, which is what makes the collapse
   automatic.
7. **Run `npm run typecheck && npm test`.** `tests/manifest.test.ts` and
   `tests/upstream.test.ts` assert that the adapter registry and the manifest
   agree exactly, so an orphan or a mismatch fails the build.

Nothing in `rules/`, `detector/`, `voice/`, `behavior/`, `rewrite/`,
`validation/` or `dsh/` needs to change.

## The adapter contract, and why it is split

`UpstreamAdapter` has three optional extraction methods because the corpus
genuinely has three shapes, and conflating them is what produces bad integrations:

| Method | For | Corpus examples |
| --- | --- | --- |
| `extractRules` | Markdown skills that must be **parsed** | blader, humanizer-zh, humanizer-zh-cn |
| `exportDetectors` | Upstreams with runnable detection logic | ai-humanizer, humanize-text, dsh-humanizer |
| `exportVoiceProfiles` | Upstreams modelling personal style | dsh-humanizer, humanizer-zh |

A Markdown skill has no detectors, and a detector project has no voice profiles.
Forcing one interface on both is where "just copy the files in" starts.

## Where original work lives

Section 14 of the brief is explicit that the suite must not be only an
aggregator. Everything attributed to `human-voice-suite/local` is ours:

| Capability | Location | Status |
| --- | --- | --- |
| Chat Behaviour Engine | `src/behavior/` | taxonomy ✓, detection Phase 5 |
| Conversation Behaviour Profile | `src/voice/types.ts` (`ConversationBehaviorFeatures`) | schema ✓, learning Phase 6 |
| Chinese Chat Fingerprint | `src/voice/types.ts` (`ChatVoiceFeatures`) | schema ✓, extraction Phase 6 |
| Assistant Smell Detector | `src/behavior/types.ts` | taxonomy ✓, detection Phase 5 |
| Protected Content Validation | `src/validation/protected-content/` | ✓ |
| Cross-upstream Rule Deduplication | `src/rules/dedupe/` | ✓ |
| Suppression policy | `src/detector/suppression.ts` | ✓ |
| Canonical signature vocabulary | `src/rules/canonical/signatures.ts` | ✓ |
| Rule extraction pipeline | `src/upstream/extract/` | ✓ |
| Rule-driven lexical detector | `src/detector/lexical/rule-driven.ts` | ✓ |
| Unified Voice Score | `src/voice/types.ts`, `src/detector/scan.ts` | partial ✓ |
| Unified Rewrite Contract | `src/rewrite/contract.ts` | ✓ |

The provenance system is what keeps this honest: a local rule has
`upstream: 'human-voice-suite/local'` in its sources and `isLocalOnly()` returns
true for it, so a report can always separate our work from inherited work.

Note that three of the entries above — the suppression policy, the signature
vocabulary and the extraction pipeline — are not rules or detectors at all. They
are the machinery that makes other people's work safe to use, which is what this
project actually contributes.

## Deliberate non-goals

- **Not a model proxy.** No LLM call anywhere in the suite.
- **Not a detector of AI authorship.** The scores measure the presence of known
  tells and the distance from a target voice. They are not, and must not be
  presented as, a probability that a machine wrote something.
- **Not a rewriter.** The suite produces a contract; the agent rewrites.
- **Not a vendoring tool.** No upstream source is copied into this repository.
  Adapters read the pinned clones; the clones are gitignored.
