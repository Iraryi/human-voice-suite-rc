# Candidate rewrites

`preservationScore` needs two texts: an original and a candidate. This directory
holds recorded candidates, so `npm run bench:run --candidates benchmarks/candidates`
can measure all four scores instead of three.

```bash
npm run bench:run -- --candidates benchmarks/candidates
```

## What these are, exactly

Each file is `<sample-id>.md` and contains the **rewritten body only** — no front
matter, because the sample it corresponds to already carries the provenance.

They were produced by a model (DeepSeek, through the DSH agent) applying the
contract that `human_voice_prepare` emits for that sample: remove the tells the
scan found, keep every claim the original makes and nothing it does not, and
reproduce protected content exactly.

**This is why the harness itself never rewrites.** The benchmark measures the
suite; if the suite also produced the text under measurement, the benchmark would
be measuring the suite's own homework. Keeping the candidates as files with a
recorded origin is what makes the round trip auditable, and it is also why the run
prints `candidatesDir` in its metadata.

## The deliberately imperfect ones

Two candidates are wrong on purpose, and both are named here, in the run output
and in the report, because a planted failure that is not disclosed is
indistinguishable from a real one.

| Candidate | What it does | What it exercises |
| --- | --- | --- |
| `zh-tech-0001.md` | drops a URL the original contains | a `url` item **lost** — severity 4 |
| `en-tech-0003.md` | alters the last character of a commit hash | an `identifier` item **lost** — severity 5, the highest |

They are the control for the preservation check. A benchmark that only ever
records candidates that preserve everything cannot show that `preservationScore`
detects anything, and the one thing the score exists to catch — a rewrite that
quietly loses or corrupts a fact — would go unmeasured.

The two were chosen to be different *kinds* of loss. A hash is the more damaging
one: it is a value nobody can reconstruct from context, which is why it carries
the highest severity, and until this candidate existed that branch had never been
exercised either.
