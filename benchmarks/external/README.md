# The external corpus

Genuine human writing, fetched from a public API, measured locally, and **never
committed**.

`EXTERNAL_CORPUS_RESULTS.md` holds the numbers. This file explains why there is no
text beside them.

## Why the text is not in this repository

Every sample under `benchmarks/corpora/` must declare a licence, and the loader
refuses one that does not — that rule is what makes the corpus publishable. A forum
reply cannot satisfy it:

| | |
| --- | --- |
| **Licence** | A comment is copyrighted by the person who wrote it. No licence is granted to this project, and none can be inferred from public readability. |
| **Privacy** | Comments arrive attached to a username, a posting history and sometimes a location. Committing them to a public repository is a privacy decision about someone who was not asked. |
| **Terms** | `robots.txt` permits crawling, which is not the same as a licence to republish. |

So the fetch writes to `.external-corpora/`, which is **gitignored**, and
`benchmarks/external/measure.ts` commits numbers only. The fetch tool refuses to
write under `benchmarks/corpora/` — the boundary is enforced in code rather than
described in a comment, because the whole point of the corpus loader's licence rule
is that unlicensed text cannot get in.

## What is published, and what is not

Published: how many replies, how many tripped a rule, how many crossed the flagged
threshold, per-rule firing counts and rates, and the mean score.

Not published: the text, excerpts of it, usernames, or anything a person wrote.

One concession makes the per-rule table readable: where a finding's evidence span is
**one of the rule's own watched phrases**, that phrase is named — `大概率`,
`这件事` — because those strings are this project's vocabulary, taken from the
upstreams. Where the evidence is a fragment of the measured text, which is what a
structural or rhythm rule produces, the match is counted and never quoted. The
measurement tool checks each span against the rule's phrase list before naming it,
so the distinction is mechanical rather than a matter of care.

## Why V2EX, and not 小黑盒

小黑盒 was the first choice, and it is not reachable without their app credentials:

- the public web front end is a JavaScript shell — the homepage is 2.6 KB and
  contains no content or links;
- every undocumented API path answers `{"msg":"请求失败了"}`; the endpoints require
  their `hkey` and a signed nonce, which come from the app's login flow;
- the paths that do carry content are under `/app/`, which their own `robots.txt`
  disallows.

V2EX publishes a **documented read-only API** that `robots.txt` permits
(`/api/topics/hot.json`, `/api/topics/latest.json`, `/api/replies/show.json`), which
makes it both reachable and the more defensible source. If 小黑盒 access is wanted
later, it needs either their app credentials or a licence to their content; scraping
around the signing is not something this project should do.

## What was stripped at fetch time

Nothing identifying survives: no username, no member id, no avatar, no timestamp, no
topic author. Each reply keeps its own text, a synthetic id, its **ordinal** within
the topic, and the **topic title and body** as `context`.

Both of those are kept for measurement rather than convenience:

- the **context** is kept because a reply is an answer to something, and the
  behaviour layer cannot judge mirroring or over-completeness without knowing what
  was answered. It is what makes a turn pair out of a lone reply — the first real
  behaviour measurement in this project;
- the **ordinal** is kept because it is the difference between an honest measurement
  and a convenient one. The first reply answers the topic author; the fifth answers
  the second replier. Only first replies are used for behaviour, and the results file
  says so.

The ordinal is a count, not a timestamp, and identifies nobody.

Also excluded, because a detector was never meant to judge them: replies under 8
characters, replies over 400, replies that are only a link, and replies with no Han
or Latin letters at all.

## The isolated evaluation exception

The rule this directory enforces — unlicensed text does not enter the repository —
stands. What the exception splits is a question that rule had been treating as one:

> **May this be used for research?** and **may this be published as a project asset?**

The first is relaxed for a narrow class of corpora. The second is not relaxed at all.
The class has four properties and all four are required:

1. **high value** — structure or scale the project cannot obtain otherwise;
2. **publicly obtainable** — distributed by its authors or a named mirror, not
   scraped around an access control;
3. **a stated academic purpose** — produced and documented by a research group;
4. **incomplete licensing for the data** — the problem being worked around, not a
   detail that was overlooked.

It does **not** extend to scraped data of unknown origin, to mirrors whose provenance
cannot be traced, or to any corpus failing one of those. A corpus does not become
eligible by being convenient.

| Permitted under the exception | Prohibited, always |
| --- | --- |
| Local download and parsing | Committing source dialogue or long derived passages |
| Rule validation, trigger-rate and false-positive measurement, behaviour distributions | Merging the corpus into the redistributable benchmark |
| Finding rule logic errors — the way `chat.mirrors_user`'s one-sided test and the punctuation run in `rhythm.repeated_openings` were both found | Presenting the data as MIT, or claiming it is licensed |
| Aggregate statistics, and analysis containing no source text | Shipping it in any public data package |
| — | Turning it into a training set or a fitting set |
| — | Redistributing the corpus, here or elsewhere |

Every artefact carries both labels:

```text
license/provenance status: unclear for dialogue data
local evaluation exception; not redistributable by this project
```

### The procedure a corpus finding has to pass

**A defect found through an excepted corpus is a hypothesis, not a fix.** The corpus may
propose; it may not decide. Every finding walks the same four steps, in order, and stops
at the first one that fails:

| Step | What happens | What stops it |
| --- | --- | --- |
| **1. Propose** | A rule fires where it should not: on real human writing, on a human continuation, or on one machine condition and not on another. The finding is written down as a hypothesis naming the rule, the count, and the corpus that produced it. | Nothing. Proposing is free, and a hypothesis that is never reproduced costs one line in the ledger below. |
| **2. Reproduce on text this project may ship** | The same failure is produced on a **synthetic** sample written for the purpose, or on one of the licensed corpora under `benchmarks/corpora/`. `benchmarks/candidates/` is the usual home. | No reproduction, no change. A rule that can only be shown to be wrong on text nobody else may read stays a hypothesis for ever. |
| **3. Measure the change** | The candidate fix runs through `bench:compare` against the committed corpus and `bench:probe` against the rule's own samples. | Any corpus regression. The committed corpus is the contract with every user of this suite; a change that moves it needs its own justification, not a borrowed one. |
| **4. Change and record** | The rule changes, `docs/phase-*-rule-changes.md` gains an entry naming the corpus that proposed it *and* the reproduction that justified it, and the ledger below is updated. | — |

The order is the point. Steps 2 and 3 are what keep an unlicensed corpus from becoming a
fitting set: it can start an argument, and only shippable text can finish one.

### The ledger

