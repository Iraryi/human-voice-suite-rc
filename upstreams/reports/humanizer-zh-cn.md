# Inventory: holygeek00/humanizer-zh-cn

_Read-only factual inventory. No file inside any repository directory was created, modified, or deleted. All Chinese strings are reproduced verbatim. Every claim carries a `file:line` anchor. Statements that could not be confirmed by direct comparison are marked explicitly._

## 1. Identity

| Field | Value | Evidence |
|---|---|---|
| Repository | `holygeek00/humanizer-zh-cn` (remote `https://github.com/holygeek00/humanizer-zh-cn.git`) | `.git/config`; `README.md:1` |
| Path inventoried | `\.upstream-cache\humanizer-zh-cn` | — |
| Commit | `401e372eeb1a91045d15ec21c2d13b9d0f7842ea` ("Improve README discoverability", author `Naassh <719993988@qq.com>`, 2026-08-08) | `git log -1` |
| Branch | `main` | `git rev-parse --abbrev-ref HEAD` |
| Commit count in clone | 46 (fork retains upstream blader history: earliest commit `63def2e` "Initial commit: Humanizer Claude Code skill") | `git rev-list --count HEAD` |
| License | MIT, file header `MIT License`, copyright line verbatim: `Copyright (c) 2025 Siqi Chen` | `LICENSE:1-3` |
| Declared version | `"2.9.1-zh.2"` | `SKILL.md:10`; `README.md:217`; `.claude-plugin/plugin.json:5` (validator enforces all three being equal) |
| Languages | Chinese (Simplified) prose; English identifiers/YAML keys/paths; Python 3 (validator script) | `SKILL.md`, `scripts/validate-package.py` |
| Text file count | 11 (excluding `.git/`) | directory listing |
| Total text size | 44,299 bytes | directory listing |
| Component sizes | `SKILL.md` 18,109 B / 386 lines; `README.md` 11,422 B / 231 lines; `LOCALIZATION.md` 3,042 B / 51 lines; `AGENTS.md` 925 B / 21 lines; `sync-upstream.yml` 4,525 B / 131 lines; `validate.yml` 715 B / 29 lines; `scripts/validate-package.py` 2,985 B / 79 lines; `LICENSE` 1,066 B / 21 lines; `.claude-plugin/plugin.json` 648 B; `.claude-plugin/marketplace.json` 601 B; `agents/openai.yaml` 261 B | measured |

## 2. Purpose and functionality

A Simplified-Chinese localization of `blader/humanizer`, shipped as a portable Agent Skill. It identifies and removes AI-writing tells from Chinese text without changing what the text says, and without adding facts (`SKILL.md:1-15`, `README.md:8-12`).

It is **not** an AI-content detector and makes no claim to lower AIGC-detection rates (`README.md:183-189`). Its central differentiator from a thesaurus-style rewriter is a diagnostic frame: Chinese business jargon is treated as **missing information**, not as a banned word. For every jargon hit the skill asks five questions — 谁在做？/ 具体做了什么？/ 对谁或什么起作用？/ 产生了什么可观察的结果？依据是什么？ (`SKILL.md:29-36`, `README.md:52-58`). Synonym-swapping jargon for other jargon is explicitly forbidden: `不要做同义词替换游戏，把“赋能”换成“助力”或“推动”不算修改。` (`SKILL.md:36`).

A hard no-fabrication rule runs throughout: `不得新增原文或用户未提供的事实、姓名、数字、日期、引语、案例或来源。` (`SKILL.md:23`), and examples must not invent "before" facts to manufacture human-feel (`AGENTS.md:11`).

## 3. Structure of SKILL.md

**YAML metadata** (`SKILL.md:1-11`): `name: humanizer-zh`; a five-line folded `description:`; `license: MIT`; `metadata.version: "2.9.1-zh.2"`. No top-level `version:` field. `compatibility:` and `allowed-tools:` are deliberately absent — the validator rejects them as nonportable (`scripts/validate-package.py:34-36`).

**Section layout** (in order):

| Line | Heading | Role |
|---|---|---|
| 13 | `# 中文 Humanizer` | title |
| 17 | `## 核心任务` | 5 numbered task rules |
| 27 | `## 先找回被黑话吃掉的信息` | the jargon-as-missing-information frame (custom, not upstream) |
| 42 | `## 声线校准` | voice calibration (localizes upstream `Voice Calibration`) |
| 46 | `## 中文 AI 写作常见模式` | the 33 patterns |
| 361 | `## 避免误伤` | false-positive protection |
| 367 | `## 调用模式` | pasted / file / embedded modes |
| 375 | `## 执行流程` | 6-step ordered process |
| 384 | `## 来源` | attribution to Siqi Chen and Wikipedia |

**Pattern count: 33.** Numbering is **contiguous** — headings `### 1.` … `### 33.` with no gaps (`SKILL.md:48,58,68,78,88,98,108,118,128,138,148,156,164,174,184,192,201,211,221,231,241,251,259,269,277,285,293,303,313,327,335,343,351`). The repository has no five-letter group sections (unlike blader 3.0.0 and unlike repo `op7418/Humanizer-zh`); all 33 sit under the single heading `## 中文 AI 写作常见模式`.

**Per-pattern layout is uniform:** a `### N. <name>` heading, an optional `**留意：**` watched-phrase list, an optional `**问题：**` diagnosis, then `**改前：**` / `**改后：**` pairs. Patterns 11, 12, 14, 15, 16, 18, 19, 24, 29, 30, 31 omit `**留意：**` and rely on `**问题：**` plus examples (e.g. `SKILL.md:148-154`, `SKILL.md:164-172`).

## 4. Complete rule inventory

33 patterns, numbered 1–33, contiguous. Section for all rows = `## 中文 AI 写作常见模式` (`SKILL.md:46`).

