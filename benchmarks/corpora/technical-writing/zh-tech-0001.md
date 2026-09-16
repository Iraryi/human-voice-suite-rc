---
id: zh-tech-0001
category: technical-writing
language: zh
mode: technical
provenance: human-written
source: .upstream-cache/humanizer-zh/README.md lines 78-107, commit f75f1ac9735c4f10da1bba0148e0ea7228c5c3b3
licence: MIT, Copyright (c) 2026 aizixun, preserved at licenses/MIT-humanizer-zh
notes: >
  Vendored verbatim from the humanizer-zh README. Real installation and release
  documentation, so it is dense with the things a rewrite must not damage:
  package names, a scoped npm command, file paths, a version string, a git
  command sequence and a shell redirection. Nothing here is prose to improve.
  This sample exists to catch a rewrite that "tidies" a command.
---

## 安装

通过 [skills.sh](https://www.skills.sh) 生态的 `skills` CLI 一键安装：

```bash
# 项目技能：随项目仓库一起提交，团队共享
npx skills add ai-zixun/humanizer-zh

# 个人技能：在你所有项目里可用
npx skills add ai-zixun/humanizer-zh -g
```

CLI 会自动检测本机的 Codex/Claude Code/OpenClaw 等代理，并把技能装到对应的 skills 目录。也可以用 `-a` 指定只装到某些代理，例如 `npx skills add ai-zixun/humanizer-zh -a claude-code`。详细选项见 [skills CLI 文档](https://github.com/vercel-labs/skills#readme)。

## 版本管理

- 仓库使用 Semantic Versioning。
- 当前版本号只放在 [VERSION](./VERSION)。
- 版本变更记录放在 [CHANGELOG.md](./CHANGELOG.md)。
- 发布新版本时，更新 `VERSION` 与 `CHANGELOG.md` 并推到 `main`；`.github/workflows/release.yml` 会自动打 `v<version>` tag 并生成 GitHub Release。

示例：

```bash
printf '1.1.1\n' > VERSION
# 在 CHANGELOG.md 顶部追加 [1.1.1] 条目
git add VERSION CHANGELOG.md
git commit -m "[release] 1.1.1"
git push origin main
```
