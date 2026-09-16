# Inventory: op7418/Humanizer-zh

_Read-only factual inventory. No file inside any repository directory was created, modified, or deleted. All Chinese strings are reproduced verbatim. Every claim carries a `file:line` anchor. Statements that could not be confirmed by direct comparison are marked explicitly._

## 1. Identity

| Field | Value | Evidence |
|---|---|---|
| Repository | `op7418/Humanizer-zh` (remote `https://github.com/op7418/Humanizer-zh.git`) | `.git/config`; `README.md:33-34` |
| Path inventoried | `\.upstream-cache\op7418-humanizer-zh` | — |
| Commit | `91f3d394db8419c20d67ebe22a96cf8fee0a404b` ("docs: 添加 npx 一键安装方式（推荐）", author `郭浩 <guohao@192.168.31.108>`, 2026-01-19) | `git log -1` |
| Branch | `main` | `git rev-parse --abbrev-ref HEAD` |
| Commit count in clone | 6 — a self-contained history with **no shared ancestry with blader**: `e4216e0 歸藏 Initial commit`, then five same-day commits by `郭浩` (`eb63401 feat: 初始化 Humanizer-zh 项目 - AI 写作去痕工具`; `0eb4e49 feat: 添加实用工具部分 - 核心规则、快速检查清单和质量评分`; `8767acc docs: 在 README 中添加 Stop Slop 项目引用`; `b4b4fe5 fix: 修正 YAML front matter 以符合 Claude Skills 规范`; `91f3d39 docs: 添加 npx 一键安装方式（推荐）`) | `git log`; `git rev-list --count HEAD` |
| License | MIT, file header `MIT License`, copyright line verbatim: `Copyright (c) 2026 歸藏` | `LICENSE:1-3` |
| Declared version | **none.** `SKILL.md` frontmatter has no `version:` and no `metadata.version` (`SKILL.md:1-16`); `README.md` contains no version history or version string. The only quantity declared is the pattern count: `本工具能够识别并修复 **24 种** AI 写作痕迹` (`README.md:125`) | `SKILL.md:1-16`, `README.md:125` |
| Languages | Chinese (Simplified) prose; English identifiers, tool names and technical terms; Chinese-style straight quotes `"…"` used throughout | `SKILL.md` |
| Text file count | 4 (excluding `.git/`): `SKILL.md`, `README.md`, `LICENSE`, `.gitignore` | directory listing |
| Total text size | 27,801 bytes | directory listing |
| Component sizes | `SKILL.md` 18,898 B / 484 lines; `README.md` 7,799 B / 239 lines; `LICENSE` 1,063 B / 21 lines; `.gitignore` 41 B | measured |

## 2. Purpose and functionality

A Chinese rewrite of the `blader/humanizer` skill: it detects AI-writing tells in text and rewrites the offending passages, preserving meaning and matching the intended tone (`SKILL.md:18-30`, `README.md:10-17`). It is intended for Claude Code (`README.md:31-58`).

It self-describes as a translation, not an original work: `本项目的核心文件翻译自 [blader/humanizer](https://github.com/blader/humanizer/tree/main)` (`README.md:4`), and declares a second source for its utility sections — `实用工具部分（核心规则、快速检查清单、质量评分）参考了 [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop)` (`README.md:5`).

Beyond blader's rule list it adds a **personality/voice section** (`SKILL.md:46-76`) arguing that removing AI patterns is only half the job: `避免 AI 模式只是工作的一半。无菌、没有声音的写作和机器生成的内容一样明显。` (`SKILL.md:48`), with six "soul" markers and concrete tactics (have opinions, vary rhythm, admit complexity, use 我, allow mess, be specific about feelings — `SKILL.md:60-70`). It also adds a **1–10 quality-scoring rubric totalling 50** (`SKILL.md:440-457`) and a **quick checklist** (`SKILL.md:406-415`).

## 3. Structure of SKILL.md

**YAML metadata** (`SKILL.md:1-16`): `name: humanizer-zh`; a five-line folded `description:` copied in structure from blader v2.1.0 (it even lists English-derived tells such as `以 -ing 结尾的肤浅分析`); `allowed-tools: Read, Write, Edit, AskUserQuestion`; `metadata.trigger: 编辑或审阅文本，去除 AI 写作痕迹`; and a `metadata.source` key that declares derivation — `source: 翻译自 blader/humanizer，参考 hardikpandya/stop-slop` (`SKILL.md:15`). **There is no `license:` key and no `version:` key.**

**Section layout** (in order):

| Line | Heading | Role |
|---|---|---|
| 18 | `# Humanizer-zh: 去除 AI 写作痕迹` | title |
| 20 | (lead paragraph) | role framing; attributes base guide to Wikipedia's "AI 写作特征" |
| 22 | `## 你的任务` | 5 numbered tasks |
| 34 | `## 核心规则速查` | 5 core principles (B-exclusive) |
| 46 | `## 个性与灵魂` | personality / soul section (B-exclusive) |
| 80 | `## 内容模式` | patterns 1–6 |
| 166 | `## 语言和语法模式` | patterns 7–12 |
| 244 | `## 风格模式` | patterns 13–18 |
| 326 | `## 交流模式` | patterns 19–21 |
| 368 | `## 填充词和回避` | patterns 22–24 |
| 406 | `## 快速检查清单` | 6-item pre-delivery checklist (B-exclusive) |
| 419 | `## 处理流程` | 5-step process |
| 432 | `## 输出格式` | output contract |
| 440 | `## 质量评分` | 50-point rubric (B-exclusive) |
| 460 | `## 完整示例` | full before/after example |
| 480 | `## 参考` | Wikipedia reference only |

**Pattern count: 24.** Numbering is **contiguous** — `### 1.` … `### 24.` with no gaps (`SKILL.md:82,96,110,124,138,152,168,182,196,208,220,232,246,258,270,284,298,312,328,342,356,370,382,394`). Unlike blader's current SKILL.md, the group headings are plain Chinese (`内容模式`, `语言和语法模式`, `风格模式`, `交流模式`, `填充词和回避`) rather than lettered sections.

**Per-pattern layout:** `### N. <name>`, then `**需要注意的词汇：**` (where applicable), then `**问题：**`, then `**改写前：**` / `**改写后：**` block quotes. Patterns 7 and 8 use `**高频 AI 词汇：**` and a differently-worded watch list. Patterns 9–12 carry `**问题：**` and examples but **no** watched-phrase list. Patterns 22–24 are the most compressed. Every pattern block is separated by a `---` horizontal rule.

## 4. Complete rule inventory

24 patterns, numbered 1–24, contiguous. Sections are the `##` group heading each pattern sits under.

