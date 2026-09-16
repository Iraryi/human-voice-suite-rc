# Phase 14 — coverage, not sample size

<!-- Written by hand from `benchmarks/external/`. Numbers only, no source text. -->

```text
license/provenance status: unclear for dialogue data
local evaluation exception; not redistributable by this project
```

## Why the phase changed shape

Phase 13 measured 2,000 paired items and produced a clean result: three behaviour rules
separate machine chat from human chat and never fire on a human continuation. The obvious
next move was more items. It was the wrong one.

The result's limits were not statistical. They were:

1. **Coverage of length.** The machine arms wrote 12–20 characters against 38 for the human
   continuations, and every behaviour rule needs room. `chat.over_completeness` needs five
   sentences and no machine continuation had five, so its apparent direction was an
   artefact of the comparison rather than a finding about the rule.
2. **Coverage of situation.** LCCC is casual Weibo conversation. Explaining, advising,
   summarising, reassuring, correcting and structuring are not what that distribution is
   made of, so a rule that never fires on it may simply never have been asked.
3. **Coverage of what is missed.** A precise rule that fires on 4.5% of machine replies
   raises a question no rate answers: what is in the other 95%?

So the phase kept the 2,000-item paired control as the frozen natural-chat baseline and
built three instruments around it instead of making it bigger.

## What was built

| Instrument | Question | Result |
| --- | --- | --- |
| `LENGTH_MATCHED.md` — 600 items × 4 arms, five length buckets, `multi` oversampled | Does the machine still look like the machine when it has the room the person had? | **Yes, more so.** The three separating rules fire more when there is room (advice 2.7% → 3.7%, positivity 1.3% → 2.2%, agreement 1.2% → 1.7%). `ASSISTANT_SHAPED` read 0.2% → 2.7% before the demotion below and 0.2% → 0.5% after it, which is the demotion teaching its own lesson: most of what looked like "room makes the machine more assistant-like" was a descriptive smell charging for length. |
| `PROMPT_BANK.md` — 112 prompts, 14 situations, 3 arms, 336 answers | Which situations pull out assistant behaviour, and which of those behaviours has no rule? | The largest gap is the fixer reflex: **8 of 8** unconstrained answers to a complaint are plans of action, and the rule for that catches **1**. |
| `MISS_ANALYSIS.md` — 120 sampled uncaught continuations, labelled | Of the replies no rule fires on, how many read as a person? | **91 of 120 (75.8%) read as a person.** Of the 29 that do not, 22 do it in a shape a rule already exists for and is not watching. |

## The finding that changed a conclusion

Phase 13 classified `chat.over_completeness` as class A — a direction defect — because it
fired on 60 human continuations and 0 machine ones. The paired report printed the shape
check that made that reading unsafe, and the length-matched axis settled it:

| Arm | Replies of five sentences or more | Rule fires on them | Rate |
| --- | --- | --- | --- |
| `human` | 120 of 120 | 91 | 75.8% |
| `matched` | 94 (78% of the bucket) | 71 | 75.5% |
| `post` | 51 | 37 | 72.5% |

Once both sides have the shape, the rule fires on both at the same rate. **It measures
shape, not authorship.** It is not a direction defect; it is not a human/machine
discriminator either. In this register it is class B, and the honest remedy is to leave it
alone and say what it is for.

The user's instruction before the phase was that it must not be changed, and the evidence
now supports the instruction rather than merely obeying it.

## The demotion, and the regression that proves it is semantic

`chat.over_completeness` is no longer a discriminating smell. It is **reported and not
scored**: still detected, still shown to a user as a description of the text, and no longer
able to move `behaviorScore` towards "this looks like a machine". The taxonomy now says
which of the two kinds each smell is — `discriminating`, the default, or `descriptive` — and a
descriptive smell has to carry the measurement that demoted it.

The mechanism is one field and one filter:

```ts
readonly scoring?: 'discriminating' | 'descriptive';
```

