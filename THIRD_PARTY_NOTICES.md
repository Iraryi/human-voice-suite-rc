# Third-party notices

Human Voice Suite is licensed under the MIT License (see `LICENSE`). It builds
on work by other people. This file records exactly whose work, under which
licence, and what this project does with it.

Two rules govern everything below.

1. **A licence is checked before anything else.** If an upstream has no clear
   licence, its code does not enter this project. It may be read for
   understanding and recorded as `research-only` in the manifest. Nothing else.
2. **Notices are never deleted or abbreviated.** Where this project reuses work,
   the upstream's copyright line and permission text travel with it.

The verbatim licence text of every upstream is preserved byte-for-byte in
`licenses/`, which ships with the package. The `license_file` field in
`upstreams/manifest.json` points at the correct file for each entry, and
`npm run licenses:verify` re-checks every one of them against the commit pinned
in the manifest.

---

## 1. Summary

| Upstream | Pinned commit | Licence | Copyright (verbatim) | Preserved at | Integration |
| --- | --- | --- | --- | --- | --- |
| `lynote-ai/dsh-humanizer` | `9314b95d0b` | BSD-3-Clause | `Copyright (c) 2026, lynote-ai` | `licenses/BSD-3-Clause-dsh-humanizer` | voice profile, detector |
| `blader/humanizer` | `9862685f57` | MIT | `Copyright (c) 2025 Siqi Chen` | `licenses/MIT-blader` | rules (parsed) |
| `judetelan/ai-humanizer` | `76bf08f13b` | MIT | `Copyright (c) 2026 judetelan` | `licenses/MIT-ai-humanizer` | detector — **restricted import** |
| `ai-zixun/humanizer-zh` | `f75f1ac973` | MIT | `Copyright (c) 2026 aizixun` | `licenses/MIT-humanizer-zh` | rules, voice profiles |
| `lynote-ai/humanize-text` | `48f3c0ac0f` | MIT | `Copyright (c) 2026 Lynote.ai` | `licenses/MIT-humanize-text` | methodology, detector |
| `holygeek00/humanizer-zh-cn` | `401e372eeb` | MIT | `Copyright (c) 2025 Siqi Chen` | `licenses/MIT-humanizer-zh-cn` | rules (parsed) |
| `op7418/Humanizer-zh` | `91f3d394db` | MIT | `Copyright (c) 2026 歸藏` | `licenses/MIT-op7418-humanizer-zh` | **research only** |
| `hardikpandya/stop-slop` | `8da1f03018` | MIT | `Copyright (c) 2025 Hardik Pandya` | `licenses/MIT-stop-slop` | **research only** |

Full commit SHAs are in `upstreams/manifest.json`. Commit short forms are shown
here only for readability.

---

## 2. Why there is more than one MIT file

Every MIT licence in the set has the same body text and a different copyright
line. The tables in `licenses/` are named by licence first and upstream second,
so that a glance tells you the licence family before the project.

One verifiable detail worth recording: `licenses/MIT-blader` and
`licenses/MIT-humanizer-zh-cn` are byte-identical
(`sha256:4AC4810254AB36D4…`). That is not a coincidence and not an error in this
archive — it is the evidence that `holygeek00/humanizer-zh-cn`, a fork of
`blader/humanizer`, kept the upstream copyright line intact.

---

## 3. BSD-3-Clause obligations for `lynote-ai/dsh-humanizer`

This is the only non-MIT licence in the set, and its terms are stricter than
MIT in three specific ways. All three are binding on this project.

**Clause 1 — source redistribution.** If any of its source is redistributed in
source form, the copyright notice, the list of conditions and the disclaimer
must all be retained. `licenses/BSD-3-Clause-dsh-humanizer` contains all three
in full, and it ships with the package.

**Clause 2 — binary redistribution.** If it is redistributed in binary or
compiled form, the copyright notice **and** the disclaimer must be reproduced in
the documentation or other materials. Reproducing the copyright line alone is
not sufficient. The disclaimer is reproduced in full in that file.

**Clause 3 — no endorsement.** The name of the copyright holder and the names of
its contributors may not be used to endorse or promote products derived from
this software without prior written permission. Therefore:

> Human Voice Suite is an independent project. It is **not** affiliated with,
> endorsed by, or sponsored by lynote-ai. Any statement to the contrary is
> incorrect and is not authorised.

Factual attribution — naming the project and the licence — is required and is
what this file does. That is not endorsement and must not be presented as such.

BSD-3-Clause grants no patent licence. It is silent on patents, unlike
Apache-2.0.

---

## 4. Compliance findings

These findings are recorded because the project's licence policy requires them
to be visible, and because two of them constrain what may be imported.

### 4.1 `op7418/Humanizer-zh` — notice-retention defect, research only

The repository describes itself as a translation of `blader/humanizer`, and the
comparison in `upstreams/reports/op7418-humanizer-zh.md` confirms it reproduces
all 24 pattern headings, the watched lists, the examples and the process section
of blader v2.1.0. Its `LICENSE` contains only `Copyright (c) 2026 歸藏`. The
string `Siqi` appears nowhere in the repository.

MIT requires the copyright notice to be included in all copies or substantial
portions. On its face, that condition is not met.

