# The chat behaviour engine

## Scope, stated as a limitation rather than discovered later

**The prose families do not measure chat.** Across four arms and 8,000 chat-length texts in
the paired control, `antiAIScore` was 1.000 — every one of them: structural, lexical,
rhythm, Chinese, English and stylometry found nothing, on human text and machine text
alike. They were built for prose, and at chat length there is nothing for them to count.

That is a **domain limitation, not a defect, and the answer to it is not a threshold
change**. Lowering a cut until short text trips a rule would convert a detector into a
coin toss and take the published false-positive rate with it. The honest statement is the
one a user needs: for a chat message, `antiAIScore` is not the instrument — the behaviour
layer is — and a clean `antiAIScore` on a two-line message means nothing was looked for,
not that nothing was there.

The same measurement says how far the behaviour layer itself reaches: on chat-length input
it is **precise and low-recall**. It catches 4.5% of unconstrained machine replies and 0%
of human ones, and it catches more of them when the machine is given room (0.5% flagged
against the human 0%). It finds a small number of unmistakable cases rather than scoring
everything.

This is the part of the suite that no upstream covers, and the reason the project
exists as more than an aggregator. Everything here is original work, attributed
to `human-voice-suite/local`.

## The problem

The upstream humanizers answer one question well: *does this prose sound like a
person wrote it?* They answer a different question badly or not at all: *does
this reply behave like a person wrote it?*

Those come apart, and they come apart in the case that matters most. Consider:

```text
哈哈，确实挺离谱的！不过从另一个角度来看，这背后其实反映了……
```

A lexicon-based detector reads this as clean. There is no AI vocabulary, no em
dash, no bold text, no bullet list, no "delve". The words are casual and the
register is right.

But nobody talks like this. It agrees reflexively, pivots on a staged contrast,
inflates a throwaway remark into a trend, and is about to produce a symmetric,
fully-formed answer to something that deserved one line back. The prose is
human-shaped. The **behaviour** is a chatbot's.

A suite that only measures prose will score this as a success. That is the
failure this document is about.

## The ten smells

Defined as data in `src/behavior/types.ts` so that detectors, contracts and
benchmarks all reference the same identifiers.

| # | Id | Label | Severity | The tell |
| --- | --- | --- | --- | --- |
| 1 | `chat.mirrors_user` | 复述用户 / Mirrors the user | 4 | Restates the user's turn before responding |
| 2 | `chat.over_agreement` | 过度认同 / Over-agrees | 3 | Agrees reflexively, often with an intensifier |
| 3 | `chat.unsolicited_advice` | 自动建议 / Gives unsolicited advice | 4 | Appends advice nobody asked for |
| 4 | `chat.auto_summary` | 自动总结 / Summarises automatically | 3 | Closes by summarising |
| 5 | `chat.unsolicited_offer` | 主动提供更多帮助 / Offers more help | 4 | Volunteers further assistance |
| 6 | `chat.over_completeness` | 回答过度完整 / Answers too completely | 4 | Covers branches the user did not ask about |
| 7 | `chat.explains_obvious` | 解释明显事实 / Explains the obvious | 3 | Defines what the user just used correctly |
| 8 | `chat.forced_positivity` | 强制正向语气 / Forces a positive tone | 3 | Inserts praise or uplift the situation does not call for |
| 9 | `chat.mechanical_empathy` | 机械共情 / Performs mechanical empathy | 4 | Opens with a formulaic acknowledgement |
| 10 | `chat.unrequested_background` | 不必要的背景补充 / Adds unrequested background | 3 | Supplies history or caveats nobody asked for |

Each entry carries a `detectionHint` phrased as a contract for the Phase 5
detector, and `rewriteGuidance` phrased as an instruction the executing agent can
act on directly.

## Why these ten, and not a longer list

Every one of these is a **behaviour**, not a word. That distinction is the whole
design:

- A word-level tell can be fixed by substitution.
- A behaviour-level tell can only be fixed by **removing something the model
  wanted to add**.

That is why these ten resist the upstream approach. You cannot regex your way out
of over-completeness, because over-completeness is a property of how much was
said relative to what was asked. You cannot enumerate your way out of mirroring,
because mirroring is a relationship between two turns.

It is also why the list is deliberately short. Ten behaviours that can each be
checked against a real conversation beat a hundred phrase patterns that can be
checked against a string.

## The evidence each smell needs

Every smell except `forced_positivity` and `mechanical_empathy` needs the
**preceding user turn**, not just the reply. This is a structural difference from
every upstream detector, and it means the behaviour engine's interface takes a
conversation, not a document.

