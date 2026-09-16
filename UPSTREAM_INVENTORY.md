# Upstream inventory

Phase 1 reconnaissance for Human Voice Suite.

Eight repositories were inventoried. Five are in the first batch that must be
wired in; three were investigated without being merged. All eight were cloned
read-only into `.upstream-cache/` and **none of them was modified**. Every claim
below is traceable to `file:line` in the per-repository reports under
`upstreams/reports/`, and every commit is pinned in `upstreams/manifest.json`.

## How to read this document

The single most important finding is not any individual repository's feature
list. It is that **most of these repositories are the same work at different
revisions**, and a naive integration would count one tell three or four times.
That finding is section 1. Everything else is detail.

Sections:

1. Lineage — who derived from whom, and why it changes the design
2. Version drift — why pattern numbers are not comparable across the set
3. Capability matrix
4. Per-upstream inventories
5. Cross-cutting duplication
6. Licence position
7. Integration recommendations, ranked
8. What Phase 1 deliberately did not do

---

## 1. Lineage

```text
Wikipedia: "Signs of AI writing"            external, CC BY-SA, NOT copied
        │
        ├── blader/humanizer                MIT, (c) 2025 Siqi Chen
        │        v2.1.0  24 patterns
        │        v2.9.1  33 patterns
        │        v3.0.0  25 patterns   <-- current HEAD, the common ancestor
        │        │
        │        ├── holygeek00/humanizer-zh-cn     fork of v2.9.1, 33 patterns, notice KEPT
        │        └── op7418/Humanizer-zh            translation of v2.1.0, 24 patterns, notice DROPPED
        │
        ├── hardikpandya/stop-slop          MIT, (c) 2025 Hardik Pandya
        │        └── absorbed verbatim into judetelan/ai-humanizer (11 of 46 rules, notice DROPPED there)
        │
        ├── ai-zixun/humanizer-zh           MIT, (c) 2026 aizixun
        │        acknowledged inspiration only; zero verbatim overlap; own 13 rules
        │
        └── lynote-ai/dsh-humanizer         BSD-3-Clause, (c) 2026 lynote-ai
                 source says "modelled on" three of the above;
                 zero shared rule ids, ~20% shared pattern strings
```

`lynote-ai/humanize-text` is a separate line: it descends from `molly554/ai-humanize`
and shares no rule identifiers with anything else here. It is the only upstream
whose ancestry sits outside this corpus.

### Why this matters more than any feature list

`blader/humanizer` pattern 13 is "Inflated significance".
`humanizer-zh-cn` pattern 1 is `空泛拔高意义`.
`ai-zixun/humanizer-zh` pattern 3 is `空泛大词`.

Those are all the same tell. Two of them are the same lineage at different
revisions, and the third is an independent Chinese rule that happens to overlap.
If the suite scored them separately, one problem would be deducted three times —
and every downstream number would be wrong. `CanonicalRule` plus signature-based
deduplication exists precisely to prevent that, and it is why `sources` is an
array rather than a single field.

### The two provenance defects

Recorded because they constrain what may be imported:

- **`op7418/Humanizer-zh`** reproduces all 24 pattern headings, watched lists,
  examples and the process section of blader v2.1.0, and its only copyright line
  is the translator's. The string `Siqi` appears nowhere in the repository. MIT's
  notice condition is not met on its face, so nothing may be copied out of it.
  Integration kind is `research-only`.
- **`judetelan/ai-humanizer`** absorbed 11 of its 46 rules, its scoring rubric,
  its business-jargon swap table and several phrase lists verbatim from
  `stop-slop`, and credits it in prose only. Hardik Pandya's notice is absent.
  Its own rules are clean MIT, so **only the 35 original rules may be imported**;
  the barred content is enumerated in the manifest and must be taken from
  `stop-slop` instead, which holds clean title.

This is the case the project brief's licence rule was written for, and it is the
reason the manifest carries machine-readable `import_exclusions` rather than a
comment somebody can miss.

---

## 2. Version drift

Pattern numbers are **not** comparable across this corpus without the baseline
commit. This is a real trap: the same number means different things in different
repositories.

| Repository | Baseline | Patterns | Numbering means |
| --- | --- | ---: | --- |
| `blader/humanizer` @ v2.1.0 | — | 24 | legacy English numbering |
| `blader/humanizer` @ v2.9.1 | — | 33 | mid English numbering |
| `blader/humanizer` @ v3.0.0 | — | 25 | current, regrouped into sections A–E |
| `op7418/Humanizer-zh` | blader v2.1.0 | 24 | 1:1 with blader v2.1.0 numbering |
| `holygeek00/humanizer-zh-cn` | blader v2.9.1 | 33 | 1:1 with blader v2.9.1 numbering |
| `ai-zixun/humanizer-zh` | independent | 13 | its own taxonomy, no mapping to blader |
| `judetelan/ai-humanizer` | own registry | 46 | string ids, no numbering |
| `lynote-ai/dsh-humanizer` | own registry | 13 | string ids, no numbering |

A worked example of the trap. "Avoid dashes" is:

| Revision | Identifier | Name |
| --- | --- | --- |
| blader v3.0.0 | pattern 8 | Dashes as the universal connector |
| op7418 (blader v2.1.0 numbering) | pattern 13 | 破折号过度使用 |
| humanizer-zh-cn (blader v2.9.1 numbering) | pattern 14 | 破折号、括号和补充说明过密 |
| ai-zixun | pattern 6 | 冒号、破折号和引号 |

Four different numbers, one tell. **Consequence:** the suite's dedupe key must be
a repository-independent signature, never a pattern number. The alias layer
additionally resolves `<upstream>#<number>` so a finding expressed in upstream
numbering still lands on the right canonical rule.

**Second consequence, for the sync system:** `humanizer-zh-cn` pins blader at
v2.9.1 while upstream `main` is now v3.0.0. Its weekly sync workflow will
legitimately fail validation the next time it runs and open a blocking issue.
That is expected behaviour on its side, and a reason not to run its workflow
ourselves.

---

## 3. Capability matrix

