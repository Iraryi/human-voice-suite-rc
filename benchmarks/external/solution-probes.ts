/**
 * The solution-mode probes: one situation, three user turns.
 *
 * ## The behaviour under study
 *
 * > The user did not ask for a solution, and the reply turns the conversation into an action
 * > plan anyway.
 *
 * It is the largest coverage gap the project has measured. In the prompt bank, 8 of 8
 * unconstrained answers to a complaint were a plan of action and `chat.unsolicited_advice`
 * caught 1; on HelpSteer3, a loose probe finds a procedure in 34.6% of 4,866 machine responses while
 * carrying none of the five phrases that rule watches, against a 2.9% firing rate. That 34.6% is an
 * upper bound from an uncalibrated probe; `SOLUTION_MODE.md` §4 reports what stricter features
 * manage against hand labels, which is much less.
 *
 * ## Why the prompts come in threes
 *
 * Because the thing being detected is not advice. It is **uninvited** advice, and a corpus of
 * complaints alone cannot tell the two apart: a detector that fires on every plan of action
 * would be right on the complaint and wrong on the request. So each situation appears three
 * times, changing only whether a solution was asked for:
 *
 * | Variant | The user turn | What a good detector does |
 * | --- | --- | --- |
 * | `vent` | States the problem and how it feels. Asks nothing. | Treats a full action plan as the behaviour under study |
 * | `view` | States the problem and asks what the other person makes of it — a judgement, not a plan | Treats a plan as suspect, an opinion as fine |
 * | `help` | Asks what to do | Does not penalise a normal, wanted answer |
 *
 * A detector that cannot separate the third column from the first is measuring advice, and
 * advice is not a tell.
 *
 * ## What these are not
 *
 * Not a human/machine comparison: all three arms are machine. The human side of the question
 * is measured separately, from the external corpora, where the same structural features are
 * counted on replies real people wrote.
 */

export interface SolutionProbe {
  readonly id: string;
  readonly topic: string;
  readonly variant: 'vent' | 'view' | 'help';
  readonly userTurn: string;
}

export interface SolutionTopic {
  readonly id: string;
  /** The situation, described once so the three variants differ only in what is asked. */
  readonly situation: string;
  readonly vent: string;
  readonly view: string;
  readonly help: string;
}

/**
 * Twenty situations where something could be done about it.
 *
 * Written for this project, MIT. The three variants of a topic share their first clause on
 * purpose: the only thing that changes between them is the request.
 */
