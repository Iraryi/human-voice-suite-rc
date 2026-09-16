# Inventory: judetelan/ai-humanizer

## 1. Identity

| Field | Value |
|---|---|
| Repository | `judetelan/ai-humanizer` (remote `https://github.com/judetelan/ai-humanizer.git`, branch `main`, `remotes/origin/HEAD -> origin/main`) |
| Commit analyzed | `76bf08f13b` (`76bf08f13bee88044f448fd1b80604e33bb662b6`), subject "Update credits with new upstream sources and research citations", dated 2026-08-22 |
| Local path | `\.upstream-cache\ai-humanizer` |
| License (verbatim, `LICENSE:1-3`) | `MIT License` / blank / `Copyright (c) 2026 judetelan` |
| Declared version | **none found** — no `package.json`, no `VERSION` file, no `version:` field anywhere; `SKILL.md:1-4` frontmatter carries only `name: ai-humanizer` and `description:`. The repo's own version proxy is the rule count (`README.md:226-227`). |
| Primary languages | JavaScript (Node.js ESM, `.mjs`) as the only executable code; Markdown as the skill/instruction layer. No TypeScript, no `.py` source file (Python exists only embedded inside `portable/ai-humanizer.md`). |
| File count | 17 files (excluding `.git/`): 8 × `.mjs`, 7 × `.md`, `LICENSE`, `.gitignore` |
| Total text size | 121,883 bytes (~119.0 KiB): `.mjs` 68,859 B; `.md` 51,870 B; `LICENSE` 1,066 B; `.gitignore` 88 B |
| Default branch history | 10 commits, 2026-06-21 → 2026-08-22, all authored by `judetelan` |

Full commit list (`git log`), which is itself provenance evidence (see §11):

```
76bf08f 2026-08-22 Update credits with new upstream sources and research citations
7ad3e54 2026-08-22 Fix em-dash regex: exclude markdown hr (---) and table separators (|---)
a265dc0 2026-08-22 Upgrade to 46 rules: RLHF detection, new providers, smarter scoring
3c714e9 2026-06-25 docs: clarify when you can ask Claude to update/use the skill
b8080fe 2026-06-25 docs: lead claude.ai skill-update with no-terminal Download ZIP path
c535739 2026-06-25 docs: claude.ai/Desktop usage guide + how to update
918b714 2026-06-25 docs: clearer Claude Code skill install & usage guide
2af5da2 2026-06-25 Absorb stop-slop editorial tells (29 → 40 rules)
4e5f1e6 2026-06-21 README: add quick-start with raw LLM link and raw URL table
ac38faf 2026-06-21 Add ai-humanizer: deterministic AI-tell detector + rewrite skill
```

There are no tags and no other branches.

## 2. Purpose and functionality

`ai-humanizer` is an **English-language "AI writing tell" detector plus rewrite guidance**, packaged as a Claude Agent Skill and simultaneously as a standalone Node.js CLI (`README.md:1-10`). It is explicitly positioned as "a **style/slop scorer, not a provenance classifier**" (`README.md:8-10`, restated `SKILL.md:132-147`).

Concrete capabilities actually implemented:

1. **Deterministic detection** over 46 registry rules (`scripts/registry/rules.mjs`) executed by two engines: a phrase/regex engine (`scripts/engines/lexical.mjs`) and a statistical stylometry engine (`scripts/engines/stylometry.mjs`).
2. **Scoring** into a `slop 0–100` number plus a 5-band verdict (`scripts/registry/rules.mjs:294-312`).
3. **Mode gating** — `prose` / `marketing` / `both` changes which rules are active and re-weights some rules (`rules.mjs:273-281`, `rules.mjs:266-270`).
4. **Provider gating** — five opt-in model-tic rule sets (`gpt`, `claude`, `gemini`, `grok`, `deepseek`) that are off by default (`rules.mjs:232-257`).
5. **Stylometric feature reporting** — sentence-length mean/CV/min/max, type-token ratio, commas per sentence, contraction rate, paragraph count/CV (`stylometry.mjs:18-40`), surfaced with `--features` (`humanize-detect.mjs:80-82`).
6. **Score trend persistence** — one JSONL file per target slug under `.ai-humanizer/scores/` (`scripts/storage.mjs:17`, `storage.mjs:30-46`).
7. **Batch audit + CI exit code** — multiple files per invocation, exit `2` when any finding exists (`humanize-detect.mjs:110`, `humanize-detect.mjs:131`; documented `references/audit.md:21-27`).
8. **Auto-scan hook** — a Claude Code `PostToolUse` hook that re-runs the detector after `Write|Edit` and injects findings as context, never blocking (`scripts/hook.mjs:1-8`, `hook.mjs:43-48`, `hook.mjs:77-93`).
9. **Rewrite guidance** — 14 rewrite "levers" plus a 1–10 human-judgment rubric (`SKILL.md:70-117`), and a self-contained portable variant with an embedded Python scorer for ChatGPT/Gemini/claude.ai (`portable/ai-humanizer.md:74-160`).

Not implemented: any learned/perplexity model, any network call, any author-voice modelling (see §7), any test suite, any CI (see §10).

## 3. Code and file structure

```
ai-humanizer/
├── LICENSE                        MIT, Copyright (c) 2026 judetelan
├── README.md                      install/usage/architecture/limits/credits (309 lines)
├── SKILL.md                       skill frontmatter, 3 commands, routing, 14 levers, rubric (147 lines)
├── .gitignore                     ignores .ai-humanizer/, .impeccable/, node_modules/
├── portable/
│   └── ai-humanizer.md            self-contained skill + embedded Python scorer (169 lines)
├── references/
│   ├── audit.md                   batch-scan flow (29 lines)
│   ├── banned-words.md            lexicon documentation with rationale (250 lines)
│   ├── check.md                   read-only forensic flow (26 lines)
│   └── humanize.md                detect→rewrite flow (35 lines)
└── scripts/
    ├── humanize-detect.mjs        orchestrator: analyze() + CLI (134 lines)
    ├── hook.mjs                   Claude Code PostToolUse hook (96 lines)
    ├── lexicons.mjs               all word/phrase data, 524 entries in 26 arrays (291 lines)
    ├── storage.mjs                slugify/record/trend + CLI (65 lines)
    ├── engines/
    │   ├── lexical.mjs            40 detectors (phrase/regex) (358 lines)
    │   └── stylometry.mjs         features() + 7 detectors, 1 of them orphaned (126 lines)
    ├── registry/
    │   └── rules.mjs              46 rules + scoring + gating (317 lines)
    └── shared/
        └── text.mjs               toText/splitSentences/splitParagraphs/countPhrases (69 lines)
```

Architecture contract, quoted from the registry header (`rules.mjs:4-15`): "Pure data (mirrors impeccable's antipatterns.mjs) … Engines own the detection logic and tag each finding with the rule `id`; this registry owns metadata, scoring, mode-filtering, and gating." Declaration vocabulary is fixed as `category : lexical | cadence | stylometry | formatting`, `engine : 'lexical' | 'stylometry'`, `severity : warning | info | advisory`, `modes`, `weight : number | { default, marketing }`, `gated`.

Data flow: `humanize-detect.mjs:analyze()` → `toText(raw)` → `computeFeatures(ctx)` → `activeRuleIds({mode, engine, providers})` → `runLexical` + `runStylometry` → `filterByProviders` → sort by line then id → `score()` (`humanize-detect.mjs:37-55`).

Two internal inconsistencies worth flagging:

- `scripts/engines/stylometry.mjs:88-103` defines a detector `'sentence-spread'` that **does not exist in the registry** and is therefore unreachable dead code (no rule id, no weight, never emitted). Its thresholds ("spread only N words (aim for 20+)", "N runs of 3+ same-length sentences") duplicate the prose in `references/banned-words.md:231-232`.
- `passive-voice` is declared `category: 'stylometry'` but `engine: 'lexical'` (`rules.mjs:195`), which violates the registry's own category/engine mapping; its detection is a curated regex, not a statistical measure.

## 4. Rule inventory

**46 rules** are defined in `RULES` in `scripts/registry/rules.mjs` (verified: 46 `id:` occurrences; compact form `em-dash-overuse … deepseek-tics`). All rules are English-oriented; a few are language-neutral (markup/Unicode statistics) as noted. Weights are the exact declared values (`weight:` field); mode-dependent weights are shown as declared. The "severity/weight" column reproduces the literal enum value plus weight. There are fewer than 100 rules, so every rule has its own row.

