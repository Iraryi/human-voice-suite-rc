# Phase 29 migration: the full matrix re-run, and what moved

<!-- Generated from the stored run files and the local corpora. Counts only: no source text. -->

Two interface changes landed after the rule-status decision — `behaviorScore` admitting class A only
(Phase A), and the advice-permission tri-state (Phase B). This is the whole-matrix re-run that says what
they moved, what they did not, and which committed artefacts turned out to be stale for reasons that had
nothing to do with either.

**The headline, and it is the one that was predicted:** the advice gate changed **no score at all** — zero
of 483 measurements on any of the four — while changing what the advice rule reports on 441 of them.

## 1. The full matrix

| Step | Result |
| --- | --- |
| `npm test` | 892 passed, 6 skipped, 42 files |
| `npm run typecheck` | clean |
| `npm run build` | clean, 10 runtime files copied |
| `npm run bench:run` + `bench:report` | 483 measurements, re-rendered; `--check` current |
| `npm run bench:check` | corpus valid |
| `npm run advice:permission` + `--check` | re-rendered; 0/32/14/22 reproduced; `--check` current |
| `npm run advice:annotate -- --check` | 32 of 32 samples match A v1 |
| `npm run paired:report --limit 2000` | re-run; **not** adopted, see §5 |
| `npm run length:report` | re-run; **not** adopted, see §5 |
| `npm run helpsteer:report` | re-run; **not** adopted, see §5 |
| `npm run bank:report` | re-run; **not** adopted, see §5 |
| `npm run miss:report` | re-run; **not** adopted, see §5 |
| `npm run coverage:matrix` | re-run; output identical except its timestamp |
| `npm run solution:report` (+ `--set blind`) | re-run; **stale since Phase 23** — see §4 |
| `npm run shadow:report` | re-run; output identical except its timestamp |
| `npm run review:tally` | re-run; offer round added, earlier rounds unchanged |
| `npm run lexical:tally` | re-run; output identical except its timestamp |
| `npm run review:condition` | **not** re-run: the tool appends to `RULE_CONDITIONING.md` by design, so a second run duplicates every section rather than refreshing it |
| `npm run licenses:verify` | 8 of 8 preserved licences match upstream |
| `npm run upstream:check:offline` | clean |
| `npm run phrases:check` | current |
| `npm run voice:check` | author voices absent, which is the default |
| `npm run provenance:probe` | no long non-project prose in any scanned revision |
| `npm run release:audit` | 10 of 10 checks pass |

## 2. `behaviorScore` before and after, both migrations

Measured on the committed corpus, comparing stored run files. The corpus hash changed between them —
`advice_permission` was added to 32 samples — and the change is a shadow rule's input, which is why the
second migration moves nothing.

### Phase A: `behaviorScore` admits class A only

| | Before | After |
| --- | --- | --- |
| `antiAIScore` | 0.9528 | 0.9528 |
| `voiceScore` | 0.9075 | 0.9075 |
| `behaviorScore` | **0.9599** | **0.9808** |
| `preservationScore` | 1.0000 | 1.0000 |
| Measurements changed | — | 48 `behaviorScore` values, across **16 samples**, every one `model-generated` |

Nothing else moved. The 16 samples are the ones where a `descriptive`, `shadow` or `deprecated-candidate`
rule had been charging; they now report the finding and charge nothing.

### Phase B: the advice-permission tri-state

| | Before | After |
| --- | --- | --- |
| `antiAIScore` | 0.9528 | 0.9528 |
| `voiceScore` | 0.9075 | 0.9075 |
| `behaviorScore` | **0.9808** | **0.9808** |
| `preservationScore` | 1.0000 | 1.0000 |
| Measurements with **any** score change | — | **0 of 483** |
| Findings lost | — | 9, all `chat.unsolicited_advice` |
| Findings gained | — | 0 |
| Measurements carrying an abstention | — | 441 |

