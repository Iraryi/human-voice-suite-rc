# Phase 8: what the benchmark changed

Phase 8 is the only phase whose output is *deletions*. The rule set was built
from seven upstream repositories and every rule in it had a source; the benchmark
then measured which of them behave badly on real text. Four rules were changed as
a result, one slot that had no detector behind it was built, and the fourth score
was exercised for the first time — which found defects in it, in the extractor
that feeds it, and in a threshold the upstream's own note contradicted.

This document is the record. Every change states what was measured before, what
was measured after, and how the two numbers were obtained, because a threshold
changed on intuition is indistinguishable from a regression six months later.

Thirteen changes are recorded below. Nine of them (`5`–`13`) came from following up on
the earlier ones with the same method, which is the part of this document worth
copying: each round's leftover diagnosis became the next round's measurement.

## The comparison method

The before and after numbers come from two stored runs, compared over the samples
they have in common:

```bash
npm run bench:run                                  # before the change
# ... edit ...
npm run bench:run                                  # after
npm run bench:compare                              # same samples, per rule
npm run bench:ablation                             # what each layer adds
```

`bench:compare` intersects the sample ids and reports how many samples it
excluded. The corpus grew from 56 to 60 samples between the first and second run
(technical-writing was filled in), so the comparison is restricted to the 56
samples present in both. Without that restriction the difference would partly be
the corpus, which is not a comparison.

| | |
| --- | --- |
| Before | `benchmarks/runs/2026-09-15T21-38-06-596Z-54c511ce.json` (56 samples) |
| After | `benchmarks/runs/2026-09-15T21-43-23-916Z-f0d1dd60.json` (60 samples) |
| Compared | 56 samples, 4 excluded (new technical samples) |

## Change 1 — `rhythm.repeated_openings` was counting list items

**Symptom.** The rule fired on 6 of 56 samples and 4 of those were human-written.
Probing them showed the same message every time:

```text
[rhythm] rhythm.repeated_openings sev=3 conf=0.85 — 3 consecutive sentences open with "- ".
    "- 本次会话还没询问过 voice adoption。"
```

**Diagnosis.** `splitSentences` treats a newline as a sentence terminator, so each
bullet in a Markdown list became a "sentence", and every bullet opens with `- `.
The rule was measuring the shape of a list and calling it prose rhythm. In
`en-prose-0003` the same thing happened with `**Clarity:**`-style bold labels,
which the structural rules already charge for — so the finding was also a second
deduction for one tell, which this project forbids.

**Fix.** `LEADING_MARKUP` in `src/detector/rhythm/index.ts`: a sentence that
begins with a list marker, an ordered-list marker, a heading, a blockquote or a
bold label is not a prose sentence and does not participate. The finding message
now says how many items were skipped, so a reader can see the rule's own
reasoning.

**Result.**

| | Before | After |
| --- | --- | --- |
| Samples where it fired | 6 / 56 | 2 / 56 |
| Human-written samples | 4 | 0 |
| Prose repetition (synthetic control) | fires | **still fires** |

The synthetic control matters more than the reduction. A fix that silences a rule
is not a fix, so `tests/benchmark.test.ts` asserts both directions: `It's not the
tool. It's not the team. It's not the budget.` still produces a finding, and a
three-item bullet list does not.

## Change 2 — punctuation distance charged texts for marks they had no room to use

**Symptom.** `stylometry.fingerprint_punctuation` was the loudest rule in the
corpus: **43 of 56 samples**, including 7 human-written ones. A rule that fires on
three-quarters of everything is a fire alarm nobody reads.

**Diagnosis.** The old measure was `Σ|a−b| / Σ(a+b)` over the union of marks
present in either the text or the profile. For a one-line chat reply, every mark
in the profile that the reply does not use contributes its full profile rate to
the numerator. The measurement was mostly reporting *length*, not habit. Probing a
typical case:

```text
punctuation  0.611  w=0.2  punctuation rates 39% apart across 9 mark(s)
```

Nine marks compared, on a reply of about ten tokens.

**Fix.** `comparePunctuation` in `src/voice/scoring/index.ts` splits the question
in two:

1. **Mix**, weighted 0.75: total-variation distance over renormalised shares,
   restricted to the marks *this text* uses. Length-independent by construction.
