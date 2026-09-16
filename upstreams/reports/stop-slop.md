# Inventory: hardikpandya/stop-slop

> Read-only inventory. No file inside `.upstream-cache/stop-slop` was created, modified, or deleted.
> All paths below are relative to `\.upstream-cache\stop-slop\` unless stated otherwise.
> Every file in the repository was read in full (7 files, 16,344 bytes). The repository has no build step and no code.

## 1. Identity

| Field | Value | Evidence |
|---|---|---|
| Repository | `hardikpandya/stop-slop` | `README.md:1`, `SKILL.md:2` |
| Commit analyzed | `8da1f03018` (`8da1f03`, 2026-03-18, "Add false agency rule: no inanimate objects performing human actions") | `git log` of the cached checkout |
| Commit history present | Yes (`.git` present in cache); first commit `79d97bf` 2026-01-11 "Initial commit: Stop Slop skill file for removing AI tells from prose"; 12 commits total, latest 2026-03-18 | `git log` |
| License | MIT License | `LICENSE:1` |
| Copyright holder (verbatim) | `Copyright (c) 2025 Hardik Pandya` | `LICENSE:3` |
| Author / URL | `Hardik Pandya (https://hvpandya.com)` | `SKILL.md:6`, `README.md:58` |
| Declared version | `none found` — no `version` field in frontmatter, no version string in `README.md`, no versioned CHANGELOG entries (date headings only) | `SKILL.md:1-7`, `README.md`, `CHANGELOG.md:3,17,22` |
| Latest changelog date | 2026-01-13 | `CHANGELOG.md:3` |
| Languages | Markdown only; no executable code of any language | all 7 files |
| File count | 7 (`SKILL.md`, `README.md`, `CHANGELOG.md`, `LICENSE`, `references/phrases.md`, `references/structures.md`, `references/examples.md`) | directory listing |
| Total text size | 16,344 bytes (~16.0 KiB): `structures.md` 5,255; `phrases.md` 2,915; `SKILL.md` 2,629; `README.md` 1,894; `examples.md` 1,686; `LICENSE` 1,070; `CHANGELOG.md` 895 | byte sizes |
| CJK characters | 0 | full-text scan |
| External assets | One GitHub user-attachments image URL in the README | `README.md:5` |

## 2. Purpose and functionality

stop-slop is a **single-file agent skill (prompt) for removing AI writing "tells" from English prose**, plus two curated reference lists and one small example file. It is about AI text generally, but strictly at the **sentence-and-phrase level of English non-fiction prose and essays** — it is narrower than a general "humanizer": it contains no fiction handling, no detection engine, no file/CLI surface, no voice matching, no multilingual support, and no fact-preservation rule.

What it actually is:

- A declarative prompt of 8 core rules, 12 pre-delivery "quick checks", and a 5-dimension 1-10 self-scoring rubric (`SKILL.md:13-60`).
- Two curated lexical/structural blocklists: 76 listed phrase entries (`references/phrases.md`) and 48 structural pattern rows under 11 headings (`references/structures.md`).
- 5 before/after rewrite examples (`references/examples.md`).
- Installation/usage prose in `README.md:24-32` (Claude Code, Claude Projects, custom instructions, raw system prompt).

It does **not** claim to detect AI authorship, does not score text automatically, and does not target marketing copy, chat residue, model-specific tics, or non-English text. Its distinctive framing is *editorial prose hygiene*: "Every sentence needs a human subject doing something" (`SKILL.md:19`), kill all adverbs (`phrases.md:55`), no em dashes at all (`structures.md:125`).

## 3. Structure of SKILL.md

YAML frontmatter (`SKILL.md:1-7`):

```yaml
name: stop-slop
description: Remove AI writing patterns from prose. Use when drafting, editing, or reviewing text to eliminate predictable AI tells.
metadata:
  trigger: Writing prose, editing drafts, reviewing content for AI patterns
  author: Hardik Pandya (https://hvpandya.com)
```

Notes: no `license:` field in frontmatter (unlike blader/humanizer, which declares `license: MIT`); no `version:` field; `metadata.trigger` / `metadata.author` are bespoke keys, not part of the common Agent Skills schema — commit `685ec0d` (dctmfoo, 2026-01-12) is titled "Fix SKILL.md frontmatter to use valid properties".

Body sections, in order:

| Section | Lines | Content |
|---|---|---|
| H1 `# Stop Slop` | 9-11 | One-line thesis: "Eliminate predictable AI writing patterns from prose." |
| `## Core Rules` | 13-29 | 8 numbered rules, each pointing to a reference file where relevant |
| `## Quick Checks` | 31-46 | 12 terse pre-delivery checklist questions |
| `## Scoring` | 48-60 | 5-dimension 1-10 rubric table + pass threshold "Below 35/50: revise." |
| `## Examples` | 62-64 | Pointer to `references/examples.md` |
| `## License` | 66-68 | "MIT" |

Overall approach: **prohibition-first, rule-list prompting**. The skill hands the model an explicit blocklist plus a small set of positive constraints (active voice, specificity, second person, varied rhythm), then asks it to self-score before delivering. It carries no reasoning model of *why* models produce the patterns (contrast with blader/humanizer's "Why AI text sounds the way it does", `blader-humanizer/SKILL.md:17-29`), no workflow with draft/check/final passes, and no false-positive safeguards. `README.md:34-40` restates the three buckets as "Banned phrases", "Structural clichés", "Sentence-level rules".

## 4. Complete inventory of rules, phrases, and structures — CRITICAL

### 4a. Every banned/discouraged phrase from `references/phrases.md`

**Exact count: 76 listed entries in 8 categories; 78 distinct phrase strings when `/` alternatives are counted separately** (`"Full stop." / "Period."` at `phrases.md:29` and `"Plot twist:" / "Spoiler:"` at `phrases.md:90`).

| item (verbatim) | category | what it targets | evidence (file:line) |
|---|---|---|---|
| "Here's the thing:" | Throat-Clearing Openers | announcement before the point | `references/phrases.md:7` |
| "Here's what [X]" | Throat-Clearing Openers | announcement opener | `references/phrases.md:8` |
| "Here's this [X]" | Throat-Clearing Openers | announcement opener | `references/phrases.md:9` |
| "Here's that [X]" | Throat-Clearing Openers | announcement opener | `references/phrases.md:10` |
| "Here's why [X]" | Throat-Clearing Openers | announcement opener | `references/phrases.md:11` |
| "The uncomfortable truth is" | Throat-Clearing Openers | staged candor | `references/phrases.md:12` |
| "It turns out" | Throat-Clearing Openers | fake discovery | `references/phrases.md:13` |
| "The real [X] is" | Throat-Clearing Openers | false-depth reframe | `references/phrases.md:14` |
| "Let me be clear" | Throat-Clearing Openers | pre-emptive clarification | `references/phrases.md:15` |
| "The truth is," | Throat-Clearing Openers | staged candor | `references/phrases.md:16` |
| "I'll say it again:" | Throat-Clearing Openers | repetition as emphasis | `references/phrases.md:17` |
| "I'm going to be honest" | Throat-Clearing Openers | staged candor | `references/phrases.md:18` |
| "Can we talk about" | Throat-Clearing Openers | rhetorical permission-seeking | `references/phrases.md:19` |
| "Here's what I find interesting" | Throat-Clearing Openers | commentary on own interest | `references/phrases.md:20` |
| "Here's the problem though" | Throat-Clearing Openers | announcement opener | `references/phrases.md:21` |
| "Full stop." / "Period." | Emphasis Crutches | terminal emphasis marker | `references/phrases.md:29` |
| "Let that sink in." | Emphasis Crutches | instruction to be impressed | `references/phrases.md:30` |
| "This matters because" | Emphasis Crutches | significance announcement | `references/phrases.md:31` |
| "Make no mistake" | Emphasis Crutches | manufactured weight | `references/phrases.md:32` |
| "Here's why that matters" | Emphasis Crutches | significance announcement | `references/phrases.md:33` |
| Navigate (challenges) → Handle, address | Business Jargon | jargon → plain verb | `references/phrases.md:41` |
| Unpack (analysis) → Explain, examine | Business Jargon | jargon → plain verb | `references/phrases.md:42` |
| Lean into → Accept, embrace | Business Jargon | jargon → plain verb | `references/phrases.md:43` |
| Landscape (context) → Situation, field | Business Jargon | jargon → plain noun | `references/phrases.md:44` |
| Game-changer → Significant, important | Business Jargon | hype adjective | `references/phrases.md:45` |
| Double down → Commit, increase | Business Jargon | jargon → plain verb | `references/phrases.md:46` |
| Deep dive → Analysis, examination | Business Jargon | jargon → plain noun | `references/phrases.md:47` |
| Take a step back → Reconsider | Business Jargon | jargon → plain verb | `references/phrases.md:48` |
| Moving forward → Next, from now | Business Jargon | meeting filler | `references/phrases.md:49` |
| Circle back → Return to, revisit | Business Jargon | meeting filler | `references/phrases.md:50` |
| On the same page → Aligned, agreed | Business Jargon | meeting filler | `references/phrases.md:51` |
| "really" | Adverbs (specific offenders) | empty intensifier | `references/phrases.md:59` |
| "just" | Adverbs | softener | `references/phrases.md:60` |
| "literally" | Adverbs | intensifier | `references/phrases.md:61` |
| "genuinely" | Adverbs | sincerity marker | `references/phrases.md:62` |
| "honestly" | Adverbs | sincerity marker | `references/phrases.md:63` |
| "simply" | Adverbs | minimizer | `references/phrases.md:64` |
| "actually" | Adverbs | correction tic | `references/phrases.md:65` |
| "deeply" | Adverbs | intensifier | `references/phrases.md:66` |
| "truly" | Adverbs | intensifier | `references/phrases.md:67` |
| "fundamentally" | Adverbs | intensifier | `references/phrases.md:68` |
| "inherently" | Adverbs | intensifier | `references/phrases.md:69` |
| "inevitably" | Adverbs | intensifier | `references/phrases.md:70` |
| "interestingly" | Adverbs | discourse marker | `references/phrases.md:71` |
| "importantly" | Adverbs | discourse marker | `references/phrases.md:72` |
| "crucially" | Adverbs | discourse marker | `references/phrases.md:73` |
| "At its core" | Filler phrases | false-depth opener | `references/phrases.md:77` |
| "In today's [X]" | Filler phrases | era framing | `references/phrases.md:78` |
| "It's worth noting" | Filler phrases | hedge filler | `references/phrases.md:79` |
| "At the end of the day" | Filler phrases | cliché closer | `references/phrases.md:80` |
| "When it comes to" | Filler phrases | wordy connective | `references/phrases.md:81` |
| "In a world where" | Filler phrases | cinematic framing | `references/phrases.md:82` |
| "The reality is" | Filler phrases | false-depth opener | `references/phrases.md:83` |
| "Hint:" | Meta-Commentary | self-referential aside | `references/phrases.md:89` |
| "Plot twist:" / "Spoiler:" | Meta-Commentary | self-referential aside | `references/phrases.md:90` |
| "You already know this, but" | Meta-Commentary | false intimacy | `references/phrases.md:91` |
| "But that's another post" | Meta-Commentary | scope deflection | `references/phrases.md:92` |
| "X is a feature, not a bug" | Meta-Commentary | borrowed engineering aphorism | `references/phrases.md:93` |
| "Dressed up as" | Meta-Commentary | framing cliché | `references/phrases.md:94` |
| "The rest of this essay explains..." | Meta-Commentary | announcing own structure | `references/phrases.md:95` |
| "Let me walk you through..." | Meta-Commentary | tour-guide framing | `references/phrases.md:96` |
| "In this section, we'll..." | Meta-Commentary | announcing own structure | `references/phrases.md:97` |
| "As we'll see..." | Meta-Commentary | forward reference | `references/phrases.md:98` |
| "I want to explore..." | Meta-Commentary | narrator aside | `references/phrases.md:99` |
| "creeps in" | Performative Emphasis | false intimacy | `references/phrases.md:105` |
| "I promise" | Performative Emphasis | manufactured sincerity | `references/phrases.md:106` |
| "They exist, I promise" | Performative Emphasis | manufactured sincerity | `references/phrases.md:107` |
| "This is genuinely hard" | Telling Instead of Showing | announcing difficulty | `references/phrases.md:113` |
| "This is what leadership actually looks like" | Telling Instead of Showing | announcing significance | `references/phrases.md:114` |
| "This is what X actually looks like" | Telling Instead of Showing | announcing significance | `references/phrases.md:115` |
| "actually matters" | Telling Instead of Showing | significance assertion | `references/phrases.md:116` |
| "The reasons are structural" | Vague Declaratives | importance without specifics | `references/phrases.md:122` |
| "The implications are significant" | Vague Declaratives | importance without specifics | `references/phrases.md:123` |
| "This is the deepest problem" | Vague Declaratives | importance without specifics | `references/phrases.md:124` |
| "The stakes are high" | Vague Declaratives | importance without specifics | `references/phrases.md:125` |
| "The consequences are real" | Vague Declaratives | importance without specifics | `references/phrases.md:126` |

Category counts: Throat-Clearing Openers 15 (`:7-21`); Emphasis Crutches 5 (`:29-33`); Business Jargon 11 (`:41-51`); Adverbs–specific offenders 15 (`:59-73`); Adverbs–filler phrases 7 (`:77-83`); Meta-Commentary 11 (`:89-99`, 12 strings); Performative Emphasis 3 (`:105-107`); Telling Instead of Showing 4 (`:113-116`); Vague Declaratives 5 (`:122-126`). Total **76**.

Also in this file, non-list rules: "Any 'here's what/this/that' construction is throat-clearing before the point. Cut it and state the point." (`phrases.md:23`); "Kill all adverbs. No -ly words. No softeners, no intensifiers, no hedges." (`phrases.md:55`); "If a sentence says something is important/deep/structural without showing the specific thing, cut it or replace it with the specific thing." (`phrases.md:128`).

### 4b. Every banned/discouraged structure from `references/structures.md`

**Exact count: 48 pattern rows across 11 sections/headings.**

| item (verbatim) | category (verbatim heading) | what it targets | evidence (file:line) |
|---|---|---|---|
| "Not because X. Because Y." / "Not because X, but because Y." | Binary Contrasts | Telegraphed reversal | `references/structures.md:9` |
| "[X] isn't the problem. [Y] is." | Binary Contrasts | Formulaic reframe | `references/structures.md:10` |
| "The answer isn't X. It's Y." | Binary Contrasts | Predictable pivot | `references/structures.md:11` |
| "It feels like X. It's actually Y." | Binary Contrasts | Setup/reveal cliche | `references/structures.md:12` |
| "The question isn't X. It's Y." | Binary Contrasts | Rhetorical misdirection | `references/structures.md:13` |
| "Not X. But Y." / "not X, it's Y" / "isn't X, it's Y" | Binary Contrasts | Mechanical contrast | `references/structures.md:14` |
| "It's not this. It's that." | Binary Contrasts | Same formula, different words | `references/structures.md:15` |
| "stops being X and starts being Y" | Binary Contrasts | False transformation arc | `references/structures.md:16` |
| "doesn't mean X, but actually Y" | Binary Contrasts | Negation-then-assertion crutch | `references/structures.md:17` |
| "is about X but not Y" | Binary Contrasts | False distinction | `references/structures.md:18` |
| "not just X but also Y" | Binary Contrasts | Additive hedge | `references/structures.md:19` |
| "Not a X... Not a Y... A Z." | Negative Listing | Dramatic buildup through negation | `references/structures.md:29` |
| "It wasn't X. It wasn't Y. It was Z." | Negative Listing | Same structure, past tense | `references/structures.md:30` |
| "[Noun]. That's it. That's the [thing]." | Dramatic Fragmentation | Performative simplicity | `references/structures.md:40` |
| "X. And Y. And Z." | Dramatic Fragmentation | Staccato drama | `references/structures.md:41` |
| "This unlocks something. [Word]." | Dramatic Fragmentation | Artificial revelation | `references/structures.md:42` |
| "What if [reframe]?" | Rhetorical Setups | Socratic posturing | `references/structures.md:52` |
| "Here's what I mean:" | Rhetorical Setups | Redundant preview | `references/structures.md:53` |
| "Think about it:" | Rhetorical Setups | Condescending prompt | `references/structures.md:54` |
| "And that's okay." | Rhetorical Setups | Unnecessary permission | `references/structures.md:55` |
| "By the time X, I was Y." | Formulaic Constructions | Narrative template | `references/structures.md:63` |
| "X that isn't Y" | Formulaic Constructions | Indirect. Say "X is broken" | `references/structures.md:64` |
| "a complaint becomes a fix" | False Agency | The complaint did nothing. Someone fixed it. | `references/structures.md:72` |
| "a bet lives or dies in days" | False Agency | Bets don't have lifespans. Someone kills the project or ships it. | `references/structures.md:73` |
| "the decision emerges" | False Agency | Decisions don't emerge. Someone decides. | `references/structures.md:74` |
| "the culture shifts" | False Agency | Cultures don't shift on their own. People change behavior. | `references/structures.md:75` |
| "the conversation moves toward" | False Agency | Conversations don't move. Someone steers. | `references/structures.md:76` |
| "the data tells us" | False Agency | Data sits there. Someone reads it and draws a conclusion. | `references/structures.md:77` |
| "the market rewards" | False Agency | Markets don't reward. Buyers pay for things. | `references/structures.md:78` |
| "Nobody designed this." | Narrator-from-a-Distance | Disembodied observation | `references/structures.md:89` |
| "This happens because..." | Narrator-from-a-Distance | Lecturer voice | `references/structures.md:90` |
| "This is why..." | Narrator-from-a-Distance | Same | `references/structures.md:91` |
| "People tend to..." | Narrator-from-a-Distance | Armchair sociologist | `references/structures.md:92` |
| "X was created" | Passive Voice | Name who created it | `references/structures.md:101` |
| "It is believed that" | Passive Voice | Name who believes it | `references/structures.md:102` |
| "Mistakes were made" | Passive Voice | Name who made them | `references/structures.md:103` |
| "The decision was reached" | Passive Voice | Name who decided | `references/structures.md:104` |
| Sentences starting with What, When, Where, Which, Who, Why, How | Sentence Starters to Avoid | Restructure. Lead with the subject or the verb. | `references/structures.md:112` |
| Paragraphs starting with "So" | Sentence Starters to Avoid | Start with content | `references/structures.md:113` |
| Sentences starting with "Look," | Sentence Starters to Avoid | Remove | `references/structures.md:114` |
| Three-item lists | Rhythm Patterns | Use two items or one | `references/structures.md:122` |
| Questions answered immediately | Rhythm Patterns | Let questions breathe or cut them | `references/structures.md:123` |
| Every paragraph ends punchily | Rhythm Patterns | Vary endings | `references/structures.md:124` |
| Em-dashes | Rhythm Patterns | Remove. Use commas or periods. No em dashes at all. | `references/structures.md:125` |
| Staccato fragmentation | Rhythm Patterns | Don't stack short punchy sentences | `references/structures.md:126` |
| "Not always. Not perfectly." | Rhythm Patterns | Hedging disguised as reassurance | `references/structures.md:127` |
| Lazy extremes (every, always, never, everyone, everybody, nobody) | Word Patterns | False authority. Use specifics instead of sweeping claims. | `references/structures.md:133` |
| All adverbs (-ly words, "really," "just," "literally," "genuinely," "honestly," "simply," "actually") | Word Patterns | Empty emphasis. See phrases.md for full list. | `references/structures.md:134` |

Section counts: Binary Contrasts 11 (`:9-19`); Negative Listing 2 (`:29-30`); Dramatic Fragmentation 3 (`:40-42`); Rhetorical Setups 4 (`:52-55`); Formulaic Constructions 2 (`:63-64`); False Agency 7 (`:72-78`); Narrator-from-a-Distance 4 (`:89-92`); Passive Voice 4 (`:101-104`); Sentence Starters to Avoid 3 (`:112-114`); Rhythm Patterns 6 (`:122-127`); Word Patterns 2 (`:133-134`). Total **48**.

Each section also carries a short "Instead:" remedy line: `structures.md:21, 32, 44, 57, 80, 93, 106` and the false-agency remedy at `:80`, e.g. `"The team fixed it that week" beats "the complaint becomes a fix."` (`structures.md:80`).

### 4c. Every rule/instruction in `SKILL.md`

Core Rules (`SKILL.md:13-29`), 8:

| item (verbatim, headline) | category | what it targets | evidence (file:line) |
|---|---|---|---|
| "**Cut filler phrases.** Remove throat-clearing openers, emphasis crutches, and all adverbs. See [references/phrases.md](references/phrases.md)." | Core rule 1 | filler/adverbs | `SKILL.md:15` |
| "**Break formulaic structures.** Avoid binary contrasts, negative listings, dramatic fragmentation, rhetorical setups, false agency. See [references/structures.md](references/structures.md)." | Core rule 2 | structural clichés | `SKILL.md:17` |
| "**Use active voice.** Every sentence needs a human subject doing something. No passive constructions. No inanimate objects performing human actions (\"the complaint becomes a fix\")." | Core rule 3 | passive voice + false agency | `SKILL.md:19` |
| "**Be specific.** No vague declaratives (\"The reasons are structural\"). Name the specific thing. No lazy extremes (\"every,\" \"always,\" \"never\") doing vague work." | Core rule 4 | vagueness/absolutes | `SKILL.md:21` |
| "**Put the reader in the room.** No narrator-from-a-distance voice. \"You\" beats \"People.\" Specifics beat abstractions." | Core rule 5 | distant narrator | `SKILL.md:23` |
| "**Vary rhythm.** Mix sentence lengths. Two items beat three. End paragraphs differently. No em dashes." | Core rule 6 | rhythm/em dashes/triads | `SKILL.md:25` |
| "**Trust readers.** State facts directly. Skip softening, justification, hand-holding." | Core rule 7 | hedging/padding | `SKILL.md:27` |
| "**Cut quotables.** If it sounds like a pull-quote, rewrite it." | Core rule 8 | self-consciously quotable lines | `SKILL.md:29` |

Quick Checks (`SKILL.md:35-46`), 12: "Any adverbs? Kill them." (`:35`); "Any passive voice? Find the actor, make them the subject." (`:36`); "Inanimate thing doing a human verb (\"the decision emerges\")? Name the person." (`:37`); "Sentence starts with a Wh- word? Restructure it." (`:38`); "Any \"here's what/this/that\" throat-clearing? Cut to the point." (`:39`); "Any \"not X, it's Y\" contrasts? State Y directly." (`:40`); "Three consecutive sentences match length? Break one." (`:41`); "Paragraph ends with punchy one-liner? Vary it." (`:42`); "Em-dash anywhere? Remove it." (`:43`); "Vague declarative (\"The implications are significant\")? Name the specific implication." (`:44`); "Narrator-from-a-distance (\"Nobody designed this\")? Put the reader in the scene." (`:45`); "Meta-joiners (\"The rest of this essay...\")? Delete. Let the essay move." (`:46`).

## 5. Examples

`references/examples.md` contains **5 before/after pairs** (one per `## Example N` heading), each a single quoted paragraph in a `**Before:**` / `**After:**` block plus a one-line `**Changes:**` note:

| # | Title (verbatim) | Demonstrates | Pairs | evidence (file:line) |
|---|---|---|---|---|
| 1 | "Throat-Clearing + Binary Contrast" | removing "Here's the thing:", a not-because/because contrast, and "Let that sink in." | 1 | `references/examples.md:3-11` |
| 2 | "Filler + Unnecessary Reassurance" | cutting "It turns out", "The uncomfortable truth is", hedge "most", and the permission-granting "And that's okay." | 1 | `references/examples.md:15-23` |
| 3 | "Business Jargon Stack" | collapsing jargon+scaffolding to "Move faster. Your competition is." (6 words) | 1 | `references/examples.md:27-35` |
| 4 | "Dramatic Fragmentation" | collapsing "Speed. Quality. Cost. ... That's it. That's the tradeoff." to "Speed, quality, cost—pick two." | 1 | `references/examples.md:39-47` |
| 5 | "Rhetorical Setup" | removing "What if I told you", "Here's what I mean:", "Think about it." | 1 | `references/examples.md:51-59` |

Total: 5 pairs, ~5 before-sentences and 5 after-sentences, all English, all business/essay-register. Notably, Example 4's "after" line contains an em dash (`references/examples.md:45`), which contradicts the repo's own "No em dashes at all" rule (`structures.md:125`, `SKILL.md:43`) — an internal inconsistency.

## 6. Detectors and algorithms

**`none found`.** There is no executable detection logic of any kind: no scripts directory, no `.js`/`.mjs`/`.py`/`.ts` files, no regexes, no scoring code, no hook, no CLI. Everything is prose plus curated lists in Markdown. Detection is entirely delegated to the LLM reading the prompt. The only "algorithmic" content is the human-applied rubric in `SKILL.md:50-60` and the rhetorical remedy lines in `structures.md`. (For contrast, ai-humanizer has already converted these same lists into a deterministic engine — `ai-humanizer/scripts/engines/lexical.mjs:238` is literally labelled "Absorbed from stop-slop (hardikpandya/stop-slop, MIT)".)

## 7. Scoring and severity

**Present (self-assessment only, not automatic).** `SKILL.md:50-58` defines a rubric: "Rate 1-10 on each dimension": Directness ("Statements or announcements?"), Rhythm ("Varied or metronomic?"), Trust ("Respects reader intelligence?"), Authenticity ("Sounds human?"), Density ("Anything cuttable?"). Threshold: "Below 35/50: revise." (`SKILL.md:60`). The identical table is repeated in `README.md:46-54`. There are **no** per-dimension anchors, no severity levels, no weights, and no machine-readable output format — a model applying the rubric produces only a number. There is no finding severity model.

## 8. Pipeline and rewrite workflow

There is no explicit workflow section. The de facto pipeline is implicit and thin:

1. **Apply Core Rules 1-8** to the draft (`SKILL.md:15-29`), using `references/phrases.md` and `references/structures.md` as lookup lists.
2. **Run the 12 Quick Checks** before delivering (`SKILL.md:35-46`); each check is a yes/no gate with a one-line fix.
3. **Self-score** 1-10 on five dimensions (`SKILL.md:50-58`); if total <35/50, revise (`SKILL.md:60`).
4. **Consult `references/examples.md`** for the rewrite register (`SKILL.md:64`).

Absent (and present in blader/humanizer): any two-pass draft→check→final loop, any "mark the tells first / read the whole text once" step, any fact-preservation rule ("Do not add a fact, name, number, date, quote, or citation", `blader-humanizer/SKILL.md:36`), any output-mode contract (paste/file/embedded modes, `blader-humanizer/SKILL.md:46-52`), any voice-sample matching (`blader-humanizer/SKILL.md:40-44`), and any false-positive guards ("When not to act", `blader-humanizer/SKILL.md:360-370`). stop-slop's rules are stated as absolutes with no "weak alone" mechanism.

## 9. Chinese language support

**`none found`.** Zero CJK characters in the entire repository (full-text scan counted 0 code points in U+4E00–U+9FFF, U+3000–U+303F, U+FF00–U+FFEF). Every phrase, structure, rule, and example is English-only, and the phrases are English idiom ("Here's the thing:", "Let that sink in.") with no Chinese equivalents, no pinyin, no zh-specific patterns, and no localization metadata or `source:` translation field.

Implication for a bilingual suite: stop-slop contributes **no** Chinese capability. Any value it has for Chinese output must be re-derived by human mapping of each English idiom to its Chinese counterpart (e.g. the Chinese-skill upstreams in this set do that work themselves — op7418/Humanizer-zh explicitly lists stop-slop as an inspiration for its utility sections while sourcing its content from blader/humanizer). For the bilingual suite, stop-slop is English-only and must not be treated as a zh source.

## 10. Reusable modules and extraction plan

| module (file) | what it does | reuse recommendation | integration kind |
|---|---|---|---|
| `references/phrases.md` (76 entries / 78 strings) | Curated English lexical blocklist in 8 categories, 11 of them with plain-language replacement pairs | Reuse as **machine-checkable lexical rules**; ~62/78 variants are already present in ai-humanizer's lexicons, so reuse means diffing and adding the ~10 genuine gaps | A (executable detector adapter) — but implement inside the existing ai-humanizer-derived rule registry, not as a new adapter |
| `references/structures.md` (48 rows / 11 headings) | Structural pattern blocklist; ~30 rows are concrete literal strings, ~18 are placeholder templates | Partially reusable: concrete literals → detector regexes; placeholder templates → prompt-level guidance only | A for the literal rows; B for the template rows |
| `SKILL.md` Core Rules 1-8 | Prompt-level editorial policy | Do not import as a separate skill; the same ground is covered more rigorously by blader §1-§25 | B (parsing into rules), low priority |
| `SKILL.md` Quick Checks 12 | Pre-delivery checklist phrasing | Reuse only as a lint-checklist wording source | B |
| `SKILL.md` Scoring rubric (5 dims, 1-10, <35/50) | Human-judgment rubric | Already absorbed verbatim in concept by ai-humanizer (`ai-humanizer/README.md:290-294`) | D (methodology; keep out of the default execution path) |
| `references/examples.md` (5 pairs) | Rewrite register calibration | Optional few-shot examples; note Example 4 violates the em-dash rule | E (research-only; do not copy) unless used as negative test fixtures |
| `README.md`, `CHANGELOG.md`, `LICENSE` | Packaging/metadata | Not reusable as capability | E |
| Named patterns False Agency (7 rows) and Narrator-from-a-Distance (4 rows) | Inanimate-subject and distant-narrator tells | The only genuinely under-covered material outside ai-humanizer; worth extracting as two detector rules | A |

**Concrete plan for turning `phrases.md` and `structures.md` into machine-checkable lexical rules**

1. **Normalize each entry into a rule record** `{id, category, pattern, severity, weight, remedy}`. Mapping: Throat-Clearing Openers → `ai-openers`; Emphasis Crutches → `emphasis-crutch`; Business Jargon → `business-jargon` + a `jargonSwaps` map; Adverbs → `adverb-filler` (density-gated); Filler phrases → `ai-openers`/`buzzwords`; Meta-Commentary → `meta-commentary`; Performative Emphasis + Telling Instead of Showing → `emphasis-crutch` and a new `telling-not-showing`; Vague Declaratives → `vague-declarative`. The 11 Business Jargon rows become a key→replacement dictionary exactly as ai-humanizer already did (`ai-humanizer/scripts/lexicons.mjs:212-224`, an 11/11 verbatim copy of `phrases.md:41-51`).
2. **Compile the literals into case-insensitive regexes**, with a shared matcher that (a) lowercases, (b) collapses whitespace, (c) treats `[...]` placeholders as bounded wildcards, and (d) anchors openers to sentence/clause start to avoid mid-sentence false positives (e.g. `\bhere's (what|this|that|why)\b` at paragraph start only).
3. **Split the 48 structure rows into two tiers.** Tier 1 — concrete literals safe for regex: `"That's it. That's the [thing]."`, `"X. And Y. And Z."`, `"Not always. Not perfectly."`, `"Nobody designed this."`, `"People tend to..."`, `"This happens because..."`, `"It is believed that"`, `"Mistakes were made"`, `"the decision emerges"`, `"the data tells us"`, `"the market rewards"`, `"By the time X, I was Y."` (template with slot), plus the false-agency noun×verb pair lists. Tier 2 — regex-gated heuristics: binary contrasts (`not X but Y`, `isn't X, it's Y`), negative listing (`Not X… Not Y… Z`), Wh- openers, passive voice, triads, em dashes, staccato runs. Tier 2 needs density/co-occurrence gating or it will misfire.
4. **Add explicit false-positive guards that stop-slop lacks** — code blocks, inline code, URLs, quotations, proper names, legal/technical passive voice, and deliberate voice-sample dashes (the guard set blader/humanizer already documents at `blader-humanizer/SKILL.md:161, 171, 180, 306, 362`).
5. **Do the diff first, not the import.** Because ai-humanizer already carries these lists as data and as rules, the extractable delta is small: the ~10 residual phrase strings and two structural rules (see §12). Extracting the whole file would duplicate an existing rule pack.

## 11. License and provenance

- License: MIT, `LICENSE:1`; copyright "`Copyright (c) 2025 Hardik Pandya`" (`LICENSE:3`). The skill file itself declares only "MIT" (`SKILL.md:68`), and `README.md:62` says "MIT. Use freely, share widely."
- **Declared derivation: none.** A search of every file for `wikipedia`, `source`, `blader`, `derived`, `based on`, `adapted` returned **zero** matches. There is no Sources/Credits section, unlike blader/humanizer (`blader-humanizer/README.md:161-164`, Wikipedia "Signs of AI writing") or ai-humanizer (`ai-humanizer/README.md:288-294`).
- **Direction of borrowing is stop-slop → ai-humanizer, and it is explicitly credited and textually demonstrable:**
  - Source-credit line: "Sources for the expanded lists: anti-ai-slop-writing, harshaneel/humanize, shannhk/avoid-slop, MohamedAbdallah-14/unslop, brandonwise/humanizer, `hardikpandya/stop-slop`, and Wikipedia 'Signs of AI writing'." (`ai-humanizer/scripts/lexicons.mjs:10`).
  - Dedicated credit paragraph: editorial tells "(passive voice, false agency, empty adverbs, vague declaratives, meta-commentary, rhetorical setups, negative listing, lazy extremes, and the 1-10 human-judgment rubric) were absorbed from stop-slop by Hardik Pandya (MIT), including the March 2026 additions (narrator-from-a-distance, telling-not-showing, performative emphasis, absolute adverb bans)" (`ai-humanizer/README.md:290-294`).
  - Code markers: `ai-humanizer/scripts/engines/lexical.mjs:238` "── Absorbed from stop-slop (hardikpandya/stop-slop, MIT) ──"; `ai-humanizer/scripts/registry/rules.mjs:148` "── Absorbed from stop-slop (editorial tells) ──"; lexicon comments at `lexicons.mjs:141, 145, 150, 154, 160, 170, 177, 182, 186, 197, 210`.
  - **Verbatim table copy:** stop-slop's 11-row Business Jargon swap table (`phrases.md:41-51`) appears 1:1 in `ai-humanizer/scripts/lexicons.mjs:212-224` (`JARGON_SWAPS`), including the non-obvious pairings `'take a step back': 'reconsider'` and `'landscape': 'situation, field'` — conclusive lexical derivation.
  - **Verbatim phrase copy:** stop-slop's "A rhetorical striptease." (`structures.md:25`) is reproduced verbatim as ai-humanizer's rule description for `negative-listing` ("Negation buildup ('Not X… Not Y… Z') — a rhetorical striptease.", `ai-humanizer/scripts/registry/rules.mjs:162`); ai-humanizer's `EMPHASIS_CRUTCH` (`lexicons.mjs:178-184`) carries the stop-slop-specific items `'the uncomfortable truth is'`, `"here's why that matters"`, `'let me be clear'`, `"i'll say it again"`, `'i promise'`, `'they exist, i promise'`, `'creeps in'`; `VAGUE_DECLARATIVE` (`lexicons.mjs:188-190`) carries all five stop-slop vague declaratives verbatim.
- **Also credited downstream in this upstream set:** op7418/Humanizer-zh — "实用工具部分（核心规则、快速检查清单、质量评分）参考了 hardik pandya/stop-slop" (`op7418-humanizer-zh/README.md:5`), repeated at `README.md:231`, and `SKILL.md:15` `source: 翻译自 blader/humanizer，参考 hardikpandya/stop-slop`; and lynote-ai/dsh-humanizer — "Modeled on stop-slop, blader/humanizer, and Humanizer-zh" (`dsh-humanizer/lib/core/rules.js:3`, `dsh-humanizer/README.md:53`). So three other members of this upstream set already derive from stop-slop.
- **Evidence about blader/humanizer:** no evidence of copying in either direction. blader declares Wikipedia's "Signs of AI writing" as its sole source (`blader-humanizer/SKILL.md:7`, `README.md:161-164`), while stop-slop declares none. Their shared material ("Let that sink in.", not-X-but-Y, em dashes, triads, passive voice, "at its core"/"in reality"/"the real question is") is anchorable to that Wikipedia corpus, and ai-humanizer independently attributes those same strings to *harshaneel* and *Wikipedia* rather than to stop-slop. Conclusion: stop-slop and blader/humanizer are **convergent** on the common AI-slop canon, not derivative of one another.

## 12. Overlap and duplication signals — CRITICAL

Method: full-text, case-insensitive, punctuation-normalized substring matching of stop-slop's items against the other cached repositories (real reads of `blader-humanizer/SKILL.md`, `ai-humanizer/scripts/lexicons.mjs`, `ai-humanizer/scripts/registry/rules.mjs`, plus a keyword probe), all read-only.

**Measured lexical overlap (78 distinct phrase variants from `phrases.md`):**

| Comparison target | Exact-string hits | % |
|---|---|---|
| ai-humanizer (all files) | 62 / 78 | **79%** |
| blader/humanizer (all files) | 14 / 78 | **18%** |
| op7418-humanizer-zh or dsh-humanizer | 5 / 78 | 6% |

The 79% understates it: several residual "misses" are formatting artifacts, not content gaps (`here's this`/`here's that` are covered by ai-humanizer's `"here's a"` and `"here's"`; `the rest of this essay explains` by `'the rest of this essay'`; `in this section, we'll` by `'in this section'`; `you already know this, but` by `'you already know this'`; `the truth is,` by `'the truth is'`). Allowing those, coverage rises to roughly **87-90%**. Only about **10** phrase strings are genuinely absent from ai-humanizer: `"Here's this [X]"`, `"Here's that [X]"`, `"The real [X] is"`, `"I'm going to be honest"`, `"crucially"`, `"The reality is"`, `"Hint:"`, `"X is a feature, not a bug"`, `"Dressed up as"`, and the four Telling-Instead-of-Showing items (`"This is genuinely hard"`, `"This is what leadership actually looks like"`, `"This is what X actually looks like"`, `"actually matters"`).

**Structural overlap is even more complete against ai-humanizer.** Ten of stop-slop's eleven structure headings have a named ai-humanizer rule that is explicitly credited to stop-slop (`ai-humanizer/scripts/registry/rules.mjs:148-203`): `false-agency` (weight 4), `rhetorical-setup` (4), `negative-listing` (5), `vague-declarative` (3), `meta-commentary` (3), `emphasis-crutch` (3), `dramatic-fragmentation` (3), `adverb-filler` (2), `lazy-extremes` (2), `passive-voice` (2), `wh-opener` (2). Binary Contrasts maps to ai-humanizer's `aphoristic-cadence`/not-X-but-Y handling, and Rhythm Patterns to `em-dash-overuse`, `rule-of-three`, `uniform-rhythm`, `dramatic-fragmentation`. **stop-slop is a strict subset of ai-humanizer for all practical purposes, and ai-humanizer's README says so in words (`ai-humanizer/README.md:290-294`).**

**Overlap with blader/humanizer is structural rather than lexical** (18% exact strings, but most concepts are covered by a differently-worded pattern): stop-slop's Throat-Clearing Openers ↔ blader §4 "Staged run-up before the point" (`blader-humanizer/SKILL.md:109-120`, which names "Here's the thing", "The thing is", "Let's be honest", "Honestly?", "Look"); Emphasis Crutches "Let that sink in." ↔ blader §2 (`:77`); Binary Contrasts ↔ blader §1 "Not X but Y" (`:58-73`, including "not just, not only, or not merely X, but Y", "it's not X, it's Y", and the split-across-sentences form); Negative Listing + Dramatic Fragmentation ↔ blader §2 (`:75-94`, including the row-of-fragments "No aesthetic prior. No nostalgia."); Rhetorical Setups ↔ blader §4/§5; False Agency + Passive Voice ↔ blader §11 "Passive voice and missing subjects" (`:186-192`, though blader never names false agency); False-depth sayings ↔ blader §3 "Sayings that sound deep" (`:96-107`: "the real question is, at its core, in reality, what really matters, fundamentally, the deeper issue, the heart of the matter"); em dashes ↔ blader §8 (`:159-166`); triads ↔ blader §6 "Forced triads" (`:139-149`); adverbs/lazy extremes ↔ blader §12 overused-AI-words list (`:198-205`) partially. Estimated coverage of stop-slop's *capability* by blader/humanizer: roughly **50-60%**.

One important divergence: blader **deliberately rejects** stop-slop's absolutism. Where stop-slop says "Kill all adverbs. No -ly words." (`phrases.md:55`) and "No em dashes at all" (`structures.md:125`), blader marks stacked qualifiers, hyphens, curly quotes, passive voice, and dashes as *weak alone* needing company (`blader-humanizer/SKILL.md:171, 180, 188, 306`) and states that "Ordinary hedges such as *perhaps* or *tends to* are human habits and not tells" (`:171`). So importing stop-slop's raw adverbs rule would **regress** false-positive behavior relative to blader.

**Rough proportion answer:** ~90% of stop-slop (all of `phrases.md`, 10 of 11 structure headings, the 8 core rules, the 12 quick checks, and the scoring rubric) is already present in ai-humanizer, which credits it by name; ~50-60% is present in blader/humanizer by concept. Union of the two: **roughly 90-95% redundant**.

**Genuinely UNIQUE to stop-slop (absent from both blader/humanizer and ai-humanizer, verified by full-text probe):**

1. The `Formulaic Constructions` heading and both its rows: `"By the time X, I was Y."` (`structures.md:63`) and `"X that isn't Y"` (`structures.md:64`) — neither string nor heading appears in either comparison repo.
2. `Narrator-from-a-Distance` as an actual rule with four watch items: `"Nobody designed this."`, `"This happens because..."`, `"This is why..."`, `"People tend to..."` (`structures.md:89-92`). ai-humanizer *claims* to have absorbed narrator-from-a-distance (`ai-humanizer/README.md:293`) but has no such rule id in its registry (`registry/rules.mjs`) and no lexicon entries — the only occurrence of "narrator" there is the credit line itself. So this rule is credited but not implemented anywhere.
3. The Telling-Instead-of-Showing literals: `"This is genuinely hard"`, `"This is what leadership actually looks like"`, `"This is what X actually looks like"`, `"actually matters"` (`phrases.md:113-116`).
4. `"Dressed up as"` (`phrases.md:94`), `"Hint:"` (`:89`), `"X is a feature, not a bug"` (`:93`).
5. `"crucially"` (`phrases.md:73`) and `"The reality is"` (`:83`) — residual single strings.
6. Three false-agency example rows not carried over: `"a complaint becomes a fix"`, `"the culture shifts"`, `"the conversation moves toward"` (`structures.md:72, 75, 76`).
7. `"This unlocks something. [Word]."` (`structures.md:42`) and `"Not always. Not perfectly."` (`structures.md:127`).
8. `"stops being X and starts being Y"` (`structures.md:16`), `"is about X but not Y"` (`:18`), `"It feels like X. It's actually Y."` (`:12`), `"The question isn't X. It's Y."` (`:13`) — binary-contrast sub-forms blader's §1 does not enumerate.

## 13. Integration recommendation

**Recommendation: research-only for the repository as a package; do not add it as a new adapter, and do not merge its skill file. Extract a small, targeted delta later (kind A) — a "merge later, ~1-2 hours of work, not now" outcome.**

Justification:

1. **It is not a distinct capability.** ~90% of it is already inside ai-humanizer, which credits stop-slop by name and reproduces its Business Jargon table and key lists verbatim (`ai-humanizer/scripts/lexicons.mjs:212-224`, `registry/rules.mjs:148-203`, `README.md:290-294`). Adding stop-slop as a third English lexical pack would create duplicate rule ids firing on the same spans and inflate finding counts without adding detection power.
2. **It has no executable substance to adapt.** No code, no regexes, no tests, no CLI, no scoring output (`§6`). An "adapter" would be a Markdown parser producing rules that already exist.
3. **Its prose layer is a weaker version of blader/humanizer.** blader has a motivating theory, a 4-step workflow, fact-preservation rules, output modes, voice matching, "weak alone" gradations, and explicit false-positive guards (`blader-humanizer/SKILL.md:17-52, 360-370`); stop-slop has absolute prohibitions and no guards. Importing stop-slop's prose would regress quality.
4. **It brings nothing to Chinese** (`§9`), which is the suite's differentiator.
5. **What is actually worth extracting (small and concrete):** (a) a `formulaic-construction` detector rule from `structures.md:63-64`; (b) a `narrator-distance` detector rule from `structures.md:89-92` — genuinely unimplemented anywhere in the set despite ai-humanizer's credit line; (c) a `telling-not-showing` lexicon from `phrases.md:113-116`; (d) ~6 residual strings (`"Dressed up as"`, `"Hint:"`, `"X is a feature, not a bug"`, `"crucially"`, `"The reality is"`, `"This unlocks something"`); (e) the three missing false-agency examples as fixture data. That is roughly 15 items out of 124 listed entries.
6. **Licensing is clean** (MIT, `LICENSE:3`), so extraction is unproblematic; attribution should read "derived from hardikpandya/stop-slop, MIT © 2025 Hardik Pandya", mirroring `ai-humanizer/README.md:290-294`.

## 14. Gaps, risks, and limitations

- **No declared source or derivation** anywhere in the repo (zero matches for wikipedia/source/adapted), so provenance cannot be verified from the repo itself; provenance is only reconstructable from downstream credits.
- **No version number**: no `version` in frontmatter (`SKILL.md:1-7`), no version in README, date-only changelog. Cannot pin releases; only the commit hash (`8da1f03018`) is a stable identifier.
- **Changelog date inconsistency**: `CHANGELOG.md:22` dates the initial release "2025-01-12", while git records the initial commit as 2026-01-11 — the changelog year is wrong. Also `CHANGELOG.md:17` uses "2026-01-12" for the restructure, and entries stop at 2026-01-13 even though the analyzed commit (2026-03-18) added 12 new rules — **the changelog is not maintained for the latest three commits** (`1fdf64d`, `fa6e4b7`, `8da1f03`).
- **Absolute rules create false-positive risk**: "Kill all adverbs. No -ly words." (`phrases.md:55`), "No em dashes at all" (`structures.md:125`), "Every sentence needs a human subject doing something. No passive constructions." (`SKILL.md:19`). These misfire on technical/legal writing, quoted material, code, and legitimate passive voice — the exact cases blader protects (`blader-humanizer/SKILL.md:161, 171, 188, 306, 362`).
- **Internal contradiction**: Example 4's recommended output contains an em dash — "Speed, quality, cost—pick two." (`references/examples.md:45`) — violating `structures.md:125` and `SKILL.md:43`.
- **No fact-preservation rule**: nothing prevents the rewrite from inventing or dropping facts; blader treats that as an error (`blader-humanizer/SKILL.md:36`).
- **Scoring rubric is unanchored and uncalibrated**: 1-10 on five adjectives with no rubric per level, and the "Below 35/50" threshold (`SKILL.md:60`) has no justification or validation.
- **No detectors, tests, or fixtures**; quality claims are unauditable.
- **No false-positive guards, no fiction/news/technical register handling, no voice matching, no output modes, no multilingual support** (`§9`).
- **Placeholder-heavy structures** (`[X]`, `[Y]`, `[Noun]`, `[Word]`, `[thing]`, `[reframe]`) make 18 of the 48 structure rows non-mechanizable as literal regexes without hand-written wildcard logic.
- **Frontmatter uses non-standard keys** (`metadata.trigger`, `metadata.author`) and omits `license`; portability across agents is unverified — the README documents only Claude surfaces (`README.md:26-32`).
- **Practical risk for this suite**: adopting stop-slop's aggressive adverb/em-dash bans would conflict with the blader-derived patterns already in the set and would double-count findings against ai-humanizer's existing `adverb-filler`, `lazy-extremes`, `emphasis-crutch`, `meta-commentary`, `vague-declarative`, `false-agency`, `passive-voice`, and `wh-opener` rules.