| rule_id | category | language(s) | what it detects | severity/weight (exact value) | detection mechanism (regex/lexicon/heuristic/statistical) | evidence (file:line) |
|---|---|---|---|---|---|---|
| `em-dash-overuse` | cadence | en | Em-dashes plus typographic `--` used as dashes; fires when `count >= 4` or rate `>= 1` per 150 words. Regex explicitly excludes CLI flags (`--mode`), markdown `hr` (`---+`), table separators (`\|---`) and permission strings (`-rwx---`) | `warning` / `6` | regex `/[—]\|(?<![|\w-])--(?![-a-zA-Z])/g` + rate threshold | `rules.mjs:21`; `lexical.mjs:31-43` |
| `banned-vocab` | lexical | en | 98 AI-spike words/phrases (`delve`, `leverage`, `robust`, `seamless`, `rich tapestry`, `delve into`, …) | `warning` / `4` | lexicon lookup, word-boundary word-bounded substring count (`countPhrases(...,{wordBoundary:true})`) | `rules.mjs:26`; `lexical.mjs:45-48`; `lexicons.mjs:14-38` |
| `ai-openers` | lexical | en | 53 throat-clearing / RLHF opener phrases (`moreover,`, `furthermore,`, `in today's`, `it's worth noting`, `here's what you need to know`) | `warning` / `5` | lexicon lookup | `rules.mjs:31`; `lexical.mjs:50-53`; `lexicons.mjs:41-61` |
| `marketing-buzzword` | lexical | en | 46 SaaS marketing phrases (`world-class`, `cutting-edge`, `streamline your`, `move the needle`) | `warning` / `{ default: 4, marketing: 8 }` | lexicon lookup | `rules.mjs:36-40`; `lexical.mjs:55-58`; `lexicons.mjs:64-79` |
| `hedging` | lexical | en | 12 soft hedges (`generally speaking`, `arguably`, `in most cases`); needs 2+ hits | `info` / `3` | lexicon lookup + hit-count gate `{min: 2}` | `rules.mjs:42`; `lexical.mjs:60-63`; `lexicons.mjs:82-86` |
| `aphoristic-cadence` | cadence | en | Manufactured contrast: `Not an X. A Y.`; short-rebuttal `… No …` / `… Just …`; `<subject> not just …, it's/but`; needs 2+ hits | `warning` / `5` | 3 regexes (`NOT_A`, `REBUTTAL`, `NOT_JUST`) + count gate | `rules.mjs:47`; `lexical.mjs:184-197` |
| `rule-of-three` | cadence | en | Triadic word lists `X, Y, and Z`; needs 3+ hits | `info` / `3` | regex `/\b([A-Za-z]+), ([A-Za-z]+),? and ([A-Za-z]+)\b/g` + count gate | `rules.mjs:52`; `lexical.mjs:199-207` |
| `numbered-section-markers` | formatting | en | Sequential `01`–`12` markers: ≥3 distinct values and ≥2 strict increments | `info` / `3` | regex + set/sequence heuristic | `rules.mjs:57`; `lexical.mjs:209-220` |
| `exclamation-spam` | formatting | language-neutral | Exclamation marks when `count >= 3` and rate `>= 1` per 200 words | `info` / `2` | character count + rate threshold | `rules.mjs:62`; `lexical.mjs:222-228` |
| `emoji-decoration` | formatting | language-neutral | ≥3 characters in U+1F000–U+1FAFF, U+2600–U+27BF, U+2B00–U+2BFF | `info` / `3` | Unicode-range regex + count gate | `rules.mjs:67`; `lexical.mjs:230-236` |
| `wordy-connectives` | lexical | en | 14 padding phrases (`due to the fact that`, `in order to`, `in terms of`, `a wide range of`) | `info` / `3` | lexicon lookup | `rules.mjs:72`; `lexical.mjs:90-93`; `lexicons.mjs:89-94` |
| `weasel-attribution` | lexical | en | 18 unsourced-authority phrases (`studies show`, `experts say`, `it is believed that`) | `advisory` / `3` | lexicon lookup (`{min: 1}`) | `rules.mjs:77`; `lexical.mjs:95-98`; `lexicons.mjs:97-103` |
| `copula-avoidance` | lexical | en | 12 inflated copulas (`serves as`, `stands as`, `represents a`, `features a`); needs 2+ | `advisory` / `2` | lexicon lookup + gate | `rules.mjs:82`; `lexical.mjs:100-103`; `lexicons.mjs:106-111` |
| `chatbot-closer` | lexical | en | 20 assistant-register phrases (`i hope this helps`, `feel free to`, `you're absolutely right`) | `warning` / `4` | lexicon lookup | `rules.mjs:87`; `lexical.mjs:105-108`; `lexicons.mjs:114-123` |
| `rlhf-artifacts` | lexical | en | 14 instruction-tuning voice phrases (`on one hand`, `while i understand`, `as of my training`); needs 2+ | `warning` / `5` | lexicon lookup + gate | `rules.mjs:92`; `lexical.mjs:110-113`; `lexicons.mjs:264-273` |
| `reasoning-chain-leak` | lexical | en | 14 chain-of-thought artifacts (`let me think`, `step 1:`, `breaking this down`) | `warning` / `5` | lexicon lookup | `rules.mjs:97`; `lexical.mjs:115-118`; `lexicons.mjs:276-282` |
| `acknowledgment-loop` | lexical | en | 8 question-parroting phrases (`you're asking about`, `great observation`) | `warning` / `4` | lexicon lookup | `rules.mjs:102`; `lexical.mjs:120-123`; `lexicons.mjs:285-291` |
| `conclusion-fluff` | lexical | en | 15 weightless closers (`the future looks bright`, `the possibilities are endless`) | `info` / `3` | lexicon lookup | `rules.mjs:107`; `lexical.mjs:125-128`; `lexicons.mjs:126-132` |
| `business-jargon` | lexical | en | 20 LinkedIn/business phrases (`thought leadership`, `move the needle`, `low-hanging fruit`); modes marketing/both only | `info` / `3` | lexicon lookup | `rules.mjs:112`; `lexical.mjs:130-133`; `lexicons.mjs:135-143` |
| `plays-a-role` | lexical | en | The template `plays a crucial\|vital\|pivotal\|key\|significant\|central\|important role` | `info` / `3` | single regex | `rules.mjs:117`; `lexical.mjs:135-143` |
| `ing-trailers` | cadence | en | Trailing `, -ing` clauses over a fixed 20-verb list (`highlighting`, `underscoring`, `ensuring`, …); needs 2+ | `info` / `3` | single regex + count gate | `rules.mjs:122`; `lexical.mjs:145-153` |
| `llm-artifact-leak` | formatting | language-neutral | 18 raw model artifacts: `citeturn\d`, `oaicite`, `oai_citation`, `contentReference`, `attributableIndex`, `turn0search\d`, `utm_source=chatgpt.com`, `grok_card`, `grok_render_citation_card_json`, `[cite: N]`, `ppl-ai-file-upload`, `attached_file`, `:::writing`, `[Your Name]`, `[insert …]`, `[Xxx name]` | `warning` / `12` (highest weight in the registry) | single regex over `ctx.raw` | `rules.mjs:127`; `lexical.mjs:155-163` |
| `smart-punctuation-leak` | formatting | language-neutral | Zero-width characters (U+200B/200C/200D/200E/FEFF) or curly quotes/dashes mixed with straight quotes | `advisory` / `2` | character test + curly-vs-straight count comparison | `rules.mjs:132`; `lexical.mjs:165-174` |
| `bold-label-list` | formatting | language-neutral (Markdown) | ≥2 bullets of the form `- **Label:**` | `info` / `3` | regex `/^\s*[-*]\s*\*\*[^*\n]+:\*\*/gm` + gate | `rules.mjs:137`; `lexical.mjs:176-182` |
| `excessive-structure` | formatting | language-neutral (Markdown) | Headers + bullets + numbered items ≥ 3 per 100 words, only for texts ≥200 words | `info` / `3` | 3 regexes + density rate, emitted by the stylometry engine | `rules.mjs:143`; `stylometry.mjs:76-86` |
| `false-agency` | lexical | en | `the <inanimate-noun> <human-verb>` over 22 nouns × 22 verbs (`the data tells us`, `the decision emerges`); needs 2+ | `warning` / `4` | regex composed at runtime from the two lexicons | `rules.mjs:150`; `lexical.mjs:287-295`; `lexicons.mjs:199-208` |
| `rhetorical-setup` | cadence | en | 10 insight-announcing phrases (`what if i told you`, `think about it`, `buckle up`) | `warning` / `4` | lexicon lookup | `rules.mjs:155`; `lexical.mjs:264-267`; `lexicons.mjs:171-175` |
| `negative-listing` | cadence | en | `Not X… Not Y…` twice or more; `It wasn't X… It wasn't Y…` twice or more | `warning` / `5` | 2 regexes with `{2,}` repetition | `rules.mjs:160`; `lexical.mjs:319-331` |
| `vague-declarative` | lexical | en | Regex `the <reasons\|implications\|stakes\|…> is/are <significant\|structural\|profound\|…>` plus 13 lexicon phrases; min 1 | `info` / `3` | regex + lexicon, counts summed | `rules.mjs:165`; `lexical.mjs:274-285`; `lexicons.mjs:187-195` |
| `meta-commentary` | lexical | en | 15 self-referential asides (`the rest of this essay`, `walk you through`, `plot twist:`) | `info` / `3` | lexicon lookup | `rules.mjs:170`; `lexical.mjs:259-262`; `lexicons.mjs:161-168` |
| `emphasis-crutch` | lexical | en | 14 manufactured-weight phrases (`let that sink in`, `make no mistake`, `full stop.`, `i promise`) | `info` / `3` | lexicon lookup | `rules.mjs:175`; `lexical.mjs:269-272`; `lexicons.mjs:178-184` |
| `dramatic-fragmentation` | cadence | en | `That's it. That's the/it/all/what…`; `X. And y. And z.` | `info` / `3` | 2 regexes | `rules.mjs:180`; `lexical.mjs:333-345` |
| `adverb-filler` | lexical | en | 17 empty intensifiers (`really`, `just`, `simply`, `actually`, `fundamentally`); needs 4+ hits AND `>= 0.8` per 100 words | `advisory` / `2` | lexicon lookup + double density gate | `rules.mjs:185`; `lexical.mjs:240-248`; `lexicons.mjs:147-152` |
| `lazy-extremes` | lexical | en | 11 sweeping absolutes (`everyone`, `always`, `never`, `each and every`); needs 4+ | `advisory` / `2` | lexicon lookup + count gate | `rules.mjs:190`; `lexical.mjs:250-257`; `lexicons.mjs:155-158` |
| `passive-voice` | stylometry (declared) / lexical (engine) | en | be-verb + 33 curated participles (`was created`, `is believed`, `were made`); needs 3+ AND `>= 1` per 120 words | `advisory` / `2` | regex + double density gate | `rules.mjs:195`; `lexical.mjs:297-306` |
| `wh-opener` | cadence | en | Non-question sentences starting What/When/Where/Which/Who/Why/How; needs ≥6 sentences, 3+ hits AND `>= 18%` of sentences | `advisory` / `2` | regex per sentence + ratio gate | `rules.mjs:200`; `lexical.mjs:308-317` |
| `uniform-rhythm` | stylometry | en | Low sentence-length variance: `sentLenCV < 0.35` with ≥6 sentences | `info` / `5` | statistical coefficient of variation | `rules.mjs:207`; `stylometry.mjs:43-48`, features `stylometry.mjs:18-40` |
| `low-lexical-diversity` | stylometry | en | Type-token ratio below a length-adjusted threshold: `<500w → 0.42`, `<2000w → 0.32`, `<5000w → 0.24`, `<10000w → 0.19`, else `0.15`; only for ≥120 words | `info` / `4` | statistical TTR | `rules.mjs:212`; `stylometry.mjs:50-61` |
| `comma-splice-rhythm` | stylometry | en | Commas per sentence `>= 2.2` with ≥5 sentences | `advisory` / `3` | statistical density | `rules.mjs:217`; `stylometry.mjs:63-67` |
| `paragraph-uniformity` | stylometry | en | Paragraph-length CV `< 0.25` with ≥4 paragraphs | `advisory` / `3` | statistical CV | `rules.mjs:222`; `stylometry.mjs:69-74` |
| `contraction-absence` | stylometry | en | Contraction rate `<= 0.3` per 100 words over ≥180 words | `advisory` / `2` | regex count ÷ word count | `rules.mjs:227`; `stylometry.mjs:105-112` |
| `gpt-tics` | lexical | en | 17 GPT phrasings (`rich tapestry`, `plays a crucial role`, `sure! here`, `characterized by`); **gated `gpt`** | `advisory` / `4` | lexicon lookup + provider gate | `rules.mjs:234`; `lexical.mjs:65-68`; `lexicons.mjs:227-234` |
| `claude-tics` | lexical | en | 20 Claude phrasings (`i'll help you`, `let me`, `great question`, `load-bearing`, `carry the argument`); **gated `claude`** | `advisory` / `4` | lexicon lookup + provider gate | `rules.mjs:239`; `lexical.mjs:70-73`; `lexicons.mjs:236-244` |
| `gemini-tics` | lexical | en | 9 Gemini phrasings (`paving the way`, `a symphony of`, `the cascade of`); **gated `gemini`** | `advisory` / `4` | lexicon lookup + provider gate | `rules.mjs:244`; `lexical.mjs:75-78`; `lexicons.mjs:246-250` |
| `grok-tics` | lexical | en | 6 Grok tics (`causal`, `empirical`, `correlate`, `grok_card`, `grok_render_citation_card_json`); **gated `grok`** | `advisory` / `4` | lexicon lookup (word-boundary) + provider gate | `rules.mjs:249`; `lexical.mjs:80-83`; `lexicons.mjs:253-256` |
| `deepseek-tics` | lexical | language-neutral (Unicode glyphs) | 4 DeepSeek markup glyphs `⟨`, `⟩`, `†`, `‡`; **gated `deepseek`** | `advisory` / `4` | lexicon lookup + provider gate | `rules.mjs:254`; `lexical.mjs:85-88`; `lexicons.mjs:259-261` |

Rule-count cross-check: `README.md:226-227` states the quick sanity check is `grep -c "id:" scripts/registry/rules.mjs` and that "current is **40 rules**" — that number is **stale**; the actual count at this commit is 46 (corroborated by commit `a265dc0` "Upgrade to 46 rules"). `README.md:4` likewise says "a 40-rule registry".

Additional non-rule definitions present but **not** in the registry: detector `sentence-spread` (`stylometry.mjs:88-103`), unreachable; and the `JARGON_SWAPS` rewrite table (`lexicons.mjs:212-224`), which is guidance data, not a scored rule.

Lexicon totals (26 arrays, **524 entries, 512 unique**): `BANNED_VOCAB` 98, `AI_OPENERS` 53, `BUZZWORDS` 46, `FALSE_AGENCY_NOUNS` 22, `FALSE_AGENCY_VERBS` 22, `CHATBOT_CLOSERS` 20, `BUSINESS_JARGON` 20, `CLAUDE_TICS` 20, `ADVERB_FILLER` 17, `GPT_TICS` 17, `CONCLUSION_FLUFF` 15, `META_COMMENTARY` 15, `EMPHASIS_CRUTCH` 14, `REASONING_CHAIN` 14, `RLHF_ARTIFACTS` 14, `VAGUE_DECLARATIVE` 13, `HEDGES` 12, `COPULA_AVOID` 12, `LAZY_EXTREMES` 11, `RHETORICAL_SETUP` 10, `GEMINI_TICS` 9, `ACKNOWLEDGMENT_LOOP` 8, `GROK_TICS` 6, `DEEPSEEK_TICS` 4, `WORDY_CONNECTIVES` 14, `WEASEL_ATTRIBUTION` 18 (`lexicons.mjs:14-291`).