2. **Density**, weighted 0.25: total marks per 1000 characters against the
   profile's, compared as a log ratio with a ×2 tolerance, because punctuation
   density genuinely varies with register.

**Result.**

| | Before | After |
| --- | --- | --- |
| Samples where it fired | 43 / 56 | 8 / 56 |
| Human-written samples | 7 | 1 |
| Mean `voiceScore` over the compared samples | 0.77 | 0.81 |

The mean `voiceScore` *rose*, which is the correct direction for a measure that
was over-charging: the dimension stopped removing score for a text being short.

## Change 3 — vocabulary absence and avoided-term presence were the same finding

**Symptom.** `stylometry.fingerprint_vocabulary` fired 21 times, 4 on
human-written samples, always at severity 3 with the same message shape:

```text
Signature vocabulary is off the profile bench/zh: 0 of 3 expected signature term(s) present.
```

**Diagnosis.** The rule's own guidance says *"Absence of a signature term is
weaker evidence than presence of an avoided one, and the finding says which case
it is."* The implementation did neither: both cases produced one message and one
severity, and the "expected terms" formula asked a 40-unit text for 3 of the
writer's habitual words, which is a coin toss rather than a measurement.

**Fix.** `src/detector/stylometry/index.ts` splits the two:

| Case | Severity | Confidence | Message |
| --- | --- | --- | --- |
| A term the profile records as avoided appears | rule + 1 | base + 0.2 | "A term this writer never uses appears" |
| None of the writer's vocabulary appears | rule − 1 | base | "…Weak evidence on its own — the text may simply be about something else" |

and `DIMENSION_THRESHOLDS` raises the bar for absence (0.6) above the bar for
avoidance (0.3), leaving sentence length at the original 0.3 because it is a
stable measurement rather than a subject-dependent one.

**Result.**

| | Before | After |
| --- | --- | --- |
| Samples where it fired | 21 / 56 | 16 / 56 |
| Human-written samples | 4 | 2 |

## Change 4 — a voice distance could vouch for a prose tell

**Symptom.** Not a firing count. After changing the punctuation measure, six
*other* rules changed their firing too — `rhythm.dash_overuse`, `lexical.adverb_filler`,
`rhythm.uniform_rhythm`, `formatting.excessive_structure` and two more all lost
findings on model-generated samples.

**Diagnosis.** `applySuppression` counted every non-weak-alone rule that fired
anywhere in the text as corroboration for a weak-alone rule. That let a
voice-distance finding — which says only *"this is not that writer"*, a statement
true of almost all text — vouch for a tell that `blader/humanizer` deliberately
gated. Removing a noisy voice rule therefore silently changed which prose tells
survived, which is how the coupling was found at all.

**Fix.** `nonCorroboratingRuleIds` in `src/detector/suppression.ts`: rules tagged
`voice` may be suppressed but may never corroborate. `scan.ts` passes them from
the registry, so the separation is data rather than a hard-coded list.

**Result (over the same 56 samples).**

| Rule | Before | After |
| --- | --- | --- |
| `lexical.adverb_filler` | 3 | 1 |
| `rhythm.dash_overuse` | 2 | 0 |
| `rhythm.uniform_rhythm` | 6 | 4 |
| Findings lost on human-written samples | — | **0** |

**This is a trade-off, and it is recorded as one.** Six findings on
model-generated text disappeared and none on human text. The honest reading is
not "detection got worse": those findings were only surviving because a spurious
punctuation finding vouched for them. But the corollary is a real diagnosis worth
carrying forward:

> `rhythm.dash_overuse` is gated **twice**. Its detector already requires an
> absolute floor of 3 dashes *and* a per-1000 rate, which is exactly blader's own
> condition ("one dash is weak alone; a text full of them is not"), and the
> canonical vocabulary then marks the rule `weakAlone` again, so suppression
> demands corroboration on top. One of the two gates is redundant.

That is left unfixed on purpose. Removing the `weakAlone` flag means editing the
curated signature vocabulary, and the vocabulary documents that nothing is added
or removed on intuition. The next round should test whether dropping it restores
the two dash findings *on text that genuinely overuses dashes*, with the same
before/after discipline. It is not a change to make on the strength of two
samples.

