---
id: zh-talk-0008
category: chinese-chat
language: zh
mode: chat
provenance: model-generated
model: DeepSeek (deepseek-flash) via DSH agent
source: original, generated for this benchmark
licence: original to this project, MIT
notes: >
  Control group. Generated to order for this benchmark, deliberately written to
  behave like a person. The user asked three things and got answers to two; the
  point about the team never having used Postgres is silently dropped, which is
  what a human does and what an assistant essentially never does. Short, no
  opener, no closer, no offer.
user_turn: |
  你觉得用 Postgres 还是 MySQL？我们的数据量大概几千万行，而且要做全文搜索，另外团队没人用过 Postgres。
advice_permission: unknown
---

几千万行两个都扛得住。全文搜索 Postgres 更省事，内置的够用，不用再搭一套 ES。
