# Inventory: ai-zixun/humanizer-zh

> Read-only inventory performed against the local clone at
> `human-voice-suite/.upstream-cache/humanizer-zh`. No file inside the repository was
> created, modified, or deleted. All line references are to files in that clone.

## 1. Identity

| Field | Value | Evidence |
| --- | --- | --- |
| Repository | `ai-zixun/humanizer-zh` | `git remote -v`: `origin https://github.com/ai-zixun/humanizer-zh.git` |
| Commit | `f75f1ac9735c4f10da1bba0148e0ea7228c5c3b3` (short `f75f1ac`, branch HEAD as cloned) | `git rev-parse HEAD` |
| Commit title | `[fix] docs - clarify that README ships with the skill install (#9)` | `git log --oneline` |
| Author identity | `Ai, Zi-Xun <aiz@uci.edu>` on all 10 commits | `git log --pretty="%h %ad %an <%ae> %s"` |
| License | MIT License | `LICENSE:1` |
| Copyright holder (verbatim) | `Copyright (c) 2026 aizixun` | `LICENSE:3` |
| Declared version | `1.3.0` | `VERSION:1`; repeated at `README.md:11`, `README.en.md:11` |
| Languages | Markdown (English + Simplified Chinese). No code files. | file inventory below |
| File count | 23 files (including `.gitignore`) | directory listing |
| Total text size | 130,678 bytes (23 files) | `Measure-Object -Property Length -Sum` |
| Executable code | none (no `.py`, `.js`, `.ts`, `.sh`); the only non-Markdown assets are `release.yml`, `plugin.json`, `openai.yaml` | file inventory |
| Commit span | 10 commits, 2026-03-15 → 2026-05-21 | `git log --date=short` |

File sizes (bytes): `SKILL.md` 10,116; `README.md` 6,910; `README.en.md` 6,794; `CHANGELOG.md` 4,124;
`CLAUDE.md` 301; `LICENSE` 1,064; `VERSION` 6; `.gitignore` 41;
`references/patterns.md` 16,896; `references/corpus.md` 8,183; `references/corpus-quickpick.md` 2,932;
`references/voices/index.md` 3,024; `references/voices/fengtang.md` 8,557;
`references/voices/hefan.md` 9,552; `references/voices/helaoshi.md` 6,897;
`references/voices/lishanglong.md` 8,779; `references/voices/liuzichao.md` 10,555;
`references/voices/lixiaolai.md` 6,575; `references/voices/luozhenyu.md` 7,838;
`references/voices/wujun.md` 9,241; `.claude-plugin/plugin.json` 155;
`.github/workflows/release.yml` 1,870; `agents/openai.yaml` 268.

**CORRECTION TO THE TASK BRIEF — there are EIGHT author voice profiles, not nine.**
The directory `references/voices/` contains exactly 8 author files plus `index.md`:
`fengtang.md`, `hefan.md`, `helaoshi.md`, `lishanglong.md`, `liuzichao.md`, `lixiaolai.md`,
`luozhenyu.md`, `wujun.md`. The repository itself states the count as eight in five independent
places: `SKILL.md:38` (「拿到 8 位作者的一句话简介」), `references/voices/index.md:13` (`## 八位可选`),
`CHANGELOG.md:14` (「8 opt-in author voice profiles」), `README.md:29` and `README.md:146`,
`README.en.md:29` and `README.en.md:147`. Section 6 below therefore analyzes eight profiles.

## 2. Purpose and functionality

`humanizer-zh` is a portable **agent skill written entirely in Markdown** whose purpose is to rewrite,
polish, or review Chinese long-form prose so it stops reading like machine-assembled or
English-translated text and starts reading like native Chinese writing. Stated purpose:

- `SKILL.md:10`: 「把中文文本从「像模型拼出来的稿子」改成「像中文母语者真的写出来的文章」。优先处理翻译腔、结构腔、排版腔和判断腔，同时保留原文事实、立场和信息密度。」
- `README.md:7`: 「它用于重写、润色或审阅中文博客、评论、产品分析、newsletter、书稿章节等长文本，让文字更像中文母语者写出来的，而不是翻译腔、模型拼接稿或营销通稿。」
- Trigger surface (`SKILL.md:3`): 「去 AI 味」, 「润色成中文母语表达」, 「改得像博客或书里写的」, 「减少翻译腔」.

Runtime model: the repository root **is** the skill package (`README.md:9`). `SKILL.md` is the sole
runtime entry point; `references/` files are loaded on demand (`README.md:142`,
`README.en.md:42`). Distribution is via the `skills` CLI (`npx skills add ai-zixun/humanizer-zh`,
`CHANGELOG.md:61`), targeting Codex, Claude Code and OpenClaw (`README.md:38-40`).

The skill has three functional layers:

1. **Neutral cleanup** — always on, driven by `## Core Rules` (`SKILL.md:57-114`).
2. **Deep diagnostics** — conditionally loaded `references/patterns.md` (`SKILL.md:125-132`).
3. **Optional voice adoption** — opt-in author impersonation from `references/voices/`
   (`SKILL.md:28-55`), plus a separate genre-reference corpus (`references/corpus.md`,
   `references/corpus-quickpick.md`).

## 3. Structure of SKILL.md

### 3.1 YAML metadata

Frontmatter is lines 1-4, and it declares **only two fields** (`name`, `description`); there is no
`license`, `version`, `allowed-tools`, or `metadata` block. This is a deliberate design constraint:

- `SKILL.md:1-4`: `---` / `name: humanizer-zh` / `description: Remove signs of AI-generated, translated, or overly mechanical Chinese prose. …` / `---`
- `README.md:150`: 「frontmatter 只依赖通用字段 `name` 和 `description`，避免把代理私有配置写进运行入口」
- Compare: blader/humanizer declares `license: MIT` and `metadata.version: "3.0.0"` in frontmatter
  (`blader-humanizer/SKILL.md:8-10`).

### 3.2 Section layout (with line numbers)

| Line | Heading |
| --- | --- |
| 6 | `# 中文去 AI 味` |
| 8 | `## Overview` |
| 13 | `## Workflow` |
| 28 | `## Voice Adoption（可选）` |
| 57 | `## Core Rules` |
| 59 | `### 1. 优先改掉翻译腔` |
| 65 | `### 2. 去掉空泛的大词和套话` |
| 71 | `### 3. 打散机械结构` |
| 77 | `### 4. 保持中文节奏` |
| 83 | `### 5. 管住文章级结构` |
| 92 | `### 6. 处理标点和排版` |
| 102 | `### 7. 统一常见术语和日期` |
| 110 | `### 8. 控制判断强度` |
| 116 | `## Repo Overrides` |
| 123 | `## Deep Review` |
| 145 | `## Output` |
| 153 | `## Final Check` |

`SKILL.md` is 165 lines total. The six `## Workflow` steps are: (1) 先判断文本类型, (2) 先看文章主线,
(3) 先找最显眼的 AI 痕迹, (4) 再决定改写力度, (5) 保留作者原意, (6) 做最后一遍朗读检查
(`SKILL.md:15-26`).

### 3.3 Precedence rules

The skill defines a three-level precedence system, and this is the most integration-relevant part of
`SKILL.md`:

1. **Project rules beat the skill** — `SKILL.md:118`: 「如果当前项目存在 `CLAUDE.md`、`AGENTS.md`、样例文章或术语表，先遵守项目内规则，再使用本技能的通用规则。」
2. **An adopted author voice beats `## Core Rules`** — `SKILL.md:47`: 「如果 voice 档案与 Core Rules 冲突（典型例子：李笑来、刘子超允许长破折号 `——`，覆盖 Core Rules §6；鹤老师鼓励大量短句独立成段；吴军接受 `首先……其次……最后`），**作者档案优先**。」 Reinforced at `SKILL.md:143` and `references/voices/index.md:30`.
3. **Voice profiles never leak into neutral mode** — `SKILL.md:55`: 「不要把作者档案的反模式当成 humanizer-zh 的默认规则；只在该声音生效的轮次中应用。」

### 3.4 The quote-style precedence mentioned in CLAUDE.md §6

`CLAUDE.md` is a 10-line file that exists to declare **this repository's own quote convention**:

- `CLAUDE.md:3`: `## Quote style`
- `CLAUDE.md:5`: `humanizer-zh quotes: 「」`
- `CLAUDE.md:7-10`: 「This repo's own docs (README, SKILL.md, references/) use 「」 with nested 『』. When the skill rewrites user text, follow the precedence in [SKILL.md](./SKILL.md) §6: explicit user request → this declaration → default `""`.」

The rule it points at, `SKILL.md:120` (inside `### 6. 处理标点和排版`), states the chain verbatim:
「引号样式按以下顺序确定：用户在本轮请求里明确要求 → 项目 `CLAUDE.md`/`AGENTS.md` 的声明（例如 `humanizer-zh quotes: 「」`） → 默认 `""`。」

So the full quote-style precedence is, highest first:

1. **Explicit user request in the current turn** — `SKILL.md:94`, `SKILL.md:120`.
2. **A project `CLAUDE.md`/`AGENTS.md` declaration of the form `humanizer-zh quotes: 「」`** — `SKILL.md:120`, instantiated by `CLAUDE.md:5`.
3. **Default full-width curly quotes `""`** (nested `''`) — `SKILL.md:94`, `README.md:30`.
4. **Override-of-the-override:** if the *source text itself* already uses `「」` throughout and the
   project has declared nothing, keep `「」` and do not force it to `""` — `SKILL.md:121`.

The skill additionally forbids mixing the two styles anywhere in one document
(`SKILL.md:94`: 「两种样式不要混用」; checked in `SKILL.md:164`), and `references/patterns.md:135`
cross-references the rule: 「详见 [SKILL.md](../SKILL.md) Rule 6」.

## 4. Complete rule inventory — CRITICAL

### 4.1 Patterns in `references/patterns.md`

There are **exactly 13 numbered patterns**, numbered `1`–`13`, **numbered and contiguous with no
gaps**. The `## 目录` at `references/patterns.md:3-17` lists all 13 and each maps 1:1 to a matching
`## <n>. <name>` heading. There is no separate severity or priority field anywhere in the file, and
no pattern is marked optional or "weak alone".

| rule_id | pattern name (verbatim Chinese) | category | what it detects | rewrite guidance summary | severity | evidence |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `机械对照句` | sentence-level rhetoric | Formulaic negation-then-affirmation frames: `不是……而是……`, `不仅……还……`, `不再只是……而是开始……`, `X 并不意味着 Y，而是意味着 Z` | Do not default to `不是……而是……`; replace with natural 转折/递进/重心移动; the "before" example is 「这不是一次普通的产品更新，而是一次重新定义行业边界的重大转折。」 | not stated | `references/patterns.md:5,19,23-26,28,63` |
| 2 | `翻译腔连接词` | translationese connectors | High-frequency calque connectives: `对于……来说`, `基于此`, `围绕……展开`, `从某种意义上说`, `值得注意的是`, `与此同时`, `在这一背景下`, `使得……得以……` | 能删就删 / 能换成更短的中文连接就换 / 能直接调整句序就不要硬加连接词 | not stated | `references/patterns.md:6,38,42-49,51-55` |
| 3 | `空泛大词` | empty abstraction | 没有机制解释的词: `颠覆`, `革命`, `赋能`, `重塑`, `引领`, `开启新篇章`, `里程碑`, `深远影响` | 删掉没有证据支撑的宏大判断; 改写成具体机制、对象和后果 | not stated | `references/patterns.md:7,65,69-76,78-81` |
| 4 | `段落结尾的口号化收束` | ending rhetoric | Sloganized paragraph closers: `未来已经到来`, `这只是开始`, `行业将迎来新的篇章`, `真正的变革才刚刚开始` | 用一个具体判断收束; 回到长期变量、约束条件或下一步变化 | not stated | `references/patterns.md:8,91,95-98,100-103` |
| 5 | `列表和排比成瘾` | formatting / rhythm | Bullet and parallelism addiction: 一段里硬塞三项排比; 每个 bullet 都是 `粗体小标题 + 冒号 + 解释`; 能写成一段的内容被拆成很多点 | 把可合并的列表改写成自然叙述段落 | not stated | `references/patterns.md:9,113,117-119,121-127` |
| 6 | `冒号、破折号和引号` | punctuation / typography | Colon overuse, long em dash `——`, quote-style inconsistency | 冒号只在确实需要引出定义、列表或说明时使用; 长破折号 `——` 优先改成逗号、句号或拆句; 引号默认全角 `""`，项目声明 `「」` 则全篇统一，不要混用 | not stated | `references/patterns.md:10,129,133-135,137-143` |
| 7 | `营销稿与官样文章腔` | register / marketing-bureaucratese | `持续深化`, `全面推进`, `积极探索`, `取得显著成效`, `实现高质量发展`, `打造闭环` | 如果没有真实指标或动作，直接删; 如果有事实，把套话换成具体动作 | not stated | `references/patterns.md:11,145,149-154,156-167` |
| 8 | `过度谨慎或过度确定` | hedging / overclaiming | 过度谨慎: `在某种程度上可能会对……产生一定影响`; 过度确定: `必然彻底改写整个行业` | 证据有限就明确范围和条件; 趋势明显就说清「先影响谁、怎么影响」 | not stated | `references/patterns.md:12,169,173-174,176-187` |
| 9 | `开头、主体、结尾脱节` | article-level structure | Intro poses a question the body never answers; body paragraphs unrelated to the spine; ending jumps to 「时代已经改变」「未来已经到来」 | 先用一句话说清全文到底在回答什么问题; 每段检查是否服务该问题，不能服务的删/并/挪; 结尾回到前文已展开的变量、约束或判断 | not stated | `references/patterns.md:13,189,193-195,197-217` |
| 10 | `文章级重写模板` | article-level methodology (container with 6 sub-paths) | The default AI long-form shape **先给定义，再列 2 到 4 个分点，最后拔高一句更大的判断** (also written 定义 → 拆项 → 拔高) | Not a formula: six alternative rewrite paths to break the default shape (see 4.2); pick by genre; do not force a full skeleton when material is thin | not stated | `references/patterns.md:14,219,224,226-231,365-371` |
| 11 | `编号枚举撑全文` | article-level rhythm | Body-text numbered enumeration as a recurring article-level rhythm: `第一步 / 第二步 / 第三步`, `第一个 / 第二个 / 第三个`, `第一层 / 第二层` — even without list markers | 改成时间推进 (`先……后来……再到……`), 因果推进 (`之所以……，是因为……`), 或场景推进; 非教学型一律取消; 整篇出现次数压到原来的一半到三分之二 | not stated | `references/patterns.md:15,373,377-379,381,383-389` |
| 12 | `章末段末的预告式收束` | ending rhetoric | Forward-hook section endings: `接下来要……`, `下一步是……`, `接下来的问题是……`, `下一篇会讲到……` | 改成开放问题 / 冷结论 / 具体场景收束 / 反向限制 | not stated | `references/patterns.md:16,399,403-406,408,412-417` |
| 13 | `抽象转义与重锤句` | abstraction hammering | Abstract elevation phrases: `本质上`, `这件事`, `真正重要的是`, `归根结底`, `说到底`, `回到最初的那个问题` | `本质上`→更具体的机制句; `这件事`→具体所指; `真正重要的是`→事实后置显义; `归根结底 / 说到底`→具体后果或长期变量; `回到最初的那个问题` 全文留一两处 | not stated | `references/patterns.md:17,427,431-436,438,440-446` |

Cross-references recorded inside the file (useful for building a canonical graph):
pattern 11 explicitly distinguishes itself from pattern 5 (`references/patterns.md:381`), and
pattern 12 explicitly distinguishes itself from pattern 4 (`references/patterns.md:410`).

### 4.2 Sub-paths inside pattern 10 `文章级重写模板`

Pattern 10 is a container with **six** `### <n>. <name>` sub-sections (`references/patterns.md:233-363`),
each with the same three sub-labels `适用：`, `适合处理的问题：`, `可参考的起承转合：`:

| sub_id | sub-path name (verbatim) | named authors it points at | evidence |
| --- | --- | --- | --- |
| 10.1 | `把问题钉住，再慢慢拆开` | 阮一峰、刘瑜 | `references/patterns.md:233,235` |
| 10.2 | `先把现象放在桌上，再谈它说明什么` | 柴静、张佳玮、许知远 | `references/patterns.md:255,257` |
| 10.3 | `从自己的误判写起，再把经验提出来` | 李笑来、古典 | `references/patterns.md:277,279` |
| 10.4 | `先亮判断，但别把话说满` | 王小波、韩寒 | `references/patterns.md:299,301` |
| 10.5 | `先把人或案例立住，再慢慢外推` | 柴静、罗永浩、许知远 | `references/patterns.md:321,323` |
| 10.6 | `先把火气压下来，再谈争议里真正的分歧` | 刘瑜、梁文道 | `references/patterns.md:343,345` |

### 4.3 Rules defined in `SKILL.md`

`SKILL.md` defines two further rule sets that are **not** in `patterns.md` and must be inventoried
separately. Both use `### <n>. <name>` headings, `1`–`8`, contiguous.

`## Core Rules` (always-on), `SKILL.md:57-114`:

| rule_id | rule name (verbatim Chinese) | what it enforces | evidence |
| --- | --- | --- | --- |
| CR1 | `优先改掉翻译腔` | 拆开英文句法硬套中文的句子; 少用「对于……来说」「基于……」「围绕……展开」「使得……得以……」; 对比时不默认 `不是……而是……` | `SKILL.md:59,61-63` |
| CR2 | `去掉空泛的大词和套话` | 少用「颠覆」「革命」「赋能」「重塑」「深刻改变」「开启新篇章」; 避免「这标志着……」「这意味着……的时代已经到来」; 抽象判断落回具体动作、约束、成本、分工或结果 | `SKILL.md:65,67-69` |
| CR3 | `打散机械结构` | 不强行每段三分句/排比/工整对照; 不连续使用「首先」「其次」「最后」「与此同时」「值得注意的是」「从某种意义上说」; 列表能改叙述就改 | `SKILL.md:71,73-75` |
| CR4 | `保持中文节奏` | 允许长短句混用; 句子要有明确主语和动作，少写无主句串联; 避免段尾总落在大而空的价值判断上 | `SKILL.md:77,79-81` |
| CR5 | `管住文章级结构` | 开头尽快立题; 主体段落各有功能 (交代背景、提出判断、展开论据、举例、转折、收束); 不推进主线的段落删/并/挪; 结尾回应前文真正提出的问题，不临时拔高到时代命题; 可重排段落但不要硬凑三段论; 少把段落关系写成 `先……再……最后……` | `SKILL.md:83,85-90` |
| CR6 | `处理标点和排版` | 引号默认全角 `""`，嵌套 `''`，项目声明 `「」` 则全篇统一（嵌套 `『』`），两种样式不要混用; 不使用长破折号 `——`; 不密集使用冒号 `：`; 英文多词术语用半角空格分词 (`AI Design Agent`); `（` 前不加空格 (`LLM（大语言模型）`); 斜杠两侧不留空格 (`coworkers/agents`); 英文品牌名用官方大小写 (`YouTube`、`OpenAI`、`GitHub`) | `SKILL.md:92,94-100` |
| CR7 | `统一常见术语和日期` | `token` 保持英文; `API` 保持英文; `PR` 在长篇中文叙述里优先写作 `代码审查`; 数字日期写作 `2026 年 2 月 26 日`、`2 月 5 日`; 中文月份叙事写作 `一月`、`二月` | `SKILL.md:102,104-108` |
| CR8 | `控制判断强度` | 不下「完全取代」「彻底结束」「只剩一种可能」; 不做无依据的阴谋论推断、资本市场臆测或人物动机脑补; 强调重要性时先给机制再给判断 | `SKILL.md:110,112-114` |

`## Repo Overrides`, `SKILL.md:116-121` (4 rules, unnumbered bullets):

| rule_id | content (verbatim excerpt) | evidence |
| --- | --- | --- |
| RO1 | 「如果当前项目存在 `CLAUDE.md`、`AGENTS.md`、样例文章或术语表，先遵守项目内规则，再使用本技能的通用规则。」 | `SKILL.md:118` |
| RO2 | 「如果项目已经有明确文风样本，模仿它的句长、判断方式、段落推进和术语约定，不额外套用另一套腔调。」 | `SKILL.md:119` |
| RO3 | Quote-style precedence chain (user → project declaration → default `""`) | `SKILL.md:120` |
| RO4 | 「当原文整篇已经显著使用 `「」` 而项目未声明时，沿用原文样式，不要硬翻成默认 `""`。」 | `SKILL.md:121` |

`## Voice Adoption（可选）` anti-patterns, `SKILL.md:50-55` (4 rules, unnumbered bullets):

| rule_id | content (verbatim excerpt) | evidence |
| --- | --- | --- |
| VA1 | 「不要在用户没选时擅自模仿任何作者的口吻。」 | `SKILL.md:52` |
| VA2 | 「不要把多位作者的声音混在同一篇文章里。」 | `SKILL.md:53` |
| VA3 | 「不要把 voice 档案里的 persona preamble（「You are a guy from 东北…」之类英文写作指令）原文输出给用户 —— 那是给你看的，不是文章内容。」 | `SKILL.md:54` |
| VA4 | 「不要把作者档案的反模式当成 humanizer-zh 的默认规则；只在该声音生效的轮次中应用。」 | `SKILL.md:55` |

`## Final Check`, `SKILL.md:155-165`: 9 delivery checks, including the predictability soundcheck
「全文节奏不要总是「先定义、再拆项、最后拔高」，更不能让读者连续三节都能预测下一节的写法」(`SKILL.md:162`)
and 「引号样式全篇统一（`""` 或 `「」` 二选一），没有把两种样式混用」(`SKILL.md:164`).

### 4.4 Total counts

| Rule set | Count | Numbered? | Contiguous? |
| --- | --- | --- | --- |
| `references/patterns.md` top-level patterns | **13** | yes, `1`–`13` | yes, no gaps |
| `references/patterns.md` §10 sub-paths | 6 | yes, `1`–`6` nested under §10 | yes |
| `SKILL.md` `## Core Rules` | 8 | yes, `1`–`8` | yes |
| `SKILL.md` `## Repo Overrides` | 4 | no | n/a |
| `SKILL.md` `## Voice Adoption` anti-patterns | 4 | no | n/a |
| `SKILL.md` `## Final Check` items | 9 | no | n/a |
| **Unique rule entries in the canonical registry** | **35** (13 + 6 + 8 + 4 + 4) | mixed | mixed |

Note the overlap: patterns §1–§8 and Core Rules CR1–CR8 are *parallel formulations of the same
material* (e.g. §1 ≈ CR1, §3 ≈ CR2, §5 ≈ CR3, §6 ≈ CR6, §12 ≈ CR4). Deduplicating on semantics
rather than surface form is a design decision for the new project, not something this repo
resolves — it does not cross-reference them.

## 5. Chinese-specific language handling

This is the repo's main differentiator from blader/humanizer: an English-pattern skill has no
equivalent of most of the following. Everything below is stated explicitly in the repository.

### 5.1 Punctuation and full-width characters

- **Quote styles and nesting.** Default full-width double quotes `""` with full-width single quotes
  `''` for nesting; `「」` with `『』` for nesting when a project declares it; the two systems must not
  be mixed (`SKILL.md:94`, `SKILL.md:164`).
- **Long em dash ban.** 「不使用长破折号 `——`，优先改成逗号、句号或拆句。」 (`SKILL.md:95`,
  `references/patterns.md:134`).
- **Colon density.** 「不密集使用冒号 `：`，尤其避免连续多句都靠冒号展开解释。」 (`SKILL.md:96`).
- **Half-width space around multi-word English terms inside Chinese text** — `AI Design Agent`
  (`SKILL.md:97`).
- **No space before a Chinese parenthesis that follows an English term** — `LLM（大语言模型）`
  rather than `LLM （大语言模型）` (`SKILL.md:98`).
- **No spaces around a slash joining parallel English terms** — `coworkers/agents` (`SKILL.md:99`).
- **Official English brand casing** — `YouTube`, `OpenAI`, `GitHub` (`SKILL.md:100`).
- `references/patterns.md` §6 bundles 冒号/破折号/引号 into one pattern (`references/patterns.md:129-143`).

### 5.2 Terminology and date normalization

`SKILL.md:102-108`: `token` stays English; `API` stays English; `PR` is preferably written 「代码审查」
in long-form Chinese narration unless the project has its own convention; dates as
`2026 年 2 月 26 日` / `2 月 5 日`; spoken Chinese months as `一月`、`二月`.

### 5.3 Translationese (翻译腔)

Owned by Core Rule 1 (`SKILL.md:59-63`) and pattern §2 (`references/patterns.md:38-63`). The
repo's own framing is 「英文思路换成中文词汇」(`SKILL.md:26`) and 「不像翻译后的英文」(`SKILL.md:157`).
Its watched list (8 items) is in §4.1 row 2.

### 5.4 Over-formal / bureaucratic / marketing register

Pattern §7 `营销稿与官样文章腔` (`references/patterns.md:145-167`) covers 官样文章 and marketing
boilerplate with six watched phrases. Core Rule CR2 covers 「套话」 and the auto-closing frames
「这标志着……」/「这意味着……的时代已经到来」 (`SKILL.md:68`).

### 5.5 Sentence rhythm and paragraph rhythm

Core Rule CR4 (`SKILL.md:77-81`) handles 长短句混用 and forbids 「无主句串联」 and value-judgment
paragraph endings. Pattern §5 handles list/parallelism inflation, §11 handles numbered-enumeration
rhythm, §12 handles forward-hook section endings. The repo's named default AI long-form skeleton is
**定义 → 拆项 → 拔高** (`references/patterns.md:226`, `SKILL.md:162`).

### 5.6 Four-character idioms (四字词/成语)

Not treated as a named pattern in this repo. Four-character phrases appear only as style markers
inside `references/patterns.md:61` (the 阮一峰 rewrite), `references/voices/luozhenyu.md:62`
(「classical four-character compounds (「此消彼长」「源远流长」「命运攸关」)」), and
`references/voices/wujun.md:70` (「成语」 as part of the scholarly register). **There is no
standalone 成语/四字词 rule.** This is a documented gap versus `humanizer-zh-cn` §26
「四字词和成语连用」 (`humanizer-zh-cn/SKILL.md:285`).

### 5.7 Web-novel / business-writing tells

There is **no specific web-novel (网文) coverage**. The only business-writing coverage is §7
「营销稿与官样文章腔」 and the 「通稿腔」 mention in `SKILL.md:129`. Genres explicitly named as
in-scope are 博客、专栏、书稿、评论、产品分析、newsletter、公告、说明文、技术文档
(`SKILL.md:3`, `SKILL.md:16`).

### 5.8 Explicit "do not" list

Consolidated from `SKILL.md:94-114`, `SKILL.md:118-121`, `SKILL.md:52-55`, `SKILL.md:157-165`:

- Do not mix `""` and `「」` in one document.
- Do not use long em dashes `——`.
- Do not use colons densely or chain colon-explanations.
- Do not put a space before `（` or around `/`.
- Do not lowercase brand names.
- Do not default to `不是……而是……`.
- Do not use 「对于……来说」「基于……」「围绕……展开」「使得……得以……」 by default.
- Do not use 「颠覆」「革命」「赋能」「重塑」「深刻改变」「开启新篇章」 without mechanism.
- Do not auto-close with 「这标志着……」「这意味着……的时代已经到来」.
- Do not chain 「首先」「其次」「最后」「与此同时」「值得注意的是」「从某种意义上说」.
- Do not write every sentence at the same length; do not chain subjectless clauses.
- Do not end paragraphs on broad empty value judgments.
- Do not inflate the conclusion into an era-defining statement.
- Do not write `先……再……最后……` as a structural summary; do not force a three-part skeleton.
- Do not use 「完全取代」「彻底结束」「只剩一种可能」; do not speculate on conspiracies, capital markets, or motives.
- Do not imitate an author's voice unless the user selected one; do not mix two authors in one article.
- Do not print a voice profile's English persona preamble to the user.
- Do not carry a voice profile's anti-patterns into neutral mode.
- Do not let the reader predict the shape of section N+1 from section N.

## 6. Voice profiles — CRITICAL, ANALYZE IN DEPTH

Eight profiles, all in `references/voices/`. Filenames are romanized lowercase; the human-readable
name is in the H1.

### 6.1 `references/voices/index.md` — what the index declares

- Title `# 作者声音索引（可选）` (`index.md:1`); it states it exists to serve the `## Voice Adoption (可选)`
  step (`index.md:3`).
- Default is neutral (`index.md:5`); the skill may ask **at most once per session**
  (`index.md:6-7`: 「只有当用户在本次会话里第一次出现深度改写或长篇润色任务时，技能才机会性地（最多一次）询问一句」).
- Switching semantics: user may say 「换成 X」 or 「不要作者声音了」 at any time (`index.md:11`).
- The catalog heading is `## 八位可选` (`index.md:13`) — a 4-column table with headers
  `| 作者 | 适合的文本 | 风格关键词 | 文件 |` (`index.md:15`). All 8 rows use relative file links
  (`index.md:17-24`).
- `## 选用建议` (`index.md:26-32`) gives 5 selection rules, including 「不要混用」(`index.md:29`) and
  「作者档案优先」(`index.md:30`) and 「不要把人格 preamble 输出给用户」(`index.md:31`).
- The index declares the set is **optional, off by default, opt-in per session, mutually exclusive,
  author-file-overrides-Core-Rules**.

### 6.2 Shared structural skeleton

All eight files share an identical skeleton. This was verified mechanically: every file has the same
5 headings, the same 2-line `适用：`/`启用方式：` block, the same 4-line `注意：` block, a `---`
separator at line 10, and the persona prose beginning at line 12.

Shared pre-heading block (lines 1-11, functionally identical in all eight):

```text
# 声音：<中文名> (<Pinyin>)
适用：<genres>
启用方式：用户在 SKILL.md 的 voice adoption 步骤中选择「<中文名>」后加载本文件。

注意：humanizer-zh 默认中立。本文件只有在用户明确选定该声音时才生效，
否则不要把它的人格、口癖或反模式带进默认润色流程。
本文件的规则在与 `SKILL.md ## Core Rules` 冲突时优先 [—— optional clause naming which Core Rule is overridden].
```

Shared headings (exact strings, in order), with per-file line numbers:

| Profile file | H1 | `## Persona (who you are when writing)` | `## Quick Reference: Sentence Templates` | Voice-rule heading | Anti-pattern heading |
| --- | --- | --- | --- | --- | --- |
| `fengtang.md` | `# 声音：冯唐 (Féng Táng)` | 14 | 29 | `## Voice Rules` 42 | `## Anti-Patterns — things Feng Tang would NEVER do:` 88 |
| `hefan.md` | `# 声音：何帆 (Hé Fān)` | 14 | 24 | `## Voice Rules` 37 | `## Anti-patterns — things He Fan would NEVER do:` 96 |
| `helaoshi.md` | `# 声音：鹤老师 (Hè Lǎoshī)` | 14 | 30 | `## Voice Rules` 41 | `## Anti-Patterns — things this author would NEVER do:` 67 |
| `lishanglong.md` | `# 声音：李尚龙 (Lǐ Shànglóng)` | 14 | 24 | `## Voice Rules` 37 | `## Anti-Patterns — things Li Shanglong would NEVER do:` 93 |
| `liuzichao.md` | `# 声音：刘子超 (Liú Zǐchāo)` | 14 | 26 | `## Voice Rules` 39 | `## Anti-patterns — things Liu Zichao would NEVER do:` 113 |
| `lixiaolai.md` | `# 声音：李笑来 (Li Xiaolai)` | 14 | 24 | `## Voice rules` 37 | `## Anti-patterns — things Li Xiaolai would NEVER do:` 101 |
| `luozhenyu.md` | `# 声音：罗振宇 (Luó Zhènyǔ)` | 14 | 24 | `## Voice Rules` 37 | `## Anti-Patterns — things Luo Zhenyu would NEVER do:` 94 |
| `wujun.md` | `# 声音：吴军 (Wú Jūn)` | 14 | 24 | `## Voice Rules` 37 | `## Anti-Patterns — things Wu Jun would NEVER do:` 82 |

Heading-variant notes: `lixiaolai.md:37` uses lowercase `rules`; `hefan.md`, `liuzichao.md`,
`lixiaolai.md` use `Anti-patterns` while the other five use `Anti-Patterns`; `helaoshi.md:67` is the
only one that anonymizes the anti-pattern heading to `things this author would NEVER do:`.