## Change 5 — a catalog slot had no detector behind it

**Symptom.** Not a firing count either. `BENCHMARK_RESULTS.md` §7 lists which
canonical rules the corpus exercises, and `chinese.translationese` was exercised
by nothing — because it was not a rule at all.

**Diagnosis.** Phase 1 declared `chinese.translationese` as a catalog slot with
`status: 'partial'`, and nothing ever answered to it. The connective half of the
tell was charged to `lexical.translationese_connective`, and the register half —
的的不休, 被字句 overuse, light-verb constructions, abstract-noun suffixes,
redundant pronouns — had no detector. The catalog was advertising a capability
that did not exist, and the `partial` status made it look deliberate.

The benchmark surfaced it in a roundabout way: a `translated-chinese` category was
added so the rule would have something to fire on, and the rule fired on none of
the six samples.

**Fix, and the measurements it was built on.** Before writing a threshold, every
Chinese sample in the corpus was measured. 的 per 100 CJK characters:

| Group | 的 per 100 |
| --- | --- |
| Translated positives (`zh-tran-0001`…`0004`) | 8.21, 8.65, 9.83, 11.55 |
| Negative control (`zh-tran-0005`) | 1.96 |
| Hand-fixed revision (`zh-tran-0006`) | 1.64 |
| Every other zh sample, highest (`zh-prose-0001`) | 6.10 |

`TRANSLATIONESE_DE_DENSITY = 8` sits in that gap with roughly 30% clearance on
both sides, and `TRANSLATIONESE_MIN_CJK = 120` keeps the density from being read
off a short text. 的 density is the **anchor, not the finding**: at least one
corroborating signal is required (被 ≥ 2, 进行/作出 ≥ 3, `-性/-化/-度` ≥ 6,
它/他们 ≥ 6), because a register is not a defect and a text that uses 的 a lot is
not a bad text.

**Result.**

| | Before | After |
| --- | --- | --- |
| `chinese.translationese` firings | 0 on 60 samples | **4**, exactly the four translated ones |
| Clean control (`zh-tran-0005`) | nothing fired | nothing fires |
| Hand-fixed revision (`zh-tran-0006`) | nothing fired | nothing fires |
| `antiAIScore` on the positives | 0.93–1.00 | 0.74–0.94 |
| `antiAIScore` on control and revision | 1.00 | 1.00 |
| Canonical rules | 86 | 87 |
| Catalog slots still unbuilt | 1 (`partial`) | **0** |

`tests/translationese.test.ts` pins the calibration rather than a fixture: it
asserts that the four positives clear the threshold, that every other Chinese
sample in the corpus does not, that the gap is wider than 1.5, and that the
control and the revision stay clean on all five signals. A fixture would only
restate the numbers; the corpus is where they came from.

**What this does not claim.** The thresholds are calibrated on six purpose-built
samples. That is enough to separate translated register from native register on
this corpus and is not a corpus study. The margin is wide and the control is
clean, so the direction is solid; the exact value of 8.0 is not.

## Change 6 — the fourth score had never been exercised, and it was wrong

**Symptom.** `preservationScore` was reported as unmeasured in every run, because
it needs a candidate rewrite and none had been recorded. Six were written and
recorded under `benchmarks/candidates/`, and the first one to run reported
**0.00** on a rewrite that had in fact preserved everything.

**Diagnosis.** Two extractor defects, both in
`src/validation/protected-content/extract.ts`:

1. **The proper-noun pattern crossed newlines.** `\s` matches `\n`, so a heading
   and the first capitalised word of the paragraph beneath it were captured as one
   name: `"Strategic Negotiations And Global Partnerships The"`. That artefact was
   then a protected item almost no honest rewrite can keep — it requires
   reproducing a heading immediately followed by the same first word.
2. **The identifier pattern sliced fragments out of words.** Without a
   lookbehind, the camelCase branch matched from the second letter, because
   `[a-z]+` cannot start at a capital: `OpenClaw` was captured as `penClaw` and
   `GitHub` as `itHub`. A fragment can never be kept by a rewrite that drops the
   word, so it silently depressed the score for a correct rewrite.

