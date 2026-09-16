# Rule status decision

<!-- One decision for every rule, taken together rather than one at a time. Nothing is implemented yet. -->

> **Later revisions, recorded rather than folded in.** This document decided eleven rules and did not
> mention `chat.explains_obvious` or `chat.unrequested_background`, which therefore kept the class they had
> by default. The release gate asked what evidence they had and demoted both — `explains_obvious` to
> `deprecated-candidate`, `unrequested_background` to `shadow`, the latter because its "unrequested" half is
> read through a gate nothing supplies. `chat.unsolicited_offer` was reviewed after this document and stayed
> `shadow` as a recorded promotion candidate. The decisions below are unchanged; the evidence table for
> every rule, scored or not, is [`GATE_REVIEW.md`](./GATE_REVIEW.md).

Every rule answers the same eleven questions, and the answers are recorded before any of them is
implemented, so that the implementation cannot quietly renegotiate a decision.

## A fixed definition, and a qualifier that now travels with the old numbers

`chat.unsolicited_advice` is not a response-only rule that claims to be about solicitation. It has a
context hook:

```ts
const requested = new Set((context.requestKind ?? []).map((kind) => kind.toLowerCase()));
if (!requested.has('advice')) { /* the rule applies */ }
```

**No caller in this project has ever populated `requestKind`.** The paired control, the HelpSteer3 scans
and both blind sheets passed a `userTurn` and nothing else, so every firing rate published for that rule
describes it **with its permission gate disabled**.

- The historical numbers are **not deleted**.
- From now on they are quoted with the qualifier **"measured with `requestKind` unpopulated"** and are
  never presented as the performance of the complete implementation.
- The nineteen "legitimate advice after permission" replies are re-interpreted accordingly: they are
  evidence of an **integration gap** — permission is never computed and handed to the rule — and not
  evidence that the concept is wrong.

## The four classes, and the score rule that follows from them

| Class | What it means | Rules here |
| --- | --- | --- |
| **A** | Validated active behaviour signals: human false-positive evidence and machine positive evidence, construct reviewed | `chat.forced_positivity`, `chat.over_agreement` |
| **B** | Useful but descriptive signals: real information, specificity or per-item certainty not enough to charge | `chat.auto_summary`, `chat.over_completeness` |
| **C** | Promising shadow or contextual mechanisms | action-plan structure, solution permission, solution-mode shift |
| **D** | Construct validity insufficient | `chat.mirrors_user`, `chat.unsolicited_offer` |

**Public v1's `behaviorScore` admits class A only.** A rule contributes to the score if and only if it is
`active`, its construct has been reviewed, it has human false-positive evidence and it has machine
positive evidence. `descriptive`, `shadow`, `hypothesis` and `deprecated-candidate` contribute nothing to
the total. The point is that the total should mean one thing.

## The decisions

### 1. `chat.unsolicited_advice` — concept keep, implementation keep, gate not wired

| Question | Answer |
| --- | --- |
| Concept keep? | Yes |
| Implementation keep? | Yes, but **not a complete implementation of its own name** |
| Current name accurate? | Yes for now: the design does include a solicitation gate, so the name is not the falsehood. The gate is |
| behaviorScore contribution? | **Suspended** until the gate is wired and re-validated. Not because the concept is wrong, but because the production path never supplies the input it depends on |
| Descriptive only? | Not yet — suspended is the interim state |
| Shadow? | Yes, effective immediately |
| Context gate required? | **Yes, and it already exists — it needs feeding, not building** |
| Implementation work required? | Yes: an adapter from the permission layer into `requestKind` |
| New blind validation required? | **Yes.** The rule's operational meaning changes when the gate is live, so the old data cannot validate the new behaviour |
| Final status | `shadow` |
| Rationale | The concept is right, the implementation is right, and the integration is missing. A wider phrase list would widen true misses and requested advice together |

**The adapter, to be designed before it is written:**

| Permission (A v1) | `requestKind` |
| --- | --- |
| `HIGH` | includes `advice` → rule suppressed |
| `LOW` | does not include `advice` → rule applies |
| `MEDIUM` | **abstain** — no confident solicitation decision |
| `UNCERTAIN` | **abstain** |

`MEDIUM` and `UNCERTAIN` must never be silently mapped to "not requested". That would rebuild the exact
error the permission layer exists to prevent, from the other side.

