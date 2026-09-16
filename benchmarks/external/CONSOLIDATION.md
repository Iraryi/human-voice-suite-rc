# Consolidation: concepts, implementations, and what each one actually measures

<!-- Hand-written from the measurements in this directory. Counts and codes; no source text. -->

The project has been treating rules as one kind of thing. They are two: a **behaviour concept**, which
can be right, and an **implementation**, which can be wrong without the concept being wrong. One concept
may have several implementations, and the table below lists them separately rather than squeezing them
into a single verdict.

## A correction found while assembling this table

The row for `chat.unsolicited_advice` in the ledger said the rule "cannot be evaluated response-only,
because its precondition is invisible". Reading the code to fill in the `observable scope` column shows
that is not quite right, and the correction matters:

```ts
const requested = new Set((context.requestKind ?? []).map((kind) => kind.toLowerCase()));
if (!requested.has('advice')) { /* the rule applies */ }
```

**The rule has a context hook.** It reads the user turn through `requestKind` — a caller-supplied list
of what the user asked for — and suppresses itself when `advice` is in it. The implementation is not
response-only by design.

**But nothing in this project ever populates that hook.** Every measurement here — the paired control,
HelpSteer3, both blind sheets — passed a `userTurn` and no `requestKind`. So:

- every rate this project has published for `chat.unsolicited_advice` describes the rule **with its
  permission gate disabled**;
- the nineteen "legitimate advice after permission" replies are not proof that the rule ignores
  permission; they are proof that **no layer in the suite computes permission from the user turn**;
- the missing piece is the permission layer that was built for the solution-mode work, which is
  currently wired to nothing.

That reframes the recommendation: the rule does not need a phrase list and does not first need a rename.
It needs its existing gate fed.

## The table

`observable scope` is what the implementation actually reads today. `claimed construct scope` is what
its name and documentation say it judges. A row whose two differ is a rule looking at less than it
claims.

### Advice behaviour

| | `chat.unsolicited_advice` (lexical heuristic) | action-plan structure (frozen, shadow) | solution permission (A v1, shadow) | future composition |
| --- | --- | --- | --- | --- |
| **Concept** | Unsolicited advice | Unsolicited advice | Unsolicited advice | Unsolicited advice |
| **Construct actually measured** | Presence of five advice phrases, in a reply whose user turn is not marked as having asked | Whether the reply is shaped like a procedure | How much room the user's turn gave for a plan | Advice present **and** permission insufficient |
| **Observable scope** | Response + an unpopulated `requestKind` hook | Response only | User turn only | User turn + response |
| **Claimed construct scope** | Unsolicited advice | Action-plan structure | Not applicable — the layer is named for what it measures | Unsolicited advice |
| **Scope mismatch** | **`response-vs-context`** — the gate exists but is never fed | `none` — it claims structure and measures structure | `none` | Not implemented |
| **Context needed for behaviour detection** | No | No | — | Yes, by construction |
| **Context needed for normative judgment** | **Yes, and never supplied** | Yes, to say whether a plan was wanted | — | Yes |
| **Human false-positive evidence** | 0 of 2,000 paired human continuations; 1 of 120 sampled uncaught replies was an advice-shaped miss | 0 of 24 complaint replies on the blind set | 0 confident errors on its blind set; abstains often | — |
| **Machine positive evidence** | 1.6% of unconstrained machine continuations; 8 of 8 prompt-bank complaints were plans and it caught 1 | 23 of 24 obvious plans on the blind set | Commitment rises with permission on 19 of 20 topics | — |
| **Blind evidence** | No blind review of this rule itself; its lexical-only cell was classified blind to the rule's name | Blind: 23/24 plans, 0/24 complaints flagged | Blind: 7 of 20 decided, 0 confident errors | — |
| **Matched-negative evidence** | Not measured for this rule | Not measured | Not applicable | — |
| **Cross-dataset evidence** | LCCC, V2EX, HelpSteer3, prompt bank, both solution sets | Solution sets and HelpSteer3 (coverage matrix) | Solution sets | — |
| **Known confounds** | Legitimate requested advice (19 of 45 lexical-only); generic/hypothetical (6); third-party (6); phrase-level false positives (7) | Length: a plan needs room, and the long bucket is where plans live | Abstention on genuinely ambiguous turns | — |
| **Miss coverage** | 7 of 13 assistant-shaped misses in the paired control | 6 of 13 | 0 of 13 (no A3 misses) | — |
| **Annotation confidence** | Medium: 45 classified, 0 uncertain, single reviewer per item | High on the blind set; 4 of 45 lexical-only replies carried structure it missed | Medium: 3 of 20 blind turns came back abstained where a code was expected | — |
| **Evidence type** | `lexical` | `structural` | `contextual` | — |
| **Validation maturity** | `cross-dataset` + `manually reviewed` | `blind` | `calibration` + `blind` | — |
| **Current status** | `active` | `frozen` shadow | `frozen` shadow | concept only |
| **Recommended status** | `descriptive` until its gate is fed, then re-measure | `shadow` — keep | `shadow` — keep | `hypothesis` |
| **Recommended action** | **`context-gate`** — wire `requestKind` to the permission layer, then re-measure. Not `expand phrase list` | `freeze`; 4 of 45 structural misses recorded, not enough to justify a v2 blind run | `freeze` | `investigate` later |