| number | pattern name (verbatim Chinese) | section | what it detects | rewrite guidance summary | evidence (file:line) |
|---|---|---|---|---|---|
| 1 | 空泛拔高意义 | 中文 AI 写作常见模式 | Ordinary facts forced into grand narrative (标志着、彰显了、里程碑) | State the plain fact; if the source gives no date/cause/effect, say so | `SKILL.md:48-56` |
| 2 | 用名气和媒体名单代替信息 | 中文 AI 写作常见模式 | Listing outlets/awards/celebrities in place of what was reported | Name what was reported or note that the source does not say | `SKILL.md:58-66` |
| 3 | 句尾堆叠“从而/进而/助力”伪分析 | 中文 AI 写作常见模式 | Causal/purpose result tails appended without evidence (从而/进而/进一步/助力实现) | Cut unsupported effect clauses; state the feature only | `SKILL.md:68-76` |
| 4 | 宣传稿和广告腔 | 中文 AI 写作常见模式 | Ad-copy adjectives (匠心打造、震撼来袭、极致、必打卡) | Replace with verifiable facts or state their absence | `SKILL.md:78-86` |
| 5 | 模糊归因和“据悉” | 中文 AI 写作常见模式 | Unnamed authorities (有专家表示、业内人士认为、研究表明、据悉) | Delete, or name person/original words/source | `SKILL.md:88-96` |
| 6 | “挑战与展望”模板 | 中文 AI 写作常见模式 | Formulaic challenges-and-outlook closing sections | Cut the outlook; state actual difficulties or delete | `SKILL.md:98-106` |
| 7 | 抽象动词吞掉具体动作 | 中文 AI 写作常见模式 | Clusters of abstract verbs/nouns hiding actor, action, object, result (赋能、打造、生态、闭环、抓手) | Restore who/what/whom/result/evidence; never swap jargon for jargon | `SKILL.md:108-116` |
| 8 | 回避简单判断句 | 中文 AI 写作常见模式 | Copula avoidance via positioning declarations (定位于、致力于、作为……载体) | Use 是/做/有/负责 | `SKILL.md:118-126` |
| 9 | “不仅……更……”和先否后肯滥用 | 中文 AI 写作常见模式 | Mechanical negation-then-affirmation parallelism | State the point directly | `SKILL.md:128-136` |
| 10 | 强凑三点和排比 | 中文 AI 写作常见模式 | Forced triads / triple parallel structures | Reduce or vary; keep three only when the meaning has three parts | `SKILL.md:138-146` |
| 11 | 同义词轮换 | 中文 AI 写作常见模式 | Rotating labels for one referent, blurring reference | Merge sentences, pick one term | `SKILL.md:148-154` |
| 12 | 虚假的“从……到……”范围 | 中文 AI 写作常见模式 | "从 X 到 Y" where X and Y are not on one scale | Name the actual items | `SKILL.md:156-162` |
| 13 | 无主句和责任主体消失 | 中文 AI 写作常见模式 | Subjectless/passive sentences hiding the actor | Restore the actor and action | `SKILL.md:164-172` |
| 14 | 破折号、括号和补充说明过密 | 中文 AI 写作常见模式 | Dash/parenthesis overuse for dramatic pauses | Rewrite with full sentences; do **not** ban dashes outright | `SKILL.md:174-182` |
| 15 | 加粗和重点标记过多 | 中文 AI 写作常见模式 | Mechanical bolding of keywords in every paragraph | Drop bold, fold into prose | `SKILL.md:184-190` |
| 16 | “小标题：解释”式清单泛滥 | 中文 AI 写作常见模式 | Bullet lists where every item is a bold label plus colon | Convert to prose | `SKILL.md:192-199` |
| 17 | 标题对仗和口号化 | 中文 AI 写作常见模式 | Sloganized, parallel-couplet headings | Make the heading state the content | `SKILL.md:201-209` |
| 18 | 表情符号装饰结构 | 中文 AI 写作常见模式 | Emoji used as document hierarchy | Remove in reports/mail/docs; keep if the voice uses them | `SKILL.md:211-219` |
| 19 | 全角半角与引号混用 | 中文 AI 写作常见模式 | Mixed full-width/half-width punctuation, unmatched quotes, quotes on every concept | Normalize; keep proper nouns, quotations, code untouched | `SKILL.md:221-229` |
| 20 | 聊天机器人残留 | 中文 AI 写作常见模式 | Pasted chatbot wrappers (当然可以、以下是、希望对你有帮助) | Delete wrapper, keep content | `SKILL.md:231-239` |
| 21 | 知识边界免责声明与猜测补洞 | 中文 AI 写作常见模式 | Cutoff disclaimers and plausible-but-invented filler | State that sources are silent, or delete | `SKILL.md:241-249` |
| 22 | 讨好和附和 | 中文 AI 写作常见模式 | Sycophancy (你说得太对了、毫无疑问、显然) | State the point plainly | `SKILL.md:251-257` |
| 23 | 冗余套话 | 中文 AI 写作常见模式 | Filler phrases (在当前这个时间节点、基于……的基础上、进行深入分析) | Compress to the plain form; 5 substitution examples given | `SKILL.md:259-267` |
| 24 | 过度限定 | 中文 AI 写作常见模式 | Stacked hedges | Keep only supported qualification; do not delete real uncertainty | `SKILL.md:269-275` |
| 25 | 万能正能量结尾 | 中文 AI 写作常见模式 | Generic upbeat closers (未来可期、让我们拭目以待) | Delete; end on the last concrete fact | `SKILL.md:277-283` |
| 26 | 四字词和成语连用 | 中文 AI 写作常见模式 | Strings of four-character idioms for momentum without information | State the concrete task/owner/date instead | `SKILL.md:285-291` |
| 27 | 权威口吻和“本质论” | 中文 AI 写作常见模式 | Pseudo-profound authority (归根结底、底层逻辑是、毋庸置疑) | Replace with the concrete dependency | `SKILL.md:293-301` |
| 28 | 预告式开场和导航话术 | 中文 AI 写作常见模式 | Signposting openings (让我们一起、下面将从三个方面、先说结论) | Cut the run-up; start with the point | `SKILL.md:303-311` |
| 29 | 标题后重复标题 | 中文 AI 写作常见模式 | Heading restated verbatim in the first sentence | Delete the restatement | `SKILL.md:313-325` |
| 30 | 以“修改过程”为中心写正文 | 中文 AI 写作常见模式 | Diff-anchored prose in non-changelog text (新增/优化/调整 former state) | Describe current behavior | `SKILL.md:327-333` |
| 31 | 人造金句和短句连击 | 中文 AI 写作常见模式 | Manufactured punchlines / staccato fragment runs | Merge into a sentence with a specific claim | `SKILL.md:335-341` |
| 32 | 空洞比喻和格言公式 | 中文 AI 写作常见模式 | Empty metaphor/aphorism formulas (X 是 Y 的底色、不是工具而是镜子) | Replace with the specific claim | `SKILL.md:343-349` |
| 33 | 假装坦诚的反问开头 | 中文 AI 写作常见模式 | Fake-candor rhetorical openers (说实话？、问题来了) | State the judgement directly | `SKILL.md:351-359` |