| Hypothesis | Proposed by | Reproduction | Status |
| --- | --- | --- | --- |
| `chat.mirrors_user` fires on ordinary human turn pairs | V2EX turn pairs, 23 of 263 (8.7%) against 1 of 14 generated | the same measurement after the fix, plus the committed corpus | **Landed** — a coverage condition was added beside the ratio; 8.7% → 0.8%, the true positive kept, committed corpus unchanged. `docs/phase-8-rule-changes.md` §12 |
| `rhythm.repeated_openings` was watching a run of punctuation, not a run of openings | LCCC-base, 1,123 firings of which every one was `。`, `！`, `.`, `…` or `？` | V2EX (40 → 6) and the committed corpus | **Landed** — a word-character test; LCCC 1,123 → ~17, both tell rates down, committed corpus unchanged. `docs/phase-8-rule-changes.md` §13 |
| Advice arrives in a form none of the advice markers watch | the miss analysis on the paired control (14 of 120 uncaught continuations); the prompt bank, where **8 of 8** unconstrained answers to a complaint are a plan of action and `chat.unsolicited_advice` catches **1** | **the structural features exist, are frozen, and passed their blind run.** `SOLUTION_MODE.md` builds the paired design — one situation, three user turns, only one of which asks for help — and `SOLUTION_MODE_BLIND.md` is the run on twenty-four situations from domains the calibration twenty never touched: **23 of 24 obvious plans found, 0 of 24 complaints flagged**. Permission is now a layer of its own (`permission.ts`, four states, `UNCERTAIN` first-class), and the two are read together in `SOLUTION_MODE_SHADOW.md` | **Open, in shadow.** `LOW` + `PLAN` fires zero times in 396 controlled replies: no observed false trigger, and **no precision figure, because there is no positive prediction**. The structure question is answered; whether a plan was invited is not |
| Every rule's status, decided once ([`RULE_STATUS_DECISION.md`](./RULE_STATUS_DECISION.md)) | eleven questions per rule, answered from the evidence above rather than one rule at a time | **Class A keeps `behaviorScore`; B, C and D stop contributing to it.** `chat.auto_summary` → `descriptive`, `chat.mirrors_user` → `deprecated-candidate`, `chat.unsolicited_offer` → `shadow` pending a small review, `chat.unsolicited_advice` → `shadow` with its gate unwired, action-plan and permission frozen in shadow, `forced_positivity` and `over_agreement` unchanged | **Decided, not implemented.** The migration is one change, after which `behaviorScore` is recomputed and the reports re-rendered. Old numbers keep the qualifier "measured with `requestKind` unpopulated" |
| Consolidation | every concept and implementation in one table, with observable scope beside claimed scope ([`CONSOLIDATION.md`](./CONSOLIDATION.md)) | **A correction found while filling the table:** `chat.unsolicited_advice` does have a context hook — `requestKind`, a caller-supplied list of what the user asked for — and **nothing in this project ever populates it**. Every published rate for that rule therefore describes it with its permission gate disabled, and the nineteen "legitimate advice after permission" replies show that no layer here computes permission from the user turn | **Open** — the fix is to feed the hook that exists, not to widen the phrase list |
| What does `chat.unsolicited_advice` fire on when the reply is not a plan? | the forty-five lexical-only replies, classified by what happens in them (`LEXICAL_ONLY_CLASSIFICATION.md`) | **The largest single category is advice the user asked for: 19 of 45 (42%).** Then 7 phrase-level false positives, 6 lightweight, 6 generic-hypothetical, 6 third-party, 1 other. 27 of 45 (60%) are assistant-shaped, 18 are not, and 4 carry plan structure the frozen features missed | **An advice-language feature whose name overclaims.** Its own precondition — that advice was not requested — is invisible on 19 of the 45 without the user turn, so it cannot be evaluated response-only. No rename, reweight or word-list change until the status decision |
| Is `chat.unsolicited_advice` a lexical proxy for the action-plan behaviour? | the project had been describing it as one; `COVERAGE_MATRIX.md` measured the relationship | **No, and the claim is withdrawn.** Calibration bank: lexical 1, structural 69, intersection 1. Blind set: lexical 0, structural 72, intersection 0. HelpSteer3: lexical 58, structural 210, intersection 13 — and **45 of the rule's 58 firings are not plan-shaped at all**. Two detectors overlapping on 13 of 268 firings are two different phenomena that intersect, not a proxy and its target | **Stated; nothing changed.** Not deleted, not renamed, not reweighted, and no claim that it detects uninvited solution mode. Until the 45 lexical-only replies are read by hand, a report may describe only its firing condition: five phrases, in a reply whose user turn did not ask for advice |
| `chat.over_completeness` fires on human chat and never on machine chat | the paired control: 60 of 2,000 human continuations (3.0% balanced, 1.0% re-weighted to LCCC's own distribution) against 0 of 6,000 machine ones | **reproduced and rejected as a direction defect.** `LENGTH_MATCHED.md` gave the machine the room the person had: among replies of five sentences or more, the rule fires on **75.8% of human continuations and 75.5% of machine ones** (91/120 and 71/94). It measures shape, not authorship; the paired control's zero was the machine never writing at that length. | **Closed** — no rule change. It is not a direction defect, and it is not a human/machine discriminator either: in this register it is class B, with no discriminating value. Both readings are in `LENGTH_MATCHED.md` §4. |


### Current holder

| Corpus | Why it qualifies | Evaluation |
| --- | --- | --- |
| **LCCC-base** (`thu-coai/CDial-GPT`, [arXiv 2008.03946](https://arxiv.org/abs/2008.03946)) | 3.35M single-turn plus 3.47M multi-turn Chinese dialogues, assembled by a research group with a published cleaning pipeline. Structure and scale this project cannot obtain otherwise. | [`LCCC_EVALUATION.md`](./LCCC_EVALUATION.md), [`PAIRED_CONTROL.md`](./PAIRED_CONTROL.md) |

`PersonalDialog` remains **not used**, and the distinction is the point: it states
terms — non-commercial, pointing at Weibo's privacy policy — rather than leaving them
incomplete, and its utterances carry speaker gender, location and interest tags. That
is a stated restriction that does not compose with this repository's MIT grant, not a
gap the exception was written for.

## Two datasets that would be better, and why neither is used

Both are Chinese, both are large, both would give the behaviour measurement tens of
thousands of turn pairs instead of 263. Neither is used, and the reasons differ in a
way worth recording.

### `PersonalDialog` — terms stated, and they do not compose with MIT

`silverriver/PersonalDilaog`, [arXiv 1901.09672](https://arxiv.org/abs/1901.09672),
HuggingFace `silver/personal_dialog`. 5.4M multi-turn Chinese dialogue sessions;
`dev`/`test` splits of ~10.5k dialogues each carrying a `golden_response` — a real
human turn pair. The dev split is 1.6 MB.

| | |
| --- | --- |
| Licence | `other-weibo`. The card points at [Weibo's privacy policy](https://weibo.com/signup/v5/privacy) and says: *"Please restrict the usage of this dataset to non-commercial purposes."* |
| Provenance | Collected from Weibo; utterances carry speaker **gender, location and interest tags**. It reads as private-message material. |
| Privacy | The card's *Personal and Sensitive Information* section is `[Needs More Information]`. |

### `LCCC-base` — no terms for the data, and a mirror that invents one

`thu-coai/CDial-GPT`, [arXiv 2008.03946](https://arxiv.org/abs/2008.03946).
3,354,382 single-turn plus 3,466,607 multi-turn Weibo dialogues. The README says
plainly that the raw dialogue data comes from 微博对话.

| | |
| --- | --- |
| Licence | **None stated for the data.** The repository's `LICENSE` is MIT, © 2020 `lemon234071`, which by convention covers the code. `thu-coai/lccc` on HuggingFace ships a loader script and **no data files**; the authoritative distribution is Baidu Netdisk and Google Drive. |
| Provenance | Weibo conversations, the same corpus `PersonalDialog` draws on. |
| The trap | A third-party mirror, `silver/lccc`, carries the files and declares `license: mit`. **Nobody can relicense Weibo users' conversations as MIT.** Accepting that claim would mean this project's "no licence, no entry" rule was satisfied by a declaration from someone with no standing to make it — which is precisely the failure the rule exists to prevent. |

### Why that matters to this project specifically

1. **A non-commercial dataset does not compose with an MIT grant.** This repository
   is MIT, which passes commercial rights downstream. Building the measurement on a
   non-commercial dataset leaks a restriction the licence text here cannot express
   and a reader would not expect.
2. **Private-message provenance is a different footing from public posts.** The V2EX
   replies above were posted in public, to be read. Weibo conversations with
   demographic tags attached are not the same act of publication, and no consent
   story is recorded for either dataset.
3. **It would become a dependency**, and a withdrawable one.

This is a judgement about *this* project's licence and standards, not a claim that
either dataset is unusable: both are widely used in academic work. **The decision
belongs to the person who owns this repository**, which is why it is written here
rather than made quietly. If the trade were accepted, the data would be fetched
locally, stripped of every profile field, measured, and never committed — the same
boundary the V2EX corpus is held to.

What it would buy is real: 263 turn pairs against tens of thousands.

## The paired machine control

`LCCC_EVALUATION.md` measures rules against human conversation and against the committed
generated corpus — two different corpora, two different topics, two different registers.
Every difference between them is available as an explanation, which is why that
evaluation can say a rule fires more often on one than the other but not why.

The paired control removes the explanations. One LCCC context is continued **four
times**: by the human who wrote the next line, and by three machine conditions.

| Arm | What produced it |
| --- | --- |
| `human` | the LCCC continuation, unchanged — the control |
| `plain` | a model answering the conversation with no constraints |
| `default` | a model answering under this suite's own chat contract, quoted from `human_voice_prepare` rather than paraphrased |
| `post` | the `plain` answer rewritten under the same contract — the suite's real pipeline shape |

Same context, same topic, same register, same length pressure; the only thing that
differs is who wrote the next line. 2,000 items, drawn round-robin from 59 strata cells
so that no single stratum can masquerade as the sample, at 6,000 generated continuations
with nothing missing and nothing refused. `PAIRED_CONTROL.md` holds the numbers.

**What it found.** In this register — short Chinese chat turns — exactly three rules
separate machine from human, and they separate cleanly: `chat.unsolicited_advice`,
`chat.forced_positivity` and `chat.over_agreement` fire on 0.4–1.7% of machine
continuations depending on the condition and on **none** of the 2,000 human ones. Between
them they catch 4.5% of unconstrained machine replies, 1.6% of contract-generated ones and
3.4% of rewrites, so the layer is precise and low-recall here rather than decisive. The
firings also concentrate on the same items across conditions — 72 of the 123 caught items
were caught by two or three conditions against 6.5 expected if the conditions fired
independently — so the rules are reading the continuation and not sampling it. Six more
rules fired too rarely to classify. `chat.over_completeness` ran the other way (60 human, 0
machine) but is length-bound, and the report prints the shape check that shows why. And
`antiAIScore` was 1.000 for all four arms: **the prose families say nothing at all about
chat-length text**, human or machine, which is a statement about their domain rather than
about their correctness.

## The coverage phase: room, situations, and what is not caught

Sample size was not the binding constraint on the first result; coverage was. Three
follow-ups, each answering a question the paired control could only raise.

| Where | The question | What it found |
| --- | --- | --- |
| [`LENGTH_MATCHED.md`](./LENGTH_MATCHED.md) | Does the machine still look like the machine when it has the room the person had? | **Yes, more so.** Given the same room, the three separating rules fire *more* (advice 2.7% → 3.7%, positivity 1.3% → 2.2%). `ASSISTANT_SHAPED` read 0.2% → 2.7% until `chat.over_completeness` was demoted to a descriptive smell and 0.2% → 0.5% after, which is the demotion teaching its own lesson. And the class A verdict on that smell is **withdrawn**: among replies of five sentences or more it fires on 75.8% of human and 75.5% of machine continuations. It measures shape, not authorship — which is why it no longer moves `behaviorScore`. |
| [`PROMPT_BANK.md`](./PROMPT_BANK.md) | Which situations pull out assistant behaviour, and which of those behaviours has no rule? | 112 prompts in 14 situations, three arms, 336 answers. The largest gap: **a complaint is answered with a plan of action in 8 of 8 unconstrained replies and 0 of 8 contract ones**, and the rule for that catches one, because a plan need not use any of the five phrases it watches. |
| [`MISS_ANALYSIS.md`](./MISS_ANALYSIS.md) | Of the machine replies no rule fires on, how many read as a person and how many still read as an assistant? | 120 sampled uncaught continuations, labelled by one reader: **91 (75.8%) read as a person**; of the 29 that do not, **22 do it in a shape where a rule already exists and is looking elsewhere** — advice without the advice words, agreement without the agreement words, a counselling register with no mechanical-empathy phrase in it. |
| [`HELPSTEER3_EVALUATION.md`](./HELPSTEER3_EVALUATION.md) | Does any of this hold on text this project did not write, from models it did not run? | 2,433 Chinese rows, 4,866 responses, CC-BY-4.0, ~20 models none of them proprietary. The three separating rules fire at 0.5–2.9%, and **a deliberately loose probe finds a procedure in 34.6% of the responses while they carry none of the advice phrases** — an **upper bound pending calibration, not a prevalence** — the same coverage gap, measured externally, at an order of magnitude more often than the rule catches it. `chat.auto_summary` fires at 8.0% here and never fired in chat. |

## The release-candidate phase: the last two reviews, and what was not built

The status decision left two rules suspended pending a hand review and two families of misses pending a
look. Both are now closed, and neither closure changed a detector.

| Where | The question | What it found |
| --- | --- | --- |
| [`OFFER_REVIEW.md`](./OFFER_REVIEW.md), [`REVIEW_RESULTS.md`](./REVIEW_RESULTS.md) | `chat.unsolicited_offer` has never been read by hand. Does it enrich for offers the user did not ask for? | **Yes, and strongly.** 90 triggers against 90 matched negatives on response length, turn count and domain: `A` in **71/90 (78.9%)** of triggers against **8/90 (8.9%)** of negatives, an enrichment of **8.88×**, holding in every length bucket and both turn counts, and **98.6%** of the positives are assistant-shaped with the offer set aside. Against it: 8 misses in the negatives, the long bucket is weakest, and **94.4% of the positives needed no user turn** — the rule detects the assistant's availability close, not a reading of what the user wanted. **Decision: stays `shadow`, recorded as a future promotion candidate.** Promoting needs a human arm, because the negatives here are model replies and "offers help" is exactly where people and assistants overlap. |
| [`MISS_ARCHIVE.md`](./MISS_ARCHIVE.md) | The four `mechanical_empathy` misses and the four action-plan structural misses the coverage phase set aside: is either a family? | **Neither.** The four empathy misses are three forms — comfort imperative, permission/absolution close, invitation to disclose — and two of those are how *people* comfort each other, so widening the rule would trade a narrow rule for a broad unmeasured one. The four structural "misses" are **plans where the user asked for a plan**, which is a good answer and not the construct. **No v2 for either.** And a finding fell out of the second one: A v1 reads an explicit traditional-Chinese help request as `LOW`, the state that *allows* a rule to accuse. |
| [`MIGRATION.md`](./MIGRATION.md) | Two interface changes landed after the status decision. What did they move? | **The advice gate moved no score at all**: 0 of 483 measurements changed on any of the four scores, while the rule's *reporting* changed on 441 of them (it abstains instead of firing). Phase A's class-A-only rule moved `behaviorScore` 0.9599 → 0.9808 on 16 model-generated samples and nothing else. The same re-run found that `SOLUTION_MODE.md` had been stale since the features were recalibrated — its own §1 said the features find 2 of 20 `help` plans while its §4 said 19 of 20 — and that the blind report was rendering the calibration section against the blind set, reporting "115.0% recall". Both fixed and recorded; no conclusion moved. Five phase reports were re-run and deliberately **not** adopted, because their harness supplies no permission evidence and regenerating them would silently restate a past measurement. |

None of the three changed a rule. `benchmarks/external/README.md` is where the procedure
that would change one lives, and the ledger above is where its state is recorded.

### Reading a rule before concluding anything about it

Two instruments, in order, for every rule whose behaviour is in question.

1. **`review:condition`** measures the rule on HelpSteer3 first, cut by response length, turn count and
   domain, with a length-matched view. The question is whether a rate is a behaviour or a length.
   `RULE_CONDITIONING.md` holds the numbers.
2. **`review:sheet`** then builds a **blind** sheet: triggers and matched negatives shuffled together,
   showing only an opaque id, the user turn, the context and the reply. Not whether it fired, not which
   rule, not any diagnostic, not which group. The key is a separate file and stays closed until the
   labels are written.

The blinding is not decoration. Knowing that a reply tripped `auto_summary` is enough to start seeing
summaries in it, and a review that knows the group measures the reader rather than the rule. Matching is
on response length, turn count and domain; a trigger with no partner in its own bucket is reported as
unmatched rather than paired with a bad one.

### Four things that were being confused, and are now separate

The coverage matrix settled an argument the project had been having with itself. These four
are not one dimension, and a report may not slide between them:

| Concept | What it is | Where it lives | Status |
| --- | --- | --- | --- |
| **advice language** | Five phrases appearing in a reply whose user turn did not ask for advice | `chat.unsolicited_advice` | `active`. Its firing condition is all that may be claimed for it |
| **action-plan structure** | A reply shaped like a procedure: ordered instructions, a channel, a condition and a fallback | `solution-mode.ts`, frozen | `shadow`. Blind: 23 of 24 obvious plans found, 0 of 24 complaints flagged |
| **solution permission** | How much room the *user turn* gave for a plan: `LOW`/`MEDIUM`/`HIGH`/`UNCERTAIN` | `permission.ts` | `shadow`. No confident error on its blind set; it abstains often, by design |
| **solution-mode shift** | A plan in a `LOW` turn — both layers at once | `shadow-report.ts` | `hypothesis`. Zero firings in 396 controlled replies: no observed false trigger, no precision figure, no promotion |


## Reproducing it

```bash
npm run external:fetch      # ~400 requests, 900 ms apart; writes .external-corpora/
npm run external:measure    # rewrites EXTERNAL_CORPUS_RESULTS.md
```

The paired control is generated rather than fetched, and its generation is performed by
the agents of the harness this suite is installed into — there is no model inside the
suite, by design. Four commands build it, and each is resumable: work already in
`.external-corpora/paired/out/` is never generated twice.

```bash
npm run paired:sample                              # stratified items, gitignored
npm run paired:generate -- prepare --only plain   --limit 2000
# one generator per chunk file in .external-corpora/paired/chunks,
# each writing the outputFile named inside it
npm run paired:generate -- prepare --only default --limit 2000
npm run paired:generate -- prepare --only post    --limit 2000   # rewrites the plain answers
npm run paired:generate -- merge --limit 2000      # validates, counts refusals, writes the manifest
npm run paired:report -- --limit 2000              # rewrites PAIRED_CONTROL.md
```

The fetch is deliberately slow and identifies itself honestly in its User-Agent
rather than pretending to be a browser. It is a research fetch of a few hundred
replies, not a crawl.

**This is a measurement, not a benchmark.** It has no pinned corpus hash, and the
API returns whatever is current, so a second run will produce different numbers. The
committed benchmark's discipline — freeze the corpus, hash it, pin the model — does
not apply here, and the results file says so.

## What it was for

`BENCHMARK_RESULTS.md` §1 has said since the first run that the false-positive rate
on real human conversation is **unmeasured**, because the committed corpus contains
no real human conversation: 48 of its 60 samples are model-generated, and the human
ones are documentation excerpts. That left the central question — does this fire on
the way people actually write — without a denominator.

It has one now, and it produced two concrete defects on its first run: the phrases
`大概率` and `这件事` were ordinary Chinese vocabulary that had been imported as
tells, and they accounted for four of the eighteen firings on human writing. Both
are now excluded at match time; the committed corpus lost nothing, which is
recorded in `docs/phase-8-rule-changes.md`.