| number | pattern name (verbatim Chinese) | section | what it detects | rewrite guidance summary | evidence (file:line) |
|---|---|---|---|---|---|
| 1 | 过度强调意义、遗产和更广泛的趋势 | 内容模式 | Statements that puff an arbitrary aspect into a broader trend or legacy | Keep the fact, drop the significance (no explicit instruction; shown by example only) | `SKILL.md:82-93` |
| 2 | 过度强调知名度和媒体报道 | 内容模式 | Notability claims; listing outlets without context | Show one substantive sourced fact instead | `SKILL.md:96-107` |
| 3 | 以 -ing 结尾的肤浅分析 | 内容模式 | English-style present-participle analysis tails (kept as "-ing" in the Chinese text) | Cut the tail; state the fact | `SKILL.md:110-121` |
| 4 | 宣传和广告式语言 | 内容模式 | Promotional/advertising adjectives, especially for "cultural heritage" topics | State what the thing is | `SKILL.md:124-135` |
| 5 | 模糊归因和含糊措辞 | 内容模式 | Vague authorities with no specific source | Cite a specific named study/source | `SKILL.md:138-149` |
| 6 | 提纲式的"挑战与未来展望"部分 | 内容模式 | Formulaic "challenges" sections | Replace with dated concrete events | `SKILL.md:152-163` |
| 7 | 过度使用的"AI 词汇" | 语言和语法模式 | High-frequency post-2023 AI vocabulary, especially co-occurring | Remove the words; keep the concrete claim | `SKILL.md:168-179` |
| 8 | 避免使用"是"（系动词回避） | 语言和语法模式 | Copula avoidance via 作为/代表/标志着/充当/拥有/设有 | Use 是/有 | `SKILL.md:182-193` |
| 9 | 否定式排比 | 语言和语法模式 | "不仅……而且……" / "这不仅仅是关于……，而是……" | State the point directly | `SKILL.md:196-205` |
| 10 | 三段式法则过度使用 | 语言和语法模式 | Forced groups of three | Use two items instead | `SKILL.md:208-217` |
| 11 | 刻意换词（同义词循环） | 语言和语法模式 | Synonym cycling driven by repetition-penalty behaviour | Merge into one sentence | `SKILL.md:220-229` |
| 12 | 虚假范围 | 语言和语法模式 | "从 X 到 Y" where X and Y are not on a meaningful scale | Name the actual topics | `SKILL.md:232-241` |
| 13 | 破折号过度使用 | 风格模式 | Em-dash overuse imitating punchy sales copy | Replace with commas/periods | `SKILL.md:246-255` |
| 14 | 粗体过度使用 | 风格模式 | Mechanical bolding of phrases | Remove bold | `SKILL.md:258-267` |
| 15 | 内联标题垂直列表 | 风格模式 | Lists whose items begin with bold headers and colons | Convert to prose | `SKILL.md:270-281` |
| 16 | 标题中的标题大写 | 风格模式 | Title Case in headings | Chinese note: `中文标题通常不涉及大小写问题，此模式在中文中不太适用。` — before and after text are identical | `SKILL.md:284-294` |
| 17 | 表情符号 | 风格模式 | Emoji decorating headings or bullets | Remove emoji, keep content | `SKILL.md:298-308` |
| 18 | 弯引号 | 风格模式 | Curly quotes instead of straight quotes; Chinese note says the Chinese manifestation is use of English quotes | Straight quotes | `SKILL.md:312-322` |
| 19 | 协作交流痕迹 | 交流模式 | Pasted chatbot correspondence (希望这对您有帮助、当然！、请告诉我) | Keep the content, drop the wrapper | `SKILL.md:328-338` |
| 20 | 知识截止日期免责声明 | 交流模式 | Knowledge-cutoff disclaimers | Cite a real document or drop the sentence | `SKILL.md:342-352` |
| 21 | 谄媚/卑躬屈膝的语气 | 交流模式 | Overly positive, people-pleasing language | Acknowledge the point neutrally | `SKILL.md:356-364` |
| 22 | 填充短语 | 填充词和回避 | Wordy filler phrases | Six "原 → 改" substitutions listed | `SKILL.md:370-378` |
| 23 | 过度限定 | 填充词和回避 | Over-qualifying statements | Drop stacked hedges | `SKILL.md:382-390` |
| 24 | 通用积极结论 | 填充词和回避 | Vague upbeat endings | Replace with a concrete plan | `SKILL.md:394-402` |

**Total count: 24. Numbering is contiguous.** `README.md:123-157` states the same count and the same four-group breakdown (6 + 6 + 6 + 6).

## 5. Chinese-specific language handling

**Overall posture: this is a near-literal translation, and the Chinese-specific handling is thin.** The skill keeps English-structure tells such as `以 -ing 结尾的肤浅分析` (`SKILL.md:110`) in its own heading and description (`SKILL.md:6`), and it keeps English examples of the phenomenon (`SKILL.md:114`: `AI 聊天机器人在句子末尾添加现在分词（"-ing"）短语来增加虚假深度。`).

**Explicit notes that a pattern does not transfer to Chinese — two cases only:**

- Title Case: `**注：** 中文标题通常不涉及大小写问题，此模式在中文中不太适用。` (`SKILL.md:294`). The before/after pair is consequently identical: both read `## 战略谈判与全球伙伴关系` (`SKILL.md:289`, `:292`).
- Curly quotes: `**注：** 中文通常使用中文引号（「」或""），此模式在中文中表现为英文引号的使用。` (`SKILL.md:322`).

**Punctuation.** No rule governs full-width versus half-width punctuation, quote-pairing, or the Chinese convention that proper nouns and code keep their original symbols. Pattern 13 (`SKILL.md:246-255`) and pattern 18 (`SKILL.md:312-322`) are translated English punctuation rules. This is a material gap: the highest-frequency mechanical Chinese AI tell (mixed-width punctuation) has no rule here.

**Full-width / half-width characters.** Not addressed anywhere — `none found` as an explicit rule.

**Translationese (翻译腔).** Not named as a category. The closest analogues are the translated English tells: `以 -ing 结尾的肤浅分析` (`SKILL.md:110`), `避免使用"是"（系动词回避）` (`SKILL.md:182`), `填充短语` (`SKILL.md:370`), `过度限定` (`SKILL.md:382`). There is no rule for Chinese-specific translationese such as result-clause tails (从而/进而/助力), abstract-verb jargon (赋能/抓手/闭环), or pseudo-causal constructions. Its AI-vocabulary list is a direct translation of blader's English list (`SKILL.md:170`; compare blader v2.1.0 §7 `Additionally, align with, crucial, delve, emphasizing, enduring, enhance, fostering, garner, highlight…`), which is why it contains calqued oddities like `织锦（抽象名词）` (a literal rendering of `tapestry`).

**Register.** `**维持语调** - 匹配预期的语气（正式、随意、技术等）` (`SKILL.md:29`). The personality section pushes the opposite direction for informal text, encouraging first person and mess: `**适当使用"我"。** 第一人称不是不专业——而是诚实。` (`SKILL.md:66`), `**允许一些混乱。** 完美的结构感觉像算法。跑题、题外话和半成型的想法是人性的体现。` (`SKILL.md:68`). No rule distinguishes public-document register (公文/论文/合同) from personal writing.

**Rhythm.** `**变化节奏** - 混合句子长度。两项优于三项。段落结尾要多样化` (`SKILL.md:40`), reinforced by the checklist items `连续三个句子长度相同？打断其中一个` and `段落以简洁的单行结尾？变换结尾方式` (`SKILL.md:410-411`).

**Idioms.** Not addressed. There is no rule for four-character idiom strings or slogan-style phrasing — a conspicuous gap for Chinese.

**Explicit do-not list (false positives).** `none found`. Unlike blader, this SKILL.md contains no "When not to act" / `What NOT to flag` section and no list of human-writing traits to preserve. The closest content is the personality section's *aspirational* list (`SKILL.md:50-56`), which is a list of symptoms of soulless writing, not a suppression policy.