export const SOLUTION_TOPICS: readonly SolutionTopic[] = [
  {
    id: 'renovation-noise',
    situation: 'A neighbour is renovating and the noise starts at seven.',
    vent: '楼上装修从早上七点开始，已经第五天了，我快疯了',
    view: '楼上装修从早上七点开始，已经第五天了。你说这种事是不是根本没人管得了',
    help: '楼上装修从早上七点开始，已经第五天了。我该怎么办？',
  },
  {
    id: 'phone-battery',
    situation: 'A phone battery drains by mid-afternoon.',
    vent: '手机现在中午就没电了，一天要充三次，烦死了',
    view: '手机现在中午就没电了，一天要充三次。你觉得是电池不行了还是系统的问题',
    help: '手机现在中午就没电了，一天要充三次。我该怎么办？',
  },
  {
    id: 'overtime',
    situation: 'Work has run late every night this week.',
    vent: '这周每天都干到十一点，回到家什么都不想干',
    view: '这周每天都干到十一点。你说这种状态是行业常态还是我们组的问题',
    help: '这周每天都干到十一点。我该怎么办？',
  },
  {
    id: 'parcel-lost',
    situation: 'A parcel has been sitting at the depot for a week.',
    vent: '快递显示到了网点，一周了没人送，打电话也没人接',
    view: '快递在网点压了一周，打电话也没人接。你说这是不是就丢件了',
    help: '快递在网点压了一周，打电话也没人接。我该怎么办？',
  },
  {
    id: 'colleague-work',
    situation: 'A colleague keeps handing over their work.',
    vent: '同事又把他的活儿推给我了，说是"顺手"，我这周已经加了三次班',
    view: '同事又把活儿推给我，说是顺手。你说这种人是不是就吃准了我不好意思拒绝',
    help: '同事总把活儿推给我。我该怎么办？',
  },
  {
    id: 'rent-rise',
    situation: 'The landlord is raising the rent again.',
    vent: '房东又说要涨房租，一年涨两次，我真是服了',
    view: '房东一年涨两次房租。你说这是市场行情还是他看准了我懒得搬',
    help: '房东又要涨房租了。我该怎么办？',
  },
  {
    id: 'skin',
    situation: 'Skin has been breaking out for weeks.',
    vent: '脸上这两周一直在起痘，用什么都没用，照镜子都烦',
    view: '脸上这两周一直在起痘，用什么都没用。你觉得是换季还是熬夜熬的',
    help: '脸上这两周一直在起痘。我该怎么办？',
  },
  {
    id: 'cat-night',
    situation: 'A cat yowls all night.',
    vent: '猫每天凌晨三点开始叫，我已经一周没睡整觉了',
    view: '猫每天凌晨三点开始叫。你说它是真有事还是纯粹在闹',
    help: '猫每天凌晨三点开始叫，我睡不好。我该怎么办？',
  },
  {
    id: 'slow-laptop',
    situation: 'A three-year-old laptop has become slow.',
    vent: '这台电脑开个浏览器都要转半天，用了三年，越来越卡',
    view: '这台电脑用了三年越来越卡。你说还有救吗',
    help: '这台电脑越来越卡了。我该怎么办？',
  },
  {
    id: 'credit-bill',
    situation: 'The credit card bill came in over budget.',
    vent: '这个月账单又超了，我都没买什么大件，钱不知道花哪儿了',
    view: '这个月账单又超了，我也没买大件。你说是不是记流水账才有用',
    help: '这个月信用卡账单又超了。我该怎么办？',
  },
  {
    id: 'relatives-salary',
    situation: 'Relatives keep asking about salary.',
    vent: '过年回家又要被问工资了，一想到就头疼',
    view: '过年回家又要被问工资。你说亲戚为什么都爱问这个',
    help: '过年回家总被问工资，我不想答。我该怎么办？',
  },
  {
    id: 'sleep',
    situation: 'Sleep has been bad for a month.',
    vent: '这个月每天躺下都要一两个小时才睡着，白天整个人是飘的',
    view: '这个月每天躺下一两个小时才睡着。你说这算失眠吗',
    help: '这个月一直睡不好。我该怎么办？',
  },
  {
    id: 'deposit',
    situation: 'A landlord will not return the deposit.',
    vent: '退租一个月了，押金还没退，微信也不回',
    view: '退租一个月押金还没退，人也不回消息。你说这钱还能要回来吗',
    help: '房东不退我押金。我该怎么办？',
  },
  {
    id: 'new-shoes',
    situation: 'New shoes rub the heel.',
    vent: '新买的鞋磨脚后跟，穿了两次已经破了皮',
    view: '新买的鞋磨脚后跟。你说这种鞋还有必要留着吗',
    help: '新买的鞋磨脚后跟。我该怎么办？',
  },
  {
    id: 'scope-change',
    situation: 'A manager changed the requirements again.',
    vent: '需求又改了，这是这周第三次，前面做的全白做',
    view: '需求这周改了三次。你说这是不是我们没问清楚',
    help: '领导又改需求了，前面白做。我该怎么办？',
  },
  {
    id: 'gym-refund',
    situation: 'A gym will not process a membership refund.',
    vent: '健身房办卡的时候说随时可退，现在说要扣百分之三十',
    view: '健身房说退卡要扣百分之三十。你说这种条款是不是本来就无效',
    help: '健身房不退我卡费。我该怎么办？',
  },
  {
    id: 'wifi',
    situation: 'Home internet drops out every evening.',
    vent: '一到晚上网就断断续续，看个视频一直在转圈',
    view: '一到晚上网就断断续续。你说这是运营商的问题还是路由器老了',
    help: '家里网一到晚上就断。我该怎么办？',
  },
  {
    id: 'stomach',
    situation: 'A stomach ache has lasted a few days.',
    vent: '胃这两天一直隐隐地疼，吃东西也不香',
    view: '胃这两天一直隐隐地疼。你说是不是前阵子吃辣的吃的',
    help: '胃疼了两天不见好。我该怎么办？',
  },
  {
    id: 'friend-loan',
    situation: 'A friend has not repaid a loan.',
    vent: '借给朋友的钱说好上个月还，现在提都不提',
    view: '借出去的钱说好上个月还，现在对方提都不提。你说这朋友还能处吗',
    help: '朋友借钱一直不还。我该怎么办？',
  },
  {
    id: 'thesis',
    situation: 'A thesis chapter will not come together.',
    vent: '论文第三章写了两周还是那几百字，一打开就想关掉',
    view: '论文第三章写了两周还是那几百字。你说是我积累不够还是题目不对',
    help: '论文第三章一直写不出来。我该怎么办？',
  },
];

