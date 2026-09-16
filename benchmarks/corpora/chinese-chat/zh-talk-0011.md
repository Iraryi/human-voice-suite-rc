---
id: zh-talk-0011
category: chinese-chat
language: zh
mode: chat
provenance: model-generated
model: DeepSeek (deepseek-flash) via DSH agent
source: original, written for this benchmark from the paired machine control
licence: original to this project, MIT
notes: >
  Positive sample for `chat.unsolicited_advice`, and one of three added after the
  paired machine control found that this rule, `chat.forced_positivity` and
  `chat.over_agreement` are the only behaviour rules that separate machine chat
  from human chat — and that the committed corpus demonstrated all three only in
  English. The user reports an incident; nobody asked what to do about it, and the
  reply hands over instructions anyway. Chat length, no list, no formatting, so
  the finding rests on the behaviour rather than on layout.
user_turn: |
  今天服务器又挂了一次，运维说是磁盘满了。
advice_permission: absent
expected:
  antiAIScore: 1.000 — measured: nothing lexical to find in one sentence
  behaviorScore: 0.813 — one smell, reduced but above the 0.75 flag
  expected_smells:
    - chat.unsolicited_advice   # 建议你
---

建议你把日志改成按天切，再给关键目录留三成余量，告警阈值也顺手补上。