**Consequence for this project:** nothing may be copied from
`op7418/Humanizer-zh` into a distributed artefact, because doing so would
propagate the defect. Where the capability is wanted, it is taken from
`blader/humanizer`, which holds title. The manifest records this as
`integration: "research-only"` and `tracked: false`.

### 4.2 `judetelan/ai-humanizer` — restricted import

This upstream's own code is MIT and its licence is clean. The problem is content
it took from elsewhere:

- Eleven of its forty-six rules are marked in its own source as absorbed from
  `hardikpandya/stop-slop`, and the absorption is verbatim — the business-jargon
  swap table is reproduced row-for-row, several phrase lists are identical, and
  the scoring rubric is the same.
- `Copyright (c) 2025 Hardik Pandya` does not appear anywhere in its tree. Only
  a prose credit does. That is not sufficient under MIT.
- It also credits a project behind a broken URL with no licence, uses
  Wikipedia material that is CC BY-SA without share-alike attribution, and names
  five further repositories for which no licence text is recorded.

**Consequence for this project:** only the thirty-five rules that are this
upstream's own original work may be imported. The barred content is enumerated
machine-readably in `upstreams/manifest.json` under `import_exclusions` and in
`src/upstream/adapters/ai-humanizer/index.ts` as `IMPORT_EXCLUSIONS`. The
equivalent capability is imported from `hardikpandya/stop-slop` instead, which
holds clean title, and is then attributed to both.

### 4.3 `hardikpandya/stop-slop` — clean title, small extraction

Its licence is clean MIT. It is marked research-only as a *package* not because
of any licence problem but because roughly nine tenths of it is already present
in the set through `ai-humanizer`. Its real function here is as the clean-title
source for the content that must be re-imported out of `ai-humanizer`.

### 4.4 Blocked sources

No content whatever enters this project from the following, because no licence
could be established:

- The project `judetelan/ai-humanizer` credits as "impeccable", behind a broken
  URL (`https://github.com/`).
- `harshaneel/humanize`, `unslop`, `brandonwise/humanizer`, `no-ai-slop` and
  `avoid-slop`, all named as sources by `judetelan/ai-humanizer` with no licence
  text, copyright line or per-item provenance recorded.
- Wikipedia's *Signs of AI writing*, which is CC BY-SA and is credited upstream
  without the share-alike attribution that licence requires. Several upstreams
  draw on it. This project does not copy from it.

---

## 5. Lineage and why it matters for attribution

Several of these repositories are the same work at different revisions. This is
recorded here because it changes how their rules must be credited.

```text
Wikipedia: Signs of AI writing      (external, CC BY-SA, not copied)
        │
        ├── blader/humanizer  v2.1.0 (24 patterns)
        │                   v2.9.1 (33 patterns)
        │                   v3.0.0 (25 patterns)  <-- the common ancestor
        │           │
        │           ├── holygeek00/humanizer-zh-cn   fork of v2.9.1, notice kept
        │           └── op7418/Humanizer-zh          translation of v2.1.0, notice dropped
        │
        ├── hardikpandya/stop-slop
        │           └── absorbed verbatim into judetelan/ai-humanizer (notice dropped there)
        │
        ├── ai-zixun/humanizer-zh      independently inspired by blader, own 13 rules
        └── lynote-ai/dsh-humanizer    conceptually modelled on three of the above
```

`ai-zixun/humanizer-zh` acknowledges blader as inspiration but shares no verbatim
text, so its rules are its own. `lynote-ai/dsh-humanizer` describes its rules as
modelled on three of the others, but shares no rule identifier with any of them,
so it is treated as an independent rule set.

**Practical consequence.** A tell such as "avoid inflated significance" appears in
`blader/humanizer` pattern 13, `humanizer-zh-cn` pattern 1 and
`ai-zixun/humanizer-zh` pattern 3. Those are one discovery at three revisions and
one independent Chinese rule, not three discoveries. This project collapses them
to a single canonical rule carrying all three source references. Counting them
separately would deduct three times for one problem — the failure mode this
project exists to prevent.

---

## 6. Policy for adding a new upstream

Every new upstream must satisfy all of the following before any of its content is
used.

1. **Establish the licence.** Read the actual `LICENSE` file at the pinned
   commit. A repository with no licence file is `research-only` regardless of how
   useful it looks. Do not infer a licence from a README badge.
2. **Identify the copyright holder verbatim.** Copy the exact line, including
   punctuation and spacing. It goes into the manifest and into the archive.
3. **Pin a commit.** Record the full forty-character SHA. Branches move.
4. **Check for inherited content.** If the upstream absorbed work from a third
   party, verify that the third party's notice travelled with it. If it did not,
   restrict the import and source that content from wherever title is clean.
5. **Record the lineage.** Fill in `derived_from` for content derivation, and
   `external_ancestors` for ancestors outside the manifest. Same-lineage
   repositories must never be counted as independent discoveries.
6. **Archive the licence text.** Copy it byte-for-byte into `licenses/`.
7. **Update this file.** Add the row and, if anything is unusual, a section.
8. **Do not delete an existing notice.** Not when rewriting, not when
   translating, not when consolidating.

`npm run licenses:verify` checks step 6 against the pinned commits. Steps 1 to 5
and 7 to 8 are checked by review; `upstreams/manifest.json` is validated
structurally on every load.