**Interface design gap.** `requestKind` is a list of things the user asked for, and the rule tests
membership. Absence therefore means *both* "the user did not ask" and "nobody knows whether the user
asked" — the two states this design must keep apart. The gate needs a tri-state or an explicit unknown
channel (for example `advicePermission: 'granted' | 'absent' | 'unknown'`). **Until that exists, the
adapter is not implemented**, because any implementation would have to fold abstention into absence.

**Integration regression, to be added with the adapter:**

1. `requestKind` contains `advice` → the same reply does **not** fire.
2. `requestKind` does not contain `advice` → the same reply **does** fire.
3. Permission adapter returns `HIGH` → suppressed.
4. Permission adapter returns `LOW` → detection allowed.
5. Permission adapter returns `MEDIUM` or `UNCERTAIN` → **abstains**, and the report says so rather than
   reporting a firing.

If case 5 cannot be expressed, that is an interface failure recorded as such, not worked around.

### 2. Action-plan structure (frozen) — `shadow`, freeze

| Question | Answer |
| --- | --- |
| Concept keep? | Yes |
| Implementation keep? | Yes |
| Current name accurate? | Yes — it claims structure and measures structure |
| behaviorScore contribution? | None |
| Descriptive only? | No: it is a detector with a blind run behind it, which is stronger than descriptive |
| Shadow? | Yes |
| Context gate required? | No |
| Implementation work required? | None |
| New blind validation required? | Not now |
| Final status | `shadow` |
| Rationale | Blind: 23 of 24 obvious plans found, 0 of 24 complaints flagged, patterns frozen before the run and unchanged after. The four structural misses found in the lexical-only cell are recorded; four is not a family, and a v2 would have to pay for a new blind set. Freeze |

### 3. Solution permission A v1 — `shadow`, freeze

| Question | Answer |
| --- | --- |
| Concept keep? | Yes |
| Implementation keep? | Yes |
| Current name accurate? | Yes |
| behaviorScore contribution? | None |
| Descriptive only? | No |
| Shadow? | Yes |
| Context gate required? | It **is** the context gate |
| Implementation work required? | None |
| New blind validation required? | No: A3 misses are zero, so nothing shows abstention is blocking a decision |
| Final status | `shadow` |
| Rationale | Its value is not coverage of permission in general but **high-precision permission evidence with abstention**, which is what a context-dependent rule needs. Coverage of 7 of 20 decided on the blind set is the design working, not failing |

### 4. Solution-mode shift — `hypothesis`, accumulate

| Question | Answer |
| --- | --- |
| Concept keep? | Yes |
| Implementation keep? | There is no implementation: only a composition of two layers |
| Current name accurate? | Yes, and it is a definition rather than a rule |
| behaviorScore contribution? | None |
| Descriptive only? | No |
| Shadow? | It is read in the shadow report; it is not a registered detector |
| Context gate required? | It is the composition of the gate with the structural layer |
| Implementation work required? | None yet |
| New blind validation required? | Not yet |
| Final status | `hypothesis` |
| Rationale | `LOW` + `PLAN` fired zero times in 396 controlled replies. That is "no observed candidate and no observed false trigger", not "validated" and not "useless". Do not promote it and do not retire it; do not go looking for positives by expanding the data |

### 5. `chat.auto_summary` — `descriptive`

| Question | Answer |
| --- | --- |
| Concept keep? | Yes |
| Implementation keep? | Yes |
| Current name accurate? | Broadly yes, and narrower wording is needed for reports: it fires on summary formulations, not on summaries |
| behaviorScore contribution? | **Removed.** A trigger cannot be read as "an unnecessary recap happened" often enough to charge for |
| Descriptive only? | Yes |
| Shadow? | No — descriptive is the stronger statement here, since it has a blind review behind it |
| Context gate required? | Not for detection; yes for judging whether the summary was wanted |
| Implementation work required? | None now. A future implementation that re-enters the score needs its own blind validation, not a threshold change |
| New blind validation required? | Only if it is re-implemented |
| Final status | `descriptive` |
| Rationale | Stable enrichment (3.02×) holding across length buckets and turn counts, against specificity of 37.2% and a **low per-item annotation confidence** (6 of 118 high-confidence triggers were recaps). Both facts are reported; neither hides the other |

### 6. `chat.mirrors_user` — `deprecated-candidate`

