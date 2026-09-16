---
id: zh-prose-0007
category: chinese-prose
language: zh
mode: prose
provenance: human-written
source: .upstream-cache/humanizer-zh/README.md lines 137-152, commit f75f1ac9735c4f10da1bba0148e0ea7228c5c3b3
licence: MIT, Copyright (c) 2026 aizixun, preserved at licenses/MIT-humanizer-zh
notes: >
  Vendored verbatim from the humanizer-zh README. Two consecutive documentation
  sections, so it is list-dense and contains inline code and semicolons. This is
  the hardest false-positive control in the Chinese set: a structural detector
  tuned to flag bullet lists and colon-led expansion has to leave a real README
  alone.
---

## 运行时布局

- `SKILL.md` 是运行时入口，包含触发描述、工作流和输出约定
- `agents/openai.yaml` 只提供 Codex 的展示元数据，不影响 Claude Code 或 OpenClaw
- `VERSION` 是仓库唯一版本源
- `CHANGELOG.md` 记录已发布版本的变化
- `references/corpus-quickpick.md` 是运行时速查表，先帮模型缩小参照范围
- `references/patterns.md` 是按需加载的深度参考，不会在每次触发时都占用上下文
- `references/corpus.md` 是按文体选参照的语料索引，不是固定模仿模板
- `references/voices/` 收录 8 位中文作者的声音档案，默认不加载；只有当用户在深度改写时主动选择某位作者后，才会加载对应文件

## 设计约束

- frontmatter 只依赖通用字段 `name` 和 `description`，避免把代理私有配置写进运行入口
- 技能名使用小写连字符 `humanizer-zh`，便于兼容多代理的命名与路径约定
- 所有资源都通过相对路径组织，整个目录可以被直接复制或 symlink 到任意 skills 根目录