### Summary behaviour

| | `chat.auto_summary` |
| --- | --- |
| **Concept** | Automatic summarising of what the user said |
| **Construct actually measured** | Presence of summary formulations in a reply |
| **Observable scope** | Response only |
| **Claimed construct scope** | Automatic summary |
| **Scope mismatch** | `none` for its own name; the name is narrow enough to be honest |
| **Context needed for behaviour detection** | No |
| **Context needed for normative judgment** | Yes — 37 of 390 matched negatives carried a summary the user had asked for |
| **Human false-positive evidence** | Not measured on human text in this design |
| **Machine positive evidence** | 8.01% of Chinese HelpSteer3 replies; fires at 9.9–12.3% above 200 characters |
| **Blind evidence** | 390 triggers vs 390 matched negatives, labelled blind |
| **Matched-negative evidence** | **145/390 (37.2%) vs 48/390 (12.3%) — enrichment 3.02×**, holding in every length bucket and both turn counts |
| **Cross-dataset evidence** | HelpSteer3 only, plus its near-absence in short chat |
| **Known confounds** | A minimum-length floor below 200 characters; 29.7% of triggers are task-required restatement, 29.0% detector artifact, 4.1% explicitly requested |
| **Miss coverage** | None of the 13 assistant-shaped misses |
| **Annotation confidence** | **Low per item**: only 6 of 118 high-confidence triggers were recaps (1 of 161 negatives). The enrichment is solid; the per-item certainty is not |
| **Evidence type** | `lexical` |
| **Validation maturity** | `blind` + `matched negatives` + `cross-dataset` |
| **Current status** | `active` |
| **Recommended status** | `descriptive` |
| **Recommended action** | `narrow wording only` — state it as a statistical enrichment on unnecessary recap with limited specificity, keep it out of identity claims |

### Mirroring

| | `chat.mirrors_user` |
| --- | --- |
| **Concept** | Restating the user back to themselves |
| **Construct actually measured** | Opening overlap with the user turn, above a ratio **and** a coverage floor |
| **Observable scope** | User + response |
| **Claimed construct scope** | Mirroring the user |
| **Scope mismatch** | `none` in scope; the failure is construct validity, not scope |
| **Context needed for behaviour detection** | Yes, by construction |
| **Context needed for normative judgment** | Yes |
| **Human false-positive evidence** | 23 of 263 V2EX pairs before the coverage fix, 2 after — the fix works |
| **Machine positive evidence** | 1.5% of HelpSteer3 Chinese replies; 73 triggers paired with 73 matched negatives |
| **Blind evidence** | 73 vs 73, labelled blind |
| **Matched-negative evidence** | **4/73 (5.5%) vs 2/73 (2.7%) — 2.00× on six positives.** Not discrimination |
| **Cross-dataset evidence** | V2EX, LCCC, HelpSteer3 |
| **Known confounds** | 47 of 73 triggers are required entity reuse; 20 are task restatement. The rule cannot separate reusing the question's terms from restating its content |
| **Miss coverage** | None of the 13 |
| **Annotation confidence** | The trigger codes were clear (0 uncertain); 7 matched negatives were labelled detector-artifact with no explanation |
| **Evidence type** | `lexical` + `structural` overlap test |
| **Validation maturity** | `blind` + `matched negatives` + `cross-dataset` |
| **Current status** | `active` |
| **Recommended status** | `descriptive` |
| **Recommended action** | `narrow wording only` now; `investigate` whether the concept survives as anything other than entity reuse before any reimplementation |

### Over-completeness

