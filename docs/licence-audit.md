# Licence and provenance audit

<!-- Run before any decision to publish the repository. Method and results below. -->

**Date of this audit:** the phase-14 commit.
**Scope:** everything tracked by git, and everything reachable in its history.

## Why this exists

The project measures text it may not redistribute. That is a deliberate design — an
isolated evaluation exception for corpora that are worth studying and cannot be shipped —
and it means the repository has a boundary that must hold in two directions: the
unlicensed text never enters, and the licence positions that *are* claimed are ones the
project can stand behind. Neither is a property of anybody's care. Both are properties of
the repository, so both are checked.

The trigger for running it now was a decision, not an incident: the repository is private
and the question of publishing it was raised. This document is what that decision needs.

## What was checked, and how

| Check | Method | What it proves |
| --- | --- | --- |
| Gitignored material is not tracked | `git ls-files` against the ignore rules for `.external-corpora/`, `profiles/`, `benchmarks/runs/`, `.upstream-cache/` | The locally fetched corpora, the learned voice profiles and the benchmark runs are not in the tree. |
| Every corpus sample declares a licence and a provenance | front matter parsed for all 69 samples under `benchmarks/corpora/` | Nothing publishes without a licence: the loader throws on a sample without one, and this checks the same property across the tree. |
| No unlicensed third-party prose anywhere else | every tracked file scanned for a run of twenty or more Han characters, with an allowlist for the licensed corpora and the upstream example text | No corpus text was pasted into a document, a report or a test. |
| The fetched corpora never entered history | five distinct 24–30 character probes taken from the local LCCC corpus and five from the local V2EX corpus, each searched across **all** revisions with `git log --all -S` | Ten probes, no hit. Neither corpus has ever been committed, in any commit, on any branch. |
| Third-party example text carries a notice | the four files holding upstream example text read and traced to their source | Each is under the upstream's MIT licence, preserved in `licenses/`, and names the pinned revision and directory it came from. |

The last four checks are implemented as tests in
`tests/repository-boundary.test.ts`, so they run on every push rather than only when
somebody remembers. The history probes are not: `git log -S` over every revision is too
slow for CI, so it stays a documented command here.

## Findings

**No unlicensed corpus text is in the repository or its history.** Ten probes across every
revision, no match. Every report generated from LCCC-derived material contains zero Han
characters — `PAIRED_CONTROL.md`, `LENGTH_MATCHED.md`, `MISS_ANALYSIS.md` and
`paired-census.json` were each scanned — and the one place a Han character does appear in
those reports is a rule's own watched phrase, which is this project's vocabulary.

**Every corpus sample is licensed for redistribution.** 58 samples are original to this
project under MIT, and 11 are upstream-derived with the upstream's MIT notice preserved
in `licenses/`. Provenance is recorded per sample: 11 human-written, 56 model-generated,
2 model-then-edited.

**The only committed third-party text outside the corpora is upstream example text**, in
four files: the two humanizer-zh adapters' parsed examples,
`src/voice/import/author-voices.generated.json`, and the two tests that assert those
examples survive a parse. All of it is MIT from `ai-zixun/humanizer-zh` and
`blader/humanizer`, with the copyright holder recorded verbatim and the licence text
preserved.

**The author voice profiles are style descriptions, not the authors' prose.** They are
built from the upstream's `references/voices/*.md`, which describe each voice and quote its
short, well-known aphorisms and book titles. A run of twenty-plus Han characters in the
generated profile is an example sentence the upstream wrote to illustrate a rule, not a
passage from a published work. This was checked by reading them.

## Decision: the author voices are not distributed

**Taken:** the imported author voices stay a capability and stop being an asset this project
ships. `npm run voice:import` still parses them from the pinned upstream clone; it writes them
to `.external-corpora/author-voices/`, which is gitignored, and the plugin loads them from
there when they exist. `src/voice/import/demo-voice.json` is committed in their place —
written for this repository, imitating nobody — so the profile, import and generation paths
have something to run against on a fresh checkout.

