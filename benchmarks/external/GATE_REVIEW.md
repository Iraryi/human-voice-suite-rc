# Gate review: which rules may charge `behaviorScore`

<!-- Hand-written at the release gate. Numbers from the stored run and the local corpora; no source text. -->

The release candidate's own report said two scored rules were class A "by inheritance" and that one of them
charged on an **unwired gate**. That is not a qualification, it is a contradiction: the frozen class A
conditions are a reviewed construct, human false-positive evidence, machine positive evidence, the gate the
rule actually runs on being wired, and the call chain supplying the information the rule claims to depend
on. A rule that fails any of them may be reported and may not be scored.

This is the review. **Two rules were demoted and `behaviorScore` was recomputed.** No detector was
rewritten, no rule was added, and A v1 and the action-plan features were not touched.

## 1. The gate question, answered

### Which gate, and who supplies it

`chat.unrequested_background` reads one contextual input:

```ts
const requested = new Set((context.requestKind ?? []).map((kind) => kind.toLowerCase()));
if (background.length > 0 && !requested.has('background')) { /* the rule applies */ }
```

`requestKind` is a caller-supplied list of what the user asked for. **No caller in this project populates
it.** Exhaustively:

| Call site | Supplies `requestKind`? |
| --- | --- |
| `benchmarks/lib/score.ts` — every benchmark run, all 483 measurements, all seven configurations | no |
| `benchmarks/external/*` — paired control, length-matched, HelpSteer3, coverage matrix, reviews | no |
| the committed corpus front matter | no field for it; `advice_permission` was added in Phase B and this was not |
| `human_voice_scan` (DSH tool) | no parameter for it |
| `human_voice_chat` (DSH tool) | a parameter, which the calling agent may or may not send — nothing prompts it to, and the schema calls it legacy |

### What the rule does when the gate is unfilled

`requestKind` is `undefined`, so the set is empty, so `!requested.has('background')` is **always true**. The
rule applies unconditionally, and the absence of `background` in a list nobody wrote is read as *"the user
did not ask for background"*. That is exactly the defect `chat.unsolicited_advice` had before Phase B, in
the one rule that still has it.

Every firing this project ever published for `chat.unrequested_background` — 7 samples on the committed
corpus, 21 measurements — was produced in that state. So was every non-firing. The rule has never once been
evaluated as its name describes it.

### The fix

It is demoted to `shadow`, and the gate is now a named function in the detector —
`unwiredRequestGate(scope)` — with the defect written down where the code is. `tests/rule-status-consistency.test.ts`
fails if a **scored** rule ever uses it. Wiring it means giving the rule the input the gate asks for, which
is the tri-state treatment the advice rule got, and that is a change with a score diff rather than a quiet
repair.

## 2. The contributor evidence table

Every rule that has ever been in `behaviorScore`, and every rule that is in it now. `construct review` is
`RULE_STATUS_DECISION.md` unless stated otherwise; "corpus" is the committed 69-sample corpus, "paired" is
the 2,000-item LCCC paired control, "HelpSteer3" is the external corpus.

| Rule | Construct | Construct review | Human FP evidence | Machine positive evidence | Context / gate dependency | Gate wired? | Maturity | Scored |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `chat.over_agreement` | Reflexive agreement in a turn that did not need agreeing with | **§10**, eleven questions | paired **0/2000** human continuations; corpus human-written **0** | paired plain 26 (1.3%), default 11 (0.5%), post 25 (1.3%); corpus 6 model samples | claims none (`Context gate required? No`); reads no context field | n/a | `active`, frozen | **yes** |
| `chat.forced_positivity` | Information-free praise and encouragement | **§9**, eleven questions | paired **0/2000**; corpus human-written **0** | paired plain 33 (1.7%), default 8 (0.4%), post 22 (1.1%); corpus 4 model samples | claims none; reads no context field | n/a | `active`, frozen | **yes** |
| `chat.mechanical_empathy` | Formulaic acknowledgement of a feeling | **§8**, eleven questions, tagged expansion candidate | paired **0/2000**; corpus human-written **0**. Thin: the rule does not fire on that corpus at all, so this is a specificity measurement with no sensitivity alongside it | corpus 3 model samples; HelpSteer3 7 (0.1%); 4 same-family misses archived in `MISS_ARCHIVE.md` | claims none (`Context gate required? No`); reads no context field | n/a | `active`; lexical coverage known insufficient | **yes** |
| `chat.explains_obvious` | Explains what the user already knows, or restates a shared premise | **none — the decision record does not mention it** | paired 0/2000, but the rule fires 0 times there, so the zero is not specificity evidence | corpus **0 of 483 measurements**; paired 4 of 8,000, below the classification floor; HelpSteer3 7 (0.1%) | **the claim needs the conversation** ("the user themselves introduced", "in the same conversation"); the implementation never reads it and the call chain never passes it | **no** | none | **no** → `deprecated-candidate` |
| `chat.unrequested_background` | Supplies history, context or caveats the user did not ask for | **none — the decision record does not mention it** | paired 0/2000, and the rule fires 0 times there | corpus 7 model samples (21 measurements); HelpSteer3 11 (0.2%); paired 0 | **`requestKind` membership** — the whole "unrequested" half | **no** — nothing supplies it, so the gate is always true | none | **no** → `shadow` |
| `chat.auto_summary` | Closing summary formulas | **§5** | paired 390 matched negatives: 48 (12.3%) | paired 145 of 390 triggers (37.2%); enrichment 3.02× | judging whether the summary was wanted needs a turn; detection does not | n/a | `descriptive` | no |
| `chat.over_completeness` | Reply sized against the question | **§7** | length-matched: 75.8% of human continuations | 75.5% of machine ones — indistinguishable | user turn, supplied wherever a conversation is | yes | `descriptive` | no |
| `chat.mirrors_user` | Restating the user's turn | **§6** | paired 2 of 73 matched negatives | 4 of 73 triggers — six positives, no discrimination | user turn, supplied | yes | `deprecated-candidate` | no |
| `chat.unsolicited_advice` | Advice where none was invited | **§1** | paired **0 of 2,000** human continuations, with the gate forced open | paired plain 8, default 4, post 3 under the live gate | tri-state `advicePermission`, **wired** in Phase B | **yes** | `shadow` — the wiring is not a validation | no |
| `chat.unsolicited_offer` | Volunteers further help | **§11** + `OFFER_REVIEW.md` | **missing** — the review's negatives are model replies | blind matched review: 71/90 triggers against 8/90 negatives, 8.88× | none in practice: 94.4% of its positives need no user turn | n/a | `shadow`, recorded promotion candidate | no |

