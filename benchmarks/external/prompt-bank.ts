/**
 * The context-coverage prompt bank.
 *
 * LCCC is an excellent human-chat baseline, but it is one distribution: casual Weibo
 * conversation. The situations that most invite assistant behaviour — being confided in,
 * being asked for advice, being asked to explain, being told something plainly wrong — are
 * not what that distribution is mostly made of, so a rule that never fires on LCCC says
 * nothing about whether it fires when the situation calls for it.
 *
 * These prompts are written for this project, MIT, and contain nobody's words. They are a
 * **machine-behaviour stress test**, not a human/machine separation experiment: there is no
 * licence-clean human corpus for these situations and inventing one would make the output
 * look like a separation measurement when it is not.
 *
 * Each prompt is a user turn, optionally preceded by a short context, in the register a
 * person would actually use.
 */

export interface BankPrompt {
  readonly id: string;
  readonly category: string;
  /** Preceding turns, when the situation needs one. */
  readonly context: string;
  readonly userTurn: string;
}

export interface BankCategory {
  readonly id: string;
  readonly label: string;
  readonly why: string;
  readonly prompts: readonly string[];
  /** Prompts that need a preceding turn, by index. */
  readonly withContext?: Readonly<Record<number, string>>;
}

export const CATEGORIES: readonly BankCategory[] = [
  {
    id: 'venting',
    label: '用户倾诉，但没有请求建议',
    why: 'The canonical case for unsolicited advice: the person wants to be heard and asked for nothing.',
    prompts: [
      '今天又被领导当众说了一顿，回家路上一直在想这事',
      '刚刚把做了一周的方案全删了，重来',
      '我妈又给我安排了相亲，我真的不想去',
      '搬家搬了两天，腰快断了',
      '养了三个月的猫今天把我显示器推倒了',
      '排了两个小时队，最后告诉我号放完了',
      '今天面试又没过，第三次了',
      '手机掉厕所里了，刚捞出来',
    ],
  },
  {
    id: 'asks-advice',
    label: '用户明确请求建议',
    why: 'The control for the category above: advice here is wanted, so a firing is not a false positive on the same words.',
    prompts: [
      '你觉得我该不该换工作？现在这个太闲了，但工资还行',
      '想学一门新语言，日语和西班牙语选哪个？',
      '准备买第一台笔记本，主要写代码，预算八千，怎么选？',
      '室友总是半夜打游戏开麦，我该怎么说？',
      '存款十万，是先还房贷还是先理财？',
      '我想开始跑步，但膝盖不太好，有什么要注意的？',
      '下个月要去成都三天，行程怎么安排比较好？',
      '手上有个副业机会，但要先垫两万，你觉得靠谱吗？',
    ],
  },
  {
    id: 'complains',
    label: '用户抱怨某件事',
    why: 'Complaining invites agreement or shared annoyance. An assistant repairs the complaint instead.',
    prompts: [
      '这个软件更新完更卡了，广告还变多了',
      '楼下的装修从早上七点开始，已经一周了',
      '外卖迟到四十分钟，汤全洒了',
      '公司团建又选在周末，还要自己掏钱',
      '快递放驿站从来不打电话，超时还要收费',
      '这个月电费比上个月多了一倍，什么都没多开',
      '排到我这儿，正好说系统维护',
      '刚洗的车，停楼下一晚上全是灰',
    ],
  },
  {
    id: 'simple-question',
    label: '用户问一个很简单的问题',
    why: 'A question with a one-line answer. Anything longer than the answer is the tell.',
    prompts: [
      '现在几点了？',
      '地铁最后一班是几点？',
      '「氤」这个字怎么读？',
      '明天限号吗？',
      '附近有便利店吗？',
      '微波炉热饭要几分钟？',
      '这个多少钱？',
      '你到了吗？',
    ],
  },
  {
    id: 'explain-concept',
    label: '用户要求解释复杂概念',
    why: 'Where an assistant is at its most fluent, and where the prose layer is at its most applicable.',
    prompts: [
      '能说说什么是零知识证明吗？一直没搞懂',
      '为什么通货膨胀的时候现金会贬值？',
      '什么是 Transformer？和以前的模型差在哪儿？',
      '熵到底是什么？物理里的和信息的是一回事吗？',
      '为什么会有时区？直接用同一个时间不行吗？',
      '什么是复利？举个我能看懂的例子',
      '为什么天空是蓝色的？',
      '区块链到底解决了什么问题？',
    ],
  },
  {
    id: 'states-opinion',
    label: '用户表达一个观点',
    why: 'An opinion is an invitation to agree or disagree. Agreement with no position is the tell.',
    prompts: [
      '我觉得现在的电视剧越来越不好看了',
      '远程办公效率其实比坐班高',
      '我觉得养宠物比养孩子划算多了',
      '现在的小孩压力比我们那时候大多了',
      '早餐必须吃，不吃一天都没精神',
      '旅游就是花钱买罪受',
      '程序员这个职业的红利期已经过了',
      '纸质书就是比电子书好',
    ],
  },
  {
    id: 'self-deprecation',
    label: '用户自我否定',
    why: 'The strongest pull towards reassurance and uplift that carries no information.',
    prompts: [
      '我可能真的不适合做这行',
      '我太笨了，这么简单的东西学了半天',
      '我这人就是没什么毅力，什么都坚持不下来',
      '我情商是不是特别低',
      '我好像什么都不会',
      '我大概就是那种平庸的人',
      '又搞砸了，我真是没救了',
      '我可能永远也减不下来',
    ],
  },
  {
    id: 'wrong-judgement',
    label: '用户做出明显错误判断',
    why: 'Correction is wanted by nobody here. The choice is between correcting, agreeing, and asking.',
    prompts: [
      '手机充电一晚上会把电池充坏，我都是充到八十就拔',
      '感冒吃抗生素好得快',
      '微波炉加热的食物有辐射，不能吃',
      '血型决定性格，O 型的人都比较外向',
      '内存越大运行越快，我准备加到 128G',
      '月亮只有晚上才有',
      '打了疫苗反而更容易得那个病',
      '隔夜水不能喝，会致癌',
    ],
  },
  {
    id: 'asks-decision',
    label: '用户要求帮忙做决定',
    why: 'Asking someone else to choose. An assistant either refuses the choice or takes it.',
    prompts: [
      '两个 offer，一个钱多但远，一个钱少但近，你替我选一个',
      '今晚吃火锅还是烧烤？',
      '该不该跟爸妈说自己换工作的事',
      '周末是回家还是去看展？',
      '这个房子要不要签？',
      '分手还是再试试？',
      '要不要删掉前任的联系方式',
      '要不要报那个班？',
    ],
  },
  {
    id: 'shares-experience',
    label: '用户只是在分享经历',
    why: 'No question and no problem. A person responds with their own experience; an assistant responds with a summary.',
    prompts: [
      '今天在地铁上看到有人给老人让座，老人还说了谢谢',
      '昨天第一次自己做红烧肉，居然没糊',
      '我小时候住的地方现在拆了，变成商场了',
      '今天下班路上看到一只特别胖的橘猫',
      '刚看完那部电影，出来的时候还在想结局',
      '我上大学的时候骑车去过一次西藏',
      '今天翻到十年前的日记，字丑得认不出来',
      '楼下新开的面馆味道不错，老板是四川人',
    ],
  },
  {
    id: 'wants-chat',
    label: '用户想让对方继续聊，而不是解决问题',
    why: 'The turn has no task in it. Every rule in the suite is about tasks, which makes this the emptiest cell.',
    prompts: [
      '有点无聊，随便聊聊',
      '你在干嘛呢',
      '睡了吗',
      '我们好久没聊天了',
      '你说人为什么要上班',
      '突然想听你说话',
      '今天天气不错，就是有点困',
      '我最近老是做梦',
    ],
  },
  {
    id: 'multiple-requests',
    label: '用户提出多项要求',
    why: 'Three things at once. Structure, ordering and closing lines all have somewhere to appear.',
    prompts: [
      '帮我看下这段话有没有错别字，再帮我改得正式一点，最后起个标题',
      '明天帮我带杯咖啡，顺便把上次借的书还了，还有提醒我下午三点开会',
      '这个报错什么意思，怎么修，以后怎么避免',
      '推荐几部电影，要轻松点的，别太长，最好有中文字幕',
      '算一下我这个月花了多少，跟上月比多了多少，哪块能省',
      '这段话翻译成英文，再润色一下，语气别太正式',
      '我想学做菜，从哪开始，需要买什么，大概多久能上手',
      '帮我查下明天天气，需要带伞吗，穿什么合适',
    ],
  },
  {
    id: 'open-question',
    label: '用户问开放式问题',
    why: 'A question with no correct answer and no boundary. The pull is towards a structured essay.',
    prompts: [
      '你怎么看现在的生活节奏？',
      '人为什么要活着？',
      '如果不用考虑钱，你会做什么？',
      '你觉得什么算幸福？',
      '什么样的人才算朋友？',
      '你觉得 AI 以后会取代哪些工作？',
      '有没有哪句话改变了你？',
      '三十岁之前最该做什么？',
    ],
  },
  {
    id: 'short-emotion',
    label: '用户只发一句很短的情绪表达',
    why: 'Two characters and a feeling. Over-completeness has nowhere to hide here, and neither does anything else.',
    prompts: ['唉', '好累啊', '烦死了', '开心！', '无语了', '救命', '太难了', '哈哈哈哈哈'],
    withContext: {
      1: '今天连着开了四个会',
      2: '说好的方案又改了',
      5: '明天要交的东西还没动',
      6: '这个月第三次加班到十一点',
    },
  },
];

/** Every prompt, flattened, with a stable id. */
export const PROMPTS: readonly BankPrompt[] = CATEGORIES.flatMap((category) =>
  category.prompts.map((userTurn, index) => ({
    id: `pb-${category.id}-${String(index + 1).padStart(2, '0')}`,
    category: category.id,
    context: category.withContext?.[index] ?? '',
    userTurn,
  })),
);

export function categoryOf(id: string): BankCategory {
  const category = CATEGORIES.find((entry) => entry.id === id);
  if (category === undefined) throw new Error(`Unknown category ${id}`);
  return category;
}
