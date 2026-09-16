# Benchmarks

The design is here; the harness, the corpus and the first results are in
`benchmarks/`, `benchmarks/corpora/` and `BENCHMARK_RESULTS.md`.

The purpose of this directory is not to produce a headline number. It is to
answer three questions that cannot be answered by inspection:

1. **Does each layer actually do anything?** Measured by ablation, not by
   testing the full stack and declaring victory.
2. **Which layer fails on which input?** Measured by reporting four scores
   separately, across categories, rather than one blended figure.
3. **Does the suite beat a lexical-only approach on the case that matters most?**
   That case is AI pretending to be casual.

Sections 1, 3–7 are the specification the harness satisfies. Section 2 is the
falsifiable claim, and it has been **revised once, after the first run, to say
what is actually testable**; the revision is recorded in place rather than
quietly dropped.

## 1. Why the categories are what they are

Section 20 of the brief lists eight categories. Each one exists to expose a
specific way the suite could be wrong.

| Category | What it tests | The failure it exposes |
| --- | --- | --- |
| Chinese prose | Chinese rule coverage on long-form text | translationese rules firing on correct formal Chinese |
| English prose | The origin lineage's rules on their home ground | over-firing on legitimate formal English |
| Chinese chat | Behaviour fitting without a prose pipeline | treating a short turn as if it were an essay |
| English chat | Same, in the other language | behaviour rules tuned only for Chinese |
| Formal writing | The suppression policy | rewriting passive voice and hedges that are correct here |
| Technical writing | Protection of precision | rhythm rewriting damaging identifiers or code |
| **Translated Chinese** | `chinese.translationese`, which the first run showed had **no corpus coverage at all** | translated register read as AI register, or the rule never firing |
| **AI pretending to be casual** | **The hard case** — see §2 | **lexical detection reporting success while behaviour is still machine-shaped** |
| Real human chat | False positives | flagging genuine human writing as AI |

The translated-Chinese category was added after the first run, and the reason is
worth recording: `BENCHMARK_RESULTS.md` §7 lists which canonical rules the corpus
exercises, and `chinese.translationese` — a rule the suite ships as `partial` —
was exercised by nothing. A rule with no corpus coverage is untested against real
text, and the benchmark's own output is what surfaced it.

## 2. The hard case: AI pretending to be casual

This is the category the whole behaviour engine exists for, and the one a
lexical-only suite fails.

```text
哈哈，确实挺离谱的！不过从另一个角度来看，这背后其实反映了……
```

Every word here is casual. `哈哈` and `确实` are exactly what a human writes.
A lexicon-based detector sees informal vocabulary, no AI buzzwords, no em dashes
and no bold, and scores it clean.

But the behaviour is unmistakably an assistant:

- it opens by **mirroring and agreeing** (`确实挺离谱的`)
- it pivots with a **staged contrast** (`不过从另一个角度来看`)
- it **inflates significance** instead of saying something (`这背后其实反映了`)
- and it is about to produce a fully-formed, symmetric, over-complete answer to
  a throwaway remark

### The falsifiable hypothesis

> A lexical-only detector scores "AI pretending to be casual" as
> **more human than real human chat**.

If that hypothesis does not hold, the behaviour engine is not earning its place
and should be cut. The benchmark must therefore report lexical-only and
full-stack results **side by side** on this category, not only the full-stack
result. A benchmark that only reports the full stack cannot falsify anything.

### What a correct result looks like

| Layer | Expected `antiAIScore` | Expected `behaviorScore` |
| --- | --- | --- |
| Lexical detectors only | high (looks clean) | not measured |
| Behaviour engine only | not measured | low |
| Full stack | moderate | low |

The interesting cell is the first one: a high `antiAIScore` alongside a low
`behaviorScore` is the signature of a suite that is working — it has detected
that the prose is fine and the behaviour is not.

If `behaviorScore` fails to separate this category from real human chat, the
assistant-smell taxonomy needs revision, not more rules.

### Revision after the first run (2026-09-15)

The hypothesis was written when the corpus was a plan. Two things it assumed
turned out to be unavailable or wrong, and the record is kept here because a
specification that silently changes to match its results is not a specification.

**1. "Real human chat" does not exist in the corpus.** No offline source of
genuine human chat with a clear licence was available, and inventing samples and
labelling them human would have made the false-positive measurement meaningless.
`benchmarks/corpora/real-human-chat/NOT_POPULATED.md` records the decision. The
control in the run is therefore human-written prose, which is weaker: prose is
not chat, and a lexical detector is expected to be harder on prose than on a
casual one-liner.

**2. The claim does not hold, and the reason is more interesting than the
claim.** The first run measured it (`BENCHMARK_RESULTS.md` §3):

- `antiAIScore` for AI-pretending-casual: **0.96**.
- `antiAIScore` for human-written text: **0.97–1.00**, higher than the subject in
  every category.
- Rank separation: **0.42 pooled, 0.33–0.50 per category** — at or below chance.

So a lexical view does call AI-pretending-to-be-casual clean, which is half the
claim, but it does not call it *cleaner than human writing*. Both groups sit near
the ceiling: on this corpus the lexical layer is close to **blind** on this
category in both directions, and no threshold on `antiAIScore` could separate the
groups.