**Total count: 33. Numbering is contiguous** (verified programmatically: heading numbers parsed from `SKILL.md` equal `range(1,34)`; the repo's own validator asserts the same at `scripts/validate-package.py:52-54`).

## 5. Chinese-specific language handling

**Punctuation and full/half-width.** Pattern 19 is a Chinese-only pattern with no upstream English analogue: it targets mixed-width punctuation and quotes on every concept, e.g. `我们提出了“用户第一”,并建立所谓的"增长闭环"。` → `我们提出“用户第一”，并建立所谓的“增长闭环”。` (`SKILL.md:221-227`). It carries an explicit carve-out: `专有名词、直接引语和代码中的符号保持原样。` (`SKILL.md:229`).

**Dashes.** The upstream English rule (blader §8, current §14) is an absolute ban on em/en dashes. This repo deliberately does **not** localize that as a ban, because Chinese uses dashes and brackets differently: `不要一律删除破折号。用户样稿稳定使用时，保留相近频率；书名号、连接号和数值范围也不是此规则的对象。` (`SKILL.md:182`). `LOCALIZATION.md:28` records the same decision: `破折号和括号过密；不执行英语版的绝对禁用`.

**Translationese (翻译腔).** The core translationese target is the appended result/purpose tail — `从而、进而、进一步、有效推动、助力实现、持续赋能，以长串结果状语收尾` (`SKILL.md:70`) — which stands in for the English shallow `-ing` rider. The issue is diagnosed as adding `没有证据的效果和意义` (`SKILL.md:72`).

**Register.** `匹配用途和语气。公文、论文、合同、技术文档应准确克制；个人文章和社交内容可以有态度、犹豫、幽默和不完全对称的节奏。` (`SKILL.md:24`). Voice calibration forbids upgrading colloquial text into written register and forbids "correcting" deliberate dialect or internet slang: `不要把口语升级成书面语，也不要把有意保留的方言、网络用语或个人怪癖“纠正”掉。` (`SKILL.md:44`).

**Rhythm.** Sentence-length variation and "short/long alternation" are protected rather than prescribed as a formula; `避免误伤` lists 长短句变化 among genuinely human traits to preserve (`SKILL.md:365`).

**Idioms and four-character compounds.** Pattern 26 targets idiom strings (`凝心聚力、守正创新、踔厉奋发、笃行不怠`) that `制造气势但没有信息` (`SKILL.md:287`), with the fix `原文没有说明具体任务、负责人或时间` (`SKILL.md:291`). `LOCALIZATION.md:31` maps this to upstream's hyphenated-word-pair pattern: `四字词、成语和政策口号连用`.

**Explicit do-not list (false positives).** `不要把以下特征单独当成 AI 证据：语法正确、风格稳定、正式词汇、一个常用转折词、单个破折号、单句短句、引号、列表或没有引用来源。` (`SKILL.md:363`). It also states the general rule that single words or single punctuation marks are never sufficient evidence (`LOCALIZATION.md:16`). Conversely it lists traits to preserve: `具体而古怪的细节、矛盾感受、时代和圈层用语、可解释的个人选择、长短句变化、真实的插话和自我修正` (`SKILL.md:365`).

## 6. Detectors and algorithms

**Purely prose instructions to a language model. There is no executable detection logic for the text itself.** There are zero regexes, token lists, scoring functions, or model calls in the skill runtime. The words `赋能、打造、深度…` are presented as things to *examine*, not as a blocklist — `单个词未必有问题；多个抽象词连续出现，会掩盖主体、动作、对象、结果和证据。` (`SKILL.md:112`). `LOCALIZATION.md:16` states the design intent: `优先描述可观察的中文表达，不制作“AI 词汇黑名单”。`

The only executable code in the repo is `scripts/validate-package.py`, which validates the **package**, not user text (see §9).

**Watched-phrase lists** (20 `**留意：**` lists plus 3 inline ones). Enumerated verbatim by line:

| Line | Watched phrases |
|---|---|
| `SKILL.md:50` | 标志着、彰显了、体现了、具有里程碑意义、注入新动能、开启新篇章、为……奠定基础、推动……迈上新台阶 |
| `SKILL.md:60` | 多家权威媒体报道、业内广泛关注、获得众多大咖认可、全网热议 |
| `SKILL.md:70` | 从而、进而、进一步、有效推动、助力实现、持续赋能，以长串结果状语收尾 |
| `SKILL.md:80` | 匠心打造、重磅推出、震撼来袭、沉浸式、全方位、极致、卓越、引领、焕新升级、宝藏、必打卡 |
| `SKILL.md:90` | 有专家表示、业内人士认为、研究表明、相关数据显示、据悉、普遍认为 |
| `SKILL.md:100` | 尽管面临诸多挑战、机遇与挑战并存、未来仍需、展望未来、砥砺前行 |
| `SKILL.md:110` | 深度、全面、持续、精准、高效、赋能、助力、打造、构建、聚焦、围绕、着力、维度、场景、生态、闭环、抓手、底层逻辑 |
| `SKILL.md:120` | 定位于、致力于、旨在、作为……载体、扮演……角色、成为……的重要抓手 |
| `SKILL.md:130` | 不仅是……更是……、不只是……而是……、不是……而是……、绝非……这么简单 |
| `SKILL.md:140` | “第一、第二、第三”无论内容是否适合；三组同构短语；“更快、更准、更智能” |
| `SKILL.md:166` | 已完成、得到有效提升、问题被解决、无需配置、自动保存 |
| `SKILL.md:203` | 几乎所有标题都做成“洞察趋势：解码未来”“破局增长，共创未来” |
| `SKILL.md:233` | 当然可以、好的没问题、以下是、希望对你有帮助、如果需要我可以继续、欢迎随时告诉我 |
| `SKILL.md:243` | 截至我的知识更新、根据现有公开信息、资料较为有限、可能、大概率、不排除、一直保持低调 |
| `SKILL.md:253` | 你说得太对了、这个问题非常棒、不得不佩服、毫无疑问、显然 |
| `SKILL.md:279` | 未来可期、让我们拭目以待、相信在共同努力下、书写新的篇章、行稳致远 |
| `SKILL.md:295` | 归根结底、从本质上看、真正重要的是、核心在于、底层逻辑是、毋庸置疑 |
| `SKILL.md:305` | 让我们一起、接下来带你、下面将从三个方面、话不多说、先说结论、看完你就懂了 |
| `SKILL.md:345` | X 是 Y 的底色、X 是通往 Y 的钥匙、不是工具而是镜子、让 X 成为可能、时间会给出答案 |
| `SKILL.md:353` | 说实话？、答案可能出乎意料、你真的了解……吗、问题来了、那么代价是什么 |
| `SKILL.md:267` | 替换表（非"留意"）：在当前这个时间节点→现在；基于……的基础上→基于……；进行深入分析→分析；有能力实现→可以；值得注意的是，数据显示→数据显示 |
| `SKILL.md:29` | 框架词（非"留意"）：赋能、打造、推动、构建、助力 |
| `SKILL.md:36` | 反例词（非"留意"）：赋能→助力/推动 |

## 7. Scoring and severity

`none found`. There is no numeric score, no severity tier, and no confidence value anywhere in `SKILL.md`. Severity is expressed only qualitatively and implicitly: `不要因为一两个词就武断判定` (`SKILL.md:21`) and the requirement to look for **co-occurring groups** of patterns, not single hits (`SKILL.md:363`). No pattern is labelled strong/weak, and no `*weak alone*` equivalent exists (contrast blader's current `SKILL.md:29`, which ranks patterns strongest-first and marks weak-alone tells).

## 8. Pipeline and rewrite workflow

The ordered process is `## 执行流程` (`SKILL.md:375-382`), prefaced by `## 核心任务` (`SKILL.md:17-25`):

1. `明确读者、用途和声线；信息不足但不影响安全改写时，采用与原文一致的语域。` (`SKILL.md:377`)
2. `标记成组出现的模式，保护事实、专名、数字、引语、引用和真正的不确定性。` (`SKILL.md:378`)
3. `对每处黑话检查“谁、做什么、对谁、什么结果、什么依据”。只从原文和用户补充中找答案。` (`SKILL.md:379`)
4. `写出初稿。优先用具体名词和明确动词；缺少细节时承认缺少，不用虚构细节填空。` (`SKILL.md:380`)
5. Self-check: `“哪里仍像批量生成的中文？”“是否只替换了黑话，没有恢复信息？”“是否新增了原文没有的事实或态度？”` (`SKILL.md:381`)
6. `修订终稿，核对信息完整性、中文标点、指代和语气。` (`SKILL.md:382`)

Preceded, inside `## 核心任务`, by the binding constraints: identify patterns without over-triggering (`SKILL.md:21`), keep information but not shape (`SKILL.md:22`), never add unsupported facts and ask when detail is needed (`SKILL.md:23`), match register (`SKILL.md:24`), obey explicit user instructions and user writing samples first (`SKILL.md:25`).

**Invocation modes** (`SKILL.md:367-373`): default pasted mode returns draft + short review + final; file mode rewrites only natural-language prose and preserves code blocks, frontmatter, data, link targets and formatting, with two internal review rounds before writing back (`SKILL.md:371`); embedded mode returns only the final text (`SKILL.md:373`). An important nuance: "the source does not say" belongs in review commentary, not mechanically in every final draft — `“原文没有说明”通常写在审校意见里，不要机械塞进每篇终稿。` (`SKILL.md:38`).

## 9. Automation and tooling

### `.github/workflows/sync-upstream.yml` (131 lines) — full contents reported

**Trigger:** `schedule: - cron: "17 1 * * 1"` (weekly, Mondays 01:17 UTC) plus `workflow_dispatch` (`sync-upstream.yml:3-6`). Permissions `contents: write`, `issues: write` (`:8-10`); concurrency group `sync-upstream`, `cancel-in-progress: false` (`:12-14`). Checkout uses `fetch-depth: 0` (`:20-22`).

**Exact upstream it syncs from.** `git remote add upstream https://github.com/blader/humanizer.git` followed by `git fetch upstream main` (`sync-upstream.yml:28-29`). **Upstream repository: `https://github.com/blader/humanizer` — branch `main`. No path/subdirectory is specified; the whole branch is fetched and merged.** The compare links likewise reference `blader:humanizer:main` (`:71`, `:112`).

**How it detects change:** `git merge-base --is-ancestor upstream/main HEAD` — if upstream `main` is already an ancestor of `HEAD` then `changed=false`; otherwise `changed=true` and it records `sha` and `short_sha` of `upstream/main` (`sync-upstream.yml:33-40`).

**What it does on change:** it attempts a conflict-free merge only — `git merge --no-commit --no-ff upstream/main` (`:51`), with `set +e` around it so a failure is captured, not fatal (`:50-53`).

- **On conflict** (`merge_status != 0`): it lists unmerged files, runs `git merge --abort` (`:60-61`), and opens a GitHub issue titled `[upstream-sync] Review upstream ${UPSTREAM_SHORT_SHA}` containing the upstream commit link, the compare URL `https://github.com/holygeek00/humanizer-zh-cn/compare/main...blader:humanizer:main`, the reason `merge conflicts`, and the conflicting file list (`:62-81`). It **deduplicates** — if an open issue with that exact title already exists it exits without creating another (`:63-65`).
- **On clean merge:** it runs `python3 scripts/validate-package.py` (`:92`). If validation **fails**, it aborts the merge (`:101`), writes an issue containing the first 120 lines of the validation log (`:107-122`), and **nothing is pushed** (issue text confirms: `merged without Git conflicts, but package validation failed. Nothing was pushed.` `:109`). If validation **passes**, it commits and pushes: `git commit -m "Sync upstream ${UPSTREAM_SHORT_SHA}"` then `git push origin HEAD:main` (`:130-131`).

**Auto-commit or PR?** It **auto-commits and pushes directly to `main`**, not a PR — but *only* when the merge was conflict-free **and** `validate-package.py` exited 0. Every other path stops and files an issue instead. This is exactly as documented in `LOCALIZATION.md:34-43` and `README.md:203-213`.

**`.github/workflows/validate.yml`** (29 lines): runs on `pull_request` and on pushes to `main`; sets up Node 22 and Python 3.12; runs `python3 scripts/validate-package.py`, then `npx --yes skills@1.5.20 add . --list`, then `claude plugin validate .` (`validate.yml:22-29`).

### `LOCALIZATION.md` (51 lines) — localisation mapping methodology

**Baseline and provenance declarations** (`LOCALIZATION.md:3-10`): upstream `blader/humanizer`; upstream author `Siqi Chen（GitHub 用户 blader）`; first localization baseline commit `523374dee72d67c7b2b5f858ea0094ffda49c3ac` labelled `（上游 2.9.1）`; license MIT with a statement that the original `LICENSE` and copyright notice are unaltered (`原始 LICENSE 和版权声明未经改写`); and an explicit disclaimer that this is a Chinese derivative, not the author's official translation (`本仓库是中文衍生版本，不是原作者维护的官方翻译。`).

**Six localisation principles** (`LOCALIZATION.md:14-19`): (1) preserve upstream's core safety boundary against inventing facts/numbers/names/dates/quotes/sources; (2) preserve the 33 numbered slots to make upstream change review easy, while allowing English-specific patterns to be replaced by functionally equivalent Chinese ones; (3) describe observable Chinese usage rather than building an "AI word blacklist" — a single word or punctuation mark is never sufficient evidence; (4) examples must not fake human-ness with invented detail; (5) skill name `humanizer-zh` with version scheme `<上游版本>-zh.<本地化版本>`; (6) treat jargon as an information-structure problem (check subject, action, object, result, evidence) rather than mechanically substituting `赋能`→`助力`.

**Explicit upstream→Chinese pattern mapping table** (`LOCALIZATION.md:23-32`), verbatim:

| 上游模式 | 中文处理 |
|---|---|
| Superficial `-ing` analyses | 句尾“从而、进而、助力、赋能”伪分析 |
| AI vocabulary | 抽象动词吞掉具体动作，如“赋能、聚焦、生态、闭环、抓手” |
| Copula avoidance | 回避“是、做、有”，改用“定位于、致力于、作为载体” |
| Em/en dashes | 破折号和括号过密；不执行英语版的绝对禁用 |
| Title Case headings | 对仗、冒号和口号式标题 |
| Curly quotes | 全角半角标点混用及概念滥加引号 |
| Hyphenated word pairs | 四字词、成语和政策口号连用 |
| Conversational openers | “说实话？问题来了”等假坦诚反问 |

Note this table accounts for 8 of the 33 patterns; the remaining mappings are implicit in the equal numbering (see §12).

**Auto-sync safety boundary** (`LOCALIZATION.md:34-43`): the scheduled workflow writes to `main` only when Git can merge without conflict **and** local package validation passes. It will **not** auto-push when: `SKILL.md`/README/metadata produce merge conflicts; the 33 numbering, skill name, version or plugin manifest are inconsistent; upstream deletes the license or changes package structure so provenance/license checks fail; or the sync script itself fails. In those cases it aborts the merge and creates an issue containing the upstream commit id, compare link and the files needing human handling.

**Human handling of upstream change** (`LOCALIZATION.md:45-51`): read the upstream diff from the current merge base to the new commit; classify the change (new rule / rule fix / packaging / license / docs); perform functionally equivalent Chinese localization and sync `SKILL.md`, README table, version history and plugin version together; keep the upstream commit link and state the correspondence in the commit/PR description; run repo validation before merging.

### `scripts/validate-package.py` (79 lines) — exactly what it asserts

It reads `SKILL.md`, `README.md`, `LOCALIZATION.md`, `LICENSE`, `.claude-plugin/plugin.json`, `agents/openai.yaml` and raises `SystemExit` on the first failure. Assertions, in order:

1. `SKILL.md` must start with YAML frontmatter matching `\A---\n(.*?)\n---\n` (`:26-29`).
2. Frontmatter must contain `name: humanizer-zh` (`:31-32`).
3. Frontmatter must **not** contain `compatibility:` or `allowed-tools:` (`:34-36`).
4. Frontmatter `version` must match `[0-9]+\.[0-9]+\.[0-9]+-zh\.[0-9]+` (`:38-42`); README must contain a version-history entry `- **<same pattern>**` (`:43-46`).
5. The version in `SKILL.md`, the version in `README.md`, and `plugin.json["version"]` must be **exactly one value** (`:48-50`).
6. Pattern headings must be exactly `1..33` contiguously: `re.findall(r"(?m)^### ([0-9]+)\. ", SKILL)` must equal `list(range(1, 34))` (`:52-54`).
7. README's pattern table rows `^| N |` must cover exactly the set `1..33` (`:56-58`).
8. `SKILL.md` must be **≤ 500 lines** ("portability budget") (`:60-61`).
9. Required upstream attribution: the concatenation of README + LOCALIZATION + LICENSE must contain all of `https://github.com/blader/humanizer`, `Siqi Chen`, and `Copyright (c) 2025 Siqi Chen` (`:63-71`).
10. `agents/openai.yaml` must contain both `humanizer-zh` and `$humanizer-zh` (`:73-74`).
11. `plugin.json["name"]` must be `humanizer-zh` and `plugin.json["license"]` must be `MIT` (`:76-77`).

On success it prints `Chinese Humanizer package v{version} is valid` (`:79`). **This is a package/prompt-consistency linter, not a text detector.** Its most notable behaviour for provenance purposes is assertion 9: the repo mechanically enforces retention of Siqi Chen's copyright string and the upstream URL.

## 10. Reusable modules and extraction plan

| module (file) | what it does | reuse recommendation | integration kind |
|---|---|---|---|
| `SKILL.md` — 33 pattern rules | Chinese AI-tell taxonomy with verbatim trigger phrases and corrected examples | High value for a Chinese rule set, but it is prose: it must be parsed into structured rules (id, name, trigger list, diagnosis, guidance) before the suite can run it. Parsing is mechanical because the layout is uniform and the 33 numbering is validator-enforced | **B** (markdown skill, needs parsing into rules) |
| `SKILL.md` — `## 先找回被黑话吃掉的信息` frame (`:27-40`) | Five-question information-recovery diagnostic (谁/做了什么/对谁/结果/依据) plus the no-synonym-swap rule | Reuse as the suite's *methodology* layer. This is a strategy, not a per-tell detector; do not wire it into the default execution path | **D** (methodology) |
| `SKILL.md` — `## 声线校准` (`:42-44`) | Voice-sample calibration: match sentence length, lexicon, openings, punctuation, fillers; never upgrade colloquial to formal; preserve dialect/slang | Strong candidate to standardize into the suite's unified voice interface | **C** (voice profile) |
| `SKILL.md` — `## 避免误伤` (`:361-365`) | Explicit false-positive do-not-flag list and human-trait preserve list | Reuse as a guard layer / suppression policy for any detector | **B** (rule content needing parsing) |
| `SKILL.md` — 20 `**留意：**` watched-phrase lists | Chinese trigger lexicons for 20 of 33 patterns | Extract into structured trigger data for the suite (not as a blocklist — the skill itself insists triggers are context-dependent) | **B** (needs parsing into rules) |
| `scripts/validate-package.py` | 11 package-consistency assertions incl. mandatory Siqi Chen attribution + 33-pattern contiguity | Adapt into a **provenance/license gate** for the suite: verify upstream attribution strings and pattern-count contiguity for every derived rule set | **A** (executable; adapter target) |
| `.github/workflows/sync-upstream.yml` | Weekly safe upstream sync: ancestor check → conflict-free merge attempt → validate → auto-push, else issue | Do not run in the new project. Read as a *pattern* for safe upstream tracking; the dedupe-issue and validate-before-push ideas are reusable as design notes | **D** (methodology / pipeline strategy) |
| `LOCALIZATION.md` (51 lines) | Declared baseline commit, 6 localisation principles, 8-row upstream→Chinese mapping table, sync safety boundary | High-value provenance documentation. Copy the *format* (baseline commit + per-pattern mapping) into the suite's provenance register | **E** (research-only) as executable content, but its mapping table is the single best provenance artifact in the repo |
| `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` | Claude Code plugin + marketplace manifests, version `2.9.1-zh.2` | Not needed unless the suite ships a Claude plugin; low reuse value | **E** (research-only) |
| `agents/openai.yaml` | OpenAI-compatible agent display name / short description / default prompt | Trivial; useful only as a manifest-shape example | **E** (research-only) |
| `AGENTS.md` (21 lines) | Maintenance contract: keep attribution, keep 33 numbering, version sync across three files, no machine-translation overwrite | Adopt its rules as suite governance for derived Chinese rule sets | **D** (methodology) |

## 11. License and provenance — CRITICAL

**What attribution is present**

- `LICENSE:1-3`: `MIT License` / `Copyright (c) 2025 Siqi Chen` — this is blader's original notice, **byte-identical in the copyright line** to `blader-humanizer/LICENSE:3` (`Copyright (c) 2025 Siqi Chen`), which is 1,066 bytes to this repo's 1,066 bytes.
- `SKILL.md:15`: `此版本基于 blader 的 [Humanizer](https://github.com/blader/humanizer)，并结合中文语境重新编写规则和例句。`
- `SKILL.md:386`: `本技能改编自 Siqi Chen（GitHub 用户 [blader](https://github.com/blader)）的 [Humanizer](https://github.com/blader/humanizer)，遵循 MIT 许可证。` … `中文规则是面向中文表达习惯的本地化改写，并非 Wikipedia 中文版规则的逐字翻译。`
- `README.md:224`: `本项目遵循 [MIT License](LICENSE)。原始版权声明 `Copyright (c) 2025 Siqi Chen` 保持不变。任何复制或重要部分的再分发都应附带该版权与许可声明。`
- `README.md:226-227`: `原项目：https://github.com/blader/humanizer` / `本地化维护：https://github.com/holygeek00/humanizer-zh-cn`
- `README.md:169`: `本项目 fork 并改编自 Siqi Chen（GitHub 用户 blader）的 blader/humanizer，不是原作者维护的官方中文版，也不是逐句翻译。`
- `LOCALIZATION.md:5-10`: upstream repo, upstream author, baseline commit `523374dee72d67c7b2b5f858ea0094ffda49c3ac`, and `许可证：MIT；原始 LICENSE 和版权声明未经改写`.
- `AGENTS.md:7`: `保留上游作者 Siqi Chen（blader）的署名、LICENSE 和上游链接。`
- `.claude-plugin/plugin.json:7-8`: `"author": {"name": "Siqi Chen (blader); Chinese localization by holygeek00", "url": "https://github.com/blader"}` and `:12` `"license": "MIT"`.

**Does it retain Siqi Chen's copyright notice and upstream link?** **Yes — both, and retention is machine-enforced.** `scripts/validate-package.py:63-71` fails the build if `https://github.com/blader/humanizer`, `Siqi Chen`, or the literal string `Copyright (c) 2025 Siqi Chen` is missing from README+LOCALIZATION+LICENSE. No MIT compliance problem was found for this repository.

**Declared derivation:** yes and specific — a fork/localization of `blader/humanizer` at baseline `523374dee72d67c7b2b5f858ea0094ffda49c3ac`, declared as upstream **2.9.1** (`LOCALIZATION.md:7`, `README.md:218`). Independently corroborated by git history: this clone contains blader's upstream commits (e.g. `523374d` tagged `v2.9.1`, `a25db2d` tagged `v2.9.0`) as ancestors, i.e. it is a true GitHub fork, not a re-typed copy.

**One provenance nuance worth flagging:** the repo pins its baseline to 2.9.1 while the sync workflow tracks upstream `main` — which at the inventoried blader HEAD is `9862685` / version `3.0.0` with 25 patterns. The next successful scheduled sync would therefore try to merge a 25-pattern skill into a 33-pattern package and fail validation assertion 6 (`validate-package.py:52-54`), producing an issue rather than a push. That is the workflow behaving as designed (`LOCALIZATION.md:36-43`), but it means the repo will accumulate blocked sync issues until a human re-maps the pattern set.

## 12. Overlap and duplication signals — CRITICAL

This section is based on direct line-by-line comparison of three files read in full: `blader-humanizer/SKILL.md` (HEAD `9862685`, v3.0.0, 25 patterns, 374 lines), the same file at blader tag `v2.9.1` (commit `523374d`, 33 patterns), and this repo's `SKILL.md`.

### 12.1 The base structure is upstream 2.9.1, not upstream 3.0.0

At tag `v2.9.1` blader's `SKILL.md` contains exactly **33** numbered patterns in five sections, and this repo reproduces that list **one-for-one by number** (`v2.9.1:50-346` vs `SKILL.md:48-359`). Comparing English and Chinese pattern-by-pattern, **every one of the 33 slots corresponds to the same underlying tell**, with identical ordering and identical section sequence (内容 → 语言语法 → 风格 → 交流 → 填充/回避 ↔ CONTENT → LANGUAGE AND GRAMMAR → STYLE → COMMUNICATION → FILLER AND HEDGING).

| blader v2.9.1 # (English) | Chinese # | Verdict |
|---|---|---|
| Undue Emphasis on Significance, Legacy, and Broader Trends | 1 空泛拔高意义 | renamed |
| Undue Emphasis on Notability and Media Coverage | 2 用名气和媒体名单代替信息 | renamed |
| Superficial Analyses with -ing Endings | 3 句尾堆叠“从而/进而/助力”伪分析 | renamed (functionally re-targeted to Chinese tail clauses) |
| Promotional and Advertisement-like Language | 4 宣传稿和广告腔 | renamed |
| Vague Attributions and Weasel Words | 5 模糊归因和“据悉” | renamed |
| Outline-like "Challenges and Future Prospects" Sections | 6 “挑战与展望”模板 | renamed |
| Overused "AI Vocabulary" Words | 7 抽象动词吞掉具体动作 | renamed |
| Avoidance of "is"/"are" (Copula Avoidance) | 8 回避简单判断句 | renamed |
| Negative Parallelisms and Tailing Negations | 9 “不仅……更……”和先否后肯滥用 | renamed |
| Rule of Three Overuse | 10 强凑三点和排比 | renamed |
| Elegant Variation (Synonym Cycling) | 11 同义词轮换 | renamed |
| False Ranges | 12 虚假的“从……到……”范围 | renamed |
| Passive Voice and Subjectless Fragments | 13 无主句和责任主体消失 | renamed |
| Em Dashes (and En Dashes): Cut Them | 14 破折号、括号和补充说明过密 | renamed (ban relaxed — §5) |
| Overuse of Boldface | 15 加粗和重点标记过多 | renamed |
| Inline-Header Vertical Lists | 16 “小标题：解释”式清单泛滥 | renamed |
| Title Case in Headings | 17 标题对仗和口号化 | renamed |
| Emojis | 18 表情符号装饰结构 | renamed |
| Curly Quotation Marks | 19 全角半角与引号混用 | renamed (expanded: punctuation mixing) |
| Collaborative Communication Artifacts | 20 聊天机器人残留 | renamed |
| Knowledge-Cutoff Disclaimers and Speculative Gap-Filling | 21 知识边界免责声明与猜测补洞 | renamed |
| Sycophantic/Servile Tone | 22 讨好和附和 | renamed |
| Filler Phrases | 23 冗余套话 | renamed |
| Excessive Hedging | 24 过度限定 | renamed |
| Generic Positive Conclusions | 25 万能正能量结尾 | renamed |
| Hyphenated Word Pair Overuse | 26 四字词和成语连用 | renamed (functionally equivalent for Chinese) |
| Persuasive Authority Tropes | 27 权威口吻和“本质论” | renamed |
| Signposting and Announcements | 28 预告式开场和导航话术 | renamed |
| Fragmented Headers | 29 标题后重复标题 | renamed |
| Diff-Anchored Writing | 30 以“修改过程”为中心写正文 | renamed |
| Manufactured Punchlines and Staccato Drama | 31 人造金句和短句连击 | renamed |
| Aphorism Formulas | 32 空洞比喻和格言公式 | renamed |
| Conversational Rhetorical Openers | 33 假装坦诚的反问开头 | renamed |

**Counts versus blader v2.9.1 (the actual baseline): shared concept 33/33; renamed 33/33; added 0; dropped 0; re-numbered 0.** No Chinese pattern name is a literal translation of the English heading; every name is a re-coinage consistent with the declared policy of functional-equivalent rather than literal localisation (`LOCALIZATION.md:15`, `README.md:169-177`).

**Counts versus blader 3.0.0 (the current upstream HEAD, 25 patterns):** the two structures do **not** align. 3.0.0 dropped the Chinese-oriented subjects and re-cut the list, and this repo's numbering tracks 2.9.1. The comparison against HEAD is therefore not a meaningful "dropped patterns" measure; against HEAD, this repo has **10 extra slots (2.9.1 #13–#19 block and #26–#33 block) that no longer exist as separate headings**, and it is missing 3.0.0's newer headings (`Not X but Y`, `One-line closers…` etc. are actually 3.0.0's own re-cut). Treat the 2.9.1 comparison as authoritative for lineage.

### 12.2 Independent-translation signals (this repo did NOT copy repo B's Chinese)

This is the decisive test for the second Chinese repo, `op7418/Humanizer-zh` (whose SKILL.md was also read in full, 484 lines). Both repos translate blader, but from different versions, and the translations do not match:

- **Exact pattern-heading equality: 0 out of 24.** Every one of repo B's 24 headings differs from the corresponding heading here. Examples: B `1. 过度强调意义、遗产和更广泛的趋势` (`op7418 SKILL.md:82`) vs this repo `1. 空泛拔高意义` (`SKILL.md:48`); B `7. 过度使用的"AI 词汇"` (`:168`) vs `7. 抽象动词吞掉具体动作` (`:108`); B `9. 否定式排比` (`:196`) vs `9. “不仅……更……”和先否后肯滥用` (`:128`).
- **Shared long Chinese fragments (≥12 characters): 2, and both are the YAML keys** `name: humanizer-zh` and `description: |` — i.e. incidental, not content.
- **Every one of repo B's flagship translated examples is absent here.** B's translated Catalan statistics example `加泰罗尼亚统计局` (`op7418 SKILL.md:89`) — not found in this repo's SKILL.md. B's `浩来河` (`:145`), `Korattur` (`:159`), `Gallery 825` (`:189`), `Alamata` (`:131`), `蓝帽花` (`:117`), `索马里` (`:175`), `大爆炸` (`:237`), `主角`/`英雄` (`:225`), `50 万粉丝` (`:103`), `中国科学院` (`:148`), `1994` (`:352`) — **none present**. This repo re-invented its examples from Chinese material instead: `本次办公室搬迁标志着公司发展迈入全新阶段` (`SKILL.md:54`), `这家宝藏民宿坐落于风景如画的古镇核心区` (`:84`), `AI 赋能业务增长` (`:40`).
- Only four incidental short strings coincide, all natural Chinese or unavoidable: `钥匙` and `镜子` (both inside descriptive lists of the aphorism/analogy formula, this repo `SKILL.md:345`, B `:322`/formula text), `坐落于` (this repo's sales-language example `:84`, B's watch list `:126`), and `法国大革命` (the chatbot-residue example, this repo `:237`, B `:338`).

**Verdict for §12.2: high confidence (confirmed by direct comparison) that `humanizer-zh-cn` is an independent Chinese localization of `blader/humanizer`, not a derivative of `op7418/Humanizer-zh`.**

### 12.3 Ten-plus exact Chinese phrases mapped to the blader tell they encode

All quotes below are verbatim from this repo's `SKILL.md`; the right column is the blader English phrase for the same tell (cited from blader `v2.9.1` where the wording is historical, or blader HEAD where noted).

| Chinese phrase (verbatim) | Evidence | blader English phrase it corresponds to |
|---|---|---|
| `标志着、彰显了、体现了、具有里程碑意义、注入新动能、开启新篇章、为……奠定基础、推动……迈上新台阶` | `SKILL.md:50` | `stands as a testament, a pivotal or crucial moment, plays a key role, marking or shaping the, setting the stage for, indelible mark` (v2.9.1 §1 "Words to watch") |
| `多家权威媒体报道、业内广泛关注、获得众多大咖认可、全网热议` | `SKILL.md:60` | `independent coverage, local/regional/national media outlets, active social media presence` (v2.9.1 §2) |
| `有专家表示、业内人士认为、研究表明、相关数据显示、据悉、普遍认为` | `SKILL.md:90` | `Experts argue, Observers have cited, Industry reports, Some critics argue` (v2.9.1 §5) |
| `从而、进而、进一步、有效推动、助力实现、持续赋能，以长串结果状语收尾` | `SKILL.md:70` | `highlighting, underscoring, emphasizing, ensuring, reflecting, symbolizing, contributing to` (v2.9.1 §3, superficial `-ing` analyses) |
| `定位于、致力于、旨在、作为……载体、扮演……角色、成为……的重要抓手` | `SKILL.md:120` | `serves as, stands as, functions as, marks, represents [a]` (v2.9.1 §8, copula avoidance) |
| `匠心打造、重磅推出、震撼来袭、沉浸式、全方位、极致、卓越、引领、焕新升级、宝藏、必打卡` | `SKILL.md:80` | `boasts, vibrant, profound, exemplifies, commitment to, natural beauty, nestled, in the heart of, renowned, must-visit, stunning` (v2.9.1 §4) |
| `尽管面临诸多挑战、机遇与挑战并存、未来仍需、展望未来、砥砺前行` | `SKILL.md:100` | `Despite its... faces several challenges..., Challenges and Legacy, Future Outlook` (v2.9.1 §6) |
| `未来可期、让我们拭目以待、相信在共同努力下、书写新的篇章、行稳致远` | `SKILL.md:279` | `the future looks bright, exciting times ahead, a step in the right direction` (v2.9.1 §24) |
| `归根结底、从本质上看、真正重要的是、核心在于、底层逻辑是、毋庸置疑` | `SKILL.md:295` | `the real question is, at its core, what really matters, fundamentally, the deeper issue` (blader HEAD §3 "Sayings that sound deep") |
| `让我们一起、接下来带你、下面将从三个方面、话不多说、先说结论、看完你就懂了` | `SKILL.md:305` | `Let's dive in, let's explore, let's break this down, here's what you need to know, without further ado` (blader HEAD §4) |
| `X 是 Y 的底色、X 是通往 Y 的钥匙、不是工具而是镜子、让 X 成为可能、时间会给出答案` | `SKILL.md:345` | `X is the Y of Z, X becomes a trap, X is not a tool but a mirror, the language of, the currency of` (blader HEAD §3) |
| `说实话？、答案可能出乎意料、你真的了解……吗、问题来了、那么代价是什么` | `SKILL.md:353` | `Honestly?, Look, Here's the thing, The thing is, Let's be honest, Real talk` (blader HEAD §4) |
| `除了……更……` family: `不仅是……更是……、不只是……而是……、不是……而是……、绝非……这么简单` | `SKILL.md:130` | `not X but Y; not just, not only, or not merely X, but Y; it's not X, it's Y` (blader HEAD §1) |
| `截至我的知识更新、根据现有公开信息、资料较为有限、可能、大概率、不排除、一直保持低调` | `SKILL.md:243` | `as of [date], up to my last training update, while specific details are limited, based on available information, likely [grew up, studied]` (blader HEAD §23) |
| `当然可以、好的没问题、以下是、希望对你有帮助、如果需要我可以继续、欢迎随时告诉我` | `SKILL.md:233` | `I hope this helps, Of course!, Certainly!, Would you like..., let me know, here is a...` (blader HEAD §22) |

**14 rows, exceeding the 10-quote minimum.** In addition, `LOCALIZATION.md:23-32` is the repo's own 8-row upstream→Chinese mapping table, which independently documents the derivation for shallow `-ing` analyses, AI vocabulary, copula avoidance, dashes, title case, curly quotes, hyphenated pairs and conversational openers.

### 12.4 Do the two Chinese repos duplicate each other?

**No. The two Chinese repositories do NOT duplicate each other, and they are not a two-step lineage.** Both are independently derived from `blader/humanizer`, but from **different upstream versions**, and the Chinese text is largely disjoint:

| Question | Finding |
|---|---|
| Same number of patterns? | A = 33 (`SKILL.md:48-359`); B = 24 (`op7418 SKILL.md:82-404`) |
| Same section taxonomy? | No. A has 5 typographic groups inside one Chinese heading; B has 5 English-style group headings rendered in Chinese (`内容模式/语言和语法模式/风格模式/交流模式/填充词和回避`) |
| Identical pattern names? | 0 of 24 |
| Identical translated examples? | 0 (B's 12+ canonical examples are absent from A) |
| Shared ≥12-char content fragments? | 2, both YAML keys |
| Same upstream version? | No. A declares baseline `523374dee72d67c7b2b5f858ea0094ffda49c3ac` = upstream 2.9.1 (`LOCALIZATION.md:7`); B's structure is exactly upstream `v2.1.0` (24 patterns, same headings, same English examples translated literally) |
| Same authorship? | No. A commits by `Naassh <719993988@qq.com>` / upstream `Siqi Chen`; B commits by `郭浩` and `歸藏` |
| Same repo mechanics? | No. A has `.github/workflows`, `scripts/validate-package.py`, `.claude-plugin/`, `agents/`, `AGENTS.md`, `LOCALIZATION.md`; B has only `SKILL.md`, `README.md`, `LICENSE`, `.gitignore` |

**Key dedupe finding:** the three repositories are **one lineage with one common ancestor, not three independent discoveries** — the ancestor is `blader/humanizer` (copyright `Siqi Chen`). However, they are **siblings, not a chain**: `humanizer-zh-cn` is not a copy of `op7418/Humanizer-zh`, and `op7418/Humanizer-zh` is not a copy of `humanizer-zh-cn`. The new project must count **one** upstream discovery (blader's 33-pattern taxonomy, itself derived from Wikipedia's "Signs of AI writing"), and must **not** treat the two Chinese repos as independent evidence of a pattern set — but it also cannot merge them into a single Chinese artifact, because their pattern sets (33 vs 24) and their example corpora genuinely differ.

The one respect in which the two Chinese repos *do* overlap is at the level of English source: A's patterns 1–12 and B's patterns 1–12 both name the same twelve blader tells in the same order, so the twelve *concepts* are triplicated. Their Chinese *wording* for those twelve is nevertheless different in every case except incidental short strings.

## 13. Integration recommendation

**Take it; make it the primary Chinese rule source for the suite, at rule level rather than as a runnable module.**

1. **Ingest and parse, do not execute.** `SKILL.md` is prompt text for a language model (integration kind **B**). Parse the 33 headings into structured rules: `id, name (verbatim Chinese), watched_phrases[], problem, before, after`. The uniform per-pattern layout and the validator-enforced contiguous 1–33 numbering make this a low-risk mechanical parse (`SKILL.md:48-359`; `validate-package.py:52-54`).
2. **Reuse its false-positive policy as a suppression layer.** `避免误伤` (`SKILL.md:361-365`) is the most operationally useful non-rule asset: it names the nine single features that must never trigger alone (语法正确、风格稳定、正式词汇、一个常用转折词、单个破折号、单句短句、引号、列表、没有引用来源). Encode this as a gate in front of any Chinese detector, including the executable detector from `judetelan/ai-humanizer`.
3. **Adopt the five-question jargon diagnostic as suite methodology, not as a runtime rule.** `谁在做？/ 具体做了什么？/ 对谁或什么起作用？/ 产生了什么可观察的结果？依据是什么？` (`SKILL.md:29-36`) plus the anti-synonym-swap rule (`:36`) is a genuinely distinctive contribution and belongs in the methodology layer (kind **D**). Keep it out of the default execution path — it requires judgement the suite cannot automate.
4. **Adopt `声线校准` into the unified voice interface (kind C).** `SKILL.md:42-44` gives the calibration axes (句长、用词、段落开头、标点、口头禅、转折方式、信息密度) and two hard rules (never upgrade colloquial to formal; never "correct" dialect). This maps directly onto a shared voice-profile schema.
5. **Adapt `scripts/validate-package.py` into the suite's provenance gate (kind A).** Its assertion 9 — the package must contain the upstream URL, `Siqi Chen` and `Copyright (c) 2025 Siqi Chen` — is exactly the compliance check the suite needs for every vendored Chinese rule set. Generalize it to a table of (artifact → required attribution strings).
6. **Do not run `sync-upstream.yml`.** Read it as a design pattern only (kind D): ancestor-based change detection, merge-conflict abort, validate-before-push, deduplicated tracking issue. Note the live hazard in §11 — upstream `main` is now 3.0.0/25 patterns while this repo is 2.9.1/33, so the next sync will legitimately fail validation and open an issue.
7. **Record provenance from `LOCALIZATION.md`, not from README prose.** The baseline commit `523374dee72d67c7b2b5f858ea0094ffda49c3ac` and the 8-row mapping table (`LOCALIZATION.md:23-32`) are the strongest provenance artifacts in any of the two Chinese repos; copy that format into the suite's provenance register.
8. **Prefer this repo over `op7418/Humanizer-zh` as the Chinese base.** It is 33 patterns (vs 24), targets the newer upstream generation, declares its baseline commit, is MIT-compliant with machine-enforced attribution, ships a validator and CI, and is explicitly a functional-localisation rather than a literal translation. Use `op7418/Humanizer-zh` only for the few patterns this repo does not isolate (see §14) and for the `stop-slop`-derived scoring rubric.

## 14. Gaps, risks, and limitations

- **No executable detection.** Nothing in this repo can classify text without a language model in the loop (§6). Any suite requirement for deterministic, offline Chinese telling-detection is *not* satisfied here; that must come from `judetelan/ai-humanizer` or new code. **Confirmed by direct inspection: zero regexes, zero scoring functions, zero text-processing code.**
- **Baseline drift against upstream.** Baseline is 2.9.1 (33 patterns); upstream HEAD is 3.0.0 (25 patterns). The mapping in `LOCALIZATION.md:23-32` covers only 8 of 33 patterns explicitly; the remaining 25 mappings are implicit in the equal numbering and are **not documented** — a maintainer re-deriving them must read English and Chinese side by side. **This is a confirmed documentation gap, not a guess.**
- **Watch lists are context-dependent by design, so they cannot be lifted as-is into a naive regex engine.** `SKILL.md:112` explicitly says a single abstract word is not itself a problem; `SKILL.md:363` lists single-feature false positives. Any extraction into trigger lists must preserve the *co-occurrence* requirement or it will over-fire badly on legitimate Chinese business and government prose.
- **Two patterns cannot be English-derived at all.** Pattern 19 (`全角半角与引号混用`, `SKILL.md:221-229`) and pattern 26 (`四字词和成语连用`, `SKILL.md:285-291`) are Chinese-original patterns with no English upstream equivalent; `LOCALIZATION.md:30-31` maps them onto curly-quotes and hyphenated-pairs, which is an analogy, not an equivalence. Treat these two as new Chinese-domain rules, and credit them to `holygeek00`, not to blader.
- **Pattern-level overlap with `op7418/Humanizer-zh` is conceptual, not textual.** If the suite ingests both Chinese rule sets without dedupe, the twelve shared concepts (significance inflation, notability, `-ing`-style analysis, promotional language, vague attribution, challenges-and-outlook, AI vocabulary, copula avoidance, negative parallelism, rule of three, synonym cycling, false ranges) will appear **twice** with different Chinese names and different examples. That is a dedupe task, not a merge task.
- **The 33-slot numbering is a maintenance contract, not a pattern boundary.** `LOCALIZATION.md:15` permits replacing English-specific patterns with functionally equivalent Chinese ones inside the same slot. Slot identity therefore does **not** imply content equivalence — e.g. slot 14 is upstream's absolute dash ban but here a "too dense" heuristic (`SKILL.md:174-182`), and slot 19 is a Chinese punctuation rule with no upstream counterpart. Any automated comparison of the two Chinese repos against upstream must compare content, not numbers.
- **No machine-readable manifest of patterns.** There is no JSON/YAML pattern file; the README table (`README.md:129-163`) is a third hand-maintained copy of the names, kept in sync only by the validator's set-equality assertion (`validate-package.py:56-58`). Parsing `SKILL.md` headings is more reliable than parsing the README table, but note the validator guarantees the two *name sets* agree while not guaranteeing the names are spelled identically (it compares integer sets only).
- **Language coverage.** Simplified Chinese only. Traditional Chinese (Taiwan/Hong Kong) vocabulary and usage are explicitly unverified (`README.md:199-201`).
- **Not inspected in this inventory (out of scope, no claims made):** the git objects beyond HEAD metadata, GitHub issue history, upstream commit messages between 2.9.1 and 3.0.0, and any files not present in this shallow working tree. Derivation claims rest on file contents that were read in full.
