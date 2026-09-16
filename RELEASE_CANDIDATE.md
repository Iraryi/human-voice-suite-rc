# 发布候选报告

<!-- 供唯一人工闸门阅读。全部结论均有实测依据；方法与原始数据见文中链接的英文技术文档。 -->

发布候选已构建、已推送、全部门禁通过。**最终闸门复核发现并修复了一个真实的计分可信度缺陷**：两条规则以「继承」身份留在 Class A，其中一条的 gate 从未接通。两条已降级、分数已重算、RC 已重建。修复后**不存在阻止公开的问题**。

## 1. 仓库状态

### 开发仓库

| | |
| --- | --- |
| 仓库 | `Iraryi/human-voice-suite`，**private**，未改变 |
| HEAD | 闸门复核提交，即本报告所在的提交（`git log -1`） |
| 工作区 | 干净，与 `origin/main` 同步 |
| CI | **green**，`22.x` 与 `24.x` 均通过 |
| 测试 | 895 passed / 6 skipped，42 个文件 |
| 标签 | `phase-1` 起，最新标签见 `git tag` |

### 发布候选仓库

| | |
| --- | --- |
| 仓库 | [`Iraryi/human-voice-suite-rc`](https://github.com/Iraryi/human-voice-suite-rc)，**private** |
| 历史 | **单个提交**，无标签、无其它 ref、无开发历史；`git log` 在 fresh clone 中只有一行 |
| 树 | 与开发仓库 HEAD 的跟踪文件一致，外加一份面向陌生读者的 README |
| CI | **green** |
| fresh clone 审计 | 安装、typecheck、build、测试、全部 `--check`、两次 provenance 探针、release audit 10/10，跑完后工作区零改动 |

RC 用 `git archive` 从审计过的 HEAD 导出，因此不含任何被 ignore 的文件、本地产物或来自其它仓库的对象。fresh clone 从远端拉到全新空目录，整套检查在**那里**重跑，不在源工作区。

仓库名用 `human-voice-suite-rc` 而非 `human-voice-suite-public-rc`，因为后者已被更早一次 RC 尝试占用；等价名是这种情况下的既定方案。

## 2. 迁移：三次接口变更各动了什么

数据来自存储的 run 文件，语料为已提交的 69 个样本、483 次测量。

### Phase A：`behaviorScore` 只接纳 Class A

| 分数 | 前 | 后 |
| --- | --- | --- |
| `antiAIScore` | 0.9528 | 0.9528 |
| `voiceScore` | 0.9075 | 0.9075 |
| `behaviorScore` | **0.9599** | **0.9808** |
| `preservationScore` | 1.0000 | 1.0000 |

48 个 `behaviorScore` 值变化，涉及 **16 个样本**，全部 `model-generated`。

### Phase B：advice permission 三态

| | |
| --- | --- |
| 任一分数发生变化的测量数 | **0 / 483** |
| 丢失的 finding | 9 条，全部是 `chat.unsolicited_advice` |
| 新增的 finding | 0 |
| 变为 abstain 的测量数 | 441 |

规则是 `shadow`，接通 gate 不应移动分数，实测一个测量值都没移动。移动的是**报告行为**。

### 闸门复核：两条规则退出计分

| 分数 | 前 | 后 |
| --- | --- | --- |
| `antiAIScore` | 0.9528 | 0.9528 |
| `voiceScore` | 0.9070 | 0.9070 |
| `behaviorScore` | **0.9808** | **0.9865** |
| `preservationScore` | 1.0000 | 1.0000 |

21 个 `behaviorScore` 值变化，涉及 **7 个样本**，全部 `model-generated`。分布变化：1.00 从 429 → 443，低于 0.80 从 18 → 11。

三次迁移累计 `behaviorScore` 从 0.9599 → 0.9808 → 0.9865，每一步都是「一条规则退出求和」，而不是阈值调整。

### advice permission 新语义下的统计

| Arm | `absent` + fired | `absent` + quiet | `granted` + suppressed | `unknown` + abstained |
| --- | --- | --- | --- | --- |
| `human` | 0 | 450 | 0 | 1550 |
| `plain` | 8 | 442 | 0 | 1550 |
| `default` | 4 | 446 | 0 | 1550 |
| `post` | 3 | 447 | 0 | 1550 |

abstain 不计入任何一方。把 permission 全部强制为 `absent` 可精确复现已发表的配对数字 `0 / 32 / 14 / 22`，这正是它算「迁移」而非「另一次实验」的依据。A v1 在 2,000 条微博真人话轮中授予 permission **0 次**、abstain **77.5%**：可以说的是 gate 让规则的沉默变得可读，不能说 gate 让规则变精确了。

### 最终 contributors 与不计分规则

| Class | 参与 `behaviorScore` | 规则 |
| --- | --- | --- |
| `discriminating` | **是** | `over_agreement`、`forced_positivity`、`mechanical_empathy` |
| `descriptive` | 否 | `auto_summary`、`over_completeness` |
| `shadow` | 否 | `unsolicited_advice`、`unsolicited_offer`、`unrequested_background` |
| `hypothesis` | 否 | solution-mode shift |
| `deprecated-candidate` | 否 | `mirrors_user`、`explains_obvious` |

每一条计分规则都能回答「你凭什么影响总分」。完整证据表（含被降级规则）见 [`benchmarks/external/GATE_REVIEW.md`](./benchmarks/external/GATE_REVIEW.md)。

## 3. 规则状态

| 规则 | Class | 动作 | 证据 |
| --- | --- | --- | --- |
| `chat.over_agreement` | A | 计分，冻结 | 2,000 条真人续写 0 次，机器 0.5–1.3% |
| `chat.forced_positivity` | A | 计分，冻结 | 2,000 条真人 0 次，机器 0.4–1.7% |
| `chat.mechanical_empathy` | A | 计分，**证据薄** | 任何语料的真人样本上 0 次；机器文本两语料合计 10 次（corpus 3、HelpSteer3 7）。§8 已审，四条漏报已归档，不做 v2 |
| `chat.auto_summary` | B | 只报告 | enrichment 3.02×，specificity 37.2%，逐条置信度低 |
| `chat.over_completeness` | B | 只报告 | ≥5 句回复中真人 75.8% vs 机器 75.5%，测的是形状 |
| `chat.unsolicited_advice` | C | shadow | gate 已接通；已发表的全部比率都是 gate 关闭状态下测的 |
| `chat.unsolicited_offer` | C | shadow，**晋升候选** | enrichment 8.88×，98.6% assistant-shaped，缺真人对照臂 |
| `chat.unrequested_background` | C | **shadow，闸门复核降级** | 它的「unrequested」半边读的是一个无人填充的 gate |
| `chat.mirrors_user` | D | 保留代码，撤回 claim | 配对对照中真阳性 4 对负例 2 |
| `chat.explains_obvious` | D | **deprecated-candidate，闸门复核降级** | 483 次测量 0 次触发；实现从不读取它名字所声称依赖的对话 |
| action-plan structure | C | shadow，冻结 | 盲测：24 个明显计划找到 23，24 条抱怨误报 0 |
| solution permission A v1 | C | shadow，冻结 | 高精度且带 abstain；未触发 v3 条件 |
| solution-mode shift | hypothesis | 不是 detector | `LOW` + `PLAN` 在 396 条回复中 0 次；无正预测 |

## 4. offer 规则复核

90 个 trigger 对 90 个匹配负例，匹配 response length、单/多轮、domain；rubric 在读到第一个样本前已哈希入 sheet；ID 不透明；key 在 180 条标注全部写完后才打开。

| 指标 | 值 |
| --- | --- |
| `A`（真正未被邀请的 offer）在 trigger 中 | **71/90（78.9%）** |
| `A` 在匹配负例中 | **8/90（8.9%）** |
| enrichment | **8.88×** |
| 仅高置信标注 | 41/44 对 1/30 |
| assistant-shaped（把 offer 本身排除后判断） | **70/71（98.6%）** |
| 不需要用户话轮即可判定 | 67/71（94.4%） |

在每个长度桶和两种轮数下方向都成立，因此不是长度效应。

**编码分布（trigger/负例）：** `A` 71/8、`B` 13/58、`C` 0/2、`D` 2/1、`E` 4/19、`F` 0/2。没有 offer 语言的回复在 `B`–`E` 之间跨读者不一致，因此**只有 `A` 与「A 对 非 A」在整张 sheet 上可比**。rubric 在看样本前已冻结，事后未修改，该缺陷在报告中披露而非修补。

**Construct 结论：** 规则做了它名字说的事。但它 94.4% 的正例根本不需要用户话轮，所以它检测的是助手的「随时可继续」收尾语域，而不是对用户意图的推断。

**状态建议：保持 `shadow`，登记为未来晋升候选。** Class A 需要真人假阳性证据，而这次复核的负例是模型回复；一条在「主动提供帮助」上触发的规则，必须用真人提供的帮助来对照。那条人类对照臂才是晋升条件。

## 5. 审计

| 检查 | 结果 |
| --- | --- |
| provenance（工作区） | boundary test 通过；无本地或第三方材料被跟踪 |
| provenance（全部历史） | `provenance:probe --full`：所有扫描到的 revision 中无长段非本项目文字 |
| 机密 | 无凭据、token、key 或私钥 |
| 路径与身份 | **发现并修复**：六份 upstream 报告带有本机 home 目录 |
| tracked-but-ignored | 无 |
| 体积 | 最大跟踪文件 509 KiB，低于 1 MiB 上限 |
| 许可 | 根 MIT 含明确的第三方排除条款；8/8 upstream 许可副本校验通过；HelpSteer3/LCCC 表述已复核；不存在「MIT 覆盖第三方文本」的推导 |
| 历史表述 | 搜索了全部已撤回说法；五份引用 advice 比率的相位报告带 `requestKind` 未填充横幅 |
| 计分语义 | class 过滤在代码与审计中各校验一次；无 blended score、无概率键 |
| README | 说明项目是什么、不是什么；未宣传为 AI detector |
| CI | 两个仓库均 green |
| fresh clone | 端到端 green，跑完后零未提交改动 |

### 本次复核修掉的缺陷

- **`chat.unrequested_background` 在未接通的 gate 上计分。** 见 §2 与 `GATE_REVIEW.md`。
- **`chat.explains_obvious` 无证据却计分。** 同上。
- **四条 `detectionHint` 描述了代码从未检查的条件**（「未被限定语跟随的认同」「不携带信息的赞美」「没有情绪披露时的共情开场白」「用户自己引入的术语」），读者无法区分「已实现的运行条件」和「理想中的条件」。现在每条 hint 都说明自己是哪一种。

### fresh-clone 的 skip 差异

开发检出 895 passed / 6 skipped，fresh clone 743 passed / 158 skipped。多出的 **152 个 skip 全部是设计内的本地资源依赖**，没有任何 release-critical 测试因缺资源被跳过：

| 类别 | 数量 | 原因 |
| --- | --- | --- |
| 需要 `.upstream-cache/` 克隆的抽取测试（4 个文件整体 skip：dsh-humanizer 48、ai-humanizer 14、humanizer-zh-cn 17、stop-slop 34） | 113 | upstream 克隆是 gitignore 的本地工作缓存，清单里只固定 commit；干净检出里没有克隆，因此这些测试验证的是「抽取可从克隆复现」，在无克隆时按设计跳过 |
| 同类测试的部分用例（humanizer-zh 10、humanize-text 10、upstream 11） | 31 | 同上，其余用例读已提交的抽取结果，正常运行 |
| manifest 克隆一致性（4）、compatibility 受影响行（4）、registry-load 克隆相关（1） | 9 | 同上 |
| 开发检出也跳过的 6 个（author voice 生成 5、registry-load 1） | 6 | 干净检出同样跳过，两边一致 |

也就是说：dev 只跳这 6 个，fresh clone 在同样跳这 6 个之外，另外跳 152 个克隆依赖用例，合计 158。**没有任何一条 `release:audit`、boundary、provenance、`--check` 或计分相关测试被跳过**——这些全部实际运行并通过。这一点在 RC README 里也向陌生读者说明。

## 6. 本次刻意没有做的事

- **不重跑 Phase A–H**，不新增规则，不改 A v1 与 action-plan B，不扩 benchmark。
- **不因为想保住分数而保留任何规则。** 两条规则被降级，分数朝上走，这是移除计分项的结果而非调参。
- **不重写历史。** 五份相位报告重跑后未采用，保留原发表数字并加横幅说明其 advice 行是在什么状态下测的。
- **不修补 `chat.mechanical_empathy`。** 它满足 Class A 条件，但证据薄，因此记录在限制里而不是悄悄留白。
- **没有 promotion。** offer 规则复核结果很强，仍停在 `shadow`。

## 7. 已知限制（均不阻止公开）

1. **A v1 abstain 比例高，且无繁体中文路径。** 2,000 条话轮中授予 permission 0 次、abstain 77.5%；面对繁体中文的明确求助会返回 `LOW`，即**允许规则指控**的那个状态。*解决路径：* 繁体信号集，或同时使用上一轮的 permission 读取，并在 permission 盲集上先测。
2. **shadow 规则可以为计分规则作旁证。** suppression 层不按 class 过滤，因此一条不计分的规则可以决定什么被计分。本次迁移中没有任何测量依赖它。*解决路径：* 把旁证按 class 过滤，作为独立改动带独立 diff。
3. **`chat.mechanical_empathy` 的计分证据薄。** 真人样本 0 次触发（特异性半边），机器文本两语料合计 10 次（敏感性半边）。construct 已审、无未接通 gate，因此留在 Class A 是成立的，但数字很小。*解决路径：* 更大的机器语料，或那四条已归档漏报所需的人类对照集。
4. **`chat.unsolicited_offer` 缺真人假阳性测量。** 8.88× enrichment 只对模型负例成立。*解决路径：* 同一 rubric 用于同长度同 domain 的真人回复。
5. **`chat.mirrors_user` 是 `deprecated-candidate`。** 真阳性 4 对负例 2；73 个 trigger 中 47 个是必需的实体复用。替代实现应从命题复述出发。
6. **`chat.auto_summary` specificity 有限。** 只有 37.2% 的 trigger 是真正不必要的复述，高置信 trigger 中仅 6/118。只报告、不计分；重新实现需要自己的盲测。
7. **`chat.mechanical_empathy` 覆盖窄，且加宽不划算。** 四条已知漏报是安慰式祈使句与赦免式收尾，真人同样会写。
8. **solution-mode shift 无正预测。** `LOW` + `PLAN` 在 396 条受控回复中 0 次：既无观测到的误触发，也无 precision 数字，因为没有正预测。
9. **`bench:report -- --check` 无法在 CI 运行**，因为它校验的 run 文件是 gitignore 的；它会明确报告「无法在此检出中校验」而不是静默通过。*解决路径：* 提交被引用的那个 run，或让校验对比一次新 run 并忽略 run 文件行。
10. **外部数字并非全部可复现。** 部分依赖无法再分发的语料，报告逐条注明；标记为 upper bound pending calibration 的数字就按 upper bound 处理。
11. **offer 复核的 `B`–`E` 编码跨读者不一致。** 只有 `A` 在整张 sheet 上可比。rubric 在看样本前冻结，未事后修改。
12. **`chat.explains_obvious` 与 `chat.unrequested_background` 的代码保留但 claim 撤回。** 两条仍会在 finding 列表里出现，只是不再计分。

## 8. 人工闸门需要处理的家务

账号下遗留若干**私有、已被取代**的 RC 仓库：RC 每因审计发现缺陷而重建一次，就会多留一个。它们不含语料文本、不含开发历史，但属于杂物，而本会话没有删除权限。当前清单以
`gh repo list Iraryi --json name,visibility` 为准；命名规律是 `human-voice-suite-public-rc` 与
`human-voice-suite-rc-superseded-<N>`。删除需要 `delete_repo` scope：

```bash
gh auth refresh -h github.com -s delete_repo
gh repo list Iraryi --json name --jq '.[].name | select(test("human-voice-suite-(public-)?rc"))' \
  | ForEach-Object { gh repo delete "Iraryi/$_" --yes }
```

除此之外没有遗留事项。RC 是 private，开发仓库是 private，**public 开关未执行**。
