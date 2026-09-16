---
id: zh-prose-0006
category: chinese-prose
language: zh
mode: prose
provenance: human-written
source: .upstream-cache/humanizer-zh/SKILL.md lines 28-56, commit f75f1ac9735c4f10da1bba0148e0ea7228c5c3b3
licence: MIT, Copyright (c) 2026 aizixun, preserved at licenses/MIT-humanizer-zh
notes: >
  Vendored verbatim from the humanizer-zh skill file. Longer and more
  argumentative than the previous sample, with conditional clauses and a
  genuinely mixed sentence length. A useful contrast: it contains the word 破折号
  and the punctuation mark itself as quoted examples, which a naive lexical
  detector will flag even though the text is discussing them rather than using
  them. That is the false positive the suppression layer's meta-discussion
  exemption is meant to handle.
---

## Voice Adoption（可选）

默认情况下，humanizer-zh 保持中立的去 AI 味润色，不套任何作者的腔调，按 `## Core Rules` 走。

只有在以下条件同时满足时，机会性地（每次会话最多一次）向用户提一句「要不要顺便套上某位中文作者的声音？」：

- 本次会话还没询问过 voice adoption。
- 当前任务是深度改写、长篇润色、重写或风格化创作（不是公告、说明书或短句修订）。
- 用户没有在请求里明确说「保持中性」「不要改风格」之类的限制。

询问时，先读 [references/voices/index.md](references/voices/index.md) 拿到 8 位作者的一句话简介，再把列表贴给用户：李笑来、鹤老师、罗振宇、吴军、李尚龙、何帆、冯唐、刘子超。

用户拒绝或忽略：本会话剩余轮次不再追问，全部走中立路径。
用户主动指名某位作者（例如「用李笑来的口气重写」），直接跳过询问步骤，进入加载流程。

进入加载流程后：

1. 读取 [references/voices/&lt;author&gt;.md](references/voices/) 对应文件。
2. 在改写时，把该文件的人格、句法模板、节奏规则、反模式叠加在 `## Core Rules` 之上。
3. 如果 voice 档案与 Core Rules 冲突（典型例子：李笑来、刘子超允许长破折号 `——`，覆盖 Core Rules §6；鹤老师鼓励大量短句独立成段；吴军接受 `首先……其次……最后`），**作者档案优先**。
4. 用户后续说「换成 X」时，丢掉当前 voice 档案，加载新的；说「不要作者声音了」时，回到中立路径。

反模式：

- 不要在用户没选时擅自模仿任何作者的口吻。
- 不要把多位作者的声音混在同一篇文章里。
- 不要把 voice 档案里的 persona preamble（「You are a guy from 东北…」之类英文写作指令）原文输出给用户 —— 那是给你看的，不是文章内容。
- 不要把作者档案的反模式当成 humanizer-zh 的默认规则；只在该声音生效的轮次中应用。