export const SOLUTION_PROMPTS: readonly SolutionProbe[] = SOLUTION_TOPICS.flatMap((topic) =>
  (['vent', 'view', 'help'] as const).map((variant) => ({
    id: `smp-${topic.id}-${variant}`,
    topic: topic.id,
    variant,
    userTurn: topic[variant],
  })),
);

/** The three variants as prompt-bank-shaped categories, so one tool can prepare them. */
export const SOLUTION_CATEGORIES = [
  {
    id: 'vent',
    label: '纯抱怨，没有请求（vent）',
    why: 'A problem and a feeling, and nothing asked. A full action plan here is the behaviour under study.',
    prompts: SOLUTION_TOPICS.map((topic) => topic.vent),
  },
  {
    id: 'view',
    label: '问看法，不是问方案（view）',
    why: 'Asks what the other person makes of it. An opinion is the wanted answer; a plan is suspect.',
    prompts: SOLUTION_TOPICS.map((topic) => topic.view),
  },
  {
    id: 'help',
    label: '明确求助（help）',
    why: 'Asks what to do. The control: a plan here is wanted, and a detector that penalises it is measuring advice rather than the shift.',
    prompts: SOLUTION_TOPICS.map((topic) => topic.help),
  },
] as const;

/** The variant of a solution probe, from its id. */
export function variantOf(id: string): 'vent' | 'view' | 'help' {
  const variant = id.split('-').pop();
  if (variant === 'vent' || variant === 'view' || variant === 'help') return variant;
  throw new Error(`Not a solution probe id: ${id}`);
}

/**
 * The blind validation set: twenty-four situations from domains the calibration set never touched.
 *
 * Written after the calibration topics, on purpose in territory the earlier twenty did not cover —
 * a school, a hospital, a bank, a border, a car, a rental agency, a workplace process, a
 * subscription, a warranty, a visa — so that a feature that only works on the shapes it was tuned
 * against fails here rather than being carried into the suite.
 *
 * **Nothing may be changed in response to what these produce.** Reading them and adjusting a
 * pattern turns them into a second calibration set, and the rule is written down here so that the
 * temptation has somewhere to meet a wall: if the patterns change, this batch is calibration and a
 * third set has to be written before any claim is made.
 */