| Capability | dsh-humanizer | blader | ai-humanizer | humanizer-zh | humanize-text | humanizer-zh-cn | op7418 | stop-slop |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Executable detector | yes | no | **yes** | no | partial | no | no | no |
| Rule count | 13 rules / 184 patterns | 25 patterns | **46 rules** | 13 patterns | 30 vocab + 3 rhythm | 33 patterns | 24 patterns | 76 phrases + 48 structures |
| Language | TS | MD | JS | MD | Python | MD | MD | MD |
| Chinese rules | yes (7 of 13) | no | no | **yes (original)** | partial | **yes (best)** | yes | no |
| English rules | yes (6 of 13) | **yes (origin)** | yes | no | yes | no | no | yes |
| Voice / stylometry | **25-field fingerprint** | no | document-level only | **8 author profiles** | statistical features | no | rubric only | no |
| Scoring | 2 blended 0–100 | none | 1 blended 0–100 | none | none | none | 5-dim rubric | 5-dim rubric |
| No LLM needed | **yes** | yes | yes | yes | no | yes | yes | yes |
| Runs offline | yes | n/a | yes | n/a | detector only | n/a | n/a | n/a |
| Tests | 23 | validator | none | none | 2 files | validator | none | none |
| Licence | BSD-3 | MIT | MIT | MIT | MIT | MIT | MIT | MIT |
| Notice intact | n/a | yes | **defective** | weak | yes | yes | **defective** | yes |

Bold marks the strongest source for that capability.

---

## 4. Per-upstream inventories

Each entry follows the structure the brief asked for: functionality, language,
code structure, rules, detection algorithm, scoring, voice, pipeline, reusable
modules, duplication, licence, integration advice.

Full detail with `file:line` citations is in `upstreams/reports/`.

---

### 4.1 `lynote-ai/dsh-humanizer`

**Pinned:** `9314b95d0b1ba663331f47f0a8ea006b6dc5f509` · v0.1.0 · main
**Licence:** BSD-3-Clause · `Copyright (c) 2026, lynote-ai` · the only non-MIT
licence in the set

**Functionality.** A DeepSeek Harness plugin that analyses text for AI tells,
stores and compares personal writing fingerprints, and emits a rewrite brief for
the calling agent to apply. The only upstream already shaped as a DSH plugin.

**Language and structure.** TypeScript, ESM. 48 tracked files.
`src/` 11 `.ts` (50,964 B) compiles to `lib/` 11 `.js` + 11 `.d.ts` (57,252 B);
`test/` 5 `.ts` (7,961 B). Source of truth is `src/`; `lib/` and
`lib/types/*.d.ts` are build output.

**Rules.** 13 rules across 7 categories, **184** total pattern strings.

A count correction, found while writing the adapter in Phase 2. The first
reconnaissance reported 175, but that report's own per-rule counts sum to 184,
and an independent character-level scan of the committed compiled
`lib/core/rules.js` also gives 184. The 175 was the error, and it was corrected
by counting the artifact rather than trusting the summary. A third figure, 162,
appears in an unrelated report. When a count matters, count the file.

| Category | Rules |
| --- | --- |
| `empty-opener` | `empty-opener-en` (3), `empty-opener-zh` (3) |
| `cliche` | `cliche-en` (2), `cliche-zh` (2) |
| `hedge` | `hedge-en` (1), `hedge-zh` (1) |
| `transition` | `transition-en` (2), `transition-zh` (2) |
| `summary-ending` | `summary-ending-en` (3), `summary-ending-zh` (3) |
| `mechanical-parallel` | `mechanical-parallel-zh` (3) |
| `over-explain` | `over-explain-en` (2), `over-explain-zh` (2) |

Severity is 1–3. Rule shape is
`{ id, category, severity, patterns[], note }`, patterns compiled as
`new RegExp(source, 'gi')`.

**Detection algorithm.** Regex matching over the pattern list, then a
burstiness and sentence-length heuristic layered on top.

**Known defect — do not inherit.** No `m` flag is passed, so all 37
`^`-anchored patterns match only at absolute position 0 of the input. The
entire `transition` category and most of `summary-ending` are unreachable on
multi-paragraph text, which silently depresses every score. Verified by running
the compiler: `gim` matches, `gi` does not. Fix and re-baseline, or the ported
detector will under-report.

**Scoring.** Two **independent** blended scalars, never combined:

1. `analyzeText().aiScore`, 0–100, higher meaning more AI-like:
   `aiScore += severity × min(count, 5) × 2`, `+10` if more than 4 sentences and
   burstiness below 1.5, `+5` if more than 3 sentences and average length above
   32, then clamped and rounded. Maximum before clamping is 405, so it saturates
   and is not normalised by text length.
2. `scoreSimilarity().score`, 0–100, plus a `features[]` breakdown. Weights:
   sentence-length 0.2, burstiness 0.2, punctuation 0.15, stance 0.15,
   vocabulary overlap 0.15, sentence-length spread 0.15.

There is no multi-axis vector anywhere. A draft can score 100 for voice match
while being full of clichés; the two numbers never meet.

**Voice.** `StyleFingerprint`, 25 leaf fields, all density measures per 100
tokens: `language`, `sampleCount`, `totalWords`, `sentence.{avgLength,
medianLength, burstiness, shortRate, longRate}`, `punctuation.{emDash, ellipsis,
semicolon, colon, parentheses, exclamation, question}`, `stance.{firstPersonRate,
secondPersonRate, hedgeRate, transitionRate, aiPhraseHits, adverbRate,
contractionRate}`, `vocabulary.{typeTokenRatio, topWords, topOpeners}`,
`platforms`. **10 of the 25 are never used** by the similarity scorer.

**Pipeline.** Eight tools registered imperatively through
`ctx.tools.register(defineTool(...))`; there is no manifest tool list. Entry
point is `apply(ctx, config)` with `name`, `inject` and a schemastery `Config`;
`package.json` declares `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`.
**No LLM calls anywhere** — the rewrite tools return a prose brief the agent
applies itself. That decision is kept.