### 6.3 Recurring sub-field labels (the de-facto schema)

The following sub-headings/labels recur **verbatim or near-verbatim** across all eight files. They
are the real field names to map into a unified schema:

| Recurring label (verbatim) | Occurrences | Notes |
| --- | --- | --- |
| `适用：` | 8/8 | file-level, line 3 |
| `启用方式：` | 8/8 | file-level, line 4 |
| `注意：` | 8/8 | file-level, lines 6-8 |
| `## Persona (who you are when writing)` | 8/8 | contains 3 prose paragraphs, unlabeled |
| `## Quick Reference: Sentence Templates` | 8/8 | lead-in: `Reach for these patterns naturally — they are <Author>'s sentence-level DNA:` |
| `## Voice Rules` / `## Voice rules` | 8/8 | 12 numbered items in every file |
| `## Anti-Patterns … would NEVER do:` | 8/8 | unnumbered `-` bullets |
| `Examples:` | 2/8 | only `fengtang.md:44`, `helaoshi.md:43` |
| `Anti-patterns` (lowercase form) | 3/8 | variant spelling |

There is **no** `## Taboo Words`, `## Punctuation`, `## Sentence Length`, `## Vocabulary`,
`## Rhythm`, or `## Tone` heading anywhere in the set. Those dimensions exist only as *content
inside* numbered Voice Rules, named freehand in bold small caps. The recurring bolded dimension
names actually used (as `**<NAME>**` at the start of a rule) are:
`MIX CLASSICAL AND VULGAR`, `SENSORY DETAILS`, `OBJECTS`, `SELF-CONFIDENCE`, `STRUCTURE`, `DIALOGUE`,
`BEIJING FLAVOR`, `ANCIENT-MODERN PARALLEL`, `EMOTION`, `HUMOR`, `ENDINGS`, `LETTER FORMAT`
(fengtang); `OPEN`, `ARGUE`, `USE HISTORICAL ANALOGY`, `EMBED DATA`, `RHYTHM`, `PARALLEL STRUCTURES`,
`REGISTER`, `CITATIONS`, `PERSPECTIVE`, `ENDINGS`, `CONCEPT INTRODUCTION`, `HEDGING` (hefan);
short-sentence and structure rules in helaoshi; `RHYTHM`, `PARALLEL ESCALATION`, `CITY IMAGERY` etc.
These are **free prose labels, not an enumerated vocabulary** — they vary per author by design.

### 6.4 Per-profile detail

Common counts (mechanically verified):

| Profile | File lines | Sentence Templates | Voice Rules | Anti-pattern bullets | `Examples:` markers | Chinese chars / Latin chars |
| --- | --- | --- | --- | --- | --- | --- |
| `fengtang.md` | 100 | 8 | 12 | 11 | 1 | 632 / 4,721 |
| `hefan.md` | 109 | 8 | 12 | 12 | 0 | 730 / 5,267 |
| `helaoshi.md` | 81 | 8 | 12 | 13 | 1 | 487 / 3,863 |
| `lishanglong.md` | 105 | 8 | 12 | 11 | 0 | 664 / 4,725 |
| `liuzichao.md` | 126 | 8 | 12 | 12 | 0 | 783 / 5,785 |
| `lixiaolai.md` | 110 | 8 | 12 | 8 | 0 | 472 / 3,508 |
| `luozhenyu.md` | 105 | 8 | 12 | 10 | 0 | 590 / 4,314 |
| `wujun.md` | 95 | 8 | 12 | 12 | 0 | 600 / 5,479 |

All eight are **purely prose** (English body text with embedded Chinese example strings). None has
YAML frontmatter, JSON, tables, or any machine-readable field/value structure. There are **no
blockquote (`>`) example passages at all** (0 in all eight files); example material is inline,
usually as bullet-level quoted fragments. Chinese-to-Latin character ratio is roughly 1:7 in every
file, i.e. the *instruction* is English and only the *evidence* is Chinese.

---

**`fengtang.md`** — author name as written: `# 声音：冯唐 (Féng Táng)` (`fengtang.md:1`).
适用：个人随笔、管理心法、文白杂糅评论 (`fengtang.md:3`). Sections quoted: `## Persona (who you are when writing)`,
`## Quick Reference: Sentence Templates`, `## Voice Rules`, `## Anti-Patterns — things Feng Tang would NEVER do:`
(`fengtang.md:14,29,42,88`). Override clause (`fengtang.md:8`): 「本声音允许文白杂糅、身体性描写和京味儿口语，覆盖 Core Rules §2 对空泛大词的限制（前提是配合古典与世俗并置）」.
Stylometric dimensions recorded by name: 协和/Emory/McKinsey/华润/中信 biography and worldview pillars
(`fengtang.md:16-25`); register mix 「MIX CLASSICAL AND VULGAR」(`fengtang.md:44`); 「SENSORY DETAILS」
precision frequency (`fengtang.md:49`); 「OBJECTS carry philosophical weight」— 玉, tea, calligraphy,
antiques, books (`fengtang.md:55`); 「SELF-CONFIDENCE with self-deprecation」(`fengtang.md:57`);
「STRUCTURE in non-fiction」= numbered lists + `第一……第二……` + four-character formulas
(`fengtang.md:61`); 「DIALOGUE must be short and sharp」, one sentence per line
(`fengtang.md:63`); 「BEIJING FLAVOR in diction」 with an explicit vocabulary list
`事儿, 屄, 贫, 混混, 板砖, 街面上, 辈儿` plus McKinsey English (`push, burning rate, heavy lifting, GTD`)
(`fengtang.md:67`); 「ANCIENT-MODERN PARALLEL」three-layer paragraph 古文 → 白话解读 → 亲身实证
(`fengtang.md:69`); 「EMOTION through restraint」(`fengtang.md:71`); 「HUMOR as compression」
(`fengtang.md:76`); 「ENDINGS: never summarize」with 4 named ending types (`fengtang.md:80-84`);
「LETTER FORMAT」opening `"X老哥："`, signature `冯唐` (`fengtang.md:86`). Taboo material is the 11
anti-pattern bullets (`fengtang.md:90-100`): 心灵鸡汤, abstract scene without sensory detail,
three consecutive serious paragraphs, academic citation format/footnotes, avoiding the body,
`"总结一下"` or any recap, `"众所周知"` or throat-clearing openers, decorative classical quotation,
`"我只是一个普通人"`-style false modesty, `"可能在某种程度上也许"`, separating literary from vulgar.
Sentence templates: 8 verbatim strings, e.g. `"不着急，不害怕，不要脸"`, `"残酷的现实是，X"`,
`"成事 = 诚 ×（勤 + 慎）"`, `"手里有刀，心中有佛"` (`fengtang.md:33-40`). Example passages:
inline only, within `Examples:` at `fengtang.md:44-53` and inside rules (`"心跳再也到不了每分钟一百二十次"`,
`"一根鼻毛变白了"`, `"桃色虎皮纸封面，白绫包角、压脊"`, `"痔疮不治了，留着解闷儿"`,
`"大通达、小拧巴、事儿屄地过余生，就是我的大志。"`). No blockquote passages.

**`hefan.md`** — `# 声音：何帆 (Hé Fān)` (`hefan.md:1`). 适用：田野观察、慢变量趋势分析、长篇非虚构
(`hefan.md:3`). Same 4 section headings (`hefan.md:14,24,37,96`). Override clause (`hefan.md:8`) is
generic, naming no specific Core Rule. Recorded dimensions: economist persona and `30 books in 30 years`
vow, `300-400 books a year` (`hefan.md:16`); worldview 「history is "guesswork and prejudice"」,
慢变量/快变量, 小趋势, 鹰眼视角, 腾挪, and the 「tree model」(大树模式) (`hefan.md:18,22`);
opening rules 「OPEN with a scene or a question — never with a thesis statement, never with "今天我们来聊聊"」
with two named types Scene-first / Question-first (`hefan.md:39-41`); 「ARGUE through
story-analysis-framework layers」mandating order (`hefan.md:43-47`); 「USE HISTORICAL ANALOGY」
(`hefan.md:49`); 「EMBED DATA inside scenes, never naked」with an explicit NOT/YES pair
(`hefan.md:54-57`); **`RHYTHM` is quantified: long build-up paragraphs (150-400 characters)
punctuated by ultra-short standalone sentences (under 15 characters), one every 3-5 paragraphs**
(`hefan.md:59-63`); 「PARALLEL STRUCTURES」requiring ≥3, ideally ≥4 items (`hefan.md:65-68`);
「REGISTER」**quantified as 「roughly 80% written register, 20% spoken register」** with softener list
`"你想啊" / "你来想想"`, `"说白了就是X"`, `"事儿特别多"`, `"咱们一起回顾一下过去"` (`hefan.md:70-75`);
「CITATIONS woven into narrative flow」with named sources 杜兰特, 塔奇曼, 钱穆, 亚当斯密, 凯恩斯, 梭罗, 歌德
(`hefan.md:77-79`); 「PERSPECTIVE」pronoun policy — `"我们"` must be the most frequent pronoun, `"我"`
never used as proof of authority (`hefan.md:81`); 「ENDINGS」three types: Lyrical uplift / Quotation
close / Open question (`hefan.md:83-86`); 「CONCEPT INTRODUCTION」three levels assertion → comprehension
→ resonance (`hefan.md:88-92`); 「HEDGING is natural」with `"在我看来" / "很可能" / "或许"`
(`hefan.md:94`). Anti-patterns: 12 bullets (`hefan.md:98-109`), ending with
「Never use exclamation marks for emphasis (极少用感叹号 — restraint is the emotional mode)」.
Templates: 8 (`hefan.md:28-35`), e.g. `"没有比X更Y的Z了"`, `"这意味着什么？这意味着X"`,
`"X不重要，Y不重要，Z才重要"`, `"正如X所说/所写，'Y'"`. Example passages: inline only (0 `Examples:` markers).

**`helaoshi.md`** — `# 声音：鹤老师 (Hè Lǎoshī)` (`helaoshi.md:1`). 适用：经济科普、短视频脚本式短文、
版本化拆解 (`helaoshi.md:3`). Sections at `helaoshi.md:14,30,41,67`. Override clause
(`helaoshi.md:8`): 「本声音允许大量短句独立成段和绝对化判断，覆盖 Core Rules §4、§8 的中立调性」.
Recorded dimensions: economics-educator persona, 框架 > 细节, 选择 > 努力, 权重思维, 升阶 > 线性递增,
机会成本是一切价格的本质, 经济学的铁律不以人的意志为转移 (`helaoshi.md:16-28`); **`Short-sentence
dominance` quantified: 「Default to sentences under 20 characters」plus a standalone verdict sentence
of 2-10 characters after every reasoning paragraph** (`helaoshi.md:43`); 「Version-upgrade structure」
with explicit markers `"好，明白了这个"` / `"接下来是X.0"` (`helaoshi.md:45`); 「Question-answer rhythm」
with `"请问""我问你""你仔细想一想"` and `"答案是："`, stacking 2-4 rhetorical questions
(`helaoshi.md:47`); 「"Find the exception, isolate the variable" argumentation」with Galileo/Newton
methodology analogies (`helaoshi.md:49`); 「Colloquial register with zero literary polish」— particles
啊/嘛/呀/吧, `"不对的"`, `"无非就是"`, and a ban on literary Chinese (`helaoshi.md:51`);
「Everyday analogies」with named anchors 西红柿炒鸡蛋, 打怪升级, 浴缸下水阀, 6位密码保护1位存款
(`helaoshi.md:53`); 「"再说一遍" for emphasis」capped at once per piece (`helaoshi.md:55`);
「Absolute certainty」— `"一定""绝对""永远""从来没有"`, never 可能/也许/在某种程度上 (`helaoshi.md:57`);
「"坐好了/坐稳了" anticipation markers」(`helaoshi.md:59`); 「"换剧本" pattern recognition」
(`helaoshi.md:61`); 「No summaries, no conclusions, no wrap-ups」(`helaoshi.md:63`);
**「Paragraph brevity」quantified: most paragraphs 1-3 sentences, single-sentence paragraphs are the
default for verdicts and transitions, >5 sentences rare** (`helaoshi.md:65`). Anti-patterns: 13 bullets
(`helaoshi.md:69-81`), including 「Never use long compound sentences (>30 chars)」and
「Never use "首先……其次……最后" without concrete content in each step」. Templates: 8
(`helaoshi.md:32-39`), e.g. `"X才是拉开差距的关键。"`, `"这是经济学的铁律，没有例外。"`,
`"最大的坑，是X。"`, `"再说一遍：X。"`. Example passages: inline only; one `Examples:` marker
(`helaoshi.md:43`).

**`lishanglong.md`** — `# 声音：李尚龙 (Lǐ Shànglóng)` (`lishanglong.md:1`). 适用：故事型励志、
城市青年情感长文 (`lishanglong.md:3`). Sections at `lishanglong.md:14,24,37,93`. Generic override
clause (`lishanglong.md:8`). Recorded dimensions: biographical persona — military-school dropout,
新东方 English teacher, film studio, first book at 25 (`lishanglong.md:16`); worldview on false
stability and loneliness (`lishanglong.md:18`); reader relationship as 「the older brother who's a
few years ahead」(`lishanglong.md:20`); **named story-cast convention: friends referred to by initials
or nicknames `D, S, 小A, 菲菲, 饭饭`** (`lishanglong.md:22`); 「OPEN with a story, never a thesis」
with three mandated opening sentence types and explicit banned openers (`lishanglong.md:39-43`);
「ARGUE through stories, not concepts」(`lishanglong.md:45`); **「DIALOGUE is your core technique」
quantified: 「At least 30% of your output should be direct quotes in "我说/他说" format」**, plus
「Do NOT use "他认为" or "他觉得" when "他说" works」(`lishanglong.md:47-50`); **「RHYTHM」quantified:
「drop an ultra-short standalone paragraph (under 15 characters) at the emotional peak … Every 3-5
paragraphs, one must appear. These micro-paragraphs are mandatory.」** (`lishanglong.md:52-57`);
「PARALLEL ESCALATION」3+ parallel sentences with the same opening (`lishanglong.md:59`);
**「"忽然" IS YOUR EMOTIONAL TRIGGER WORD」— a named single-word 口癖** (`lishanglong.md:64`);
「TRANSITIONS should be associative, not structural」with memory triggers and a ban on
`首先……其次……最后` / `第一点……第二点` (`lishanglong.md:70-74`); 「YOUR OWN EXPERIENCE is your
ultimate proof」(military school dropout / broke filmmaker / accidental bestseller)
(`lishanglong.md:76`); **「CITY IMAGERY」with a named place-vocabulary list `出租屋, 隔断间, 快递小哥,
朋友圈, 三环`** (`lishanglong.md:80`); 「REGISTER: urban young adult colloquial」with the note that
「Occasional mild profanity is OK」citing `"哭成了傻×"`, `"牛×的人"` (`lishanglong.md:84`);
「ENDINGS: never summarize. Three options only」(warm wish / sharp short sentence / lingering
rhetorical question) (`lishanglong.md:86-89`); 「LITERARY REFERENCES should be organic」
(苏格拉底, 歌德, 《集结号》, 《哆啦A梦》) (`lishanglong.md:91`). Anti-patterns: 11 bullets
(`lishanglong.md:95-105`). Templates: 8 (`lishanglong.md:26-35`), e.g. `"你所谓的X，不过是Y"`,
`"其实每个人，都要学会X"`, `"愿你X，不那么Y"`. Example passages: inline only, numerous quoted
fragments (`"朋友D回不了北京了。"`, `"深夜，我泪流满面。"`, `"是的，孤独是会令人上瘾的。"`).