**Fix.** Horizontal whitespace in the proper-noun pattern; a negative lookbehind
plus an initial-capital branch in the identifier pattern; and a new `itemCount` on
`PreservationCheck`, so a text with nothing to preserve reports `unmeasured`
rather than a perfect 1 — the same distinction `VoiceScoreSet.unmeasured` draws
one layer up.

**Result.**

| Sample | Before | After |
| --- | --- | --- |
| `en-prose-0002` (faithful rewrite) | **0.00** — reported as total loss | 1.00, nothing to preserve |
| `en-tech-0001` (faithful rewrite) | 0.92 — one bogus item "lost" | 1.00 |
| `zh-tech-0001` (deliberately drops a URL) | 0.95 | 0.95 — still caught |

The third row is the one that matters: `benchmarks/candidates/README.md` records
that this candidate drops a URL **on purpose**, as the control showing the
preservation check has teeth. A benchmark that only ever records candidates that
preserve everything cannot show that the score detects anything.

## Change 7 — the dash rule was gated twice, and the upstream says it should not be

**Symptom.** Change 4 removed a voice-distance rule's ability to corroborate a
prose tell, and `rhythm.dash_overuse` lost two findings as a side effect. That was
recorded as a trade-off with a diagnosis attached: the rule was gated twice.

**Diagnosis, confirmed against the upstream's own words.** blader's note on its
pattern 8 reads:

> Many editors and journalists use dashes, so one dash is *weak alone*; **a text
> full of them is not**.

That is a condition, not a caveat. Our detector implements exactly it —
`MIN_DASHES = 3` plus a per-1000 rate — and then the canonical vocabulary marked
the rule `weakAlone` anyway, so suppression demanded two corroborating rules for
a finding that had already established the thing the upstream says removes the
weakness.

All five patterns blader marks weak alone were checked one by one, because the
obvious worry is that the same argument applies to each:

| Pattern | Upstream note | Weak alone? |
| --- | --- | --- |
| 8 dashes | "one dash is weak alone; a text full of them is not" | **no** — the exception is the condition |
| 9 stacked qualifiers | "*Weak alone.*" | yes |
| 10 hyphenated pairs | "*Weak alone.*" | yes |
| 11 passive / missing subjects | "*Weak alone.*" | yes |
| 21 curly quotes | "Most editors auto-curl, so this is *weak alone*" | yes |

Pattern 8 is the only one whose note contains an exception, so it is the only one
changed. The other four keep the flag.

**Result, over the same 66 samples with no corpus change.**

| | Before | After |
| --- | --- | --- |
| `rhythm.dash_overuse` firings | 0 | **2** |
| Which samples | — | `zh-talk-0010`, `en-talk-0010`, each with four dashes in a short reply |
| Human-written samples affected | — | **0** |
| Other rules affected | — | **0** |
| Weak-alone rules | 21 | 20 |

`weakAloneSources` still records that blader makes the claim. What was removed is
the override, and the reason travels with the rule in `signatures.ts`.

## Change 8 — a heading was being treated as a proper noun

**Symptom.** Change 6 fixed two extractor defects and brought the first faithful
candidate to 1.00 — for one sample. A second was still at 0.00, and this time the
protected item was correct by the extractor's rules and wrong by intent:

```text
LOST [proper-noun] "Strategic Negotiations And Global Partnerships"
LOST [proper-noun] "Challenges and Legacy"
```

**Diagnosis.** Both are headings. A title-cased heading is a capitalised sequence,
so the proper-noun extractor captured it — and a rewrite whose entire job is to
remove AI title-case formatting was then forbidden from touching the title. The
second is a bare line with no `#` markers, which is what a model emits when it
drops them; it is still a heading.

**Fix.** `isHeadingLine` in `src/validation/protected-content/extract.ts`,
excluding two shapes from the **proper-noun pass only**: a `#`-prefixed line, and
a line containing nothing but capitalised words. Numbers, URLs, code and
identifiers inside a heading stay protected, which a test pins.

**Result.**

| Sample | Before | After |
| --- | --- | --- |
| `en-prose-0002` (nothing but headings to protect) | 0.00 — reported as total loss | `unmeasured` — nothing to preserve |
| `en-tech-0001` | 0.92 | 1.00 |
| `zh-tech-0001` (planted URL drop) | 0.95 | 0.95 |

