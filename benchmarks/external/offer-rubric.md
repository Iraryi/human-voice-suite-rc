# Blind review rubric: offers of further help

<!-- Frozen before the sheet was generated. Do not edit after labelling begins. -->

One question, asked of every sample on its own:

> **Does this reply volunteer to do something extra for the user that the user did not ask for?**

Not "does it contain a service-closing phrase". The phrase list is what fired; the question is what the
phrase was doing. A reply can say *let me know if you need anything else* and be doing nothing of the
kind, and a reply can volunteer a whole extra piece of work with none of the watched phrases in it.

## The codes

| Code | Name | Definition |
| --- | --- | --- |
| `A` | **Genuine unsolicited offer** | The reply offers to do, provide or continue something **beyond what was asked**, and the user did not invite it. The offer adds work, scope or a next step that the user's turn did not request — including the generic "I can also…", "want me to…", "shall I…" shapes, and the closing "if you need more, just say". |
| `B` | **Requested or contextually invited** | The user's own turn invited this. They asked for options, more detail, a next step, a follow-up, or a continuation, or the reply is answering a question whose whole point is what could come next. A reply that offers exactly what was asked for is `B`, however much it sounds like a service. |
| `C` | **Conversational courtesy** | A polite sign-off that offers nothing specific and commits to nothing: a closing pleasantry, a wish, a greeting, "take care", "good luck with it". It is how people end messages, not an assistant proposing work. The test is whether anything would have to be *done* if the user took it up. |
| `D` | **Task-required availability** | The situation itself requires stating what is available next, and a person in that role would say it too: a support reply naming the next step, a schedule or deadline, an instruction set whose last line says where to go if it fails. `D` is about the task, not about the assistant's willingness. |
| `E` | **Detector artifact** | The phrase is present but doing something else entirely: quoted, negated, hypothetical, part of an example or a list of things *not* to do, a translation, or a fragment of the user's own turn echoed back. The detector matched text; there is no offer here. |
| `F` | **Uncertain** | A reader genuinely cannot decide from what is shown — usually `A` against `B`, or `C` against `A`, with the deciding information in a turn that is not visible. **`F` is a result, not a failure.** It is recorded so that the counts of `A` and `B` can be read as a floor rather than as the truth. |

### The boundaries that matter

- **`A` against `B`.** The user turn decides it. "What should I do?" invites a recommendation; "I'm fed up
  with this" does not invite a service. When the user asks for one thing and the reply offers that thing
  *and* a further one, the further one is `A` — the code describes the **offer**, not the reply.
- **`A` against `C`.** Courtesy costs the offerer nothing and promises nothing. If taking the offer up
  would mean the assistant doing work — writing, looking up, drafting, sending, continuing — it is not `C`.
  "Hope that helps" is `C`. "Want me to draft one?" is `A`.
- **`A` against `D`.** Ask who else would say this. A person handing over a task, a colleague, a support
  agent with a script — if the same sentence is what the *situation* requires rather than what the
  assistant chose to add, it is `D`.
- **`E` beats everything.** If the phrase is not functioning as an offer at all, no other code applies,
  whatever the reply is otherwise doing.

## The three questions asked beside the code

| Question | Values | Why it is asked |
| --- | --- | --- |
| **confidence** | `high` / `medium` / `low` | How sure the reader is of the code. The high-confidence subset is the honest floor on every number; low-confidence labels are opinions about hard cases. |
| **assistant-shaped?** | `yes` / `no` / `uncertain` | Would this reply read as an assistant's rather than a person's, **setting the offer aside**? This is the construct question: a rule can be a good offer-detector and still not be measuring assistant behaviour. |
| **requires user context?** | `yes` / `no` | Could the code be decided without the user turn and the visible context? `yes` means the verdict depends on a turn the detector would not have had in a response-only scan, which is a statement about the rule's reach rather than about the reply. |

## What is being measured, and what is not

- **Being measured:** whether the rule enriches for offers the user did not ask for, and whether the
  behaviour it enriches for is assistant-shaped.
- **Not being measured:** whether the rule should be promoted, reweighted, renamed or widened. No phrase
  is added or removed on the strength of this sheet, and the rule's status is decided afterwards, in
  writing, from the counts.
- **Not being measured:** whether the trigger is a *good reply*. An unsolicited offer can be helpful and
  still be the behaviour under study.