## 5. Detectors and algorithms

There are exactly **two executable engines** plus an orchestrator, and one host hook.

### 5.1 Lexical engine — `runLexical(ctx, active)` (`lexical.mjs:348-356`)

- **Input**: `ctx = { raw, text, wordCount, sentences, mode }` (`humanize-detect.mjs:41`), where `text` is HTML/Markdown-stripped prose produced by `toText()` (`shared/text.mjs:6-20`) and `sentences` by `splitSentences()` (`text.mjs:22-28`, splits on `(?<=[.!?])\s+(?=[A-Z("“'])`, keeps fragments of ≥3 words).
- **Output**: array of finding objects `{ id, severity, message, line, sample, count }` (`text.mjs:39-41`).
- **Dispatch**: iterates the `active` id list and calls `DETECTORS[id]`; each detector is wrapped in `try/catch` so one rule can never crash a run (`lexical.mjs:348-356`). Unregistered ids are silently skipped (`if (!fn) continue;`).
- **40 detectors** are registered (keys listed in §4). Two implementation families:
  1. `phraseFinding()` (`lexical.mjs:21-28`) — shared helper: `countPhrases()` over a lexicon, optional `{min}` gate, deduplicated sample of the matched phrases, first-hit line via `lineOf(raw, index)`, and `count` = total hits.
  2. Hand-written detectors with bespoke regexes and thresholds: `em-dash-overuse`, `plays-a-role`, `ing-trailers`, `llm-artifact-leak`, `smart-punctuation-leak`, `bold-label-list`, `aphoristic-cadence`, `rule-of-three`, `numbered-section-markers`, `exclamation-spam`, `emoji-decoration`, `adverb-filler`, `lazy-extremes`, `vague-declarative`, `false-agency`, `passive-voice`, `wh-opener`, `negative-listing`, `dramatic-fragmentation`.
- **Matching primitive**: `countPhrases(text, phrases, {wordBoundary})` (`text.mjs:56-69`) — lowercases the text, does `indexOf` per phrase, applies `isWordBoundary()` (`text.mjs:48-53`) when requested, and returns hits sorted by index. Note it is **substring** matching, so phrase entries such as `delves`, `leveraging`, `showcasing` exist to cover inflections manually. `isWordBoundary` treats a phrase as boundary-safe if the following char is whitespace or the phrase itself contains a space — a loose check that permits matches before punctuation-adjacent letters in ambiguous cases.
- **Feature list / thresholds**: hit-count gates (`hedging` ≥2, `adverb-filler` ≥4 and ≥0.8/100w, `lazy-extremes` ≥4, `passive-voice` ≥3 and ≥1/120w, `rule-of-three` ≥3, `ing-trailers` ≥2, `false-agency` ≥2, `copula-avoidance` ≥2, `rlhf-artifacts` ≥2, `aphoristic-cadence` ≥2, `emoji-decoration` ≥3, `exclamation-spam` ≥3 and ≥1/200w, `numbered-section-markers` ≥3 distinct and ≥2 sequential, `bold-label-list` ≥2, `wh-opener` ≥3 and ≥18%, `em-dash-overuse` ≥4 or ≥1/150w).
- **External model/API dependency**: none. Imports are limited to `../shared/text.mjs` and `../lexicons.mjs` (`lexical.mjs:10-19`).
- **Offline**: yes, fully.

### 5.2 Stylometry engine — `features(ctx)` + `runStylometry(ctx, active, f)` (`stylometry.mjs:18-126`)

- **Input**: the same `ctx`.
- **Output**: `features()` returns an 11-field object (`stylometry.mjs:27-39`): `sentenceCount`, `contractionRate` (per 100 words), `sentLenMean`, `sentLenCV`, `sentLenMin`, `sentLenMax`, `typeTokenRatio`, `wordCount`, `commasPerSentence`, `paragraphCount`, `paraLenCV`. `runStylometry` returns findings in the same shape as the lexical engine.
- **Exact feature definitions**: sentences split as above; sentence length = `s.split(/\s+/).filter(Boolean).length` (`stylometry.mjs:20`); words = `text.toLowerCase().match(/[a-z][a-z'-]+/g)` (`stylometry.mjs:21`) — so **numbers and non-Latin words are excluded from `wordCount` and TTR**; types = `new Set(words)`; paragraphs via `splitParagraphs()` (blank-line separated, ≥8 words each, `text.mjs:30-32`); commas = count of `,`; contractions = `/\b\w+['’](?:re|ve|ll|d|s|t|m)\b|\bn['’]t\b/gi` (`stylometry.mjs:26`); `cv(xs) = stdev/mean` with `stdev` the population standard deviation (`stylometry.mjs:13-15`).
- **7 detectors**, 6 of them registered: `uniform-rhythm` (CV<0.35, ≥6 sentences), `low-lexical-diversity` (5-step TTR threshold ladder), `comma-splice-rhythm` (≥2.2 commas/sentence, ≥5 sentences), `paragraph-uniformity` (paraLenCV<0.25, ≥4 paragraphs), `excessive-structure` (≥3 structural markers/100 words, ≥200 words), `contraction-absence` (≤0.3 per 100 words, ≥180 words), plus the **unregistered** `sentence-spread` (≥8 sentences; flags spread <20 words or >2 runs of 3 same-length sentences).
- **External model/API dependency**: none; imports only `../shared/text.mjs` (`stylometry.mjs:11`).
- **Offline**: yes, fully. There is no perplexity/LLM scoring anywhere in the repo.

### 5.3 Orchestrator — `analyze(raw, mode, providers)` (`humanize-detect.mjs:37-55`)

Inputs: raw document text, mode string (invalid values coerced to `'both'`), provider list. Output: `{ findings, slop, verdict, wordCount, features, mode }`. Findings are sorted by line then rule id (`humanize-detect.mjs:52`). Also provides the CLI, stdin support, `--features`, `--trend`, `--json`, and exit code `2` whenever `total > 0` findings (`humanize-detect.mjs:110`, `humanize-detect.mjs:131`).

### 5.4 Hook — `scripts/hook.mjs`

Input: Claude Code `PostToolUse` JSON on stdin (`hook.mjs:52`); reads `tool_input.file_path` (or `.path`), filters by extension (default `md,mdx,txt,html,htm`), **skips any path matching `/ai-humanizer/i`** so the skill never self-flags (`hook.mjs:57-64`), picks mode from env or by extension (`hook.mjs:69-70`), and emits `hookSpecificOutput.additionalContext` when `slop >= AIHUMANIZER_THRESHOLD` (default 12) (`hook.mjs:71`, `hook.mjs:77-92`). It always exits 0 (never blocks).

### 5.5 Detector-reachability defect

`parseArgs` recognizes only `--json`, `--stdin`, `--features`, `--trend`, `--gpt`, `--claude`, `--gemini`, `--mode` (`humanize-detect.mjs:61-73`). Consequences:

- `grok-tics` and `deepseek-tics` are declared, implemented and documented (`SKILL.md:60`, `references/banned-words.md:212`) but **cannot be enabled from the CLI** — there is no `--grok` / `--deepseek` flag anywhere in the runner. They are only reachable by calling `analyze()` programmatically with `providers: ['grok'|'deepseek']`.
- `--grok` / `--deepseek` are not rejected as unknown flags: they fall through to `out.files.push(a)` (`humanize-detect.mjs:72`) and are treated as **input filenames**, producing an error row.
- `README.md:113-114` lists the flags as `--gpt|--claude|--gemini` only, while `SKILL.md:60` lists five; the docs disagree with each other and with the code.

## 6. Scoring

Scoring is centralized in `scripts/registry/rules.mjs`. Three functions matter.

**Weight resolution** (`rules.mjs:266-270`):

```js
function weightFor(rule, mode) {
  if (!rule) return 3;
  const w = rule.weight;
  return typeof w === 'object' ? (w[mode] ?? w.default ?? 3) : (w ?? 3);
}
```

Only one rule uses the object form: `marketing-buzzword` with `weight: { default: 4, marketing: 8 }` (`rules.mjs:38`). Unknown rules default to weight **3**.

**Aggregation** (`rules.mjs:294-312`), quoted in full:

```js
/** Slop score 0–100 + verdict. Weight scaled by hit volume with diminishing
 *  returns so one noisy rule can't pin the score on its own. */
function score(findings, mode = 'both') {
  let raw = 0;
  for (const f of findings) {
    const rule = getRule(f.id);
    const w = weightFor(rule, mode);
    const mult = Math.min(3, 1 + Math.log2(Math.max(1, f.count || 1)));
    raw += w * mult;
  }
  const slop = Math.min(100, Math.round(raw));
  let verdict;
  if (slop === 0) verdict = 'Human';
  else if (slop <= 10) verdict = 'Likely human';
  else if (slop <= 25) verdict = 'Mixed';
  else if (slop <= 45) verdict = 'Likely AI';
  else verdict = 'AI slop';
  return { slop, verdict };
}
```

So the exact formula is:

```
raw  = Σ_rules  weightFor(rule, mode) × min(3, 1 + log2(max(1, count)))
slop = min(100, round(raw))
```

**Weight table** (exact declared values; see §4 for the per-rule mapping): 12 → `llm-artifact-leak`; 6 → `em-dash-overuse`; 5 → `ai-openers`, `aphoristic-cadence`, `rlhf-artifacts`, `reasoning-chain-leak`, `negative-listing`, `uniform-rhythm`; 4 → `banned-vocab`, `chatbot-closer`, `acknowledgment-loop`, `false-agency`, `rhetorical-setup`, `low-lexical-diversity`, `marketing-buzzword` (default), and all five `*-tics` rules; 3 → `hedging`, `rule-of-three`, `numbered-section-markers`, `emoji-decoration`, `wordy-connectives`, `weasel-attribution`, `conclusion-fluff`, `business-jargon`, `plays-a-role`, `ing-trailers`, `bold-label-list`, `excessive-structure`, `vague-declarative`, `meta-commentary`, `emphasis-crutch`, `dramatic-fragmentation`, `comma-splice-rhythm`, `paragraph-uniformity`; 2 → `exclamation-spam`, `copula-avoidance`, `smart-punctuation-leak`, `adverb-filler`, `lazy-extremes`, `passive-voice`, `wh-opener`, `contraction-absence`; 8 in marketing mode only → `marketing-buzzword`.

**Score meaning** (`rules.mjs:305-310`): `0` = `Human`; `1–10` = `Likely human`; `11–25` = `Mixed`; `26–45` = `Likely AI`; `46–100` = `AI slop`. The README documents the scale as "Output: a `slop 0–100` score + verdict (Human → Likely human → Mixed → Likely AI → AI slop)" (`README.md:53-54`) and gives two anchors: "sloppy marketing sample → 68/100 AI slop", "genuine human prose → 0/100 Human" (`README.md:57-58`).

**Properties of the formula (verified from code)**:

- It is an **unnormalized additive sum**, so score scales with document length and with the number of distinct rules triggered; there is no per-100-word normalization anywhere in `score()`.
- Diminishing returns are capped at `mult = 3`, reached at `count = 4` (`log2(4)=2`), so repeated hits beyond 4 add nothing.
- Findings emitted without a `count` get `count = 1` → `mult = 1` (see `finding()` default `count: count || 1`, `text.mjs:40`); e.g. `numbered-section-markers` (`lexical.mjs:219`), `smart-punctuation-leak` (`lexical.mjs:173`), `uniform-rhythm` (`stylometry.mjs:47`), `comma-splice-rhythm` (`stylometry.mjs:66`), `paragraph-uniformity` (`stylometry.mjs:73`), `contraction-absence` (`stylometry.mjs:111`).
- A rule that fires contributes its weight **regardless of severity**; severity is display-only (`humanize-detect.mjs:123`), never used in scoring.
- Exit code is **not** score-based: exit `2` means "at least one finding", so a document scoring `2/100 Human`-adjacent but with one advisory hit still exits `2` (`humanize-detect.mjs:131`).

