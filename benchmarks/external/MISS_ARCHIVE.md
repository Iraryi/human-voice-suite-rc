# Miss archive: the two families that were not built

<!-- Hand-written from local samples. Ids, codes and descriptions only: no reply text. -->

Two sets of misses were held back for review before the release: four for `chat.mechanical_empathy` and
four for the frozen action-plan features. Both were examined, clustered, and **archived rather than
implemented**. This file is the record, so that a later round starts from what was found here rather than
from the raw and, in one case, misleading count.

Neither rule changed. `chat.mechanical_empathy` is still class A with its watched phrases, action-plan
structure is still frozen in shadow, and no v2 was written for either.

---

## 1. `chat.mechanical_empathy`: four misses, three forms, no stable family

The four cases are the `counselling register` misses from `MISS_RECLASSIFICATION.md`: three "counselling
register" replies and one "counselling close". Read again for form rather than for register, they are:

| Id | Arm | Form | What carries the move |
| --- | --- | --- | --- |
| `lccc-test-008838` | plain | **Comfort imperative with companionship** | a de-escalating imperative plus a first-person commitment to stay with the user |
| `lccc-test-004683` | default | **Invitation to disclose** | an imperative inviting the user to talk, with a prohibition on holding it in |
| `lccc-test-001699` | post | **Validation plus permission** | accepting the user's framing, then releasing them from an obligation |
| `lccc-test-005593` | post | **Absolution close** | a short approval of the user's stance plus a permission to take their time |

### The common form

All four are **short, second-person, imperatively phrased moves made in response to an emotional
disclosure.** Structurally they share three things:

1. **None contains a first-person feeling formula.** `chat.mechanical_empathy` watches openers such as
   我理解你的感受 and 听起来你…… — first-person claims to understand. These four never make that claim.
2. **The move is carried by an imperative or a permission**, not by a feeling-word: 别急, 说说呗,
   别一个人憋着, 你不用按他们的剧本走, 慢慢来. The rule has no imperative shape and no permission shape.
3. **Every user turn is a disclosure**, so the register is counselling by situation rather than by phrasing.

### Why this is not a stable family

The three forms are real, and two of them are the reason not to build on them yet.

**Comfort imperatives and absolution closes are how people comfort each other.** 别急, 慢慢来,
想通就好 and 我陪你 are ordinary Chinese consolation, written by ordinary people, with no assistant
involved. `chat.mechanical_empathy` is class A precisely because it has *human false-positive evidence*
— the watched phrases are ones people mostly do not write. A v2 that added imperatives and permissions
would be a rule that fires on comfort, and the human false-positive cost of that is unmeasured.

So the honest state is:

- **A stable family was not found.** Three forms across four cases is not a family; it is four cases in
  three shapes, and the shapes are the ones where human and assistant writing overlap most.
- **A v2 is not proposed.** Writing one would mean proposing a rule with no human false-positive
  measurement behind it, in the one class where that measurement is the entry requirement.
- **What would change the answer**: a human comparison set of the same register — consolation replies
  written by people to the same disclosures — measured the way the paired control measured the other
  rules. Until that exists, widening the rule would trade a narrow rule for a broad one and the trade
  would be invisible.
- **The four accumulate.** Further misses in this register go on the same pile, and the pile is the
  evidence a future round would need.

---

## 2. Action-plan structure: four "misses" that are not misses of the construct

`LEXICAL_ONLY_CLASSIFICATION.md` records four of the forty-five lexical-only replies as carrying
`action_plan_structure: yes` when the frozen features saw no plan. Read in the A × B frame — **A** being
whether the user turn invited a solution, **B** whether the reply commits to an action plan — they do not
read as a recall failure at all:

| Id | The user turn | The reply | A v1 reads it as |
| --- | --- | --- | --- |
| `L-009` | a terse sourcing request, noun phrase, no verb of asking | a step-by-step buying guide naming a channel | `UNCERTAIN` |
| `L-021` | an explicit request to arrange a five-day itinerary, naming what must be included | ordered days, transit lines and a timing caution | **`LOW`** |
| `L-022` | the user's own question about how to set a parameter | five ordered tuning guidelines with conditions | `UNCERTAIN` |
| `L-031` | the same question, answered with numbered guidelines and a summary | `UNCERTAIN` |

**Three of the four are plans the user asked for.** A plan where a plan was asked for is a good answer;
it is not the behaviour under study, and the frozen features "missing" it is not a defect. The construct
is uninvited solution mode — `LOW` permission together with `PLAN` commitment — and on that definition
these four are not candidates.

### What they do expose, and it is not about B

`L-021` is read by A v1 as **`LOW`**: positive evidence that the turn invited nothing, on an explicit
request for help. The turn is written in traditional Chinese, and A v1's request signals are simplified
(`請協助` is not `帮我`, `安排` is not in the steps list, `該如何設定` is not `如何做`). The reply then
duly fires on a plan that was requested — the exact false positive the permission layer exists to prevent,
produced by the permission layer.

That is a finding about **A v1's coverage**, not about B:

- A v1 grants permission 0 times and reads `MEDIUM` 0 times in 2,000 simplified-Chinese LCCC turns
  (`ADVICE_PERMISSION.md` §2). It has no traditional-Chinese path at all, and no path for a request made
  as a noun phrase.
- `LOW` is therefore not safe in traditional Chinese, and the failure direction is the dangerous one:
  `LOW → absent` **allows a rule to accuse**.
- A v1 is frozen, so this is recorded and not fixed. It is one of the reasons `chat.unsolicited_advice`
  stays `shadow`, and it belongs in the release limitations rather than in a patch.

### What would change the answer

A traditional-Chinese signal set, or a permission reading taken from the previous turn as well as the
current one, measured against the permission blind set before it is used. Both are construct work on a
frozen layer, and neither is in scope for a release candidate.

---

## 3. What is archived, in one place

| Family | Cases | Forms | Decision |
| --- | --- | --- | --- |
| `chat.mechanical_empathy` expansion | 4 | comfort imperative with companionship; invitation to disclose; validation plus permission; absolution close | **No stable family. No v2. Accumulates.** |
| Action-plan structure recall | 4 | plans in replies where a plan was requested | **Not misses of the construct.** Frozen features unchanged. |
| A v1 permission coverage | 1 of the 4 above, plus the 1,550 of 2,000 turns it abstains on | traditional Chinese; noun-phrase requests | **Recorded as a limitation of a frozen layer.** |

Nothing here is a blocker. Each entry names the measurement that would settle it, and none of those
measurements is required for the release.