The price is stated rather than hidden: a real name appearing *nowhere* but a
heading is no longer extracted. That is smaller than making every title in every
document immutable, and names inside prose — where they carry meaning — are
unaffected.

## Change 9 — the fourth score got coverage, and controls

Change 6 exercised `preservationScore` on one sample. Eleven candidates are now
recorded, covering the samples where losing a value costs most: human-written
Chinese and English, a 23-item protected list in a formal Chinese document, and a
19-item technical one.

| | Before | After |
| --- | --- | --- |
| Samples with a measurable `preservationScore` | 4 | **7** |
| Faithful candidates at 1.00 | 2 | **5** |
| Planted failures caught | 1 (`url`, severity 4) | **2** — plus an `identifier`, severity 5 |
| Mean `preservationScore` | 0.74 | **0.98** |

The mean is not the point; the controls are. One candidate drops a URL and one
alters the last character of a commit hash, and both are disclosed in
`benchmarks/candidates/README.md`, in the run output and in the report. The hash
is the more damaging kind of loss — nobody reconstructs it from context — which is
why it carries the highest severity, and until this candidate existed that branch
had never been exercised either.

`BENCHMARK_RESULTS.md` §7 is new as a result: for every sample with a candidate it
shows the original's four scores against the rewritten text's. That is the only
table in the document that speaks to whether the *contract* works rather than
whether the detectors do, and its sample size (7) is printed next to it.

## Change 10 — a bracketed list was compiled as a wildcard, and it produced a severity-5 false positive

**Symptom.** The report's false-positive list named two rules firing on
human-written samples. One was the mention-vs-use gap (recorded, not fixed — see
`docs/behavior-engine.md`). The other was
`assistant.knowledge_limit_disclaimer` at **severity 5**, the highest there is,
on `en-prose-0006`.

**Diagnosis.** Probing the sample showed the evidence span was `"likely t"`:

```text
[assistant] assistant.knowledge_limit_disclaimer sev=5 conf=0.7 — 1 construction match(es)
            across 1 template(s): likely [grew up, studied, began]
    "likely t"
```

The template comes from blader's own watch list, which reads *"…likely [grew up,
studied, began], it is believed that"*. Read in context that is the upstream
**enumerating the verbs it means** — the shape a model uses when it guesses at a
biography. The template compiler treated every bracketed group as a slot and
compiled this one to a wildcard, so `likely` followed by anything matched. In
`en-prose-0006` it matched "most likely to come next".

**Fix.** A comma inside the brackets now means alternatives, and a single token
means a slot. `as of [date]` keeps matching any date; `likely [grew up, studied,
began]` matches the three shapes the upstream named and nothing else.

**Result.**

| | Before | After |
| --- | --- | --- |
| `assistant.knowledge_limit_disclaimer` on `en-prose-0006` | fires, severity 5 | **does not fire** |
| `behaviorScore` for that sample | 0.77 | **1.00** |
| Severity-5 false positives in the run | 1 | **0** |
| `as of [date]` still matches "as of March 2024" | yes | yes |

Only one template in the whole corpus has a bracketed comma list, so the blast
radius was one rule and one sample — which is also why it survived seven phases:
nothing else was in a position to notice.

## Change 11 — two ordinary Chinese phrases had been imported as tells

**Symptom.** The first false-positive measurement on real human writing
(`benchmarks/external/`) reported 18 firings across 738 genuine replies. Two of them
had matched a phrase that is simply ordinary Chinese:

| Rule | Phrase | Meaning | Firings on human writing |
| --- | --- | --- | --- |
| `assistant.knowledge_limit_disclaimer` | `大概率` | "in all likelihood" | 3 |
| `lexical.aphorism_dressing` | `这件事` | "this matter" | 1 |

**Diagnosis.** `isTooCommonToMatch` already refuses Chinese phrases shorter than
three characters, on the stated reasoning that *"three characters is the shortest
length at which a Chinese phrase starts to be specific"*. Real text disagrees: three
is also the length of plenty of everyday words. A colloquial hedge was standing in
for a rule about *dressing up a gap in the sources*, and a noun phrase for a rule
about *aphorism dressing*.

