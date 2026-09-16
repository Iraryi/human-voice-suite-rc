# The unified voice profile

Section 16 of the brief requires that a profile stop being "average sentence
length, punctuation, vocabulary" and start describing how a person *behaves* in
conversation. `src/voice/types.ts` implements that requirement, and Phase 6 built
everything behind it: `src/voice/fingerprint/` extracts, `src/voice/profile/`
stores and scopes, `src/voice/scoring/` measures distance, `src/voice/adaptation/`
blends and neutralises hazards, and `src/voice/import/` brings upstream material
in.

## Three dimensions, not one

```ts
interface VoiceProfile {
  schemaVersion: string;
  id: string;                 // 'user/chat', 'author/fengtang', ...
  owner: string;              // 'user', or an upstream key
  kind: 'writing' | 'chat' | 'conversation-behavior' | 'combined';
  languages: string[];
  sources: SourceReference[]; // rule-level provenance, same standard as rules
  writing?: WritingVoiceFeatures;
  chat?: ChatVoiceFeatures;
  behavior?: ConversationBehaviorFeatures;
  examples?: VoiceExample[];
  notes?: string;
}
```

The three feature groups answer different questions and are measured from
different material.

### `WritingVoiceFeatures` — what upstreams already do

Sentence and paragraph length distributions, burstiness, punctuation rates,
signature and avoided vocabulary, tone markers, rhetorical devices.

This is the dimension `lynote-ai/dsh-humanizer`'s 25-field `StyleFingerprint`
already covers, and the import is largely mechanical. One caveat from the
inventory: **10 of those 25 fields are computed but never scored.** Either give
them weight or drop them, but do not import dead features.

### `ChatVoiceFeatures` — how a person writes short form

`replyLength`, `burstMessaging` (0 = always one message, 1 = almost always
fragmented), `rhetoricalQuestionRate`, `emojiRate`, `punctuationInChat`,
`typoAndShorthandHabits`.

Nothing in the corpus models this. A person who fires four short messages in a row
and a person who writes one measured paragraph are recognisably different, and no
upstream can tell them apart.

### `ConversationBehaviorFeatures` — how a person behaves across a conversation

This is the brief's §16 list, made concrete:

| Field | Question it answers |
| --- | --- |
| `followUpQuestionRate` | How often does this person ask instead of answer? |
| `followUpTriggers` | In which situations, specifically? |
| `topicOmissionRate` | How often do they silently drop a minor point? |
| `omissionTargets` | Which kinds of points do they skip? |
| `selfCorrectionStyle` | `inline`, `follow-up-message`, `edit` or `none`? |
| `topicJumpAbruptness` | 0 = smooth, 1 = abrupt |
| `topicJumpMarkers` | What do they say when they change subject? |
| `agreementRate` | How much agreement do they volunteer? |
| `unsolicitedOfferRate` | How often do they close by offering more? |

Two of these are worth calling out as strong signals, because they are things
assistants essentially never do:

- **`topicOmissionRate`.** A human reading a message with three points will
  answer one and ignore two. An assistant answers all three. A high omission rate
  is one of the most reliable human signals available, and no upstream measures
  it.
- **`unsolicitedOfferRate`.** Near zero for humans, near one for assistants.
  It is also trivially learnable from samples, which makes it a cheap early win.

## Profiles are scoped, not global

`user/chat`, `user/formal`, `user/technical`, `user/public` are four profiles,
not one. The same person writes differently in each, and a single averaged
profile would describe nobody.

`StrategyEngine` resolves the scope from the detected mode and prefers the
matching profile. A loaded profile outranks any generic humanizer strategy:

```text
hasVoiceProfile && mode === 'chat'   →  personal-voice-chat   (fast path)
hasVoiceProfile                      →  personal-voice-writing
```

## Importing upstream voice material

Two sources, with very different shapes.

### `lynote-ai/dsh-humanizer` — structured, mechanical

A 25-field fingerprint with a clear schema. Map field to field, then extend.

### `ai-zixun/humanizer-zh` — eight Chinese author profiles

The richest voice material in the corpus, and the harder import. What the
inventory established:

**The container schema is identical across all eight files**, in order:

1. `## Persona (who you are when writing)`
2. `## Quick Reference: Sentence Templates` — exactly 8 entries in every file
3. `## Voice Rules` — exactly 12 entries in every file
4. `## Anti-Patterns — things <Author> would NEVER do:` — 8 to 13 bullets

Plus a line-1 `# 声音：<中文> (<Pinyin>)` title, `适用：`, `启用方式：`, a four-line
neutrality preamble, and `---` at line 10.

**But the fields inside are free-form prose.** There is no 成语 field, no taboo-word
field, no sentence-length field, no rhythm field. Those dimensions appear as bold
prose labels such as `MIX CLASSICAL AND VULGAR`, `SENSORY DETAILS`, `EMBED DATA`.
All eight are pure prose with no blockquote example passages.

So the parser is two-stage:

1. **Deterministic**, for the container. Split on `^## `, match headings
   **case-insensitively** on the stems `Persona`, `Quick Reference`, `Voice`,
   `Anti-pattern` — three of the eight use lowercase, and one anonymises the
   author to "this author". Split numbered entries on `^\d+\. `. Expect exactly
   8 templates and 12 rules per file and assert it.
2. **Normalising**, for the free-form dimensions. Map the bold prose labels onto
   the unified feature names, and flag anything that does not map instead of
   guessing.

Parse the header block **positionally**, not by content regex: the layout is
stable and a content regex will silently drop a field when an author writes
something unusual.

### What the eight files actually contain (measured, Phase 6)

The paragraph above was written in Phase 1 from reading the files. Phase 6
imported them, and two of its claims turned out to be wrong. The measured facts:

| Claim | Measured |
| --- | --- |
| Container is identical across all eight | **true** — 4 sections each, 8 templates and 12 rules each, 8–13 anti-patterns |
| Heading case varies | **true** — `Voice rules` and `Anti-patterns` in some files |
| Dimensions appear as bold prose labels | **true but rare** — bold labels appear in only **2 of 8** files: 12 in `helaoshi.md`, 6 in `liuzichao.md`. The other six state their rules as plain prose |
| The 李笑来 profile instructs inventing fake numbers | **true** — rule 6, and it is removed at import |

Consequence for the parser: it captures **every** bold span in an entry rather
than the first, because several of the labelled entries carry two. Consequence for
the profiles: six of the eight carry no mapped craft dimension at all, only rules,
anti-patterns and sentence templates. That is an accurate description of the
source, not a gap in the import.

Two of the 66 labels do not map onto the vocabulary
(`"再说一遍" for emphasis`, `"坐好了/坐稳了" anticipation markers`, both
`helaoshi`). They are reported in `author-voices.generated.json` under
`unmappedLabels` and their rule text is still carried as a directive. They are
**not** forced into a dimension: growing the vocabulary to make a count reach zero
is exactly the guessing this design forbids.

### Two hazards that must be neutralised before import

1. **The 李笑来 profile instructs inventing plausible fake numbers** when real
   data is unavailable. This directly contradicts the no-invention rule that
   every other part of the corpus depends on and that `UNIVERSAL_FORBIDDEN`
   enforces. Import it and the suite will teach a model to fabricate. **Handled:**
   `HAZARD_PATTERNS` in `src/voice/adaptation/index.ts` removes it, the removal is
   recorded in the generated profile's `notes`, and a test pins the exact sentence
   — the first version of the pattern missed it, because the upstream writes
   "invent a plausible specific *one*" and the pattern only listed nouns.
2. **All eight instruct writing as a named living author.** MIT covers the
   profile text. It does not settle publicity or personality rights. That is a
   product decision, not a licensing one, and it must be made explicitly rather
   than inherited by default. **Decided:** the suite imports *habits and craft
   instructions*, never a persona claim. Any line that tells the model to be
   someone is dropped, the profiles are `author/<key>` and opt-in, and each one's
   `notes` records that the rewrite contract must not claim authorship. The
   upstream neutrality preamble is kept verbatim on every profile.

## What a profile is not

- Not a clone. It records measurable habits, not a persona to perform.
- Not globally applied. A profile is selected by scope and mode.
- Not licence-free. Imported profiles carry `sources` exactly like rules do, so
  a report can always say where a profile came from.
- Not a source of invented numbers. An imported qualitative profile carries an
  **empty** `sentenceLength` and `burstiness`, because no sample passage exists in
  the source to learn them from. `validateProfile` refuses a distribution that has
  `sampleCount: 0` and a non-zero mean, so this cannot drift.

## Where the number comes from, and where it does not

`voiceScore` is the weighted mean of the dimensions a profile supports, and every
dimension reports `measured`. A text with one paragraph has no comparable
paragraph-length distribution; a chat profile compared against prose has no reply
length. Those dimensions are excluded and listed rather than scored as perfect,
and a comparison with nothing measurable in it reports `unmeasured` instead of 1.

An imported author voice therefore contributes **nothing** to `voiceScore` — it
has no distributions to compare against — and everything to the rewrite contract
through `directives`. That split is deliberate: `docs/behavior-engine.md`'s
principle that a number must be derived from a measurement applies to the voice
layer too.

The weights, and why they are what they are:

| Dimension | Weight | Why |
| --- | --- | --- |
| `sentenceLength` | 0.25 | the most stable habit, and the cheapest to measure honestly |
| `punctuation` | 0.20 | mix first (0.75 of the dimension), density second — Phase 8 rebuilt this after it fired on 77% of the benchmark corpus |
| `signatureVocabulary` | 0.20 | discounted on short texts, where a writer has had no room to use their own words |
| `burstiness` | 0.15 | — |
| `avoidVocabulary` | 0.15 | only present when a profile declares one; it cannot be learned from positive samples |
| `paragraphLength` | 0.10 | needs at least three paragraphs to mean anything |
| chat and behaviour dimensions | 0.05 each | coarse by construction, and marked as such in their `detail` |