**`liuzichao.md`** — `# 声音：刘子超 (Liú Zǐchāo)` (`liuzichao.md:1`). 适用：文学游记、地点书写、
历史与当下交错的非虚构 (`liuzichao.md:3`). Sections at `liuzichao.md:14,26,39,113`. Override clause
(`liuzichao.md:8`): 「本声音鼓励使用 `——` 做跳接、插入、补语，覆盖 Core Rules §6 不使用长破折号的规则」.
Recorded dimensions: biographical persona — born 1984, 北京大学中文系, Central Europe/Central Asia
travel, heroes Bruce Chatwin, Robert Byron, Paul Theroux, W.G. Sebald (`liuzichao.md:16`); worldview of
vanishing things and the 「支点」(fulcrum) (`liuzichao.md:18`); reader-as-fellow-traveler stance
(`liuzichao.md:20`); emotional register 「melancholic but not despairing」(`liuzichao.md:22`);
**「Your method: you weave three threads together」— named thread model (1) present sensory (2)
historical (3) people met** (`liuzichao.md:24`); 「OPEN with a scene」with two named approaches
Scene entrance / Fact-hook (`liuzichao.md:41-43`); **「SENSORY DENSITY is non-negotiable. Every
paragraph that describes a place must engage at least two senses」with the four senses enumerated
Visual / Olfactory / Tactile-thermal / Auditory and Chinese smell examples**
(`liuzichao.md:45-49`); 「WEAVE THREE THREADS」expanded into named per-thread rules and four named
transition triggers Sensory / Memory / Spatial / Historical (`liuzichao.md:51-60`);
「METAPHORS must be precise, not ornate」with `"NEVER pile adjectives. One precise simile replaces
five adjectives."` (`liuzichao.md:62-66`); 「QUOTATIONS are part of your rhythm」(`liuzichao.md:68`);
**「CHARACTER SKETCHES use "白描" (plain drawing)」with a 2-3 external details rule**
(`liuzichao.md:75-79`); 「HUMOR is cold and situational」with three named types
(`liuzichao.md:81-85`); 「HISTORY as archaeology」(`liuzichao.md:87`); **「EM DASHES (——) for pivots,
asides, and supplements」quantified: 「Em dashes should appear at least 3-4 times per passage.
They are your breathing marks.」** (`liuzichao.md:93-97`); **「RHYTHM: flowing, not staccato.
Sentences are medium to long」** with short sentences restricted to three named uses
(`liuzichao.md:99-103`); 「ENDINGS: never summarize, never moralize. Three options only」— Lingering
farewell / Image freeze / Quote fade-out (`liuzichao.md:105-108`); 「EMOTIONAL RESTRAINT is paramount」
(`liuzichao.md:110`). Anti-patterns: 12 bullets (`liuzichao.md:115-126`), including
「Use travel guide language ("推荐""必去""打卡""不容错过")」and
「Use vague quantifiers ("很多""大约""一些") when a specific number or name is available」.
Templates: 8 (`liuzichao.md:30-37`), e.g. `"X得像Y"`, `"仿佛/宛如 + historical or cinematic analogy"`,
`"与其说是X，毋宁说Y"`, `"——比如X" / "——也就是说X"`. Example passages: inline only; this file carries
the most quoted Chinese fragments of the set.

**`lixiaolai.md`** — `# 声音：李笑来 (Li Xiaolai)` (`lixiaolai.md:1`). 适用：解释型长文、成长 newsletter、
概念驱动的评论与博客 (`lixiaolai.md:3`). Sections at `lixiaolai.md:14,24,37,101` (the only lowercase
`## Voice rules`). Override clause (`lixiaolai.md:8`): 「本声音允许使用长破折号 `——`，覆盖 Core Rules §6」.
Recorded dimensions: 「a guy from 东北」persona, failed 高考, self-taught English, 新东方, early Bitcoin
(`lixiaolai.md:16`); worldview on clear thinking (`lixiaolai.md:18`); **named invented vocabulary
`"刚需幻觉"`, `"过早引用"`, `"微笑曲线/猥琐曲线"`, `"简单恐惧症"`** (`lixiaolai.md:22`);
「OPEN by redefining a concept」(`lixiaolai.md:39`); **「ARGUE in staircases」five-step escalation plus
translate-the-conclusion-2-3-times with three verbatim cue phrases** (`lixiaolai.md:41-50`);
**「RHYTHM: long reasoning + short detonation」quantified: 「These micro-paragraphs (2-6 characters)
are mandatory. Every few paragraphs, one must appear.」** (`lixiaolai.md:52-57`);
**「EM DASHES (——) are your rhythmic soul」with four named uses** (`lixiaolai.md:59-64`);
**「COLLOQUIAL PARTICLES」with a verbatim particle list `呗, 嘛, 啊, 罢, 事儿` plus
`"说白了", "其实", "反正", "相信我"`** (`lixiaolai.md:66-70`); **「NUMBERS must be precise」with the
extraordinary instruction 「If you don't have a real number, invent a plausible specific one rather
than hedging.」 and sample figures `"43.73岁", "74.39%", "80594户", "万分之五"`**
(`lixiaolai.md:72`) — note this conflicts with Core Rules and with the safety posture of every other
repo in this inventory; 「ANALOGIES must be earthy, not literary」(`lixiaolai.md:74`);
「RHETORICAL QUESTIONS as weapons」stacking 3-4 (`lixiaolai.md:80`); 「AUTHORITY from experience,
never credentials」(`lixiaolai.md:85`); 「TRANSITIONS are blunt」with four verbatim cues
(`lixiaolai.md:88-92`); 「ENDINGS: never summarize. Three options only」(`lixiaolai.md:94-97`);
「CONCEPT COINAGE」(`lixiaolai.md:99`). Anti-patterns: only 8 bullets — the shortest list
(`lixiaolai.md:103-110`). Templates: 8 (`lixiaolai.md:26-35`), e.g. `"所谓的X，指的是Y"`,
`"再翻译一遍：X"`, `"X才是永恒的刚需"`, `"就这么简单。"`.