**Reusable modules.** `src/core/{text,rules,analyze,fingerprint,score}.ts` is a
pure, dependency-free, bilingual deterministic kernel and is the highest-value
extraction in the set. Its 23 tests can come along unchanged.

**Duplication.** Against `humanize-text` (same owner): zero shared rule ids, no
shared schema; ~9 shared cliché headwords; complementary rather than
duplicative. Against `blader/humanizer`: strong overlap with only about 4 of its
25 patterns; **15 blader patterns have no counterpart at all**, and they are
exactly the structural and formatting ones (dashes, bold, headings, curly
quotes, passive voice, chatbot residue) that a regex registry cannot express.
Those need a different detector kind.

**Integration.** `voice-profile` (kind C) for the fingerprint, `executable-detector`
(kind A) for the rule kernel. Do **not** vendor `index.ts`, `humanizer.ts` or
`voice.ts` — re-implement the DSH registration, keeping the eight tool names as a
compatibility surface. Adopt the three `STRENGTH_GUIDANCE` strings verbatim;
they encode the right safety constraints.

**Four mandatory fixes before real use.** The missing `m` flag; `store.ts:50`
silently discards the entire profile file on any schema-version mismatch;
`aiScore` should become a per-100-token density; and roughly half the modules
have no test coverage.

**BSD-3-Clause obligations.** Retain notice, conditions and disclaimer in source
redistribution. In binary redistribution, reproduce the notice **and** the
disclaimer in documentation. Do not use the `lynote-ai` name to endorse or
promote derived work. BSD-3 grants no patent licence.

---

### 4.2 `blader/humanizer`

**Pinned:** `9862685f575c65a8247f90369951df1b3416e3d6` · v3.0.0 (= tag `v3.0.0`) · main
**Licence:** MIT · `Copyright (c) 2025 Siqi Chen`

**Functionality.** An agent skill written as a prompt. It is the origin of the
English lineage and the conceptual ancestor of most of the Chinese corpus.

**Language and structure.** Markdown only. 9 files, 53,963 B. `SKILL.md` is
28,728 B / 374 lines and is the product. `README.md` holds the pattern tables and
version history. `AGENTS.md` states the maintenance rules: patterns numbered from
1 without gaps, strongest and most frequent first; `SKILL.md`, `README.md` and
`.claude-plugin/plugin.json` must agree on version; a new tell earns a pattern
only when no existing pattern already implies it.

**Rules.** **25 numbered patterns, contiguous 1–25, no gaps**, in five sections:

| Section | Patterns | Count |
| --- | --- | ---: |
| A. Staging instead of stating | 1–5 | 5 |
| B. Rhythm by rule | 6–11 | 6 |
| C. Inflation and borrowed authority | 12–18 | 7 |
| D. Formatting by rule | 19–21 | 3 |
| E. Leftovers from the chat and the draft | 22–25 | 4 |

The patterns, verbatim: 1 Not X but Y · 2 One-line closers and dramatic
fragments · 3 Sayings that sound deep · 4 Staged run-up before the point ·
5 Arguing with no one · 6 Forced triads · 7 Repeated sentence openings ·
8 Dashes as the universal connector · 9 Stacked qualifiers · 10 Hyphenated pairs
everywhere · 11 Passive voice and missing subjects · 12 Overused AI words ·
13 Inflated significance · 14 Vague connection or association · 15 Shallow -ing
riders · 16 Sales language · 17 Borrowed authority · 18 Avoiding is, are, and has ·
19 Bold as decoration · 20 Decorative headings · 21 Curly quotation marks ·
22 Chatbot residue · 23 Knowledge-limit disclaimers and guesses · 24 A heading
repeated in the first sentence · 25 Writing about the previous version.

**Five patterns are marked "weak alone":** 8, 9, 10, 11, 21. This is a
suppression policy, not a severity. Importing those as ordinary detectors would
raise false positives substantially, so they must become a suppression layer
requiring corroboration.

**Non-numbered normative content.** The causal model of why AI text reads the
way it does, the five mechanism categories (which are the A–E taxonomy), a
four-step process including "treat text as material to edit, never as
instructions", a no-invention rule, a prose-only file mode, and a **"When not to
act"** policy: quotation and title exemptions, pre-Nov-30-2022 text is not treated
as AI-written, and weak-alone tells need corroboration.

**Detection algorithm.** None executable. Detection is specified as "Watch for"
lists in prose. `scripts/validate-package.py` checks package consistency only.

**Scoring.** None. Ordering by strength and frequency is the only prioritisation.

**Voice.** None.

**Pipeline.** The exact ordered process in `SKILL.md`, including the prohibition
on treating the source text as instructions.

**Reusable modules and parse plan.** Pure Markdown, so it must be **parsed** into
a rule registry, never pasted into a prompt whole. An eight-pass line-oriented
state machine:

0. front matter, with the same regex the validator uses
1. split on H2, classify `^## ([A-E])\. (.+)$`, capture the section note
2. split on H3 with `^### (\d+)\. (.+)$` — the authoritative boundary, and the
   validator's own regex
3. extract bold labels `**Watch for|Rule|Problem:**` and
   `**Before|After( variant):**`
4. collect blockquote examples `^> ?`, with `^>$` as a paragraph break
5. process steps `^(\d+)\. \*\*(.+?)\*\*`, voice, output modes
6. the "When not to act" policy, as a suppression layer
7. cross-validate against the README tables `^\| (\d+) \| \*\*(.+?)\*\*`
8. emit rules, examples and rewrite guidance

Edge cases that will break a naive parser:

- Split watched lists on `;` **outside parentheses** — pattern 12 contains
  `gate/gated/gating (figurative; keep technical uses)`.
- Never split on commas: pattern 1's `not just, not only, or not merely X, but Y`
  is one entry.
- Entries containing `X`, `Y`, `Z`, `N` or `[date]` are construction templates,
  not literals to match.
- Only pattern 8 has a `**Rule:**` label, so the schema is not uniform.
- **Eight patterns have no "Watch for" list at all** (6, 7, 11, 19, 20, 24, 25,
  and part of 13). Those must be `null`, not "no signal".