`assessBehavior` excludes descriptive smells from the penalty and keeps them in `findings`,
and the rationale says so in words, so a reader of a score can see what was reported and not
charged.

**The regression says the change is the correction and nothing else.**

| | Before | After |
| --- | --- | --- |
| Rules whose firing changed | — | **0** |
| `antiAIScore` (69 samples) | 0.92 | 0.92 |
| `voiceScore` | 0.78 | 0.78 |
| `behaviorScore` | 0.88 | **0.90** |
| Samples changed | — | **11, all model-generated, 0 human-written** |
| Change per affected sample | — | **+0.187** |

0.187 is exactly `(4/5 × 0.7) / 3` — severity 4, confidence 0.7, the behaviour budget of 3.
The eleven samples are the eleven where the smell fired. Findings did not move, no other
score moved, and no human-written sample moved, because the committed corpus contains no
human sample with five sentences to answer. A change in a score with no change in what was
detected is what a semantic correction looks like; a change that also moved findings would
have been an implementation error.

## The reporting rule for `post`

Every report now states the mechanism rather than the headline:

> `post` reduces the observable assistant-shaped rate, but the current evidence is that a
> substantial part of that effect comes from the reply getting shorter; among the outputs
> that remain shaped, the rule firing rate does not fall with it.

Both halves are measured. In the length-matched axis `post` cut the shaped replies from 94 to
51 while its rates among the ones it kept were no better than `matched`'s. A reader who is
told only "post reduces assistant behaviour" would draw the wrong conclusion about what to
do next.

## What the contract does

Three measurements now agree on the same mechanism.

- On 12–20 character drafts, `post` was the same text as `plain` in 57.9% of items: there
  was nothing to rewrite.
- On length-matched drafts, `post` cut the shaped replies from 94 to 51 and reduced every
  machine-only rule — but **among the replies it kept shaped, its rates were no better than
  `matched`'s** (advice 27.5% against 23.4%, positivity 15.7% against 13.8%). It earns its
  improvement mostly by shortening.
- In the prompt bank, the contract changes what repair looks like: an unconstrained answer
  to a complaint fixes the problem, a contract answer agrees about it. Both are unwatched.

**`post` does reduce assistant behaviour, and the reduction is largely a length effect.**
That is now stated rather than implied, and it is the reason the length-matched axis exists.

## What was deliberately not done

- **No rule changed.** The hypothesis ledger in `benchmarks/external/README.md` gained one
  entry — advice in a form no advice marker watches — marked open, with the reproduction
  step it still needs. Nothing landed.
- **No threshold was moved to revive `antiAIScore` on chat.** The prose families' silence
  at chat length is recorded as a domain limitation in `docs/behavior-engine.md`: for a
  chat message the behaviour layer is the instrument, and a clean `antiAIScore` means
  nothing was looked for.
- **No scale-up.** 10k, 30k and the full 55,925 pairs remain the owner's decision, to be
  taken on coverage rather than on n. The 2,000-item baseline is frozen and untouched.

## Two defects in the instruments themselves

Recorded because both produced confident numbers first.

1. **A bucket defined by a different sentence splitter than the rule uses.** The new
   pipeline's own splitter ignored newlines and found 38 replies of five sentences or more
   in 30,000 sessions where the suite's found **448**. A bucket defined by one splitter and
   a rule that fires on another measures nothing. The pipeline now imports the suite's
   `splitSentences` and says why.
2. **A module that ran a command line when imported** — for the fourth time in this
   project: twice with a condition list, once with a refusal pattern, once with a bucket
   list. `tests/benchmark-module-imports.test.ts` now imports every benchmark module another
   module imports, in a child process, and fails if one of them prints or exits.

There was a third, which cost a local corpus rather than a number: the import test itself
first triggered a live V2EX fetch and overwrote the fetched corpus with a smaller one,
because a type-only import counted as an import. The corpus was re-fetched (5,212 replies →
5,335, as a live API gives) and every figure that quotes it was re-rendered.
