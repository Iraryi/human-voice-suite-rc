# Contributing

## Before anything else

Run the three checks. A change that breaks any of them is not ready.

```bash
npm run typecheck
npm test
npm run licenses:verify
```

## The rules this project does not bend

These come from the design, not from taste. Each is enforced in code or tests, so
breaking one will usually fail the build rather than a review.

1. **One tell is one rule.** Give a rule a repository-independent signature, never
   a pattern number. If two upstreams detect the same thing, they must emit the
   same signature.
2. **Provenance is rule-level.** A rule without `sources` is not finished. If you
   changed something on the way in, record it in `localChanges`.
3. **Licence first.** Before any upstream's content is used, read its actual
   `LICENSE` at the commit you will pin. No licence file means `research-only`.
4. **Never delete a notice.** Not when rewriting, not when translating, not when
   consolidating.
5. **No blended human score.** Four separate scores, always, each with a
   rationale. Do not add a fifth aggregate.
6. **Capabilities, not upstreams.** Public tool names are `human_voice_*`. No
   `run_<upstream>` tool may exist.
7. **The suite never calls a language model.** `human_voice_prepare` returns a
   contract; the calling agent rewrites.
8. **Upstreams are read-only.** Adapters read; nothing writes. Do not add a write
   operation to `AdapterContext`.
9. **Strategy is deterministic.** A condition table with a recorded rationale, not
   runtime planning.
10. **Short chat takes the fast path.** Do not route a two-line reply through the
    full pipeline.

## Adding an upstream

The step-by-step checklist is in
[`docs/provenance-policy.md`](./docs/provenance-policy.md#adding-an-upstream-the-checklist).
In short: licence, manifest entry, preserved licence copy, adapter, register,
signatures, tests.

`tests/manifest.test.ts` and `tests/upstream.test.ts` assert that the adapter
registry and the manifest agree exactly, so a missing or orphaned adapter fails
the build.

## Adding a rule

1. Pick the signature. Dotted snake_case, family first, naming the **tell** rather
   than the fix: `structural.inflated_significance`, not
   `structural.remove_significance_claims`.
2. Fill in `description`, `rewriteGuidance` and `severity`. `rewriteGuidance` is
   required — a rule you cannot act on is noise.
3. Add one entry to `sources` per upstream that states it, with the upstream's own
   identifier, a locator and where possible a verbatim quote.
4. If you wrote it yourself, `sources` points at `human-voice-suite/local` and
   `isLocalOnly()` must return true. Never present local work as inherited, or the
   reverse.
5. Add a test asserting the collapse, if the rule is claimed by more than one
   upstream.

Phase 1 rules are `status: 'seed'`. Only reviewed, deduplicated rules become
`status: 'canonical'`.

## Adding a detector

Implement the `Detector` interface. Declare `upstream` as
`human-voice-suite/local` for your own work, or the upstream key when wrapping
someone else's logic.

Detectors must:

- declare the `languages` they are meaningful for, and return `[]` rather than
  guessing for others
- emit `Finding`s with evidence spans and a `confidence`, never a score
- let the suite resolve findings to canonical rules — do not do the resolution
  yourself
- **not** compute a score. Scoring belongs to `src/detector/scan.ts` and
  `src/validation/`

When wrapping an upstream detector, fix the defects the inventory names rather
than inheriting them. `dsh-humanizer`'s missing `m` flag is the canonical example:
it silently makes 37 patterns unreachable.

Set `status: 'ready'` on your catalog slot when it works. The scaffold test
asserts that no slot claims `ready` while it is not.

## Adding a voice profile field

Add it to the right dimension in `src/voice/types.ts`:

- `WritingVoiceFeatures` — measurable from a text
- `ChatVoiceFeatures` — short-form habits
- `ConversationBehaviorFeatures` — behaviour across a conversation

Then say where the value comes from. A field nothing can populate is worse than no
field.

## Tests

Vitest. `tests/` mirrors the layers.

- `rules.test.ts` — registry, dedupe, provenance
- `manifest.test.ts` — manifest shape, lineage, **pinned commits matching the clones**
- `upstream.test.ts` — adapters, sync report, rule extraction, real upstream files
- `scan.test.ts`, `strategy.test.ts`, `contract.test.ts`,
  `protected-content.test.ts`, `text.test.ts`, `dsh-surface.test.ts`,
  `scaffold.test.ts`

Tests that need the upstream clones are wrapped in `describe.skipIf(!clonesPresent)`
so a fresh checkout passes without them. Do not delete that guard.

### Assertions worth copying

- `tests/manifest.test.ts` compares every pinned commit against the clone. It
  exists because a hand-copied SHA once got into the manifest, and a wrong SHA is
  a permanent provenance lie.
- `tests/upstream.test.ts` asserts the adapter registry has no orphans and no
  gaps against the manifest.
- `tests/scan.test.ts` asserts three upstreams reporting one tell produce one
  deduction.
- `tests/dsh-surface.test.ts` asserts the upstream-leak detector would fire on
  `run_blader`.

## Style

- TypeScript, ESM, NodeNext resolution. Import with explicit `.js` extensions.
- `strict` plus `noUncheckedIndexedAccess`. No `any`, no non-null assertions
  without a comment saying why.
- Plain language in comments and docs. Lead with the point, keep sentences short.
- Comment the *why*, especially where a decision looks odd. The best comments in
  this repository explain a trap, not a line.

## Commits

Conventional-commit prefixes (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
A commit that changes behaviour says what changed and why in the body.

Never commit:

- `.upstream-cache/` — clones are local, and the manifest already pins the commits
- `UPSTREAM_UPDATE_REPORT.md` — generated on demand
- `dist/`, `coverage/`, `node_modules/`

## Updating an upstream

1. `npm run upstream:check` — it writes `UPSTREAM_UPDATE_REPORT.md` and modifies
   nothing.
2. Read the report. It names changed files, added, removed and renamed rules, and
   licence changes.
3. Decide what to absorb. **Nothing is absorbed automatically, by design.**
4. If you absorb a change, update the manifest's `commit` and `last_sync`, then
   run the full check.

The rule-level diff is heuristic: it reads numbered headings, which is how every
Markdown humanizer in this corpus numbers its patterns. Full-fidelity extraction
is the adapter's job.

## Reporting a rule that is wrong

Open an issue with the rule id, the text that triggered it, and what it should
have done. If a rule misfires on legitimate writing, that is more valuable to know
than a rule that misses something — `blader/humanizer` marks five of its own
patterns "weak alone" for exactly this reason, and the suite preserves that
suppression policy.