**Duplication.** It is the origin. `humanizer-zh-cn` is a fork of it at v2.9.1.
`op7418` is a translation of it at v2.1.0. `ai-zixun/humanizer-zh` cites it as
inspiration without copying. `judetelan/ai-humanizer` shares roughly 15 of 27
current vocabulary tokens and about six substantive rule concepts, but with 22
patterns having no counterpart — convergence on a shared public source rather
than copying.

**Integration.** `markdown-skill` (kind B), the primary English rule source.
Route all Chinese-lineage provenance through this repository rather than through
`op7418`, because this one holds title.

---

### 4.3 `judetelan/ai-humanizer`

**Pinned:** `76bf08f13bee88044f448fd1b80604e33bb662b6` · unversioned · main
**Licence:** MIT · `Copyright (c) 2026 judetelan` · **restricted import**

**Functionality.** The richest source of genuinely executable detection logic in
the corpus.

**Language and structure.** Plain ESM JavaScript, dependency-free. 17 files,
121,883 B. Nothing to build and nothing to install.

**Rules.** **46 rules** in `scripts/registry/rules.mjs`, verified by counting
`id:` entries. The README's claim of 40 is stale — always count the registry.
Categories: lexical 25, cadence 8, formatting 7, stylometry 6. Severities are
`warning` (13), `info` (18), `advisory` (15); weights run 2–12, with
`llm-artifact-leak` highest at 12.

The consequential groups are the hundreds of lexicon-driven lexical tells, the
cadence tells (em-dash overuse weight 6, aphoristic cadence weight 5,
negative listing weight 5), the formatting tells (`llm-artifact-leak` weight 12,
covering `citeturn`, `oaicite`, `utm_source=chatgpt.com`, `[Your Name]`,
`grok_card`), and the stylometry thresholds. Five provider-gated tic sets exist
for GPT, Claude, Gemini, Grok and DeepSeek, all off by default.

**Lexicons.** 524 entries across 26 arrays, 512 unique. **12 entries are
duplicated across arrays**, which double-charges those terms — fix on import.

**Detection algorithm.** `scripts/engines/lexical.mjs` holds 40 regex and lexicon
detectors keyed by rule id. `scripts/engines/stylometry.mjs` provides
`features()` with 11 distributional features plus 6 detectors; one additional
`sentence-spread` detector is defined but never registered, so it is dead code.
All of it runs offline.

**Scoring.** A single blended 0–100:
`raw = Σ weightFor(rule, mode) × min(3, 1 + log2(max(1, count)))`, then
`slop = min(100, round(raw))`, with bands 0 human / ≤10 likely human / ≤25 mixed /
≤45 likely AI / >45 AI slop. It is **not normalised by length** and severity is
display-only. Do not ship a second incompatible 0–100 scale alongside
dsh-humanizer's; normalise and let severity participate.

**Voice.** **None.** No author model, no profile, no enrolment, no target-style
comparison. Only document-level stylometry against fixed global thresholds.

**Pipeline.** `analyze()` orchestrates, with a CLI and a Claude Code PostToolUse
hook. The storage module writes a JSONL slop trend into the current working
directory. There is no packaging and no CI.

**Reusable modules.** `scripts/engines/lexical.mjs`,
`scripts/engines/stylometry.mjs`, `scripts/registry/rules.mjs`,
`scripts/lexicons.mjs`, `scripts/shared/text.mjs` (a line-number-preserving
HTML/Markdown stripper) and `scripts/humanize-detect.mjs`. Port all of them
behind one `Detector` interface, keeping rule ids and thresholds as data.

**Duplication — the important part.** Eleven of the 46 rules are marked in the
source as `// ── Absorbed from stop-slop (editorial tells)`. The evidence is
conclusive: the business-jargon swap table is reproduced row-for-row in the same
order; the Directness/Rhythm/Trust/Authenticity/Density rubric is stop-slop's
scoring table; the vague-declarative, emphasis-crutch, meta-commentary,
rhetorical-setup, adverb-filler and lazy-extremes phrase lists are verbatim; and
two regexes encode stop-slop's table rows one per row.

**Licence position.** The upstream's own code is clean MIT. But Hardik Pandya's
notice is nowhere in the tree, only a prose credit. It also credits a project
behind a broken URL with no licence, uses Wikipedia material that is CC BY-SA
without share-alike attribution, and names five further repositories with no
licence text recorded.

**Integration.** `executable-detector` (kind A) for the 35 original rules only.
The barred content is enumerated in the manifest under `import_exclusions` and in
the adapter as `IMPORT_EXCLUSIONS`, and must be sourced from
`hardikpandya/stop-slop` instead, then attributed to both. Also worth taking: the
`check.md` report contract and the hook's self-skip guard. Keep the
levers/rubric/audit ranking as methodology (kind D), off the default path.

---

### 4.4 `ai-zixun/humanizer-zh`

**Pinned:** `f75f1ac9735c4f10da1bba0148e0ea7228c5c3b3` · v1.3.0 · main
**Licence:** MIT · `Copyright (c) 2026 aizixun`

**Functionality.** Chinese rules plus a Chinese author voice library. Two
independent assets with different risk profiles.

**Language and structure.** Markdown. 23 files, 130,678 B. Zero executable code,
no tests, no validator.

**Rules.** **13 patterns** in `references/patterns.md`, numbered 1–13, contiguous,
with no severity field anywhere. Verbatim:
`1 机械对照句 · 2 翻译腔连接词 · 3 空泛大词 · 4 段落结尾的口号化收束 ·
5 列表和排比成瘾 · 6 冒号、破折号和引号 · 7 营销稿与官样文章腔 ·
8 过度谨慎或过度确定 · 9 开头、主体、结尾脱节 · 10 文章级重写模板 ·
11 编号枚举撑全文 · 12 章末段末的预告式收束 · 13 抽象转义与重锤句`.

`SKILL.md` adds 8 Core Rules, 4 repo overrides and 4 voice-adoption
anti-patterns, for 35 rule entries in total. §10 uses H3-numbered sub-paths, so a
parser must track the parent section or it will mistake those for patterns.

