# Miss reclassification: the 29 uncaught continuations, read again

<!-- Hand-written from the local sample. Ids, codes and counts only: no reply text. -->

The first pass labelled 120 uncaught machine continuations from the paired control and found 29 that
did not read as a person. That pass asked one question — does this read as an assistant — and this one
asks four, because "unnatural" and "assistant-shaped" turned out not to be the same thing.

| Column | Values |
| --- | --- |
| human-likeness | `natural-human-like`, `unnatural-but-not-assistant-specific`, `assistant-shaped`, `uncertain` |
| primary minimal concept | the smallest behavioural description that covers the case |
| implementation | `A1` lexical, `A2` structural, `A3` permission/context, `B` genuinely new behaviour, `C` subjective |
| existing concept candidate | which current concept the case belongs to, when it is A1/A2/A3 |
| needs new concept? | yes / no |

## What changed on re-reading

**Fifteen of the twenty-nine now read as natural human replies.** They were called non-human on the
first pass for reasons that were about register rather than behaviour: an encyclopedic answer to a
factual question, a hedge that refuses to take sides, a short reassurance, a polite close, a
de-escalation. Those are things people write. The original 29 was a count of "does not read like a
person to me"; it was not a count of assistant behaviour, and this pass separates the two.

The 91-of-120 figure is untouched: it counted replies that read as a person, and re-reading the
twenty-nine only moves some of them into it. **The 29 becomes 13 assistant-shaped and 1
unnatural-but-not-assistant-specific**, with no case left uncertain.

## The thirteen that are assistant-shaped

| Id | Arm | Primary minimal concept | Implementation | Existing concept | Needs new concept? |
| --- | --- | --- | --- | --- | --- |
| `lccc-valid-011540` | plain | Unrequested plan of action: imperative + hypothetical warning | `A2` structural | `chat.unsolicited_advice` | no |
| `lccc-valid-013002` | plain | Unrequested advice in an imperative with no advice phrase | `A1` lexical | `chat.unsolicited_advice` | no |
| `lccc-valid-013786` | plain | Unrequested encouragement plus an imperative | `A2` structural | `chat.unsolicited_advice` | no |
| `lccc-test-008838` | plain | Counselling register: reassurance and companionship | `A1` lexical | `chat.mechanical_empathy` | no |
| `lccc-valid-005130` | plain | Unrequested advice with a fallback: if A fails, B | `A2` structural | `chat.unsolicited_advice` | no |
| `lccc-test-004683` | default | Counselling register: an invitation to talk, and a caution | `A1` lexical | `chat.mechanical_empathy` | no |
| `lccc-test-007124` | default | Unrequested advice with an ordering lead-in | `A2` structural | `chat.unsolicited_advice` | no |
| `lccc-test-001699` | post | Counselling register plus a second-person directive | `A1` lexical | `chat.mechanical_empathy` | no |
| `lccc-valid-011540` | post | Unrequested advice, and agreement in an unwatched form | `A2` structural | `chat.unsolicited_advice` | no |
| `lccc-valid-019961` | post | Unrequested advice with encouragement attached | `A1` lexical | `chat.unsolicited_advice` | no |
| `lccc-valid-019097` | post | Unrequested advice offering alternatives | `A2` structural | `chat.unsolicited_advice` | no |
| `lccc-test-005593` | post | Counselling close: permission to stop | `A1` lexical | `chat.mechanical_empathy` | no |
| `lccc-valid-003409` | post | Unrequested advice in one line | `A1` lexical | `chat.unsolicited_advice` | no |

**A1: seven. A2: six. A3: zero. B: zero.** Every assistant-shaped miss is an implementation gap in a
concept the suite already has, and none of them needs a new concept.

## The one that is not assistant-shaped and not human-like

`lccc-test-006889`, plain arm: a neat aphoristic reframe of the user's own metaphor. It reads as
unnatural without reading as an assistant — the shape of a closing maxim rather than a turn in a
conversation. Primary minimal concept: `aphoristic_wrapup`. Implementation `B`, needs a new concept:
**yes**, and one example is not a case for one. It accumulates.

## What this settles

1. **The gap is implementation, not concepts.** Thirteen of thirteen assistant-shaped misses belong to
   two concepts that already exist. If the same holds for the lexical-only replies and the coverage
   matrix, the next stage of this project is making a few existing rules structural, not adding rules.
2. **`chat.unsolicited_advice`'s concept is right and its implementation is narrow.** Six of the misses
   are plans the frozen structural features would find and the five phrases do not.
3. **`chat.mechanical_empathy` has the same problem in a different register.** Four misses are
   counselling moves with none of its watched phrases.
4. **A v2 of the permission layer is not triggered.** Zero of the thirteen are `A3`, so no important
   miss is stuck behind `permission = UNCERTAIN`. The condition for starting v2 was that it would be;
   it is not, so A v1 stays as it is.
5. **The first pass over-counted.** Fifteen replies moved from "not a person" to "a person" on a second
   reading that asked what the reply *does* rather than how it *sounds*. The original numbers stay as
   they were published; this file is the correction, dated and attributed to a second pass rather than
   folded into the first.