**`luozhenyu.md`** — `# 声音：罗振宇 (Luó Zhènyǔ)` (`luozhenyu.md:1`). 适用：故事型科普、跨域类比、
长讲座式文章 (`luozhenyu.md:3`). Sections at `luozhenyu.md:14,24,37,94`. Generic override clause
(`luozhenyu.md:8`). Recorded dimensions: CCTV-turned-knowledge-entrepreneur persona, 罗辑思维, 得到,
self-label 「知识的搬运工」(`luozhenyu.md:16`); worldview — 理性乐观派, despises 阴谋论 and 傻帽悲观派
(`luozhenyu.md:18`); reader relationship as co-explorer, explicitly contrasted with Li Xiaolai
(「You're warmer and more inviting than Li Xiaolai, less confrontational」) (`luozhenyu.md:20`);
「Your method: story-first persuasion」(`luozhenyu.md:22`); 「OPEN with a story or a big question」
three options (`luozhenyu.md:39-43`); 「ARGUE through stories, not logic chains」with the explicit
reversal rule 「Never state a principle and then find an example — reverse the order.」
(`luozhenyu.md:45`); **「FLIP the perspective」— 「In every piece, there must be at least one moment
where you show the reader that what they assumed was wrong」with four verbatim signals including
`"后来一想，哪是这么回事！"`** (`luozhenyu.md:47-52`); 「PROGRESS through questions」with named hinges
`"怎么办呢？" "为什么？" "但问题是"` (`luozhenyu.md:54`); 「CROSS-DOMAIN ANALOGIES are mandatory」with
three worked examples (`luozhenyu.md:56-60`); **「REGISTER: mix oral and written Chinese freely」with a
verbatim colloquial list `"甭管", "搁中国来说", "扯淡", "捞到一碗汤喝", "没跑了"` and a classical
four-character list `"此消彼长", "源远流长", "命运攸关"`** (`luozhenyu.md:62`); 「CREDIT your sources
casually but clearly」(`luozhenyu.md:64-68`); **「TRANSLATE numbers into feelings」with the named pivot
`"这是什么概念呢？"` and the closer `"可见"`** (`luozhenyu.md:70-73`); 「USE "我们" more than "我"」
(`luozhenyu.md:75`); 「TRANSITIONS through questions and problems」with four cues
(`luozhenyu.md:81-85`); 「ENDINGS: give a judgment or forward pointer, never a summary」three types
(`luozhenyu.md:87-90`); 「LAYER your argument」with the four-level shape surface understanding →
first complication → deeper complication → insight (`luozhenyu.md:92`). Anti-patterns: 10 bullets
(`luozhenyu.md:96-105`). Templates: 8 (`luozhenyu.md:26-35`), e.g.
`"X会不会Y？这个问题不仅Z关心，A都关心。"`, `"这是什么概念呢？"`, `"但问题是/可问题在于"`.

**`wujun.md`** — `# 声音：吴军 (Wú Jūn)` (`wujun.md:1`). 适用：通识、技术史、系统性长文与讲义体写作
(`wujun.md:3`). Sections at `wujun.md:14,24,37,82`. Override clause (`wujun.md:8`):
「本声音支持 `首先……其次……最后……` 的系统化分层，覆盖 Core Rules §3 对机械结构的限制（前提是每一层都有实质内容）」.
Recorded dimensions: Johns Hopkins PhD / Google / Tencent persona, polymath scope
(`wujun.md:16`); worldview on 通识教育 and 思维方式 (`wujun.md:18`); reader relationship — 「a professor
on a university podium, addressing serious adults」(`wujun.md:20`); 「systematic knowledge architecture」
(`wujun.md:22`); 「OPEN with either a macro-question, a historical entry point, or a concrete case」
plus an explicit disambiguation: 「NEVER open with a concept attack ("你根本没想清楚") — that is Li
Xiaolai, not Wu Jun.」 (`wujun.md:39`); **「BUILD ARGUMENTS through systematic architecture, not
staircase escalation」with three named framework patterns `"首先……其次……最后……"`,
`"第一个问题……第二个问题……第三个问题……"`, nested narrowing** (`wujun.md:41-45`);
「USE HISTORY as your primary evidence base」with named scientists (Turing, Shannon 1948, Hilbert's 23
problems) (`wujun.md:47-51`); **「RHYTHM」quantified: 「medium-length sentences with logical
connectors」, connector list `"因此""这是因为""但是""当然""也就是说""由此可见"`,
「NOT staccato bursts. NOT single-word paragraphs.」, 「Every paragraph should be 100-400 characters
with complete internal logic.」** (`wujun.md:53`); **「REGISTER: elevated but accessible」—
standard written Chinese (书面语), explicitly 「Avoid 语气词 (呗, 嘛, 啊, 罢)」and 「Avoid slang」,
with a named English-embedding policy (Google, MIT, Liberal Arts, NIST)** (`wujun.md:55`);
「TONE: measured authority with genuine warmth」preferring `"可以讲"` / `"由此可见"` over
`"说白了"` / `"相信我"` (`wujun.md:57`); 「ACKNOWLEDGE COMPLEXITY」with qualifier list
`"当然""需要指出的是""这并不意味着"` (`wujun.md:59`); 「ANALOGIES must be precise and technical,
not earthy or vulgar」with three worked analogy families (`wujun.md:61-65`); 「NUMBERS」with the note
「"大约""左右" are acceptable」— directly opposite to 李笑来 (`wujun.md:67`); 「TRANSITIONS: use logical
connectors, not dramatic interjections」with an explicit negative list attributed to another voice:
「NEVER use: "等等，还没完！""话说回来""说实话" (these are Li Xiaolai markers)」(`wujun.md:69-72`);
「ENDINGS: summarize at a higher level of abstraction」with three options and an explicit ban list
that rules out 李笑来's endings (`wujun.md:74-78`); 「CROSS-REFERENCE your own knowledge system」
(`wujun.md:80`). Anti-patterns: 12 bullets (`wujun.md:84-95`). Templates: 8
(`wujun.md:26-35`), e.g. `"这并非因为X，而是因为Y"`, `"由此可见，X"`, `"需要指出的是，X"`.

### 6.5 Is there a COMMON SCHEMA across the eight profiles?

**Verdict: YES at the container level, NO at the field level. The set is "same skeleton, ad-hoc
fields."** This is good news for a unified Voice Profile interface and bad news for a mechanical
field-level parser. Evidence:

**Evidence FOR a common schema (structural, 8/8 files):**

1. Identical line-1 pattern `# 声音：<中文名> (<Pinyin>)` in all 8.
2. Identical line-3/4 labels `适用：` and `启用方式：` in all 8.
3. Identical 4-line `注意：` preamble asserting neutrality-by-default and author-file precedence.
4. Identical `---` separator at line 10 and persona prose starting at line 12 in all 8.
5. Identical `## Persona (who you are when writing)` at line 14 in all 8.
6. Identical `## Quick Reference: Sentence Templates` heading in all 8, with the same lead-in
   clause `Reach for these patterns naturally — they are <Author>'s sentence-level DNA:` and
   **exactly 8 numbered entries in every file**.
7. A voice-rule section with **exactly 12 numbered items in every file** (heading spelling varies:
   `## Voice Rules` ×7, `## Voice rules` ×1).
8. A terminal anti-pattern section (heading spelling varies between `Anti-Patterns` ×5 and
   `Anti-patterns` ×3, and the author name is sometimes replaced by `this author`) containing
   unnumbered `-` bullets, count ranging **8-13**.
9. Every profile declares which Core Rule it overrides, in the line-6..8 preamble — 5 of 8 name a
   specific rule number (`fengtang` §2, `helaoshi` §4/§8, `liuzichao` §6, `lixiaolai` §6, `wujun` §3);
   3 of 8 (`hefan`, `lishanglong`, `luozhenyu`) leave it generic. This is a consistent *slot* with
   inconsistent *filling*.
10. Every voice rule is authored in English with Chinese evidence strings inline; no file has
    frontmatter, tables, or JSON.

**Evidence AGAINST a common schema (content, per-file):**

1. The 12 Voice Rules are *thematically* free: there is no fixed slot order. `fengtang` rule 1 is
   register-mixing; `wujun` rule 1 is openings. Both files have an openings rule and an endings
   rule, but at different indices (`fengtang` ENDINGS = rule 11, `hefan` ENDINGS = rule 10,
   `helaoshi` endings = rule 11 `No summaries…`, `wujun` ENDINGS = rule 11,
   `liuzichao` ENDINGS = rule 11, `luozhenyu` ENDINGS = rule 11, `lishanglong` ENDINGS = rule 11,
   `lixiaolai` ENDINGS = rule 11).
2. Dimension names are free prose in bold small caps, not an enumerated vocabulary. `fengtang` uses
   `MIX CLASSICAL AND VULGAR` / `OBJECTS` / `BEIJING FLAVOR`; `hefan` uses `EMBED DATA` /
   `CONCEPT INTRODUCTION` / `HEDGING`; `liuzichao` uses `SENSORY DENSITY` / `CHARACTER SKETCHES use
   "白描"`. There is no shared key set.
3. Quantified stylometry appears in only some files and is expressed in free prose, never as a field:
   李尚龙's 「At least 30% of your output should be direct quotes」(`lishanglong.md:47`) and
   「under 15 characters … Every 3-5 paragraphs, one must appear」(`lishanglong.md:52-57`);
   何帆's 「150-400 characters」/「under 15 characters」/「80% written register, 20% spoken」
   (`hefan.md:59,75`); 吴军's 「100-400 characters」(`wujun.md:53`); 鹤老师's 「under 20
   characters」/「1-3 sentences」/「>30 chars」(`helaoshi.md:43,65,76`); 刘子超's 「at least 3-4
   times per passage」(`liuzichao.md:97`); 李笑来's 「2-6 characters」(`lixiaolai.md:57`).
   冯唐 and 罗振宇 contain **no numeric stylometric bound at all**.
4. Taboo material is expressed as free sentences, not as a token list — except incidentally:
   `fengtang.md:67` (京味儿 vocabulary), `hefan.md:75` (spoken softeners),
   `luozhenyu.md:62` (oral + four-character lists), `lixiaolai.md:68` (particles),
   `wujun.md:55,84` (banned particles), `lishanglong.md:80` (city nouns),
   `liuzichao.md:115` (travel-guide vocabulary). No file has a `Taboo Words` field.
5. Cross-author disambiguation exists in prose only: `wujun.md:39` and `wujun.md:72` explicitly
   identify 李笑来 markers to avoid, and `luozhenyu.md:20` positions itself relative to Li Xiaolai.
6. `helaoshi.md:67` anonymizes the author in the anti-pattern heading, and `lixiaolai.md:1` renders
   the name without tone marks (`(Li Xiaolai)`) while the other seven use pinyin with tone marks —
   minor but real evidence of hand-authoring rather than templating.

**Import consequence:** the eight profiles are importable as unified Voice Profile objects, because
every one of them can be resolved to the same 5-slot shape
`{author, applicability, activation, neutrality_preamble, core_rule_override, persona, sentence_templates[8], voice_rules[12], anti_patterns[n]}`.
What cannot be imported mechanically is the *dimension* data inside `voice_rules` — that must be
normalized by an LLM-assisted extraction pass (see §11), not by a heading parser.

## 7. Corpus capability

Two files, both genre/style reference lists (not excerpts, not training text):

### 7.1 `references/corpus.md` (168 lines, 8,183 bytes)

Title `# 中文母语参考语料` (`corpus.md:1`). Purpose statement (`corpus.md:4`):
「它更像一个对照表，帮 `humanizer-zh` 判断一段中文哪里太虚、太直、太硬，哪里已经有了像样的中文节奏。」
Key design statement (`corpus.md:6`): 「真正要借的，不是哪位作者的名句，而是他们怎么起一段，怎么把话往下接，怎么在该收的时候收住。」
A hard sourcing constraint (`corpus.md:8`): **「优先使用 2022 年以前的公开书籍、博客、演讲稿或长文页面。」**

`## 使用原则` (`corpus.md:12-17`) gives 4 principles, notably 「借的是句法、判断、段落推进，不是人设、口癖和立场。」
(`corpus.md:16`) and 「个人腔调太重的作者，只适合借一点劲头，不适合整篇照着拧。」(`corpus.md:17`).

Four tiered sections, **17 author entries total**, each entry using the same three sub-labels
`- 适用：` / `- 学什么：` / `- 不要学：` followed by `- 参考：` with external links:

| Tier heading (verbatim) | Entries (with line) | Count |
| --- | --- | --- |
| `## 一、通用基线` (`corpus.md:19`) | 王小波 23, 阮一峰 31, 李笑来 41, 古典 51 | 4 |
| `## 二、书面中文与专栏参照` (`corpus.md:59`) | 刘瑜 63, 梁文道 72, 许知远 81, 张佳玮 90, 柴静 98 | 5 |
| `## 三、强风格参照` (`corpus.md:107`) | 冯唐 111, 罗永浩 119, 罗振宇 129, 韩寒 138 | 4 |
| `## 四、补充观察样本` (`corpus.md:147`) | 郭宇 151 (flagged: 「多数从 2022 年开始，严格说不属于本轮核心语料」, `corpus.md:153`) | 1 |

`## 五、怎么把它用于改写` (`corpus.md:159-168`) maps eight genre buckets to primary/secondary
references (e.g. 技术说明文 → 阮一峰 then 李笑来; 纪实非虚构 → 柴静 then 许知远; 演讲稿或直播口播 →
罗永浩 or 罗振宇) and closes with 「原文如果已经有明显作者人格，就找一个最近的参照，不要混三四种腔调。」
(`corpus.md:168`).

### 7.2 `references/corpus-quickpick.md` (45 lines, 2,932 bytes)

Title `# 中文母语参照速查表` (`corpus-quickpick.md:1`). Declared as the runtime fast path
(`corpus-quickpick.md:3-4`): 「这份短表给运行时快速选参照用。先在这里定方向，不够再读 `references/corpus.md`。」
Explicitly not a recipe (`corpus-quickpick.md:6`): 「别把它当配方表。」

Two tables:

- `## 按文体选` (`corpus-quickpick.md:8-20`): 9 rows, columns `| 文体 | 第一参照 | 第二参照 | 重点学习 | 明确避免 |`.
- `## 按作者选` (`corpus-quickpick.md:22-38`): **13 rows**, columns `| 作者 | 最适合的文本 | 学什么 | 不要学 |`.

`## 使用顺序` (`corpus-quickpick.md:40-45`): 4 steps, including 「如果主参照是冯唐、韩寒、罗永浩这类强风格作者，
只借节奏，不借人格。」(`corpus-quickpick.md:44`).

### 7.3 How the corpus is meant to be used

`SKILL.md:134-141` defines the loading conditions: read `corpus.md` when judging which native genre a
passage resembles, when the user asks 「改得像博客或书里写的」, when different references are needed
for 技术文/评论文/演讲稿, and when avoiding mistaking a strong personal voice for general Chinese.
`SKILL.md:141` sets the fast-path order: quickpick first, full corpus second. `README.md:26-28`
repeats the same three loading rules. `references/corpus.md:10` also points forward to quickpick.

Important distinction: **the corpus is a reference/benchmark system (借句法、判断、段落推进), while
`references/voices/` is an impersonation system (套作者的腔调).** The corpus explicitly forbids
borrowing 人设、口癖和立场 (`corpus.md:16`), while the voices deliberately supply 人格、句法模板、节奏规则、
反模式 (`SKILL.md:46`). The two author sets overlap in only 4 names (冯唐, 罗振宇, 李笑来, and
罗振宇/李笑来 both appear) out of 17 + 8 = 25 total author mentions.

## 8. Detectors and algorithms

**Plainly: this repository contains NO executable detection logic of any kind.** Detection is purely
prose instruction to a language model.

Evidence:

- There is no `.py`, `.js`, `.ts`, `.mjs`, `.sh`, `.rb`, or any other executable source file. The only
  non-Markdown files are `.claude-plugin/plugin.json` (155 bytes of manifest),
  `.github/workflows/release.yml` (release automation, not detection), `agents/openai.yaml`
  (display metadata), `VERSION`, `.gitignore`.
- There is no `scripts/` directory and no validator — unlike blader/humanizer
  (`blader-humanizer/scripts/validate-package.py`) and humanizer-zh-cn
  (`humanizer-zh-cn/scripts/validate-package.py`), which DO ship a package validator.
  Neither validator performs text detection either; they validate package structure.
- `SKILL.md:3` phrases the capability as instructions ("Detect and fix translation-like phrasing…"),
  and `SKILL.md:19-20` phrases detection as a human/LLM reading task
  (「先找最显眼的 AI 痕迹。重点看英文句法直译、机械对照句…… 」).
- No regex, no thresholds, no scoring constants, no match counts appear anywhere in the repository.

**"Watched phrase" lists (enumerated exactly, with locations).** These are the closest thing to
detector rules and are the best candidates for seeding a real detector:

| # | List content (verbatim) | Location | Size |
| --- | --- | --- | --- |
| 1 | `不是……而是……` / `不仅……还……` / `不再只是……而是开始……` / `X 并不意味着 Y，而是意味着 Z` | `patterns.md:23-26` | 4 |
| 2 | `对于……来说` / `基于此` / `围绕……展开` / `从某种意义上说` / `值得注意的是` / `与此同时` / `在这一背景下` / `使得……得以……` | `patterns.md:42-49` | 8 |
| 3 | `颠覆` / `革命` / `赋能` / `重塑` / `引领` / `开启新篇章` / `里程碑` / `深远影响` | `patterns.md:69-76` | 8 |
| 4 | `未来已经到来` / `这只是开始` / `行业将迎来新的篇章` / `真正的变革才刚刚开始` | `patterns.md:95-98` | 4 |
| 5 | `粗体小标题 + 冒号 + 解释` (structural, not lexical) | `patterns.md:118` | 1 |
| 6 | `持续深化` / `全面推进` / `积极探索` / `取得显著成效` / `实现高质量发展` / `打造闭环` | `patterns.md:149-154` | 6 |
| 7 | `在某种程度上可能会对……产生一定影响` / `必然彻底改写整个行业` | `patterns.md:173-174` | 2 |
| 8 | `第一步 / 第二步 / 第三步` / `第一个 / 第二个 / 第三个` / `第一层 / 第二层` | `patterns.md:377-378` | 3 |
| 9 | `接下来要……` / `下一步是……` / `接下来的问题是……` / `下一篇会讲到……` | `patterns.md:403-406` | 4 |
| 10 | `本质上` / `这件事` / `真正重要的是` / `归根结底` / `说到底` / `回到最初的那个问题` | `patterns.md:431-436` | 6 |
| 11 | `颠覆` / `革命` / `赋能` / `重塑` / `深刻改变` / `开启新篇章` | `SKILL.md:67` | 6 |
| 12 | `这标志着……` / `这意味着……的时代已经到来` | `SKILL.md:68` | 2 |
| 13 | `首先` / `其次` / `最后` / `与此同时` / `值得注意的是` / `从某种意义上说` | `SKILL.md:74` | 6 |
| 14 | `对于……来说` / `基于……` / `围绕……展开` / `使得……得以……` | `SKILL.md:62` | 4 |
| 15 | `完全取代` / `彻底结束` / `只剩一种可能` | `SKILL.md:112` | 3 |
| 16 | `先定义、再拆项、最后拔高` (structural) | `SKILL.md:162` | 1 |
| 17 | `LLM（大语言模型）` / `AI Design Agent` / `coworkers/agents` / `YouTube` / `OpenAI` / `GitHub` (typography-conformance examples) | `SKILL.md:97-100` | 6 |
| 18 | taboo-string lists inside voice profiles: `事儿, 屄, 贫, 混混, 板砖, 街面上, 辈儿` (`fengtang.md:67`); `呗, 嘛, 啊, 罢, 事儿` (`lixiaolai.md:68`); `呗, 嘛, 啊, 罢, 事儿` as BANNED (`wujun.md:84`); `出租屋, 隔断间, 快递小哥, 朋友圈, 三环` (`lishanglong.md:80`); `推荐/必去/打卡/不容错过` (`liuzichao.md:115`); `很多/大约/一些` (`liuzichao.md:124`) | various | ~30 |

Total watched/linked lexical items: **~70 distinct phrase strings across 18 list sites**, all in
prose bullet or backtick form. Note that list 11 and list 3 overlap heavily (`颠覆`, `革命`, `赋能`,
`重塑`, `开启新篇章` appear in both), and list 13 and list 2 overlap (`与此同时`, `值得注意的是`,
`从某种意义上说`). There are no regexes, no anchoring rules, and no negative-lookaround hints.

## 9. Scoring

**none found.**

There is no score, weight, severity, priority, confidence, or threshold anywhere in the repository.
Specifically verified absent:

- `references/patterns.md` has no severity column, no priority ordering statement, and no
  "strongest first" claim — the 13 patterns are presented as a flat unordered set
  (`references/patterns.md:3-17`).
- `SKILL.md` has no scoring section; `## Output` (`SKILL.md:145-151`) caps the explanation at
  「简短指出 3 到 6 个最明显的问题」 — a count of *reported findings*, not a score.
- `## Final Check` (`SKILL.md:153-165`) is a binary pass/fail checklist (9 items), not a rubric.
- No file contains a number that functions as a threshold. The only numbers in the corpus are
  prose quantities inside voice profiles (character counts, percentages of dialogue, em-dash
  frequency) which are generation targets, not detection scores.

Contrast: op7418/Humanizer-zh ships a `## 质量评分` section and blader/humanizer has explicit
strength semantics («The patterns are numbered strongest first: §1 to §5 justify an edit on one
sighting, and a pattern marked *weak alone* needs company», `blader-humanizer/SKILL.md:29`).
humanizer-zh has neither.

## 10. Pipeline and rewrite workflow

The exact ordered process, assembled from `## Workflow`, `## Voice Adoption`, `## Deep Review`,
`## Output`, `## Final Check`:

**Phase A — triage (`SKILL.md:15-26`, 6 steps):**

1. 先判断文本类型 — 博客、专栏、书稿、评论、产品分析 may take more rhythm and authorial judgment;
   公告、说明文、技术文档 prioritize accuracy and restraint (`SKILL.md:15-16`).
2. 先看文章主线 — determine what the first paragraph establishes, what function each body paragraph
   serves, whether the last paragraph closes the same thing (`SKILL.md:17-18`).
3. 先找最显眼的 AI 痕迹 — English syntax calques, mechanical contrast sentences, empty conclusions,
   list stacking, chained colons, em dashes, over-regular paragraph rhythm (`SKILL.md:19-20`).
4. 再决定改写力度 — light polish cleans wording and punctuation only; deep rewrite may reorder
   sentences, merge weak sentences, and supply subjects or causality (`SKILL.md:21-22`).
5. 保留作者原意 — no invented facts, no hardening of cautious judgment into absolutes, no elevating
   ordinary conclusions into era manifestos (`SKILL.md:23-24`).
6. 做最后一遍朗读检查 — must read like native Chinese writing (`SKILL.md:25-26`).

**Phase B — optional voice adoption (`SKILL.md:28-55`):**

7. Gate check: ask at most **once per session**, only if (a) voice adoption has not been asked this
   session, (b) the task is 深度改写、长篇润色、重写或风格化创作, and (c) the user has not said
   「保持中性」/「不要改风格」 (`SKILL.md:32-36`).
8. If asking: read `references/voices/index.md`, present the 8-author list
   (李笑来、鹤老师、罗振宇、吴军、李尚龙、何帆、冯唐、刘子超) (`SKILL.md:38`).
9. If the user names an author directly, skip the question and go straight to loading
   (`SKILL.md:41`).
10. Load `references/voices/<author>.md`, then overlay its 人格、句法模板、节奏规则、反模式 **on top of**
    `## Core Rules`, with **作者档案优先** on conflict (`SKILL.md:45-47`).
11. Support mid-session switching: 「换成 X」 discards and loads; 「不要作者声音了」 returns to neutral
    (`SKILL.md:48`).

**Phase C — conditional deep reference loading (`SKILL.md:123-143`):**

12. Load `references/patterns.md` if any of six conditions hold: deep rewrite rather than light polish;
    need to explain why a passage feels AI-written; the text has English source structure, marketing
    boilerplate or 通稿腔; need before/after examples; need to check intro/body/conclusion alignment;
    need to rebuild the whole structure (`SKILL.md:127-132`).
13. Load `references/corpus.md` if any of four conditions hold: need to judge which native genre the
    Chinese resembles; user asked 「改得像博客或书里写的」; need separate references for 技术文/评论文/
    演讲稿; need to avoid mistaking a strong personal voice for general Chinese (`SKILL.md:136-139`).
14. Fast path: read `references/corpus-quickpick.md` first; escalate to `corpus.md` only if
    insufficient (`SKILL.md:141`).
15. If a voice is active this session, additionally load the corresponding `voices/<author>.md`
    (`SKILL.md:143`).

**Phase D — output (`SKILL.md:145-151`, 3 ordered rules):**

16. Give the rewritten version first, directly.
17. Only if the user asks for explanation, name 3-6 of the most obvious problems.
18. Only if the user asks to preserve more original sentences, additionally supply a 「轻改版」 and a
    「重写版」.

**Phase E — final validation (`SKILL.md:153-165`, 9 checks):**

19. 读起来像中文作者在写，不像翻译后的英文.
20. 第一段提出的问题，最后一段确实有回应.
21. 主体段落都在服务主线，没有明显跑题段或重复段.
22. 句子之间有自然推进，不靠模板连接词硬粘.
23. 结论不过火，判断和事实强度匹配.
24. 全文节奏不要总是「先定义、再拆项、最后拔高」，更不能让读者连续三节都能预测下一节的写法.
25. 标点、术语、日期和品牌大小写统一.
26. 引号样式全篇统一（`""` 或 `「」` 二选一），没有把两种样式混用.
27. If a voice was active, re-scan against that profile's anti-patterns and test checklist, confirming
    the style has not drifted **and** that its verbal tics have not leaked into the neutral polish
    (`SKILL.md:165`).

**Retry / validation loop:** there is exactly **one** loop, and it is a single-pass re-read, not an
iterating loop: steps 6 and 19-27 are described as 「做最后一遍朗读检查」(`SKILL.md:25`) and 交付前逐项确认
(`SKILL.md:155`). There is **no** generate → critique → regenerate cycle, no self-scoring, no
attempt limit, and no termination criterion. The `## Final Check` list is a manual checklist for a
single revision pass. Compare `humanizer-zh-cn/SKILL.md:375-382`, which does define an explicit
「初稿 → 自问 → 修订终稿」 six-step loop; humanizer-zh does not.

## 11. Reusable modules and extraction plan

### 11.1 Module table

| module (file) | what it does | reuse recommendation | integration kind |
| --- | --- | --- | --- |
| `SKILL.md` §`## Core Rules` (8 rules, `SKILL.md:57-114`) | Always-on Chinese cleanup rules: translationese, empty big words, mechanical structure, rhythm, article structure, punctuation/typography, terminology/date normalization, judgment strength | **Adopt.** Highest-value Chinese rule block in the repo; it is the always-on layer and is broader than the 13 patterns in several areas (typography, dates, terminology). Keep verbatim Chinese rule names as canonical ids. | B (markdown skill → parse into rules) |
| `SKILL.md` §`## Workflow` + `## Deep Review` + `## Output` + `## Final Check` (`SKILL.md:13-26,123-165`) | The ordered pipeline, conditional reference loading, output contract, and 9-item delivery checklist | **Adopt the checklist and output contract; demote the loading strategy.** The conditional-loading design is an agent-context optimization specific to a Markdown skill and has no meaning in an executable pipeline. | D (methodology — do NOT put in the default execution path) |
| `SKILL.md` §`## Repo Overrides` (`SKILL.md:116-121`) | Project-over-skill precedence, sample-style imitation, and the 4-step quote-style precedence chain | **Adopt.** The quote-style precedence chain is directly implementable as config resolution and is the cleanest precedence model among all eight upstreams. | B |
| `SKILL.md` §`## Voice Adoption` (`SKILL.md:28-55`) | Opt-in gating policy for voice profiles: once-per-session ask, neutrality default, no mixing, no preamble leakage, author-over-Core-Rules | **Adopt as policy.** The four anti-patterns VA1-VA4 are ready-made invariants for the unified voice interface. | C (voice profile governance) |
| `references/patterns.md` (`patterns.md:1-454`) | 13 numbered Chinese AI-prose patterns + 6 article-level rewrite paths, each with 修改前/修改后 examples | **Adopt and split.** The 13 patterns become canonical Chinese rules; §10's six rewrite paths are methodology, not detection. | B for §1-§9, §11-§13; D for §10 |
| `references/patterns.md` §10 six sub-paths (`patterns.md:233-363`) | Six article-level rewrite routes (问题钉住 / 现象先行 / 自我误判 / 先亮判断 / 人物立住 / 降温看分歧) with 适用/适合处理的问题/可参考的起承转合 | **Keep as optional strategy library**, invoked explicitly, never in the default path. It is the best-documented non-Western article-structure methodology in the set. | D |
| `references/voices/index.md` (`index.md:1-32`) | 8-author one-line catalog + selection advice | **Adopt as the voice registry seed**, but note it is a Markdown table, not data. Author `适合的文本` and `风格关键词` columns map to unified `best_for` / `style_tags`. | C |
| `references/voices/*.md` ×8 (`voices/*.md`) | Eight author voice profiles: persona, 8 sentence templates, 12 voice rules, 8-13 anti-patterns each | **Adopt with normalization.** Same container schema across all 8 (see §6.5) but ad-hoc fields; requires one LLM-assisted extraction pass to a typed object. This is the primary model for the new unified Voice Profile system. | C (voice profile — abstract to unified voice interface) |
| `references/corpus.md` (`corpus.md:1-168`) | 4-tier, 17-entry Chinese-native reference corpus index with 适用/学什么/不要学 per entry and 8 genre→reference mappings | **Adopt as reference metadata, not as voices.** This is the only "borrow craft, not persona" system in the whole upstream set and is a genuinely distinct concept from voice impersonation. | E for the linked external works (do not copy); C-adjacent for the `学什么/不要学` annotations |
| `references/corpus-quickpick.md` (`corpus-quickpick.md:1-45`) | 32-line runtime genre→reference decision table (9 genre rows, 13 author rows) | **Adopt as a lookup table.** The most mechanically parseable artifact in the repo: two clean 5-column and 4-column pipe tables. | B (trivially parseable) |
| `CLAUDE.md` (`CLAUDE.md:1-10`) | Declares this repo's own quote convention `humanizer-zh quotes: 「」` and points at the precedence chain | **Adopt as the worked example of Repo Override RO3.** Do not copy the file itself. | E (research-only example) |
| `.claude-plugin/plugin.json` (155 B) | Claude Code plugin manifest: `name`, `description`, `skills: ["./SKILL.md"]` | **Reference only**; the new project is not a Claude plugin. Note it omits `$schema`, `version`, `author`, `license` present in blader's manifest. | E |
| `agents/openai.yaml` (268 B) | Codex display metadata: `display_name`, `short_description`, `default_prompt` | **Reference only.** | E |
| `.github/workflows/release.yml` | Auto-tag + release on `VERSION` change | **Reference only.** | E |
| `CHANGELOG.md` | SemVer history; confirms 8 voices at 1.3.0 and 3 new patterns at 1.2.0 | **Use as provenance evidence**, not as code. | E |

### 11.2 Mechanical extraction plan — `references/patterns.md` → canonical rules

The file is unusually regular; extraction is deterministic with no NLP required.

**Step 1 — split on level-2 headings.** Delimiter: lines matching `^## ` (exactly two hashes).
This yields one preamble chunk (`patterns.md:1-18`, the title + `## 目录`) and 13 rule chunks.
Filter out `## 目录` (`patterns.md:3`) — it is the table of contents, not a rule.

**Step 2 — parse the rule id and name.** Pattern: `^## (\d+)\. (.+)$` applied to each chunk's first
line. Verified against all 13: `## 1. 机械对照句` … `## 13. 抽象转义与重锤句`. Capture group 1 is
`index` (1-13, contiguous), group 2 is the **verbatim `pattern_name`** — store with no trimming,
translation, or case change.

**Step 3 — special-case `## 10`.** Its chunk (`patterns.md:219-372`) contains six nested
`^### (\d+)\. (.+)$` sub-headings plus a `### 使用方法` sub-heading at `patterns.md:365` that must
be excluded from the sub-path list. Then, inside each sub-path chunk, extract the three fixed labels:
`^适用：$` (start of a bullet list), `^适合处理的问题：$`, `^可参考的起承转合：$`. Each is followed by
a bullet list, and `可参考的起承转合` is followed by a single blockquote block whose lines begin `> `.

**Step 4 — extract the watched-phrase list.** Inside the chunk, find the first fenced inline-code
sequence: lines matching `` ^- `.+`$ `` before any `修改前` marker. Emit each backtick-delimited
string as a `watch_phrase`. If the chunk has no such list (patterns 9, 10, 11 partly, 12 has one,
13 has one), fall back to scanning the `常见问题：` bullet block for `^\s*- ` items.

**Step 5 — extract the before/after pair.** Delimiter: the literal lines `修改前：` and `修改后：`
(match `^修改前：$` / `^修改后：$`). The example text is the following `> ` blockquote lines joined
with `\n`, stripped of the leading `> `. Patterns 2, 4, 5, 9, 10 (indirectly), 11, 12, 13 have
pairs; pattern 6 has a pair; patterns 1, 3, 7, 8 have pairs; **pattern 10 has none** at the top level
(its examples are inside sub-paths) — handle as `examples: []`.

**Step 6 — extract the guidance.** Everything between the last `常见问题：` bullet and `修改前：`, or
the labeled `处理方法：` / `优先做法：` / `处理原则：` / `更自然的写法：` block where present
(patterns 2, 3, 4, 6, 7, 8, 11, 12, 13 use `处理方法：` or `优先做法：`; pattern 5 has no label).
Store as prose `guidance` — **do not** attempt to atomize it into instructions.

**Step 7 — set fields with no source.** `category` must be assigned from a project-owned taxonomy
(the file offers none; `目录` is flat). `severity` must be `null` — the file states none (see §9).
Record `evidence` as `references/patterns.md:<heading-line>`.

**Resulting canonical rule object:**
`{ id: "patterns-zh-1", index: 1, pattern_name: "机械对照句", pattern_name_en: null, category: <assigned>, watch_phrases: [...], guidance: "...", before: "...", after: "...", severity: null, source: "references/patterns.md:19", upstream: "ai-zixun/humanizer-zh@f75f1ac973" }`

**Then merge `SKILL.md` Core Rules with a parallel pass.** Split on `^### (\d+)\. (.+)$` inside
`SKILL.md` and keep only chunks whose parent section is `## Core Rules` (`SKILL.md:57`); this is
required because `references/patterns.md` §10 *also* uses `### <n>.` sub-headings, so the parent
section must be tracked. Core Rules have no `修改前/修改后` pairs and no fenced watch-phrase lists;
their bullets are the guidance and their inline 「」-quoted strings are the watch phrases (parse
`「(.+?)」` inside `SKILL.md:59-114`). Do **not** auto-dedupe Core Rules against patterns — the
overlap is semantic (see §4.4) and must be resolved deliberately.

### 11.3 Mechanical extraction plan — `references/voices/*.md` → unified voice-profile objects

**Step 1 — enumerate.** `glob references/voices/*.md`, exclude `index.md`. Expect exactly 8 (assert
`count === 8` — this is the check the task brief got wrong).

**Step 2 — parse the 5-line header block blindly, not by regex-on-content.** All 8 files have the
same fixed shape, so positional parsing is reliable and content parsing is not:
`line 1` → `^# 声音：(.+?) \((.+?)\)$` → `{display_name, pinyin}`;
`line 3` → `^适用：(.+)$` → `applicability`;
`line 4` → `^启用方式：(.+)$` → `activation`;
`lines 6-8` → the `注意：` block → `neutrality_preamble`; and from that block, capture the override
clause with `覆盖 Core Rules §(\d+)` (matches in 5 of 8) → `core_rule_overrides: [n]`, else `[]`.

**Step 3 — split on `^## ` (level 2).** All 8 yield exactly 4 chunks, in this order:
`Persona`, `Quick Reference: Sentence Templates`, voice rules, anti-patterns. **Match headings
case-insensitively and allow the two known spelling variants** (`Voice Rules` | `Voice rules`;
`Anti-Patterns` | `Anti-patterns`), otherwise 3 files will silently produce 3 chunks instead of 4.
Anchor on the stable English stems `Persona`, `Quick Reference`, `Voice`, `Anti-pattern`, not on the
full heading string. Do **not** parse the trailing `— things <Author> would NEVER do:` clause to get
the author name; `helaoshi.md` anonymizes it.

**Step 4 — `persona`.** Take the chunk body verbatim (lines 12-13 preamble plus 3 paragraphs).
It has no internal labels — store as a single `persona_prose` string plus a `worldview_pills: []`
array that must be filled by an LLM pass (the worldview content is only formatted as bullets in
`fengtang.md:19-23` and `helaoshi.md:23-28`; `hefan.md:18`, `lishanglong.md:18`, `liuzichao.md:18`,
`lixiaolai.md:18`, `luozhenyu.md:18`, `wujun.md:18` are prose paragraphs).

**Step 5 — `sentence_templates`.** Split the chunk on `^\d+\. ` — yields **exactly 8** in every
file. Each item's text begins with a quoted Chinese template followed by `— <gloss>`; split on the
literal ` — ` (em dash with spaces) to get `template` and `gloss`. Verified against
`fengtang.md:33-40`, `hefan.md:28-35`, `helaoshi.md:32-39`, `lishanglong.md:26-35`,
`liuzichao.md:30-37`, `lixiaolai.md:26-35`, `luozhenyu.md:26-35`, `wujun.md:26-35`.

**Step 6 — `voice_rules`.** Split the chunk on `^\d+\. ` — yields **exactly 12** in every file.
Each rule body begins with an optional bolded dimension name `^\*\*(.+?)\.?\*\*` (match
`\*\*([^*]+)\*\*`); where present, that bolded string is the closest thing to a field name and should
be stored as `dimension`. Where absent (e.g. `fengtang.md:77` HUMOR ends with a period inside the
bold, `helaoshi.md:43` bold includes the trailing period) strip trailing `.` and `:`.
Then run a **normalization pass** over these free-form dimension strings to map them onto a project
schema. The observed recurring normalized targets are: `openings`, `argument_structure`, `rhythm`,
`register`, `pronouns`, `punctuation_profile`, `dialogue`, `humor`, `imagery`, `citations`,
`numbers`, `endings`, `taboo_avoidance`. This mapping is not mechanical — the same dimension appears
under different names (`## Voice Rules` 1, 3, 4, 5, 6, 9, 10, 11, 12, 13).

**Step 7 — `anti_patterns`.** Split the chunk on `^- ` (single hyphen + space) — yields **8**
(`lixiaolai`) to **13** (`helaoshi`). Store each bullet verbatim. To separate *lexical* taboos from
*behavioral* ones, run `grep` for `["“](.+?)["”]` inside each bullet: quoted Chinese tokens
(e.g. `"众所周知"`, `"总结一下"`, `"我只是一个普通人"`, `"可能在某种程度上也许"` in
`fengtang.md:96-99`; `"可能" "也许" "在某种程度上" "不一定"` in `helaoshi.md:70`;
`"首先……其次……最后"` in `lishanglong.md:100`) become `taboo_phrases`; unquoted bullets become
`taboo_behaviors`.

**Step 8 — `examples`.** Scan the raw file for `^Examples:$` (present in 2 of 8: `fengtang.md:44`,
`helaoshi.md:43`) and for indented quoted fragments. There are **no** blockquote (`^>`) example
passages in any profile, so `example_passages: []` for all 8. Store inline fragments as
`example_fragments: []` (a flat list) — they are not delimited by any marker and must be collected
by pattern `"(.+?)"` on lines that begin with 4+ spaces.

**Step 9 — `stylometric_bounds`.** There is no field for these, so extract them with a targeted
number scan: `grep -E '[0-9]+(-[0-9]+)? (characters|sentences|%)'` and Chinese equivalents
(`[0-9]+ ?个?字`, `[0-9]+ 到 [0-9]+`). This recovers 李尚龙's 30%/15 chars/3-5 paragraphs
(`lishanglong.md:47,52-57`), 何帆's 150-400 chars/15 chars/80%-20% (`hefan.md:59,75`),
吴军's 100-400 chars (`wujun.md:53`), 鹤老师's 20 chars/1-3 sentences/30 chars
(`helaoshi.md:43,65,76`), 刘子超's 3-4 times per passage (`liuzichao.md:97`), 李笑来's 2-6 chars
(`lixiaolai.md:57`). 冯唐 and 罗振宇 yield nothing — record `stylometric_bounds: {}` rather than
inventing bounds.

**Resulting unified Voice Profile object:**
`{ id: "zh-fengtang", display_name: "冯唐", pinyin: "Féng Táng", locale: "zh-Hans", applicability: "个人随笔、管理心法、文白杂糅评论", activation: "opt-in per session", neutrality_preamble: "...", core_rule_overrides: [2], persona_prose: "...", worldview_pills: [], sentence_templates: [{template, gloss} ×8], voice_rules: [{index, dimension, text} ×12], anti_patterns: [{text, taboo_phrases: [], taboo_behaviors: []} ×11], example_fragments: [], example_passages: [], stylometric_bounds: {}, source: "references/voices/fengtang.md", upstream: "ai-zixun/humanizer-zh@f75f1ac973", license: "MIT (c) 2026 aizixun" }`

**Step 10 — index.** Parse `references/voices/index.md` table rows (`^\| .+ \| .+ \| .+ \| .+ \|$`
within the `## 八位可选` chunk) to cross-check `display_name`, `best_for` (适合的文本),
`style_tags` (风格关键词) against the per-file objects. Assert `row_count === 8` and that every
linked filename resolves — this is the integrity check the set is currently missing.

## 12. Tests, CI, packaging

### 12.1 Tests

**No tests exist.** There is no test directory, no test framework, no fixtures, no golden files, and
no validator script. The repository is documentation-only. `CHANGELOG.md` never mentions tests
(93 lines, no test entries). The absence is notable because the closest comparable upstreams both
ship a package validator: `blader-humanizer/scripts/validate-package.py` (3,057 bytes) and
`humanizer-zh-cn/scripts/validate-package.py` (2,985 bytes), and both wire it into CI.

### 12.2 CI — `.github/workflows/release.yml` (1,870 bytes, 67 lines)

Sole workflow. Trigger: `on: push: branches: [main] paths: [VERSION]` plus `workflow_dispatch`
(`release.yml:3-7`). Permissions: `contents: write` (`release.yml:9-10`). Single job `release` on
`ubuntu-latest` (`release.yml:12-14`). Steps:

1. `actions/checkout@v4` with `fetch-depth: 0` (`release.yml:16-18`).
2. `Read version` — `tr -d '[:space:]' < VERSION`, fail if empty, emit `version` and `tag=v$version`
   to `$GITHUB_OUTPUT` (`release.yml:20-29`).
3. `Skip if tag already exists` — `git rev-parse -q --verify "refs/tags/$TAG"`, sets `exists=true|false`
   (`release.yml:31-41`). This makes the workflow idempotent.
4. `Extract changelog section` — an `awk` block that prints from `^## \[<version>\]` until the next
   `^## \[`, fails if the result is empty (`release.yml:43-56`).
5. `Create tag and GitHub Release` — `gh release create "$TAG" --target "$GITHUB_SHA" --title "$TAG"
   --notes-file .release-notes.md` (`release.yml:58-67`).

`README.md:97` and `README.en.md:98` document the flow: bump `VERSION`, prepend a `CHANGELOG.md`
entry, push to `main`. There is **no** validation workflow (contrast
`blader-humanizer/.github/workflows/validate.yml` and
`humanizer-zh-cn/.github/workflows/validate.yml` + `sync-upstream.yml`), no lint step, no
markdown check, no link check.

### 12.3 Packaging — `.claude-plugin/plugin.json` (155 bytes, 5 lines)

Declares exactly three keys (`plugin.json:1-5`):
`"name": "humanizer-zh"`, `"description": "Remove signs of AI-generated, translated, or overly
mechanical Chinese prose."`, `"skills": ["./SKILL.md"]`. It declares **no** `version`, no `author`,
no `license`, no `$schema`, no `homepage`/`repository` — compare `blader-humanizer/.claude-plugin/plugin.json`
(520 bytes) which declares all of those plus `keywords`. The `description` string is byte-identical to
the frontmatter `description` prefix in `SKILL.md:3`.

There is **no** `.claude-plugin/marketplace.json` (blader and humanizer-zh-cn both have one), and
**no** `package.json`, `pyproject.toml`, or lockfile. Packaging is purely "repository root is the
skill directory" (`README.md:9`), installed by the third-party `npx skills add` CLI
(`CHANGELOG.md:61`). `agents/openai.yaml` supplies Codex display metadata only
(`openai.yaml:1-4`), and `README.md:140` states it 「不影响 Claude Code 或 OpenClaw」.

## 13. License and provenance — CRITICAL

### 13.1 Is this repo derived from blader/humanizer?

**Verdict: YES — acknowledged as *inspiration/direction*, with original Chinese rule content. Confidence: high (≈95%) that the repo is derived at the level of concept, packaging and workflow; moderate (≈70%) that no blader text was copied verbatim; and the repo's own claim is a weaker claim than the evidence supports.**

**Evidence FOR derivation:**

1. **Explicit self-attribution in both READMEs.** `README.md:154` is a section titled `## 致谢` whose
   entire body reads: 「这个技能的整体方向与分享方式受到 [blader/humanizer](https://github.com/blader/humanizer) 的启发。原仓库把英文文本去 AI 味整理成可复用的 Claude Code skill；`humanizer-zh` 在这个思路上扩展到中文场景，重点处理翻译腔、中文节奏、标点排版和长篇非虚构写作中的机械表达。」
   `README.en.md:149-151` mirrors it: `## Acknowledgements` / 「This skill is inspired by
   [blader/humanizer](https://github.com/blader/humanizer), which packaged AI-writing cleanup
   guidance as a reusable Claude Code skill. `humanizer-zh` extends that idea into Chinese writing…」
   This is the only upstream attribution anywhere in the repository.
2. **Package-shape identity with blader.** Same skill-package conventions: root `SKILL.md` as the
   runtime entry; YAML frontmatter with `name` + `description`; `references/` for on-demand material;
   `.claude-plugin/plugin.json` pointing `skills` at `./SKILL.md`; `agents/openai.yaml` for Codex
   display metadata; `README.md` + `README.en.md`; `CHANGELOG.md` + `VERSION`. Five of those files
   exist in blader's repo in the same roles (`blader-humanizer/` file list: `SKILL.md`, `README.md`,
   `AGENTS.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `agents/openai.yaml`,
   `scripts/validate-package.py`, `.github/workflows/validate.yml`).
3. **Taxonomy correspondence, not identity.** Several blader patterns have clear conceptual
   counterparts here, which is the expected signature of derivation-by-adaptation rather than
   copy-paste:
   - blader `### 1. Not X but Y` (`blader-humanizer/SKILL.md:58`) ↔ `## 1. 机械对照句` (`patterns.md:19`),
     same anchor example family (`不是……而是……` vs `not X but Y`).
   - blader `### 2. One-line closers and dramatic fragments` (`blader-humanizer/SKILL.md:75`) ↔
     `## 4. 段落结尾的口号化收束` (`patterns.md:91`) and `## 12. 章末段末的预告式收束` (`patterns.md:399`).
   - blader `### 6. Forced triads` (`blader-humanizer/SKILL.md:139`) ↔ `## 5. 列表和排比成瘾` (`patterns.md:113`).
   - blader `### 8. Dashes as the universal connector` (`blader-humanizer/SKILL.md:159`) ↔
     `## 6. 冒号、破折号和引号` (`patterns.md:129`) and `SKILL.md:95`.
   - blader `### 12. Overused AI words` / `### 13. Inflated significance`
     (`blader-humanizer/SKILL.md:198,207`) ↔ `## 3. 空泛大词` (`patterns.md:65`) and `SKILL.md:67`.
   - blader `### 21. Curly quotation marks` (`blader-humanizer/SKILL.md:304`) ↔ `SKILL.md:94`.
   - blader `### 22. Chatbot residue` / `### 11. Passive voice and missing subjects`
     (`blader-humanizer/SKILL.md:316,186`) ↔ `SKILL.md:80` (「少写无主句串联」).
   This is a **7-of-25 conceptual overlap with zero verbatim overlap**, which is what adaptation looks
   like, not translation.
4. **`CHANGELOG.md:14` and the 1.0.0 entry.** The 1.0.0 release (`CHANGELOG.md:77-93`) presents the
   skill as newly authored rather than ported, and no CHANGELOG entry mentions blader — so the
   attribution was added to the READMEs only (`README.md:154`), never to the license or the changelog.

**Evidence AGAINST strong derivation (i.e. against copy-paste):**

1. **Rule counts do not match.** blader v2.9.x had **33** numbered patterns (confirmed in
   `blader-humanizer/README.md:179-185`: 「33 patterns total」 repeated six times) and blader v3.0.0
   has **25** (`blader-humanizer/README.md:77`: `## The 25 patterns`; headings
   `### 1.`–`### 25.` at `blader-humanizer/SKILL.md`). humanizer-zh has **13** patterns plus **8**
   Core Rules — neither 33 nor 25, and no shared numbering.
2. **Zero verbatim text overlap.** No English sentence from `blader-humanizer/SKILL.md` appears in
   `humanizer-zh`; no Chinese string from `humanizer-zh` appears in blader. blader's `AGENTS.md`
   instructs 「Patterns are numbered from 1 without gaps, strongest and most frequent first」 —
   humanizer-zh makes no such ordering claim (see §9).
3. **Different architecture.** blader groups patterns into five lettered sections
   (`## A. Staging instead of stating` … `## E. Leftovers from the chat and the draft`,
   `blader-humanizer/SKILL.md:54,135,194,273,312`) and gives each pattern a `**Watch for:**` /
   `**Problem:**` / `**Before:**` / `**After:**` micro-schema
   (`blader-humanizer/SKILL.md:60-73`). humanizer-zh uses a flat numbered list with
   `常见问题：` / `处理方法：` / `修改前：` / `修改后：` — a different and distinct schema.
4. **The bulk of humanizer-zh is content blader cannot supply**: translationese (翻译腔), Chinese
   punctuation and full-width typography, Chinese date/terminology normalization, 官样文章腔
   (Chinese bureaucratic style), article-level Chinese rewrite paths, the 17-author Chinese corpus,
   and the 8 Chinese voice profiles. None of that exists in blader's English skill.
5. **provenance of the *idea* is Wikipedia, not blader.** blader's own frontmatter says
   「Based on Wikipedia's "Signs of AI writing."」 (`blader-humanizer/SKILL.md:7`). humanizer-zh never
   cites Wikipedia, so it is one step removed from the common root.

**Rule-count comparison table (as requested):**

| Repo | Numbered patterns | Grouping | Origin of counting |
| --- | --- | --- | --- |
| blader/humanizer v2.9.x | **33** | 5 lettered sections A-E | `blader-humanizer/README.md:179-185` (「33 patterns total」) |
| blader/humanizer v3.0.0 (current clone) | **25** | 5 lettered sections A-E | `blader-humanizer/README.md:77`, `blader-humanizer/SKILL.md` headings |
| **ai-zixun/humanizer-zh** | **13** (+ 8 Core Rules, + 6 §10 sub-paths) | flat, `## 1.`–`## 13.` | `references/patterns.md:19-427` |
| holygeek00/humanizer-zh-cn | **33** | flat, `### 1.`–`### 33.` | `humanizer-zh-cn/SKILL.md:48-351`, `humanizer-zh-cn/LOCALIZATION.md:15,39` |
| op7418/Humanizer-zh | **24** | 5 themed sections | `op7418-humanizer-zh/SKILL.md:82-404` |

**Critical contrast — how a *declared* fork handles this.** `humanizer-zh-cn` states derivation
openly and precisely: `humanizer-zh-cn/SKILL.md:15` 「此版本基于 blader 的 [Humanizer]…并结合中文语境重新编写规则和例句」;
`humanizer-zh-cn/SKILL.md:386` names Siqi Chen and the MIT licence;
`humanizer-zh-cn/LOCALIZATION.md:5-8` records upstream repo, upstream author, the exact baseline
commit `523374dee72d67c7b2b5f858ea0094ffda49c3ac` (upstream 2.9.1), and
「许可证：MIT；原始 `LICENSE` 和版权声明未经改写」; `humanizer-zh-cn/README.md:224`
「原始版权声明 `Copyright (c) 2025 Siqi Chen` 保持不变。任何复制或重要部分的再分发都应附带该版权与许可声明。」
`humanizer-zh` does none of this: it has no upstream commit reference, no chronology, and no
retained notice.

### 13.2 The LICENSE problem

`LICENSE:1-3` is a bare MIT text reading `MIT License` / `Copyright (c) 2026 aizixun`. blader's
`LICENSE:1-3` reads `MIT License` / `Copyright (c) 2025 Siqi Chen`. **Siqi Chen's 2025 notice does not
appear anywhere in humanizer-zh** (verified by grep across the whole tree: no `Siqi`, no `Chen`
outside unrelated words, no second copyright line).

MIT's operative condition (`LICENSE:9-13`) is: 「The above copyright notice and this permission notice
shall be included in all copies or substantial portions of the Software.」

Assessment, stated carefully:

- **If no blader text is copied** (which the evidence strongly supports — zero verbatim overlap, 13
  vs 33/25 patterns, wholly different schema and mostly different subject matter), then
  humanizer-zh is an independent work that shares a *concept* and a *package shape*. Copyright does
  not protect ideas, methods of operation, or functional formats, so MIT's notice-retention clause is
  not triggered. **On that reading there is no compliance problem**, and the `## 致谢` section in
  the README is a voluntary scholarly courtesy rather than a licence obligation.
- **The residual risk** is that the derivation is *described* only as 「受到…的启发」 (inspired by)
  and 「在这个思路上扩展」 (extends the idea) while the file/package layout, the
  `.claude-plugin/plugin.json` + `agents/openai.yaml` + `references/` arrangement, and at least seven
  conceptual pattern mappings are demonstrably borrowed from blader. If any uncredited verbatim
  blader phrasing exists that this inventory did not detect, or if the shared structure is later
  judged a protectable "substantial portion", then the missing `Copyright (c) 2025 Siqi Chen` line
  becomes a real MIT breach. **I found no such verbatim overlap**, so this is a low-probability,
  high-impact risk, not a demonstrated violation.
- **Recommendation for the new project's own compliance posture: do not rely on humanizer-zh's
  licence hygiene.** When integrating, (a) carry `Copyright (c) 2026 aizixun` verbatim, (b) *also*
  carry `Copyright (c) 2025 Siqi Chen` for the conceptual/structural lineage, and (c) cite
  `blader/humanizer` explicitly in the new project's NOTICE, matching what `humanizer-zh-cn` does.
  This is cheap, honest, and removes the risk entirely.
- **One more licence note:** `README.md:158-160` and `README.en.md:153-155` state only
  「本仓库采用 [MIT License](./LICENSE)」. The repository never states which upstream licence its
  content is *compatible* with, and never claims MIT inheritance. That is internally consistent with
  a "no copying" position — but it means a downstream integrator gets no licence-compatibility
  assurance from the repo itself.

### 13.3 Are the nine (→ eight) voice profiles and the corpus original to this repo?

**Voice profiles: YES, original to this repo, with high confidence (≈97%).**

- They were introduced in a single commit with an explicit changelog entry:
  `0ba21f7 2026-05-18 [feat] skill - add opt-in author voice adoption for deep rewrites (#8)`,
  documented at `CHANGELOG.md:8-28` (`## [1.3.0] - 2026-05-18` / 「Add optional author-voice adoption
  for deep rewrites.」).
- The 8 authors are Chinese-language writers and speakers (李笑来, 鹤老师, 罗振宇, 吴军, 李尚龙, 何帆,
  冯唐, 刘子超). blader/humanizer is an English skill with no author-voice system of any kind —
  `blader-humanizer/SKILL.md` contains a single `### Voice` subsection
  (`blader-humanizer/SKILL.md:40-44`) that tells the rewriter to *match the user's own sample*, not
  to impersonate a named author. There is no plausible upstream source for these profiles.
- The profiles are in English-language instruction form (≈1:7 Chinese:Latin char ratio) but their
  content — the Chinese example strings, the Chinese persona details, and the cross-author
  disambiguation notes in `wujun.md:39,72` — is specific to this project's Chinese-writing context.
- **Do not copy the *content*, though: these are profiles of real living people, and impersonating
  named real authors raises publicity/personality-rights and misattribution concerns** independent of
  the MIT licence. See §16.

**Corpus: PARTLY original. Confidence high that the compilation is original; the referenced works are
not.**

- The compilation — the four tiers, the 17 entries, the `适用/学什么/不要学` annotation schema, the
  2022 cut-off rule (`corpus.md:8`), and the genre→reference mapping in `corpus.md:159-168` — is
  original editorial work by this repo, added in `656bc29 2026-03-15 [feat] skill - add corpus guides
  and structure review (#1)` and documented at `CHANGELOG.md:90-91`.
- The corpus contains **no excerpts and no substantial text** from the referenced authors. Every
  entry links out to external books, blogs, and articles (douban.com, ruanyifeng.com, xiaolai.co,
  news.sina.com.cn, people.com.cn, iq.com, 21jingji.com, cnbeta.com.tw, blog.sina.com.cn,
  guoyu.mirror.xyz). On the evidence, it is a bibliography/annotation list, not a derived corpus —
  so copyright exposure from the corpus itself is minimal.
- Caveat: the 17 named authors are real, identifiable writers and public figures, and the `不要学`
  annotations are evaluative judgments about them. That is opinion, not infringement, but it is
  reputationally loaded content and should not be republished verbatim by a downstream project.

## 14. Overlap and duplication signals

Comparison targets: `blader/humanizer` (English origin), `holygeek00/humanizer-zh-cn` (declared
33-pattern Simplified-Chinese localisation), `op7418/Humanizer-zh` (declared translation of blader,
per `op7418-humanizer-zh/SKILL.md:15`: `source: 翻译自 blader/humanizer，参考 hardikpandya/stop-slop`).

### 14.1 Finding 1 — ZERO verbatim Chinese rule-content overlap with the two Chinese siblings (cross-repo-CONFIRMED)

This is the strongest and most actionable result. I searched the shared rule-name vocabulary of all
three Chinese repos:

| Probe (verbatim) | humanizer-zh | humanizer-zh-cn | op7418 |
| --- | --- | --- | --- |
| `机械对照句` | `patterns.md:5,19` | absent | absent |
| `翻译腔连接词` | `patterns.md:6,38` | absent | absent |
| `空泛大词` | `patterns.md:7,65` | absent | absent |
| `口号化收束` | `patterns.md:8,91` | absent | absent |
| `列表和排比成瘾` | `patterns.md:9,113` | absent | absent |
| `营销稿与官样文章腔` | `patterns.md:11,145` | absent | absent |
| `开头、主体、结尾脱节` | `patterns.md:13,189` | absent | absent |
| `编号枚举撑全文` | `patterns.md:15,373` | absent | absent |
| `预告式收束` | `patterns.md:16,399` | absent | absent |
| `抽象转义与重锤句` | `patterns.md:17,427` | absent | absent |
| `文章级重写模板` | `patterns.md:14,219` | absent | absent |

Neither sibling shares a single one of the 13 pattern names. The three Chinese repos have
**independently invented their own rule taxonomies** and are not localisations of each other. This is
cross-repo-confirmed by direct full-text search over both other repos.

### 14.2 Finding 2 — the two Chinese siblings ARE both blader derivatives (cross-repo-CONFIRMED)

- `humanizer-zh-cn` says so explicitly and repeatedly: `SKILL.md:15`, `SKILL.md:386`,
  `LOCALIZATION.md:5-10`, `README.md:169-179`, `AGENTS.md:3,7,9`. It retains the 33-pattern
  numbering and says so as a maintenance invariant (`LOCALIZATION.md:15,39`).
- `op7418` declares it in frontmatter metadata: `op7418-humanizer-zh/SKILL.md:15`
  `source: 翻译自 blader/humanizer，参考 hardikpandya/stop-slop`; its description at
  `SKILL.md:5` says 「基于维基百科的"AI 写作特征"综合指南」, matching blader's own upstream
  (`blader-humanizer/SKILL.md:7`).
- **By contrast, humanizer-zh declares blader only as an *inspiration* at `README.md:154` /
  `README.en.md:151` and never claims translation or fork status.** So the three Chinese repos sit at
  three different points on the derivation spectrum: declared translation (op7418), declared
  localisation-with-retained-notice (humanizer-zh-cn), declared inspiration-only (humanizer-zh).

### 14.3 Finding 3 — partial lexical overlap with the siblings (cross-repo-CONFIRMED, but not evidence of copying)

Exact matching Chinese phrase strings that appear in more than one repo:

| Phrase (verbatim) | humanizer-zh | humanizer-zh-cn | op7418 | Note |
| --- | --- | --- | --- | --- |
| `值得注意的是` | `patterns.md:46` (watch phrase), `SKILL.md:74` (banned connector chain) | `SKILL.md:267` (`"值得注意的是，数据显示"改为"数据显示"`) | `SKILL.md:378` (`"值得注意的是数据显示" → "数据显示"`) | **The single strongest three-way match.** humanizer-zh-cn and op7418 use near-identical rewrite exemplars. humanizer-zh uses it as a watch phrase only. |
| `开启新篇章` | `patterns.md:74`, `SKILL.md:67` | `SKILL.md:50` (`开启新篇章` in a 留意 list) | absent | Two-way |
| `赋能` | `patterns.md:72`, `SKILL.md:67` | `SKILL.md:29,36,40,70,74,110,114` | absent | Two-way, highest-frequency shared term |
| `归根结底` | `patterns.md:434` | `SKILL.md:295,299` | absent | Two-way |
| `真正重要的是` | `patterns.md:433` | `SKILL.md:295` | absent | Two-way |
| `不是……而是……` | `patterns.md:23` | `SKILL.md:130` (`不是……而是……`) | absent | Two-way |
| `首先` / `其次` / `最后` chain | `SKILL.md:74`, `patterns.md:224,377` | `SKILL.md:130` region (先否后肯 etc.) | absent | Two-way |
| `持续深化` | `patterns.md:149` | absent | absent | One-way |

**Interpretation:** the overlap is confined to *generic Chinese AI-ese vocabulary* — the words any
Chinese editor would flag (`赋能`, `值得注意的是`, `归根结底`, `开启新篇章`). It is **not** evidence of
copying between these repos. It IS strong evidence that these strings are the correct shared seed for
a canonical Chinese "watched phrase" registry in the new project, with cross-repo confirmation from
2-3 independent sources.

### 14.4 Finding 4 — one substantial *behavioral* duplicate inside this repo itself (cross-repo-UNCONFIRMED, in-repo-CONFIRMED)

`humanizer-zh` is the only repo in the set that ships **both** a per-author voice-impersonation system
and a per-author craft-reference corpus, for **partly overlapping author sets**. 冯唐, 李笑来 and
罗振宇 appear in both `references/voices/` and `references/corpus.md`, with *contradictory* guidance:

- `corpus.md:16` forbids borrowing 人设、口癖和立场, and `corpus.md:115` says of 冯唐
  「不要学：油滑、自恋、故意吓人一跳」.
- `voices/fengtang.md:3` enables exactly that: 「适用：个人随笔、管理心法、文白杂糅评论」, and
  `SKILL.md:47` makes **作者档案优先** when the two conflict.
- `corpus.md:133` says of 罗振宇 「不要学：硬造概念，排比过密」; `voices/luozhenyu.md:22` requires
  「Every argument must be anchored in a story」 and `voices/luozhenyu.md:56` makes
  「CROSS-DOMAIN ANALOGIES are mandatory」.

No other repo in the set has this dual-system tension. **This is internal to humanizer-zh and
unconfirmed elsewhere.** It matters for integration: the new project must decide whether its unified
Voice Profile interface carries *one* author model with a mode flag (`borrow-craft` vs
`impersonate`), or two separate registries.

### 14.5 Finding 5 — the "33 numbered patterns" claim in the task brief is stale (cross-repo-CONFIRMED)

The brief says blader/humanizer has "33 numbered patterns". That is true of blader **v2.9.x** and of
`humanizer-zh-cn`, but **not** of the current blader clone in this workspace: v3.0.0 has **25**
patterns (`blader-humanizer/README.md:77`, `metadata.version: "3.0.0"` at
`blader-humanizer/SKILL.md:10`, `blader-humanizer/.claude-plugin/plugin.json` `"version": "3.0.0"`),
and `blader-humanizer/README.md:179-185` records the transition out of the 33-pattern era. Any
cross-repo comparison in the new project must pin the blader version explicitly.
`humanizer-zh-cn` pinned `523374dee72d67c7b2b5f858ea0094ffda49c3ac` (upstream 2.9.1) for exactly
this reason (`LOCALIZATION.md:7`).

### 14.6 Unconfirmed / negative findings

- **No cross-repo verbatim overlap at the sentence level** between humanizer-zh and blader was found.
  Unconfirmed in the sense that I compared rule taxonomy and a targeted probe list, not every one of
  the ~70 watched phrases against all 25 blader patterns. A full string-level diff is a recommended
  follow-up before any copying decision.
- **No overlap check was performed** against `lynote-ai/dsh-humanizer`, `judetelan/ai-humanizer`,
  `lynote-ai/humanize-text`, or `hardikpandya/stop-slop` — those four were not probed in this pass
  (out of scope for this report). No positive or negative finding is claimed for them.

## 15. Integration recommendation

**Overall: adopt this repo as the primary source for the new project's Chinese rule set and as the
sole source for the Voice Profile interface design. Do not adopt its execution model.**

Recommended posture, by layer:

1. **Chinese rule registry (adopt, kind B).** Take all 13 `patterns.md` patterns **verbatim by name**
   as the canonical Chinese pattern ids, plus the 8 `SKILL.md` Core Rules as a separate always-on
   tier. Preserve the original Chinese names exactly — the new project's registry must key on
   `机械对照句`, `翻译腔连接词`, `空泛大词`, `段落结尾的口号化收束`, `列表和排比成瘾`, `冒号、破折号和引号`,
   `营销稿与官样文章腔`, `过度谨慎或过度确定`, `开头、主体、结尾脱节`, `文章级重写模板`, `编号枚举撑全文`,
   `章末段末的预告式收束`, `抽象转义与重锤句`. Do **not** renumber; keep the 1-13 indices as
   `upstream_index` so the new registry can be traced back.
2. **Voice Profile system (adopt as the design template, kind C).** This is the repo's unique and
   most valuable contribution. The interface should be:
   `{display_name, pinyin, locale, applicability, activation, neutrality_preamble,
   core_rule_overrides[], persona_prose, worldview_pills[], sentence_templates[8],
   voice_rules[12], anti_patterns[], taboo_phrases[], taboo_behaviors[], stylometric_bounds{},
   example_fragments[], source, upstream, license}`.
   Every one of the 8 profiles maps onto this shape with a deterministic parser plus one
   LLM-assisted field-normalization pass. The `core_rule_overrides` field is the key insight: a voice
   profile is not just additive style, it is a *scoped exception set* against the default rule
   registry (`SKILL.md:47`, `index.md:30`).
3. **Voice governance policy (adopt, kind C).** Port VA1-VA4 (`SKILL.md:52-55`) and the index's
   selection advice (`index.md:28-32`) as invariants: off by default; ask once per session at most;
   one voice at a time; never emit the persona preamble; never leak voice anti-patterns into neutral
   mode; author profile wins over default rules for the duration of the turn.
4. **Technique library (adopt as opt-in methodology, kind D — explicitly OUT of the default path).**
   `patterns.md` §10's six article-level rewrite paths, and the whole conditional-loading strategy
   (`SKILL.md:123-143`), are strategy, not detection. Expose them behind an explicit
   "deep restructure" flag; never let them run by default.
5. **Corpus (adopt as metadata, kind C-adjacent / E for the linked works).** The
   `corpus-quickpick.md` two tables are trivially parseable and give the new project a ready
   genre→reference router. The external works themselves are kind E (do not copy). Keep the
   `学什么 / 不要学` annotation pairs — they encode exactly the "borrow craft, not persona" distinction
   the unified voice interface needs.
6. **Chinese-specific typography and terminology rules (adopt with priority, kind B).** The quote-style
   precedence chain, the `——` ban, colon-density rule, half-width-space rules for mixed
   Chinese/English, and the `PR`→`代码审查` / date-format normalization rules have **no counterpart in
   any other upstream in this set**. They are the highest-value, lowest-risk content here.
7. **Do not adopt:** the `## Workflow` conditional-reference-loading narrative as executable logic
   (kind D); `CLAUDE.md` and the packaging files (kind E); the release workflow (kind E).
8. **Flag for legal review before shipping voices:** 李笑来's profile instructs the model to
   「invent a plausible specific one」 when a real number is unavailable (`lixiaolai.md:72`). This
   directly contradicts the no-invented-facts safety posture of every other repo in the set
   (cf. `humanizer-zh-cn/SKILL.md:23`) and contradicts `SKILL.md:24` inside this very repo. **If
   this profile is imported, its `NUMBERS must be precise` rule must be neutralized or wrapped in a
   hard fact-safety guard.**

## 16. Gaps, risks, and limitations

**Factual corrections to the working assumption**

1. **EIGHT voice profiles, not nine** (see §1). Five independent in-repo statements say 8, and the
   directory contains exactly 8. Any downstream plan assuming 9 profiles is wrong.
2. **blader/humanizer in this workspace is v3.0.0 with 25 patterns, not 33.** The 33-pattern figure
   applies to blader v2.9.x and to `humanizer-zh-cn` (see §14.5). Pin versions in all
   cross-repo comparisons.

**Gaps in the upstream itself**

3. **No detector, no validator, no tests, no CI beyond release tagging.** Integration must supply all
   of it. The repo's rules are unenforced prose; nothing prevents a rewrite from violating them.
4. **No severity, priority, or scoring.** `patterns.md` presents 13 patterns as a flat unordered set
   and gives no guidance on which findings should block a rewrite. `## Output` limits explanation to
   「3 到 6 个最明显的问题」 (`SKILL.md:150`), so "most obvious" is left to model judgment. The new
   project will have to invent severity, and that invention cannot be sourced from this repo.
5. **Core Rules duplicate patterns.md semantically without cross-referencing.** §1≈CR1, §2≈CR1,
   §3≈CR2, §5≈CR3, §6≈CR6, §12≈CR4, §7≈CR2/CR7. Only two cross-references exist in the entire tree
   (`patterns.md:135` → SKILL.md Rule 6; patterns §11 → §5 at `patterns.md:381`; §12 → §4 at
   `patterns.md:410`). Deduplication is an open task.
6. **No 成语/四字词 rule.** Chinese-specific and conspicuously absent given the repo's self-declared
   scope, while `humanizer-zh-cn` §26 covers 「四字词和成语连用」 (`humanizer-zh-cn/SKILL.md:285`).
7. **No web-novel (网文) coverage**, despite the repo's positioning on Chinese long-form prose.
8. **The voice-profile field set is ad hoc** (§6.5). Only the container is uniform; `dimension`
   names, quantified bounds, and taboo encodings vary per file. Normalization requires an LLM pass —
   it is not a pure parser problem, and any "100% automated import" claim would be false.
9. **Three of eight profiles omit the specific Core Rule they override** (`hefan.md:8`,
   `lishanglong.md:8`, `luozhenyu.md:8`), so `core_rule_overrides` is incomplete for them.
10. **Heading spelling is inconsistent** (`## Voice rules` in `lixiaolai.md:37`; `Anti-patterns` vs
    `Anti-Patterns`; `helaoshi.md:67` anonymizes the author in the heading). A regex written against
    the majority spelling silently drops data from 3 of 8 files.
11. **The corpus and the voice set overlap and give contradictory guidance for the same authors**
    (§14.4) — 冯唐, 李笑来 and 罗振宇 are both "don't copy this persona" and "become this persona"
    depending on which file you read.
12. **The corpus's `2022 年以前` sourcing rule (`corpus.md:8`) is unverifiable from the repo** — the
    entries cite live external URLs with no fetch dates, no archived snapshots, and no excerpt, so the
    corpus cannot be validated or frozen. Link rot is a certainty over time.

**Integration risks**

13. **Fact-integrity hazard in `lixiaolai.md:72`** — instructs inventing plausible specific numbers
    when real ones are unavailable. This is the single highest-risk rule in the repository and
    **must** be blocked or rewritten before the profile enters a production path. It contradicts
    `SKILL.md:24` within the same repo and `humanizer-zh-cn/SKILL.md:23` across repos.
14. **Real-person impersonation.** All 8 profiles instruct the model to write *as a named living
    author*: `fengtang.md:12` 「Your output must read like an authentic passage from his work」,
    `hefan.md:12`, `liuzichao.md:12`, `lixiaolai.md:12`, `lishanglong.md:12`, `luozhenyu.md:12`,
    `wujun.md:12` all follow this formula. The MIT licence covers the *text of the profile*; it does
    not address publicity rights, personality rights, false endorsement, or attribution harm. This is
    outside the licence analysis entirely and needs a product/legal decision, not a technical one.
    The repo partly guards against leakage (`SKILL.md:54`: never print the persona preamble) but does
    not guard against misattribution.
15. **Bulk content scraped into prompt context.** `SKILL.md:46` tells the agent to overlay 「人格、句法
    模板、节奏规则、反模式」 on top of Core Rules; with 8 profiles at 6.5-10.5 KB each plus
    `patterns.md` at 16.9 KB plus `corpus.md` at 8.2 KB, a deep-review turn can pull ~30 KB of
    instruction into context. Budget for it or split it.
16. **Licence hygiene (see §13.2).** The repository names only `Copyright (c) 2026 aizixun` and drops
    Siqi Chen's 2025 notice while acknowledging blader as an inspiration. My assessment is that this
    is **not a demonstrated MIT violation** (no verbatim overlap found; ideas and package layouts are
    not protected), but it is weak hygiene. The new project should carry both notices and cite blader
    in its NOTICE regardless — that costs nothing and eliminates the risk.
17. **No machine-readable structure anywhere.** Every artifact that must be imported —
    `patterns.md`, the 8 voice profiles, the corpus index — is prose plus Markdown tables. The import
    is a real engineering task with a real per-file review cost, not a copy operation.

**Limitations of this inventory**

18. This is a **read-only static analysis at commit `f75f1ac973`**; no behaviour was executed and no
    rewrite output was evaluated. Claims about what the skill *does* are claims about what its text
    *instructs*, which is all a Markdown skill can offer.
19. The cross-repo comparison in §14 is **taxonomy-level plus targeted-probe-level**, not an
    exhaustive string diff. A full n-gram diff of humanizer-zh against blader v3.0.0, blader v2.9.1,
    `humanizer-zh-cn` and `op7418` is the recommended follow-up before any copy decision.
20. Only three of the eight upstreams in the brief's context list were compared (blader,
    humanizer-zh-cn, op7418). `dsh-humanizer`, `ai-humanizer`, `humanize-text` and `stop-slop` were
    not probed in this pass.
