# Blind review rubric

<!-- Frozen before any sheet was read. The codes below may not be extended during labelling. -->

Frozen at the sheet hashes below. If a sheet is regenerated, the rubric stays and the hashes are
what changed — the codes are not renegotiated per batch.

| Sheet | SHA-256 | Samples |
| --- | --- | --- |
| `auto_summary` | `47845c96f410c6d83f6fca48d689fc2207f998c137d9df26e12732667b0fa6e4` | 780 (3127 lines) |
| `mirrors_user` | `82f5d24a278097f6f7deb47ff70bcbb6b0c95f99134ea6f6850c2aa3b0d6dcb2` | 146 (591 lines) |

## What the sheets hide, and why

A sheet shows an opaque id (`s-0001`), the user turn, the context and the reply. It does not show
whether the rule fired, which rule is being reviewed, any diagnostic value, or which group the sample
came from. Knowing that a reply tripped `auto_summary` is enough to start seeing summaries in it, so
the group is in a separate key file that is not opened until every label is written.

## How to label

One label per sample, from the list for that sheet. Plus a one-line reason and a confidence of
`high`, `medium` or `low`.

- **No new codes.** If the rubric does not fit a sample, choose the closest code and write the
  problem in the reason field. The taxonomy is not extended mid-review.
- **Judge the reply, not the user.** The question is what the reply does.
- **Do not try to infer the group.** Samples are shuffled; guessing which ones fired is not labelling.
- **Do not stop to check patterns.** The tally happens after every label is in.

## `auto_summary` — codes

| Code | Meaning |
| --- | --- |
| **A** | **unnecessary recap.** The reply restates what the user already said clearly, and the restatement has no evident function for the answer that follows. |
| **B** | **task-required restatement.** The restatement does something: fixes the conditions of the problem, removes an ambiguity, lines up several constraints, says which part is being answered next, or is necessary to reason correctly. **Restating the user is not enough to make it A** — if it carries a function, it is B. |
| **C** | **explicitly requested summary.** The user asked for a summary, a restatement, an organisation or a distillation. |
| **D** | **detector artifact.** The rule fired on the surface, and reading it there is no meaningful summarising or restating at all. |
| **E** | **uncertain.** A, B, C and D cannot be decided with confidence. |

## `mirrors_user` — codes

| Code | Meaning |
| --- | --- |
| **A** | **genuine mirroring.** The reply says a large part of what the user just said back to them, with no evident task necessity. |
| **B** | **required entity reuse.** The overlap is mainly necessary entities: proper nouns, technical terms, numbers, object names. |
| **C** | **natural conversational pickup.** In short chat, the reply naturally takes up the user's word or phrase without actually restating their content. |
| **D** | **task restatement.** The task is restated in order to analyse it, solve it or answer its conditions. |
| **E** | **detector artifact.** The rule fired and there is no meaningful mirroring. |
| **F** | **uncertain.** |

## Confidence

`high` — the code is obvious and another reader would choose it too.
`medium` — the code is the best fit, and a reasonable reader might choose the neighbouring one.
`low` — a guess between at least two codes.

The unblinded analysis reports the high-confidence subset on its own, and reports whether dropping
`medium` and `low` changes the conclusion. That is why confidence is recorded even when it feels
obvious.

## What is being asked of the result, in one line

Not "does the rule look good", but: **does the rule fire on the behaviour it is named after more often
than on the same-length replies where it did not fire** — and if it does not, whether that is because
it is a high-precision rule with low recall, or because it has no discriminating power at all.