`behaviorScore` distribution, identical before and after: 429 at 1.00, 36 in 0.80–0.90, 18 below 0.80.

**This is the check the phase existed to pass.** The rule is `shadow`; wiring its gate must not move the
score, and it did not move it by a single measurement. What it moved is the *reporting*: the rule now
abstains on 441 of 483 measurements instead of firing on 9.

One thing this run exposed and did not change: **a shadow rule's finding still participates in the
suppression layer's corroboration.** Nothing in this migration showed it doing so — no measurement lost a
second finding when the advice finding disappeared — but the coupling exists by construction, and it is
recorded in §6 rather than left to be discovered by whoever wires the next gate.

## 3. The rule classes, and what each charges

| Class | In `behaviorScore` | The ten |
| --- | --- | --- |
| `discriminating` | **yes** | `over_agreement`, `forced_positivity`, `mechanical_empathy` |
| `descriptive` | no | `auto_summary`, `over_completeness` |
| `shadow` | no | `unsolicited_advice`, `unsolicited_offer`, `unrequested_background` |
| `hypothesis` | no | solution-mode shift — a composition, not a registered detector |
| `deprecated-candidate` | no | `mirrors_user`, `explains_obvious` |

The contributors of any `behaviorScore` are named in that score's rationale, and the findings it is *not*
charging are named beside them. `benchmarks/external/RULE_STATUS_DECISION.md` holds the decision for each
rule; `tests/rule-status-consistency.test.ts` holds the decision and the code in agreement.

**Two rules left this table after the release gate.** `chat.explains_obvious` and
`chat.unrequested_background` were class A by inheritance — they kept the pre-Phase-A default rather than
earning the class — and the gate review asked what evidence they had.
`chat.unrequested_background` reads its "unrequested" half from `requestKind` through a gate nothing
supplies, so the gate is always open and a missing answer is read as "the user asked for nothing", which is
the defect Phase B fixed in the advice rule and left in this one. `chat.explains_obvious` never fired in 483
measurements and its implementation never reads the conversation its name claims to know about. Both are
demoted, both are still reported, and **the evidence table for every rule is
[`GATE_REVIEW.md`](./GATE_REVIEW.md)**.

## 4. Stale artefacts found by re-running, and fixed

### `SOLUTION_MODE.md` was stale, and contradicted itself