**Self-inconsistency worth noting (confirmed by reading both sections):** pattern 10 tells the writer to prefer two items (`改写后`: `活动包括演讲和小组讨论。` `SKILL.md:216`) while pattern 40-style rhythm advice says `两项优于三项` (`SKILL.md:40`) — these agree; but pattern 14's `改写后` still contains a three-item list (`更新改进了界面，通过优化算法加快了加载时间，并添加了端到端加密。` `SKILL.md:280`), and pattern 2's `改写后` introduces a specific 2024 interview and a named source (`在 2024 年《纽约时报》的采访中，她认为 AI 监管应该关注结果而不是方法。` `SKILL.md:106`) that the `改写前` did not supply. The latter is a **fact-fabrication risk**: blader added an explicit no-fabrication rule and later restricted this exact example, but this repo's translation inherits the fabricated detail with no guardrail.

## 6. Detectors and algorithms

**Purely prose instructions to a language model. There is no executable detection logic of any kind.** There are zero scripts, zero regexes, zero scoring functions and zero model calls in the repository — the file list is `SKILL.md`, `README.md`, `LICENSE`, `.gitignore`. The quality rubric is a **prompt** to the model asking it to self-score, not code (`SKILL.md:440-457`).

**Watched-phrase lists** — 10 lists, 2 of which have special labels. Enumerated verbatim by line:

| Line | Label | Watched phrases |
|---|---|---|
| `SKILL.md:84` | `**需要注意的词汇：**` | 作为/充当、标志着、见证了、是……的体现/证明/提醒、极其重要的/重要的/至关重要的/核心的/关键性的作用/时刻、凸显/强调/彰显了其重要性/意义、反映了更广泛的、象征着其持续的/永恒的/持久的、为……做出贡献、为……奠定基础、标志着/塑造着、代表/标志着一个转变、关键转折点、不断演变的格局、焦点、不可磨灭的印记、深深植根于 |
| `SKILL.md:98` | `**需要注意的词汇：**` | 独立报道、地方/区域/国家媒体、由知名专家撰写、活跃的社交媒体账号 |
| `SKILL.md:112` | `**需要注意的词汇：**` | 突出/强调/彰显……、确保……、反映/象征……、为……做出贡献、培养/促进……、涵盖……、展示…… |
| `SKILL.md:126` | `**需要注意的词汇：**` | 拥有（夸张用法）、充满活力的、丰富的（比喻）、深刻的、增强其、展示、体现、致力于、自然之美、坐落于、位于……的中心、开创性的（比喻）、著名的、令人叹为观止的、必游之地、迷人的 |
| `SKILL.md:140` | `**需要注意的词汇：**` | 行业报告显示、观察者指出、专家认为、一些批评者认为、多个来源/出版物（实际引用却很少） |
| `SKILL.md:154` | `**需要注意的词汇：**` | 尽管其……面临若干挑战……、尽管存在这些挑战、挑战与遗产、未来展望 |
| `SKILL.md:170` | `**高频 AI 词汇：**` | 此外、与……保持一致、至关重要、深入探讨、强调、持久的、增强、培养、获得、突出（动词）、相互作用、复杂/复杂性、关键（形容词）、格局（抽象名词）、关键性的、展示、织锦（抽象名词）、证明、强调（动词）、宝贵的、充满活力的 |
| `SKILL.md:184` | `**需要注意的词汇：**` | 作为/代表/标志着/充当 [一个]、拥有/设有/提供 [一个] |
| `SKILL.md:330` | `**需要注意的词汇：**` | 希望这对您有帮助、当然！、一定！、您说得完全正确！、您想要……、请告诉我、这是一个…… |
| `SKILL.md:344` | `**需要注意的词汇：**` | 截至 [日期]、根据我最后的训练更新、虽然具体细节有限/稀缺……、基于可用信息…… |
| `SKILL.md:372-378` | (substitution table) | 为了实现这一目标→为了实现这一点；由于下雨的事实→因为下雨；在这个时间点→现在；在您需要帮助的情况下→如果您需要帮助；系统具有处理的能力→系统可以处理；值得注意的是数据显示→数据显示 |

An additional vocabulary list is duplicated in `README.md:206-213` (`常见 AI 词汇警示列表`): 此外、至关重要、深入探讨、强调 / 持久的、增强、培养、获得 / 突出、相互作用、复杂/复杂性 / 格局（抽象名词）、关键性的、展示 / 织锦（抽象名词）、证明、强调 / 宝贵的、充满活力的.

## 7. Scoring and severity

**Present — the only repo of the two with a numeric rubric.** `## 质量评分` (`SKILL.md:440-457`) instructs the model to score the rewritten text 1–10 on five dimensions totalling 50:

| 维度 | 评估标准 (verbatim) | 得分 |
|---|---|---|
| **直接性** | 直接陈述事实还是绕圈宣告？10 分：直截了当；1 分：充满铺垫 | /10 |
| **节奏** | 句子长度是否变化？10 分：长短交错；1 分：机械重复 | /10 |
| **信任度** | 是否尊重读者智慧？10 分：简洁明了；1 分：过度解释 | /10 |
| **真实性** | 听起来像真人说话吗？10 分：自然流畅；1 分：机械生硬 | /10 |
| **精炼度** | 还有可删减的内容吗？10 分：无冗余；1 分：大量废话 | /10 |
| **总分** | | **/50** |

Bands (`SKILL.md:454-456`): `45-50 分：优秀，已去除 AI 痕迹`; `35-44 分：良好，仍有改进空间`; `低于 35 分：需要重新修订`.

**Per-pattern severity: none.** No pattern is ranked, weighted, or marked as needing corroboration. There is no equivalent of blader's "strongest first" ordering or its `*weak alone*` marker. Severity exists only at the document level via the 50-point score.

## 8. Pipeline and rewrite workflow

Two ordered processes are given, and they are consistent with each other:

**`## 处理流程`** (`SKILL.md:419-430`), 5 steps:
1. `仔细阅读输入文本`
2. `识别上述所有模式的实例`
3. `重写每个有问题的部分`
4. `确保修订后的文本：` — `大声朗读时听起来自然` / `自然地改变句子结构` / `使用具体细节而不是模糊的主张` / `为上下文保持适当的语气` / `适当时使用简单的结构（是/有）`
5. `呈现人性化版本`

**`## 你的任务`** (`SKILL.md:22-30`), 5 steps: identify AI patterns → rewrite problematic sections → preserve meaning → maintain voice → `**注入灵魂** - 不仅要去除不良模式，还要注入真实的个性`.

**Pre-delivery quick checklist** (`SKILL.md:406-415`), 6 checks: three equal-length consecutive sentences → break one; paragraph ending on a terse single line → vary; dash before a reveal → delete; explaining a metaphor → trust the reader; connectives like 此外/然而 → consider deleting; three-item list → make it two or four.

**Output contract** (`SKILL.md:432-436`): `1. 重写后的文本` and `2. 所做更改的简要总结（如果有帮助，可选）`. The model is then asked to score the result (§7).

**Modes: none.** There is no file mode, no embedded mode, and no text-safety carve-out for code blocks, frontmatter, data or link targets — a regression versus blader, which defines all three invocation modes.

## 9. Automation and tooling

**`none found`.** Confirmed by full directory enumeration (excluding `.git/`): the repository contains exactly `SKILL.md`, `README.md`, `LICENSE` and `.gitignore` (41 bytes). There is:

- no `.github/` directory, therefore no workflows, no scheduled sync, no CI;
- no `scripts/` directory and no validator;
- no `.claude-plugin/` manifests;
- no `agents/` directory.

A `grep` for `op7418|stop-slop|hardikpandya|歸藏|Humanizer-zh` in repo A returned no matches, i.e. repo A has no knowledge of this repo; and no automation exists here that could push into any other repository. Upstream change tracking is entirely manual, and `README.md:215-217` invites contributions (`如果你发现翻译问题或想要改进文档，欢迎提交 Issue 或 Pull Request。`).

## 10. Reusable modules and extraction plan

| module (file) | what it does | reuse recommendation | integration kind |
|---|---|---|---|
| `SKILL.md` — 24 pattern rules | Chinese AI-tell taxonomy with translated watch lists and before/after examples | Moderate value, but **redundant with repo A for 24 of 24 concepts**. Do not ingest as a second rule set without dedupe. Two patterns are worth extracting on their own merit (see next rows) | **B** (markdown skill, needs parsing into rules) |
| `SKILL.md:284-294` — pattern 16 title-case note | States plainly that a blader pattern does not transfer to Chinese | Reuse the *note* as a porting caveat, not as a rule. Valuable as evidence of translation limits | **E** (research-only) |
| `SKILL.md:312-322` — pattern 18 curly-quote note | Maps a Western punctuation tell onto its Chinese manifestation (use of English quotes) | Low value next to repo A's richer full/half-width rule; keep only as a cross-check | **E** (research-only) |
| `SKILL.md:46-76` — `## 个性与灵魂` | Six tactics for injecting voice, incl. `对感受要具体` with a worked example (`SKILL.md:70`) | The best asset in this repo. Abstract into the suite's unified voice interface; the six markers are a usable checklist | **C** (voice profile) |
| `SKILL.md:440-457` — `## 质量评分` | 5-dimension 1–10 rubric totalling 50, with three bands | Reuse as an **evaluation harness** for rewrites. It is prose, so it must be converted into a structured rubric; treat the bands as tunable, not validated | **B** (needs parsing into structured criteria) |
| `SKILL.md:406-415` — `## 快速检查清单` | Six concrete post-rewrite checks | Reuse as a deterministic post-processing lint list (e.g. detect three consecutive equal-length sentences, detect a dash before a reveal, count list items) | **B** (needs parsing), and the checks are mechanizable into **A** |
| `SKILL.md:34-42` — `## 核心规则速查` | Five core principles (delete filler, break formulas, vary rhythm, trust the reader, delete quotable lines) | Reuse as a compact methodology preamble (kind D). Note `README.md:5` credits this section to `hardikpandya/stop-slop`; verify that attribution before reuse | **D** (methodology) |
| `SKILL.md:419-430` + `:432-436` — process and output format | 5-step process and an output contract | **Low value — these are verbatim copies of blader v2.1.0's `Process` and `Output Format`.** They are not this repo's work and add nothing over repo A | **E** (research-only) |
| `SKILL.md:460-477` — `## 完整示例` | Full before/after with a change log | **Verbatim translation of blader v2.1.0's `Full Example`.** Useful as a test fixture for the suite's Chinese rewrite evaluation | **E** (research-only) |
| `SKILL.md:170` + `README.md:206-213` — AI-vocabulary list | 21-item Chinese AI-word list | Overlaps repo A pattern 7 conceptually but is a *word list* rather than a usage diagnostic. Usable only as a weak signal source; repo A explicitly warns against blocklists | **B** (needs parsing; low priority) |
| LICENSE / README attribution block | Provenance disclosure | **Read as a compliance counter-example, not a template** — see §11 | **E** (research-only) |

## 11. License and provenance — CRITICAL

**What attribution is present (quoted verbatim):**

- `README.md:3-6` — a prominent front-page disclosure block:
  > `> **声明：**`
  > `> - 本项目的核心文件翻译自 [blader/humanizer](https://github.com/blader/humanizer/tree/main)`
  > `> - 实用工具部分（核心规则、快速检查清单、质量评分）参考了 [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop)`
  > `> - 原项目基于维基百科的 [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) 指南`
- `README.md:164` — `**注：** 英文原版请参考 [blader/humanizer](https://github.com/blader/humanizer)`
- `README.md:228-231` — reference list including `[blader/humanizer](https://github.com/blader/humanizer) - 原始英文版项目`
- `SKILL.md:15` — machine-readable declaration: `  source: 翻译自 blader/humanizer，参考 hardikpandya/stop-slop`
- `SKILL.md:482-484` — `本技能基于 [Wikipedia:Signs of AI writing](...)` plus the Wikipedia key-insight quotation
- `README.md:233-235` — `## 许可` / `本翻译项目遵循原项目的许可协议。核心内容基于维基百科社区的观察和总结。` — a statement of intent to comply, **with no license text of its own** and no named licensor.
- `LICENSE:1-3` — the only copyright line in the repository: `MIT License` / `Copyright (c) 2026 歸藏`

**Does it retain Siqi Chen's copyright notice and upstream link?** **The upstream link: yes (five separate places, listed above). Siqi Chen's copyright notice: NO — it appears nowhere in the repository.** Confirmed by direct search of `README.md` and `SKILL.md` for `Siqi` (0 matches) and by reading `LICENSE` in full: the file is a bare MIT text whose copyright line names only `歸藏`, with no reproduction of `Copyright (c) 2025 Siqi Chen` and no third-party notices section.

**MIT compliance verdict: this is an MIT compliance problem.** The MIT License in blader's repository requires that `The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software` (`blader-humanizer/LICENSE:12-13`). This repository is a substantial portion — it reproduces all 24 of blader's pattern headings, their `Words to watch` lists, their before/after examples, the `Process` list, the `Output Format`, and the `Full Example`, translated. The only notice shipped is `Copyright (c) 2026 歸藏`, which replaces rather than supplements the upstream notice. A URL reference does not satisfy the notice-retention clause. **Confirmed by direct document comparison; this is not a judgement call about intent, only about the text of the license.**

**Attribution gap in the other direction as well (confirmed):** `README.md:5` credits `hardikpandya/stop-slop` for `核心规则、快速检查清单、质量评分`. Portions that `README.md` credits to *no one* are in fact verbatim translations of blader v2.1.0, notably the process list and output format. Note also that `README.md:197-202` reproduces blader's own change log for the full example (`删除了夸大的象征意义（"作为……的证明"）`, `删除了 AI 词汇（"此外"、"无缝"）`, `删除了三段式法则（"无缝、直观和强大"）`, `删除了否定式排比（"不仅仅是……而是……"）`) while crediting it to nobody:

| This repo (verbatim Chinese) | blader v2.1.0 (verbatim English, commit `47a6432`) |
|---|---|
| `3. 重写每个有问题的部分` (`SKILL.md:423`) | `3. Rewrite each problematic section` |
| `大声朗读时听起来自然` (`:425`) | `Sounds natural when read aloud` |
| `自然地改变句子结构` (`:426`) | `Varies sentence structure naturally` |
| `使用具体细节而不是模糊的主张` (`:427`) | `Uses specific details over vague claims` |
| `为上下文保持适当的语气` (`:428`) | `Maintains appropriate tone for context` |
| `适当时使用简单的结构（是/有）` (`:429`) | `Uses simple constructions (is/are/has) where appropriate` |
| `1. 重写后的文本` / `2. 所做更改的简要总结（如果有帮助，可选）` (`:435-436`) | `1. The rewritten text` / `2. A brief summary of changes made (optional, if helpful)` |