| Smell | Needs |
| --- | --- |
| `mirrors_user` | the user turn, for overlap measurement |
| `over_agreement` | the user turn, to know whether there was a claim to agree with |
| `unsolicited_advice` | the permission the user turn carried: `granted`, `absent` or `unknown`. Not the turn itself — the rule cannot read a turn for permission, and `unknown` makes it abstain |
| `auto_summary` | the reply alone; closing position is the signal |
| `unsolicited_offer` | the reply alone |
| `over_completeness` | the user turn, to know which branch was asked about |
| `explains_obvious` | nothing: the claim needs the conversation and the implementation does not read it, which is why it is a `deprecated-candidate` |
| `forced_positivity` | the reply alone; the phrase list is the check |
| `mechanical_empathy` | the reply alone; the status decision records that it needs no context gate |
| `unrequested_background` | `requestKind`, which nothing supplies — the gate is always open and the rule is `shadow` because of it |

## What enters `behaviorScore`, and what does not

`behaviorScore` admits **class A only**: a smell contributes if and only if its
construct has been reviewed, it has human false-positive evidence and it has
machine positive evidence. Everything else is reported and charged to nothing.

| Class | Meaning | In `behaviorScore` |
| --- | --- | --- |
| `discriminating` | Reviewed, with evidence on both sides, and with no contextual input it claims to depend on going unsupplied | yes |
| `descriptive` | Real information; specificity or per-item certainty is not enough to charge | no |
| `shadow` | A detector that is not validated, or that depends on input nothing supplies | no |
| `hypothesis` | A composition or a definition rather than a detector | no |
| `deprecated-candidate` | Construct validity not established; the code stays, the claim does not | no |

Three of the ten are class A: `over_agreement`, `forced_positivity` and `mechanical_empathy`.

**Class A is not inherited.** Two rules — `explains_obvious` and `unrequested_background` — used to be in
this class because they were `active` before the classes existed, not because anyone had asked what
evidence they had. The gate review asked. `unrequested_background` reads its "unrequested" half from
`requestKind` through a gate nothing supplies, so the gate is always open and a missing answer is read as
"the user asked for nothing"; `explains_obvious` claims to know what the user already knows while its
implementation never reads the conversation, and it has fired 0 times in 483 measurements. Both are demoted,
and **the evidence table for every rule is in
[`../benchmarks/external/GATE_REVIEW.md`](../benchmarks/external/GATE_REVIEW.md)**.

An unwired gate is now a named thing in the code: `unwiredRequestGate(scope)` in the detector, which
`tests/rule-status-consistency.test.ts` fails on if a scored rule ever reaches for it.

The class lives on each smell in `src/behavior/types.ts` with a `scoringNote`
saying what was measured, and `benchmarks/external/RULE_STATUS_DECISION.md` holds
the decision for every rule. `tests/behavior-scoring.test.ts` and
`tests/rule-status-consistency.test.ts` hold the two in agreement.

### Three outcomes, not two

A rule can find something, find nothing, or **decline to decide** — and the third
is stored as itself. `abstained` and `suppressed` travel beside the findings,
through the assessment, its rationale, the scan result and the benchmark run file,
and they print differently:

- `abstained` — the rule needed evidence the caller did not supply. Not a
  negative result.
- `suppressed` — the evidence ruled the rule out before it was evaluated. Not a
  no-match.
- `quiet` — the rule ran and matched nothing.

`judgedCount` counts an abstention as unjudged, because that is what it is. A
report that folded an abstention into silence would print a rule nobody could
evaluate as a rule that found nothing.

The current case is `unsolicited_advice`, whose verdict depends on whether the
user turn invited advice. That is a three-state input, not a boolean:
`src/behavior/permission/index.ts` maps the frozen solution-permission layer A v1
onto `granted`, `absent` and `unknown`, and `unknown` abstains. See
[`phase-28-advice-permission.md`](./phase-28-advice-permission.md).

## The behaviour baseline and the fast path

For short chat turns the suite does not run a scan. It applies a baseline: the
shape a reply should have, expressed as numbers rather than prose.

`BehaviorBaseline` carries `maxUserOverlapRatio`, `maxAgreementTokens`,
`simpleAnswerSentenceBudget`, and booleans for whether a closing summary, an
unsolicited offer or a follow-up question is permitted at all.

The fast path is `mode detection → behaviour baseline → voice profile → answer`.
No draft, no scan, no validation, no retry.

This is not only a performance decision. Running a full anti-AI pipeline on a
two-line reply pushes the model into over-editing, and over-editing a short
conversational turn is **itself an assistant tell**. The cheap path is also the
more correct one.

## What the engine deliberately does not do

