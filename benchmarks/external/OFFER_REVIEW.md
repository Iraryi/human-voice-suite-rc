# `chat.unsolicited_offer`: the targeted matched review

<!-- Hand-written decision record. Counts and hashes only: no reply text. -->

`RULE_STATUS_DECISION.md` §11 suspended this rule from `behaviorScore` with one condition: a **small
matched review**, not 780 samples, answering whether it enriches for offers of further help that the user
did not ask for. This is that review. The counts are in `REVIEW_RESULTS.md`; the decision, the method and
what it does not establish are here.

**Decision: strong evidence, no promotion in the release candidate.** The rule stays `shadow` and is
recorded as a **future promotion candidate**. The detector was not touched.

## 1. What was fixed before the sheet existed

| | |
| --- | --- |
| Rule under review | `chat.unsolicited_offer` |
| Rubric | `benchmarks/external/offer-rubric.md` at `sha256:67d684861f0bdc7473b375c83a635028d59ba6fc4e54ae834900cdbbf40e0e40` |
| Sheet | `sha256:fb953febf7e735f9778fc7537d3c458d8f26d136cd46841f6c6f496a36529fb2` (gitignored) |
| Samples | 180 — 90 triggers, 90 matched negatives, 0 unmatched |
| Matching | response-length bucket, turn count (single/multi) and HelpSteer3 domain |
| Key | sealed in a separate file, opened only after all 180 labels were written |

The rubric was hashed into the sheet and the manifest **before the first sample was read**, so the coding
scheme cannot have been fitted to what the samples turned out to be. The six label files were written
against opaque identifiers (`s-0001`…) assigned after a deterministic shuffle, so neither group nor
position was visible to the reader.

The labelled sample is the whole trigger population of 90, taken as the first 90 firings; the cap was set
before the sheet was generated and no trigger was added or removed afterwards.

## 2. The result

`chat.unsolicited_offer` fires on a genuine unsolicited offer **8.9 times more often** in its triggers than
in replies of the same length, turn count and domain where it did not fire.

| Measure | Value |
| --- | --- |
| `A` (genuine unsolicited offer) in the triggers | **71/90 (78.9%)** |
| `A` in the matched negatives | **8/90 (8.9%)** |
| Enrichment | **8.88×** |
| High-confidence labels only: `A` in triggers | 41/44 (93.2%) |
| High-confidence labels only: `A` in negatives | 1/30 (3.3%) |
| Assistant-shaped among the `A` triggers, offer set aside | **70/71 (98.6%)** |
| `A` triggers decidable without the user turn | 67/71 (94.4%) |

The direction holds inside every slice the matching controlled for: response length (`xs` 90.0% against
16.7%, `short` 72.4% against 3.4%, `medium` 93.8% against 12.5%, `long` 53.3% against 0%), and turn count
(single 86.7% against 8.9%, multi 71.1% against 8.9%). **This is not a length or turn-count effect in
disguise**, which was the first thing the review had to rule out.

### What the positives are

Reading the notes rather than the counts: the `A` triggers are overwhelmingly the **generic availability
close** — the reply answers what was asked and then volunteers further work. A minority are greeting or
praise turns answered with nothing but a help offer, and a few volunteer unrequested content with no
service phrase at all.

That single fact explains the construct question's answer and is the most useful thing in the review:
**98.6% of the positives are assistant-shaped, and 94.4% of them did not need the user turn.** The rule is
not primarily detecting *unrequested-ness*; it is detecting the assistant's closing register, which is
unrequested by construction. The name is defensible, but a reader who hears "unsolicited" as "the detector
read the conversation and worked out that nobody wanted this" would be wrong about the mechanism.

## 3. What is against it, stated as plainly as what is for it

1. **Eight of ninety negatives are `A`** — the rule missed them. The review's own sampling means these are
   the same length, turn count and domain as the triggers, so they are genuine recall failures, not
   long-tail artefacts. Precision 78.9% and recall over the matched negatives around 90% is a good rule,
   not a solved one.
2. **The long bucket is the weakest**: 53.3% of long triggers are `A` against 0% of long negatives. Fewer
   firings there, so the interval is wide, but the rule is noticeably less reliable on long replies.
3. **The `B`-to-`E` boundary was not applied consistently between readers.** Phrase-less replies were
   coded `E` in some batches and `B` in others. The `A` code was applied consistently — the rubric's A/B
   and A/C tests are the ones it spends its words on — but **the `B`, `C`, `D`, `E` and `F` columns are
   batch-dependent and must not be read as a taxonomy of the non-offers.** Only `A` and the aggregate
   `A` versus not-`A` are comparable across the sheet. This is a defect in the rubric, which was frozen
   before the samples were seen and is **not** amended after the fact.
4. **The negatives are a matched sample, not a population.** A rate against them is a rate against
   same-length, same-domain, same-turn-count replies, not a false-positive rate in the world.
5. **One review, one corpus.** HelpSteer3 Chinese rows. Nothing here says the rule behaves the same on
   other distributions, and the length-bucket spread suggests it would not.

## 4. The decision

| Question | Answer |
| --- | --- |
| Does it enrich for offers the user did not ask for? | **Yes, 8.88×**, holding across length and turn count |
| Is what it enriches for assistant-shaped? | **Yes, 98.6%** of its positives, with the offer set aside |
| Promotion to class A now? | **No.** A strong first review is not the promotion condition, and the release candidate is not the place to spend it |
| Status | **`shadow`**, unchanged |
| Recorded as | **future promotion candidate**, with this review as its evidence |
| Detector changed? | **No.** No phrase added, removed or reweighted, before or after the review |

**Why not promote.** Class A requires reviewed construct, human false-positive evidence and machine
positive evidence. This review supplies the first two in a stronger form than `auto_summary` or
`mirrors_user` ever had. What it does not supply is a **human** comparison: the negatives are model
replies. The rule's false-positive rate on offers written by people — which are common, since people
offer help too — is unmeasured, and "unsolicited offer" is exactly the behaviour where human and assistant
writing overlap. Promoting on nine-tenths of the evidence would put a rule into `behaviorScore` on the
strength of the part that is easy to measure.

**What would promote it.** A human arm: the same rubric applied to human replies of the same length and
domain, giving an `A` rate for people. If that rate is low, the rule separates the two and belongs in
class A; if it is not, the rule detects offers and not assistants, and belongs in `descriptive`.

## 5. Reproducing it

The sheet, the key and the label files are gitignored and stay local: they quote third-party response
text, and no part of them may be committed.

```bash
npm run review:sheet -- --rule chat.unsolicited_offer --rubric benchmarks/external/offer-rubric.md --limit 90
# label every sample in the sheet against the rubric, writing JSON lines to
# .external-corpora/review/labels/offer-NN.jsonl — without opening the key
npm run review:tally
```

`review:sheet` writes `<rule>-manifest.json` beside the key with the rubric hash, the sheet hash, the
counts and the cap. A rubric edited after a sheet was generated no longer matches its manifest hash, and
that is the check that makes "frozen before the samples were seen" a fact rather than a claim.