The `README.md:5` credit to `stop-slop` for `实用工具部分` is therefore at minimum incomplete: the utility sections are a mixture, and the process/output portions trace to blader.

**Declared derivation:** yes, and specific about the source repository (`翻译自 blader/humanizer`, `SKILL.md:15`), but **it does not declare a version or commit**. Repo A by contrast declares baseline commit `523374dee72d67c7b2b5f858ea0094ffda49c3ac` (upstream 2.9.1). Independently determined from structure and text, this repo's actual baseline is upstream **v2.1.0** (commit `47a6432`) — see §12.

## 12. Overlap and duplication signals — CRITICAL

### 12.1 The upstream is blader v2.1.0 — hard evidence

This repo does **not** derive from blader's current SKILL.md, and it does not derive from the 33-pattern generation. It is a **structure-and-example-exact translation of blader v2.1.0** (commit `47a6432`, `v2.1.0: Add before/after examples for all patterns`, 2026-01-17 — two days before this repo's commits).

| This repo (verbatim Chinese) | blader v2.1.0 (verbatim English) | Anchor |
|---|---|---|
| `本指南基于维基百科的"AI 写作特征"页面，由 WikiProject AI Cleanup 维护。` | `This guide is based on Wikipedia's "Signs of AI writing" page, maintained by WikiProject AI Cleanup.` | `SKILL.md:20` |
| `1. **识别 AI 模式** - 扫描下面列出的模式` | `1. **Identify AI patterns** - Scan for the patterns listed below` | `SKILL.md:26` |
| `2. **重写问题片段** - 用自然的替代方案替换 AI 痕迹` | `2. **Rewrite problematic sections** - Replace AI-isms with natural alternatives` | `SKILL.md:27` |
| `3. **保留含义** - 保持核心信息完整` | `3. **Preserve meaning** - Keep the core message intact` | `SKILL.md:28` |
| `4. **维持语调** - 匹配预期的语气（正式、随意、技术等）` | `4. **Maintain voice** - Match the intended tone (formal, casual, technical, etc.)` | `SKILL.md:29` |
| `加泰罗尼亚统计局于 1989 年正式成立，标志着西班牙区域统计演变史上的关键时刻。` | `The Statistical Institute of Catalonia was officially established in 1989, marking a pivotal moment in the evolution of regional statistics in Spain.` | `SKILL.md:89` |
| `她的观点被《纽约时报》、BBC、《金融时报》和《印度教徒报》引用。她在社交媒体上拥有活跃的存在，拥有超过 50 万粉丝。` | `Her views have been cited in The New York Times, BBC, Financial Times, and The Hindu. She maintains an active social media presence with over 500,000 followers.` | `SKILL.md:103` |
| `寺庙的蓝色、绿色和金色色调与该地区的自然美景产生共鸣，象征着德克萨斯州的蓝帽花、墨西哥湾和多样化的德克萨斯州景观` | `The temple's color palette of blue, green, and gold resonates with the region's natural beauty, symbolizing Texas bluebonnets, the Gulf of Mexico, and the diverse Texan landscapes` | `SKILL.md:117` |
| `坐落在埃塞俄比亚贡德尔地区令人叹为观止的区域内，Alamata Raya Kobo 是一座充满活力的城镇` | `Nestled within the breathtaking region of Gonder in Ethiopia, Alamata Raya Kobo stands as a vibrant town` | `SKILL.md:131` |
| `由于其独特的特征，浩来河引起了研究人员和保护主义者的兴趣。专家认为它在区域生态系统中发挥着至关重要的作用。` | `Due to its unique characteristics, the Haolai River is of interest to researchers and conservationists. Experts believe it plays a crucial role in the regional ecosystem.` | `SKILL.md:145` |
| `尽管工业繁荣，Korattur 面临着城市地区典型的挑战` | `Despite its industrial prosperity, Korattur faces challenges typical of urban areas` | `SKILL.md:159` |
| `此外，索马里菜肴的一个显著特征是加入骆驼肉。意大利殖民影响的持久证明是当地烹饪格局中广泛采用意大利面` | `Additionally, a distinctive feature of Somali cuisine is the incorporation of camel meat. An enduring testament to Italian colonial influence is the widespread adoption of pasta in the local culinary landscape` | `SKILL.md:175` |
| `Gallery 825 作为 LAAA 的当代艺术展览空间。` | `Gallery 825 serves as LAAA's exhibition space for contemporary art.` | `SKILL.md:189` |
| `这不仅仅是节拍在人声下流动；它是攻击性和氛围的一部分。这不仅仅是一首歌，而是一种声明。` | `It's not just about the beat riding under the vocals; it's part of the aggression and atmosphere. It's not merely a song, it's a statement.` | `SKILL.md:201` |
| `活动包括主题演讲、小组讨论和社交机会。与会者可以期待创新、灵感和行业洞察。` | `The event features keynote sessions, panel discussions, and networking opportunities. Attendees can expect innovation, inspiration, and industry insights.` | `SKILL.md:213` |
| `主人公面临许多挑战。主要角色必须克服障碍。中心人物最终获得胜利。英雄回到家中。` | `The protagonist faces many challenges. The main character must overcome obstacles. The central figure eventually triumphs. The hero returns home.` | `SKILL.md:225` |
| `我们穿越宇宙的旅程将我们从大爆炸的奇点带到宏伟的宇宙网` | `Our journey through the universe has taken us from the singularity of the Big Bang to the grand cosmic web` | `SKILL.md:237` |
| `这个术语主要由荷兰机构推广——而不是由人民自己。` | `The term is primarily promoted by Dutch institutions—not by the people themselves.` | `SKILL.md:251` |
| `它融合了 **OKR（目标和关键结果）**、**KPI（关键绩效指标）**` | `It blends **OKRs (Objectives and Key Results)**, **KPIs (Key Performance Indicators)**` | `SKILL.md:263` |
| `- **用户体验：** 用户体验通过新界面得到显著改善。` | `- **User Experience:** The user experience has been significantly improved with a new interface.` | `SKILL.md:275` |
| `🚀 **启动阶段：** 产品在第三季度发布` | `🚀 **Launch Phase:** The product launches in Q3` | `SKILL.md:303` |
| `这是法国大革命的概述。希望这对您有帮助！如果您想让我扩展任何部分，请告诉我。` | `Here is an overview of the French Revolution. I hope this helps! Let me know if you'd like me to expand on any section.` | `SKILL.md:335` |
| `虽然关于公司成立的具体细节在现成资料中没有广泛记录，但它似乎是在 20 世纪 90 年代的某个时候成立的。` | `While specific details about the company's founding are not extensively documented in readily available sources, it appears to have been established sometime in the 1990s.` | `SKILL.md:349` |
| `好问题！您说得完全正确，这是一个复杂的话题。关于经济因素，这是一个很好的观点。` | `Great question! You're absolutely right that this is a complex topic. That's an excellent point about the economic factors.` | `SKILL.md:361` |
| `- "在这个时间点" → "现在"` | `- "At this point in time" → "Now"` | `SKILL.md:375` |
| `可以潜在地可能被认为该政策可能会对结果产生一些影响。` | `It could potentially possibly be argued that the policy might have some effect on outcomes.` | `SKILL.md:387` |
| `公司的未来看起来光明。激动人心的时代即将到来` | `The future looks bright for the company. Exciting times lie ahead` | `SKILL.md:399` |
| `新的软件更新作为公司致力于创新的证明。此外，它提供了无缝、直观和强大的用户体验——确保用户能够高效地完成目标。` | `The new software update serves as a testament to the company's commitment to innovation. Moreover, it provides a seamless, intuitive, and powerful user experience—ensuring that users can accomplish their goals efficiently.` | `SKILL.md:463` |
| `- 删除了"作为……的证明"（夸大的象征意义）` | `- Removed "serves as a testament" (inflated symbolism)` | `SKILL.md:469` |
| `关键见解：**"LLM 使用统计算法来猜测接下来应该是什么。结果倾向于适用于最广泛情况的统计上最可能的结果。"**` | `Key insight from Wikipedia: "LLMs use statistical algorithms to guess what should come next. The result tends toward the most statistically likely result that applies to the widest variety of cases."` | `SKILL.md:484` |