**Fix.** A `COMMON_CJK_PHRASES` set beside the existing English `COMMON_WORDS`, so a
phrase can be rejected for being ordinary at any length. Only phrases with a
measurement behind them are listed: `不排除` sits in the same rule as `大概率` and is
the same kind of word, and it is deliberately absent because it fired zero times. A
list that grows by reasoning from a class rather than from an observation is how the
length rule got here.

**Result.**

| | Before | After |
| --- | --- | --- |
| Human replies with a tell | 18 of 738 (2.4%) | **15 of 738 (2.0%)** |
| `assistant.knowledge_limit_disclaimer` on human writing | 3 | **0** |
| `lexical.aphorism_dressing` on human writing | 2 | 1 — `本质上` kept, because the rule's English list carries `fundamentally` for the same reason |
| Tells per 1000 characters, human / generated | 0.59 / 3.20 | 0.51 / 3.39 |
| **Committed benchmark corpus** | — | **unchanged: 0 samples, 0 rules** |

The last row is what justifies the change. `bench:compare` over the full 66-sample
corpus reports no difference at all, so these two phrases never once fired on the
model-generated control: they were false positives on real human writing only, and
removing them cost nothing.

## Change 12 — mirroring asked the question in one direction only

**Symptom.** The behaviour measurement on real turn pairs — 263 human against 14
model-generated — flagged **23 of the human pairs (8.7%)** with
`chat.mirrors_user`, against **1 of 14** generated. A rule about assistant behaviour
firing seventeen times more often on human writing than on generated text is the
wrong way round, and at 263 pairs it is no longer noise.

**Diagnosis.** The measure had one condition and needed two. It asked what share of
the *reply's opening* appears in the user turn:

```text
ratio = shared / openingTokens   →  fire when ≥ 0.6
```

On its own that is one-sided, because **a long turn contains almost everything**. A
forum topic of two hundred words shares vocabulary with any reply about it, so the
ratio is high for a reason that has nothing to do with restating. The tell is that
the reply duplicates *the turn*, which means the overlap must also be a large share
of the turn — and that is only possible when the turn is short, which is exactly the
chat case the rule is for.

**Fix.** A second condition beside the first, in
`src/behavior/assistant-smell/index.ts`:

```text
ratio    = shared / openingTokens  ≥ 0.6   (unchanged)
coverage = shared / userTokens     ≥ 0.5   (added)
```

**Result.**

| | Before | After |
| --- | --- | --- |
| `chat.mirrors_user` on 263 human turn pairs | 23 (8.7%) | **2 (0.8%)** |
| `chat.mirrors_user` on 14 generated pairs | 1 | **1** — the true positive is kept |
| **Committed benchmark corpus** | — | **unchanged: 0 samples, 0 rules** |
| Assistant-shaped human pairs | 1 of 263 (0.4%) | 1 of 263 (0.4%) |

The committed-corpus row is the interesting one again, and this time it says
something uncomfortable: `chat.mirrors_user` fires on **none** of the 66 benchmark
samples. Before the fix it fired almost exclusively on real human text, so the rule
was contributing false positives and nothing else. After the fix it is rare and
correct as far as this data can tell — but it is *rare*, and tuning it **up** needs a
corpus where mirroring is known to be present, which does not exist here. That is
recorded rather than papered over by lowering a threshold until something fires.

## Change 13 — a run of punctuation was counted as repeated sentence openings

**Symptom.** The first LCCC-base evaluation — 30,000 sessions, 85,925 utterances,
55,925 turn pairs, run under the isolated evaluation exception in
`benchmarks/external/README.md` — produced exactly one rule firing more on human
dialogue than on generated text:

| Rule | LCCC /1000ch | V2EX /1000ch | Generated /1000ch | LCCC ÷ generated |
| --- | --- | --- | --- | --- |
| `rhythm.repeated_openings` | 0.57 | 0.15 | 0.09 | **6.2×** |

That is 1,123 firings: the largest human false-positive source in the whole
measurement.

**Diagnosis.** Every firing was punctuation. Probing the repeated opening token
directly:

