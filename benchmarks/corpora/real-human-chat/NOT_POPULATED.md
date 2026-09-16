# real-human-chat is not populated

Genuine human chat logs cannot be obtained offline under a clear licence, so this
category is empty rather than filled with something that only looks like chat.

This is a deliberate outcome, not an oversight. The category exists because it is
the only one that can measure **false positives on real conversation** — how
often the behaviour checks fire on people talking to each other. Without it, the
corpus can say how well the suite recognises an assistant and cannot say how
often it mistakes a person for one. That is a real gap and it is recorded here
rather than papered over.

## Why no samples

A chat log is not like a README. A README is published under a licence that says
what may be done with it. A chat log is private correspondence, and every route
to one fails at least one of the requirements below.

- **No offline source.** The upstream clones in `.upstream-cache/` contain
  documentation, prompts and source code. None of them contains a conversation
  between two people. There is nothing local to vendor.
- **No licence.** Personal messages are not licensed for redistribution. The
  author of a message holds copyright in it, and forwarding it into a public
  corpus is a distribution. Consent would be needed from every participant in
  every thread, not only from the person who exported it.
- **Public logs are not the same thing.** IRC and mailing-list archives are
  public and sometimes licensed, but they are a different register: pseudonymous,
  technical, and shaped by the norms of the channel. They would be a useful
  addition and are not the same measurement.
- **Synthetic human chat is worse than nothing.** A model writing "what a person
  would say" produces text from the same distribution the detectors were built to
  recognise. Including it here would make the false-positive rate look better
  than it is, which is precisely the failure this category exists to prevent.

The task this corpus was built under says the same thing directly: where genuine
text is unavailable with a clear licence, write this file and stop. It does.

## What would populate it

Any one of these would be enough, and each needs the licence recorded in the
sample's `licence` field like every other category.

1. Chat logs exported by their own participants, with written consent and an
   explicit licence permitting redistribution.
2. A published, licensed corpus of conversational text — a dialogue corpus, an
   annotated SMS or WhatsApp dataset, or a research release with a permissive
   term.
3. Mailing-list or forum archives under a licence that permits reuse, accepted
   knowingly as a different register from one-to-one chat.

Until one of those exists here, any `behaviorScore` produced by a run should be
read as a measure of **recall against assistant-shaped text only**. It has no
false-positive denominator. The corpus README repeats this, because a reader who
misses it will over-read every behaviour number in the report.