**Verdict: confirmed by direct comparison, high confidence. `op7418/Humanizer-zh` is a direct, near-literal Chinese translation of `blader/humanizer` at v2.1.0 (commit `47a6432`), with an added personality section, checklist and scoring rubric credited to `hardikpandya/stop-slop`.** The translation is faithful enough that examples are line-for-line renderings, including blader's `stop-slop`-era `## Full Example` (`SKILL.md:460-477`) and its change log.

### 12.2 Mapping table: blader 24 (v2.1.0) ↔ this repo's 24 ↔ repo A's 33

| blader pattern #N name (v2.1.0) | this repo pattern #N name | repo A pattern # | same/renamed/added/removed |
|---|---|---|---|
| 1. Undue Emphasis on Significance, Legacy, and Broader Trends | 1. 过度强调意义、遗产和更广泛的趋势 | A 1 空泛拔高意义 | same concept, renamed in both |
| 2. Undue Emphasis on Notability and Media Coverage | 2. 过度强调知名度和媒体报道 | A 2 用名气和媒体名单代替信息 | same concept, renamed in both |
| 3. Superficial Analyses with -ing Endings | 3. 以 -ing 结尾的肤浅分析 | A 3 句尾堆叠“从而/进而/助力”伪分析 | same concept, renamed in both |
| 4. Promotional and Advertisement-like Language | 4. 宣传和广告式语言 | A 4 宣传稿和广告腔 | same concept, renamed in both |
| 5. Vague Attributions and Weasel Words | 5. 模糊归因和含糊措辞 | A 5 模糊归因和“据悉” | same concept, renamed in both |
| 6. Outline-like "Challenges and Future Prospects" Sections | 6. 提纲式的"挑战与未来展望"部分 | A 6 “挑战与展望”模板 | same concept, renamed in both |
| 7. Overused "AI Vocabulary" Words | 7. 过度使用的"AI 词汇" | A 7 抽象动词吞掉具体动作 | same concept; B keeps upstream framing, A re-targets to Chinese abstract-verb jargon |
| 8. Avoidance of "is"/"are" (Copula Avoidance) | 8. 避免使用"是"（系动词回避） | A 8 回避简单判断句 | same concept, renamed in both |
| 9. Negative Parallelisms | 9. 否定式排比 | A 9 “不仅……更……”和先否后肯滥用 | same concept, renamed in both |
| 10. Rule of Three Overuse | 10. 三段式法则过度使用 | A 10 强凑三点和排比 | same concept, renamed in both |
| 11. Elegant Variation (Synonym Cycling) | 11. 刻意换词（同义词循环） | A 11 同义词轮换 | same concept, renamed in both |
| 12. False Ranges | 12. 虚假范围 | A 12 虚假的“从……到……”范围 | same concept, renamed in both |
| 13. Em Dash Overuse | 13. 破折号过度使用 | A 14 破折号、括号和补充说明过密 | same concept; A relaxes it from a ban to an over-density heuristic |
| 14. Overuse of Boldface | 14. 粗体过度使用 | A 15 加粗和重点标记过多 | same concept, renamed in both |
| 15. Inline-Header Vertical Lists | 15. 内联标题垂直列表 | A 16 “小标题：解释”式清单泛滥 | same concept, renamed in both |
| 16. Title Case in Headings | 16. 标题中的标题大写 | A 17 标题对仗和口号化 | same concept; both note it barely applies to Chinese, both re-target it |
| 17. Emojis | 17. 表情符号 | A 18 表情符号装饰结构 | same concept, renamed in both |
| 18. Curly Quotation Marks | 18. 弯引号 | A 19 全角半角与引号混用 | same concept; A widens it into a full/half-width punctuation rule |
| 19. Collaborative Communication Artifacts | 19. 协作交流痕迹 | A 20 聊天机器人残留 | same concept, renamed in both |
| 20. Knowledge-Cutoff Disclaimers | 20. 知识截止日期免责声明 | A 21 知识边界免责声明与猜测补洞 | same concept; blader later widened it to include gap-filling, A includes it, B does not |
| — (not in v2.1.0) | — | A 13 无主句和责任主体消失 | **added by A**; corresponding tell exists in blader 2.9.1 §13 (Passive Voice and Subjectless Fragments), i.e. added *upstream* after v2.1.0 |
| — | — | A 22 讨好和附和 | **added by A**; matches blader 2.9.1 §22 (Sycophantic/Servile Tone) — present upstream after v2.1.0 |
| — | — | A 23 冗余套话 | **added by A**; matches blader 2.9.1 §23 (Filler Phrases) |
| — | — | A 24 过度限定 | **added by A**; matches blader 2.9.1 §24 (Excessive Hedging) |
| 21. Sycophantic/Servile Tone | 21. 谄媚/卑躬屈膝的语气 | (A 22) | same concept, renamed in both |
| 22. Filler Phrases | 22. 填充短语 | (A 23) | same concept, renamed in both |
| 23. Excessive Hedging | 23. 过度限定 | (A 24) | same concept, renamed in both |
| 24. Generic Positive Conclusions | 24. 通用积极结论 | A 25 万能正能量结尾 | same concept, renamed in both |
| — | — | A 26 四字词和成语连用 | **added by A**; blader 2.9.1 §26 Hyphenated Word Pair Overuse, added upstream after v2.1.0 |
| — | — | A 27 权威口吻和“本质论” | **added by A**; blader 2.9.1 §27 Persuasive Authority Tropes |
| — | — | A 28 预告式开场和导航话术 | **added by A**; blader 2.9.1 §28 Signposting and Announcements |
| — | — | A 29 标题后重复标题 | **added by A**; blader 2.9.1 §29 Fragmented Headers |
| — | — | A 30 以“修改过程”为中心写正文 | **added by A**; blader 2.9.1 §30 Diff-Anchored Writing. **Not present in B in any form** — B has no numbered pattern and no prose rule about writing that describes a previous version; its only `diff`-shaped content is the change log attached to the full example (`SKILL.md:468-476`) |
| — | — | A 31 人造金句和短句连击 | **added by A**; blader 2.9.1 §31 Manufactured Punchlines and Staccato Drama |
| — | — | A 32 空洞比喻和格言公式 | **added by A**; blader 2.9.1 §32 Aphorism Formulas |
| — | — | A 33 假装坦诚的反问开头 | **added by A**; blader 2.9.1 §33 Conversational Rhetorical Openers |