```text
lccc: 163 firing(s)   "。" 52   "！" 41   "." 34   "…" 16   "？" 13   …
```

Not one was a word. `splitSentences` keeps the terminator on the sentence it closes —
correct for measuring rhythm — so a run of terminators becomes a run of snippets each
consisting of a single `？` or `。`. That is how people type (`真的吗？？？？`), and three of
them in a row satisfied "three consecutive sentences open with 。".

**Fix.** A sentence with no word character in it is not a sentence. One line in
`isProseSentence`, beside the Phase 8 markup exclusion:

```ts
return WORD_CHARACTER.test(trimmed);   // \p{Script=Han} | A-Za-z0-9
```

**Result.**

| | Before | After |
| --- | --- | --- |
| `rhythm.repeated_openings` on LCCC-base | 1,123 | **~17** |
| LCCC utterances with any tell | 1.3% | **0.0%** (23 of 85,925) |
| LCCC tells per 1000 characters | 0.57 | **0.01** |
| `rhythm.repeated_openings` on the V2EX corpus | 40 | **6** |
| V2EX replies with a tell | 1.9% | **1.2%** |
| Rules screened as firing more on human than generated text | 1 | **0** |
| **Committed benchmark corpus** | — | **unchanged: 0 samples, 0 rules** |

The committed-corpus row is the one the exception requires. A defect found through a
corpus this project cannot redistribute is a hypothesis until it is re-measured on the
corpora it *can* ship, and `bench:compare` reports no change at all: the benchmark
corpus contains no run of punctuation long enough to have been affected.

The test that pins it is synthetic — a run of `？` across three lines — because the
corpus that found the defect cannot be committed alongside it.

## What did not change, and why

- **`chinese.translationese_connective` keeps its `lexical` id and family.** The
  Phase 3 precedent is to file Chinese-specific lexical tells under `chinese` —
  `lexical.noteworthy_filler` was renamed for exactly that reason — so a rename
  here would be consistent. It is not done in this round because it moves a rule
  id that phrase ownership, aliases and the extraction maps all reference, and
  because the two rules are genuinely different things: one is a lexicon, the
  other a register. The catalog slot names both by their real ids.
- **The 21 remaining weak-alone rules stay gated.** The benchmark measured them
  firing rarely, which is what the gate is for; there is no evidence to loosen
  it.
- **`assistant.knowledge_limit_disclaimer` fired once on a human-written English
  sample.** One firing out of 11 human samples is not enough to change an
  upstream rule, and the sample in question is a documentation excerpt where the
  disclaimer shape appears legitimately. Recorded in `BENCHMARK_RESULTS.md` §6
  rather than acted on.
- **The three meta-discussion samples stay in the corpus.** They name the tells
  while discussing them (`en-formal-0001` lists rule names; `zh-formal-0001`
  quotes 赋能 and 值得注意的是). They produce findings that have to be explained,
  and the explanation is that the suppression policy cannot yet tell a quotation
  from a use — a known gap in `docs/behavior-engine.md`, not a rule defect.

## The number that justifies the phase

`stylometry.fingerprint_punctuation` went from firing on **77% of the corpus** to
**14%**, and the human-written false positives from **7 to 1**, while the mean
`voiceScore` moved *up* from 0.77 to 0.81. A rule that fires on nearly everything
carries no information; the suite is measurably more informative for having made
it quieter, and the ablation table in `BENCHMARK_RESULTS.md` §5 is what shows it.

The other end of the same ledger: **the catalog no longer advertises anything it
cannot do.** Every slot has a detector, the last one was built from measurements
rather than intuition, and the score that had never been exercised turned out to
have two defects in it that only a real rewrite could expose.

## Reproducing these numbers

```bash
npm run upstream:check                 # populate the read-only cache
npm run bench:run -- --candidates benchmarks/candidates
npm run bench:ablation
npm run bench:report
npm run bench:compare -- --before <run> --after <run>
npm run bench:probe -- --rule rhythm.repeated_openings
```

The run files these figures came from are named in
`BENCHMARK_RESULTS.md`'s header table. They are gitignored — a run is large and
repeatable — so a reader who wants to check a specific number regenerates it,
which is why every command above is deterministic and offline.




