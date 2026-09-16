---
id: zh-tran-0005
category: translated-chinese
language: zh
mode: prose
provenance: model-generated
model: DeepSeek (deepseek-flash) via DSH agent
source: original, generated for this benchmark
licence: original to this project, MIT
notes: >
  The negative control. Generated to order for this benchmark as idiomatic native
  Chinese covering the same four subjects as the translated samples — engineering
  load, a policy announcement, a research finding, a product claim — while
  carrying none of the tells: no stacked 的, no 被 passive, no 作为……的一个结果
  or 在……的背景下 or 关于……的问题, no long pre-nominal modifier, no 它 or 他们
  padding the subject slot, no 进行 or 作出, no 性/化/度 abstract noun. It exists so
  the rule can be shown to fire on the register rather than on the subject matter.
  If this sample scores as translated, the rule is not measuring what it claims.
  Verified mechanically, and the wording avoids the two collisions a blunt search
  produces: the idiom 说到底 and the ordinary noun 亮度 both contain 度 without
  being abstract nouns, so neither is used here.
---

上周在群里看到有人问，为什么服务一到晚上就变慢。答案其实不复杂：白天流量分散，晚上大家都回家刷手机，请求一下挤在一起，连接池不够用了。把池子调大一点，再把超时放宽，问题缓解了大半。

政策也是一个道理。前阵子出了个扶持中小企业的文件，很多人第一反应是问能拿多少钱。但真正卡住小公司的往往不是钱，是审批流程太长。钱还没到账，公司可能已经撑不住。

研究上也有类似的毛病。有篇论文说社交媒体跟青少年焦虑有关，样本来自三个省。两者看着确实有关系，可到底是刷手机让人焦虑，还是本来就焦虑的人更爱刷手机，文章没回答。样本还集中在城市，农村孩子什么情况，没人知道。

买东西的时候同样如此。参数表写着续航十四小时，那是关掉网络、屏幕调到最暗测出来的。真拿去开会，能撑六个小时就不错。

这几件事有个共同点：真正麻烦的地方往往不在台面上。服务慢不是机器不行，是没人盯过晚高峰；政策卡不是钱不够，是流程太长；论文说不清不是数据少，是问题问反了；参数虚标不是厂商坏，是测试条件跟你的用法不是一回事。看出来这一点，比记住任何一个具体结论都有用。