The portable markdown file re-implements the same formula in Python with a reduced rule set (`portable/ai-humanizer.md:117-159`), including the identical `if n: ... pts += w*min(3, 1+math.log2(max(1,n)))` and the identical verdict bands.

## 7. Voice / stylometry / personal-style capability

**Personal-style / author-voice capability: none found.** There is nothing in the repo that models, learns, stores or compares against an individual author's voice. Specifically:

- No voice profile schema, no reference corpus, no per-author feature vector, no enrollment step, no author-similarity metric. Grep of the tree for a voice/profile concept returns only the *grammatical* voice rules (`passive-voice`, `false-agency`) and prose advice.
- The stylometry engine computes features of **the input document only** and compares them against **fixed global thresholds** (`sentLenCV < 0.35`, TTR ladder, `commasPerSentence >= 2.2`, `paraLenCV < 0.25`, `contractionRate <= 0.3`) — never against a target-author baseline (`stylometry.mjs:43-112`).
- `scripts/storage.mjs` persists history per *file slug*, not per author or persona: `record(slug, {slop, verdict, mode, wordCount, ts})` appended to `<cwd>/.ai-humanizer/scores/<slug>.jsonl` (`storage.mjs:17`, `storage.mjs:30-46`), read back by `trend(slug, n)` (`storage.mjs:39-46`). This is a before/after score trend, not voice data.
- The only "voice" concept is the qualitative 1–10 rubric with dimensions **Directness, Rhythm, Trust, Authenticity, Density** (`SKILL.md:106-117`, `portable/ai-humanizer.md:57-66`) — a self-assessment checklist with no executable implementation.
- The repo's own framing confirms this: it positions itself as a "style/slop scorer" (`README.md:8-10`) and explicitly disclaims provenance/identity inference (`SKILL.md:132-147`).

What *does* exist that is adjacent to stylometry is document-level distributional measurement (§5.2) and provider-tic fingerprinting (the five gated `*-tics` rules), which is model attribution rather than personal style.

## 8. Pipeline and rewrite workflow

The pipeline is a skill-driven workflow over three commands, each with its own reference file (`SKILL.md:13-19`):

| Command | Reference | Behavior |
|---|---|---|
| `humanize [target]` | `references/humanize.md` | detect → triage → rewrite → re-detect, default command |
| `check [target]` | `references/check.md` | read-only forensic score + per-line evidence, no rewrite |
| `audit [target]` | `references/audit.md` | batch scan a dir/glob, rank worst offenders, CI gate |

Routing rules (`SKILL.md:21-31`): (1) first word matches a command → load that reference, remainder is the target; (2) first word doesn't match but intent is clear → route by intent ("make this sound human" → `humanize`; "is this AI?" → `check`; "scan all my docs" → `audit`); (3) no target, just pasted text → run `check`, then offer `humanize`.

The `humanize` flow in full (`references/humanize.md:6-27`):
1. resolve target and mode (`prose` default, `marketing` for `.html`);
2. detect baseline with `--features --trend <file>`;
3. triage each finding (real tell → fix; contextual false positive → keep and say why);
4. rewrite using the 14 levers (`SKILL.md:70-104`) and the `JARGON_SWAPS` table;
5. re-detect with `--trend` and report movement, e.g. `slop 63 → 8, AI slop → Likely human`;
6. apply the 1–10 rubric.

Guardrails stated in the workflow: edit files in place with a diff-style summary (`humanize.md:31`); never strip every em-dash to zero or flatten everything to staccato (`humanize.md:32-33`); if the score cannot drop below "Mixed" without distorting meaning, stop and say so (`humanize.md:34-35`). The triage discipline is repeated in `SKILL.md:119-124` ("not every match is a defect") and `portable/ai-humanizer.md:68-72`.

The executable side of the pipeline is the CLI (`humanize-detect.mjs:84-132`) and, optionally, the auto-scan hook (`hook.mjs`), which runs after every `Write|Edit` and injects a findings summary plus an instruction to "Apply the rewrite levers in ai-humanizer/SKILL.md" and re-run the detector to confirm the score dropped (`hook.mjs:86-92`).

The `audit` flow adds corpus-level aggregation as *instructions to the model*, not code: rank a table by score, name the most common rule across the corpus, report totals, and recommend the top 2–3 files for a `humanize` pass (`audit.md:15-19`). No batching/aggregation code exists in the repo.

## 9. Reusable modules

Integration kind vocabulary: **A** = executable detector (adapter), **B** = markdown skill (needs parsing into rules), **C** = voice profile (abstract to unified voice interface), **D** = methodology (pipeline strategy, do NOT put in default execution path), **E** = research-only (do not copy).