**Highest-value unique content.** A four-step quote-style precedence chain
(explicit user request → project declaration → default `""`, keeping source 「」
when undeclared); a `——` ban; a colon-density rule; mixed Chinese/English spacing
rules; and date normalisation. No other upstream in the set has these.

**Detection algorithm.** None. Prose only. Watched phrases are inline 「」 strings.

**Scoring.** `none found`.

**Voice — the richest voice material in the corpus.** **Eight** author profiles,
not nine: 李笑来 (Li Xiaolai), 鹤老师 (Hè Lǎoshī), 罗振宇 (Luó Zhènyǔ),
吴军 (Wú Jūn), 李尚龙 (Lǐ Shànglóng), 何帆 (Hé Fān), 冯唐 (Féng Táng),
刘子超 (Liú Zǐchāo).

They share an **identical container schema** across all eight files, in order:

1. `## Persona (who you are when writing)` — at line 14 in every file
2. `## Quick Reference: Sentence Templates` — exactly 8 numbered entries every file
3. `## Voice Rules` — exactly 12 numbered entries every file
4. `## Anti-Patterns — things <Author> would NEVER do:` — 8 to 13 bullets

Also identical in all eight: a line-1 `# 声音：<中文> (<Pinyin>)` title, `适用：`,
`启用方式：`, a four-line neutrality preamble, a `---` at line 10, and persona
prose starting at line 12. Five of the eight declare which Core Rule they
override.

But the **fields inside are free-form prose**, not an enumerated vocabulary.
There is no 成语, taboo-word, sentence-length, rhythm, vocabulary or tone field;
those dimensions appear as bold prose labels. Two profiles carry no quantified
bounds at all. All eight are pure prose with no blockquote example passages.

**Consequence:** one deterministic parser suffices for the container, plus a
normalisation pass for the free-form dimensions. Case-insensitive heading
matching is required — three of the eight use lowercase `## Voice rules` or
`## Anti-patterns`, and `helaoshi` anonymises to "this author".

**Hazards to neutralise before import.** The 李笑来 profile instructs inventing
plausible fake numbers when real data is unavailable, which contradicts the
no-invention rule everywhere else in the corpus. And all eight instruct writing
as a named living author, which is a publicity-rights question a software licence
does not settle.

**Corpus.** `references/corpus.md` is an annotated list of Chinese writing with
external links only and no excerpts, so exposure is minimal.
`references/corpus-quickpick.md` holds two trivial pipe tables, 9 and 13 rows.
Note an internal contradiction: `corpus.md` forbids borrowing 人设/口癖/立场 while
`SKILL.md` makes 作者档案优先.

**Derivation.** Acknowledged inspiration, not copying. `README.md` `## 致谢`
names blader/humanizer explicitly. Evidence against copying: 13 patterns match
neither 33 nor 25; zero verbatim text overlap; a completely different pattern
schema (blader uses `**Watch for/**Problem/**Before/**After` in five lettered
sections, this uses flat 常见问题/处理方法/修改前/修改后); and the bulk of the
content is Chinese-only. Confidence: about 95% derived at concept and packaging
level, about 70% that no text was copied.

**Licence position.** Not a demonstrated MIT breach, because the notice clause
triggers on copies and substantial portions and no verbatim overlap was found.
But it is weak hygiene given the package shape and seven conceptual pattern
mappings. **Recommendation: carry both notices regardless**, as `humanizer-zh-cn`
already does.

**Integration.** `markdown-skill` (kind B) for the 13 patterns and 8 Core Rules;
`voice-profile` (kind C) for the eight author profiles. §10's six rewrite paths
are methodology (kind D), kept out of the default path. Chinese cross-repo
duplication is minimal: zero shared pattern names with either Chinese sibling,
and the only three-way exact phrase match is `值得注意的是`.

---

### 4.5 `lynote-ai/humanize-text`

**Pinned:** `48f3c0ac0f51cb7c2af23cbf45ea865e1d71e04e` · v1.5.2 · main
**Licence:** MIT · `Copyright (c) 2026 Lynote.ai`

**Functionality.** A Python pipeline offering four humanising methodologies. Its
documented methodologies are more valuable than its default path.

**Language and structure.** Python ≥3.10. 67 files, 174,690 B excluding
`presentation/` (5.69 MB of PNGs, not read). 26 `.py` files, 1,553 lines.

**Supported path versus legacy — the key distinction.**

- **Supported:** `src/standard/` is a four-step **remote** chain: LLM EN→ZH at
  temperature 1.3 → LLM ZH→JA carrying history → Google JA→FI → Niutrans FI→EN.
  It needs a language-model key, a Niutrans key and an undocumented Google
  endpoint, with no retries, no rate limiting and no cost estimation.
- **Legacy:** `src/methodologies/` holds the v1.0 four methodologies, a
  dispatcher and a FastAPI layer. It is not on any supported path and it depends
  on `standard`, never the reverse.

**There is no postprocessing on the production path.** The `PostProcessor` is
reachable only from legacy Method 3; production "humanising" is a single Chinese
prompt string.

**The four methodologies.** Translation chain (multi-hop through distant language
pairs, the default and the most exotic); multi-turn LLM rewriting (three rounds
of structural, then vocabulary, then context refinement, at temperature 1.1–1.3
with top-p 0.9); detection-guided feedback loop; mixed engine with segment-level
best-of-N selection.

**Detectors.** `statistical.py` is **genuinely runnable offline with zero
dependencies** — type-token ratio, sentence-length coefficient of variation and
hapax ratio, averaged. It is a heuristic, not a calibrated probability, and its
0.7/0.5/0.6 thresholds are unanchored; recalibrate on import.
`binoculars.py` is **misnamed**: despite its docstring and the docs claiming a
dual-model perplexity ratio, it is a single GPT-2 model doing plain perplexity,
and it needs an optional extra plus a model download. `roberta.py` needs torch
and a download, and its bare model id `roberta-base-openai-detector` will likely
fail to resolve; CI never tests it. **Detectors are not wired into production**
— the showcase confidences in the README come from an external unnamed detector
and are not reproducible in-repo. There are no literal stubs: the problem is
documentation overstating capability, not absent code.

