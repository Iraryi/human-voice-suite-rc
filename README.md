# Human Voice Suite

**Human-voice and assistant-shaped writing and interaction analysis.** A multi-source collection for
natural-language human voice, de-AI writing patterns, personal voice learning, chat behaviour fitting and
result validation — built for **DeepSeek Harness**.

It is not a folder full of humanizer files. It is a set of layers that let any humanizer project be added
by writing one adapter, with the rules it contributes deduplicated against everything already present and
attributed at rule level.

```text
upstreams → adapters → canonical rules → detectors → voice profile
          → behaviour engine → rewrite contract → DSH tool surface
```

> **This is a release candidate.** Everything below is implemented and measured; the limitations section
> is part of the measurement rather than a disclaimer, and it is worth reading before you quote any number
> here.

## What this is not

**It is not an AI detector, and it does not answer "was this written by a machine".** Nothing in this
repository produces a probability that a text is AI-generated, and no number it reports may be read as
one. What it produces is an inventory: which named, individually documented writing and interaction
patterns are present in a text, with evidence for each, and four separate measurements of four separate
questions.

The distinction is the design, not modesty:

- **Every finding is a specific rule with a specific firing condition**, not a contribution to a model of
  authorship. A rule says "this phrase appears here"; it does not say "therefore a machine wrote it".
- **The four scores are never fused.** A single "97% human" figure would hide which layer is failing and
  invite a reader to treat a heuristic as a measurement. A runtime guard and two tests enforce the absence
  of such a key.
- **The rules are human writing habits as much as machine ones.** `chat.over_completeness` fires on 75.8%
  of human continuations and 75.5% of machine ones. The behaviour score charges only the rules measured to
  separate the two; the rest are reported and charged to nothing.
- **The honest limits are in the same section as the numbers.** Where a rule has no measured specificity,
  no precision figure, or no positive prediction at all, the report says so on the spot.

If you need authorship attribution, this is the wrong tool. If you need to know which patterns are present
in a text, why each one is flagged, and how far the evidence reaches, this is the tool.

## The four scores

Reported separately, always, and never combined. A score listed in `unmeasured` was not measured and must
not be quoted as a result.

| Score | The question it answers | What it is not |
| --- | --- | --- |
| `antiAIScore` | How much AI-shaped **prose** is present: vocabulary, structure, rhythm, stylometry | Not an authorship verdict |
| `voiceScore` | How close the text is to a **voice profile** you supplied | Not a quality judgement — a text below 1 is simply not that writer |
| `behaviorScore` | How much the reply **behaves** like an assistant rather than a person in a conversation | Not a probability, and not a complete inventory |
| `preservationScore` | What the rewrite **kept**: URLs, code, paths, numbers, names, quotations | Not a style score — below 1 is a lost fact |

### Prose and behaviour are different questions

The reason this project exists as more than an aggregator is one sentence:

```text
哈哈，确实挺离谱的！不过从另一个角度来看，这背后其实反映了……
```

Scored on tells alone that text gets `antiAIScore` 0.90 — no AI vocabulary, no em dash, no bold, reads as
casual. A lexical detector calls it clean. The behaviour engine finds reflexive agreement, a staged pivot
into unrequested background, and a reply sized for an essay rather than a throwaway remark. The words are
human; the behaviour is a chatbot's.

Ten behaviours are implemented: mirroring, over-agreement, unsolicited advice, auto summary, unsolicited
offers, over-completeness, explaining the obvious, forced positivity, mechanical empathy and unrequested
background. Three of them are not lexical at all — mirroring is measured as overlap between the reply's
opening and the user's turn, over-completeness as the reply's size against the question's — and those need
the turn before them, so a scan without a conversation **says which behaviours it could not judge** rather
than reporting a thin result as a pass.

## What charges `behaviorScore`, and what does not

Not all ten behaviours charge it. A total that mixed evidence of five different maturities would not mean
one thing, so each behaviour carries a class and **only class A contributes to the score**. The rest are
still reported, reported as what they are.

| Class | Meaning | In `behaviorScore` | The ten |
| --- | --- | --- | --- |
| `discriminating` | Reviewed, with human false-positive evidence and machine positive evidence, and with no contextual input the rule claims to depend on going unsupplied | **yes** | `over_agreement`, `forced_positivity`, `mechanical_empathy` |
| `descriptive` | Real information, but specificity or per-item certainty is not enough to charge for | no | `auto_summary`, `over_completeness` |
| `shadow` | A detector that is not validated, or that depends on input nothing supplies | no | `unsolicited_advice`, `unsolicited_offer`, `unrequested_background` |
| `hypothesis` | A composition or a definition rather than a detector | no | solution-mode shift |
| `deprecated-candidate` | Construct validity not established; the code stays, the claim does not | no | `mirrors_user`, `explains_obvious` |

