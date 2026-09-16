# Documentation

| Document | What it covers |
| --- | --- |
| [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | The layering, and the thirteen invariants that hold it together |
| [`../UPSTREAM_INVENTORY.md`](../UPSTREAM_INVENTORY.md) | Phase 1 reconnaissance of all eight upstreams |
| [`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md) | Licence position, and the two provenance defects |
| [`behavior-engine.md`](./behavior-engine.md) | The chat behaviour engine — this project's core original contribution |
| [`voice-profile-schema.md`](./voice-profile-schema.md) | The unified voice model and how upstream material maps onto it |
| [`provenance-policy.md`](./provenance-policy.md) | Rule-level provenance and deduplication; **part 2** is the adapter author's guide |
| [`phase-8-rule-changes.md`](./phase-8-rule-changes.md) | Every rule the benchmark changed, with before/after measurements |
| [`phase-13-paired-control.md`](./phase-13-paired-control.md) | Which behaviour rules actually separate machine chat from human chat |
| [`phase-14-coverage.md`](./phase-14-coverage.md) | The coverage phase: length, situations, and what no rule catches |
| [`phase-28-advice-permission.md`](./phase-28-advice-permission.md) | The advice-permission migration: a three-state gate, and what it moved |
| [`dsh-plugin.md`](./dsh-plugin.md) | Installing and operating the six DSH tools |
| [`../benchmarks/README.md`](../benchmarks/README.md) | Benchmark and ablation design, and the hypothesis it falsified |
| [`../BENCHMARK_RESULTS.md`](../BENCHMARK_RESULTS.md) | The latest run: configuration × category × four scores, with its limits first |
| [../RELEASE_CANDIDATE.md](../RELEASE_CANDIDATE.md) | The release candidate: repository state, migrations, rule statuses and the audit |
| [`../benchmarks/external/README.md`](../benchmarks/external/README.md) | The external corpus: real human writing, measured but never committed |
| [`../benchmarks/external/RULE_STATUS_DECISION.md`](../benchmarks/external/RULE_STATUS_DECISION.md) | The class of every rule, decided once, with the evidence behind each |
| [`../benchmarks/external/MIGRATION.md`](../benchmarks/external/MIGRATION.md) | What the two interface migrations moved, and the stale artefacts the re-run found |
| [`../benchmarks/external/OFFER_REVIEW.md`](../benchmarks/external/OFFER_REVIEW.md) | The blind review of the offer rule, and why it is not promoted |
| [`../benchmarks/external/MISS_ARCHIVE.md`](../benchmarks/external/MISS_ARCHIVE.md) | The two miss families that were clustered and archived rather than built |

The per-upstream evidence lives in [`../upstreams/reports/`](../upstreams/reports/),
one file per repository, with `file:line` citations for every claim.

## Reading order

If you are new to the project, read `UPSTREAM_INVENTORY.md` §1 first. The single
most important fact about this corpus is that most of it is the same work at
different revisions, and every design decision follows from that.

If you are here to implement something, read `ARCHITECTURE.md`'s invariants, then
the document for the layer you are touching.

If you are here to add an upstream, read `provenance-policy.md` end to end. Its
second half is a step-by-step guide written from the six adapters that were built
in Phase 2, including the parser traps that cost real debugging time.

## What to read if you only read one thing

`provenance-policy.md` part 2, "Gotchas found the hard way". Two upstream watch
lists that look identical —

```text
not just, not only, or not merely X, but Y      ONE construction
delve, crucial, not X but Y                     THREE entries
```

— must be parsed differently, and getting it wrong means either a phrase like
`not just` matching ordinary English or the corpus losing its most certain tell.
That single distinction is what most of the phrase-parsing code exists for.