| module (file) | what it does | reuse recommendation | integration kind |
|---|---|---|---|
| `scripts/registry/rules.mjs` | 46-rule metadata table (id/category/engine/severity/modes/weight/gated) plus `getRule`, `weightFor`, `activeRuleIds`, `filterByProviders`, `score`, `GATED_PROVIDERS` | **Take.** This is the cleanest asset in the repo: a declarative rule registry with mode/provider gating and a documented scoring hook. Port the schema 1:1 into TypeScript; keep the exact weight numbers as data. Replace the scorer (§6) with a length-normalized one before shipping. | A |
| `scripts/engines/lexical.mjs` | 40 regex/lexicon detectors keyed by rule id, with per-rule thresholds and `phraseFinding()` helper | **Take.** Highest-value executable artifact. Wrap `DETECTORS` in an adapter that maps each detector to a unified `Detector` interface (`ctx -> Finding[]`). Preserve thresholds exactly; they are tuned per rule. | A |
| `scripts/engines/stylometry.mjs` | `features()` (11 distributional features) + 6 registered statistical detectors (+1 orphan `sentence-spread`) | **Take the features, review the thresholds.** `features()` is the reusable core and is independent of English lexicons. Copy `sentence-spread` only after registering it and setting a weight; its thresholds are already documented in `references/banned-words.md:231-232`. | A |
| `scripts/lexicons.mjs` | 524 phrase entries in 26 arrays, incl. 5 provider tic lists and the 22×22 false-agency noun/verb lists | **Take as data**, after de-duplicating the 12 entries that appear in two arrays (see §12) so a document is not double-charged. Keep entries lowercase; respect the file's own guidance to prefer multi-word phrases (`references/banned-words.md:244-250`). | A |
| `scripts/shared/text.mjs` | HTML/Markdown→prose stripper preserving newlines for line numbers, sentence/paragraph splitters, `lineOf`, `finding`, `sampleAround`, `isWordBoundary`, `countPhrases` | **Take.** Small, dependency-free, and the line-number-preserving strip is what makes per-line evidence possible. Harden `isWordBoundary` (its trailing-boundary logic is loose) and consider changing `splitParagraphs`' ≥8-word filter. | A |
| `scripts/humanize-detect.mjs` | `analyze()` orchestrator + CLI (multi-file, `--stdin`, `--mode`, `--json`, `--features`, `--trend`, exit 2 on findings) | **Take `analyze()`; re-implement the CLI.** `analyze()` is a clean single entry point. The CLI's flag parser is defective for `--grok`/`--deepseek` (§5.5) — do not copy it verbatim. | A |
| `scripts/hook.mjs` | Claude Code `PostToolUse` hook emitting `additionalContext` when `slop >= threshold` | **Take as an optional adapter, not core.** Host-specific (Claude Code hook JSON). Also contains a useful pattern worth keeping: the self-skip guard `/ai-humanizer/i.test(filePath)` that prevents the detector from flagging its own rule documentation (`hook.mjs:62-64`). | A |
| `scripts/storage.mjs` | `slugify`/`record`/`trend`; per-target JSONL under `.ai-humanizer/scores/` | **Take only the idea.** It writes to disk at runtime and uses `process.cwd()` (`storage.mjs:17`); wrap behind a storage interface with an injectable root so a host project can sandbox it. `slugify` (80-char, path-safe) is directly reusable. | A |
| `SKILL.md` | Skill manifest + the 14 rewrite levers + the 1–10 rubric + triage policy | **Take the levers and triage policy as rule content.** Needs parsing into structured rules for any non-LLM consumer; the levers map unevenly onto the 46 code rules (several levers have no single rule and vice versa). | B |
| `references/humanize.md`, `references/check.md`, `references/audit.md` | One workflow per command (detect→rewrite→re-detect; read-only report; batch ranking) | **Take selectively.** `check.md`'s report shape (verdict, stylometry line, per-finding evidence, top-3 fixes) is a good output contract for the new project. `audit.md`'s corpus aggregation exists only as prose and must be implemented. | B (+ D for the audit/ranking strategy) |
| `references/banned-words.md` | Human-readable lexicon documentation with rationale and swap tables | **Take as the rule-rationale source**, but note it has drifted from the code (it claims lists live in `humanize-detect.mjs`, `banned-words.md:4`; it lists Grok reversal constructions not in code, `banned-words.md:221`; and it prints `〔〕` where the code has `⟨⟩`, `banned-words.md:223` vs `lexicons.mjs:260`). Regenerate from data rather than copying. | B |
| `portable/ai-humanizer.md` | Self-contained English skill + an **embedded Python re-implementation** of a reduced scorer | **Do not use as a code source.** It is a partial, divergent duplicate of the Node detector (reduced to ~25 checks, different lexicon contents, same formula). Useful only as a portability template. | B (+ E for the embedded scorer) |
| `README.md` (architecture + Credits sections) | Install/usage docs, the architecture contract, and the provenance list of upstream inspirations | Interface/documentation reference for the module map; the Credits list is the key provenance artifact (§11). Not code. | E |
| `LICENSE` + `.gitignore` | MIT text (only judetelan's copyright); `.gitignore` ignores `.ai-humanizer/`, `.impeccable/`, `node_modules/` | Legal/context only — see §11 for the attribution gap that must be resolved before reuse. | E |

## 10. Tests, CI, packaging, runtime requirements

- **Tests: none found.** There is no test file, no test directory, no test runner config, and no `test` script anywhere in the tree (17 files total, enumerated in §3). The 46 rules (40 lexical-engine detectors + 6 stylometry-engine detectors), the scorer and the storage layer are entirely untested, including edge cases such as the regexes' `lastIndex` reuse.
- **CI: none found.** No `.github/` directory, no workflow YAML. The only automation mentioned is the optional Claude Code hook.
- **Packaging: none found.** No `package.json`, no lockfile, no `bin` entry, no published artifact. The `#!/usr/bin/env node` shebang on `humanize-detect.mjs:1` and `hook.mjs:1` implies direct execution only. Distribution is by `git clone` into a skills directory, or by zipping the repo for claude.ai skill upload (`README.md:70-76`, `README.md:139-150`).
- **Runtime requirements**: **Node 18+**, explicitly stated ("Requires **Node 18+** (the detector is plain Node, no `npm install`)", `README.md:78`); ESM (`import`/`export` throughout). Zero third-party dependencies — the only imports are Node built-ins `node:fs`, `node:url`, `node:path` (`humanize-detect.mjs:25-31`, `storage.mjs:14-15`, `hook.mjs:32-35`). Node 18+ is required specifically because `readFileSync(0)` stdin reads and `??`/`?.` and `String.replaceAll`-era features are used; `Object.hasOwn`-class features are not.
- **Install-shape constraint**: the directory name must be `ai-humanizer`, because Claude Code derives the skill name from the folder (`README.md:67-68`).
- **Host requirements**: for the skill path, Claude Code (or claude.ai / Claude Desktop with **Code execution** on a paid plan, `README.md:131-135`); for the portable path, an LLM host with a Python code tool (`portable/ai-humanizer.md:3-5`).
- **Runtime side effects**: `--trend` writes `<cwd>/.ai-humanizer/scores/<slug>.jsonl` (`storage.mjs:17`, `storage.mjs:30-37`); this directory is gitignored (`.gitignore:2`). `AIHUMANIZER_TS` env var can stamp entries (`humanize-detect.mjs:104`); `AIHUMANIZER_THRESHOLD` / `AIHUMANIZER_MODE` / `AIHUMANIZER_EXTS` tune the hook (`hook.mjs:27-29`, `hook.mjs:57-71`).
- **CLI exit codes**: `0` clean (zero findings), `2` any finding, `1` usage error when no input is provided (`humanize-detect.mjs:94-97`, `humanize-detect.mjs:131`).

## 11. License and provenance

**Declared license (verbatim):** `LICENSE:1-3` = `MIT License`, `Copyright (c) 2026 judetelan`. `README.md:282-284` says "MIT — see [LICENSE](LICENSE)." No other license file, no third-party notices file, no `NOTICE`, no per-file license headers.

**Declared derivations and attributions, as literally written:**

- Architecture: "Built with [impeccable](https://github.com/)'s detector architecture as the blueprint." (`README.md:286`). In-code echoes: `rules.mjs:4` "(mirrors impeccable's antipatterns.mjs)", `rules.mjs:8` "Mirrors impeccable's multi-engine detector", `stylometry.mjs:4-5` "impeccable added a browser engine beyond regex; this adds statistical stylometry beyond phrase-matching", `humanize-detect.mjs:6-8` "Mirrors impeccable's multi-engine detector", `storage.mjs:5-6` "(mirrors impeccable's critique-storage trend)", `hook.mjs:6-7` "(the same loop the impeccable design skill uses for UI files)", `SKILL.md:8-11` "The prose counterpart to the `impeccable` design skill", `.gitignore:3` ignores `.impeccable/`. **The cited URL is `https://github.com/` — a bare GitHub root with no repository path**, so the upstream project is unidentifiable from the repo alone and its license is unknown.
- Editorial tells: `README.md:290-294` — "Editorial tells (passive voice, false agency, empty adverbs, vague declaratives, meta-commentary, rhetorical setups, negative listing, lazy extremes, and the 1-10 human-judgment rubric) were absorbed from [stop-slop](https://github.com/hardikpandya/stop-slop) by Hardik Pandya (MIT), including the March 2026 additions (narrator-from-a-distance, telling-not-showing, performative emphasis, absolute adverb bans)."
- Research basis: `README.md:296-300` — "RLHF instruction-tuning voice detection is informed by [arXiv 2605.19516] … (May 2026)".
- Further word lists/patterns: `README.md:302-309` credits `harshaneel/humanize` (Signal I checklist, sentence-length spread, RLHF phrases), `MohamedAbdallah-14/unslop` (copula expansion, promotional register, outline-conclusion patterns), `brandonwise/humanizer` (reasoning chain leaks, excessive structure, acknowledgment loops, confidence calibration, "500+ vocabulary terms"), `petergyang/no-ai-slop` (faux-insight setups, metadiscourse patterns), `jalaalrd/anti-ai-slop-writing` (cadence uniformity research), `shannhk/avoid-slop` (curated anti-slop directory), and Wikipedia's "Signs of AI writing".
- In-code attribution markers: `lexicons.mjs:8-10` ("Sources for the expanded lists: anti-ai-slop-writing, harshaneel/humanize, shannhk/avoid-slop, MohamedAbdallah-14/unslop, brandonwise/humanizer, hardikpandya/stop-slop, and Wikipedia 'Signs of AI writing'"), `lexicons.mjs:33`, `:49`, `:53`, `:56`, `:109`, `:121`, `:141`, `:150`, `:182`, `:192`, `:232`, `:241`, `:252`, `:258`, `:263`, `:275`, `:284`; section comment "── Absorbed from stop-slop (editorial tells) ───" at `rules.mjs:148` and `lexical.mjs:238`; `references/banned-words.md:103`, `:136`, `:194` ("stop-slop's replacement table"), `:212`.
- Git history corroborates the direction and dates of absorption: `2af5da2` "Absorb stop-slop editorial tells (29 → 40 rules)" (2026-06-25) and `a265dc0` "Upgrade to 46 rules: RLHF detection, new providers, smarter scoring" (2026-08-22).

**Evidence this repo borrowed from another repo in the inventory list — yes, strong:** `stop-slop` (hardikpandya) is credited by name and its content is reproduced near-verbatim (§12). No evidence was found of the reverse direction: grepping all seven other upstream trees (excluding `.git`, `.png`) for `ai-humanizer`, `ai_humanizer`, `judetelan`, `impeccable` returned **no reference to judetelan/ai-humanizer** anywhere. The only `ai-humanizer` strings outside this repo are inside `lynote-ai/humanize-text` and refer to Lynote's own hosted product, not to this project: `humanize-text/README.md:286` ("[Lynote AI Humanizer](https://lynote.ai/ai-humanizer) — hosted version of this pipeline"), `humanize-text/README-zh.md:281`, `humanize-text/docker-compose.yml:4` (a compose service literally named `ai-humanizer`). That is a **name collision, not provenance**. One further cross-repo provenance fact: the 5-axis / 1–10 rubric this repo labels "absorbed from stop-slop" (`SKILL.md:106`) also appears, independently attributed, in `op7418/Humanizer-zh` (`SKILL.md:442-456`, "参考了 hardikpandya/stop-slop"), which confirms stop-slop as the common ancestor of that instrument rather than transmission between the two skills (§12.3(d)).

**LICENSE / attribution problems identified:**

1. **The MIT notice of borrowed content is not preserved.** `LICENSE` contains only `Copyright (c) 2026 judetelan`. The MIT terms require "The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software" (`LICENSE:12-13`) — and stop-slop's notice is `Copyright (c) 2025 Hardik Pandya` (stop-slop `LICENSE:1-3`). Content absorbed from stop-slop is a substantial portion of the registry and lexicons (11 rules + the rubric + several verbatim phrase lists; see §12), yet Hardik Pandya's copyright and MIT text appear nowhere in the tree — only prose credit in `README.md:290-294` and comments. Prose credit is not the same as including the notice.
2. **Same gap for the other named sources.** `harshaneel/humanize`, `MohamedAbdallah-14/unslop`, `brandonwise/humanizer`, `petergyang/no-ai-slop`, `jalaalrd/anti-ai-slop-writing`, `shannhk/avoid-slop` are credited in prose with no license text, no copyright line and no statement of which specific data came from where. At least `brandonwise/humanizer` is credited with contributing "500+ vocabulary terms", which would be a substantial portion if any were copied.
3. **"impeccable" is unidentifiable and unlicensed.** The architecture is repeatedly declared as derived from it, but the URL is empty (`https://github.com/`) and no license or copyright holder is named, so whether the reuse is permitted cannot be determined from this repo.
4. **Wikipedia content.** Wikipedia's "Signs of AI writing" is CC BY-SA 4.0, not MIT; the repo credits it as one of the sources for word lists and patterns (`README.md:309`, `lexicons.mjs:10`) without any CC BY-SA attribution or share-alike statement. Any verbatim reuse of Wikipedia text would create a copyleft obligation this repo does not acknowledge.
5. **Self-inconsistency of the declared identity.** `README.md:4` and `README.md:226-227` say 40 rules; the code has 46. The README's documented "unfilled placeholders" artifact pattern in `portable/ai-humanizer.md:44` and the code list (`lexical.mjs:156`) do not fully match.

## 12. Overlap and duplication signals

All statements below are grounded in quoted text from both sides; each claim names the file and line.

### 12.1 vs. `hardikpandya/stop-slop` (repo #8) — direct, near-verbatim absorption (strongest duplication in the set)

This is the only relationship the subject repo itself declares, and the wording overlap is extensive and literal. Both are MIT. Concretely:

1. **Rule-level absorption is declared in the registry itself.** `rules.mjs:148` reads `// ── Absorbed from stop-slop (editorial tells) ─────────────────────────────` and the nine rules that follow (`false-agency`, `rhetorical-setup`, `negative-listing`, `vague-declarative`, `meta-commentary`, `emphasis-crutch`, `dramatic-fragmentation`, `adverb-filler`, `lazy-extremes`, plus `passive-voice` and `wh-opener`) are the stop-slop editorial set. The same comment appears at `lexical.mjs:238`.
2. **The jargon swap table is copied row-for-row.** `lexicons.mjs:212-224` `JARGON_SWAPS` = `navigate → handle, address`; `unpack → explain, examine`; `lean into → accept, embrace`; `landscape → situation, field`; `game-changer → significant, important`; `double down → commit, increase`; `deep dive → analysis, examination`; `take a step back → reconsider`; `moving forward → next, from now`; `circle back → return to, revisit`; `on the same page → aligned, agreed`. stop-slop's `references/phrases.md` "Business Jargon" table contains the same eleven rows in the **same order** with the same replacements. ai-humanizer's docs reproduce it again as a table at `references/banned-words.md:196-210`.
3. **The 1–10 rubric is the same five dimensions.** ai-humanizer `SKILL.md:111-117`: **Directness / Rhythm / Trust / Authenticity / Density**, with the questions "Statements, or announcements about statements?", "Varied sentence lengths, or metronomic?", "Does it respect the reader's intelligence (no hand-holding)?", "Does a person sound like they wrote this?", "Anything cuttable without losing meaning?". stop-slop `SKILL.md` "Scoring" table: **Directness / Rhythm / Trust / Authenticity / Density** with "Statements or announcements?", "Varied or metronomic?", "Respects reader intelligence?", "Sounds human?", "Anything cuttable?". Same five axes, same order, near-identical phrasing; stop-slop's threshold "Below 35/50: revise" becomes "below ~7 on any axis, revise" (`SKILL.md:110`).
4. **Vague declaratives copied verbatim as lexicon entries.** `lexicons.mjs:187-195` `VAGUE_DECLARATIVE` contains `'the reasons are structural'`, `'the implications are significant'`, `'the stakes are high'`, `'the consequences are real'`, `'this is the deepest problem'` — identical to stop-slop `references/phrases.md` "Vague Declaratives" ("The reasons are structural", "The implications are significant", "This is the deepest problem", "The stakes are high", "The consequences are real").
5. **Emphasis crutches copied verbatim.** `lexicons.mjs:178-184` `EMPHASIS_CRUTCH` contains `'full stop.'`, `'let that sink in'`, `'make no mistake'`, `'this matters because'`, `"here's why that matters"` — identical to stop-slop phrases.md "Emphasis Crutches" ("Full stop." / "Period.", "Let that sink in.", "This matters because", "Make no mistake", "Here's why that matters"); the March-2026 additions `'i promise'`, `'they exist, i promise'`, `'creeps in'` match stop-slop phrases.md "Performative Emphasis" exactly.
6. **Meta-commentary copied verbatim.** `lexicons.mjs:161-168` contains `'the rest of this essay'`, `'walk you through'`, `'in this section'`, `'as we'll see'`, `'i want to explore'`, `'plot twist:'`, `'spoiler:'`, `'you already know this'`, `"but that's another post"` — all present in stop-slop phrases.md "Meta-Commentary".
7. **Rhetorical setups copied verbatim.** `lexicons.mjs:171-175`: `'what if i told you'`, `"here's what i mean"`, `'think about it'`, `"and that's okay"` — identical to stop-slop structures.md "Rhetorical Setups".
8. **The two negative-listing regexes encode stop-slop's two table rows.** stop-slop structures.md "Negative Listing" gives exactly two patterns: `"Not a X... Not a Y... A Z."` and `"It wasn't X. It wasn't Y. It was Z."`. ai-humanizer's `negative-listing` detector (`lexical.mjs:320-321`) is `re1 = /\b(Not (?:a|an|just|only|because)\b[^.!?]{1,50}[.!?]\s+){2,}/g` and `re2 = /\b(It wasn'?t\b[^.!?]{1,50}[.!?]\s+){2,}/gi` — a direct regex encoding of those two rows, one regex per row.
9. **The two dramatic-fragmentation regexes do the same for stop-slop's table.** stop-slop structures.md "Dramatic Fragmentation": `"[Noun]. That's it. That's the [thing]."` and `"X. And Y. And Z."`. ai-humanizer `lexical.mjs:334-335`: `re1 = /\bThat'?s it\.\s+That'?s (?:the|it|all|what)\b/gi` and `re2 = /\b[A-Z][a-z]+\.\s+And [a-z]+\.\s+And [a-z]+\./g` — again one regex per stop-slop row.
10. **The false-agency lexicons are built from stop-slop's example table.** stop-slop structures.md "False Agency" lists `the complaint becomes a fix`, `the decision emerges`, `the culture shifts`, `the conversation moves toward`, `the data tells us`, `the market rewards`, and explains "A person does something… AI loves this because it avoids naming the actor." ai-humanizer's `FALSE_AGENCY_NOUNS`/`FALSE_AGENCY_VERBS` (`lexicons.mjs:199-208`) are the noun/verb pairs extracted from exactly those examples (nouns include `complaint`, `decision`, `culture`, `conversation`, `data`, `market`; verbs include `becomes`, `emerges`, `shifts`, `moves`, `tells`, `rewards`), and the rule description (`rules.mjs:152`) reproduces the phrasing: `Inanimate subjects given human verbs ("the data tells us", "the decision emerges"). Name the person who acts.`
11. **Passive voice and Wh- openers are lifted alongside their examples.** stop-slop structures.md "Passive Voice" rows: `"X was created"`, `"It is believed that"`, `"Mistakes were made"`, `"The decision was reached"`; ai-humanizer's participle list (`lexical.mjs:298`) includes exactly `created`, `believed`, `made`, `reached`. stop-slop structures.md "Sentence Starters to Avoid" (`What, When, Where, Which, Who, Why, How` → "Wh- openers become a crutch") maps to rule `wh-opener` (`rules.mjs:200-203`, detector `lexical.mjs:308-317`) including the stop-slop example `"What makes this hard is..."` echoed in `banned-words.md:192`.
12. **The adverb and lazy-extreme lists match stop-slop's parts of speech.** stop-slop phrases.md "Adverbs" lists `really, just, literally, genuinely, honestly, simply, actually, deeply, truly, fundamentally, inherently, inevitably`; `ADVERB_FILLER` (`lexicons.mjs:147-152`) contains all of those (plus `basically, totally, frankly, surely, undoubtedly`) with the comment `// 2026 additions (stop-slop Jan 2026 AI intensifiers)`. stop-slop structures.md "Word Patterns" lists "Lazy extremes (every, always, never, everyone, everybody, nobody)"; `LAZY_EXTREMES` (`lexicons.mjs:155-158`) contains all six plus `no one`, `every single`, `without exception`, `each and every`, `everything`, `nothing`.
13. **Even the unregistered orphan detector traces to a stop-slop quick check.** stop-slop `SKILL.md` "Quick Checks" includes "Three consecutive sentences match length? Break one." and structures.md "Rhythm Patterns" includes "Three-item lists | Use two items or one" and "Em-dashes | Remove… No em dashes at all". ai-humanizer's unreachable `sentence-spread` detector (`stylometry.mjs:88-103`) implements exactly that check — `spread only N words (aim for 20+)` and `N runs of 3+ same-length sentences` — and those same two sentences appear as prose in `references/banned-words.md:231-232`. The `rule-of-three` rule (`rules.mjs:52`) and `em-dash-overuse` (`rules.mjs:21`) cover the other two.
14. **The "two items beat three" / anti-over-correction posture is also shared.** stop-slop `SKILL.md` rule 6 "Vary rhythm. Mix sentence lengths. Two items beat three." ↔ ai-humanizer lever 7 "Break the rule-of-three — stop defaulting to 'X, Y, and Z' triads" (`SKILL.md:84`); stop-slop's "Trust readers" ↔ ai-humanizer's effort/length-variance guidance.

Scope of the overlap: 11 of ai-humanizer's 46 rules (`false-agency`, `rhetorical-setup`, `negative-listing`, `vague-declarative`, `meta-commentary`, `emphasis-crutch`, `dramatic-fragmentation`, `adverb-filler`, `lazy-extremes`, `passive-voice`, `wh-opener`) exist because of stop-slop, i.e. **24% of the registry**, and roughly 80 of the 524 lexicon entries come from stop-slop's lists. The overlap is acknowledged — this is attributed borrowing, not concealed plagiarism — but it is not accompanied by the required MIT notice (§11).

### 12.2 Intra-repo duplication (self-overlap that affects scoring)

The 26 lexicon arrays are not disjoint: **12 of the 524 entries appear in two arrays**, so a single word can be charged twice in one run. Exact intersections:

- `BANNED_VOCAB ∩ GPT_TICS` = `rich tapestry`, `showcasing`, `emphasizing` (`lexicons.mjs:22,27,36` and `:228,233`);
- `CHATBOT_CLOSERS ∩ CLAUDE_TICS` = `you're absolutely right`, `i'd be happy to` (`lexicons.mjs:118,119` and `:237,239`);
- `AI_OPENERS ∩ CLAUDE_TICS` = `great question`, `that said,` (`lexicons.mjs:42,51` and `:237,238`);
- `AI_OPENERS ∩ BANNED_VOCAB` = `in the realm of` (`lexicons.mjs:21,43`);
- `AI_OPENERS ∩ VAGUE_DECLARATIVE` = `the real question is` (`lexicons.mjs:55` and `:193`);
- `BANNED_VOCAB ∩ BUSINESS_JARGON` = `synergy` (`lexicons.mjs:31` and `:140`);
- `BANNED_VOCAB ∩ BUZZWORDS` = `cutting-edge` (`lexicons.mjs:21` and `:69`);
- `CHATBOT_CLOSERS ∩ GPT_TICS` = `i hope this helps` (`lexicons.mjs:115` and `:231`).

Because provider tics are gated off by default, the practically active double-charges in the default configuration are `great question` (ai-openers 5 + claude-tics only when gated), `in the realm of` (ai-openers 5 + banned-vocab 4), `the real question is` (ai-openers 5 + vague-declarative 3), `synergy` (banned-vocab 4 + business-jargon 3 in marketing mode), `cutting-edge` (banned-vocab 4 + marketing-buzzword 4/8). A single occurrence in a marketing document can therefore add 12 points via `cutting-edge` alone.

### 12.3 vs. the other repos

Each of the other seven trees was read directly (not inferred from filenames) and each was searched for the strings `ai-humanizer`, `ai_humanizer`, `judetelan`, `impeccable`. **None of the seven names this repo or its author** (§11). The overlap that exists is of four distinct kinds, ranked by strength.

**(a) `holygeek00/humanizer-zh-cn` (repo #6) — the largest rule-for-rule correspondence, but through a shared English ancestor.** This repo is a *Simplified-Chinese localization of `blader/humanizer`* pinned at upstream 2.9.1, with **exactly 33 numbered patterns** frozen by a maintainer rule (`humanizer-zh-cn/AGENTS.md:3`, `AGENTS.md:9`, `LOCALIZATION.md:5-8`), and it contains **no executable code** (its only script is a packaging validator). **18 of ai-humanizer's 46 rule ids have a direct counterpart** in its numbered list (pattern numbers below are its `SKILL.md` sections): `em-dash-overuse` ↔ 14 破折号、括号和补充说明过密 (`SKILL.md:174`); `banned-vocab` ↔ 7 抽象动词吞掉具体动作 (`:108`); `ai-openers` ↔ 28 预告式开场和导航话术 (`:303`) + 23 冗余套话 (`:259`); `marketing-buzzword` ↔ 4 宣传稿和广告腔 (`:78`); `hedging` ↔ 24 过度限定 (`:269`); `aphoristic-cadence` ↔ 9 "不仅……更……"和先否后肯滥用 (`:128`); `rule-of-three` ↔ 10 强凑三点和排比 (`:138`); `weasel-attribution` ↔ 5 模糊归因和"据悉" (`:88`); `copula-avoidance` ↔ 8 回避简单判断句 (`:118`); `chatbot-closer` ↔ 20 聊天机器人残留 (`:231`) + 22 讨好和附和 (`:251`); `conclusion-fluff` ↔ 25 万能正能量结尾 (`:277`) + 6 "挑战与展望"模板 (`:98`); `ing-trailers` ↔ 3 句尾堆叠"从而/进而/助力"伪分析 (`:68`); `llm-artifact-leak` ↔ 21 知识边界免责声明与猜测补洞 (`:241`); `smart-punctuation-leak` ↔ 19 全角半角与引号混用 (`:221`); `bold-label-list` ↔ 15 加粗和重点标记过多 (`:184`) + 16 "小标题：解释"式清单泛滥 (`:192`); `false-agency`/`passive-voice` ↔ 13 无主句和责任主体消失 (`:164`); `dramatic-fragmentation` ↔ 31 人造金句和短句连击 (`:335`); `rhetorical-setup` ↔ 33 假装坦诚的反问开头 (`:351`); `vague-declarative` ↔ 27 权威口吻和"本质论" (`:293`). There are also one-to-one translated lexicon mappings, including highly distinctive pairs such as 织锦 ← `tapestry` (`lexicons.mjs:16`), 深入探讨 ← `delve` (`:16`), 持久的 ← `enduring` (`:34`), 值得注意的是 ← `It's worth noting` (`:44`), and 截至我的知识更新 ← `as of my training` (`:271`). **Assessment:** this is *localization of the same underlying English rule set*, not copying of ai-humanizer — ai-humanizer's own `lexicons.mjs:10` and this repo's `SKILL.md:386` both name Wikipedia "Signs of AI writing" as the source of that vocabulary, ai-humanizer uses kebab-case ids where this repo uses 1–33 ordinals, and neither cites the other. **Correction to the inventory brief:** `humanizer-zh-cn` does **not** mention `stop-slop` or `hardikpandya` (0 hits); its declared lineage is `blader/humanizer` + Wikipedia only. The stop-slop acknowledgement belongs to op7418/Humanizer-zh.

**(b) `blader/humanizer` (repo #2) — heavy shared vocabulary, no copying, and the inventory's "33 patterns" figure is historical.** At this checkout `blader-humanizer/SKILL.md` has **25 numbered patterns** (`metadata.version: "3.0.0"`, `SKILL.md:10`; the v3 rebuild is recorded at `README.md:171` as "consolidated 35 patterns into 25"). The 33-pattern state is the older v2.9.x tag. The repo contains **no executable detector at all** (Markdown only), so no regex or scoring overlap is possible. Against ai-humanizer's 46 rules: **6 substantive duplicates** (`banned-vocab` ↔ pattern 12 "Overused AI words" `SKILL.md:200`; `copula-avoidance` ↔ 18 "Avoiding is, are, and has" `:266`; `ing-trailers` ↔ 15 "Shallow -ing riders" `:235`; `aphoristic-cadence` ↔ 1 "Not X but Y" `:60`; `rule-of-three` ↔ 6 "Forced triads" `:141`; `passive-voice` ↔ 11 "Passive voice and missing subjects" `:188`), **18 partial overlaps** (same phenomenon, different framing — including `em-dash-overuse` ↔ 8 "Dashes as the universal connector", which is a hard ban in blader vs a rate threshold in ai-humanizer), and **22 ai-humanizer rules with no counterpart at all** — notably `llm-artifact-leak`, `rlhf-artifacts`, `reasoning-chain-leak`, `acknowledgment-loop`, all five provider `*-tics` rules, and the whole stylometry family (`uniform-rhythm`, `low-lexical-diversity`, `comma-splice-rhythm`, `paragraph-uniformity`, `contraction-absence`). The single largest overlap surface is the vocabulary watch-list: **15 of blader's 27 current pattern-12 tokens are verbatim in ai-humanizer's `BANNED_VOCAB`** (`bolstered, crucial, delve, emphasizing, enduring, fostering, garner, interplay, pivotal, robust, showcase, tapestry, testament, underscore, vibrant`), rising to ~20/24 against the older v2.9.0 list. Two details point to a shared source rather than transcription: blader's list is **alphabetically ordered** (`SKILL.md:200`) while ai-humanizer's is thematically batched into "original set" / "researched additions" / "2026 additions" (`lexicons.mjs:14-38`), so membership overlaps but sequence does not; and the `-ing` rider verb list is the one place where **9 of 11 tokens appear in the same leading order** (`highlighting, underscoring, emphasizing, ensuring, reflecting, symbolizing, …` — blader `SKILL.md:235` vs ai-humanizer `lexical.mjs:146`). Conversely, ai-humanizer's own n-gram lists (`EMPHASIS_CRUTCH`, `META_COMMENTARY`, `RHETORICAL_SETUP`, `VAGUE_DECLARATIVE`, `HEDGES`) share **0 exact tokens** with blader's corresponding watch-lists. blader patterns with no ai-humanizer rule: 7 repeated sentence openings, 10 hyphenated pairs, 14 vague connection/association. ai-humanizer does not credit blader anywhere (`README.md:288-309` lists seven other sources; blader is absent).

**(c) `lynote-ai/dsh-humanizer` (repo #1) — same architecture and score *shape*, different everything else; this is the real duplicate-capability risk.** It is a TypeScript DSH plugin with **13 rules in 7 categories and 162 pattern sources** (`src/core/rules.ts`, ids `empty-opener-en/-zh`, `cliche-en/-zh`, `hedge-en/-zh`, `transition-en/-zh`, `summary-ending-en/-zh`, `mechanical-parallel-zh`, `over-explain-en/-zh`), bilingual English/Chinese by construction. Its score (`src/core/analyze.ts:32-41`) is `aiScore += severity * Math.min(count, 5) * 2` plus `+10` if `burstiness < 1.5` and `+5` if `avgSentenceLength > 32`, clamped to 0–100 — the same weighted-count-capped-to-100 concept as ai-humanizer but a different constant set (severity×count vs weight×log₂, cap 5 vs cap 3). It has **no verdict bands at all** (ai-humanizer's five-band scale has no counterpart), a profile store rather than a score-trend store (`~/.dsh/voice-profiles.json`), no markdown/HTML stripping, and 0 identical rule ids. Shared strings: **32 of its 162 pattern sources (20.1%) are verbatim-equal to entries in ai-humanizer's `lexicons.mjs`** — the most distinctive being `delve into`, `a testament to`, `unlock the potential`, `it is worth noting that`, `state-of-the-art`, `paradigm shift`, `game-changer`, `best-in-class`. Both repos cite stop-slop as an upstream (`dsh-humanizer/src/core/rules.ts:3`), which is the parsimonious explanation. **No direct copying:** only one whole-line match across both trees (`.map((s) => s.trim())`), zero shared 8-token spans, zero shared comments, zero shared fixtures. **Critical asymmetry:** dsh-humanizer ships `src/voice.ts` (224 lines, five tools `voice_import`/`voice_profile`/`voice_remove`/`voice_score`/`voice_rewrite`, backed by `extractFingerprint`/`StyleFingerprint` in `src/core/fingerprint.ts` and a similarity scorer in `src/core/score.ts`) — a genuine author-voice layer that ai-humanizer completely lacks (§7). Conversely ai-humanizer has 46 weighted rules vs 13, provider gating, line-numbered evidence, a CLI/hook and trend storage that dsh-humanizer lacks.

**(d) `op7418/Humanizer-zh` (repo #7) — the rubric duplicates across three repos, not two.** It has **24 numbered patterns in 4 groups of 6** (`SKILL.md:82-404`) and no code, but its 质量评分 (`SKILL.md:442-456`) is a **5-axis, 1–10-per-axis, 50-point rubric over 直接性 / 节奏 / 信任度 / 真实性 / 精炼度 with bands `45-50 分：优秀` / `35-44 分：良好` / `低于 35 分：需要重新修订`** — i.e. the same instrument as ai-humanizer's Directness / Rhythm / Trust / Authenticity / Density rubric with "below ~7 on any axis, revise" (`SKILL.md:111-117`; threshold ≈35/50) and as stop-slop's "Below 35/50: revise". Because ai-humanizer explicitly labels its rubric "absorbed from stop-slop" (`SKILL.md:106`, `README.md:290-294`) and op7418 declares "实用工具部分（核心规则、快速检查清单、质量评分）参考了 hardikpandya/stop-slop" (`op7418-humanizer-zh/README.md:5`, `SKILL.md:15`), the shared ancestor is stop-slop and the rubric is the common artifact. op7418 also carries a **translated cluster of the same canonical slop sentence** — "新的软件更新作为公司致力于创新的证明。此外，它提供了无缝、直观和强大的用户体验——确保用户能够高效地完成目标。这不仅仅是一次更新，而是我们思考生产力方式的革命。行业专家认为…彰显了公司在不断演变的技术格局中的关键作用。" (`SKILL.md:463`) with a deletion log enumerating 作为……的证明 / 此外 / 无缝、直观和强大 / 破折号 / 这不仅仅是……而是…… / 行业专家认为 / 关键作用 / 不断演变的格局 (`SKILL.md:468-476`) — which maps one-to-one onto ai-humanizer's `lexicons.mjs:16-23` (`testament`, `seamless`, `cutting-edge`, `landscape of`), `rules.mjs:47-50` (`Not an X. A Y.`), `rules.mjs:122-125` (participial trailers) and `rules.mjs:77-80` (weasel attribution). Pattern-level concept overlap with ai-humanizer is broad (patterns 6, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24 all have ai-humanizer counterparts), but the numbering schemes are disjoint (24 ordinals in four groups vs 46 kebab-case ids) and neither repo cites the other.

**(e) `ai-zixun/humanizer-zh` (repo #4) — concept-only overlap; its real value is the voice layer.** Pure Markdown, no code, no score: **8 Core Rules** (`SKILL.md:57-114`: 1 优先改掉翻译腔 / 2 去掉空泛的大词和套话 / 3 打散机械结构 / 4 保持中文节奏 / 5 管住文章级结构 / 6 处理标点和排版 / 7 统一常见术语和日期 / 8 控制判断强度) plus **13 patterns** (`references/patterns.md:5-17`: 1 机械对照句 / 2 翻译腔连接词 / 3 空泛大词 / 4 段落结尾的口号化收束 / 5 列表和排比成瘾 / 6 冒号、破折号和引号 / 7 营销稿与官样文章腔 / 8 过度谨慎或过度确定 / 9 开头、主体、结尾脱节 / 10 文章级重写模板 / 11 编号枚举撑全文 / 12 章末段末的预告式收束 / 13 抽象转义与重锤句). Concept mapping to ai-humanizer is straightforward but translated, not shared: 机械对照句 `不是……而是……` (`patterns.md:23-26`) ↔ `aphoristic-cadence`; 翻译腔连接词 `值得注意的是`/`与此同时` (`patterns.md:46-47`) ↔ `ai-openers`/`wordy-connectives`; 空泛大词 `颠覆/革命/赋能/重塑/开启新篇章/里程碑` (`patterns.md:69-76`) ↔ `BUZZWORDS`/`CONCLUSION_FLUFF`; `粗体小标题 + 冒号 + 解释` (`patterns.md:119`) ↔ `bold-label-list`; 长破折号 `——` (`patterns.md:134`) ↔ `em-dash-overuse`; `第一步/第二步` (`patterns.md:377`) ↔ `numbered-section-markers`. No shared example sentence, no shared formula (it has none). It declares only generic inspiration from blader/humanizer (`README.md:156`: "整体方向与分享方式受到 blader/humanizer 的启发") and never mentions ai-humanizer. Its distinctive asset — **8 named Chinese author voice profiles** (李笑来, 鹤老师, 罗振宇, 吴军, 李尚龙, 何帆, 冯唐, 刘子超; index at `references/voices/index.md:15-24`) that override the Core Rules on conflict (`SKILL.md:47`) — has no counterpart in ai-humanizer.

**(f) `lynote-ai/humanize-text` (repo #5) — the opposite architecture; no duplication beyond 7 shared words and generic metrics.** A Python 3.10+ rewrite pipeline whose detection is a small statistical detector with a **0–1 average** formula, quoted verbatim from `src/methodologies/detectors/statistical.py:35-39`: `ttr_score = max(0, min(1, (0.7 - ttr) / 0.3))`; `cv_score = max(0, min(1, (0.5 - cv) / 0.3))`; `hapax_score = max(0, min(1, (0.6 - hapax_ratio) / 0.3))`; `return (ttr_score + cv_score + hapax_score) / 3`. It has no rule list, no severity scale and no verdict bands. Its `AI_VOCAB_REPLACEMENTS` has **30 keys, 7 of which (23.3%) are in ai-humanizer's `BANNED_VOCAB`** (`utilize`, `leverage`, `paradigm`, `robust`, `cutting-edge`, `delve`, `pivotal` — `src/methodologies/postprocess.py:7-29` vs `lexicons.mjs:16-37`). Both compute sentence-length CV as a "burstiness"/uniformity signal and both compute TTR (`statistical.py:17-25,36` vs `stylometry.mjs:31,34`) — generic, widely published metrics. Unlike ai-humanizer it is **not offline-capable**: it requires DeepSeek/OpenRouter/Atlas/OrcaRouter LLM APIs plus Google Translate and Niutrans (`src/standard/llm_client.py:14-38`, `src/standard/pipeline.py:39,83,91`) and optionally `transformers`/`torch` for RoBERTa (`roberta-base-openai-detector`, `detectors/roberta.py:12-18`) and Binoculars (`detectors/binoculars.py:13-30`). Its lineage is entirely separate, and there is **no citation in either direction**; the only `ai-humanizer` strings in that tree are Lynote's own SaaS product (`README.md:90,286`, `docker-compose.yml:4`).

**Summary of duplication strength:** stop-slop is the only *verbatim-content* duplication (§12.1, 11 rules + verbatim phrase lists + the rubric + the jargon table, with a missing MIT notice). Blader and humanizer-zh-cn are the largest *shared-source* duplications (same English rule catalogue via Wikipedia; 6 substantive + 18 partial blader matches; 18/46 humanizer-zh-cn counterparts). dsh-humanizer is the largest *duplicate-capability* risk (independent implementation of the same registry+score+trend idea, 32 shared lexicon strings, no verdict bands, plus the voice layer ai-humanizer lacks). humanize-text, humanizer-zh and op7418 overlap on concepts and, for op7418, on the stop-slop-derived rubric — with no evidence of transmission to or from ai-humanizer.

## 13. Integration recommendation

Prioritized, concrete, and scoped to what this repo actually provides.

**Priority 1 — take the detector core as the new project's lexical+stylometry baseline (kind A).**
Port `scripts/registry/rules.mjs`, `scripts/engines/lexical.mjs`, `scripts/engines/stylometry.mjs`, `scripts/lexicons.mjs` and `scripts/shared/text.mjs` behind one `Detector` interface: `ctx -> Finding[]`, where `Finding = { ruleId, category, severity, line, sample, count, message }`. Keep the rule ids exactly as they are (they are stable, kebab-case, human-readable and already used in output), keep the per-rule thresholds exactly (they are hand-tuned), and keep the mode/provider gating semantics from `activeRuleIds`/`filterByProviders` (`rules.mjs:273-292`). Two mandatory changes: (a) **de-duplicate the 12 cross-array lexicon entries** (§12.2) so one word cannot be charged twice, and (b) **register or delete `sentence-spread`** (`stylometry.mjs:88-103`) — ship it registered with a weight, since its "≥20-word spread" and "no three consecutive same-length sentences" checks are genuinely useful, or remove it as dead code.

**Priority 2 — replace the scorer before first release (kind A, but do not copy the formula as-is).**
Take the *shape* (weight per rule × diminishing-returns multiplier on hit count, capped score) but fix the two defects: normalize by document length (per 100 words, or compute the raw sum against an expected-hits baseline) and make severity participate (e.g. warnings count fully, `advisory` at a reduced factor or excluded from the headline number). The current formula's `min(100, round(raw))` cap and unnormalized sum mean a long clean document and a short sloppy one are not comparable, which will break any corpus-level scoring the new project wants. If cross-tool comparability matters, decide explicitly whether to match dsh-humanizer's bands or define a new shared scale; do not ship two different `0–100` scales that both claim to mean "AI slop".

**Priority 3 — adopt the machine-readable rule registry as the interchange format (kind A + B).**
`rules.mjs` is a clean declarative schema (id/category/engine/severity/modes/weight/gated/name/description) and is the natural bridge to the markdown-skill repos: parse their numbered pattern lists — `blader/humanizer`'s 25 patterns at v3.0.0 (33 at the older v2.9.x tag, which is the state `holygeek00/humanizer-zh-cn` localized), `op7418/Humanizer-zh`'s 24 patterns in 4 groups, and `ai-zixun/humanizer-zh`'s 8 core rules + 13 patterns — into this same schema as `source: markdown-skill` rules instead of hand-porting prose. Then a single report can show which rules came from which upstream. Also add the attribution/provenance fields this project will need (see Priority 5) — the registry is the right place to record `derivedFrom`.

**Secondary (do take, lower priority):**

- `scripts/shared/text.mjs` line-number-preserving HTML/Markdown stripping — reuse verbatim; it is what makes per-line evidence trustworthy. Tighten `isWordBoundary` (`text.mjs:48-53`) while you are there.
- `references/check.md`'s report contract (verdict + stylometry line + per-finding line evidence + top-3 fixes) as the CLI/JSON output shape; `storage.mjs`'s `slugify` and JSONL trend as an optional history feature behind an injectable storage root (never `process.cwd()` directly).
- The hook *pattern* (post-write auto-scan with a self-skip guard, `hook.mjs:62-64`) as an optional host adapter; do not make it part of the default path.

**Do not take (kind D/E):**

- The 14 rewrite levers, the detect→triage→rewrite→re-detect→rubric loop, and the `audit` corpus-ranking procedure are **methodology**, not detectors. Keep them in a separate "guidance" layer that is not in the default execution path (kind D), and never let the LLM-only rubric influence a numeric score.
- `portable/ai-humanizer.md`'s embedded Python scorer is a divergent partial duplicate of the Node detector (kind E for the scorer): do not maintain two implementations.
- `README.md` and `LICENSE` as-is (kind E): do not copy the LICENSE, and do not reuse any stop-slop-derived content until Priority 5 is resolved.

**Priority 4 — borrow the voice-layer idea from elsewhere in the inventory, not from this repo.**
This repo has **no** voice capability (§7, §12.3). If `human-voice-suite` needs personal style, the inventory offers two precedents: `lynote-ai/dsh-humanizer`'s executable `src/voice.ts` + `extractFingerprint`/`scoreSimilarity` layer (the only *code* implementation of voice in the set, with a similarity score against a stored `StyleFingerprint`), and `ai-zixun/humanizer-zh`'s `references/voices/*.md` profiles (8 named authors, prose-only) plus `holygeek00/humanizer-zh-cn`'s user-sample calibration protocol (`SKILL.md:42-44`, match sentence length, word choice, paragraph openings, punctuation, tics, information density, with the user sample outranking all defaults). Abstract whichever you choose into a unified voice interface (kind C). Do not try to grow a voice layer out of ai-humanizer's fixed stylometric thresholds — those measure "human vs machine", not "this author vs that author".

**Priority 5 — resolve the attribution gap before merging any of this code (blocking for release).**
Because the highest-value assets (11 of 46 rules and ~80 lexicon entries) are stop-slop-derived, ship a `THIRD-PARTY-NOTICES` file that reproduces, verbatim, the MIT license text and copyright line of every upstream whose content is included — minimally `Copyright (c) 2025 Hardik Pandya` for stop-slop — plus whatever notices are required by `harshaneel/humanize`, `MohamedAbdallah-14/unslop`, `brandonwise/humanizer`, `petergyang/no-ai-slop`, `jalaalrd/anti-ai-slop-writing`, `shannhk/avoid-slop` and Wikipedia (CC BY-SA). Also resolve "impeccable": either identify the repository and confirm its license or re-derive the architecture independently, since the current citation is unusable (`README.md:286`). Keep judetelan's MIT notice as well.

## 14. Gaps, risks, and limitations

**Factual gaps in the artifact itself**

1. **Zero tests, zero CI** (§10). 46 detectors, ~130 regexes/lexicon lookups, a scorer, a storage layer and a CLI are untested and unverified by any automated process. Regex bugs are therefore likely and unguarded; the em-dash regex had to be patched post-hoc (`7ad3e54`).
2. **Stale self-documentation.** Rule count is documented as 40 in two places (`README.md:4`, `README.md:226-227`) while the code defines 46. `references/banned-words.md:4` tells the reader the lists live in `scripts/humanize-detect.mjs` when they live in `scripts/lexicons.mjs`. Doc/code drift is also substantive: `banned-words.md:221` attributes an "X rather than Y (reversal construction)" to Grok that exists nowhere in `GROK_TICS` (`lexicons.mjs:253-256`), and `banned-words.md:223` prints lenticular brackets `〔〕` while the code matches mathematical angle brackets `⟨⟩` (`lexicons.mjs:260`).
3. **Two rules are unreachable from the CLI** (`grok-tics`, `deepseek-tics`, §5.5), and the undocumented `--grok`/`--deepseek` flags are silently misinterpreted as filenames. `README.md` and `SKILL.md` disagree about which flags exist.
4. **One orphan detector** (`sentence-spread`, `stylometry.mjs:88-103`) that never runs and is not scored.
5. **Registry invariant violated**: `passive-voice` is `category: 'stylometry'` with `engine: 'lexical'` (`rules.mjs:195`), so category-based reporting and engine dispatch disagree for that rule.
6. **Language coverage is English-only.** Every lexicon, regex and idiom (`plays a crucial role`, `due to the fact that`, Wh- openers) is English. BANNED_VOCAB alone is 98 English entries; there is no CJK handling at all (grep for CJK ranges across the `.mjs` sources returns zero hits). Any Chinese input would be scored near-zero by the lexical engine while the stylometry engine's `wordCount` (regex `[a-z][a-z'-]+`, `stylometry.mjs:21`) would read as zero words — the score would be meaningless. This makes the detector unusable for the Chinese repos' target content without a full re-implementation; by contrast `lynote-ai/dsh-humanizer` is bilingual by construction (13 rules split `-en`/`-zh`) and `holygeek00/humanizer-zh-cn` ships a frozen 33-pattern Chinese rule set, so a multi-language project must pair this detector with one of those for CJK input.
7. **No version identity** (§1): no package metadata, no tag, no VERSION file, so the only way to pin this integration is by commit `76bf08f13b`.

**Algorithmic/statistical risks**

8. **The score is not comparable across lengths** (unnormalized additive sum, §6), and is dominated by a single high-weight rule: `llm-artifact-leak` alone contributes 12 (and up to 36 with `mult` cap at count ≥4), which is above the entire "Likely human" band. A single `[Your Name]` placeholder can push a clean document past "Mixed".
9. **False-positive profile is unmeasured.** There are no fixtures, no thresholds validated against a human corpus, and the repo itself admits the mechanism misflags fluent non-native English (Liang et al. 2023, `SKILL.md:141-143`). Density-gated rules (`adverb-filler` at ≥4 and ≥0.8/100 words, `lazy-extremes` at ≥4, `passive-voice` at ≥3 and ≥1/120 words, `wh-opener` at ≥3 and ≥18%) are the least-validated and most register-sensitive: ordinary first-person prose easily trips `adverb-filler`, and `wh-opener` deliberately ignores questions but will still fire on legitimate expository writing.
10. **Stylometric thresholds are absolute, not corpus-relative** (`CV<0.35`, TTR ladder, `≥2.2` commas/sentence, `paraLenCV<0.25`, `contractionRate≤0.3`). TTR in particular is length-dependent and the code compensates with a hand-made 5-step ladder (`stylometry.mjs:52-57`) — a heuristic, not a validated measure. The contraction regex also treats possessive `'s` as a contraction (`stylometry.mjs:26`), which will under-report contraction absence.
11. **`--trend` writes outside any sandbox control** to `process.cwd()/.ai-humanizer/scores/` (`storage.mjs:17`). In an integration this is a side-effect risk (and in this inventory run it was deliberately never invoked).
12. **Exit code semantics do not match "score" semantics** (`2` on any finding, not on a score threshold), so the documented CI gate (`audit.md:21-27`) fails on a single advisory nit.
13. **Text scrubbing is lossy by design** (`toText`, `text.mjs:6-20`): URLs, code spans, fenced blocks, images and link targets are replaced by spaces. Rules like `llm-artifact-leak` deliberately scan `ctx.raw` instead (`lexical.mjs:158`) while others scan `ctx.text`, so the two families see different documents — a subtle correctness hazard when adding rules.

**Provenance and licensing risks (the biggest risk in this repo)**

14. **Missing upstream MIT notices** for stop-slop and the other named sources (§11), despite substantial verbatim reuse (11 rules, the rubric, the jargon table, multiple phrase lists). MIT-compatible but notice-non-compliant as distributed.
15. **Unidentifiable "impeccable" dependency** for the architecture, cited with an empty GitHub URL and no license — the reuse permission cannot be established from the repo.
16. **Wikipedia "Signs of AI writing" is CC BY-SA**, credited as a pattern source without share-alike attribution.
17. **No third-party notices file, no per-file headers, no NOTICE** — so a downstream integrator cannot mechanically determine which parts are judetelan's original work and which are absorbed. For a new project this means the licenses of *all* named upstreams must be independently verified before any of the lexicons/registry are copied wholesale.
18. **A single-maintainer, single-year, 10-commit history** with documentation that is already inconsistent at 2 months old. Maintenance risk for anything depending on it.

**Integration-specific limitations**

19. **No voice/personal-style layer** (§7) — this repo cannot contribute to the "voice" half of `human-voice-suite` at all; its relevant contribution is the deterministic AI-tell detector and its stylometric feature extraction.
20. **Overlap with `lynote-ai/dsh-humanizer` (repo #1)** is a duplicate-capability risk rather than a copying risk: 0 identical rule ids and no shared code, but 32 of its 162 pattern sources (20.1%) are verbatim-equal to entries here (`delve into`, `a testament to`, `unlock the potential`, `it is worth noting that`, `state-of-the-art`, `paradigm shift`, `game-changer`, `best-in-class`), both cite stop-slop upstream, and both ship a `0–100` score over weighted rule hits — so integrating both detectors would double-count the same phenomena under different ids and produce two incompatible scales. Choose one as the scoring spine (this analysis recommends this repo's detector for breadth: 46 rules vs 13, five provider tic sets, line-numbered evidence, and a genuinely dependency-free offline runtime) and import dsh-humanizer only for what this repo lacks (`src/voice.ts` + `StyleFingerprint` voice scoring, and its bilingual `-en`/`-zh` rule split for CJK input).
21. **Cross-language duplication is conceptual, not literal, so a naive rule merge would triple-count.** `holygeek00/humanizer-zh-cn` has 18 Chinese patterns that map onto 18 of this repo's 46 ids, and `ai-zixun/humanizer-zh` / `op7418/Humanizer-zh` cover the same catalogue again in prose. Any unified registry must key these as *language variants of one rule* (e.g. a `language` field on the rule) rather than as new rules, or the new project will report one phenomenon three times for a bilingual document.
