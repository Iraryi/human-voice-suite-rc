# Lexical-only rubric

<!-- Frozen before the sheet was read. Codes may not be extended during classification. -->

Forty-five replies where `chat.unsolicited_advice` fires and the frozen structural features see no
action plan — the lexical-only cell of `COVERAGE_MATRIX.md`.

**The question is not why the rule is wrong. It is what happens in these forty-five.** The rule is not
being renamed, reweighted or edited on the strength of this; what is being decided is what it actually
detects.

## Category — exactly one

| Code | Meaning |
| --- | --- |
| `lightweight_advice` | Advice directed at the user, real but small: one suggestion, no procedure, no ordering, no channel. |
| `generic_hypothetical` | Advice about a general case rather than this user: "if someone encounters this, you can…", advice embedded in an explanation or in an example dialogue. |
| `third_party_advice` | Advice about what somebody else should do — a character in an example, a person in a story, a company. |
| `legitimate_after_permission` | The user asked for advice, a method or a recommendation, and the reply gives one. The rule's own precondition (no request) is not met. |
| `phrase_false_positive` | A watched phrase appears in text that is not advice at all: inside an example, a quotation, a list of options, a title, a translation. |
| `other` | None of the above; name it in the note. |
| `uncertain` | The category cannot be decided. |

## Four questions — `yes`, `no` or `uncertain` each

| Field | Question |
| --- | --- |
| `directed_at_user` | Is the advice addressed to **this** user, rather than to a general case or a third party? "你可以先……" is yes; "如果有人遇到这种情况，可以……" is no. |
| `requires_context` | Would a reader need the user's turn — or earlier turns — to decide whether this is advice at all? |
| `assistant_shaped` | Does the reply behave like an assistant rather than like a person answering: unprompted instruction, a plan, an offer of further help, a closing formula? |
| `action_plan_structure` | Does the reply in fact contain a procedure — ordered steps, a channel, a condition and a fallback — that the frozen features missed? This should be rare by construction, and a `yes` here is a defect in the structural layer worth recording. |

## Output

One JSON object per line, nothing else:

```json
{"id": "L-001", "category": "phrase_false_positive", "directed_at_user": "no", "requires_context": "no", "assistant_shaped": "no", "action_plan_structure": "no", "note": "watched phrase appears inside a generated example dialogue"}
```

No new codes. If the rubric does not fit, choose the closest category and say so in the note.