| | `chat.over_completeness` |
| --- | --- |
| **Concept** | Answering at more length than the turn invited |
| **Construct actually measured** | Reply sentence count against the user turn, above four sentences and a ratio of three |
| **Observable scope** | User + response |
| **Claimed construct scope** | Answering too completely |
| **Scope mismatch** | `style-vs-behavior` — it counts shape |
| **Context needed for behaviour detection** | No |
| **Context needed for normative judgment** | No |
| **Human false-positive evidence** | 60 of 2,000 human continuations (3.0% balanced, 1.0% re-weighted) |
| **Machine positive evidence** | 0 of 6,000 paired machine continuations — because none had five sentences |
| **Blind evidence** | Not reviewed blind; its length-matched result is the evidence |
| **Matched-negative evidence** | Length-matched: among replies of five sentences or more it fires on **75.8% of human and 75.5% of machine** continuations |
| **Cross-dataset evidence** | LCCC, the committed corpus, HelpSteer3 (58.2% of long Chinese replies) |
| **Known confounds** | Length and sentence count entirely; it measures shape |
| **Miss coverage** | Not applicable |
| **Annotation confidence** | Not applicable |
| **Evidence type** | `structural` |
| **Validation maturity** | `cross-dataset` + `matched negatives` |
| **Current status** | `descriptive` (demoted in phase 15) |
| **Recommended status** | `descriptive` |
| **Recommended action** | `freeze` |

### The three rules the paired control found working

| | `chat.forced_positivity` | `chat.over_agreement` | `chat.unsolicited_offer` |
| --- | --- | --- | --- |
| **Concept** | Praise the situation does not call for | Agreement that was not needed | Offering further help |
| **Construct actually measured** | Presence of five praise phrases | Presence of agreement phrases, with a position rule | Presence of offer phrases |
| **Observable scope** | Response only | Response only | Response only |
| **Claimed construct scope** | Forced positivity | Reflexive agreement | Unsolicited offers |
| **Scope mismatch** | `none` | `none` | `none` |
| **Context needed for detection** | No | No | No |
| **Context needed for judgment** | Yes, in principle: praise after a request for reassurance is wanted | Yes, in principle: agreement with a claim worth agreeing with | Yes, in principle: an offer after a request for help |
| **Human false-positive evidence** | 0 of 2,000 paired human continuations | 0 of 2,000 | Not measured on the paired control |
| **Machine positive evidence** | 1.7% plain, 0.4% default, 1.1% post | 1.3%, 0.5%, 1.3% | 2.1% of HelpSteer3 replies |
| **Blind evidence** | None yet | None yet | None yet |
| **Matched-negative evidence** | None yet | None yet | None yet |
| **Cross-dataset evidence** | LCCC paired control, prompt bank, HelpSteer3 (0.8%) | same (0.5%) | HelpSteer3 only |
| **Known confounds** | Encouragement in the unmarked form is missed (miss reclassification) | Agreement openers outside the list are missed | Not examined |
| **Miss coverage** | 0 of 13 | 0 of 13 | 0 of 13 |
| **Annotation confidence** | Not applicable | Not applicable | Not applicable |
| **Evidence type** | `lexical` | `lexical` | `lexical` |
| **Validation maturity** | `cross-dataset`, no matched negatives, no blind review | same | `anecdotal` to `cross-dataset` |
| **Current status** | `active` | `active` | `active` |
| **Recommended status** | `active` | `active` | `hypothesis` |
| **Recommended action** | `investigate` with the same matched-negative method before trusting the specificity | same | `investigate` |

## What the table says

1. **Three kinds of rule, and they need three maintenance strategies.**
   - *Concept right, implementation too narrow*: `chat.unsolicited_advice`, `chat.mechanical_empathy`,
     and the action-plan layer's four misses.
   - *Implementation enriched on its construct, specificity limited*: `chat.auto_summary`.
   - *Construct validity not established*: `chat.mirrors_user`, and `chat.unsolicited_offer` (never
     examined).
2. **One scope mismatch, and it is the interesting one.** `chat.unsolicited_advice` is the only rule
   whose name claims a contextual property its inputs never receive — and the fix is not a wider phrase
   list but feeding the hook that already exists.
3. **Two rules are `descriptive` on evidence and neither was demoted for being wrong**: one because it
   measures shape, one because its per-item certainty is low even though its enrichment is solid.
4. **Nothing here is a `deprecated-candidate` yet**, and nothing is removed. That is the status
   decision's job, and it is the next piece of work.