**Why this and not a rewrite.** The alternative was to re-author the eight voices as abstract
craft templates over sentence length, rhythm, spoken density, ellipsis, imagery, narrative
distance, emotional display and rhetorical habit. That is roughly 180 directives to rewrite,
and what it produces is a set of templates whose specificity — the only reason they were worth
importing — has been sanded off. The profiles are prose about named living writers that quotes
their phrases and their books; the cheapest correct answer is not to distribute them.

Two boundaries the decision carries, both of which the repository is checked against:

1. **Nothing from those profiles is vendored into this repository**, including fixtures,
   snapshots, README examples and **git history**. The last one is why the release needs a
   history rewrite: `src/voice/import/author-voices.generated.json` was committed from an early
   phase until this one, and removing it from the tip is not enough.
2. **The upstream's MIT licence is not extended into a claim about what sits inside it.**
   `ai-zixun/humanizer-zh` declares MIT over its own compilation. This audit does not reason
   from that to "every third-party quotation inside it is MIT-licensed for redistribution",
   because that inference is exactly the one this project refuses to make for corpora. What is
   recorded is the importer's source, the upstream's licence, and the fact that this project no
   longer distributes the profiles.

### Release checklist for this decision

| Step | State |
| --- | --- |
| Artefact removed from the working tree | done |
| Importer writes to a gitignored path | done |
| A demonstration profile is committed in its place | done |
| Tools, packaging and tests no longer require it | done |
| Docs no longer claim eight shipped voices | done |
| History rewrite, so no revision contains it | **done** — `git filter-branch --index-filter` over all 25 commits, original refs deleted, reflog expired, object database pruned, then a forced push of `main` and every tag. `git log --all -- <path>` and `git rev-list --all --objects` both return nothing for it. |
| The full-history probe runs with the allowlist entry removed | done — removed from both `scripts/provenance-probes.mjs` and `tests/repository-boundary.test.ts`, so a reappearance fails the build instead of passing quietly |

### One thing the rewrite does not do

GitHub keeps unreachable objects for a while after a force-push, and a blob can stay
fetchable by SHA if somebody knows the SHA. Nobody outside this machine has ever had one: the
repository has been private since it was created, and the commits that contained the file were
never public. For a release, the cleanest option is to publish a **new** repository built from
a single commit of the audited tree rather than to open this one; if this one is opened
instead, the residual is an unreferenced blob on GitHub's side that this project cannot purge
itself.

## Residual risk, stated rather than implied

### The HelpSteer3 provenance statement, in the exact form it can be defended

An earlier draft of the external-validation plan said HelpSteer3 "contains no OpenAI text".
That was an over-claim and it is corrected here, because the discipline this project applies
to corpora is worth nothing if it slips in its own favour the moment the corpus is
convenient.

What is true, and all that is true:

> HelpSteer3 官方说明其候选 responses 由约 20 个 commercially-permissively-licensed LLM 生成，
> 且不包含 OpenAI 等 proprietary provider 模型生成的 response。