**Three rules charge the score, and each of them can say why.** There is no class A by inheritance: the two
rules that used to be there were asked what evidence they had and did not have it. `unrequested_background`
read its "unrequested" half from a caller-supplied list nothing populates, so its gate was always open and a
missing answer counted as "the user asked for nothing"; `explains_obvious` claims to know what the user
already knows while its implementation never reads the conversation, and it had fired 0 times in 483
measurements. Both are still reported and neither is charged. The evidence table for every rule, scored or
not, is in [`benchmarks/external/GATE_REVIEW.md`](./benchmarks/external/GATE_REVIEW.md).

**`behaviorScore` is not a probability of anything.** Its rationale names the rules it is the sum over, so
you can always answer "what does this number mean" without reading the taxonomy:

```text
No assistant smell found among 9 of 10 behaviours judgeable; chat.unsolicited_advice abstained on unknown advice permission.
```

That last clause matters. A behaviour that needs context the caller did not supply **abstains and says
so**; it is neither a finding nor a pass, and it is counted in neither direction. The class of every rule,
and the evidence behind the decision, is in
[`benchmarks/external/RULE_STATUS_DECISION.md`](./benchmarks/external/RULE_STATUS_DECISION.md).

`benchmarks/external/MIGRATION.md` records what happened to every score when the classes and the
abstention contract were introduced: the class change moved `behaviorScore` 0.9599 → 0.9808 on 16 samples
and nothing else, and the abstention contract moved **no score at all** — zero of 483 measurements — while
changing what one rule reports on 441 of them.

## The eight upstreams, and what "multi-source" means here

Eight humanizer projects are in the manifest; seven contribute extracted rules and one is research-only by
design. Their rule sets overlap heavily — the single most important fact about this corpus is that most of
it is the same work at different revisions — so signature-level and phrase-level deduplication run before
anything is scored, and 79 contested phrases are resolved by an explicit ownership table rather than by
load order.

**You never see an upstream in the output.** The tools expose capabilities; provenance appears inside a
result, at rule level, which is where it belongs. `upstreams/manifest.json` pins the exact commit each
upstream was read at, and `licenses/` carries a verbatim copy of every upstream licence.

## External corpora: measurement only, and never redistributed

Several measurements in `benchmarks/external/` were taken on corpora this project may study but may not
ship — LCCC (Chinese social-media conversation), V2EX, HelpSteer3, and responses generated locally for
controlled arms. **None of that text is in this repository, in any commit, at any point in its history.**

What is committed is the numbers. The corpora are fetched into a gitignored directory, measured there, and
reported as aggregates. Where a corpus's licence status is unclear for redistribution, the local evaluation
exception and its reasoning are in [`docs/licence-audit.md`](./docs/licence-audit.md), including the one
claim this project explicitly refuses to make (HelpSteer3's responses are not from OpenAI; its *prompts*
are a different matter, and the document says so).

Three mechanisms keep that boundary honest rather than declared: a boundary test over the working tree, a
history probe that reads every revision ever committed, and a release audit. All three run in CI.

## Running it

```bash
npm ci
npm test          # the full suite; tests that need the upstream clones skip and say so
npm run typecheck
npm run build
```

The upstreams' own repositories are a **local working cache**, not committed: the manifest records the
pinned commit instead. The gate that needs them says so rather than passing quietly:

```bash
npm run upstream:check      # clones/reads .upstream-cache/ and verifies the pins
npm run licenses:verify     # every preserved licence still matches its upstream
```

The artefacts that are generated from source and committed — `PHRASE_OWNERSHIP.md`,
`BENCHMARK_RESULTS.md`, the corpus's advice-permission annotations and the voice profile set — each have a
`--check` mode that fails when the file on disk is no longer what the code produces. Three of the four run
in CI on every push.

```bash
npm run bench:run && npm run bench:report    # the corpus benchmark, then render its report
npm run bench:report -- --check              # needs a run file; see below
npm run release:audit                        # ten checks over the tracked tree
npm run provenance:probe -- --full           # every revision, for third-party prose
```

**Two gates are local-only, and they say so rather than passing quietly.** `bench:report -- --check` needs
the run file it was rendered from, and `benchmarks/runs/` is gitignored — so on a fresh checkout it reports
that it cannot verify and exits 0, because the absence of a run is not evidence that the report is stale.
`licenses:verify` and `upstream:check` compare against the eight upstream clones, which CI has no business
cloning to re-derive a commit pin. Everything the clone-dependent tests assert is guarded, so a fresh
checkout skips those and says so: on a fresh clone `npm test` reports roughly one test in six as skipped,
all of it the extraction and clone-consistency work, and no gate, boundary, provenance or scoring test
among them.

### As a DeepSeek Harness plugin

`cordis.patch.yml` registers six tools: `human_voice_scan`, `human_voice_prepare`, `human_voice_validate`,
`human_voice_chat`, `human_voice_voice` and `human_voice_profile`. They read text and return
measurements; **they never call a model**, never touch the network, and never write to the session log.
`human_voice_prepare` returns a rewrite *contract* — what to preserve, what to remove — and the calling
agent executes it. A tool that rewrote text itself would make the validation meaningless.

## Voice profiles, and why the interesting ones are not here