Its §1 table reported that the frozen action-plan features find 2 of 20 `help` plans. Its own §4, four
sections later, reported 19 of 20 on the same replies with the same function. The file had not been
regenerated since the features were recalibrated, so half of it described a feature set that no longer
existed in the code — and the hand-written sentence under §4 ("Recall on the hand-labelled plans is 2 of
38") had survived the recalibration while the table above it was recomputed.

Regenerated. What changed:

| | Published | Re-run |
| --- | --- | --- |
| `help` / `plain`, plan-shaped | 2/20 (10.0%) | **19/20 (95.0%)** |
| `view` / `plain`, plan-shaped | 0/20 (0.0%) | 10/20 (50.0%) |
| `help` / `default` | 1/20 (5.0%) | 12/20 (60.0%) |
| `help` / `post` | 2/20 (5.0%) | 17/20 (85.0%) |
| Human control, plan-shaped | 5/60 (8.3%) | 48/60 (80.0%) |
| Calibration recall | "2 of 38" | **29 of 38** |

The recall sentence is now **derived from the table it sits under**, so it cannot drift again, and the
paragraph it replaced is kept as a dated note explaining what it used to say and why the features were
frozen rather than shipped. The §4 heading changed with it: "the features are not a detector yet" was no
longer true of the numbers beneath it.

**No conclusion moved.** The promotion conditions were never about recall on the calibration set, and
`SOLUTION_MODE_BLIND.md` — the run that the `shadow` decision actually rests on — was already current and
re-ran byte-identical. Its numbers, 23 of 24 obvious plans found and 0 of 24 complaints flagged, are
reproduced.

### `SOLUTION_MODE_BLIND.md` compared an answer key to a different exam

The blind report rendered the *calibration* section, whose hand labels describe the calibration set, against
the blind set's replies. The result was `23/20 (115.0%)` recall and "3 false positives" — arithmetic across
two different sets. Fixed: the calibration section is rendered for the calibration set only, and the blind
report carries its own summary computed from its own table (23/24 plans, 0/24 complaints). The blind
report's numbers were already correct everywhere else, which is why the decision they support is unchanged.

### Two source comments still described the pre-calibration state

`solution-report.ts` and `solution-calibrate.ts` both said the features "recall 2 of 38" in the present
tense. Corrected to say what happened and what the state is now.

## 5. What was re-run but **not** adopted, and why

Four phase reports were re-run under the new semantics and their fresh output was **not** committed:
`PAIRED_CONTROL.md`, `LENGTH_MATCHED.md`, `HELPSTEER3_EVALUATION.md`, `PROMPT_BANK.md` and
`MISS_ANALYSIS.md`.

The reason is the same for all five, and it is not that the new numbers are worse. Each is a **dated record
of a measurement that was published in a named phase**, under a harness that supplies a user turn and no
permission evidence. Re-running them makes the advice rule abstain everywhere, which silently restates a
past measurement as a different one:

- `PAIRED_CONTROL.md`: the advice row disappears entirely (0 firings instead of 0/32/14/22).
- `PROMPT_BANK.md`: "8 of 8 complaints answered with a plan, and the advice rule caught 1" becomes "caught
  0", which is a statement about the gate being unpopulated rather than about the rule.
- `MISS_ANALYSIS.md`: the uncaught share rises (95.2% → 96.7% on `plain`) because fewer continuations are
  caught, not because the continuations changed.
- `LENGTH_MATCHED.md` and `HELPSTEER3_EVALUATION.md`: same mechanism, in the advice rows.

So they are kept as published, each with a banner saying exactly what its advice rows were measured with —
`requestKind` unpopulated, gate disabled — and pointing at the current measurement. **A regenerated file
and a kept one differ in that row by design, and the banner says so.**

This is a deliberate departure from "re-render anything stale", and it is the narrower reading of the two
instructions it sits between: *keep the historical firing data, and do not regenerate old phase reports to
simulate the new permission.* Where a report was stale **against its own generator** it was regenerated
(`SOLUTION_MODE.md`); where it was accurate for its date it was kept and qualified.

The measured effect of the new semantics on those corpora is not lost: `ADVICE_PERMISSION.md` reports the
four-bucket gate table on the same 2,000-item paired baseline, and its first section reproduces the
published `0 / 32 / 14 / 22` exactly by forcing the permission to `absent`.

## 6. Known limitations this re-run leaves standing

1. **A shadow rule can corroborate a scored one.** `applySuppression` decides whether a `weakAlone` rule
   may stand on the strength of other findings, and it does not filter by class. In this migration nothing
   depended on it, but a rule that charges nothing should not be able to decide what is charged — the same
   argument that produced the class split. Recorded, not changed: it is suppression-layer semantics, and
   changing it in a release-candidate phase would move `behaviorScore` in exactly the way this phase exists
   to prove did not happen.
2. **`chat.unrequested_background` had the same unwired gate the advice rule had — resolved at the gate.**
   Its `unrequested` qualifier is read from `requestKind`, nothing populates that, and the rule was charging
   on the strength of a condition it never evaluates. **The release-gate review demoted it to `shadow`**,
   which moved `behaviorScore` 0.9808 → 0.9865 over 7 model-generated samples. This entry is kept as the
   record of the finding; the demotion is in [`GATE_REVIEW.md`](./GATE_REVIEW.md). The unwired gate is now a
   named function the consistency test guards.
3. **A v1 has no traditional-Chinese path and no noun-phrase request path.** On an explicit request for
   help written in traditional Chinese it returns `LOW`, the state that *allows* a rule to accuse. Found by
   the miss archive; recorded because A v1 is frozen.