What the run does support is the claim the layer actually needs:

- `behaviorScore` for AI-pretending-casual: **0.84**, against **0.98–1.00** for
  human writing, separating in **4 of 4** categories at 0.17–0.31.
- `antiAIScore` does not move when the voice or behaviour layers are added
  (Δ ≤ 0.01), which is the ablation evidence that the scores are on disjoint rule
  sets and nothing is charged twice.

The revised hypothesis, which the next run should be judged against:

> On text where prose tells are absent, `antiAIScore` does not separate
> AI-pretending-to-be-casual from human writing, and `behaviorScore` does.

This is a weaker claim than the original, and it is the one the data supports.
The original is left visible above rather than deleted.

## 3. Ablation, not just the full stack

Section 21 requires this. Testing only the full stack cannot distinguish a layer
that helps from a layer that does nothing, or from a layer that actively hurts.

Seven configurations, each run against every category:

| # | Configuration | Layers active |
| --- | --- | --- |
| 1 | `baseline` | none — the model's draft, unmodified |
| 2 | `+anti-ai` | lexical, structural, rhythm, Chinese, English detectors |
| 3 | `+voice` | the target voice profile |
| 4 | `+behavior` | the behaviour engine |
| 5 | `+anti-ai+voice` | 2 + 3 |
| 6 | `+anti-ai+behavior` | 2 + 4 |
| 7 | `full` | everything, plus validation and the single retry |

Results are reported as a matrix of configuration × category × four scores, with
the per-contribution rationales retained so a regression can be attributed.

### The specific claim each row must settle

- `baseline` → `+anti-ai`: does tell removal do anything measurable?
- `+anti-ai` → `+anti-ai+voice`: does voice matching add anything once tells are
  gone, or is it decoration?
- `+anti-ai` → `+anti-ai+behavior`: does the behaviour engine add anything on
  chat categories? **This is the row that justifies the project.**
- `+anti-ai+behavior` → `full`: does validation plus one retry earn its cost, or
  does it over-edit?

### Reporting rule

Every cell reports four numbers, never a blended one. If a layer improves
`antiAIScore` while degrading `preservationScore`, that is a finding, and a
blended score would have hidden it. See `ARCHITECTURE.md` invariant 5.

## 4. Corpora

### Layout

```text
benchmarks/
  corpora/
    <category>/
      *.md            one file per sample, with front matter
  expected/           human-authored labels and expectations
  runs/               output, gitignored
```

### Sample front matter

```yaml
---
id: zh-chat-0014
category: chinese-chat
language: zh
mode: chat
provenance: human-written | model-generated | model-then-edited
model: <name and version, when applicable>
source: <where it came from, or "original">
licence: <required — no sample enters without one>
notes: <what this sample is meant to expose>
---
```

`provenance` is load-bearing. A corpus that mixes human and model text without
labelling it cannot measure false positives, and a benchmark that cannot measure
false positives will reward a detector that fires on everything.

### Current state

`benchmarks/corpora/` holds one seed file, in the hardest category, taken from
the brief's own example. Everything else is Phase 7 work, and every sample needs
a licence before it enters. The `ai-pretending-casual` category cannot be built
by copying an existing corpus: those samples have to be generated deliberately,
by asking models to be casual, which is exactly what the brief's example is.

### Size

Enough to make a claim, not enough to waste a week. Target per category:

- Chinese and English prose: 30 samples each, 400–1200 characters
- Chat categories: 100 samples each, one to four turns
- Formal and technical: 20 samples each
- AI pretending to be casual: 50 samples, deliberately generated
- Real human chat: 100 samples, with published consent and a clear licence

Below roughly 20 samples per category, differences between configurations will
be inside the noise and the ablation table will not be readable.

## 5. Protocol

1. **Freeze the corpus.** Record a corpus hash in the run output. A benchmark
   whose corpus moves cannot compare runs.
2. **Run every configuration against every sample.** Same input, same order, no
   cherry-picking.
3. **Never let the suite rewrite for the benchmark.** The harness produces a
   contract; a fixed, pinned model applies it. Otherwise the benchmark measures
   the model, not the suite.
4. **Record the model and its version.** Any number here is conditional on it.
5. **Report the four scores separately, with rationales.** No aggregate.
6. **Report false positives explicitly.** A real human sample scored as
   AI-flavoured is a failure, and it must be visible, not averaged away.
7. **Keep the raw output.** `benchmarks/runs/` is gitignored but every published
   number must be reproducible from a stored run.

## 6. What this benchmark must not claim

- It does not measure whether text was written by a machine. It measures the
  presence of catalogued tells and the distance from a target voice.
- It does not produce a "percent human" figure, and no aggregation of these
  scores may be presented as one.
- A high `antiAIScore` is not evidence that a detector is good. Section 2 exists
  precisely because the opposite is often true.

## 7. Phase 7 deliverables

- `benchmarks/run.ts` — the harness, driven by a config file
- `benchmarks/ablation.ts` — the seven configurations
- `benchmarks/report.ts` — the configuration × category × score matrix
- `benchmarks/corpora/` — the eight categories, licensed
- `BENCHMARK_RESULTS.md` — one file per run, with the corpus hash and model pin