- **It does not make replies shorter for the sake of it.** Conciseness is a
  consequence of removing unsolicited additions, not a target.
- **It does not simulate a personality.** That is the voice profile's job.
- **It does not suppress disagreement, or manufacture it.** `over_agreement`
  targets reflex agreement, not agreement. A person who agrees should agree.
- **It does not attempt to prove a human wrote something.** It reports specific
  behaviours. See `benchmarks/README.md` §6.

## Known gaps, with the instances that exposed them

**Where the engine has been measured, and how far it reaches.** The paired machine
control (`benchmarks/external/PAIRED_CONTROL.md`) put one LCCC context in front of the
human who wrote the next line and three machine conditions, 2,000 items each. Three
smells separated machine chat from human chat and never fired on a human continuation —
`chat.unsolicited_advice`, `chat.forced_positivity`, `chat.over_agreement` — catching
4.5% of unconstrained machine replies, 1.6% of contract-generated ones and 0 of the
human ones; the firings concentrated on the same items across conditions, so they read
the continuation rather than sampling it. Six more smells fired too rarely to classify.
`ASSISTANT_SHAPED` was crossed by 0 of 2,000 human continuations and by 1 or 2 of 2,000
in each machine arm, so **on chat-length input the engine is precise and low-recall**: it
finds a small number of unmistakable cases rather than scoring everything. In the same
measurement the prose families produced `antiAIScore` 1.000 on all four arms, so
chat-length input is the behaviour engine's domain and not theirs. Read that before
treating a clean `behaviorScore` as evidence that a chat reply is fine — it is evidence
that nothing obvious was there.

> **Qualifier, added in Phase B.** The `chat.unsolicited_advice` figures above were
> **measured with `requestKind` unpopulated** — that is, with the rule's permission gate
> disabled, which is how every rate for it was produced until the gate was wired. With the
> gate live the rule abstains where permission is unknown and fires on 8 of 2,000 plain
> continuations rather than 32, and it is `shadow`, so it is no longer one of the three
> that separate the arms by score. `benchmarks/external/ADVICE_PERMISSION.md` is the
> current measurement; the two other rules are unaffected.

`blader/humanizer`'s "When not to act" has three parts. Two are implemented: the
weak-alone corroboration rule, and the exemption for quotations, titles, proper
names and code. The third is not, and the exception belongs where the code points
at it.

| Gap | Why it is not implemented | The instance that exposed it |
| --- | --- | --- |
| **"a passage that discusses the phrase rather than uses it"** | Deciding mention from use needs semantics, not a frame list. And a frame list can only be wrong in the direction that matters: a suppressed finding is silent, while a wrong finding is visible in the report. | `en-prose-0006`, a human-written passage that *names* the tells it describes — `lexical.ai_vocabulary` fires on `pivotal` in "Ordinary facts dressed as pivotal or expert-backed". One false positive from 11 human-written samples, at `antiAIScore` 0.94, which does not cross the 0.7 flagged threshold. |
| **Document-wide corroboration** | The policy says "several tells share a *passage*", and corroboration is counted document-wide, so a finding in paragraph one can vouch for a tell in paragraph nine. | Not observed yet. The cases that would have shown it were fixed by other means in Phase 8. |

The mention case has a home, and it is not the detector. The rewrite contract's
`preserve` list already carries quotations, and `prepare` can tell the executing
agent what the detector cannot decide: when a watched phrase appears only as the
name of a tell, leave it. The harness measures; the agent decides — which is why
`human_voice_prepare` returns a contract rather than a rewrite.

A related defect *was* a detector bug and was fixed rather than deferred, because
it needed no semantics. The template `likely [grew up, studied, began]` was
compiled as a wildcard slot, so `likely` plus any word matched — including "most
likely to come next", which is what produced the severity-5
`assistant.knowledge_limit_disclaimer` false positive on the same sample. A
bracketed list now compiles to alternatives. See `docs/phase-8-rule-changes.md`
change 10.

## Phase 5 deliverables

| Module | Contents |
| --- | --- |
| `src/behavior/assistant-smell/` | Executable checks for the ten smells |
| `src/behavior/chat/` | Turn classification, reply shape, baseline application |
| `src/behavior/conversation/` | Follow-up timing, deliberate omission, self-correction, topic jumps |
| `src/behavior/verbosity/` | Length budget and completeness checking |
| `src/behavior/interaction/` | Burst messaging, question rate, agreement rate, offer suppression |
| `src/detector/assistant/` | The detector-family wrapper that feeds `human_voice_scan` |

The success criterion is falsifiable and lives in the benchmark: the behaviour
engine must separate "AI pretending to be casual" from real human chat, on a
corpus where lexical detection cannot.