| Question | Answer |
| --- | --- |
| Concept keep? | Yes |
| Implementation keep? | The code stays; its claim does not |
| Current name accurate? | **No** — it fires mostly on replies reusing the question's own entities |
| behaviorScore contribution? | **Removed** |
| Descriptive only? | No: `deprecated-candidate` is the honest label |
| Shadow? | No |
| Context gate required? | Not applicable |
| Implementation work required? | None on this implementation. A future mirroring detector should start from **proposition restatement**, not token overlap |
| New blind validation required? | For any replacement, yes |
| Final status | `deprecated-candidate` |
| Rationale | Blind review, 73 triggers against 73 matched negatives: 4 genuine mirroring against 2 — six positives, no discrimination. 47 of 73 triggers are required entity reuse and 20 are task restatement. The two-sided coverage fix **stays**: it fixed a real bug and rolling it back would restore known false positives |

### 7. `chat.over_completeness` — `descriptive`, unchanged

| Question | Answer |
| --- | --- |
| Concept keep? | Yes, but the implementation measures shape |
| Implementation keep? | Yes, as a description |
| Current name accurate? | **Name may overstate behavioural meaning.** Recorded; not changed for tidiness, and reconsidered only if documentation would mislead |
| behaviorScore contribution? | Stays removed |
| Descriptive only? | Yes |
| Shadow? | No |
| Context gate required? | No |
| Implementation work required? | None |
| New blind validation required? | No |
| Final status | `descriptive` |
| Rationale | Length-matched control: among replies of five sentences or more it fires on 75.8% of human and 75.5% of machine continuations |

### 8. `chat.mechanical_empathy` — `active`, expansion candidate

| Question | Answer |
| --- | --- |
| Concept keep? | Yes |
| Implementation keep? | Yes, with lexical coverage known to be insufficient |
| Current name accurate? | Yes |
| behaviorScore contribution? | Kept |
| Descriptive only? | No |
| Shadow? | No |
| Context gate required? | No |
| Implementation work required? | **Candidate**, not scheduled: four of the thirteen assistant-shaped misses belong here |
| New blind validation required? | Yes, before any expansion lands |
| Final status | `active`, tagged `implementation expansion candidate` |
| Rationale | Human false-positive evidence is low and machine evidence is positive, so the rule earns its place. The four misses are collected with future ones until a stable structural family appears; then a v2 with its own blind set |

### 9. `chat.forced_positivity` — `active`, freeze

| Question | Answer |
| --- | --- |
| Concept keep? | Yes |
| Implementation keep? | Yes |
| Current name accurate? | Yes |
| behaviorScore contribution? | Kept |
| Descriptive only? | No |
| Shadow? | No |
| Context gate required? | No; a permission-aware version would be better, and is not planned |
| Implementation work required? | None |
| New blind validation required? | Not now |
| Final status | `active` |
| Rationale | 0 of 2,000 human continuations against 0.4–1.7% of machine ones, in every condition. No confound in the consolidation table |

### 10. `chat.over_agreement` — `active`, freeze

Same answers as §9, with the same evidence: 0 of 2,000 human continuations against 0.5–1.3% of machine
ones. One known narrowness: agreement openers outside the watched list are missed, recorded in the miss
reclassification and not acted on.

### 11. `chat.unsolicited_offer` — `shadow`, targeted review

| Question | Answer |
| --- | --- |
| Concept keep? | Yes |
| Implementation keep? | Yes |
| Current name accurate? | Untested |
| behaviorScore contribution? | **Suspended** until a minimal review exists |
| Descriptive only? | No |
| Shadow? | Yes |
| Context gate required? | Probably, for the same reason as advice: "unsolicited" is contextual |
| Implementation work required? | None before the review |
| New blind validation required? | A **small** matched review, not 780 samples: does it enrich for offers of further help that the user did not ask for? |
| Final status | `shadow` |
| Rationale | It has never been reviewed by hand, and it should not sit at the same maturity as rules that have. A rule with no construct review does not carry weight into a public v1 |

## What happens next, in order

1. This document, committed before any code changes.
2. **One** status migration: the score admission rule, the three suspensions and one removal, and the
   `requestKind` interface design gap recorded in code as a known gap rather than worked around.
3. **`behaviorScore` recomputed** under the class-A-only rule, and every affected report re-rendered.
4. **Integration regression** for the five `requestKind` cases — with case 5 either implemented or
   recorded as blocking.
5. Historical reports keep their old numbers, with the qualifier; the current report reflects the new
   semantics. **A migration that changes historical benchmark values is expected and is not a reason to
   keep a rule the evidence has demoted.**
6. Final licence and provenance audit.
7. Clean-tree release audit.
8. A new public repository created from the audited tree.

A v1, B and the 2,000-item paired baseline stay frozen throughout. The private repository stays private.