A voice profile is a measurable description of how someone writes: sentence-length distribution,
punctuation habits, vocabulary fingerprint, and for chat, interaction behaviour. `human_voice_profile`
builds one from your own writing samples.

**The repository ships one profile: `author/plainspoken-demo`.** It is written for this repository, it
imitates nobody, and it exists so that the profile, import and generation paths have something to run
against on a fresh checkout.

**The eight author voices are not distributed, and that is deliberate.** They are generated locally from an
upstream clone by `npm run voice:import`, and the generated file is gitignored. An author's writing is
theirs; a profile learned from it is a derived description of a real person's style, and shipping that is a
different act from shipping code. If you have a legitimate local copy, generate them yourself:

```bash
npm run upstream:check     # populate the local clone cache
npm run voice:import       # build the profiles into .external-corpora/author-voices/
npm run voice:check        # confirms the generated set is present, or says it is not
```

To add your own:

```ts
// samples in your own language and your own register
const profile = await toolkit.profile({ action: 'build', scope: 'chat', samples: [...] });
```

Profiles are scoped — `user/chat` and `user/formal` are different voices and averaging them describes
nobody — and scoring against a profile with nothing comparable in it reports the dimension as
**unmeasured** rather than scoring it perfect.

## Limitations, and the experimental parts

Read this as part of the results, not after them.

**The behaviour engine is precise and low-recall on chat-length input.** On 2,000 paired continuations it
found a small number of unmistakable cases rather than scoring everything; `chat.over_completeness` alone
fires on three quarters of both human and machine continuations of five sentences or more, which is why it
is descriptive rather than scored. A clean `behaviorScore` means nothing obvious was there.

**Coverage, not concept count, is the bottleneck.** The largest gap this project has measured is a reply
that hands over an action plan when nobody asked for one: in the prompt bank, 8 of 8 unconstrained answers
to a complaint were a plan of action, and the lexical rule for advice caught 1. The structural features
that exist for it are frozen in shadow and passed a blind run; the detector has not been promoted.

**Two rules are suspended rather than removed.** `chat.unsolicited_offer` enriches 8.88× for offers the
user did not ask for, with 98.6% of its positives assistant-shaped — but the review's negatives were model
replies, so the human false-positive half of the evidence is missing and it stays `shadow` as a recorded
promotion candidate. `chat.unsolicited_advice` has a wired permission gate now, but every rate ever
published for it was measured with that gate disabled, so the old numbers describe a different rule.

**Two rules were charging the score without the evidence to, and no longer are.** `chat.explains_obvious`
and `chat.unrequested_background` kept the class they had before the classes existed, rather than earning
it. The second read its whole "unrequested" half from a caller-supplied list that nothing in the project
populates — so its gate was always open, a missing answer counted as "the user asked for nothing", and every
figure ever published for it was produced in that state. The first claimed to know what the user already
knows while never reading the conversation, and had fired 0 times in 483 measurements. Both are demoted,
both are still reported, and the gate is now a named function a test guards. See
[`benchmarks/external/GATE_REVIEW.md`](./benchmarks/external/GATE_REVIEW.md).

**One scored rule rests on thin evidence.** `chat.mechanical_empathy` has never fired on a human-written
sample of any corpus — that is the specificity half — and has fired 10 times on machine text across two
corpora, which is the sensitivity half. Its construct is reviewed and it has no unwired gate, so it is
legitimately in the class, but the numbers are small and its lexical coverage is known to be narrow.

**The permission layer is Chinese-only and conservative.** It granted permission 0 times in 2,000 real
Chinese chat turns and abstained on 77.5% of them, and it has no traditional-Chinese path: on an explicit
request for help written in traditional Chinese it returns `LOW`, the state that *allows* a rule to accuse.

**`chat.mirrors_user` is a `deprecated-candidate`.** Its construct did not survive review — it fires mostly
on replies reusing the question's own entities — so the code stays and the claim does not.

**The external figures are not all reproducible.** Some depend on corpora that cannot be redistributed, and
the reports say which. Where a number is an upper bound pending calibration, it is marked as one.

## Licence

MIT for this project's own work — see [`LICENSE`](./LICENSE). **That licence does not extend to third-party
material**, which keeps its own; every component's licence is reproduced in
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) and [`licenses/`](./licenses). No third-party corpus is
redistributed here.

## Where to read more

| Document | What it covers |
| --- | --- |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | The layering, and the invariants that hold it together |
| [`docs/behavior-engine.md`](./docs/behavior-engine.md) | The chat behaviour engine, and the five classes |
| [`docs/dsh-plugin.md`](./docs/dsh-plugin.md) | Installing and operating the six tools |
| [`docs/licence-audit.md`](./docs/licence-audit.md) | The corpus boundary, and the claims this project refuses to make |
| [`benchmarks/README.md`](./benchmarks/README.md) | Benchmark design, and the hypothesis it falsified |
| [`benchmarks/external/README.md`](./benchmarks/external/README.md) | Every external measurement, in one ledger |
| [`benchmarks/external/RULE_STATUS_DECISION.md`](./benchmarks/external/RULE_STATUS_DECISION.md) | The class of every rule, and why |