**Three rules may charge `behaviorScore`.** Each has a reviewed construct, human false-positive evidence
and machine positive evidence, and none of them reads a contextual input that nothing supplies. There is no
longer any rule whose qualification is that it used to be active.

## 3. What the demotion moved

Recomputed over the committed corpus, comparing the run before this review with the run after it.

| | Before | After |
| --- | --- | --- |
| `antiAIScore` | 0.9528 | 0.9528 |
| `voiceScore` | 0.9070 | 0.9070 |
| `behaviorScore` | **0.9808** | **0.9865** |
| `preservationScore` | 1.0000 | 1.0000 |
| `behaviorScore` distribution | 429 at 1.00, 36 in 0.80–0.90, 18 below 0.80 | 443 at 1.00, 4 in 0.90–0.95, 25 in 0.80–0.90, 11 below 0.80 |
| Measurements changed | — | 21 `behaviorScore` values, across **7 samples**, every one `model-generated` |

`chat.unrequested_background` kept firing — 21 measurements, all of them on model-generated samples — and
now charges nothing. `chat.explains_obvious` fired 0 times, so its demotion changes no number; it changes
what the project may claim, which is the point.

Cumulative across all three migrations, `behaviorScore` has gone 0.9599 → 0.9808 → 0.9865, and each step is
a rule leaving the sum rather than a threshold moving.

## 4. What this review also changed

Every `detectionHint` in the taxonomy now describes **what the detector does**, not what the concept would
ideally require. Four hints claimed a condition no code checks — "agreement that is not followed by a
qualification", "praise that carries no information", "empathy openers where no emotional disclosure
occurred", "a term the user themselves introduced" — and a reader could not tell an implemented condition
from an aspiration. The hints now say which they are.

That is a documentation fix and it is deliberately not a licence change: a rule whose hint describes a
narrower condition than it checks is a rule that over-fires, and the paired control measures the
over-firing. `chat.over_agreement` and `chat.forced_positivity` measured 0 human firings in 2,000
continuations under their actual implementations, which is the evidence that matters.

## 5. What this review does not change

- **A v1 is untouched**, and so is the action-plan feature set. Neither was in scope.
- **No rule was added, removed or reweighted.** Two rules changed class and nothing else.
- **Historical reports are not rewritten.** The paired control, length-matched, HelpSteer3, prompt bank and
  miss analysis keep the numbers they were published with, each carrying the banner that says what its
  advice rows were measured with.
- **`chat.mechanical_empathy` stays scored**, with the thinness of its evidence recorded here rather than
  smoothed over: it has never fired on a human-written sample of any corpus, which is the specificity
  evidence, and it has fired 10 times on machine text across two corpora, which is the sensitivity evidence.
  Both are small. It is in the release limitations as a coverage question, not a legitimacy one.

## 6. Reproducing the demotion

```bash
npm test                                  # the class table, the gate guard and the score admission
npm run bench:run && npm run bench:report # the recomputation and the re-rendered report
npm run release:audit                     # confirms every scored rule carries its evidence, in code
```

The gate guard is the part that lasts:
`tests/rule-status-consistency.test.ts` reads the detector's source, finds every use of
`unwiredRequestGate`, and fails if the rule behind it is scored. A future rule that reaches for an input
nothing supplies cannot quietly charge for it.