export const BLIND_TOPICS: readonly SolutionTopic[] = [
  {
    id: 'school-transfer',
    situation: 'A child is being moved to another school and the paperwork is stuck.',
    vent: '转学材料交上去三周了，学校一直说在走流程，孩子天天在家待着',
    view: '转学材料交上去三周还没动静。你说这是学校拖着还是教育局那边卡着',
    help: '孩子转学的材料卡了三周。我该怎么办？',
  },
  {
    id: 'clinic-appointment',
    situation: 'A specialist appointment keeps being pushed back.',
    vent: '专家号挂了两次都被停诊，一次推一个月，我这检查一直做不上',
    view: '专家号两次停诊，一推就是一个月。你说这种号还值得等吗',
    help: '专家号连续被停诊。我该怎么办？',
  },
  {
    id: 'bank-fee',
    situation: 'A bank charged a fee nobody explained.',
    vent: '卡里这个月被扣了三十块，问客服说是账户管理费，办卡的时候没人提过',
    view: '银行扣了三十块管理费，办卡时没人说过。你说这种收费算不算默认同意',
    help: '银行卡被扣了没说明的费用。我该怎么办？',
  },
  {
    id: 'visa-delay',
    situation: 'A visa application has passed its stated processing time.',
    vent: '签证状态显示审理中已经两个月了，机票都改签一次了',
    view: '签证审理两个月了还没出。你说这算正常节奏还是被卡了',
    help: '签证超过审理时间还没结果。我该怎么办？',
  },
  {
    id: 'car-repair',
    situation: 'A garage fixed one thing and broke another.',
    vent: '车送去修空调，取回来发现中控屏不亮了，对方说不是他们弄的',
    view: '修完空调中控屏不亮了，他们说不是他们的责任。你说这种是不是只能认了',
    help: '修车之后多了个新毛病，对方不认。我该怎么办？',
  },
  {
    id: 'agency-fee',
    situation: 'A rental agency wants a fee that was never mentioned.',
    vent: '看房的时候说中介费半个月，签约当天变成一个月，说"行情就是这样"',
    view: '中介费从半个月变成一个月。你说这种口头说法算不算数',
    help: '中介临时加价。我该怎么办？',
  },
  {
    id: 'handover',
    situation: 'A resignation is being blocked by a handover that never finishes.',
    vent: '提了离职，交接拖了一个月，说我走了项目就没人接',
    view: '离职交接拖了一个月还不放人。你说这是真缺人还是不想放',
    help: '提了离职但交接一直拖着。我该怎么办？',
  },
  {
    id: 'subscription',
    situation: 'A subscription renewed without a reminder and will not cancel.',
    vent: '会员自动续了一年，扣款前没有任何提醒，取消入口藏得找不到',
    view: '会员自动续费一年，取消入口找不到。你说这种设计是不是故意的',
    help: '会员自动续费了还退不掉。我该怎么办？',
  },
  {
    id: 'warranty',
    situation: 'A warranty claim is being refused for a reason that sounds made up.',
    vent: '机器坏了还在保修期，售后说进过水不算保修，可我根本没碰过水',
    view: '售后说进过水不在保修范围。你说这种判定有没有地方能核实',
    help: '售后以进水为由拒绝保修。我该怎么办？',
  },
  {
    id: 'moving-company',
    situation: 'A moving company damaged furniture.',
    vent: '搬家公司把柜子磕掉一角，人走了才看见，客服电话一直占线',
    view: '搬家磕坏了柜子，客服电话打不通。你说这种损失他们一般赔不赔',
    help: '搬家公司磕坏了家具还不接电话。我该怎么办？',
  },
  {
    id: 'course-refund',
    situation: 'An online course is not what was advertised.',
    vent: '买的课说是直播带练，进去发现是去年录播，老师也不在群里',
    view: '课程宣传直播实际是录播。你说这算不算虚假宣传',
    help: '买的课程和宣传不符。我该怎么办？',
  },
  {
    id: 'neighbour-parking',
    situation: 'A neighbour keeps parking in a private space.',
    vent: '楼下那位天天停我家车位，说了两次还是照停',
    view: '邻居天天占我车位，说了也不改。你说这种事找物业有用吗',
    help: '邻居长期占我车位。我该怎么办？',
  },
  {
    id: 'elder-care',
    situation: 'A nursing home will not give straight answers about care.',
    vent: '养老院每次问护理记录都说"放心"，我姥姥这周瘦了一圈',
    view: '养老院不给看护理记录。你说这种情况能不能要求公开',
    help: '养老院不给看护理记录，我不放心。我该怎么办？',
  },
  {
    id: 'unpaid-wages',
    situation: 'A former employer has not paid the last month.',
    vent: '上家公司的最后一个月工资到现在没发，问就是"下周"',
    view: '上家公司拖了两个月工资。你说仲裁是不是唯一的路',
    help: '上家公司拖欠工资。我该怎么办？',
  },
  {
    id: 'exam-appeal',
    situation: 'An exam result looks wrong and the appeal window is closing.',
    vent: '成绩出来比预估低四十分，复核申请只有三天窗口',
    view: '分数差了四十分，复核窗口只有三天。你说复核真能查出问题吗',
    help: '考试成绩异常，复核窗口快关了。我该怎么办？',
  },
  {
    id: 'flight-cancel',
    situation: 'A flight was cancelled and the airline is offering a voucher.',
    vent: '航班临时取消，改签排了三小时，最后只给一张代金券',
    view: '航班取消只赔代金券。你说这种补偿标准是谁定的',
    help: '航班取消只给代金券。我该怎么办？',
  },
  {
    id: 'data-breach',
    situation: 'An account was breached and the support line is unhelpful.',
    vent: '账号半夜被盗刷了两笔，客服说"正在核实"，两天没回音',
    view: '账号被盗刷，客服只说要核实。你说这种情况银行有没有责任',
    help: '账号被盗刷，客服一直不处理。我该怎么办？',
  },
  {
    id: 'school-bullying',
    situation: 'A child says something is happening at school.',
    vent: '孩子这周三次说不想上学，问他也不说，我心里发慌',
    view: '孩子突然不肯上学又不说原因。你说该不该直接找老师',
    help: '孩子可能在学校遇到事但不说。我该怎么办？',
  },
  {
    id: 'startup-equity',
    situation: 'Equity promised verbally is not in the contract.',
    vent: '入职时说给期权，合同里一个字没写，现在问就说"以后补"',
    view: '口头承诺的期权没写进合同。你说这种承诺有法律效力吗',
    help: '公司口头承诺的期权没写进合同。我该怎么办？',
  },
  {
    id: 'pet-surgery',
    situation: 'A vet bill is far higher than the estimate.',
    vent: '说好两千的手术最后结账八千，中途加的项目一项都没问过我',
    view: '手术费从两千变成八千，中途没问过。你说这种加项合不合规',
    help: '宠物医院费用远超预估。我该怎么办？',
  },
  {
    id: 'phone-plan',
    situation: 'A phone plan changed without consent.',
    vent: '套餐被改成更贵的，营业厅说是我自己点的，我根本没操作过',
    view: '套餐被改了还说是我点的。你说这种记录能不能查',
    help: '手机套餐被擅自更改。我该怎么办？',
  },
  {
    id: 'building-safety',
    situation: 'A fire exit is blocked and management ignores it.',
    vent: '楼道消防通道堆满了杂物，跟物业说了三次，第二天还是那样',
    view: '消防通道长期被占，物业不管。你说这事该找谁',
    help: '小区消防通道被堵，物业不管。我该怎么办？',
  },
  {
    id: 'scholarship',
    situation: 'A scholarship decision looks inconsistent with the rules.',
    vent: '奖学金名单出来了，条件写得明明白白我却没评上，问谁都说"综合评定"',
    view: '奖学金评审结果和公布的条件对不上。你说这种能不能申诉',
    help: '奖学金评审结果有疑问。我该怎么办？',
  },
  {
    id: 'freelance-payment',
    situation: 'A client will not pay the final invoice.',
    vent: '活儿交了一个月，尾款一直说"财务在走流程"',
    view: '尾款拖了一个月说在走流程。你说这种情况还该继续合作吗',
    help: '客户一直不付尾款。我该怎么办？',
  },
];

export const BLIND_PROMPTS: readonly SolutionProbe[] = BLIND_TOPICS.flatMap((topic) =>
  (['vent', 'view', 'help'] as const).map((variant) => ({
    id: `blind-${topic.id}-${variant}`,
    topic: topic.id,
    variant,
    userTurn: topic[variant],
  })),
);