**Techniques.** 44 discrete named techniques were extracted from the docs with an
implemented / doc-only / absent tag. Core names: multi-language translation chain;
distant language pairs; processing tiers; engine selection; multi-turn LLM
rewriting; structural variation; burstiness; paragraph-level structural change;
vocabulary and style round; colloquial expression insertion; rhetorical devices;
context refinement; detection-guided feedback loop; diversity metrics (unique
token ratio, hapax legomena, Yule's K); AI vocabulary replacement; Chinese
boilerplate replacement; sentence rhythm disruption; transitional variety;
mixed-engine translation; segment-level best-of-N; naturalness scoring.

**Documented but absent from the code — do not transcribe:** the Chinese phrase
list, uniform-length breaking, transitional variety insertion, the
structural-difference criterion, n-gram diversity, Yule's K, and the DeepL and
Apertium engines.

**Research-only material, explicitly not implemented:** StoryScope-style
style-versus-structure distinction, discourse-level narrative features, style
laundering, narrative-feature classification, a 30-feature narrative core,
model fingerprints, rarity percentile.

**Scoring.** `none found`. No calibration evidence exists.

**Voice.** Statistical features only. No personal profile.

**Lineage.** `docs/lynote-comparison.md` is a **product comparison only**. It
never mentions `dsh-humanizer` or any repository — a whole-word search for `dsh`
across all 67 text files returns zero matches — and there are no shared rule ids
(this repo has none) or shared config schema. The overlap with `dsh-humanizer` is
a shared owner's contact address, not source. The real documented ancestor is
`molly554/ai-humanize`. So the dedup risk runs against the Markdown-skill
upstreams via its 30-word vocabulary list, not against `dsh-humanizer`.

**Integration.** `methodology` (kind D) overall. Take the offline statistical
detector as a real detector (kind A). Take the 30-entry vocabulary replacement map
and the rhythm rules as rule sources (kind B), excluding the doc-claimed-but-absent
items. Take the history-threading orchestration pattern, which prevents the model
reverting its own edits. **Keep the remote chain out of the default execution
path.**

---

### 4.6 `holygeek00/humanizer-zh-cn`

**Pinned:** `401e372eeb1a91045d15ec21c2d13b9d0f7842ea` · v2.9.1-zh.2 · main
**Licence:** MIT · `Copyright (c) 2025 Siqi Chen`

**Functionality.** The Simplified-Chinese localisation of `blader/humanizer`, and
the best-behaved member of the lineage.

**Language and structure.** Markdown. 11 files, 44,299 B. `SKILL.md` is 18,109 B
/ 386 lines.

**Rules.** **33 patterns, contiguous 1–33.** A 1:1 localisation of blader at
v2.9.1 — shared 33/33, renamed 33/33, added 0, dropped 0. Against blader HEAD
(v3.0.0, 25 patterns) the structures do **not** align, because it is one
generation behind by construction.

Verbatim pattern 1: `空泛拔高意义`. Pattern 9: `“不仅……更……”和先否后肯滥用`.
Pattern 10: `强凑三点和排比`. Pattern 14: `破折号、括号和补充说明过密`.
Pattern 26 is `四字词和成语连用`, which is genuinely Chinese-specific and absent
upstream.

**Chinese-specific additions.** Mixed full-width and half-width punctuation
(pattern 19), four-character idiom stacking (26), web-novel and business-writing
tells, and a false-positive suppression section `避免误伤`.

**Detection algorithm.** None executable. Prose and watched-phrase lists.

**Scoring.** `none found`.

**Voice.** A `声线校准` section exists and feeds the unified voice interface, but
there is no structured profile library.

**Pipeline.** The blader process, localised, plus a five-question jargon
diagnostic usable as methodology.

**Automation.** `scripts/validate-package.py` fails the build if the upstream
URL, `Siqi Chen` or `Copyright (c) 2025 Siqi Chen` goes missing from README,
`LOCALIZATION.md` or LICENSE. **This is the only derivative whose attribution is
machine-enforced**, and it is the model to copy.
`.github/workflows/sync-upstream.yml` pulls `https://github.com/blader/humanizer`
branch `main` weekly, detects change with `git merge-base --is-ancestor`, and on
a clean merge runs the validator then **auto-commits and pushes directly to
`main`**. On conflict or validation failure it aborts and opens a deduplicated
issue. It never opens a pull request.

**Licence position.** No problem. `licenses/MIT-humanizer-zh-cn` is byte-identical
to `licenses/MIT-blader` (`sha256:4AC4810254AB36D4…`), which is verifiable
evidence that the fork kept the upstream notice exactly.

**Hazard to record.** Because upstream `main` has moved to v3.0.0 with 25
patterns while this fork targets 2.9.1 with 33, its next scheduled sync will
legitimately fail validation and open a blocking issue. Expected on its side; a
reason not to run its workflow ourselves.

**Integration.** `markdown-skill` (kind B) — **the preferred Chinese rule
source**, at rule level, not at runtime. Its
`LOCALIZATION.md:23-32` upstream-to-Chinese mapping table is the only explicit
derivation record in the corpus and should be imported as provenance data. Its
`避免误伤` section becomes a suppression gate. Adopt the validator into the
suite's provenance gate (kind A). The five-question diagnostic is methodology
(kind D).

---

### 4.7 `op7418/Humanizer-zh`

**Pinned:** `91f3d394db8419c20d67ebe22a96cf8fee0a404b` · unversioned · main
**Licence:** MIT · `Copyright (c) 2026 歸藏` · **research only**

**Functionality.** A Chinese translation of `blader/humanizer` v2.1.0.

**Language and structure.** Markdown. 4 files, 27,801 B. `SKILL.md` is 18,898 B /
484 lines. No `.github/`, no scripts, no plugin manifests, no CI. No commit since
2026-01-19.

**Rules.** **24 patterns, contiguous 1–24**, shared 24/24 with blader v2.1.0,
renamed 24/24, added 0, dropped 0. Verbatim: `1 过度强调意义、遗产和更广泛的趋势 ·
2 过度强调知名度和媒体报道 · 3 以 -ing 结尾的肤浅分析 · 4 宣传和广告式语言 ·
5 模糊归因和含糊措辞 · 6 提纲式的"挑战与未来展望"部分 · 7 过度使用的"AI 词汇" ·
8 避免使用"是"（系动词回避） · 9 否定式排比 · 10 三段式法则过度使用 ·
11 刻意换词（同义词循环） · 12 虚假范围 · 13 破折号过度使用 · 14 粗体过度使用 ·
15 内联标题垂直列表 · 16 标题中的标题大写 · 17 表情符号 · 18 弯引号 ·
19 协作交流痕迹 · 20 知识截止日期免责声明 · 21 谄媚/卑躬屈膝的语气 ·
22 填充短语 · 23 过度限定 · 24 通用积极结论`.

**Detection algorithm.** None. **Scoring.** A five-dimension rubric, and the only
one in the English lineage. **Voice.** A `个性与灵魂` section.

**Lineage.** A near-literal translation of blader **v2.1.0** (commit `47a6432`),
confirmed by a 30-row verbatim sentence correspondence. It preserves even the
`-ing` framing (`3. 以 -ing 结尾的肤浅分析`) and calques `tapestry` to `织锦`.

**Licence position — the defect.** Its `LICENSE` contains only the translator's
line. `Siqi` has zero matches repo-wide, while an upstream link appears in five
places including `source: 翻译自 blader/humanizer，参考 hardikpandya/stop-slop`.
It reproduces all 24 headings, watched lists, examples, the process list, the
output format and a full example in translation. MIT requires the notice in all
copies or substantial portions, so the condition is unmet on its face. Two
sections (`## 处理流程`, `## 输出格式`) are verbatim blader v2.1.0 translations
credited to nobody.

**Integration.** `research-only`, `tracked: false`. **Copy nothing into a
distributed artefact** — doing so would propagate the defect. Where its capability
is wanted, take it from `blader/humanizer`, which holds title. Two items are
additive but must be **re-derived, not copied**: the five-dimension scoring rubric
and the voice/personality section.

---

### 4.8 `hardikpandya/stop-slop`

**Pinned:** `8da1f030185bdfe8471220585162991eaeb970e9` · unversioned · main
**Licence:** MIT · `Copyright (c) 2025 Hardik Pandya` · **research only, with a
targeted extraction planned**

**Functionality.** A curated list of banned phrases and banned structures. Not an
AI-text detector in general — a narrower editorial-tell catalogue.

**Language and structure.** Markdown only. 7 files, 16,344 B. Zero CJK. Declared
version: none anywhere, and its CHANGELOG is stale, missing its own three most
recent commits.

**Rules.** **76 phrase entries in 8 categories** (78 distinct strings counting
`/` variants): Throat-Clearing 15, Emphasis Crutches 5, Business Jargon 11 with
replacement pairs, Adverbs 15, Filler phrases 7, Meta-Commentary 11, Performative
Emphasis 3, Telling-Not-Showing 4, Vague Declaratives 5. Plus **48 pattern rows
under 11 headings**: Binary Contrasts 11, Negative Listing 2, Dramatic
Fragmentation 3, Rhetorical Setups 4, Formulaic Constructions 2, False Agency 7,
Narrator-from-a-Distance 4, Passive Voice 4, Sentence Starters 3, Rhythm Patterns
6, Word Patterns 2. `SKILL.md` holds 8 Core Rules, 12 Quick Checks and a
five-dimension 1–10 rubric with "Below 35/50: revise". `examples.md` holds 5
before/after pairs.

**Detection algorithm.** None. Prose and lists only. **Voice.** None.
**Chinese support.** None, which matters for a bilingual suite.

**Overlap — measured.** Against `ai-humanizer`: **62 of 78 phrase variants, 79%,
match as exact strings**, rising to roughly 87–90% allowing morphology; 10 of 11
structure headings already exist there as credited rules. Against
`blader/humanizer`: 14 of 78 exact strings but roughly 50–60% conceptual
coverage, with **no evidence of copying in either direction** — both converge on
the shared public source, and blader declares that source while stop-slop declares
none. Overall redundancy with the union of the two: **roughly 90–95%**.

**Genuinely unique, and therefore the extraction target:** the Formulaic
Constructions heading and both its rows; Narrator-from-a-Distance as a real rule
with 4 watch items, which `ai-humanizer` claims to have absorbed but does not
implement; the telling-not-showing literals; `Dressed up as`, `Hint:`,
`X is a feature, not a bug`; `crucially`, `The reality is`; three false-agency
examples; and four un-enumerated binary-contrast sub-forms.

**Third parties.** `op7418/Humanizer-zh` and `lynote-ai/dsh-humanizer` also credit
it, so its content is already flowing into the set indirectly.

**Why research-only as a package.** No code to adapt; roughly nine tenths
duplicate of `ai-humanizer`; weaker prose than blader; no Chinese. Its absolutist
rules ("Kill all adverbs", "No em dashes at all") also directly conflict with
blader's deliberate weak-alone suppression policy, so importing its prose would
**regress** false-positive behaviour. Its own `examples.md` contradicts its own em
dash ban.

**Licence position.** Clean MIT. **Its practical importance to this project is as
the clean-title source** for the content that must be re-imported out of
`ai-humanizer`.

**Integration.** Research only for now. Phase 3 should extract roughly 15 of its
124 items as executable rules and attach them to the existing
`ai-humanizer`-derived rules with a dual source reference.

---

## 5. Cross-cutting duplication

Ranked by how much it matters.

| Duplication | Scale | Evidence | Handling |
| --- | --- | --- | --- |
| `humanizer-zh-cn` ← blader v2.9.1 | 33/33 patterns | declared fork; byte-identical LICENSE | dual source, one canonical rule |
| `op7418` ← blader v2.1.0 | 24/24 patterns | 30-row verbatim sentence table | research only; source from blader |
| `ai-humanizer` ← stop-slop | 11/46 rules, plus rubric, jargon table, phrase lists | in-source comment, row-for-row tables | barred import; source from stop-slop |
| `ai-humanizer` ↔ blader | ~15/27 vocabulary tokens, ~6 rules | shared public source, no copying | separate rules, note convergence |
| `dsh-humanizer` ↔ blader | ~4 of 25 patterns | 15 blader patterns have no counterpart | separate rules; blader supplies structure |
| `dsh-humanizer` ↔ `humanize-text` | 0 rule ids, ~9 cliché headwords | same owner, complementary designs | separate; no collapse |
| Chinese trio internal | 0 shared pattern names | independent taxonomies | separate rules; only `值得注意的是` is 3-way |

**Conclusion.** Three repositories — `blader`, `humanizer-zh-cn` and `op7418` —
are one lineage, and `stop-slop` reaches the suite twice as well. The suite must
reach **five independent discovery sources**, not eight, and two of those
(`ai-zixun/humanizer-zh` and `lynote-ai/dsh-humanizer`) contribute original work
that the others do not have.

---

## 6. Licence position

Every upstream has a clear licence, so nothing is barred on licence grounds
alone. Two have content-level defects. Full text is preserved byte-for-byte in
`licenses/`; see `THIRD_PARTY_NOTICES.md`.

| Upstream | Licence | Copyright | Defect | Import consequence |
| --- | --- | --- | --- | --- |
| `blader/humanizer` | MIT | `(c) 2025 Siqi Chen` | — | full import |
| `humanizer-zh-cn` | MIT | `(c) 2025 Siqi Chen` | — | full import |
| `ai-zixun/humanizer-zh` | MIT | `(c) 2026 aizixun` | weak hygiene vs blader | full import; carry both notices |
| `lynote-ai/dsh-humanizer` | BSD-3-Clause | `(c) 2026, lynote-ai` | — | full import; notice + disclaimer + no-endorsement |
| `lynote-ai/humanize-text` | MIT | `(c) 2026 Lynote.ai` | — | full import of the offline parts |
| `hardikpandya/stop-slop` | MIT | `(c) 2025 Hardik Pandya` | — | extract the unique ~15 items |
| `judetelan/ai-humanizer` | MIT | `(c) 2026 judetelan` | inherited stop-slop content without notice; unlicensed third-party references; CC BY-SA source without share-alike | **35 of 46 rules only** |
| `op7418/Humanizer-zh` | MIT | `(c) 2026 歸藏` | upstream notice not retained | **nothing** |

**Blocked sources.** No content enters this project from the project
`ai-humanizer` calls "impeccable" (broken URL, no licence), from
`harshaneel/humanize`, `unslop`, `brandonwise/humanizer`, `no-ai-slop` or
`avoid-slop` (no licence text recorded), or from Wikipedia's *Signs of AI
writing* (CC BY-SA, credited without share-alike).

---

## 7. Integration recommendations, ranked

Ordered by value per unit of work.

1. **Build the canonical rule registry and dedupe first.** Everything else
   depends on it. Without it, every later measurement triple-counts. *(Phase 3;
   the Phase 1 seed already demonstrates the mechanism on real lineage data.)*
2. **Port `judetelan/ai-humanizer`'s engines and lexicons**, minus the barred
   content, and de-duplicate the 12 duplicated lexicon entries. This is the
   single largest injection of working detection logic available. *(Phase 2)*
3. **Parse `blader/humanizer`'s 25 patterns**, importing patterns 8, 9, 10, 11
   and 21 as a suppression layer rather than as detectors. Highest-value English
   rules, and the parse plan is already specified. *(Phase 2)*
4. **Parse `holygeek00/humanizer-zh-cn`'s 33 patterns** as the primary Chinese
   rule source, and import its localization mapping table as provenance data.
   *(Phase 2)*
5. **Lift `lynote-ai/dsh-humanizer`'s `src/core/` as the deterministic kernel**,
   with the four mandatory fixes. It is the only bilingual executable rule engine
   in the set. *(Phase 2)*
6. **Adopt `StyleFingerprint` as the seed of the unified VoiceProfile**, extended
   with the chat and conversation-behaviour dimensions that a writing fingerprint
   does not cover. Add the 10 unused fields to scoring or drop them. *(Phase 6)*
7. **Parse `ai-zixun/humanizer-zh`'s eight author profiles** into structured
   VoiceProfiles, after neutralising the fake-numbers instruction. *(Phase 6)*
8. **Take `lynote-ai/humanize-text`'s statistical detector** as an always-on
   offline detector, with recalibrated thresholds. *(Phase 2)*
9. **Extract stop-slop's ~15 unique items** and attach them to the
   `ai-humanizer`-derived rules with dual sources. *(Phase 3)*
10. **Re-derive, do not copy, `op7418`'s scoring rubric and voice section.**
    *(Phase 3)*

**Do not do.** Do not paste any upstream Markdown into a prompt whole. Do not run
`humanizer-zh-cn`'s auto-committing sync workflow. Do not adopt
`humanize-text`'s remote translation chain as a default path. Do not import
stop-slop's absolutist prose rules, which conflict with blader's suppression
policy. Do not vendor `dsh-humanizer`'s plugin entry point; re-implement it.

---

## 8. What Phase 1 deliberately did not do

Stated plainly so the boundary is not mistaken for completeness.

- **No capability was wired in.** All eight adapters are `status: 'planned'`
  descriptors. They declare their integration kind, target phase, capabilities
  and hazards, and nothing more. Phase 2 implements them.
- **The canonical registry is seeded, not populated.** Eleven canonical rules
  demonstrate deduplication on real cross-repository correspondences and are
  marked `status: 'seed'`. The remaining several hundred rules arrive in Phase 3.
- **No detector is implemented.** The 21 catalogued detector slots are all
  `planned`. The unified scan orchestrates real detectors, and the tests supply
  doubles; no production detector exists yet.
- **Every upstream clone is untouched.** Verified by `git status --porcelain`
  returning empty for all eight, and by a test in `tests/manifest.test.ts`.
- **No benchmark exists.** `benchmarks/` holds its design and corpus specification
  only; running it is Phase 7.
- **The eight reports under `upstreams/reports/` are the primary evidence.**
  This document summarises them; where they disagree with it, they win.
