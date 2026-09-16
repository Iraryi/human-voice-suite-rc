---
id: zh-tech-0003
category: technical-writing
language: zh
mode: technical
provenance: model-generated
model: DeepSeek (deepseek-flash) via DSH agent
source: original, generated for this benchmark
licence: original to this project, MIT
notes: >
  Generated to order for this benchmark as the counter-case: the same protected
  content as zh-tech-0002, wrapped in tells. Three-part enumeration, a staged
  opener, a slogan close, and 值得注意的是. The detection question is whether the
  rules fire on the prose while the paths, the hash and the version survive a
  rewrite untouched. One mistake here costs more than a bad score.
---

## 架构说明

随着系统的不断演进，我们的架构也在持续优化。值得注意的是，本次重构不仅提升了性能，更是为未来的扩展奠定了坚实基础。

核心模块位于 `src/detector/` 目录，其中 `scan.ts` 负责统一扫描，`suppression.ts` 实现了抑制策略。各适配器位于 `src/upstream/adapters/`。上游 `lynote-ai/dsh-humanizer` 固定在 9314b95d0b1ba663331f47f0a8ea006b6dc5f509，许可证在 `licenses/BSD-3-Clause-dsh-humanizer`。

从性能维度来看，扫描 1000 字的时间从 12ms 降低到 4ms；从可维护性维度来看，重复代码减少了约 30%；从扩展性维度来看，新增一个上游只需添加一个目录。

总之，这是一次意义深远的升级。让我们共同期待 v0.2.0 的到来。
