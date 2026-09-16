---
id: zh-tech-0002
category: technical-writing
language: zh
mode: technical
provenance: model-generated
model: DeepSeek (deepseek-flash) via DSH agent
source: original, generated for this benchmark
licence: original to this project, MIT
notes: >
  Generated to order for this benchmark as precise technical writing. Carries a
  commit hash, a version, an engine constraint, three file paths and two inline
  identifiers, and carries no tells at all. The pairing with zh-tech-0003 is the
  point: both must protect the same class of content, and only one of them should
  be flagged for anything.
---

## 构建与运行

克隆仓库后先安装依赖：

    npm install

构建产物输出到 `dist/`，入口为 `dist/index.js`。开发时可直接运行 `npm run upstream:extract`，该命令会读取 `.upstream-cache/` 下的克隆，并把解析结果写入 `src/upstream/adapters/<name>/rules.generated.json`。

当前版本为 0.1.0，Node 版本要求 >= 22.0.0。上游 `judetelan/ai-humanizer` 固定在提交 76bf08f13bee88044f448fd1b80604e33bb662b6，许可证文件保存在 `licenses/MIT-ai-humanizer`。

如果构建失败，先确认 `tsconfig.build.json` 中的 `rootDir` 指向 `src`，再检查 `node_modules` 是否完整。