### 12.3 Counts

**This repo (B) versus blader v2.1.0 — the true baseline:**

- **Shared: 24 of 24** concepts, in identical order, with identical group taxonomy (CONTENT / LANGUAGE AND GRAMMAR / STYLE / COMMUNICATION / FILLER AND HEDGING → `内容模式` / `语言和语法模式` / `风格模式` / `交流模式` / `填充词和回避`).
- **Renamed: 24 of 24** (every heading is a Chinese translation; no heading is dropped or merged).
- **New/changed: 0** numbered patterns. B adds no pattern that blader v2.1.0 lacks. Its additions are non-pattern sections: `核心规则速查` (`SKILL.md:34-42`), `个性与灵魂` (`:46-76`), `快速检查清单` (`:406-415`), `质量评分` (`:440-457`) — of which `README.md:5` credits three to `hardikpandya/stop-slop`.
- **Dropped: 0** numbered patterns. However B drops blader's **`allowed-tools` entry `Grep` and `Glob`** (blader v2.1.0 frontmatter lists Read, Write, Edit, Grep, Glob, AskUserQuestion; B lists Read, Write, Edit, AskUserQuestion at `SKILL.md:8-12`) and drops blader's lettered/uppercase section naming.

**This repo (B) versus blader HEAD (v3.0.0, 25 patterns):** the structures do not align at all — blader re-cut its list and reordered it (3.0.0's §1 is `Not X but Y`, §6 is `Forced triads`, §12 is `Overused AI words`). B's numbering tracks the v2.1.0 list. **This repo is 2 upstream generations behind: v2.1.0 → v2.9.1/33 patterns → v3.0.0/25 patterns.**

**This repo (B) versus repo A (`humanizer-zh-cn`): counted from the two SKILL.md files read in full:**

| Metric | Result |
|---|---|
| Pattern count | B 24; A 33 |
| Concepts shared | 24 (all of B's) |
| Concepts in A only | 9 (A 13, 19, 26, 27, 28, 29, 30, 31, 32, 33 — counting A 19 and the Chinese-original rules; see A's report §12 for the upstream mapping) |
| Concepts in B only | 0 |
| Exactly identical pattern-name strings | **0 of 24** |
| Identical translated example sentences | **0** |
| Shared ≥12-character content fragments | **2**, both YAML keys (`name: humanizer-zh`, `description: |`) |
| Shared incidental short strings | 4: `钥匙`, `镜子`, `坐落于`, `法国大革命` |

### 12.4 Quote pairs: exact Chinese phrases here mapped to the blader tell they encode

| Chinese phrase (verbatim, this repo) | Evidence | blader English phrase it corresponds to |
|---|---|---|
| `作为/充当、标志着、见证了、是……的体现/证明/提醒` | `SKILL.md:84` | `stands/serves as, is a testament/reminder` (v2.1.0 §1) |
| `不断演变的格局、焦点、不可磨灭的印记、深深植根于` | `SKILL.md:84` | `evolving landscape, focal point, indelible mark, deeply rooted` (v2.1.0 §1) |
| `独立报道、地方/区域/国家媒体、由知名专家撰写、活跃的社交媒体账号` | `SKILL.md:98` | `independent coverage, local/regional/national media outlets, written by a leading expert, active social media presence` (v2.1.0 §2) |
| `突出/强调/彰显……、确保……、反映/象征……、为……做出贡献、培养/促进……、涵盖……、展示……` | `SKILL.md:112` | `highlighting/underscoring/emphasizing..., ensuring..., reflecting/symbolizing..., contributing to..., cultivating/fostering..., encompassing..., showcasing...` (v2.1.0 §3) |
| `拥有（夸张用法）、充满活力的、丰富的（比喻）、深刻的、增强其` | `SKILL.md:126` | `boasts a, vibrant, rich (figurative), profound, enhancing its` (v2.1.0 §4) |
| `坐落于、位于……的中心、开创性的（比喻）、著名的、令人叹为观止的、必游之地、迷人的` | `SKILL.md:126` | `nestled, in the heart of, groundbreaking (figurative), renowned, breathtaking, must-visit, stunning` (v2.1.0 §4) |
| `行业报告显示、观察者指出、专家认为、一些批评者认为、多个来源/出版物（实际引用却很少）` | `SKILL.md:140` | `Industry reports, Observers have cited, Experts argue, Some critics argue, several sources/publications (when few cited)` (v2.1.0 §5) |
| `尽管其……面临若干挑战……、尽管存在这些挑战、挑战与遗产、未来展望` | `SKILL.md:154` | `Despite its... faces several challenges..., Despite these challenges, Challenges and Legacy, Future Outlook` (v2.1.0 §6) |
| `此外、与……保持一致、至关重要、深入探讨、强调、持久的、增强、培养、获得` | `SKILL.md:170` | `Additionally, align with, crucial, delve, emphasizing, enduring, enhance, fostering, garner` (v2.1.0 §7) |
| `突出（动词）、相互作用、复杂/复杂性、关键（形容词）、格局（抽象名词）` | `SKILL.md:170` | `highlight (verb), interplay, intricate/intricacies, key (adjective), landscape (abstract noun)` (v2.1.0 §7) |
| `织锦（抽象名词）、证明、强调（动词）、宝贵的、充满活力的` | `SKILL.md:170` | `tapestry (abstract noun), testament, underscore (verb), valuable, vibrant` (v2.1.0 §7) — `织锦` is a literal calque of `tapestry` |
| `作为/代表/标志着/充当 [一个]、拥有/设有/提供 [一个]` | `SKILL.md:184` | `serves as/stands as/marks/represents [a], boasts/features/offers [a]` (v2.1.0 §8) |
| `希望这对您有帮助、当然！、一定！、您说得完全正确！` | `SKILL.md:330` | `I hope this helps, Of course!, Certainly!, You're absolutely right!` (v2.1.0 §19) |
| `截至 [日期]、根据我最后的训练更新、虽然具体细节有限/稀缺……、基于可用信息……` | `SKILL.md:344` | `as of [date], Up to my last training update, While specific details are limited/scarce..., based on available information...` (v2.1.0 §20) |
| `值得注意的是数据显示` → `数据显示` | `SKILL.md:378` | `"It is important to note that the data shows" → "The data shows"` (v2.1.0 §22) |
| `在这个时间点` → `现在` | `SKILL.md:375` | `"At this point in time" → "Now"` (v2.1.0 §22) |

**16 quote pairs, exceeding the 10-pair minimum.** Plus the 30-row full-sentence correspondence table in §12.1.

### 12.5 Do the two Chinese repos duplicate each other?

**No — but they are siblings sharing one upstream, and they overlap heavily at the concept level.** Full evidence is in §12.3 and in the companion report's §12. The key numbers:

| Question | Finding |
|---|---|
| Identical pattern-name strings | **0 of 24** |
| Identical translated examples | **0** |
| Shared ≥12-char content fragments | 2 (YAML keys only) |
| Shared concepts | 24 of B's 24 are also present in A (A additionally has 9 more) |
| Same upstream version | No — B = blader **v2.1.0** (24 patterns); A = blader **2.9.1** (33 patterns) |
| Same git lineage | No — A's clone physically contains blader's commits; B's 6-commit history starts at `e4216e0 歸藏 Initial commit` with no shared ancestor |
| Same authorship | No — B: `郭浩`, `歸藏`; A: `Naassh`, upstream `Siqi Chen` |
| Same tooling | No — A has CI + validator + plugin manifests; B has none |
| Same compliance posture | No — A retains and machine-enforces blader's copyright; B removes it |

**Key dedupe finding (identical conclusion in both reports):** the three repositories form **one lineage with a single common ancestor — `blader/humanizer`** (itself derived from Wikipedia's "Signs of AI writing", maintained by WikiProject AI Cleanup). They are **not three independent discoveries**, and the suite must count **one** upstream taxonomy. They are also **not a derivation chain**: A is not a copy of B, and B is not a copy of A — they are two independent translations of two different upstream versions. The twelve blader concepts that B names at 1–12 and A names at 1–12 are therefore **triplicated across the three repos**, while A's remaining 12 concepts (13–33 after re-slotting) exist in **two** copies only (A and upstream 2.9.1) and are absent from B.

## 13. Integration recommendation

**Take the evaluation rubric and the voice section; treat the rule list as redundant.** Recommendation in priority order:

1. **Do not ingest the 24 patterns as a rule set.** All 24 concepts are already covered by repo A's 33, and repo A's versions are (a) retargeted to observable Chinese usage, (b) accompanied by a false-positive policy, and (c) unencumbered by a missing copyright notice. Ingesting B's list creates a duplicate rule for every tell. If a second Chinese rule set is wanted for coverage, prefer upstream blader directly.
2. **Extract the scoring rubric (`SKILL.md:440-457`) into the suite's evaluation harness (kind B).** The five dimensions (直接性/节奏/信任度/真实性/精炼度) and the 50-point total are the only structured, quantitative artifact in the two Chinese repos. Convert to structured criteria; treat the 45/35 band boundaries as unvalidated defaults. Its provenance must be resolved first (declared as `stop-slop`-derived at `README.md:5`).
3. **Extract `## 个性与灵魂` (`SKILL.md:46-76`) into the unified voice interface (kind C).** This is B's strongest original contribution. It complements repo A's `声线校准` (`SKILL.md:42-44`): A covers *calibrating to a supplied sample*, B covers *injecting voice when there is no sample*. They are additive, not duplicative. The specificity tactic at `SKILL.md:70` — replacing `不是"这令人担忧"，而是"凌晨三点没人看着的时候"…` — is directly reusable as a voice-example template.
4. **Mechanize the quick checklist (`SKILL.md:406-415`) as deterministic post-checks (kind A).** `连续三个句子长度相同？` and `揭示前有破折号？` and `三段式列举？` are countable properties, unlike the other repos' prose patterns. Implement as a lightweight lint pass over rewrite output.
5. **Explicitly exclude `## 处理流程` and `## 输出格式` from the extraction plan.** They are verbatim translations of blader v2.1.0 and are out-attributed in the repo's own README; copying them into a new project would launder an already-broken attribution chain.
6. **Do not reuse the LICENSE or the attribution block as a template.** Use repo A's (`LICENSE` + machine-enforced validator assertion) as the suite's model instead.
7. **If the suite wants a Chinese punctuation/full-width rule, it must come from repo A**, not from B — B has no such rule (§5).

## 14. Gaps, risks, and limitations

- **MIT compliance defect (highest-severity finding).** `LICENSE:3` ships `Copyright (c) 2026 歸藏` with no reproduction of `Copyright (c) 2025 Siqi Chen`, while the repository reproduces all 24 of blader's pattern headings, watch lists, before/after examples, process list, output format and full example in translation. blader's MIT requires the copyright notice to be included in substantial portions (`blader-humanizer/LICENSE:12-13`). **Confirmed by reading both LICENSE files and searching both repo-B documents for `Siqi` (0 matches).** Any suite that vendors B's text inherits this defect; do not copy text from this repo into a distributed artifact without re-attributing to blader.
- **Attribution is also incomplete toward `stop-slop`.** `README.md:5` credits stop-slop for `核心规则、快速检查清单、质量评分`, but `## 处理流程` / `## 输出格式` / `## 完整示例` are verbatim blader v2.1.0 translations credited to nobody (§11). *Not verified:* whether the scoring rubric genuinely originates in `hardikpandya/stop-slop` — that repository was outside this inventory's scope, so the credit is reported as declared but unconfirmed.
- **Stale by two upstream generations.** Baseline is v2.1.0 (24 patterns, 2026-01-17); upstream has since moved to 2.9.1 (33 patterns) and 3.0.0 (25 patterns). The repo has had no commit since 2026-01-19 and **no automation to detect upstream change** (§9). It will not receive upstream fixes — including the no-fabrication rule blader added in 2.9.0.
- **No provenance pin.** The repo declares the source repository but **no commit or version** (`SKILL.md:15`), unlike repo A which pins `523374dee72d67c7b2b5f858ea0094ffda49c3ac`. The v2.1.0 baseline in this report was reconstructed by direct textual comparison, not read off the repo.
- **No-fabrication gap creates a real correctness risk.** Pattern 2's `改写后` supplies a 2024 New York Times interview and a substantive claim that the `改写前` never contained (`SKILL.md:103` vs `:106`); pattern 4's `改写后` invents a weekly market and 18th-century church (`:134`); pattern 20's `改写后` invents 1994 and registration documents (`:352`); pattern 6's `改写后` invents 2015/2022 events (`:162`). These are literally translated from blader v2.1.0, but upstream later added an explicit no-fabrication rule and restricted exactly this behaviour (`blader-humanizer/SKILL.md:36`, and `AGENTS.md`). This repo inherits the risk with **no guardrail**: `SKILL.md` contains no statement forbidding invented details. **Confirmed by reading the whole file.**
- **Two patterns are acknowledged dead weight for Chinese.** Pattern 16's before and after are identical text (`SKILL.md:289`, `:292`) and pattern 18's equally so (`:317`, `:320`); both carry notes saying the pattern barely applies. Keeping them inflates the count without producing a usable rule.
- **No false-positive protection.** There is no "do not flag" list, no notion of weak-alone tells, and no single-feature caution. Since the watch lists include very common Chinese words and connectives (此外, 值得注意的是, 强调, 展示, 体现), an unguarded implementation will over-fire. Contrast repo A's `避免误伤` (`humanizer-zh-cn/SKILL.md:363`) and `LOCALIZATION.md:16`.
- **No scoring severity per pattern.** Only a document-level 50-point score (§7); every pattern is implicitly equal weight, which contradicts the observed reality that e.g. chatbot residue is a far more certain tell than bold usage.
- **No mode discipline.** There is no file mode or embedded mode and no instruction to preserve code blocks, frontmatter, data or link targets, so a file-mode use risks rewriting non-prose (`SKILL.md:432-436`).
- **Language coverage.** Simplified Chinese only; no traditional-Chinese handling, no full/half-width normalization, no idiom/slogan rule.
- **Not inspected in this inventory (out of scope, no claims made):** `hardikpandya/stop-slop` (the credit at `README.md:5` is therefore unverified), GitHub issue/PR history, and any files not present in this 6-commit working tree. All derivation and compliance claims rest on documents read in full.
