(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AppShell = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const AUTH = {
    username: 'studio',
    password: 'AIGS2026!'
  };

  const MAX_HISTORY_ITEMS = 12;
  const STORAGE_PREFIX = 'aigs.v2';

  const FEATURE_META = {
    chat: { title: 'AI 对话', historyTitle: '最近会话' },
    lyrics: { title: '歌词创作', historyTitle: '歌词历史' },
    cover: { title: '图片生成', historyTitle: '图片历史' },
    speech: { title: '语音合成', historyTitle: '语音历史' },
    transcription: { title: '语音转文字', historyTitle: '转写历史' },
    music: { title: '音乐生成', historyTitle: '音乐历史' },
    covervoice: { title: '歌声翻唱', historyTitle: '翻唱历史' }
  };

  const lines = (...items) => items.join('\n');

  const TEMPLATE_LIBRARY = {
    chat: [
      {
        category: '内容创作',
        items: [
          { label: '短视频脚本', description: '生成抖音口播脚本', message: lines(
            '你现在是一名擅长短视频转化的内容策划，请为“AI 如何帮独立创业者省时间”写一版 60 秒抖音口播脚本。',
            '目标受众是自己做产品、内容、销售或运营的独立创业者，他们时间少、执行重，最关心“立刻能不能用”。',
            '脚本必须包含：开头 3 秒钩子、痛点放大、3 个具体 AI 使用场景、一个真实感结尾、明确 CTA。',
            '语气要干脆、有压迫感但不油腻，避免空话、避免泛泛而谈的“效率提升”。',
            '请按“镜头段落 + 口播文案 + 屏幕字幕重点”输出，方便直接拍摄。'
          ) },
          { label: '公众号选题', description: '输出 10 个爆款选题', message: lines(
            '请你以 AI 工具类公众号主编的视角，为一个面向创业者和职场人的账号设计 10 个高打开率选题。',
            '账号定位是“教普通人把 AI 真正用进工作流”，不讲纯概念，偏实战、提效、变现和案例拆解。',
            '每个选题都要给出：目标读者、标题方向、核心切入角度、适合采用的内容结构、可能引发转发/收藏的理由。',
            '标题风格要有明显差异，至少覆盖：清单型、反常识型、案例拆解型、踩坑复盘型。',
            '最终请用表格输出，列为“标题、目标读者、切入角度、结构建议、传播点”。'
          ) },
          { label: '产品卖点', description: '拆出卖点文案', message: lines(
            '我有一个 AI 内容生成网站，包含 AI 对话、歌词创作、图片生成、音乐生成、歌声翻唱和语音合成功能。',
            '请站在首页转化文案策划的角度，提炼 5 条最能打动用户的核心卖点。',
            '每条卖点都需要包含：一句可直接放在首页首屏或模块标题里的短句、对应的解释文案、适合打动的人群、建议摆放位置。',
            '请强调“一个工作台覆盖多种创作/生产需求”的价值，而不是孤立介绍单点功能。',
            '输出格式请用编号列表，确保短句足够短、解释足够具体、没有空泛形容词堆砌。'
          ) },
          { label: '直播提纲', description: '生成直播结构', message: lines(
            '请为一场 45 分钟的 AI 工具分享直播设计完整提纲，主题是“一个人也能用 AI 搭建高效内容生产线”。',
            '观众是对 AI 感兴趣但实践不足的内容创作者、小老板和自由职业者，目标是让他们看完后愿意立刻试用产品。',
            '整场直播要分成开场、问题共鸣、功能演示、案例拆解、观众互动、促转化结尾六段，并给出每段时长建议。',
            '每个环节都要写清楚：主播该说什么、要展示什么、观众最可能问什么、转场话术怎么接。',
            '请额外补一版“直播中途掉人时的救场话术”和“最后 3 分钟成交收口话术”。'
          ) }
        ]
      },
      {
        category: '工作效率',
        items: [
          { label: '周报助手', description: '整理成专业周报', message: lines(
            '我这周主要做了产品迭代、用户访谈、聊天体验优化和回归测试，请帮我整理成一份给老板看的专业周报。',
            '周报要突出结果，不要写流水账；重点体现“本周完成了什么、对业务/用户体验有什么价值、还存在哪些风险、下周准备怎么推进”。',
            '请按“本周重点成果、关键数据或反馈、遇到的问题与风险、协作需求、下周计划”五部分输出。',
            '语气要职业、简洁、像成熟产品/研发负责人提交的周报，避免学生作文式表达。',
            '如果输入信息不完整，请帮我用合理方式补全表述，但不要编造夸张数据。'
          ) },
          { label: '会议纪要', description: '提炼行动项', message: lines(
            '请根据一次产品评审会场景，生成一份可直接复用的高质量会议纪要模板。',
            '会议背景是一个 AI 内容生成平台评审新版本，涉及产品、前端、后端、测试和运营多个角色。',
            '纪要必须突出：会议目标、核心结论、已确认方案、待验证问题、行动项、负责人、截止时间、风险备注。',
            '请额外给出一段“适合会后发群同步的 5 行简版结论”，方便快速通知团队。',
            '输出请分成“正式纪要模板”和“群内同步模板”两部分。'
          ) },
          { label: '需求拆解', description: '拆成功能任务', message: lines(
            '请把“给 AI 生成网站增加登录、模板和历史记录”这个需求拆成可执行的开发任务清单。',
            '拆解时请按前端、后端、数据存储、测试验收、上线风险五个维度分类，保证每项任务颗粒度足够落地。',
            '每个任务都要包含：目标、关键工作内容、依赖项、容易遗漏的边界条件、建议验收方式。',
            '请优先考虑真实项目推进顺序，不要输出只有概念没有执行路径的空任务。',
            '最后再给一版建议实施顺序，说明为什么要这样排。'
          ) },
          { label: '风险审查', description: '找出项目风险', message: lines(
            '请你以资深上线评审人的视角，从安全、可维护性、用户体验、测试覆盖四个维度审查一个 AI 网站上线前的主要风险。',
            '这个网站包含认证体系、聊天流式回复、多模态生成、模板库、会话持久化和用户后台。',
            '请不要只列大词，每个风险都要写明：风险现象、可能造成的后果、触发条件、优先级、建议缓解动作。',
            '请优先指出真正会影响真实用户使用和后续维护成本的问题，而不是教科书式清单。',
            '最终请按严重程度排序输出。'
          ) }
        ]
      },
      {
        category: '学习研究',
        items: [
          { label: '概念讲解', description: '通俗讲清技术概念', message: lines(
            '请用非技术人员能真正听懂的方式解释什么是“向量数据库”。',
            '假设听众是会用 AI 产品、但不写代码的运营或创业者，他们希望理解这个概念和实际业务的关系。',
            '讲解时请遵循“先类比、再定义、再说为什么重要、最后举例”的顺序，避免一上来堆术语。',
            '请给出 3 个具体业务场景案例，并说明如果没有向量数据库会遇到什么问题。',
            '最终输出请像一篇培训笔记，清楚、结构化、没有术语黑话。'
          ) },
          { label: '英文翻译润色', description: '商务英文优化', message: lines(
            '请把我接下来提供的中文产品介绍翻译成自然、专业、适合官网或商务场景使用的英文。',
            '翻译目标不是逐字直译，而是保留原意、营销感和可信度，让英文读者读起来像原生文案。',
            '请注意：避免中式英语，避免过度夸张，优先使用 SaaS / AI 产品常见表达。',
            '如果原中文表达不够自然，请直接帮我优化后再翻译，并在最后补充 3 个可替换标题版本。',
            '输出分为“正文译文”和“可选标题”两部分。'
          ) },
          { label: '课程计划', description: '生成学习路径', message: lines(
            '请为一个零基础成年人设计一套 14 天的 AI 应用学习计划，每天学习 30 分钟。',
            '目标不是学理论，而是让他在两周后能够把 AI 用进自己的日常工作，提高写作、总结、分析和执行效率。',
            '课程设计要从最易见效的使用方式开始，再逐步进入工作流、模板化和高频场景实战。',
            '每天都要包含：学习目标、实际操作任务、推荐产出、完成标准、常见误区提醒。',
            '请按天输出，确保节奏合理，不要设计成需要很强技术背景才能完成。'
          ) },
          { label: '资料总结', description: '输出结构化摘要', message: lines(
            '我会提供一段长文或材料，请你帮我做高质量结构化总结。',
            '总结不是简单压缩，而是要提炼真正值得记住和行动的内容。',
            '请输出：5 个核心观点、3 个可执行建议、2 个值得继续追问的问题、1 段 100 字以内的总览摘要。',
            '如果原文里有明显冲突、模糊或证据不足的地方，也请单独指出。',
            '整体语气保持理性、清晰、适合复盘和团队同步。'
          ) }
        ]
      },
      {
        category: '商业咨询',
        items: [
          { label: '竞品分析', description: '对比 3 个产品', message: lines(
            '请站在产品策略负责人的角度，对比 3 个 AI 内容生成类产品。',
            '对比维度至少包括：目标用户、核心功能、上手门槛、收费方式、典型使用场景、差异化优势、潜在短板。',
            '请特别关注“真实用户为什么愿意持续使用”，而不是只罗列功能清单。',
            '输出时请先给一张总览对比表，再补每个产品的简短判断，最后给出我可以借鉴的产品策略启发。',
            '如果没有具体产品名，请用市面上常见的三类代表产品做抽象对比。'
          ) },
          { label: '定价策略', description: '给 SaaS 定价', message: lines(
            '一个 AI 内容生成网站包含 AI 对话、歌词、图片、音乐、翻唱和语音功能，请帮我设计一套阶梯定价方案。',
            '请从“用户为什么愿意付费”“不同人群对价值的敏感点”“高频与低频功能怎么打包”三个角度来设计。',
            '至少给出 3 个价格层级，每档都要写清：价格区间、包含能力、限制项、适合人群、升级诱因。',
            '请补充一段关于免费版边界的建议，避免免费版太弱无法转化，也避免太强影响付费。',
            '最后再写 5 条适合放在价格页上的文案表达。'
          ) },
          { label: '冷启动方案', description: '获取第一批用户', message: lines(
            '请给我一份 AI 工具网站的冷启动方案，目标是在预算有限的情况下拿到第一批真实用户。',
            '产品偏向内容生产和创意生成，适合独立创业者、内容创作者、小团队和效率型用户。',
            '方案必须包含：目标用户切入顺序、渠道策略、内容策略、转化动作、私域承接、试用到付费的关键节点。',
            '请同时给出每个阶段最值得看的指标，以及如果数据不达标应该优先改哪里。',
            '输出要按阶段写，不要只给散点建议。'
          ) },
          { label: '用户画像', description: '细分目标人群', message: lines(
            '请为一个 AI 内容生成网站拆出 4 类核心用户画像。',
            '每类画像都要包含：基本身份、核心目标、最常见使用场景、最痛的痛点、为什么愿意付费、最容易流失的原因。',
            '请尽量区分不同用户的真实差异，例如独立创业者、内容创作者、品牌营销、效率型白领，而不是换个名字重复同一类人。',
            '最后请再补一段“首页和产品演示应该优先打动哪一类人，以及为什么”。',
            '输出尽量具体，像真的在给产品团队做定位分析。'
          ) }
        ]
      }
    ],
    lyrics: [
      {
        category: '情绪抒情',
        items: [
          { label: '深夜疗愈', description: '城市夜景与希望', values: { prompt: lines(
            '请写一首中文流行歌词，主题是深夜城市里的疲惫与微弱但坚定的希望。',
            '画面要有城市灯光、空荡街道、回家路、窗边独处等意象，但不要写成堆砌风景词。',
            '情绪走向是“压抑 -> 自我整理 -> 重新点亮一点点希望”，整体克制、真诚、适合深夜单曲循环。',
            '语言要口语与诗意平衡，副歌要有一句能被记住的核心句，避免鸡汤式励志。'
          ), style: 'pop', structure: '主歌1-副歌-主歌2-副歌-桥段-副歌' } },
          { label: '分手释怀', description: '克制而温柔', values: { prompt: lines(
            '请写一首关于成熟分手后释然与祝福的抒情歌词。',
            '不要写互相指责，也不要写廉价的苦情；重点是两个认真爱过的人，在遗憾里学会放手。',
            '歌词里要有具体生活细节，例如一起走过的场景、习惯、留下的空位，让情绪更真实。',
            '副歌要有温柔但不软弱的表达，像真正走出来之后回看一段关系。'
          ), style: 'ballad', structure: '主歌-副歌-主歌-副歌' } },
          { label: '思念远方', description: '给异地恋人的歌', values: { prompt: lines(
            '请写一首献给异地恋人的歌词，主题是距离让思念更具体，而不是更模糊。',
            '请从一个真实恋人的视角写，加入时差、通话、消息提示、车站或机场等细节。',
            '情绪应当是温柔思念中带一点坚持，不要只剩下难过。',
            '副歌要突出“虽然不在身边，但感情没有被距离稀释”的核心。'
          ), style: 'pop', structure: '标准结构' } },
          { label: '雨夜独白', description: '带点电影感', values: { prompt: lines(
            '请用带电影感的笔触写一首雨夜独白歌词。',
            '主角处于孤独时刻，但不是绝望，而是在一场雨里和自己和解。',
            '画面里可以有车窗、路灯、潮湿街面、霓虹反光、旧回忆闪回等元素，语言要有镜头感。',
            '整体像一段夜色中的内心旁白，适合民谣或独立流行。'
          ), style: 'folk', structure: '完整结构' } }
        ]
      },
      {
        category: '成长励志',
        items: [
          { label: '毕业远行', description: '毕业季合唱', values: { prompt: lines(
            '请写一首适合毕业季合唱的中文流行歌词，主题是告别校园后各自奔赴远方。',
            '情绪要同时包含不舍、纪念和对未来的亮光，适合多人合唱，不要写得太私人化。',
            '歌词中要有教室、操场、晚自习、毕业照、行李箱等青春场景，但表达要自然。',
            '副歌要具备大合唱感，最好有一句能成为毕业季传播文案的主句。'
          ), style: 'pop', structure: '标准结构' } },
          { label: '追梦者', description: '热血但不过度喊口号', values: { prompt: lines(
            '请写一首关于年轻人追梦的歌词，热血但不要空洞喊口号。',
            '主角并不是一路开挂，而是在现实压力、质疑和自我怀疑中持续向前。',
            '请加入真实阻力，例如加班、失败、没人理解、差一点放弃，让成长更有说服力。',
            '副歌要有上冲感和信念感，但语言仍要克制、耐听。'
          ), style: 'rock', structure: '完整结构' } },
          { label: '创业心声', description: '给独立创业者', values: { prompt: lines(
            '请写一首给独立创业者的歌，主题围绕焦虑、孤独、坚持和最终突破。',
            '歌词要能写出一个人做产品、做内容、扛压力时的真实状态，而不是泛泛成功学。',
            '可以加入深夜改方案、订单起伏、被质疑、现金流焦虑、突然看见希望等细节。',
            '整体适合有节奏感的中文说唱或流行 rap，副歌要有记忆点。'
          ), style: 'rap', structure: '主歌-副歌-主歌-副歌' } },
          { label: '逆风翻盘', description: '运动赛事主题曲', values: { prompt: lines(
            '请写一首适合作为运动赛事剪辑 BGM 的热血歌词，主题是逆风翻盘。',
            '歌词重点写“落后、咬牙顶住、重新追分、最后反超”的过程感，适合配高能镜头。',
            '表达要有力量、有速度感，但避免老套中二词堆砌。',
            '副歌要像呐喊一样能顶住画面高潮，适合多人跟唱。'
          ), style: 'rock', structure: '标准结构' } }
        ]
      },
      {
        category: '风格实验',
        items: [
          { label: '国风江湖', description: '古风叙事', values: { prompt: lines(
            '请写一首国风江湖叙事歌词，主题是刀光剑影中的少年意气与离别。',
            '不要只堆砌古风词牌和辞藻，要有明确人物关系、事件推进和江湖感。',
            '画面里可以有长街、酒馆、马蹄、夜雪、佩刀、故人重逢或诀别等元素。',
            '整体要潇洒中带一点苍凉，适合有故事性的古风作品。'
          ), style: 'folk', structure: '完整结构' } },
          { label: '都市说唱', description: '街头观察', values: { prompt: lines(
            '请写一首都市说唱歌词，围绕打工人的通勤、压力、体面和自嘲展开。',
            '视角要像真的生活在城市里的人，不要为了押韵硬写空洞社会观察。',
            '请加入地铁、工位、外卖、群消息、租房、夜归等当代城市细节。',
            '整体语气可以有一点狠、一点幽默、一点疲惫，但不能失去真实感。'
          ), style: 'rap', structure: '主歌-副歌-主歌-副歌' } },
          { label: '电子情绪', description: '适合 synth-pop', values: { prompt: lines(
            '请写一首适合电子流行 synth-pop 风格的歌词，主题是虚拟世界里的真实情感。',
            '要有屏幕、信号、像素、延迟、在线状态等数字意象，但本质写的是人与人之间的情绪连接。',
            '文字要兼具冷感和柔软，适合电子编曲下的清冷氛围。',
            '副歌需要简洁、上口、带一点未来感。'
          ), style: 'pop', structure: '标准结构' } },
          { label: '民谣故事', description: '小镇回忆', values: { prompt: lines(
            '请写一首小镇回忆主题的民谣歌词，要有具体生活细节和旧时光感。',
            '故事可以围绕童年、旧街、河堤、集市、老房子、亲人或旧友展开，让人能看见画面。',
            '语气朴素、温暖、带一点岁月感，不要写成华丽辞藻堆叠。',
            '整首歌要像一个人坐在傍晚里慢慢讲起过去。'
          ), style: 'folk', structure: '简单结构' } }
        ]
      }
    ],
    music: [
      {
        category: '纯音乐场景',
        items: [
          { label: '夜读 Lo-fi', description: '夜晚学习背景音乐', values: { prompt: lines(
            '请生成一段适合夜晚学习和安静工作的 lo-fi 纯音乐。',
            '整体氛围要温暖、克制、轻微颗粒感，像台灯下独处时的背景音乐，不要太抢注意力。',
            '建议加入柔和钢琴、轻鼓点、低饱和弦乐或电钢音色，段落推进要平稳。',
            '请避免突然的大动态变化和过于复杂的旋律，让它适合长时间循环。'
          ), style: 'electronic', bpm: '中速 (90-120)', key: 'C大调', duration: '30秒' } },
          { label: '武侠古风', description: '古筝与笛子', values: { prompt: lines(
            '请生成一段古风武侠氛围纯音乐，情绪像“山雨欲来、高手对峙前的压抑宁静”。',
            '主乐器建议以古筝和竹笛为核心，辅以鼓点或低频氛围铺底，营造江湖张力。',
            '旋律不宜太甜，要有留白和悬念感，像影视配乐而不是传统节庆曲。',
            '结构上要有从安静铺陈到略微推进的过程，适合视频剪辑铺垫。'
          ), style: 'classical', bpm: '慢速 (60-80)', key: 'A小调', duration: '1分钟' } },
          { label: '咖啡馆爵士', description: '午后轻松氛围', values: { prompt: lines(
            '请生成一段适合咖啡馆午后播放的轻爵士纯音乐。',
            '整体要温暖、松弛、有一点都市感，适合聊天、阅读和轻办公场景。',
            '建议使用钢琴、贝斯、轻刷鼓和柔和铜管，旋律要优雅但不过度炫技。',
            '请让节奏自然摇摆，营造舒适、干净、不打扰的空间气质。'
          ), style: 'jazz', bpm: '中速 (90-120)', key: 'G大调', duration: '1分钟' } },
          { label: '赛博电子', description: '未来感片头', values: { prompt: lines(
            '请生成一段赛博朋克城市夜景氛围的电子纯音乐，适合科技产品片头或未来感视频。',
            '音乐要有霓虹、金属、夜色、速度感和一点危险气息，但不能太吵。',
            '建议使用合成器脉冲、低频推进、颗粒化质感和带空间感的音效设计。',
            '整体需要在短时间内建立世界观，适合高密度视觉画面开场。'
          ), style: 'electronic', bpm: '快速 (130-160)', key: 'D小调', duration: '30秒' } }
        ]
      },
      {
        category: '歌词成曲',
        items: [
          { label: '毕业合唱', description: '带人声的流行歌', values: { prompt: lines(
            '[Verse]',
            '教室的风吹过窗台，白纸上还写着没说完的未来。',
            '走廊尽头的笑声慢慢变远，行李箱把夏天拖向站台。',
            '',
            '[Chorus]',
            '我们终会奔向人海，也会在不同天光下醒来。',
            '可是青春不是离开，而是多年以后想起仍会发亮的名字。'
          ), style: 'pop', bpm: '中速 (90-120)', key: 'C大调', duration: '1分钟' } },
          { label: '摇滚燃点', description: '热血主歌副歌', values: { prompt: lines(
            '[Verse]',
            '逆风而行也不回头，脚下尘土都在替我怒吼。',
            '世界说前路太陡，我偏要把伤口磨成锋刃继续走。',
            '',
            '[Chorus]',
            '把名字刻进高空，让所有不看好的人都听见心脏的轰鸣。',
            '就算黑夜压得再重，也挡不住这一次真正点燃的火种。'
          ), style: 'rock', bpm: '快速 (130-160)', key: 'E大调', duration: '1分钟' } },
          { label: '城市民谣', description: '真实生活细节', values: { prompt: lines(
            '[Verse]',
            '最后一班车穿过雨夜，便利店的灯还亮在街角。',
            '你把围巾拢紧一点，说今天的风比昨天更像旧日子。',
            '',
            '[Chorus]',
            '生活总会有缺口，可也总有人在冷风里替你留一盏灯。',
            '人海很大，能被惦记这件事，本身就足够温柔。'
          ), style: 'folk', bpm: '慢速 (60-80)', key: 'A小调', duration: '1分钟' } },
          { label: '说唱情绪', description: '都市感节奏', values: { prompt: lines(
            '[Verse]',
            '地铁站里每张脸都像被时间按下加速，手机屏幕反光是城市最亮的脉冲。',
            '我们在同一条路上奔跑，表面冷静，心里都在和明天谈条件。',
            '',
            '[Chorus]',
            '但我还是想把真心交给节奏，让每一句都落在今晚的风里。',
            '哪怕世界太快，至少还有这一拍，证明我没有被吞没。'
          ), style: 'hiphop', bpm: '快速 (130-160)', key: 'D小调', duration: '30秒' } }
        ]
      },
      {
        category: '商业用途',
        items: [
          { label: '品牌广告', description: '轻快明亮', values: { prompt: lines(
            '请生成一段适合新消费品牌 15 秒广告结尾使用的轻快明亮纯音乐。',
            '音乐要有“高级、干净、年轻、让人记住品牌”的感觉，适合产品镜头和 logo 收尾。',
            '建议旋律简洁、节奏轻盈，结尾要有一个干净利落的记忆点。',
            '不要太儿童化，也不要太像通用企业宣传片。'
          ), style: 'pop', bpm: '中速 (90-120)', key: 'G大调', duration: '30秒' } },
          { label: 'App 开屏', description: '科技高级感', values: { prompt: lines(
            '请生成一段适合 AI 应用开屏和产品发布会使用的科技感纯音乐。',
            '重点气质是“高级、可信、未来感、不过分炫技”，能够抬升产品质感。',
            '建议加入冷色调合成器、层次清晰的节奏推进和一个代表“启动”的音色钩子。',
            '适合在 30 秒内快速建立“智能产品上线”的氛围。'
          ), style: 'electronic', bpm: '中速 (90-120)', key: 'C小调', duration: '30秒' } },
          { label: 'Vlog 配乐', description: '旅行记录', values: { prompt: lines(
            '请生成一段适合旅行 vlog 的纯音乐，关键词是阳光、开阔、自由和路途感。',
            '画面想象为清晨出发、公路、海边、城市切换、风景扫过镜头等场景。',
            '旋律要有轻松推进感，适合剪辑蒙太奇，不要太煽情，也不要过于平。',
            '整体应该让人听见就想出发。'
          ), style: 'folk', bpm: '中速 (90-120)', key: 'D大调', duration: '1分钟' } },
          { label: '课程片头', description: '知识博主', values: { prompt: lines(
            '请生成一段适合知识博主课程片头的纯音乐。',
            '气质要求是稳定、专业、值得信赖，同时不能过于严肃死板。',
            '请让音乐听起来像“接下来会进入一段高质量内容”，有清晰开场感。',
            '适合课程封面、章节开始或知识产品介绍视频使用。'
          ), style: 'classical', bpm: '慢速 (60-80)', key: 'C大调', duration: '30秒' } }
        ]
      }
    ],
    cover: [
      {
        category: '专辑封面',
        items: [
          { label: '霓虹流行', description: '都市流行封面', values: { prompt: lines(
            '请生成一张适合中文流行音乐发行的专辑封面，主题是赛博朋克城市夜景。',
            '画面要有霓虹灯、湿漉街道、冷暖对撞光线和一点电影感，整体高级而不廉价。',
            '构图适合做 1:1 专辑封面，中间主体明确，同时保留放歌名和艺人名的空间。',
            '避免画面过满、避免低质科幻元素堆砌、避免俗艳荧光配色失控。'
          ), ratio: '1:1', style: '赛博朋克' } },
          { label: '民谣写真', description: '胶片与草地', values: { prompt: lines(
            '请生成一张民谣专辑封面，风格偏胶片摄影。',
            '场景是傍晚草地、旧木吉他、微风、自然光，整体安静、真实、带一点旧时光感。',
            '画面构图要留有呼吸感和排版留白，像独立音乐人的发行封面。',
            '避免旅游照感，重点是情绪和质感。'
          ), ratio: '3:4', style: '写实摄影' } },
          { label: '电子极简', description: '高级几何构图', values: { prompt: lines(
            '请生成一张电子音乐 EP 封面，黑底，金属几何主体，极简但高级。',
            '画面应强调材质、比例、留白和秩序感，像品牌级电子音乐视觉系统。',
            '主体可以是抽象金属体、折面或几何悬浮结构，光线冷峻、边缘清晰。',
            '避免杂乱背景和廉价 3D 质感。'
          ), ratio: '1:1', style: '极简几何' } },
          { label: '动漫梦境', description: '轻幻想风', values: { prompt: lines(
            '请生成一张带梦境感的二次元音乐封面，元素包括星空、漂浮列车、少女背影与轻幻想氛围。',
            '画面要有层次和故事感，像一张能引发联想的动画电影海报截帧。',
            '色调偏柔和梦幻，但不能过度甜腻；请保留封面文字位置。',
            '整体重点是治愈、遥远、带一点遗憾的幻想感。'
          ), ratio: '3:4', style: '水彩' } }
        ]
      },
      {
        category: '品牌视觉',
        items: [
          { label: '科技发布会', description: '发布会 KV', values: { prompt: lines(
            '请生成一张 AI 产品发布会主视觉 KV，比例 16:9。',
            '需要体现未来感、秩序感和科技可信度，适合发布会大屏、官网头图或直播封面。',
            '建议使用渐变背景、发光网格、悬浮界面语言和简洁空间层次。',
            '请留出清晰标题区，不要让元素压满画面。'
          ), ratio: '16:9', style: '赛博朋克' } },
          { label: '播客封面', description: '知识访谈节目', values: { prompt: lines(
            '请生成一张中文商业播客封面，整体气质稳重、专业、值得信赖。',
            '配色以蓝金或深色高级配色为主，要有知识访谈节目的内容质感。',
            '构图必须适合放置节目标题、副标题和嘉宾信息，不能只是抽象图。',
            '避免廉价金融海报感，强调现代、简洁、成熟。'
          ), ratio: '1:1', style: '极简几何' } },
          { label: '课程海报', description: '线上课程宣传图', values: { prompt: lines(
            '请生成一张 AI 实战课程宣传海报，适合知识付费场景。',
            '风格要现代、专业、有明确转化感，让人一看就知道这是能学到真东西的课程。',
            '请在视觉上预留主标题、讲师信息、利益点和按钮区域的位置。',
            '整体应兼顾可信度和吸引力，不要像模板化电商图。'
          ), ratio: '16:9', style: '写实摄影' } },
          { label: '活动 banner', description: '社群活动视觉', values: { prompt: lines(
            '请生成一张面向音乐创作者社群活动的 banner 图，比例 16:9。',
            '画面需要热闹、有创意、带舞台灯光和现场能量，但仍然保持视觉秩序。',
            '适合线上活动海报或社群招募宣传，保留大标题和活动信息区域。',
            '重点是激发参与感，而不是做成普通商业展板。'
          ), ratio: '16:9', style: '油画' } }
        ]
      },
      {
        category: '实验风格',
        items: [
          { label: '像素复古', description: '游戏 OST 封面', values: { prompt: lines(
            '请生成一张复古像素艺术风格的游戏原声封面。',
            '画面核心元素是 8-bit 城市夜空、像素灯光和带一点冒险感的复古氛围。',
            '整体要像经典独立游戏原声集封面，既怀旧又有设计感。',
            '请控制像素颗粒和构图秩序，避免只是低分辨率拼贴。'
          ), ratio: '1:1', style: '像素艺术' } },
          { label: '油画人像', description: '独立音乐人', values: { prompt: lines(
            '请生成一张独立音乐人专辑封面，主体是厚涂油画风半身像。',
            '要求强烈光影、明显笔触、人物神情有故事感，像艺术馆海报而不是普通写真。',
            '背景和配色要服务人物情绪，适合放置专辑标题。',
            '整体偏艺术表达，不要做成商业证件照式人像。'
          ), ratio: '3:4', style: '油画' } },
          { label: '极简黑白', description: '先锋实验音乐', values: { prompt: lines(
            '请生成一张适合先锋实验音乐的黑白极简封面。',
            '要求高对比、粗粝纹理、强留白和明显的设计语言，像独立厂牌发行物。',
            '可以有抽象形体、噪点、撕裂感或构成主义气质，但必须克制、有秩序。',
            '重点是冷峻、前卫、让人一眼感到“不太主流”。'
          ), ratio: '1:1', style: '极简几何' } },
          { label: '水彩诗意', description: '轻柔治愈感', values: { prompt: lines(
            '请生成一张诗意水彩风音乐封面，元素包括湖面、远山、晨雾和柔和配色。',
            '整体要轻柔、留白、带呼吸感，像一张能安静下来看的治愈系封面。',
            '画面层次要通透，不要脏、不堆色。',
            '适合抒情、轻音乐或治愈系作品。'
          ), ratio: '3:4', style: '水彩' } }
        ]
      }
    ],
    speech: [
      {
        category: '商业播报',
        items: [
          { label: '欢迎语', description: '产品首页欢迎词', values: { text: lines(
            '你好，欢迎来到 AI 内容生成站。',
            '在这里，你可以用一个工作台完成 AI 对话、歌词创作、图片生成、音乐生成、歌声翻唱和语音合成。',
            '如果你想更快开始，可以直接选择模板，一键进入对应场景。',
            '现在，就从你最想完成的那个任务开始吧。'
          ), voice_id: 'male-qn-qingse', emotion: 'happy', speed: 1, pitch: 1, vol: 50, output_format: 'mp3' } },
          { label: '课程开场', description: '知识博主片头', values: { text: lines(
            '欢迎来到今天的 AI 实战课程。',
            '这节内容不会停留在概念层面，而是带你从真实需求出发，一步一步跑通从思路到落地的完整流程。',
            '如果你也想把 AI 变成每天都能用上的工作搭子，那么接下来的内容会很适合你。',
            '现在，我们正式开始。'
          ), voice_id: 'Chinese (Mandarin)_Lyrical_Voice', emotion: 'fluent', speed: 1, pitch: 1, vol: 55, output_format: 'mp3' } },
          { label: '客服播报', description: '售后通知', values: { text: lines(
            '您好，您提交的问题我们已经收到。',
            '相关信息已进入处理流程，我们会在一个工作日内完成核查，并通过站内通知或短信同步结果。',
            '如果期间需要补充材料，我们也会第一时间与您联系。',
            '感谢您的耐心等待。'
          ), voice_id: 'female-tianmei', emotion: 'calm', speed: 0.9, pitch: 1, vol: 50, output_format: 'wav' } },
          { label: '活动主持', description: '线下活动串场', values: { text: lines(
            '接下来，让我们把目光转向今天的下一位分享嘉宾。',
            '他将带来关于 AI 与内容创作结合的最新实践，也会分享一些真正落地后的经验和判断。',
            '如果你关心 AI 工具怎么从“好玩”变成“好用”，接下来的内容请一定不要错过。',
            '让我们用掌声欢迎他上场。'
          ), voice_id: 'male-qn-qingse', emotion: 'surprised', speed: 1.1, pitch: 1, vol: 60, output_format: 'mp3' } }
        ]
      },
      {
        category: '情绪表达',
        items: [
          { label: '晚安电台', description: '治愈感低语', values: { text: lines(
            '如果你今天有一点累，那就先把世界调低一点音量。',
            '有些事情不必今晚想明白，有些答案也不用急着现在得到。',
            '先让呼吸慢一点，让心也慢一点。',
            '今晚好好休息，明天再继续发光。'
          ), voice_id: 'Chinese (Mandarin)_Lyrical_Voice', emotion: 'whisper', speed: 0.8, pitch: 0.9, vol: 40, output_format: 'mp3' } },
          { label: '激励口播', description: '鼓舞士气', values: { text: lines(
            '别因为走得慢，就怀疑自己。',
            '你已经比昨天更靠近目标，也比曾经那个犹豫不前的自己更进一步。',
            '真正重要的不是一夜翻盘，而是你没有停下。',
            '继续向前，答案会在路上出现。'
          ), voice_id: 'English_Persuasive_Man', emotion: 'happy', speed: 1.1, pitch: 1, vol: 60, output_format: 'mp3' } },
          { label: '故事朗读', description: '温柔叙述', values: { text: lines(
            '那年夏天，风吹过河堤，天空很蓝，树影落在我们并肩走过的小路上。',
            '我们都还年轻，也都还相信未来会像电影里一样闪闪发光。',
            '后来很多人走散了，很多话也没来得及说完。',
            '可只要想起那个傍晚，我还是会觉得，青春真好。'
          ), voice_id: 'female-tianmei', emotion: 'sad', speed: 0.95, pitch: 1.1, vol: 50, output_format: 'wav' } },
          { label: '诗词朗诵', description: '古典氛围', values: { text: lines(
            '春风又绿江南岸，明月何时照我还。',
            '山一程，水一程，行至天涯也总会想起来时的灯火。',
            '若有远行，愿前路不惧风雨；若有重逢，愿故人依旧如初。',
            '山水有相逢，愿君多珍重。'
          ), voice_id: 'Chinese (Mandarin)_HK_Flight_Attendant', emotion: 'calm', speed: 0.85, pitch: 1, vol: 50, output_format: 'mp3' } }
        ]
      }
    ],
    covervoice: [
      {
        category: '常见翻唱',
        items: [
          { label: '磁性男声', description: '成熟流行风', values: { prompt: lines(
            '请以成熟稳重的磁性男声完成翻唱，整体偏中文流行风。',
            '演唱要情绪克制但有内在张力，咬字清楚，气声和共鸣自然，不要太油。',
            '重点表现副歌的情绪抬升和主歌的叙述感，适合深情但不过火的作品。',
            '避免过度修音感、避免夸张拖腔和过重鼻音。'
          ), timbre: '磁性男声', pitch: '' } },
          { label: '清亮女声', description: '透明治愈感', values: { prompt: lines(
            '请用清亮通透的女声完成翻唱，整体轻柔、治愈、带空气感。',
            '音色要干净、年轻、稳定，适合抒情流行和温柔旋律。',
            '演唱重点是自然呼吸、细腻咬字和副歌的透明感，不要太甜腻。',
            '避免尖锐、高压、机械感过强的高频表现。'
          ), timbre: '清澈女声', pitch: '+3' } },
          { label: '甜美女声', description: '轻快明亮', values: { prompt: lines(
            '请用甜美女声完成翻唱，整体青春、明亮、轻快，适合恋爱感歌曲。',
            '情绪表达要轻盈、有笑意，节奏处理灵动一点，但不要做作。',
            '主歌可以带一点俏皮感，副歌则要更抓耳、更有记忆点。',
            '避免娃娃音过头和失真式可爱。'
          ), timbre: '甜美女声', pitch: '+5' } },
          { label: '低沉男声', description: '欧美流行感', values: { prompt: lines(
            '请用低沉男声完成翻唱，带一点欧美流行质感和轻微沙哑呼吸感。',
            '整体要稳、松、带舞台感，适合中慢板流行情歌或氛围感作品。',
            '主歌注重低声区叙述感，副歌适当打开但不要吼。',
            '避免咬字含混和过度压嗓。'
          ), timbre: '低沉男声', pitch: '-3' } }
        ]
      },
      {
        category: '风格迁移',
        items: [
          { label: '动漫少年音', description: '日系清爽风', values: { prompt: lines(
            '请以清亮少年音风格完成翻唱，带一点日系动漫主题曲的热血感。',
            '整体音色年轻、干净、有向上的冲劲，适合青春成长或冒险感歌曲。',
            '主歌要清爽自然，副歌要明显打开但仍保持少年感，不要太厚重。',
            '避免过度卡通腔或过于幼态。'
          ), timbre: '中性嗓音', pitch: '+3' } },
          { label: 'R&B 女声', description: '松弛律动', values: { prompt: lines(
            '请以慵懒性感的 R&B 女声风格完成翻唱。',
            '整体律动感要强，尾音自然滑入，节拍处理带一点松弛与呼吸感。',
            '情绪不必外放，要靠细节、转音和质感来体现氛围。',
            '避免过于用力的高音和流行大歌式唱法。'
          ), timbre: '清澈女声', pitch: '' } },
          { label: '舞台摇滚', description: '更炸更有张力', values: { prompt: lines(
            '请以摇滚舞台男声风格完成翻唱，整体情绪外放、现场感强。',
            '副歌需要有明显爆发力和带观众情绪的推进感，主歌则保持蓄力。',
            '可以加入适度颗粒感和边缘沙哑，但核心音准与节奏要稳定。',
            '避免一味硬吼，重点是有控制的张力。'
          ), timbre: '低沉男声', pitch: '' } },
          { label: '治愈电台', description: '贴耳细腻', values: { prompt: lines(
            '请做成像深夜电台主播贴耳轻唱的翻唱效果。',
            '整体温柔、安静、细腻，像在耳边讲故事，而不是正式舞台表演。',
            '主歌要有近距离感和亲密感，副歌也保持克制，不要突然放太大。',
            '避免过度混响和明显商业修音味。'
          ), timbre: '中性嗓音', pitch: '-5' } }
        ]
      }
    ]
  };

  function createMemoryStorage() {
    const data = new Map();
    return {
      getItem(key) {
        return data.has(key) ? data.get(key) : null;
      },
      setItem(key, value) {
        data.set(key, String(value));
      },
      removeItem(key) {
        data.delete(key);
      }
    };
  }

  function authenticate(username, password) {
    return username === AUTH.username && password === AUTH.password;
  }

  function buildKey(parts) {
    return [STORAGE_PREFIX].concat(parts).join('.');
  }

  function safeParse(value, fallback) {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function getGlobalScope() {
    if (typeof globalThis !== 'undefined') return globalThis;
    if (typeof window !== 'undefined') return window;
    return {};
  }

  function getBrowserOrigin() {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return 'http://localhost';
  }

  function getConfiguredApiBaseUrl() {
    const globalScope = getGlobalScope();
    const directValue = String(globalScope.AIGS_API_BASE_URL || '').trim();
    if (directValue) {
      try {
        return new URL(directValue, getBrowserOrigin()).origin;
      } catch {
        return null;
      }
    }

    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') {
      return null;
    }

    const meta = document.querySelector('meta[name="aigs-api-base-url"]');
    const metaValue = String(meta?.getAttribute?.('content') || '').trim();
    if (!metaValue) return null;

    try {
      return new URL(metaValue, getBrowserOrigin()).origin;
    } catch {
      return null;
    }
  }

  function buildApiUrl(pathname) {
    const rawPath = String(pathname || '').trim();
    if (!rawPath) return rawPath;

    try {
      return new URL(rawPath).href;
    } catch {
      // Keep relative path handling below.
    }

    const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const apiBaseUrl = getConfiguredApiBaseUrl();
    if (!apiBaseUrl) {
      return normalizedPath;
    }
    return new URL(normalizedPath, apiBaseUrl).href;
  }

  function resolveApiAssetUrl(rawUrl) {
    const value = String(rawUrl || '').trim();
    if (!value) return '';

    try {
      return new URL(value).href;
    } catch {
      // Keep relative path handling below.
    }

    const apiBaseUrl = getConfiguredApiBaseUrl();
    if (!apiBaseUrl) {
      return value;
    }

    const normalizedPath = value.startsWith('/') ? value : `/${value}`;
    if (!normalizedPath.startsWith('/output/') && !normalizedPath.startsWith('/api/')) {
      return value;
    }
    return new URL(normalizedPath, apiBaseUrl).href;
  }

  function normalizeConversationTitle(title) {
    const normalized = String(title || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '新对话';
    return normalized.length > 48 ? `${normalized.slice(0, 48)}...` : normalized;
  }

  function filterConversationSummaries(items, query) {
    const collection = Array.isArray(items) ? items.slice() : [];
    const normalizedQuery = String(query || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!normalizedQuery) return collection;

    const terms = normalizedQuery.split(' ').filter(Boolean);
    return collection.filter(item => {
      const haystack = [
        item?.title || '',
        item?.model || '',
        item?.preview || ''
      ].join(' ').toLowerCase();
      return terms.every(term => haystack.includes(term));
    });
  }

  function createApiClient(fetchImpl) {
    const CSRF_HEADER_NAME = 'X-CSRF-Token';
    let csrfToken = null;
    let csrfPromise = null;

    async function loadCsrfToken(forceRefresh = false) {
      if (!forceRefresh && csrfToken) {
        return csrfToken;
      }
      if (!forceRefresh && csrfPromise) {
        return csrfPromise;
      }

      const request = (async () => {
        const response = await fetchImpl(buildApiUrl('/api/auth/csrf'), {
          method: 'GET',
          credentials: 'include'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.csrfToken) {
          throw new Error(data.error || '服务连接失败，请刷新页面重试');
        }
        csrfToken = String(data.csrfToken);
        return csrfToken;
      })();

      csrfPromise = request.finally(() => {
        csrfPromise = null;
      });
      return csrfPromise;
    }

    async function readCloneReason(response) {
      if (!response || typeof response.clone !== 'function') {
        return null;
      }

      const payload = await response.clone().json().catch(() => null);
      return payload?.reason || null;
    }

    async function fetchApi(pathname, options = {}, meta = {}) {
      const method = String(options.method || 'GET').toUpperCase();
      const requiresCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method);
      const headers = {
        ...(options.headers || {})
      };

      if (requiresCsrf) {
        headers[CSRF_HEADER_NAME] = await loadCsrfToken(Boolean(meta.forceCsrfRefresh));
      }

      const response = await fetchImpl(buildApiUrl(pathname), {
        ...options,
        method,
        credentials: 'include',
        headers
      });

      if (requiresCsrf && !meta.retried && response.status === 403) {
        const reason = await readCloneReason(response);
        if (String(reason || '').startsWith('csrf_')) {
          csrfToken = null;
          await loadCsrfToken(true);
          return fetchApi(pathname, options, {
            ...meta,
            retried: true,
            forceCsrfRefresh: false
          });
        }
      }

      return response;
    }

    return {
      fetch: fetchApi,
      buildUrl: buildApiUrl,
      resolveAssetUrl: resolveApiAssetUrl,
      clearCsrfToken() {
        csrfToken = null;
      },
      async ensureCsrfToken(forceRefresh = false) {
        return loadCsrfToken(forceRefresh);
      }
    };
  }

  function createPersistence(storage) {
    return {
      loadSession() {
        return safeParse(storage.getItem(buildKey(['session'])), null);
      },
      saveSession(session) {
        storage.setItem(buildKey(['session']), JSON.stringify(session));
      },
      clearSession() {
        storage.removeItem(buildKey(['session']));
      },
      getHistory(username, feature) {
        return safeParse(storage.getItem(buildKey(['history', username, feature])), []);
      },
      saveHistory(username, feature, entries) {
        storage.setItem(buildKey(['history', username, feature]), JSON.stringify(entries.slice(0, MAX_HISTORY_ITEMS)));
      },
      appendHistory(username, feature, entry) {
        const existing = this.getHistory(username, feature);
        const next = [entry].concat(existing).slice(0, MAX_HISTORY_ITEMS);
        this.saveHistory(username, feature, next);
        return next;
      },
      getConversations(username) {
        return safeParse(storage.getItem(buildKey(['conversations', username])), []);
      },
      saveConversations(username, conversations) {
        storage.setItem(buildKey(['conversations', username]), JSON.stringify(conversations || []));
      },
      getArchivedConversations(username) {
        return safeParse(storage.getItem(buildKey(['archived-conversations', username])), []);
      },
      listArchivedConversations(username) {
        return this.getArchivedConversations(username);
      },
      saveArchivedConversations(username, conversations) {
        storage.setItem(buildKey(['archived-conversations', username]), JSON.stringify(conversations || []));
      },
      createConversation(username, payload = {}) {
        const now = Date.now();
        const existing = this.getConversations(username);
        const conversation = {
          id: `conv-${now}`,
          title: normalizeConversationTitle(payload.title || '新对话'),
          model: payload.model || 'gpt-4.1-mini',
          messageCount: 0,
          lastMessageAt: null,
          createdAt: now,
          updatedAt: now
        };
        this.saveConversations(username, [conversation].concat(existing));
        this.saveConversationMessages(username, conversation.id, []);
        return conversation;
      },
      getConversation(username, conversationId) {
        return this.getConversations(username).find(item => item.id === conversationId) || null;
      },
      getConversationMessages(username, conversationId) {
        return safeParse(storage.getItem(buildKey(['conversation-messages', username, conversationId])), []);
      },
      saveConversationMessages(username, conversationId, messages) {
        storage.setItem(buildKey(['conversation-messages', username, conversationId]), JSON.stringify(messages || []));
      },
      updateConversation(username, conversationId, patch = {}) {
        const conversations = this.getConversations(username);
        const existing = conversations.find(item => item.id === conversationId);
        if (!existing) return { conversation: null };

        const updated = {
          ...existing,
          title: Object.prototype.hasOwnProperty.call(patch, 'title')
            ? normalizeConversationTitle(patch.title)
            : existing.title,
          model: Object.prototype.hasOwnProperty.call(patch, 'model') && String(patch.model || '').trim()
            ? String(patch.model || '').trim()
            : existing.model,
          updatedAt: Date.now()
        };

        this.saveConversations(username, conversations.map(item => item.id === conversationId ? updated : item));
        return { conversation: updated };
      },
      archiveConversation(username, conversationId) {
        const conversations = this.getConversations(username);
        const archived = conversations.find(item => item.id === conversationId);
        const archivedConversations = this.getArchivedConversations(username);
        const remaining = conversations.filter(item => item.id !== conversationId);
        const archivedItem = archived
          ? {
              ...archived,
              archivedAt: Date.now(),
              updatedAt: Date.now()
            }
          : null;
        this.saveConversations(username, remaining);
        if (archivedItem) {
          this.saveArchivedConversations(username, [archivedItem].concat(archivedConversations.filter(item => item.id !== archivedItem.id)));
        }
        return {
          archivedConversationId: archived?.id || conversationId,
          archivedConversation: archivedItem,
          conversations: remaining,
          archivedConversations: archivedItem
            ? [archivedItem].concat(archivedConversations.filter(item => item.id !== archivedItem.id))
            : archivedConversations
        };
      },
      restoreConversation(username, conversationId) {
        const conversations = this.getConversations(username);
        const archivedConversations = this.getArchivedConversations(username);
        const archived = archivedConversations.find(item => item.id === conversationId);
        if (!archived) {
          return { conversation: null, conversations, archivedConversations };
        }

        const restoredConversation = {
          ...archived,
          archivedAt: null,
          updatedAt: Date.now()
        };
        const nextArchivedConversations = archivedConversations.filter(item => item.id !== conversationId);
        const nextConversations = [restoredConversation].concat(conversations.filter(item => item.id !== conversationId));

        this.saveConversations(username, nextConversations);
        this.saveArchivedConversations(username, nextArchivedConversations);

        return {
          conversation: restoredConversation,
          conversations: nextConversations,
          archivedConversations: nextArchivedConversations
        };
      },
      deleteArchivedConversation(username, conversationId) {
        const conversations = this.getConversations(username);
        const archivedConversations = this.getArchivedConversations(username);
        const archived = archivedConversations.find(item => item.id === conversationId);
        if (!archived) {
          return {
            deletedConversation: null,
            deletedConversationId: conversationId,
            conversations,
            archivedConversations
          };
        }

        const nextArchivedConversations = archivedConversations.filter(item => item.id !== conversationId);
        this.saveArchivedConversations(username, nextArchivedConversations);

        return {
          deletedConversation: archived,
          deletedConversationId: conversationId,
          conversations,
          archivedConversations: nextArchivedConversations
        };
      }
    };
  }

  function createRemotePersistence(fetchImpl) {
    const apiClient = createApiClient(fetchImpl);

    function notifyAuthExpired(detail) {
      if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
      const eventDetail = detail || {};
      if (typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new window.CustomEvent('app-auth-expired', { detail: eventDetail }));
        return;
      }
      if (typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('app-auth-expired', { detail: eventDetail }));
        return;
      }
      window.dispatchEvent({ type: 'app-auth-expired', detail: eventDetail });
    }

    function notifyPasswordResetRequired(detail) {
      if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
      const eventDetail = detail || {};
      if (typeof window.CustomEvent === 'function') {
        window.dispatchEvent(new window.CustomEvent('app-password-reset-required', { detail: eventDetail }));
        return;
      }
      if (typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('app-password-reset-required', { detail: eventDetail }));
        return;
      }
      window.dispatchEvent({ type: 'app-password-reset-required', detail: eventDetail });
    }

    async function parseResponse(response) {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || `HTTP ${response.status}`);
        error.status = response.status;
        error.reason = data.reason || null;
        error.user = data.user || null;
        if (response.status === 401) {
          notifyAuthExpired({
            status: response.status,
            reason: data.reason || 'session_expired',
            message: data.error || '登录状态已失效，请重新登录'
          });
        } else if (response.status === 403 && data.reason === 'password_reset_required') {
          notifyPasswordResetRequired({
            status: response.status,
            reason: data.reason,
            message: data.error || '请先修改临时密码后再继续使用',
            user: data.user || null
          });
        }
        throw error;
      }
      return data;
    }

    return {
      async loadSession() {
        const response = await apiClient.fetch('/api/auth/session', {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-store',
            Pragma: 'no-cache'
          }
        });
        if (response.status === 401) {
          return null;
        }
        const data = await parseResponse(response);
        return data.user || null;
      },

      async login(username, password) {
        const response = await apiClient.fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await parseResponse(response);
        return data.user || null;
      },

      async register(payload) {
        const response = await apiClient.fetch('/api/auth/register', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload || {})
        });
        const data = await parseResponse(response);
        return data.user || null;
      },

      async logout() {
        const response = await apiClient.fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }
        });
        await parseResponse(response);
      },

      async changePassword(payload) {
        const response = await apiClient.fetch('/api/auth/change-password', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await parseResponse(response);
        return {
          user: data.user || null,
          sessionRetained: Boolean(data.sessionRetained)
        };
      },

      async getInvitationSession(token) {
        const params = new URLSearchParams();
        if (token != null && token !== '') params.set('token', String(token));
        const response = await apiClient.fetch(`/api/auth/invitation?${params.toString()}`, {
          credentials: 'same-origin'
        });
        return parseResponse(response);
      },

      async activateInvitation(token, password) {
        const response = await apiClient.fetch('/api/auth/invitation/activate', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password })
        });
        const data = await parseResponse(response);
        return {
          user: data.user || null
        };
      },

      async requestPasswordReset(username) {
        const response = await apiClient.fetch('/api/auth/forgot-password', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        });
        return parseResponse(response);
      },

      async getPasswordResetSession(token) {
        const params = new URLSearchParams();
        if (token != null && token !== '') params.set('token', String(token));
        const response = await apiClient.fetch(`/api/auth/password-reset?${params.toString()}`, {
          credentials: 'same-origin'
        });
        return parseResponse(response);
      },

      async completePasswordReset(token, password) {
        const response = await apiClient.fetch('/api/auth/password-reset/complete', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password })
        });
        const data = await parseResponse(response);
        return {
          user: data.user || null
        };
      },

      async getHistory(username, feature) {
        const response = await apiClient.fetch(`/api/history/${feature}`, { credentials: 'same-origin' });
        const data = await parseResponse(response);
        return data.items || [];
      },

      async appendHistory(username, feature, entry) {
        const response = await apiClient.fetch(`/api/history/${feature}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entry })
        });
        const data = await parseResponse(response);
        return data.items || [];
      },

      async getPreferences() {
        const response = await apiClient.fetch('/api/preferences', { credentials: 'same-origin' });
        const data = await parseResponse(response);
        return data.preferences || {};
      },

      async savePreferences(patch) {
        const response = await apiClient.fetch('/api/preferences', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch)
        });
        const data = await parseResponse(response);
        return data.preferences || {};
      },

      async getUsageToday() {
        const response = await apiClient.fetch('/api/usage/today', { credentials: 'same-origin' });
        const data = await parseResponse(response);
        return data.usage || {};
      },

      async getTemplates(feature) {
        const response = await apiClient.fetch(`/api/templates/${feature}`, { credentials: 'same-origin' });
        return parseResponse(response);
      },

      async createTemplate(feature, template) {
        const response = await apiClient.fetch(`/api/templates/${feature}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(template)
        });
        const data = await parseResponse(response);
        return data.template || null;
      },

      async toggleTemplateFavorite(feature, templateId) {
        const response = await apiClient.fetch(`/api/templates/${feature}/${templateId}/favorite`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }
        });
        return parseResponse(response);
      },

      async getAdminUsers() {
        const response = await apiClient.fetch('/api/admin/users', { credentials: 'same-origin' });
        const data = await parseResponse(response);
        return data.users || [];
      },

      async getAdminAuditLogs(query = {}) {
        const params = new URLSearchParams();
        Object.entries(query || {}).forEach(([key, value]) => {
          if (value == null || value === '') return;
          params.set(key, String(value));
        });
        const response = await apiClient.fetch(`/api/admin/audit-logs${params.toString() ? `?${params.toString()}` : ''}`, {
          credentials: 'same-origin'
        });
        return parseResponse(response);
      },

      async issueAdminInvitation(userId) {
        const response = await apiClient.fetch(`/api/admin/users/${userId}/invite`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        return parseResponse(response);
      },

      async resendAdminInvitation(userId) {
        const response = await apiClient.fetch(`/api/admin/users/${userId}/invite-resend`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        return parseResponse(response);
      },

      async revokeAdminInvitation(userId) {
        const response = await apiClient.fetch(`/api/admin/users/${userId}/invite-revoke`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        return parseResponse(response);
      },

      async createAdminUser(payload) {
        const response = await apiClient.fetch('/api/admin/users', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await parseResponse(response);
        return data.user || null;
      },

      async updateAdminUser(userId, patch) {
        const response = await apiClient.fetch(`/api/admin/users/${userId}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch)
        });
        const data = await parseResponse(response);
        return data.user || null;
      },

      async resetAdminUserPassword(userId, password) {
        const response = await apiClient.fetch(`/api/admin/users/${userId}/password`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await parseResponse(response);
        return {
          user: data.user || null,
          sessionRetained: Boolean(data.sessionRetained)
        };
      },

      async getConversations() {
        const response = await apiClient.fetch('/api/conversations', { credentials: 'same-origin' });
        const data = await parseResponse(response);
        return data.conversations || [];
      },

      async listArchivedConversations() {
        const response = await apiClient.fetch('/api/conversations/archived', { credentials: 'same-origin' });
        const data = await parseResponse(response);
        return data.conversations || [];
      },

      async createConversation(payload = {}) {
        const response = await apiClient.fetch('/api/conversations', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await parseResponse(response);
        return {
          conversation: data.conversation || null,
          messages: data.messages || []
        };
      },

      async getConversation(conversationId) {
        const response = await apiClient.fetch(`/api/conversations/${conversationId}`, { credentials: 'same-origin' });
        const data = await parseResponse(response);
        return {
          conversation: data.conversation || null,
          messages: data.messages || []
        };
      },

      async updateConversation(conversationId, patch = {}) {
        const response = await apiClient.fetch(`/api/conversations/${conversationId}`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch)
        });
        const data = await parseResponse(response);
        return {
          conversation: data.conversation || null
        };
      },

      async archiveConversation(conversationId) {
        const response = await apiClient.fetch(`/api/conversations/${conversationId}/archive`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        return parseResponse(response);
      },

      async restoreConversation(conversationId) {
        const response = await apiClient.fetch(`/api/conversations/${conversationId}/restore`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        return parseResponse(response);
      },

      async deleteArchivedConversation(conversationId) {
        const response = await apiClient.fetch(`/api/conversations/${conversationId}/delete`, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        return parseResponse(response);
      },

      async sendChatMessage(payload) {
        const response = await apiClient.fetch('/api/chat', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        return parseResponse(response);
      }
    };
  }

  return {
    AUTH,
    FEATURE_META,
    TEMPLATE_LIBRARY,
    MAX_HISTORY_ITEMS,
    STORAGE_PREFIX,
    authenticate,
    filterConversationSummaries,
    createMemoryStorage,
    createPersistence,
    createApiClient,
    getConfiguredApiBaseUrl,
    buildApiUrl,
    resolveApiAssetUrl,
    createRemotePersistence
  };
});
