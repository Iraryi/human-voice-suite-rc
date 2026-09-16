---
id: zh-prose-0005
category: chinese-prose
language: zh
mode: prose
provenance: human-written
source: .upstream-cache/humanizer-zh/SKILL.md lines 8-26, commit f75f1ac9735c4f10da1bba0148e0ea7228c5c3b3
licence: MIT, Copyright (c) 2026 aizixun, preserved at licenses/MIT-humanizer-zh
notes: >
  Vendored verbatim from the humanizer-zh skill file. Written by a person, and it
  is documentation, so it carries a heading and a numbered list. That makes it a
  useful control: the structural detector must not read legitimate instructional
  formatting as AI decoration. The prose itself is plain, parallel and short,
  which is what careful Chinese technical writing actually looks like.
---

## Overview

把中文文本从「像模型拼出来的稿子」改成「像中文母语者真的写出来的文章」。
优先处理翻译腔、结构腔、排版腔和判断腔，同时保留原文事实、立场和信息密度。

## Workflow

1. 先判断文本类型。
   博客、专栏、书稿、评论、产品分析可以更有节奏和作者判断；公告、说明文、技术文档则优先保留准确和克制。
2. 先看文章主线。
   判断第一段在立什么题，主体每段各自承担什么功能，最后一段是不是在收同一件事。
3. 先找最显眼的 AI 痕迹。
   重点看英文句法直译、机械对照句、空泛结论、列表堆砌、连环冒号、破折号、过度工整的段落节奏。
4. 再决定改写力度。
   轻度润色只清理措辞和标点；深度改写要重排句子顺序、合并弱句、补足主语或因果关系。
5. 保留作者原意。
   不擅自补充事实，不把谨慎判断写成绝对论断，不把普通结论硬拔高成时代宣言。
6. 做最后一遍朗读检查。
   读起来要像中文原生写作，不像英文思路换成中文词汇。