In the dataset's own words: *"Responses are generated by ~20 different
commercially-permissively-licensed LLMs (note: none from proprietary LLM providers such as
OpenAI…). We generate 2 responses per prompt, each from a different model"*
([card](https://huggingface.co/datasets/nvidia/HelpSteer3)). The paper adds the basis for the
licence: *"Codestral 22B and Mistral Large 2 were used following a contractual agreement with
Mistral to use and release the responses by these models under a commercially permissive
license, which we chose as CC-BY-4.0"* ([arXiv 2503.04378](https://arxiv.org/abs/2503.04378)).

**The prompts are a different story, and the distinction is the whole point.** The same card
says: *"Prompts are collected based on user-contributed ShareGPT and WildChat-1M prompts.
ShareGPT was used for the Code/Multilingual domains while WildChat-1M was used for
General/STEM domains."* ShareGPT is *"user conversations with ChatGPT that are voluntarily
shared"*, and WildChat-1M is a corpus of ChatGPT conversations. **Chinese rows are in the
Multilingual domain and therefore come from ShareGPT.**

So the correct reading is: the *responses* this project measures are generated by models with
commercially permissive licences and none by a proprietary provider; the *prompts* are
user-contributed conversations with ChatGPT. "The response generator is not OpenAI" does not
extend to "the dataset contains no OpenAI-origin text", and this file does not say it does.

One further statement, which is the paper's and is narrower than it looks: *"Instead of using
ChatGPT generated assistant turns from ShareGPT/WildChat, we use the models used for response
generation to generate intermediate assistant turns. This was done to avoid using any ChatGPT
response in our dataset curation process."* That covers the **assistant turns inside
`context`**; it does not change where the user prompts came from, and it is not a claim about
the dataset as a whole.

| Question | Answer for HelpSteer3 |
| --- | --- |
| Is the measured text (the two responses) from models with a permissive licence? | Yes, per the card and the paper, and the licence choice is stated as CC-BY-4.0 |
| Are any responses from OpenAI or another proprietary provider? | No, per the card |
| Are the prompts free of OpenAI origin? | **No claim is made.** Chinese prompts come from ShareGPT, which is user conversations with ChatGPT |
| Is the assistant text inside `context` free of ChatGPT output? | The paper says so; treated here as the paper's statement, not as verified fact |
| Does any row say which model produced a response? | **No.** The rows carry a domain, a language, a context, two responses and preference labels. Per-model attribution is not in the data |

1. **The published external figures are not reproducible.** V2EX returns whatever is
   current: the committed numbers describe a fetch of 5,335 replies, and a re-fetch will
   differ. `EXTERNAL_CORPUS_RESULTS.md` says so itself, and this audit records that the
   corpus those numbers came from no longer exists on this machine in the form it was
   measured — it was re-fetched, and every figure that quotes it was re-rendered from the
   new fetch.
2. **The corpora on this machine are not covered by anything in the repository.** They live
   in `.external-corpora/` under the exception described in `benchmarks/external/README.md`.
   A `git add -f`, or an edit to `.gitignore`, would commit them. The boundary test catches
   the second case only after the fact.
3. **LCCC-base and WildChat are used locally, not shipped.** Both are inside the exception
   as documented; neither is a dependency of anything the project publishes, and the LCCC
   derived artefacts that *are* committed are counts.
4. **An upstream's licence claim is still a claim.** `ai-zixun/humanizer-zh` declares MIT
   over a compilation that includes Chinese author voice descriptions. The project relies
   on that declaration exactly as it relies on `blader/humanizer`'s, with the holder
   recorded and the text preserved. This is the same class of reliance the project
   *refuses* for corpora, where the claim comes from somebody with no standing over the
   text — the difference being that these files are the upstream's own writing about
   writing, not third parties' words.
5. **The exception's own rule is a habit, not a mechanism.** Nothing prevents a future
   change from quoting corpus text into a document. The Han-run scan in the boundary test
   is the closest thing to a mechanism, and it is a heuristic: it would miss a short
   quotation, a paraphrase, or text in another script.

## Recommendation

**The repository may be published**, on the state audited here, with item 2 of the
residual risk understood: the local corpora are local, and the exception that permits
studying them is documented where a reader will find it.

Two things would make the position stronger rather than merely defensible, and neither is
a blocker:

1. **Add the history probe to a scheduled check** rather than leaving it a command in this
   document. It is slow, which is why it is not in CI, and it is the only check that can
   see a leak that a later commit removed.
2. **Decide the author voices deliberately.** They are the one thing in the tree that
   imitates named living writers. The project already treats them as opt-in craft profiles
   that contribute nothing unless a user asks for one, and that framing is defensible;
   publishing is the moment to say so in the README rather than in this file.
